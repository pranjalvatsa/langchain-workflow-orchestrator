/**
 * LangGraph-based Workflow Execution Service
 * 
 * This service replaces the custom workflow engine with LangGraph's StateGraph.
 * Benefits:
 * - Native state management across nodes
 * - Built-in conditional routing with addConditionalEdges
 * - Persistent checkpointing for HITL
 * - Streaming execution for real-time updates
 * - Time travel debugging
 * - Parallel node execution
 */

const { StateGraph, END, START, Annotation } = require("@langchain/langgraph");
const { MemorySaver } = require("@langchain/langgraph");
const { WorkflowExecution, WorkflowStepLog, Task } = require("../models");
const workflowLogger = require("../utils/workflowLogger");

class LangGraphWorkflowService {
  constructor(io) {
    this.io = io;
    this.checkpointer = new MemorySaver(); // Persistent state for HITL
    this.activeExecutions = new Map(); // Track running workflows
  }

  /**
   * Main entry point: Execute workflow using LangGraph's StateGraph
   */
  async executeWorkflow(workflow, userId, inputs = {}, options = {}) {
    const executionId = this.generateExecutionId();
    
    workflowLogger.log("Starting LangGraph workflow execution", {
      workflowId: workflow._id,
      executionId,
      userId,
      inputs
    });

    try {
      // Create execution record
      const execution = new WorkflowExecution({
        executionId,
        workflowId: workflow._id,
        workflowVersion: workflow.version || "1.0.0",
        triggeredBy: {
          type: "api",
          userId: userId !== "anonymous" ? userId : null,
          source: "langgraph-workflow-engine",
          metadata: options.metadata || {}
        },
        status: "running",
        startTime: new Date(),
        inputs,
        context: inputs,
        steps: [],
        outputs: {}
      });

      await execution.save();

      // Build and compile LangGraph
      const graph = await this.buildStateGraph(workflow, executionId);
      // Compile without checkpointer - we handle state manually
      const app = graph.compile();

      // Store in active executions
      this.activeExecutions.set(executionId, {
        execution,
        workflow,
        app,
        threadId: `thread_${executionId}`
      });

      // Execute workflow (non-blocking)
      this.runWorkflow(app, executionId, inputs)
        .then(result => {
          // Check if workflow is paused for HITL
          if (result?.status === 'waiting_human_review') {
            workflowLogger.log("Workflow paused for human review", {
              executionId,
              pausedNodeId: result.pausedNodeId
            });
            // Don't call completeExecution - execution is still in progress
            return;
          }
          // Workflow completed normally
          this.completeExecution(executionId, "completed", result);
        })
        .catch(error => {
          workflowLogger.error("Workflow execution failed", {
            executionId,
            error: error.message
          });
          this.completeExecution(executionId, "failed", null, error);
        });

      return execution;

    } catch (error) {
      workflowLogger.error("Failed to start workflow", { executionId, error: error.message });
      throw error;
    }
  }

  /**
   * Build LangGraph StateGraph from workflow definition
   */
  async buildStateGraph(workflow, executionId) {
    // Define state schema using Annotation
    const StateAnnotation = Annotation.Root({
      // Input/output data
      context: Annotation(),
      inputs: Annotation(),
      outputs: Annotation(),
      
      // Execution metadata
      executionId: Annotation(),
      workflowId: Annotation(),
      currentNode: Annotation(),
      previousNode: Annotation(),
      
      // Node results
      nodeResults: Annotation(),
      completedNodes: Annotation(),
      
      // Error handling
      error: Annotation(),
      
      // HITL state
      waitingForApproval: Annotation(),
      pausedNodeId: Annotation(),
      approvalDecision: Annotation()
    });

    const graph = new StateGraph(StateAnnotation);

    // Add all nodes from workflow definition
    for (const node of workflow.nodes) {
      if (node.type === 'start') {
        // Start node just passes through
        graph.addNode(node.id, async (state) => {
          workflowLogger.log("Executing start node", { executionId, nodeId: node.id });
          return {
            ...state,
            currentNode: node.id,
            previousNode: null,
            completedNodes: [...(state.completedNodes || []), node.id]
          };
        });
      } else if (node.type === 'end') {
        // End node collects final output
        graph.addNode(node.id, async (state) => {
          workflowLogger.log("Executing end node", { executionId, nodeId: node.id });
          
          // Merge all node results and context for template processing
          const fullContext = {
            ...state.context,
            ...state.inputs,
            ...state.nodeResults,
            // Flatten nested outputs for easier template access
            ...Object.values(state.nodeResults || {}).reduce((acc, result) => {
              if (result && typeof result === 'object' && result.output) {
                if (typeof result.output === 'object') {
                  return { ...acc, ...result.output };
                }
              }
              return acc;
            }, {})
          };
          
          const finalOutput = node.data?.finalOutput 
            ? this.processTemplate(node.data.finalOutput, fullContext)
            : state.outputs;
          
          workflowLogger.log("End node final output", {
            executionId,
            nodeId: node.id,
            finalOutput
          });
          
          return {
            ...state,
            currentNode: node.id,
            previousNode: state.currentNode,
            outputs: finalOutput,
            completedNodes: [...(state.completedNodes || []), node.id]
          };
        });
      } else {
        // Regular nodes - execute via LangChainService
        graph.addNode(node.id, async (state) => {
          return await this.executeNodeInGraph(node, state, executionId);
        });
      }
    }

    // Add edges from workflow definition
    const edgeMap = this.buildEdgeMap(workflow.edges);
    
    for (const node of workflow.nodes) {
      const edges = edgeMap.get(node.id) || [];
      
      if (edges.length === 0) {
        // No outgoing edges - end the graph
        graph.addEdge(node.id, END);
      } else {
        // ALL edges should be conditional to check for waitingForApproval flag
        // This ensures HITL nodes can pause execution
        graph.addConditionalEdges(
          node.id,
          (state) => this.routeFromNode(node.id, edges, state),
          this.buildRoutingMap(edges)
        );
      }
    }

    // Set entry point (first start node)
    const startNode = workflow.nodes.find(n => n.type === 'start');
    if (startNode) {
      graph.setEntryPoint(startNode.id);
    } else {
      // No explicit start node - use first node with no incoming edges
      const nodesWithIncomingEdges = new Set(workflow.edges.map(e => e.target));
      const entryNode = workflow.nodes.find(n => !nodesWithIncomingEdges.has(n.id));
      if (entryNode) {
        graph.setEntryPoint(entryNode.id);
      } else {
        throw new Error("No entry point found - workflow must have a start node or node with no incoming edges");
      }
    }

    return graph;
  }

