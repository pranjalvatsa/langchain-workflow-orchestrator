const express = require('express');
const router = express.Router();
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const Task = require('../models/Task');

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
 * Complete a human review task and resume workflow
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
    task.status = actionId === 'proceed' ? 'completed' : 'rejected';
    task.feedback = feedback;
    task.completedAt = new Date();
    await task.save();
    // Update workflow step status for this node to 'completed'
    const WorkflowExecution = require('../models').WorkflowExecution;
    await WorkflowExecution.findOneAndUpdate(
      { executionId: task.executionId, "steps.nodeId": task.nodeId },
      {
        $set: {
          "steps.$.status": "completed",
          "steps.$.completedAt": new Date(),
          "steps.$.humanReview": {
            approved: actionId === 'proceed',
            feedback: feedback,
            reviewedAt: new Date()
          }
        }
      }
    );
    // Also update WorkflowStepLog for this node/execution
    const WorkflowStepLog = require('../models').WorkflowStepLog;
    await WorkflowStepLog.findOneAndUpdate(
      { executionId: task.executionId, nodeId: task.nodeId, status: { $ne: 'completed' } },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          'humanReview.approved': actionId === 'proceed',
          'humanReview.feedback': feedback,
          'humanReview.reviewedAt': new Date()
        }
      }
    );
    console.log(`[HumanReview] Marked node ${task.nodeId} as completed in execution ${task.executionId} (step log updated)`);
    // Prepare resume data
    const resumeData = {
      action: actionId,
      feedback,
      context: task.data,
      loopBackNodeId: action.loopBackNodeId || null,
    };
    // Enqueue workflow resume job
    await WorkflowExecutionService.enqueueResumeJob(task.executionId, resumeData);
    res.json({ success: true, message: 'Workflow resume job enqueued.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;