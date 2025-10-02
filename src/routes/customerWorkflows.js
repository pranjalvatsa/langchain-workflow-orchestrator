const express = require('express');
const { body, param, validationResult } = require('express-validator');
const WorkflowTemplateService = require('../services/WorkflowTemplateService');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const { Workflow, WorkflowExecution } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const winston = require('winston');

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/customer-workflows.log' })
  ]
});

// Initialize services (will be injected via dependency injection in real app)
let workflowTemplateService;
let workflowExecutionService;

const initializeServices = (io) => {
  workflowTemplateService = new WorkflowTemplateService();
  workflowExecutionService = new WorkflowExecutionService(io);
};

/**
 * @swagger
 * /api/customer-workflows/offer-prediction:
 *   post:
 *     summary: Start customer offer prediction workflow
 *     tags: [Customer Workflows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerId
 *             properties:
 *               customerId:
 *                 type: string
 *                 description: Customer ID to generate offers for
 *               assignee:
 *                 type: string
 *                 description: User assigned to approve the task
 *               workflowName:
 *                 type: string
 *                 description: Custom workflow name
 *     responses:
 *       200:
 *         description: Workflow started successfully
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Server error
 */
router.post('/offer-prediction', 
  authMiddleware,
  [
    body('customerId').notEmpty().withMessage('Customer ID is required'),
    body('assignee').optional().isString(),
    body('workflowName').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { customerId, assignee, workflowName } = req.body;
      const userId = req.user.id;

      logger.info(`Starting customer offer workflow for customer: ${customerId}`);

      // Create workflow from template
      const workflow = await workflowTemplateService.createCustomerOfferWorkflow(
        userId,
        workflowName || `Customer Offer Prediction - ${customerId}`
      );

      // Start workflow execution
      const execution = await workflowExecutionService.executeWorkflow(
        workflow,
        userId,
        { customerId, assignee }
      );

      res.json({
        success: true,
        message: 'Customer offer workflow started successfully',
        data: {
          workflowId: workflow._id,
          executionId: execution.id,
          status: execution.status,
          customerId: customerId,
          trackingUrl: `/api/executions/${execution.id}/status`
        }
      });
    } catch (error) {
      logger.error('Error starting customer offer workflow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start workflow',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/customer-workflows/webhooks/noam-task:
 *   post:
 *     summary: Webhook endpoint for Noam task completion
 *     tags: [Customer Workflows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - status
 *               - decision
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: Task ID from Noam app
 *               status:
 *                 type: string
 *                 enum: [completed, cancelled, expired]
 *               decision:
 *                 type: string
 *                 enum: [approved, rejected]
 *               feedback:
 *                 type: string
 *                 description: Optional feedback from the reviewer
 *               workflowExecutionId:
 *                 type: string
 *                 description: Associated workflow execution ID
 *               completedBy:
 *                 type: string
 *                 description: User who completed the task
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook data
 *       404:
 *         description: Execution not found
 *       500:
 *         description: Server error
 */
router.post('/webhooks/noam-task', 
  [
    body('taskId').notEmpty().withMessage('Task ID is required'),
    body('status').isIn(['completed', 'cancelled', 'expired']).withMessage('Invalid status'),
    body('decision').optional().isIn(['approved', 'rejected']),
    body('workflowExecutionId').optional().isString(),
    body('feedback').optional().isString(),
    body('completedBy').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { 
        taskId, 
        status, 
        decision, 
        feedback, 
        workflowExecutionId, 
        completedBy,
        completedAt 
      } = req.body;

      logger.info(`Received Noam task webhook: ${taskId} - ${status}`);

      // Find the execution waiting for this task
      let execution;
      if (workflowExecutionId) {
        execution = await WorkflowExecution.findOne({ id: workflowExecutionId });
      } else {
        // Find by task ID in waiting info
        execution = await WorkflowExecution.findOne({ 
          'waitingInfo.taskId': taskId,
          status: 'waiting'
        });
      }

      if (!execution) {
        return res.status(404).json({
          success: false,
          message: 'Workflow execution not found for this task'
        });
      }

      // Prepare approval result
      const approvalResult = {
        taskId: taskId,
        status: status,
        decision: decision || (status === 'completed' ? 'approved' : 'rejected'),
        feedback: feedback || '',
        completedBy: completedBy,
        completedAt: completedAt || new Date().toISOString(),
        waitTime: Date.now() - new Date(execution.waitingInfo.createdAt).getTime()
      };

      // Resume workflow execution
      const nodeId = execution.waitingInfo.nodeId;
      await workflowExecutionService.resumeExecutionAfterHumanApproval(
        execution.id, 
        nodeId, 
        approvalResult
      );

      res.json({
        success: true,
        message: 'Task completion processed successfully',
        data: {
          executionId: execution.id,
          taskId: taskId,
          decision: decision,
          status: status
        }
      });
    } catch (error) {
      logger.error('Error processing Noam task webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process task completion',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/customer-workflows/executions/{executionId}/status:
 *   get:
 *     summary: Get customer workflow execution status
 *     tags: [Customer Workflows]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow execution ID
 *     responses:
 *       200:
 *         description: Execution status retrieved successfully
 *       404:
 *         description: Execution not found
 *       500:
 *         description: Server error
 */
router.get('/executions/:executionId/status',
  authMiddleware,
  [
    param('executionId').notEmpty().withMessage('Execution ID is required')
  ],
  async (req, res) => {
    try {
      const { executionId } = req.params;
      
      const execution = await WorkflowExecution.findOne({ id: executionId });
      if (!execution) {
        return res.status(404).json({
          success: false,
          message: 'Execution not found'
        });
      }

      // Get workflow details
      const workflow = await Workflow.findById(execution.workflowId);

      // Calculate progress
      const totalSteps = workflow ? workflow.nodes.length : 0;
      const completedSteps = execution.executionSteps.filter(step => step.status === 'completed').length;
      const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

      // Get current step info
      let currentStep = null;
      if (execution.status === 'waiting' && execution.waitingInfo) {
        const currentNode = workflow?.nodes.find(node => node.id === execution.waitingInfo.nodeId);
        currentStep = {
          nodeId: execution.waitingInfo.nodeId,
          nodeName: currentNode?.data.label || 'Unknown',
          waitingFor: execution.waitingInfo.waitingFor,
          taskId: execution.waitingInfo.taskId,
          createdAt: execution.waitingInfo.createdAt,
          timeout: execution.waitingInfo.timeout
        };
      }

      // Get latest steps
      const latestSteps = execution.executionSteps
        .slice(-5)
        .map(step => ({
          nodeId: step.nodeId,
          nodeName: workflow?.nodes.find(node => node.id === step.nodeId)?.data.label || step.nodeId,
          status: step.status,
          startTime: step.startTime,
          endTime: step.endTime,
          error: step.error
        }));

      res.json({
        success: true,
        data: {
          executionId: execution.id,
          workflowId: execution.workflowId,
          workflowName: workflow?.name || 'Unknown',
          status: execution.status,
          progress: Math.round(progress),
          currentStep: currentStep,
          latestSteps: latestSteps,
          inputs: execution.inputs,
          outputs: execution.outputs,
          error: execution.error,
          metrics: {
            startTime: execution.metrics.startTime,
            endTime: execution.metrics.endTime,
            duration: execution.metrics.duration,
            totalNodes: execution.metrics.totalNodes,
            executedNodes: execution.metrics.executedNodes,
            failedNodes: execution.metrics.failedNodes
          },
          logs: execution.logs.slice(-10) // Last 10 log entries
        }
      });
    } catch (error) {
      logger.error('Error getting execution status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get execution status',
        error: error.message
      });
    }
  }
);

/**
 * @swagger
 * /api/customer-workflows/templates:
 *   get:
 *     summary: Get available workflow templates
 *     tags: [Customer Workflows]
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *       500:
 *         description: Server error
 */
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const templates = await workflowTemplateService.getWorkflowTemplates();
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error('Error getting workflow templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/customer-workflows/test/mock-approval:
 *   post:
 *     summary: Mock task approval for testing (simulates Noam webhook)
 *     tags: [Customer Workflows]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - decision
 *             properties:
 *               taskId:
 *                 type: string
 *               decision:
 *                 type: string
 *                 enum: [approved, rejected]
 *               feedback:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mock approval processed
 */
router.post('/test/mock-approval', 
  authMiddleware,
  [
    body('taskId').notEmpty().withMessage('Task ID is required'),
    body('decision').isIn(['approved', 'rejected']).withMessage('Decision must be approved or rejected'),
    body('feedback').optional().isString()
  ],
  async (req, res) => {
    try {
      const { taskId, decision, feedback } = req.body;
      
      // This simulates the Noam webhook for testing purposes
      const mockWebhookData = {
        taskId: taskId,
        status: 'completed',
        decision: decision,
        feedback: feedback || `Task ${decision} by test user`,
        completedBy: req.user.id,
        completedAt: new Date().toISOString()
      };

      // Call the webhook handler
      req.body = mockWebhookData;
      
      // Find execution and process
      const execution = await WorkflowExecution.findOne({ 
        'waitingInfo.taskId': taskId,
        status: 'waiting'
      });

      if (!execution) {
        return res.status(404).json({
          success: false,
          message: 'No waiting execution found for this task'
        });
      }

      const approvalResult = {
        taskId: taskId,
        status: 'completed',
        decision: decision,
        feedback: feedback || '',
        completedBy: req.user.id,
        completedAt: new Date().toISOString(),
        waitTime: Date.now() - new Date(execution.waitingInfo.createdAt).getTime()
      };

      await workflowExecutionService.resumeExecutionAfterHumanApproval(
        execution.id, 
        execution.waitingInfo.nodeId, 
        approvalResult
      );

      res.json({
        success: true,
        message: 'Mock approval processed successfully',
        data: {
          executionId: execution.id,
          taskId: taskId,
          decision: decision
        }
      });
    } catch (error) {
      logger.error('Error processing mock approval:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process mock approval',
        error: error.message
      });
    }
  }
);

module.exports = { router, initializeServices };