  /**
   * Execute a single node within the graph
   */
  async executeNodeInGraph(node, state, executionId) {
    const startTime = Date.now();
    
    workflowLogger.log("Executing node in graph", {
      executionId,
      nodeId: node.id,
      nodeType: node.type,
      completedNodes: state.completedNodes || []
    });

    // Skip nodes that have already been completed (for resume scenarios)
    if (state.completedNodes && state.completedNodes.includes(node.id)) {
      workflowLogger.log("Skipping already completed node", {
        executionId,
        nodeId: node.id
      });
      
      // Return existing state without re-execution
      return {
        ...state,
        currentNode: node.id,
        previousNode: state.currentNode
      };
    }

    try {
      // Build context for node execution
      const nodeContext = {
        ...state.context,
        ...state.inputs,
        executionId,
        previousNodeId: state.previousNode,
        previousOutput: state.previousNode ? state.nodeResults[state.previousNode] : null,
        // Make all previous node results available
        ...state.nodeResults
      };
      
      workflowLogger.log("Node context built", {
        executionId,
        nodeId: node.id,
        nodeType: node.type,
        contextKeys: Object.keys(nodeContext),
        inputs: state.inputs,
        stateContext: state.context
      });

      // Execute node based on type
      let result;
      switch (node.type) {
        case 'agent':
          result = await this.executeAgentNode(node, nodeContext);
          break;
        case 'llm':
          result = await this.executeLLMNode(node, nodeContext);
          break;
        case 'tool':
          result = await this.executeToolNode(node, nodeContext);
          break;
        case 'humanReview':
        case 'agent_with_hitl':
          // Use LangGraph's interrupt() for HITL
          result = await this.executeHumanReviewNode(node, nodeContext, executionId);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      // Check if this node requires human review (HITL) BEFORE logging
      if (result.requiresHumanReview) {
        workflowLogger.log("Node requires human review - pausing execution", {
          executionId,
          nodeId: node.id
        });
        
        // Log step with 'waiting_human_review' status for HITL nodes
        await this.logStep(executionId, node, result, startTime, 'waiting_human_review');
        
        // Build the paused state with all current information
        const pausedState = {
          ...state,
          currentNode: node.id,
          previousNode: state.currentNode,
          context: {
            ...state.context,
            ...nodeContext
          },
          nodeResults: {
            ...state.nodeResults,
            [node.id]: result
          },
          outputs: {
            ...state.outputs,
            [node.id]: result.output
          },
          completedNodes: [...(state.completedNodes || []), node.id],
          waitingForApproval: true, // Signal that execution should pause
          pausedNodeId: node.id
        };

        // Persist paused state atomically using findOneAndUpdate to avoid races
        try {
          const update = {
            $set: {
              'pauseState.nodeId': node.id,
              'pauseState.reason': 'human_approval_required',
              'pauseState.reviewData': result.output?.reviewData || null,
              'pauseState.context': pausedState.context || {},
              'pauseState.state': pausedState,
              status: 'waiting_human_review',
              pausedAt: new Date()
            }
          };

          const updated = await WorkflowExecution.findOneAndUpdate(
            { executionId },
            update,
            { new: true }
          );

          workflowLogger.log('Persisted paused state via findOneAndUpdate', {
            executionId,
            nodeId: node.id,
            updated: !!updated,
            pauseStateKeys: updated && updated.pauseState ? Object.keys(updated.pauseState) : []
          });
        } catch (saveError) {
          workflowLogger.error("Error saving state to database (atomic)", {
            executionId,
            nodeId: node.id,
            error: saveError?.message || saveError
          });
        }
        
        workflowLogger.log("Returning paused state from executeNodeInGraph", {
          executionId,
          nodeId: node.id,
          waitingForApproval: pausedState.waitingForApproval,
          pausedNodeId: pausedState.pausedNodeId
        });
        
        return pausedState;
      }

      // Normal execution - log step as completed
      await this.logStep(executionId, node, result, startTime);

      // Update state with results (normal execution)
      return {
        ...state,
        currentNode: node.id,
        previousNode: state.currentNode,
        context: {
          ...state.context,
          ...nodeContext
        },
        nodeResults: {
          ...state.nodeResults,
          [node.id]: result
        },
        outputs: {
          ...state.outputs,
          [node.id]: result.output
        },
        completedNodes: [...(state.completedNodes || []), node.id],
        waitingForApproval: false
      };

    } catch (error) {
      workflowLogger.error("Node execution failed", {
        executionId,
        nodeId: node.id,
        error: error.message
      });

      // Log failed step
      await this.logStep(executionId, node, { error: error.message }, startTime, 'failed');

      return {
        ...state,
        error: error.message,
        nodeResults: {
          ...state.nodeResults,
          [node.id]: { error: error.message }
        }
      };
    }
  }

  /**
   * Route from a node based on edge conditions
   */
  routeFromNode(nodeId, edges, state) {
    workflowLogger.log("Routing from node", {
      executionId: state.executionId,
      nodeId,
      edgeCount: edges.length,
      waitingForApproval: state.waitingForApproval
    });

    // Check if workflow is paused for human review
    if (state.waitingForApproval) {
      workflowLogger.log("Workflow waiting for approval - ending graph execution", {
        executionId: state.executionId,
        pausedNodeId: state.pausedNodeId
      });
      return END;
    }

    const nodeResult = state.nodeResults[nodeId];

    for (const edge of edges) {
      if (this.shouldFollowEdge(edge, nodeResult, state)) {
        workflowLogger.log("Following edge", {
          executionId: state.executionId,
          from: nodeId,
          to: edge.target,
          condition: edge.condition
        });
        return edge.target;
      }
    }

    // No matching edge - end workflow
    workflowLogger.log("No matching edge found - ending workflow", {
      executionId: state.executionId,
      nodeId
    });
    return END;
  }

  /**
   * Build routing map for conditional edges
   */
  buildRoutingMap(edges) {
    const map = {};
    edges.forEach(edge => {
      map[edge.target] = edge.target;
    });
    map[END] = END;
    return map;
  }

  /**
   * Check if an edge should be followed
   */
  shouldFollowEdge(edge, nodeResult, state) {
    // No condition - always follow
    if (!edge.condition) {
      return true;
    }

    const condition = typeof edge.condition === 'string' 
      ? edge.condition 
      : edge.condition.expression || edge.condition.type;

    // Check against output
    if (nodeResult?.output === condition) {
      return true;
    }

    // Check against decision/selectedAction (for HITL nodes)
    if (nodeResult?.decision === condition || nodeResult?.selectedAction === condition) {
      return true;
    }

    // Check approval decision from state
    if (state.approvalDecision === condition) {
      return true;
    }

    // Evaluate complex conditions
    try {
      const conditionStr = condition.toString();
      if (conditionStr.includes('{{') || conditionStr.includes('===') || conditionStr.includes('==')) {
        return this.langChainService.evaluateCondition(condition, {
          ...state.context,
          ...nodeResult,
          output: nodeResult?.output
        });
      }
    } catch (error) {
      workflowLogger.error("Failed to evaluate condition", { condition, error: error.message });
    }

    return false;
  }

  /**
   * Run workflow with streaming support
   */
  async runWorkflow(app, executionId, inputs) {
    const activeExecution = this.activeExecutions.get(executionId);
    const threadId = activeExecution.threadId;

    workflowLogger.log("Starting runWorkflow", {
      executionId,
      inputs,
      inputKeys: Object.keys(inputs || {}),
      threadId
    });

    const config = {
      configurable: { 
        thread_id: threadId 
      }
    };

    const initialState = {
      inputs,
      context: inputs,
      outputs: {},
      nodeResults: {},
      completedNodes: [],
      executionId,
      workflowId: activeExecution.workflow._id.toString(),
      currentNode: null,
      previousNode: null,
      error: null,
      waitingForApproval: false,
      pausedNodeId: null,
      approvalDecision: null
    };
    
    workflowLogger.log("Initial state created", {
      executionId,
      stateInputs: initialState.inputs,
      stateContext: initialState.context
    });

    try {
      // Execute workflow using invoke
      workflowLogger.log("Invoking workflow graph", { executionId });
      
      const finalState = await app.invoke(initialState, config);
      
      workflowLogger.log("Workflow execution completed", {
        executionId,
        completedNodes: finalState.completedNodes,
        waitingForApproval: finalState.waitingForApproval,
        outputs: finalState.outputs
      });
      
      // Check if workflow is waiting for human approval
      if (finalState.waitingForApproval) {
        workflowLogger.log("Workflow paused for human review", {
          executionId,
          pausedNodeId: finalState.pausedNodeId
        });
        
        return {
          status: 'waiting_human_review',
          pausedNodeId: finalState.pausedNodeId,
          state: finalState
        };
      }
      
      return finalState;

    } catch (error) {
      workflowLogger.error("Workflow execution error", {
        executionId,
        error: error.message,
        stack: error.stack
      });
      
      throw error;
    }
  }

  /**
   * Resume workflow after human approval - manual state management
   */
  async resumeWorkflow(executionId, approvalData) {
    const execution = await WorkflowExecution.findOne({ executionId });
    
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }
    
    if (execution.status !== 'waiting_human_review') {
      throw new Error(`Execution is not waiting for approval. Current status: ${execution.status}`);
    }

    workflowLogger.log("Resuming workflow from database state", {
      executionId,
      approvalData,
      pausedAtNode: execution.pauseState?.nodeId,
      hasPauseState: !!execution.pauseState,
      pauseStateKeys: execution.pauseState ? Object.keys(execution.pauseState) : []
    });

    // Load saved state from database
    const savedState = execution.pauseState;
    if (!savedState) {
      throw new Error('No pauseState found in execution');
    }
    if (!savedState.state) {
      workflowLogger.error("PauseState exists but no state property", {
        executionId,
        pauseStateKeys: Object.keys(savedState)
      });
      throw new Error('No saved state found for resume - pauseState.state is missing');
    }

    const pausedNodeId = savedState.nodeId;
    const workflow = await require('../models').Workflow.findById(execution.workflowId);
    
    // Update execution status to running
    execution.status = 'running';
    execution.pausedAt = null;
    await execution.save();

    try {
      // Get or rebuild the graph
      let activeExecution = this.activeExecutions.get(executionId);
      
      if (!activeExecution) {
        const graph = await this.buildStateGraph(workflow, executionId);
        const app = graph.compile();
        
        activeExecution = {
          execution,
          workflow,
          app,
          threadId: `thread_${executionId}`
        };
        
        this.activeExecutions.set(executionId, activeExecution);
      }

      const { app } = activeExecution;
      
      // Build resume state with approval decision
      const resumeState = {
        ...savedState.state,
        inputs: savedState.state.inputs || savedState.context,
        context: {
          ...savedState.context,
          approvalDecision: approvalData,
          previousApproval: {
            nodeId: pausedNodeId,
            decision: approvalData.actionId || approvalData.decision || 'approved',
            feedback: approvalData.feedback,
            approvedAt: new Date().toISOString()
          }
        },
        approvalDecision: approvalData,
        waitingForApproval: false, // Clear the pause flag
        pausedNodeId: null
      };

      // Update the paused node's result with approval decision
      if (resumeState.nodeResults && resumeState.nodeResults[pausedNodeId]) {
        resumeState.nodeResults[pausedNodeId] = {
          ...resumeState.nodeResults[pausedNodeId],
          decision: approvalData.actionId || approvalData.decision || 'approved',
          approvalData: approvalData,
          approved: true
        };
      }

      workflowLogger.log("Continuing workflow execution", {
        executionId,
        resumeStateKeys: Object.keys(resumeState),
        completedNodes: resumeState.completedNodes
      });

      // Continue execution from current state
      const finalState = await app.invoke(resumeState, {
        configurable: { thread_id: `thread_${executionId}` }
      });
      
      workflowLogger.log("Resume execution completed", {
        executionId,
        waitingForApproval: finalState.waitingForApproval,
        completedNodes: finalState.completedNodes,
        outputs: finalState.outputs
      });
      
      // Check if we hit another HITL node
      if (finalState.waitingForApproval) {
        workflowLogger.log("Workflow paused at another HITL node", {
          executionId,
          pausedNodeId: finalState.pausedNodeId
        });
        
        return {
          status: 'waiting_human_review',
          pausedNodeId: finalState.pausedNodeId,
          state: finalState
        };
      }
      
      // Workflow completed
      workflowLogger.log("Workflow execution completed after resume", {
        executionId,
        completedNodes: finalState.completedNodes,
        outputs: finalState.outputs
      });
      
      await this.completeExecution(executionId, "completed", finalState);
      return finalState;
      
    } catch (error) {
      workflowLogger.error("Resume workflow error", {
        executionId,
        error: error.message,
        stack: error.stack
      });
      
      await this.completeExecution(executionId, "failed", null, error);
      throw error;
    }
  }

