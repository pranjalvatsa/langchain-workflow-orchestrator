const { WorkflowExecution } = require('../models');
const LangChainService = require('./LangChainService');
const winston = require('winston');

class WorkflowExecutionService {
  constructor(io) {
    this.io = io;
    this.langChainService = new LangChainService();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/execution.log' })
      ]
    });

    // Track active executions
    this.activeExecutions = new Map();
  }

  async executeWorkflow(workflow, userId, inputs = {}, options = {}) {
    const executionId = this.generateExecutionId();
    
    try {
      // Create execution record
      const execution = new WorkflowExecution({
        executionId: executionId,
        workflowId: workflow._id,
        workflowVersion: workflow.version || '1.0.0',
        triggeredBy: {
          type: 'api',
          userId: userId !== 'anonymous' ? userId : null,
          source: 'universal-workflow-engine',
          metadata: options.metadata || {}
        },
        status: 'running',
        inputs,
        outputs: {},
        executionSteps: [],
        logs: [],
        metrics: {
          startTime: new Date(),
          totalNodes: workflow.nodes.length,
          executedNodes: 0,
          failedNodes: 0
        },
        configuration: {
          maxRetries: options.maxRetries || 3,
          timeout: options.timeout || 300000, // 5 minutes
          parallelExecution: options.parallelExecution || false
        }
      });

      await execution.save();

      // Store in active executions
      this.activeExecutions.set(executionId, {
        execution,
        workflow,
        context: { ...inputs },
        aborted: false
      });

      // Emit start event
      this.emitExecutionEvent(executionId, 'execution_started', {
        executionId,
        workflowId: workflow._id,
        status: 'running'
      });

      // Start execution
      this.executeWorkflowNodes(executionId, workflow, inputs)
        .then(result => {
          this.completeExecution(executionId, 'completed', result);
        })
        .catch(error => {
          this.completeExecution(executionId, 'failed', null, error);
        });

      return execution;
    } catch (error) {
      this.logger.error('Error starting workflow execution:', error);
      throw error;
    }
  }

  async executeWorkflowNodes(executionId, workflow, initialInputs) {
    const activeExecution = this.activeExecutions.get(executionId);
    if (!activeExecution) {
      throw new Error('Execution not found');
    }

    const { execution, context } = activeExecution;
    const { nodes, edges } = workflow;

    // Debug logging
    this.logger.info('Workflow execution debug:', {
      workflowId: workflow.id || workflow._id,
      nodeCount: nodes?.length || 0,
      edgeCount: edges?.length || 0,
      nodes: nodes?.map(n => ({ id: n.id, type: n.type })) || [],
      edges: edges?.map(e => ({ source: e.source, target: e.target })) || []
    });

    // Build execution graph
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const edgeMap = this.buildEdgeMap(edges);
    
    // Find start nodes (nodes with no incoming edges)
    const startNodes = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );

    this.logger.info('Start node detection:', {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      startNodesFound: startNodes.length,
      startNodeIds: startNodes.map(n => n.id)
    });

    if (startNodes.length === 0) {
      this.logger.error('No start node found - detailed debug:', {
        allNodeIds: nodes.map(n => n.id),
        allEdgeTargets: edges.map(e => e.target),
        nodesWithIncoming: nodes.map(node => ({
          id: node.id,
          hasIncoming: edges.some(edge => edge.target === node.id)
        }))
      });
      throw new Error('No start node found in workflow');
    }

    // Initialize execution state
    const executionState = {
      completedNodes: new Set(),
      nodeResults: new Map(),
      context: { 
        ...initialInputs,
        // Add common template variables
        timestamp: new Date().toISOString(),
        executionId: executionId,
        workflowId: workflow._id?.toString() || workflow.id,
        workflowName: workflow.name
      }
    };

    // Execute nodes
    const results = await this.executeNodeSequence(
      executionId,
      startNodes,
      nodeMap,
      edgeMap,
      executionState
    );

    return results;
  }

  async executeNodeSequence(executionId, currentNodes, nodeMap, edgeMap, executionState) {
    const activeExecution = this.activeExecutions.get(executionId);
    if (!activeExecution || activeExecution.aborted) {
      throw new Error('Execution aborted');
    }

    const { execution } = activeExecution;
    const results = [];

    for (const node of currentNodes) {
      if (executionState.completedNodes.has(node.id)) {
        continue;
      }

      try {
        // Log step start
        await this.logExecutionStep(executionId, {
          stepId: `step_${node.id}_${Date.now()}`,
          nodeId: node.id,
          nodeType: node.type,
          status: 'running',
          startedAt: new Date(),
          input: executionState.context
        });

        // Execute node
        const nodeResult = await this.executeNode(executionId, node, executionState.context);
        
        // Check if this is a human review node that requires pausing
        if (nodeResult.requiresHumanReview) {
          await this.handleHumanReviewNode(executionId, node, nodeResult, executionState);
          return results; // Stop execution here, workflow is paused
        }
        
        // Update context with node result
        if (nodeResult.output) {
          if (typeof nodeResult.output === 'object') {
            executionState.context = { ...executionState.context, ...nodeResult.output };
          } else {
            // For string outputs, store both with and without _output suffix
            executionState.context[`${node.id}_output`] = nodeResult.output;
            executionState.context[node.id] = nodeResult.output;
          }
        }

        // Mark as completed
        executionState.completedNodes.add(node.id);
        executionState.nodeResults.set(node.id, nodeResult);
        results.push(nodeResult);

        // Log step completion
        await this.logExecutionStep(executionId, {
          stepId: `step_${node.id}_${Date.now()}`,
          nodeId: node.id,
          nodeType: node.type,
          status: 'completed',
          completedAt: new Date(),
          output: nodeResult.output,
          metadata: nodeResult.metadata
        });

        // Update metrics
        await this.updateExecutionMetrics(executionId, {
          executedNodes: executionState.completedNodes.size
        });

        // Emit progress event
        this.emitExecutionEvent(executionId, 'node_completed', {
          nodeId: node.id,
          result: nodeResult,
          progress: (executionState.completedNodes.size / nodeMap.size) * 100
        });

        // Find next nodes
        const nextNodes = this.getNextNodes(node.id, edgeMap, nodeMap, nodeResult);
        
        if (nextNodes.length > 0) {
          // Execute next nodes
          const nextResults = await this.executeNodeSequence(
            executionId,
            nextNodes,
            nodeMap,
            edgeMap,
            executionState
          );
          results.push(...nextResults);
        }

      } catch (error) {
        // Log step failure
        await this.logExecutionStep(executionId, {
          stepId: `step_${node.id}_${Date.now()}`,
          nodeId: node.id,
          nodeType: node.type,
          status: 'failed',
          completedAt: new Date(),
          error: error.message
        });

        // Update metrics
        await this.updateExecutionMetrics(executionId, {
          failedNodes: (execution.metrics.failedNodes || 0) + 1
        });

        // Emit error event
        this.emitExecutionEvent(executionId, 'node_failed', {
          nodeId: node.id,
          error: error.message
        });

        // Check if we should retry or fail
        if (node.config?.retryOnFailure && node.retryCount < (node.config.maxRetries || 3)) {
          node.retryCount = (node.retryCount || 0) + 1;
          
          // Retry after delay
          await this.delay(node.config.retryDelay || 1000);
          return this.executeNodeSequence(executionId, [node], nodeMap, edgeMap, executionState);
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  async executeNode(executionId, node, context) {
    const activeExecution = this.activeExecutions.get(executionId);
    if (!activeExecution) {
      throw new Error('Execution not found');
    }

    try {
      let result;

      // Handle different node types
      if (node.type === 'humanReview') {
        result = await this.executeHumanReviewNode(executionId, node, context);
      } else {
        // Execute node using LangChain service
        result = await this.langChainService.executeNode(node, context);
      }
      
      // Add execution metadata
      result.executionId = executionId;
      result.nodeId = node.id;
      result.timestamp = new Date();
      
      return result;
    } catch (error) {
      this.logger.error(`Error executing node ${node.id}:`, error);
      throw error;
    }
  }

  async executeHumanReviewNode(executionId, node, context) {
    try {
      const { humanReviewConfig } = node.data;
      const { taskConfig, timeout = 86400000 } = humanReviewConfig; // 24 hours default
      
      // Process template variables in task configuration
      const processedTaskConfig = this.processTemplateVariables(taskConfig, context);
      
      // Enhanced task configuration with escalation options
      const enhancedTaskConfig = {
        ...processedTaskConfig,
        data: {
          ...processedTaskConfig.data,
          // Add escalation options to the human reviewer
          availableActions: [
            {
              id: 'respond',
              label: 'Send Response to Customer',
              description: 'Provide a response directly to the customer'
            },
            {
              id: 'escalate', 
              label: 'Escalate to Human Agent',
              description: 'Transfer this call to a live human agent'
            }
          ],
          callDeflectionContext: {
            callId: context.callId,
            transcription: context.transcription,
            callerInfo: context.callerInfo,
            classification: context.intent_classification_output
          }
        }
      };

      // Step 1: Create task in Noam app
      const taskCreationInput = {
        taskTitle: enhancedTaskConfig.taskTitle,
        taskDescription: enhancedTaskConfig.taskDescription,
        taskData: enhancedTaskConfig.data,
        priority: enhancedTaskConfig.priority || 'high',
        assignee: enhancedTaskConfig.assignee,
        workflowExecutionId: executionId
      };

      const taskCreationResult = await this.langChainService.executeToolNode({
        toolName: 'noam_task_creator',
        input: JSON.stringify(taskCreationInput)
      }, context);

      if (!taskCreationResult.success) {
        throw new Error(`Failed to create task: ${taskCreationResult.output}`);
      }

      const taskResponse = JSON.parse(taskCreationResult.output);
      const taskId = taskResponse.taskId;

      // Step 2: Mark execution as waiting for human input
      await this.markExecutionAsWaiting(executionId, {
        nodeId: node.id,
        taskId: taskId,
        waitingFor: 'human_approval',
        createdAt: new Date(),
        timeout: new Date(Date.now() + timeout)
      });

      // Emit waiting event
      this.emitExecutionEvent(executionId, 'waiting_for_human', {
        nodeId: node.id,
        taskId: taskId,
        executionId: executionId,
        taskUrl: `${process.env.NOAM_APP_URL}/tasks/${taskId}` // If you have Noam app URL
      });

      // Step 3: Poll for task completion (non-blocking)
      this.startTaskPolling(executionId, node.id, taskId, timeout);

      // Return pending result - execution will be resumed when task is completed
      return {
        success: true,
        status: 'pending',
        output: {
          taskId: taskId,
          status: 'waiting_for_approval',
          taskData: processedTaskConfig
        },
        metadata: {
          nodeType: 'humanReview',
          taskId: taskId,
          waitingFor: 'human_approval',
          createdAt: new Date()
        }
      };
    } catch (error) {
      this.logger.error(`Error executing human review node ${node.id}:`, error);
      throw error;
    }
  }

  async startTaskPolling(executionId, nodeId, taskId, timeout) {
    try {
      // Run polling in background
      const pollResult = await this.langChainService.executeToolNode({
        toolName: 'task_status_poller',
        input: JSON.stringify({
          taskId: taskId,
          maxWaitTime: timeout,
          pollInterval: 5000 // Poll every 5 seconds
        })
      }, {});

      const pollResponse = JSON.parse(pollResult.output);
      
      if (pollResponse.success && pollResponse.status === 'completed') {
        // Task completed, resume workflow
        await this.resumeExecutionAfterHumanApproval(executionId, nodeId, pollResponse);
      } else {
        // Task timed out or failed
        await this.handleHumanReviewTimeout(executionId, nodeId, taskId);
      }
    } catch (error) {
      this.logger.error(`Error polling task ${taskId}:`, error);
      await this.handleHumanReviewTimeout(executionId, nodeId, taskId);
    }
  }

  async resumeExecutionAfterHumanApproval(executionId, nodeId, approvalResult) {
    try {
      const activeExecution = this.activeExecutions.get(executionId);
      if (!activeExecution) {
        this.logger.warn(`Cannot resume execution ${executionId} - not found in active executions`);
        return;
      }

      // Update execution status
      await this.clearExecutionWaitingStatus(executionId);

      // Update context with approval result - enhanced for call deflection
      const enhancedApprovalResult = {
        ...approvalResult,
        decision: approvalResult.decision,
        feedback: approvalResult.feedback,
        selectedAction: approvalResult.taskData?.selectedAction || approvalResult.decision,
        responseText: approvalResult.taskData?.responseText || approvalResult.feedback,
        escalationReason: approvalResult.taskData?.escalationReason,
        timestamp: new Date().toISOString()
      };

      activeExecution.context[`${nodeId}_approval`] = enhancedApprovalResult;
      activeExecution.context[`${nodeId}_output`] = enhancedApprovalResult.selectedAction || enhancedApprovalResult.decision;
      
      // Add response text to context for potential use in response nodes
      if (enhancedApprovalResult.responseText) {
        activeExecution.context['final_response'] = enhancedApprovalResult.responseText;
      }
      
      // Log the approval
      await this.logExecutionStep(executionId, {
        stepId: `step_${nodeId}_${Date.now()}`,
        nodeId: nodeId,
        nodeType: 'humanReview',
        status: 'completed',
        completedAt: new Date(),
        output: enhancedApprovalResult,
        metadata: {
          decision: enhancedApprovalResult.decision,
          selectedAction: enhancedApprovalResult.selectedAction,
          feedback: enhancedApprovalResult.feedback,
          escalationReason: enhancedApprovalResult.escalationReason
        }
      });

      // Emit approval event
      this.emitExecutionEvent(executionId, 'human_approval_received', {
        nodeId: nodeId,
        decision: approvalResult.decision,
        feedback: approvalResult.feedback,
        executionId: executionId
      });

      // Check if approved or rejected
      if (approvalResult.decision === 'approved') {
        // Continue workflow to next nodes
        const { workflow } = activeExecution;
        const { nodes, edges } = workflow;
        const nodeMap = new Map(nodes.map(node => [node.id, node]));
        const edgeMap = this.buildEdgeMap(edges);
        
        const nextNodes = this.getNextNodes(nodeId, edgeMap, nodeMap, { success: true });
        
        if (nextNodes.length > 0) {
          // Continue execution with next nodes
          const executionState = {
            completedNodes: new Set([nodeId]),
            nodeResults: new Map([[nodeId, { success: true, output: approvalResult }]]),
            context: activeExecution.context
          };
          
          await this.executeNodeSequence(executionId, nextNodes, nodeMap, edgeMap, executionState);
        } else {
          // No more nodes, complete workflow
          this.completeExecution(executionId, 'completed', {
            finalDecision: 'approved',
            approvalDetails: approvalResult
          });
        }
      } else {
        // Workflow rejected, complete with rejection status
        this.completeExecution(executionId, 'rejected', {
          finalDecision: 'rejected',
          rejectionReason: approvalResult.feedback
        });
      }
    } catch (error) {
      this.logger.error(`Error resuming execution after approval:`, error);
      this.completeExecution(executionId, 'failed', null, error);
    }
  }

  async handleHumanReviewTimeout(executionId, nodeId, taskId) {
    try {
      await this.logExecutionStep(executionId, {
        stepId: `step_${nodeId}_${Date.now()}`,
        nodeId: nodeId,
        nodeType: 'humanReview',
        status: 'timeout',
        endTime: new Date(),
        error: 'Human review timeout reached'
      });

      this.emitExecutionEvent(executionId, 'human_review_timeout', {
        nodeId: nodeId,
        taskId: taskId,
        executionId: executionId
      });

      // Complete execution with timeout status
      this.completeExecution(executionId, 'timeout', {
        reason: 'Human review timeout',
        taskId: taskId
      });
    } catch (error) {
      this.logger.error('Error handling human review timeout:', error);
    }
  }

  async markExecutionAsWaiting(executionId, waitingInfo) {
    try {
      await WorkflowExecution.findOneAndUpdate(
        { executionId: executionId },
        { 
          $set: { 
            status: 'waiting',
            waitingInfo: waitingInfo
          }
        }
      );
    } catch (error) {
      this.logger.error('Error marking execution as waiting:', error);
    }
  }

  async clearExecutionWaitingStatus(executionId) {
    try {
      await WorkflowExecution.findOneAndUpdate(
        { executionId: executionId },
        { 
          $set: { status: 'running' },
          $unset: { waitingInfo: 1 }
        }
      );
    } catch (error) {
      this.logger.error('Error clearing execution waiting status:', error);
    }
  }

  processTemplateVariables(template, context) {
    if (typeof template === 'string') {
      return template.replace(/\{\{(.*?)\}\}/g, (match, variable) => {
        const value = this.getContextValue(variable.trim(), context);
        return value !== undefined ? value : match;
      });
    } else if (typeof template === 'object' && template !== null) {
      const result = {};
      for (const [key, value] of Object.entries(template)) {
        result[key] = this.processTemplateVariables(value, context);
      }
      return result;
    }
    return template;
  }

  getContextValue(path, context) {
    const parts = path.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  getNextNodes(currentNodeId, edgeMap, nodeMap, nodeResult) {
    const edges = edgeMap.get(currentNodeId) || [];
    const nextNodes = [];

    for (const edge of edges) {
      // Check edge conditions
      if (this.shouldFollowEdge(edge, nodeResult)) {
        const nextNode = nodeMap.get(edge.target);
        if (nextNode) {
          nextNodes.push(nextNode);
        }
      }
    }

    return nextNodes;
  }

  shouldFollowEdge(edge, nodeResult) {
    // If no condition, always follow
    if (!edge.condition) {
      return true;
    }

    // Evaluate edge condition
    try {
      const { type, value } = edge.condition;
      
      switch (type) {
        case 'success':
          return nodeResult.success === true;
        case 'failure':
          return nodeResult.success === false;
        case 'output_equals':
          return nodeResult.output === value;
        case 'output_contains':
          return typeof nodeResult.output === 'string' && nodeResult.output.includes(value);
        case 'path':
          // For conditional nodes that specify next path
          return nodeResult.nextPath === edge.id;
        default:
          return true;
      }
    } catch (error) {
      this.logger.error('Error evaluating edge condition:', error);
      return false;
    }
  }

  buildEdgeMap(edges) {
    const edgeMap = new Map();
    
    for (const edge of edges) {
      if (!edgeMap.has(edge.source)) {
        edgeMap.set(edge.source, []);
      }
      edgeMap.get(edge.source).push(edge);
    }
    
    return edgeMap;
  }

  async logExecutionStep(executionId, stepData) {
    try {
      const execution = await WorkflowExecution.findOne({ executionId: executionId });
      if (execution) {
        // Initialize arrays if they don't exist
        if (!execution.steps) {
          execution.steps = [];
        }
        if (!execution.logs) {
          execution.logs = [];
        }
        
        execution.steps.push(stepData);
        execution.logs.push({
          timestamp: new Date(),
          level: stepData.status === 'failed' ? 'error' : 'info',
          message: `Node ${stepData.nodeId} ${stepData.status}`,
          data: stepData
        });
        await execution.save();
      }
    } catch (error) {
      this.logger.error('Error logging execution step:', error);
    }
  }

  async updateExecutionMetrics(executionId, updates) {
    try {
      await WorkflowExecution.findOneAndUpdate(
        { executionId: executionId },
        { $set: { [`metrics.${Object.keys(updates)[0]}`]: Object.values(updates)[0] } }
      );
    } catch (error) {
      this.logger.error('Error updating execution metrics:', error);
    }
  }

  async completeExecution(executionId, status, result = null, error = null) {
    try {
      const activeExecution = this.activeExecutions.get(executionId);
      if (!activeExecution) {
        return;
      }

      const { execution } = activeExecution;
      
      // Update execution record
      execution.status = status;
      execution.metrics.endTime = new Date();
      execution.metrics.duration = execution.metrics.endTime - execution.metrics.startTime;
      
      if (result) {
        execution.outputs = result;
      }
      
      if (error) {
        execution.error = {
          message: error.message,
          stack: error.stack,
          timestamp: new Date()
        };
      }

      await execution.save();

      // Remove from active executions
      this.activeExecutions.delete(executionId);

      // Emit completion event
      this.emitExecutionEvent(executionId, 'execution_completed', {
        executionId,
        status,
        result,
        error: error?.message,
        duration: execution.metrics.duration
      });

      this.logger.info(`Execution ${executionId} completed with status: ${status}`);
    } catch (err) {
      this.logger.error('Error completing execution:', err);
    }
  }

  async abortExecution(executionId, reason = 'User requested') {
    try {
      const activeExecution = this.activeExecutions.get(executionId);
      if (activeExecution) {
        activeExecution.aborted = true;
        
        await WorkflowExecution.findOneAndUpdate(
          { executionId: executionId },
          {
            status: 'aborted',
            'metrics.endTime': new Date(),
            error: {
              message: reason,
              timestamp: new Date()
            }
          }
        );

        this.activeExecutions.delete(executionId);

        this.emitExecutionEvent(executionId, 'execution_aborted', {
          executionId,
          reason
        });

        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Error aborting execution:', error);
      throw error;
    }
  }

  async getExecutionStatus(executionId) {
    try {
      const execution = await WorkflowExecution.findOne({ executionId: executionId });
      return execution;
    } catch (error) {
      this.logger.error('Error getting execution status:', error);
      throw error;
    }
  }

  async listExecutions(userId, filters = {}) {
    try {
      const query = { userId };
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.workflowId) {
        query.workflowId = filters.workflowId;
      }

      const executions = await WorkflowExecution.find(query)
        .sort({ 'metrics.startTime': -1 })
        .limit(filters.limit || 50);

      return executions;
    } catch (error) {
      this.logger.error('Error listing executions:', error);
      throw error;
    }
  }

  /**
   * Handle human review node - pause workflow and create external task if configured
   */
  async handleHumanReviewNode(executionId, node, nodeResult, executionState) {
    const activeExecution = this.activeExecutions.get(executionId);
    if (!activeExecution) {
      throw new Error('Execution not found');
    }

    try {
      // Update execution status to paused
      await WorkflowExecution.findOneAndUpdate(
        { executionId },
        {
          status: 'waiting_human_review',
          'pauseState.isPaused': true,
          'pauseState.pausedAt': new Date(),
          'pauseState.pausedBy': 'system',
          'pauseState.pauseReason': 'human_review_required',
          'pauseState.currentNodeId': node.id
        }
      );

      // Log the human review step as waiting
      await this.logExecutionStep(executionId, {
        stepId: `step_${node.id}_${Date.now()}`,
        nodeId: node.id,
        nodeType: node.type,
        status: 'waiting_human_review',
        startedAt: new Date(),
        input: executionState.context,
        humanReview: {
          required: true,
          reviewType: nodeResult.output.reviewType,
          instructions: nodeResult.output.instructions,
          reviewData: nodeResult.output.reviewData,
          externalTask: nodeResult.output.externalTask || {}
        }
      });

      // If external task is configured, create the task
      if (nodeResult.output.externalTask?.enabled) {
        await this.createExternalTask(executionId, node.id, nodeResult.output);
      }

      // Emit pause event
      this.emitExecutionEvent(executionId, 'workflow:paused', {
        executionId,
        nodeId: node.id,
        reason: 'human_review_required',
        reviewData: nodeResult.output
      });

      this.logger.info('Workflow paused for human review:', {
        executionId,
        nodeId: node.id,
        hasExternalTask: !!nodeResult.output.externalTask?.enabled
      });

    } catch (error) {
      this.logger.error('Error handling human review node:', error);
      throw error;
    }
  }

  /**
   * Create external task via API (e.g., NOAM tasks)
   */
  async createExternalTask(executionId, nodeId, reviewOutput) {
    const { externalTask } = reviewOutput;
    
    try {
      const axios = require('axios');
      
      // Prepare the request body with workflow context
      const taskPayload = {
        ...externalTask.apiConfig.body,
        workflow: {
          executionId,
          nodeId,
          instructions: reviewOutput.instructions,
          reviewData: reviewOutput.reviewData,
          callbackUrl: `${process.env.APP_URL || 'http://localhost:8000'}/api/webhooks/human-review/${executionId}/${nodeId}`
        }
      };

      // Process headers to replace environment variables
      const processedHeaders = {};
      if (externalTask.apiConfig.headers) {
        for (const [key, value] of Object.entries(externalTask.apiConfig.headers)) {
          if (typeof value === 'string') {
            // Replace {{ENV_VAR}} patterns with actual environment variables
            processedHeaders[key] = value.replace(/{{([^}]+)}}/g, (match, envVar) => {
              return process.env[envVar.trim()] || match;
            });
          } else {
            processedHeaders[key] = value;
          }
        }
      }

      // Make the API call to create the external task
      const response = await axios({
        method: externalTask.apiConfig.method,
        url: externalTask.apiConfig.endpoint,
        headers: {
          'Content-Type': 'application/json',
          ...processedHeaders
        },
        data: taskPayload,
        timeout: 30000
      });

      // Update the execution with the external task details
      await WorkflowExecution.findOneAndUpdate(
        { 
          executionId,
          'steps.nodeId': nodeId 
        },
        {
          $set: {
            'steps.$.humanReview.externalTask.taskId': response.data.taskId || response.data.id,
            'steps.$.humanReview.externalTask.taskStatus': 'pending',
            'steps.$.humanReview.externalTask.taskResponse': response.data,
            'steps.$.humanReview.externalTask.createdAt': new Date()
          }
        }
      );

      this.logger.info('External task created successfully:', {
        executionId,
        nodeId,
        taskId: response.data.taskId || response.data.id,
        endpoint: externalTask.apiConfig.endpoint
      });

      return response.data;

    } catch (error) {
      this.logger.error('Error creating external task:', error);
      
      // Update execution with error
      await WorkflowExecution.findOneAndUpdate(
        { 
          executionId,
          'steps.nodeId': nodeId 
        },
        {
          $set: {
            'steps.$.humanReview.externalTask.taskStatus': 'failed',
            'steps.$.humanReview.externalTask.error': error.message
          }
        }
      );

      throw error;
    }
  }

  /**
   * Resume workflow after human review decision
   */
  async resumeWorkflowAfterReview(executionId, nodeId, decision, reviewData = {}) {
    try {
      const activeExecution = this.activeExecutions.get(executionId);
      if (!activeExecution) {
        // Execution might have been cleaned up, reload it
        const execution = await WorkflowExecution.findOne({ executionId });
        if (!execution) {
          throw new Error('Execution not found');
        }
        // TODO: Reload execution state and continue
      }

      // Update the human review step
      await WorkflowExecution.findOneAndUpdate(
        { 
          executionId,
          'steps.nodeId': nodeId 
        },
        {
          $set: {
            'steps.$.status': decision === 'approve' ? 'completed' : 'failed',
            'steps.$.humanReview.approved': decision === 'approve',
            'steps.$.humanReview.reviewedAt': new Date(),
            'steps.$.humanReview.reviewNotes': reviewData.notes || '',
            'steps.$.humanReview.externalTask.completedAt': new Date(),
            'steps.$.completedAt': new Date()
          }
        }
      );

      if (decision === 'approve') {
        // Continue workflow execution
        await this.continueWorkflowExecution(executionId, nodeId);
      } else {
        // Stop workflow execution
        await this.stopWorkflowExecution(executionId, 'rejected_by_human_review');
      }

    } catch (error) {
      this.logger.error('Error resuming workflow after review:', error);
      throw error;
    }
  }

  /**
   * Continue workflow execution from a specific node
   */
  async continueWorkflowExecution(executionId, fromNodeId) {
    // TODO: Implement workflow continuation logic
    // This would involve finding the next nodes and continuing execution
    this.logger.info('Continuing workflow execution:', { executionId, fromNodeId });
  }

  /**
   * Stop workflow execution
   */
  async stopWorkflowExecution(executionId, reason) {
    await WorkflowExecution.findOneAndUpdate(
      { executionId },
      {
        status: 'failed',
        'error.message': `Workflow stopped: ${reason}`,
        'pauseState.isPaused': false,
        endTime: new Date()
      }
    );

    this.emitExecutionEvent(executionId, 'workflow:stopped', {
      executionId,
      reason
    });

    this.logger.info('Workflow execution stopped:', { executionId, reason });
  }

  emitExecutionEvent(executionId, event, data) {
    if (this.io) {
      this.io.to(`execution:${executionId}`).emit(event, data);
    }
  }

  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup method for graceful shutdown
  async cleanup() {
    for (const [executionId] of this.activeExecutions) {
      await this.abortExecution(executionId, 'Server shutdown');
    }
  }
}

module.exports = WorkflowExecutionService;