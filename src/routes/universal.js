const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const WorkflowService = require('../services/WorkflowService');

const router = express.Router();
const workflowExecutionService = new WorkflowExecutionService();
const workflowService = new WorkflowService();

// Apply authentication middleware to all universal routes
router.use(authMiddleware);

/**
 * Universal Workflow Engine
 * 
 * This single endpoint can handle ANY workflow without code changes.
 * Workflows are defined in JSON/YAML and stored in the database.
 * 
 * No need for workflow-specific endpoints!
 */

/**
 * @swagger
 * /api/universal/workflows/execute:
 *   post:
 *     summary: Execute any workflow by ID with input data
 *     description: Universal endpoint that can execute any workflow without code changes
 *     tags: [Universal Workflow Engine]
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
 *                 description: The ID of the workflow to execute
 *               templateId:
 *                 type: string
 *                 description: Alternative - template ID to execute
 *               input:
 *                 type: object
 *                 description: Input data for the workflow
 *               variables:
 *                 type: object
 *                 description: Variable overrides for the workflow
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for execution tracking
 *     responses:
 *       200:
 *         description: Workflow execution started
 *       404:
 *         description: Workflow not found
 *       500:
 *         description: Execution failed
 */
router.post('/workflows/execute', asyncHandler(async (req, res) => {
  const { workflowId, templateId, input = {}, variables = {}, metadata = {} } = req.body;

  // Validate required fields
  if (!workflowId && !templateId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field',
      message: 'Either workflowId or templateId is required'
    });
  }

  try {
    let workflow;
    
    if (templateId) {
      // Find workflow by template ID
      workflow = await workflowService.getWorkflowByTemplateId(templateId);
    } else {
      // Find workflow by ID
      workflow = await workflowService.getWorkflowById(workflowId);
    }

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: `No workflow found with ${templateId ? 'templateId' : 'workflowId'}: ${templateId || workflowId}`
      });
    }

    // Merge input data with variables
    const executionInput = {
      ...input,
      ...variables,
      _metadata: {
        ...metadata,
        executionType: 'universal',
        timestamp: new Date().toISOString(),
        source: 'universal-workflow-engine'
      }
    };

    // Execute the workflow
    const executionResult = await workflowExecutionService.executeWorkflow(
      workflow,
      req.user?.id || 'anonymous',
      executionInput,
      { metadata }
    );

    // Check if this workflow was imported from Noam and send notification
    if (workflow.noamIntegration && workflow.noamIntegration.imported) {
      try {
        await sendNoamTaskNotification({
          executionId: executionResult.executionId,
          workflowId: workflow.id,
          templateId: workflow.templateId,
          noamWorkflowId: workflow.noamIntegration.noamWorkflowId,
          noamAccountId: workflow.noamIntegration.noamAccountId,
          noamUserId: workflow.noamIntegration.noamUserId,
          status: 'started',
          taskData: {
            title: `${workflow.name} - Execution Started`,
            description: `Workflow execution ${executionResult.executionId} has been started`,
            inputs: executionInput
          }
        });
      } catch (notificationError) {
        console.error('Failed to notify Noam:', notificationError.message);
        // Don't fail the execution if notification fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Workflow execution started',
      data: {
        executionId: executionResult.executionId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        templateId: workflow.templateId,
        status: 'started',
        input: executionInput,
        noamIntegration: workflow.noamIntegration ? {
          noamWorkflowId: workflow.noamIntegration.noamWorkflowId,
          notificationSent: true
        } : null
      }
    });

  } catch (error) {
    console.error('Universal workflow execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Workflow execution failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/universal/workflows/schedule:
 *   post:
 *     summary: Schedule any workflow to run at specific times
 *     description: Universal scheduling endpoint for any workflow
 *     tags: [Universal Workflow Engine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workflowId
 *               - schedule
 *             properties:
 *               workflowId:
 *                 type: string
 *                 description: The ID of the workflow to schedule
 *               templateId:
 *                 type: string
 *                 description: Alternative - template ID to schedule
 *               schedule:
 *                 type: string
 *                 description: Cron expression or human-readable schedule
 *                 example: "daily@02:00"
 *               input:
 *                 type: object
 *                 description: Default input data for scheduled executions
 *               timezone:
 *                 type: string
 *                 description: Timezone for scheduling
 *                 default: "UTC"
 *               enabled:
 *                 type: boolean
 *                 description: Whether the schedule is active
 *                 default: true
 *     responses:
 *       200:
 *         description: Workflow scheduled successfully
 *       404:
 *         description: Workflow not found
 *       500:
 *         description: Scheduling failed
 */
router.post('/workflows/schedule', asyncHandler(async (req, res) => {
  const { workflowId, templateId, schedule, input = {}, timezone = 'UTC', enabled = true } = req.body;

  if (!workflowId && !templateId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field',
      message: 'Either workflowId or templateId is required'
    });
  }

  if (!schedule) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field',
      message: 'Schedule is required'
    });
  }

  try {
    let workflow;
    
    if (templateId) {
      workflow = await workflowService.getWorkflowByTemplateId(templateId);
    } else {
      workflow = await workflowService.getWorkflowById(workflowId);
    }

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
        message: `No workflow found with ${templateId ? 'templateId' : 'workflowId'}: ${templateId || workflowId}`
      });
    }

    // Create schedule record
    const scheduleData = {
      workflowId: workflow.id,
      templateId: workflow.templateId,
      schedule: schedule,
      input: input,
      timezone: timezone,
      enabled: enabled,
      createdAt: new Date(),
      createdBy: req.user?.id || 'system'
    };

    // TODO: Store schedule in database and set up actual cron job
    // For now, we'll use the scheduler tool
    const scheduleResult = await workflowExecutionService.langChainService.tools.get('scheduler').func(
      JSON.stringify({
        workflowId: workflow.id,
        schedule: schedule,
        timezone: timezone
      })
    );

    const scheduleResponse = JSON.parse(scheduleResult);

    res.status(200).json({
      success: true,
      message: 'Workflow scheduled successfully',
      data: {
        scheduleId: scheduleResponse.schedule?.id,
        workflowId: workflow.id,
        workflowName: workflow.name,
        schedule: schedule,
        timezone: timezone,
        nextRun: scheduleResponse.schedule?.nextRun,
        enabled: enabled
      }
    });

  } catch (error) {
    console.error('Universal workflow scheduling error:', error);
    res.status(500).json({
      success: false,
      error: 'Workflow scheduling failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/universal/workflows/trigger:
 *   post:
 *     summary: Trigger workflow by event type (webhook-style)
 *     description: Universal webhook endpoint that can trigger workflows based on event types
 *     tags: [Universal Workflow Engine]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventType
 *             properties:
 *               eventType:
 *                 type: string
 *                 description: Type of event that should trigger workflows
 *                 example: "call_transcription"
 *               data:
 *                 type: object
 *                 description: Event data to pass to the workflow
 *               source:
 *                 type: string
 *                 description: Source system that generated the event
 *     responses:
 *       200:
 *         description: Workflows triggered successfully
 *       404:
 *         description: No workflows found for event type
 *       500:
 *         description: Trigger failed
 */
router.post('/workflows/trigger', asyncHandler(async (req, res) => {
  const { eventType, data = {}, source } = req.body;

  if (!eventType) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field',
      message: 'eventType is required'
    });
  }

  try {
    // Find all workflows that are triggered by this event type
    const workflows = await workflowService.getWorkflowsByTriggerType(eventType);

    if (!workflows || workflows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No workflows found',
        message: `No workflows configured to handle event type: ${eventType}`
      });
    }

    const executionResults = [];

    // Execute all matching workflows
    for (const workflow of workflows) {
      try {
        const executionInput = {
          ...data,
          _event: {
            type: eventType,
            source: source,
            timestamp: new Date().toISOString()
          }
        };

        const executionResult = await workflowExecutionService.executeWorkflow(
          workflow.id,
          executionInput
        );

        executionResults.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          executionId: executionResult.executionId,
          status: 'started'
        });
      } catch (error) {
        executionResults.push({
          workflowId: workflow.id,
          workflowName: workflow.name,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Triggered ${executionResults.filter(r => r.status === 'started').length} workflows for event: ${eventType}`,
      data: {
        eventType: eventType,
        triggeredWorkflows: executionResults.filter(r => r.status === 'started'),
        failedWorkflows: executionResults.filter(r => r.status === 'failed'),
        totalFound: workflows.length
      }
    });

  } catch (error) {
    console.error('Universal workflow trigger error:', error);
    res.status(500).json({
      success: false,
      error: 'Workflow trigger failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/universal/executions/{executionId}/status:
 *   get:
 *     summary: Get execution status and results
 *     description: Universal endpoint to get workflow execution status and results
 *     tags: [Universal Workflow Engine]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The execution ID to check
 *     responses:
 *       200:
 *         description: Execution status and results
 *       404:
 *         description: Execution not found
 */
router.get('/executions/:executionId/status', asyncHandler(async (req, res) => {
  const { executionId } = req.params;

  try {
    const execution = await workflowExecutionService.getExecutionStatus(executionId);

    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found',
        message: `No execution found with ID: ${executionId}`
      });
    }

    res.status(200).json({
      success: true,
      data: {
        executionId: execution.executionId,
        workflowId: execution.workflowId,
        status: execution.status,
        inputs: execution.inputs,
        outputs: execution.outputs,
        executionSteps: execution.executionSteps,
        metrics: execution.metrics,
        logs: execution.logs,
        error: execution.error,
        startTime: execution.createdAt,
        endTime: execution.metrics?.endTime,
        duration: execution.metrics?.duration
      }
    });

  } catch (error) {
    console.error('Universal execution status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get execution status',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/universal/tools:
 *   get:
 *     summary: Get list of all available tools
 *     description: Returns all tools available in the LangChain service for workflow building
 *     tags: [Universal Workflow Engine]
 *     responses:
 *       200:
 *         description: List of available tools
 */
router.get('/tools', asyncHandler(async (req, res) => {
  try {
    const langChainService = workflowExecutionService.langChainService;
    const tools = [];

    // Get all available tools
    for (const [toolName, tool] of langChainService.tools.entries()) {
      tools.push({
        name: toolName,
        description: tool.description || 'No description available',
        type: tool.constructor.name
      });
    }

    res.status(200).json({
      success: true,
      message: `Found ${tools.length} available tools`,
      data: {
        tools: tools.sort((a, b) => a.name.localeCompare(b.name)),
        totalCount: tools.length
      }
    });

  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tools',
      message: error.message
    });
  }
}));

// Helper function to send task notifications to Noam
async function sendNoamTaskNotification(notificationData) {
  try {
    const axios = require('axios');
    
    // Send notification via internal webhook endpoint
    const webhookUrl = `${process.env.BASE_URL || 'http://localhost:8000'}/api/webhooks/noam/task-notifications`;
    
    await axios.post(webhookUrl, notificationData, {
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'universal-engine-internal'
      },
      timeout: 5000
    });

    console.log(`✅ Noam notification sent for execution ${notificationData.executionId}`);
    
  } catch (error) {
    console.error('❌ Failed to send Noam notification:', error.message);
    throw error;
  }
}

module.exports = router;