  /**
   * Create human review task
   */
  async createHumanReviewTask(executionId, node, context) {
    // Get workflowId from execution
    const execution = await WorkflowExecution.findOne({ executionId });
    if (!execution) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const task = new Task({
      executionId,
      nodeId: node.id,
      nodeType: node.type,
      workflowId: execution.workflowId,
      status: 'pending',
      title: node.data?.label || node.config?.label || `Review: ${node.id}`,
      description: node.config?.instructions || node.data?.reviewMessage || node.data?.description || 'Human review required',
      data: context,
      metadata: {
        interruptType: 'langgraph_hitl',
        nodeType: node.type
      },
      actions: node.config?.actions || node.data?.actions || [
        { id: 'approve', label: 'Approve' },
        { id: 'reject', label: 'Reject' }
      ],
      createdAt: new Date()
    });

    await task.save();
    
    workflowLogger.log("Human review task created", {
      executionId,
      taskId: task._id,
      nodeId: node.id
    });

    return task;
  }

  /**
   * Log workflow step
   */
  async logStep(executionId, node, result, startTime, status = 'completed') {
    // Get workflowId from active execution
    const activeExecution = this.activeExecutions.get(executionId);
    const workflowId = activeExecution?.workflow?._id;
    
    // Generate unique step ID
    const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const step = new WorkflowStepLog({
      executionId,
      workflowId,
      nodeId: node.id,
      nodeType: node.type,
      status: result.status || status,
      inputData: result.input || {},
      outputData: result.output || result,
      error: result.error,
      timestamp: new Date(startTime),
      durationMs: Date.now() - startTime
    });

    await step.save();

    // Update execution steps array with the required stepId field
    await WorkflowExecution.findOneAndUpdate(
      { executionId },
      { $push: { 
        steps: {
          stepId,
          nodeId: node.id,
          nodeType: node.type,
          status: result.status || status,
          input: result.input || {},
          output: result.output || result,
          error: result.error,
          startTime: new Date(startTime),
          endTime: new Date(),
          duration: Date.now() - startTime
        }
      }}
    );
  }

