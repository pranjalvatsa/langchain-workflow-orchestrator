const express = require('express');
const router = express.Router();
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const LangGraphWorkflowService = require('../services/LangGraphWorkflowService');
const LangChainService = require('../services/LangChainService');
const Task = require('../models/Task');
const { WorkflowExecution, Workflow } = require('../models');

// Feature flag: Use LangGraph for workflow execution
const USE_LANGGRAPH = process.env.USE_LANGGRAPH === 'true';

/**
 * GET /api/human-review/tasks
 * List all pending human review tasks
 */
router.get('/tasks', async (req, res) => {
  try {
    const tasks = await Task.find({ status: 'pending' });
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/human-review/complete
 * Complete a human review task and resume workflow using LangGraph HITL
 * Body: { taskId, actionId, feedback }
 */
router.post('/complete', async (req, res) => {
  const { taskId, actionId, feedback } = req.body;
  if (!taskId || !actionId) {
    return res.status(400).json({ success: false, error: 'Missing taskId or actionId' });
  }
  
  try {
    const task = await Task.findById(taskId);
    if (!task || task.status !== 'pending') {
      return res.status(404).json({ success: false, error: 'Task not found or already completed' });
    }
    
    // Find the action
    const action = task.actions.find(a => a.id === actionId);
    if (!action) {
      return res.status(400).json({ success: false, error: 'Invalid actionId' });
    }
    
    // Update task status
    task.status = actionId === 'approve' ? 'completed' : 'rejected';
    task.feedback = feedback;
    task.completedAt = new Date();
    await task.save();
    
    console.log(`[HumanReview] Task ${taskId} ${task.status}, action: ${actionId}`);
    
    // Load execution
    const execution = await WorkflowExecution.findOne({ executionId: task.executionId });
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }
    
    // Debug: log task metadata
    console.log('[HITL Debug] task.metadata:', JSON.stringify(task.metadata, null, 2));
    console.log('[HITL Debug] task.metadata?.interruptType:', task.metadata?.interruptType);
    
    // Check if this is a LangGraph HITL task
    const isLangGraphHITL = task.metadata?.interruptType === 'langgraph_hitl';
    
    if (isLangGraphHITL) {
      console.log('[HITL] Resuming workflow after approval');
      
      if (USE_LANGGRAPH) {
        // LangGraph native HITL resume
        console.log('[HITL] Using LangGraph native resume');
        
        const langGraphService = new LangGraphWorkflowService(null);
        
        // Resume workflow with approval data
        // resumeWorkflow will rebuild from database if not in memory
        const result = await langGraphService.resumeWorkflow(task.executionId, {
          actionId,
          feedback
        });
        
        console.log('[HITL] LangGraph resume completed:', result);
        
        // Update task
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = { decision: actionId, feedback, output: result };
        await task.save();
        
        return res.json({
          success: true,
          message: 'Human review completed, workflow resumed',
          data: { task, result }
        });
        
      } else {
        // Legacy HITL resume for backward compatibility
        console.log('[HITL] Using legacy LangGraph agent resume');
        
        // Get the node from workflow to re-execute with resume flag
        const workflow = await Workflow.findById(task.workflowId);
        const node = workflow.nodes.find(n => n.id === task.nodeId);
        
        if (!node) {
          return res.status(404).json({ success: false, error: 'Node not found in workflow' });
        }
        
        // Re-execute the HITL node with _isResumeFromHITL flag
        const langChainService = new LangChainService();
        
        try {
          // Prepare context with resume flag and human approval
          const resumeContext = {
            ...task.data,
            _isResumeFromHITL: true,
            threadId: task.metadata.threadId,
            humanApproval: {
              decision: actionId,
              feedback,
              approvedAt: new Date(),
            }
          };
          
          console.log('[HITL] Executing agent with resume context, threadId:', task.metadata.threadId);
          
          // Execute the agent node with resume flag - it will continue from the checkpoint
          const result = await langChainService.executeAgentWithHITLNode(node, resumeContext);
          
          console.log('[HITL] Agent execution completed:', result);
        
        // Update WorkflowStepLog from waiting_human_review to completed
        const WorkflowStepLog = require('../models/WorkflowStepLog');
        await WorkflowStepLog.findOneAndUpdate(
          { executionId: task.executionId, nodeId: task.nodeId, status: 'waiting_human_review' },
          {
            $set: {
              status: 'completed',
              outputData: result,
              durationMs: Date.now() - new Date(execution.pauseState.pausedAt).getTime(),
            }
          }
        );
        
        // Update task status
        task.status = 'completed';
        task.completedAt = new Date();
        task.result = { decision: actionId, feedback, output: result };
        await task.save();
        
        // Continue workflow to next nodes
        console.log('[HITL] Continuing workflow to next nodes after approval');
        
        // Enhance result with approval decision for edge matching
        const resultWithDecision = {
          ...result,
          success: actionId === 'approve',
          selectedAction: actionId,
          decision: actionId,
          output: actionId, // Edge condition matches against this
          agentOutput: result.output, // Preserve original agent output
        };
        
        console.log('[HITL] Enhanced result for edge matching:', resultWithDecision);
        
        // Get next nodes based on approval decision
        const nodeMap = new Map(workflow.nodes.map(n => [n.id, n]));
        const edgeMap = new Map();
        for (const edge of workflow.edges) {
          if (!edgeMap.has(edge.source)) edgeMap.set(edge.source, []);
          edgeMap.get(edge.source).push(edge);
        }
        
        // Create a WorkflowExecutionService instance to continue execution
        const WorkflowExecutionService = require('../services/WorkflowExecutionService');
        const service = new WorkflowExecutionService();
        
        // Get the workflow execution service singleton or create active execution entry
        service.activeExecutions.set(task.executionId, {
          execution,
          workflow,
          context: resumeContext,
          aborted: false,
        });
        
        // Build execution state with completed HITL node
        const completedNodes = new Set();
        if (Array.isArray(execution.steps)) {
          for (const step of execution.steps) {
            if (step.status === 'completed' && step.nodeId) {
              completedNodes.add(step.nodeId);
            }
          }
        }
        completedNodes.add(task.nodeId); // Mark HITL node as completed
        
        const executionState = {
          completedNodes,
          nodeResults: new Map([[task.nodeId, resultWithDecision]]),
          context: {
            ...resumeContext,
            _isResumeFromHITL: undefined, // Clear the resume flag for subsequent nodes
            [`${task.nodeId}_output`]: actionId, // Store the decision
            [task.nodeId]: actionId,
            [`${task.nodeId}_agentOutput`]: result.output, // Store agent's actual output
          },
        };
        
        // Find next nodes after the HITL node using enhanced result
        const nextNodes = service.getNextNodes(task.nodeId, edgeMap, nodeMap, resultWithDecision);
        
        console.log('[HITL] Next nodes to execute:', nextNodes.map(n => n.id));
        
        if (nextNodes.length > 0) {
          // Update execution status to running
          execution.status = 'running';
          execution.pauseState.isPaused = false;
          await execution.save();
          
          // Continue execution from next nodes (async, don't await)
          service.executeNodeSequence(task.executionId, nextNodes, nodeMap, edgeMap, executionState)
            .then(() => {
              console.log('[HITL] Workflow continuation completed');
            })
            .catch(error => {
              console.error('[HITL] Error continuing workflow:', error);
            });
        } else {
          console.log('[HITL] No next nodes found, marking execution as completed');
          execution.status = 'completed';
          execution.outputs = result;
          await execution.save();
        }
        
        res.json({ 
          success: true, 
          message: 'HITL workflow resumed and continuing',
          output: result.output || result,
          nextNodes: nextNodes.map(n => n.id),
        });
        } catch (error) {
          console.error('[HITL] Error resuming agent:', error);
          res.status(500).json({
            success: false,
            error: `Failed to resume agent: ${error.message}`
          });
        }
      }
      
    } else {
      // Non-HITL tasks are not supported in this implementation
      console.error('[HumanReview] Task is not a LangGraph HITL task');
      return res.status(400).json({
        success: false,
        error: 'This task does not support direct completion. Only agent_with_hitl nodes are supported.'
      });
    }
    
  } catch (err) {
    console.error('[HumanReview] Error completing task:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
