const express = require('express');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const { WorkflowService } = require('../services/WorkflowService');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const workflowService = new WorkflowService();
const workflowExecutionService = new WorkflowExecutionService(null); // Pass null for io since it's optional

// Apply authentication middleware to all execution routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/executions:
 *   get:
 *     summary: List workflow executions
 *     tags: [Executions]
 *     parameters:
 *       - in: query
 *         name: workflowId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [running, completed, failed, aborted]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of executions
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const filters = {
    workflowId: req.query.workflowId,
    status: req.query.status,
    limit: parseInt(req.query.limit) || 50
  };

  const executions = await workflowExecutionService.listExecutions(userId, filters);

  res.json({
    success: true,
    data: {
      executions,
      count: executions.length,
      filters
    }
  });
}));

/**
 * @swagger
 * /api/executions:
 *   post:
 *     summary: Start workflow execution
 *     tags: [Executions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *             properties:
 *               workflowId:
 *                 type: string
 *               inputs:
 *                 type: object
 *               options:
 *                 type: object
 *     responses:
 *       201:
 *         description: Execution started successfully
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { workflowId, inputs = {}, options = {} } = req.body;

  if (!workflowId) {
    return res.status(400).json({
      error: 'Missing workflow ID',
      message: 'Workflow ID is required to start execution'
    });
  }

  // Get and validate workflow
  const workflow = await workflowService.getWorkflow(workflowId, userId);
  
  if (workflow.status !== 'published') {
    return res.status(400).json({
      error: 'Workflow not published',
      message: 'Only published workflows can be executed'
    });
  }

  // Start execution
  const execution = await workflowExecutionService.executeWorkflow(
    workflow,
    userId,
    inputs,
    options
  );

  res.status(201).json({
    success: true,
    message: 'Workflow execution started',
    data: { execution }
  });
}));

/**
 * @swagger
 * /api/executions/{id}:
 *   get:
 *     summary: Get execution details
 *     tags: [Executions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Execution details
 *       404:
 *         description: Execution not found
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const executionId = req.params.id;
  const userId = req.user._id.toString();

  const execution = await workflowExecutionService.getExecutionStatus(executionId);

  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found',
      message: 'The requested execution does not exist'
    });
  }

  // Check if user has access to this execution
  // Allow access if triggeredBy.userId is null (for backwards compatibility) or matches current user
  if (execution.triggeredBy?.userId && execution.triggeredBy.userId.toString() !== userId) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'You do not have permission to view this execution'
    });
  }

  res.json({
    success: true,
    data: { execution }
  });
}));

/**
 * @swagger
 * /api/executions/{id}/abort:
 *   post:
 *     summary: Abort workflow execution
 *     tags: [Executions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Execution aborted successfully
 */
router.post('/:id/abort', asyncHandler(async (req, res) => {
  const executionId = req.params.id;
  const userId = req.user._id.toString();
  const { reason = 'User requested abort' } = req.body;
  
  // Get execution to check ownership
  const execution = await workflowExecutionService.getExecutionStatus(executionId);

  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found',
      message: 'The requested execution does not exist'
    });
  }

  // Allow access if triggeredBy.userId is null (for backwards compatibility) or matches current user
  if (execution.triggeredBy?.userId && execution.triggeredBy.userId.toString() !== userId) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'You do not have permission to abort this execution'
    });
  }

  if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'aborted') {
    return res.status(400).json({
      error: 'Cannot abort execution',
      message: `Execution is already ${execution.status}`
    });
  }

  const aborted = await workflowExecutionService.abortExecution(executionId, reason);

  if (aborted) {
    res.json({
      success: true,
      message: 'Execution aborted successfully'
    });
  } else {
    res.status(400).json({
      error: 'Failed to abort execution',
      message: 'The execution could not be aborted'
    });
  }
}));

/**
 * @swagger
 * /api/executions/{id}/logs:
 *   get:
 *     summary: Get execution logs
 *     tags: [Executions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [debug, info, warn, error]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Execution logs
 */
router.get('/:id/logs', asyncHandler(async (req, res) => {
  const executionId = req.params.id;
  const userId = req.user._id.toString();
  const { level, limit = 100 } = req.query;
  const execution = await workflowExecutionService.getExecutionStatus(executionId);

  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found',
      message: 'The requested execution does not exist'
    });
  }

  // Allow access if triggeredBy.userId is null (for backwards compatibility) or matches current user
  if (execution.triggeredBy?.userId && execution.triggeredBy.userId.toString() !== userId) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'You do not have permission to view this execution'
    });
  }

  let logs = execution.logs || [];

  // Filter by level if specified
  if (level) {
    logs = logs.filter(log => log.level === level);
  }

  // Limit results
  logs = logs.slice(-parseInt(limit));

  res.json({
    success: true,
    data: {
      logs,
      count: logs.length,
      total: execution.logs?.length || 0
    }
  });
}));

/**
 * @swagger
 * /api/executions/{id}/steps:
 *   get:
 *     summary: Get execution steps
 *     tags: [Executions]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Execution steps
 */
router.get('/:id/steps', asyncHandler(async (req, res) => {
  const executionId = req.params.id;
  const userId = req.user._id.toString();
  const execution = await workflowExecutionService.getExecutionStatus(executionId);

  if (!execution) {
    return res.status(404).json({
      error: 'Execution not found',
      message: 'The requested execution does not exist'
    });
  }

  // Allow access if triggeredBy.userId is null (for backwards compatibility) or matches current user
  if (execution.triggeredBy?.userId && execution.triggeredBy.userId.toString() !== userId) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'You do not have permission to view this execution'
    });
  }

  const steps = execution.executionSteps || [];

  res.json({
    success: true,
    data: {
      steps,
      count: steps.length,
      progress: {
        completed: steps.filter(s => s.status === 'completed').length,
        failed: steps.filter(s => s.status === 'failed').length,
        running: steps.filter(s => s.status === 'running').length,
        total: steps.length
      }
    }
  });
}));

/**
 * @swagger
 * /api/executions/schedule:
 *   post:
 *     summary: Schedule workflow execution
 *     tags: [Executions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - cronExpression
 *             properties:
 *               workflowId:
 *                 type: string
 *               cronExpression:
 *                 type: string
 *               inputs:
 *                 type: object
 *               options:
 *                 type: object
 *     responses:
 *       201:
 *         description: Execution scheduled successfully
 */
router.post('/schedule', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { workflowId, cronExpression, inputs = {}, options = {} } = req.body;

  if (!workflowId || !cronExpression) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Workflow ID and cron expression are required'
    });
  }

  // Validate workflow access
  const workflow = await workflowService.getWorkflow(workflowId, userId);

  // Validate cron expression
  const schedulerService = req.app.get('schedulerService');
  const cronValidation = schedulerService.validateCronExpression(cronExpression);
  
  if (!cronValidation.valid) {
    return res.status(400).json({
      error: 'Invalid cron expression',
      message: cronValidation.error
    });
  }

  // Schedule the workflow
  const result = schedulerService.scheduleWorkflowExecution(
    workflowId,
    userId,
    cronExpression,
    inputs,
    options
  );

  res.status(201).json({
    success: true,
    message: 'Workflow execution scheduled successfully',
    data: result
  });
}));

module.exports = router;