  /**
   * Complete workflow execution
   */
  async completeExecution(executionId, status, result, error = null) {
    try {
      const execution = await WorkflowExecution.findOne({ executionId });
      
      if (!execution) {
        workflowLogger.error("Execution not found", { executionId });
        return;
      }

      // Don't complete if execution is waiting for human review
      if (execution.status === 'waiting_human_review') {
        workflowLogger.log("Skipping completeExecution - workflow is waiting for human review", {
          executionId,
          requestedStatus: status
        });
        return;
      }

      workflowLogger.log("Completing execution", {
        executionId,
        status,
        hasError: !!error,
        currentStatus: execution.status
      });

      execution.status = status;
      execution.endTime = new Date();
      
      // Calculate duration properly (convert dates to timestamps)
      const startTime = execution.startTime ? new Date(execution.startTime).getTime() : Date.now();
      const endTime = execution.endTime.getTime();
      execution.duration = endTime - startTime;
      
      if (result) {
        execution.outputs = result.outputs || result;
        execution.result = result;
      }
      
      if (error) {
        execution.error = {
          message: error.message || String(error),
          stack: error.stack
        };
      }

      await execution.save();

      // Clean up active execution
      this.activeExecutions.delete(executionId);

      workflowLogger.log("Workflow execution completed", {
        executionId,
        status,
        duration: execution.duration
      });

    } catch (err) {
      workflowLogger.error("Failed to complete execution", {
        executionId,
        error: err.message
      });
    }
  }

  /**
   * Helper methods
   */
  generateExecutionId() {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  buildEdgeMap(edges) {
    const map = new Map();
    edges.forEach(edge => {
      if (!map.has(edge.source)) {
        map.set(edge.source, []);
      }
      map.get(edge.source).push(edge);
    });
    return map;
  }

  processTemplate(template, values) {
    // Handle different types
    if (typeof template === 'string') {
      return template.replace(/\{\{([^}]+)\}\}/g, (match, expression) => {
        const expr = expression.trim();
        
        // Handle OR operator (||)
        if (expr.includes('||')) {
          const parts = expr.split('||').map(p => p.trim());
          
          for (const part of parts) {
            // Check if it's a string literal
            if ((part.startsWith("'") && part.endsWith("'")) || 
                (part.startsWith('"') && part.endsWith('"'))) {
              return part.slice(1, -1); // Return the string literal value
            }
            
            // Try to get the variable value
            const keys = part.split('.');
            let value = values;
            for (const key of keys) {
              value = value?.[key];
            }
            
            // If we found a truthy value, return it
            if (value !== undefined && value !== null && value !== '') {
              // Stringify objects and arrays
              if (typeof value === 'object') {
                return JSON.stringify(value, null, 2);
              }
              return String(value);
            }
          }
          
          // No value found, return empty string
          return '';
        }
        
        // Simple variable replacement (no operators)
        const keys = expr.split('.');
        let value = values;
        for (const key of keys) {
          value = value?.[key];
        }
        // Stringify objects and arrays, otherwise use String()
        if (value !== undefined) {
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value, null, 2);
          }
          return String(value);
        }
        return match;
      });
    } else if (Array.isArray(template)) {
      // Process arrays recursively
      return template.map(item => this.processTemplate(item, values));
    } else if (typeof template === 'object' && template !== null) {
      // Process objects recursively
      const processed = {};
      for (const [key, value] of Object.entries(template)) {
        processed[key] = this.processTemplate(value, values);
      }
      return processed;
    }
    
    // Return primitives as-is
    return template;
  }

  /**
   * Execute agent node with tools
   */
  async executeAgentNode(node, context) {
    try {
      const { createReactAgent } = require("@langchain/langgraph/prebuilt");
      const { HumanMessage } = require("@langchain/core/messages");
      const { ChatOpenAI } = require("@langchain/openai");
      const { SerpAPI } = require("@langchain/community/tools/serpapi");
      
      const config = node.config || {};
      const prompt = this.processTemplate(config.prompt || config.systemPrompt || "", context);
      
      // Load tools
      const tools = [];
      if (config.tools && Array.isArray(config.tools)) {
        for (const toolConfig of config.tools) {
          const toolName = toolConfig.name || toolConfig.toolName;
          if (toolName === 'search' || toolName === 'serp_api') {
            const apiKey = process.env.SERP_API_KEY;
            if (apiKey) {
              tools.push(new SerpAPI(apiKey));
            }
          }
        }
      }
      
      // Get LLM
      const llmConfig = config.llm || {};
      const model = new ChatOpenAI({
        modelName: llmConfig.model || "gpt-4",
        temperature: llmConfig.temperature || 0.7,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      // Create and execute agent
      const agent = createReactAgent({ llm: model, tools });
      const messages = [new HumanMessage(prompt)];
      const result = await agent.invoke({ messages });
      
      const lastMessage = result.messages[result.messages.length - 1];
      let output = lastMessage.content;
      
      // Try to parse as JSON if outputFormat specified
      if (config.outputFormat && typeof output === 'string') {
        try {
          output = JSON.parse(output);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      
      return { success: true, output };
    } catch (error) {
      workflowLogger.error("Agent node execution failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Execute LLM node
   */
  async executeLLMNode(node, context) {
    try {
      const { ChatOpenAI } = require("@langchain/openai");
      const { HumanMessage } = require("@langchain/core/messages");
      
      const config = node.config || {};
      let prompt = this.processTemplate(config.prompt || "", context);
      const systemPrompt = this.processTemplate(config.systemPrompt || "", context);
      
      // Check prompt size and truncate if necessary
      const estimatedTokens = Math.ceil(prompt.length / 4); // Rough estimate: 1 token ≈ 4 chars
      
      // Get LLM config
      const llmConfig = config.llm || {};
      
      // Choose model based on token count
      // Current recommended models:
      // - gpt-4o-mini: 128k context, $0.15/$0.60 per 1M tokens (best value)
      // - gpt-4o: 128k context, $2.50/$10 per 1M tokens (flagship)
      // - gpt-4-turbo: 128k context, $10/$30 per 1M tokens (legacy, expensive)
      let selectedModel = llmConfig.model;
      
      if (!selectedModel) {
        // Auto-select based on estimated complexity
        if (estimatedTokens > 6000) {
          selectedModel = "gpt-4o-mini"; // 128k context, very affordable
        } else {
          selectedModel = "gpt-4o-mini"; // Use gpt-4o-mini by default for cost efficiency
        }
      }
      
      // Determine max tokens based on model
      const modelLimits = {
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "gpt-4-turbo": 128000,
        "gpt-4": 8000,  // Legacy
        "gpt-3.5-turbo": 16000
      };
      
      const modelLimit = modelLimits[selectedModel] || 128000;
      const maxInputTokens = Math.floor(modelLimit * 0.75); // Leave 25% for response + overhead
      
      // Truncate if exceeds model limit
      if (estimatedTokens > maxInputTokens) {
        workflowLogger.log("Prompt too large, truncating", { 
          estimatedTokens, 
          maxInputTokens,
          selectedModel,
          nodeId: node.id 
        });
        
        const maxChars = maxInputTokens * 4;
        prompt = prompt.substring(0, maxChars) + "\n\n[... content truncated due to size ...]";
      }
      
      const model = new ChatOpenAI({
        modelName: selectedModel,
        temperature: llmConfig.temperature || 0.7,
        maxTokens: llmConfig.maxTokens || 4000,
        openAIApiKey: process.env.OPENAI_API_KEY,
      });
      
      workflowLogger.log("Executing LLM", { 
        model: selectedModel,
        estimatedTokens,
        modelLimit,
        nodeId: node.id 
      });
      
      // Build messages
      const messages = [];
      if (systemPrompt) {
        const { SystemMessage } = require("@langchain/core/messages");
        messages.push(new SystemMessage(systemPrompt));
      }
      messages.push(new HumanMessage(prompt));
      
      // Execute
      const response = await model.invoke(messages);
      let output = response.content;
      
      // Try to parse as JSON if outputFormat specified
      if (config.outputFormat && typeof output === 'string') {
        try {
          output = JSON.parse(output);
        } catch (e) {
          // Keep as string if not valid JSON
        }
      }
      
      return { success: true, output };
    } catch (error) {
      workflowLogger.error("LLM node execution failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Execute tool node
   */
  async executeToolNode(node, context) {
    try {
      const config = node.config || {};
      const toolName = config.toolName || config.tool;
      
      if (!toolName) {
        throw new Error("Tool name not specified");
      }
      
      // Get the LangChain service to execute the tool
      const LangChainService = require('./LangChainService');
      const langChainService = new LangChainService();
      
      // Get the tool from LangChain service
      const tool = langChainService.tools.get(toolName);
      
      if (!tool) {
        throw new Error(`Tool ${toolName} not found. Available tools: ${Array.from(langChainService.tools.keys()).join(', ')}`);
      }
      
      // Prepare parameters by processing templates with context
      const parameters = config.parameters || {};
      const processedParams = {};
      
      for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === 'string') {
          const processed = this.processTemplate(value, context);
          // Convert numeric strings to numbers
          if (!isNaN(processed) && processed.trim() !== '') {
            processedParams[key] = Number(processed);
          } else {
            processedParams[key] = processed;
          }
        } else {
          processedParams[key] = value;
        }
      }
      
      workflowLogger.log("Executing tool", { 
        toolName, 
        parameters: processedParams,
        nodeId: node.id 
      });
      
      // Execute the tool
      const toolInput = JSON.stringify(processedParams);
      const toolResult = await tool.call(toolInput);
      
      // Parse result if it's JSON
      let parsedResult;
      try {
        parsedResult = JSON.parse(toolResult);
      } catch (e) {
        parsedResult = { raw: toolResult };
      }
      
      // For firecrawl_scraper, extract compact data to reduce token usage
      if (toolName === 'firecrawl_scraper' && parsedResult.data && Array.isArray(parsedResult.data)) {
        workflowLogger.log("Compacting Firecrawl data", { 
          originalPages: parsedResult.data.length,
          nodeId: node.id 
        });
        
        // Extract only essential fields and truncate content
        parsedResult.data = parsedResult.data.map(page => ({
          url: page.url,
          title: page.title || page.metadata?.title,
          // Take first 2000 chars of markdown content (roughly 500 tokens)
          content: (page.markdown || page.content || '').substring(0, 2000),
          excerpt: page.excerpt || page.description || page.metadata?.description
        }));
        
        workflowLogger.log("Firecrawl data compacted", { 
          pages: parsedResult.data.length,
          estimatedTokens: Math.ceil(JSON.stringify(parsedResult.data).length / 4),
          nodeId: node.id 
        });
      }
      
      workflowLogger.log("Tool execution completed", { 
        toolName, 
        success: parsedResult.success !== false,
        nodeId: node.id 
      });
      
      return { 
        success: parsedResult.success !== false,
        output: parsedResult,
        toolName,
        rawOutput: toolResult
      };
    } catch (error) {
      workflowLogger.error("Tool node execution failed", { 
        error: error.message,
        stack: error.stack,
        nodeId: node.id 
      });
      throw error;
    }
  }

  /**
   * Execute human review node - manual HITL matching LangChainService pattern
   * Returns requiresHumanReview flag to pause workflow execution
   */
  async executeHumanReviewNode(node, context = {}, executionId) {
    workflowLogger.log("Executing human review node - manual HITL", {
      executionId,
      nodeId: node.id
    });

    const { data = {}, config = {} } = node;
    const reviewType = data.reviewType || config.reviewType || "approval";
    const instructions = data.instructions || config.instructions || "Please review this workflow step";
    const label = data.label || data.title || node.label || "Human Review Required";

    // Process review data with context variables (similar to LangChainService)
    const processedInstructions = typeof instructions === 'string' 
      ? this.processTemplate(instructions, context) 
      : instructions;

    // Prepare review data
    const reviewData = {
      nodeId: node.id,
      previousOutput: context.previousOutput,
      ...context
    };

    // Create task only if it doesn't exist
    const existingTask = await Task.findOne({ 
      executionId, 
      nodeId: node.id,
      status: 'pending'
    });
    
    if (!existingTask) {
      await this.createHumanReviewTask(executionId, node, context);
      
      // Update execution status to waiting
      const execution = await WorkflowExecution.findOne({ executionId });
      if (execution) {
        execution.status = "waiting_human_review";
        execution.pausedAt = new Date();
        execution.pauseState = {
          nodeId: node.id,
          reason: 'human_approval_required',
          reviewData: reviewData,
          context: context
        };
        await execution.save();
      }
    }

    workflowLogger.log("Returning requiresHumanReview flag to pause workflow", {
      executionId,
      nodeId: node.id
    });

    // Return structure matching LangChainService exactly
    const result = {
      success: true,
      requiresHumanReview: true, // KEY: This flag tells orchestrator to pause
      output: {
        status: "waiting_human_review",
        reviewType,
        instructions: processedInstructions,
        reviewData: reviewData,
        nodeId: node.id,
        createdAt: new Date().toISOString()
      },
      metadata: {
        nodeType: "human_review",
        nodeId: node.id,
        executedAt: new Date().toISOString(),
        pauseWorkflow: true
      }
    };

    return result;
  }

  /**
   * Validate workflow structure for LangGraph execution
   * This validates according to LangGraph/StateGraph requirements, not the legacy engine
   */
  async validateWorkflow(workflow) {
    const errors = [];
    const warnings = [];
    const { nodes = [], edges = [] } = workflow;

    // Basic structure validation
    if (!Array.isArray(nodes) || nodes.length === 0) {
      errors.push("Workflow must have at least one node");
      return { valid: false, errors, warnings };
    }

    if (!Array.isArray(edges)) {
      errors.push("Workflow must have an edges array");
      return { valid: false, errors, warnings };
    }

    // Build node ID map for quick lookup
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Validate nodes
    for (const node of nodes) {
      // Required fields
      if (!node.id) {
        errors.push("All nodes must have an id");
        continue;
      }
      if (!node.type) {
        errors.push(`Node ${node.id} missing type`);
        continue;
      }

      // Type-specific validation
      switch (node.type) {
        case "llm":
          // LLM nodes require config.prompt
          if (!node.config?.prompt) {
            errors.push(`LLM node ${node.id} missing config.prompt`);
          }
          if (!node.config?.llm) {
            warnings.push(`LLM node ${node.id} missing config.llm (will use default)`);
          }
          break;

        case "agent":
          // Agent nodes require config.tools or config.prompt
          if (!node.config?.tools && !node.config?.prompt) {
            errors.push(`Agent node ${node.id} missing config.tools or config.prompt`);
          }
          break;

        case "tool":
          // Tool nodes require config.toolName
          if (!node.config?.toolName) {
            errors.push(`Tool node ${node.id} missing config.toolName`);
          }
          break;

        case "code":
          // Code nodes require config.code
          if (!node.config?.code) {
            errors.push(`Code node ${node.id} missing config.code`);
          }
          break;

        case "hitl":
        case "human-in-the-loop":
          // HITL nodes require config.instructions
          if (!node.config?.instructions) {
            warnings.push(`HITL node ${node.id} missing config.instructions`);
          }
          break;

        case "start":
        case "end":
          // Start/end nodes are always valid
          break;

        default:
          warnings.push(`Node ${node.id} has unknown type: ${node.type}`);
      }

      // Check for data vs config confusion (common migration issue)
      if (node.data?.prompt || node.data?.tools || node.data?.code) {
        warnings.push(`Node ${node.id} has execution config in 'data' instead of 'config' - this may cause issues`);
      }
    }

    // Validate edges
    for (const edge of edges) {
      if (!edge.source) {
        errors.push("Edge missing source node");
        continue;
      }
      if (!edge.target) {
        errors.push("Edge missing target node");
        continue;
      }

      // Check that source and target nodes exist
      if (!nodeMap.has(edge.source)) {
        errors.push(`Edge references non-existent source node: ${edge.source}`);
      }
      if (!nodeMap.has(edge.target)) {
        errors.push(`Edge references non-existent target node: ${edge.target}`);
      }

      // Validate conditional edges
      if (edge.condition) {
        if (!edge.condition.field) {
          errors.push(`Conditional edge from ${edge.source} missing condition.field`);
        }
        if (!edge.condition.operator) {
          errors.push(`Conditional edge from ${edge.source} missing condition.operator`);
        }
      }
    }

    // Graph structure validation
    const startNodes = nodes.filter(n => n.type === "start");
    const endNodes = nodes.filter(n => n.type === "end");

    if (startNodes.length === 0) {
      warnings.push("Workflow has no start node - will use first node as entry point");
    }
    if (startNodes.length > 1) {
      warnings.push("Workflow has multiple start nodes - only first will be used");
    }
    if (endNodes.length === 0) {
      warnings.push("Workflow has no end node - execution will end at last node");
    }

    // Check for disconnected nodes
    const sourceNodes = new Set(edges.map(e => e.source));
    const targetNodes = new Set(edges.map(e => e.target));
    const connectedNodes = new Set([...sourceNodes, ...targetNodes]);

    for (const node of nodes) {
      if (node.type !== "start" && node.type !== "end" && !connectedNodes.has(node.id)) {
        warnings.push(`Node ${node.id} is not connected to any edges`);
      }
    }

    // Check for cycles (allowed in LangGraph, but worth warning about)
    const hasCycles = this.detectCycles(nodes, edges);
    if (hasCycles) {
      warnings.push("Workflow contains cycles - ensure rejection loops have proper termination conditions");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      metadata: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        startNodes: startNodes.length,
        endNodes: endNodes.length,
        hiLlNodes: nodes.filter(n => n.type === "hitl" || n.type === "human-in-the-loop").length,
        hasCycles
      }
    };
  }

  /**
   * Detect cycles in workflow graph (for validation warnings)
   */
  detectCycles(nodes, edges) {
    const graph = new Map();
    
    // Build adjacency list
    for (const node of nodes) {
      graph.set(node.id, []);
    }
    for (const edge of edges) {
      if (graph.has(edge.source)) {
        graph.get(edge.source).push(edge.target);
      }
    }

    // DFS cycle detection
    const visited = new Set();
    const recStack = new Set();

    const hasCycleDFS = (nodeId) => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          return true; // Cycle detected
        }
      }

      recStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycleDFS(node.id)) return true;
      }
    }

    return false;
  }
}

module.exports = LangGraphWorkflowService;
