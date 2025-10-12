const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const { WorkflowService } = require('../services/WorkflowService');

const router = express.Router();
const workflowExecutionService = new WorkflowExecutionService();
const workflowService = new WorkflowService();

/**
 * @swagger
 * /api/webhooks/workflow-complete:
 *   post:
 *     summary: Webhook for workflow completion
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 */
router.post('/workflow-complete', asyncHandler(async (req, res) => {
  const { executionId, workflowId, status, outputs } = req.body;

  // Verify webhook signature
  const signature = req.headers['x-webhook-signature'];
  if (!verifyWebhookSignature(req.body, signature)) {
    return res.status(401).json({
      error: 'Invalid signature',
      message: 'Webhook signature verification failed'
    });
  }

  // Process webhook
  const notificationService = req.app.get('notificationService');
  
  // You can add custom logic here to handle workflow completion
  // For example, notify external systems, update databases, etc.

  res.json({
    success: true,
    message: 'Webhook processed successfully'
  });
}));

/**
 * @swagger
 * /api/webhooks/human-review/{executionId}/{nodeId}:
 *   post:
 *     summary: Webhook for external human review responses from NOAM tasks
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: executionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: nodeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: string
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               comments:
 *                 type: string
 *               reviewedBy:
 *                 type: string
 *               taskData:
 *                 type: object
 *     responses:
 *       200:
 *         description: Human review processed successfully
 *       404:
 *         description: Execution or node not found
 */
router.post('/human-review/:executionId/:nodeId', asyncHandler(async (req, res) => {
  const { executionId, nodeId } = req.params;
  const { taskId, action, comments, reviewedBy, taskData } = req.body;

  console.log('Received NOAM human review webhook:', {
    executionId,
    nodeId,
    action,
    reviewedBy,
    taskId,
    comments
  });

  // Validate action (NOAM sends "approve" or "reject")
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      error: 'Invalid action',
      message: 'Action must be either "approve" or "reject"'
    });
  }

  try {
    // Resume workflow with the review decision
    await workflowExecutionService.resumeWorkflowAfterReview(
      executionId, 
      nodeId, 
      action, // Use "approve"/"reject" directly from NOAM
      {
        reviewedBy,
        notes: comments, // NOAM sends comments field
        taskId,
        taskData,
        reviewedAt: new Date()
      }
    );

    res.json({
      success: true,
      message: 'NOAM human review processed successfully',
      data: {
        executionId,
        nodeId,
        action,
        processedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error processing NOAM human review webhook:', error);
    res.status(500).json({
      error: 'Processing failed',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/webhooks/noam-integration:
 *   post:
 *     summary: Webhook for Noam app integration events
 *     tags: [Webhooks]
 */
router.post('/noam-integration', asyncHandler(async (req, res) => {
  const { event, userId, data } = req.body;

  // Verify Noam webhook signature
  const signature = req.headers['x-noam-signature'];
  if (!verifyNoamWebhookSignature(req.body, signature)) {
    return res.status(401).json({
      error: 'Invalid signature',
      message: 'Noam webhook signature verification failed'
    });
  }

  // Process different Noam events
  switch (event) {
    case 'user.updated':
      await handleNoamUserUpdate(userId, data);
      break;
    
    case 'workspace.changed':
      await handleNoamWorkspaceChange(userId, data);
      break;
    
    case 'subscription.updated':
      await handleNoamSubscriptionUpdate(userId, data);
      break;
    
    default:
      console.log(`Unknown Noam event: ${event}`);
  }

  res.json({
    success: true,
    message: 'Noam webhook processed successfully'
  });
}));

async function handleNoamUserUpdate(userId, data) {
  const { User } = require('../models');
  
  // Update user data based on Noam changes
  await User.findOneAndUpdate(
    { noamUserId: userId },
    {
      $set: {
        'noamIntegration.userData': data,
        'noamIntegration.lastSync': new Date()
      }
    }
  );
}

async function handleNoamWorkspaceChange(userId, data) {
  // Handle workspace changes from Noam
  // This could include updating permissions, workspace settings, etc.
  console.log(`Noam workspace changed for user ${userId}:`, data);
}

async function handleNoamSubscriptionUpdate(userId, data) {
  const { User } = require('../models');
  
  // Update user limits based on subscription changes
  const newLimits = calculateLimitsFromSubscription(data.subscription);
  
  await User.findOneAndUpdate(
    { noamUserId: userId },
    {
      $set: {
        limits: newLimits,
        subscription: data.subscription
      }
    }
  );
}

function calculateLimitsFromSubscription(subscription) {
  const plans = {
    free: {
      workflows: 10,
      monthlyExecutions: 100,
      storage: 100 * 1024 * 1024, // 100MB
      monthlyApiCalls: 1000
    },
    pro: {
      workflows: 100,
      monthlyExecutions: 10000,
      storage: 1024 * 1024 * 1024, // 1GB
      monthlyApiCalls: 50000
    },
    enterprise: {
      workflows: -1, // unlimited
      monthlyExecutions: -1,
      storage: -1,
      monthlyApiCalls: -1
    }
  };

  return plans[subscription.plan] || plans.free;
}

/**
 * @swagger
 * /api/webhooks/call-transcription:
 *   post:
 *     summary: Process incoming call transcription and trigger call deflection workflow
 *     tags: [Webhooks]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - callId
 *               - transcription
 *             properties:
 *               callId:
 *                 type: string
 *                 description: Unique identifier for the call
 *               transcription:
 *                 type: string
 *                 description: Transcribed text from the call
 *               callerInfo:
 *                 type: object
 *                 description: Information about the caller
 *               audioUrl:
 *                 type: string
 *                 description: URL to the audio file
 *               metadata:
 *                 type: object
 *                 description: Additional metadata about the call
 *     responses:
 *       200:
 *         description: Workflow triggered successfully
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Internal server error
 */
router.post('/call-transcription', asyncHandler(async (req, res) => {
  const { callId, transcription, callerInfo, audioUrl, metadata } = req.body;

  // Validate required fields
  if (!callId || !transcription) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'callId and transcription are required'
    });
  }

  try {
    // Find the call deflection workflow template
    const CALL_DEFLECTION_WORKFLOW_ID = process.env.CALL_DEFLECTION_WORKFLOW_ID || 'call-deflection-v1';
    
    // Prepare workflow input context
    const workflowInput = {
      callId,
      transcription,
      callerInfo: callerInfo || {},
      audioUrl,
      metadata: {
        ...metadata,
        webhookReceivedAt: new Date().toISOString(),
        source: 'call-transcription-webhook'
      }
    };

    // Trigger the call deflection workflow
    const executionResult = await workflowExecutionService.executeWorkflow(
      CALL_DEFLECTION_WORKFLOW_ID,
      workflowInput
    );

    res.status(200).json({
      success: true,
      message: 'Call deflection workflow triggered successfully',
      data: {
        executionId: executionResult.executionId,
        callId: callId,
        workflowId: CALL_DEFLECTION_WORKFLOW_ID,
        status: 'started'
      }
    });

  } catch (error) {
    console.error('Call transcription webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process call transcription',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/webhooks/call-status/{callId}:
 *   get:
 *     summary: Get the processing status of a call
 *     tags: [Webhooks]
 *     parameters:
 *       - in: path
 *         name: callId
 *         required: true
 *         schema:
 *           type: string
 *         description: The call ID to check status for
 *     responses:
 *       200:
 *         description: Call status retrieved
 *       404:
 *         description: Call not found
 *       500:
 *         description: Internal server error
 */
router.get('/call-status/:callId', asyncHandler(async (req, res) => {
  const { callId } = req.params;
  
  try {
    // TODO: Look up actual execution by callId in the database
    // For now, return a realistic status
    
    const mockStatuses = ['queued', 'processing', 'intent_classification', 'human_review', 'completed', 'escalated'];
    const randomStatus = mockStatuses[Math.floor(Math.random() * mockStatuses.length)];
    
    res.json({
      success: true,
      data: {
        callId: callId,
        status: randomStatus,
        stage: randomStatus === 'processing' ? 'intent_classification' : randomStatus,
        progress: randomStatus === 'completed' ? 100 : Math.floor(Math.random() * 80) + 10,
        estimatedCompletion: randomStatus === 'completed' ? null : '30 seconds',
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Call status lookup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve call status',
      message: error.message
    });
  }
}));

/**
 * @swagger
 * /api/webhooks/call-test:
 *   post:
 *     summary: Test endpoint for call deflection workflow
 *     tags: [Webhooks]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scenario:
 *                 type: string
 *                 enum: ['simple_question', 'complex_issue', 'angry_customer']
 *     responses:
 *       200:
 *         description: Test call processed
 */
router.post('/call-test', asyncHandler(async (req, res) => {
  const { scenario = 'simple_question' } = req.body;

  // Generate test call data based on scenario
  const testScenarios = {
    simple_question: {
      transcription: "Hi, I placed an order yesterday and wanted to check when it will be delivered. My order number is 12345.",
      callerInfo: {
        phone: "+1234567890",
        customerId: "CUST_001",
        name: "John Doe",
        tier: "gold"
      }
    },
    complex_issue: {
      transcription: "I received my order but the product is completely different from what I ordered. I need a refund and want to speak to a manager about this mistake.",
      callerInfo: {
        phone: "+1987654321",
        customerId: "CUST_002", 
        name: "Jane Smith",
        tier: "silver"
      }
    },
    angry_customer: {
      transcription: "This is ridiculous! I've been waiting for my order for two weeks and nobody has given me any updates. I want to cancel everything and get my money back immediately!",
      callerInfo: {
        phone: "+1555666777",
        customerId: "CUST_003",
        name: "Mike Johnson",
        tier: "bronze"
      }
    }
  };

  const testData = testScenarios[scenario] || testScenarios.simple_question;
  const testCallId = `TEST_${Date.now()}_${scenario.toUpperCase()}`;

  // Process the test call through the webhook
  const webhookPayload = {
    callId: testCallId,
    transcription: testData.transcription,
    callerInfo: testData.callerInfo,
    metadata: {
      isTest: true,
      scenario: scenario,
      generatedAt: new Date().toISOString()
    }
  };

  // Call our own webhook endpoint
  try {
    const CALL_DEFLECTION_WORKFLOW_ID = process.env.CALL_DEFLECTION_WORKFLOW_ID || 'call-deflection-v1';
    
    const executionResult = await workflowExecutionService.executeWorkflow(
      CALL_DEFLECTION_WORKFLOW_ID,
      webhookPayload
    );

    res.status(200).json({
      success: true,
      message: `Test call processed for scenario: ${scenario}`,
      data: {
        testCallId: testCallId,
        scenario: scenario,
        executionId: executionResult.executionId,
        testData: webhookPayload
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Test call processing failed',
      message: error.message
    });
  }
}));



function verifyWebhookSignature(payload, signature) {
  if (!signature || !process.env.WEBHOOK_SECRET) {
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

function verifyNoamWebhookSignature(payload, signature) {
  if (!signature || !process.env.NOAM_WEBHOOK_SECRET) {
    return false;
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.NOAM_WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * @swagger
 * /api/webhooks/noam/task-notifications:
 *   post:
 *     summary: Send task notifications to Noam app
 *     description: Sends workflow execution updates and task notifications to Noam app
 *     tags: [Webhooks, Noam Integration]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               executionId:
 *                 type: string
 *               workflowId:
 *                 type: string
 *               templateId:
 *                 type: string
 *               noamWorkflowId:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [started, running, completed, failed, paused]
 *               taskData:
 *                 type: object
 *               outputs:
 *                 type: object
 *     responses:
 *       200:
 *         description: Notification sent to Noam successfully
 */
router.post('/noam/task-notifications', asyncHandler(async (req, res) => {
  try {
    const { 
      executionId, 
      workflowId, 
      templateId, 
      noamWorkflowId,
      status, 
      taskData, 
      outputs,
      currentNode,
      nextNodes,
      noamAccountId,
      noamUserId
    } = req.body;

    if (!executionId || !status || !noamWorkflowId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'executionId, status, and noamWorkflowId are required'
      });
    }

    // Prepare notification payload for Noam
    const noamNotification = {
      timestamp: new Date().toISOString(),
      source: 'universal-workflow-engine',
      version: '1.0.0',
      
      // Execution details
      execution: {
        executionId,
        workflowId,
        templateId,
        noamWorkflowId,
        status,
        currentNode: currentNode || null,
        nextNodes: nextNodes || []
      },
      
      // Task information for Noam UI
      task: {
        title: taskData?.title || `Workflow ${status}`,
        description: taskData?.description || `Workflow execution ${status}`,
        priority: taskData?.priority || 'medium',
        assignee: taskData?.assignee || noamUserId,
        dueDate: taskData?.dueDate || null,
        
        // Task actions based on workflow status
        actions: generateNoamTaskActions(status, executionId, workflowId),
        
        // Workflow outputs for display in Noam
        data: {
          outputs: outputs || {},
          inputs: taskData?.inputs || {},
          executionLog: taskData?.executionLog || [],
          progress: calculateWorkflowProgress(currentNode, nextNodes)
        }
      },
      
      // Integration metadata
      integration: {
        noamAccountId,
        noamUserId,
        bidirectionalSync: true,
        lastUpdated: new Date().toISOString()
      }
    };

    // Send notification to Noam app (replace with actual Noam webhook URL)
    const noamWebhookUrl = process.env.NOAM_WEBHOOK_URL || 'https://noam-app.com/api/webhooks/universal-engine';
    
    if (process.env.NODE_ENV !== 'test') {
      try {
        const axios = require('axios');
        const response = await axios.post(noamWebhookUrl, noamNotification, {
          headers: {
            'Content-Type': 'application/json',
            'X-Source': 'universal-workflow-engine',
            'X-Signature': generateNoamWebhookSignature(noamNotification)
          },
          timeout: 10000
        });

        console.log(`✅ Notification sent to Noam for execution ${executionId}`);
        
      } catch (webhookError) {
        console.error('❌ Failed to send notification to Noam:', webhookError.message);
        // Don't fail the request if webhook fails - just log it
      }
    }
    
    res.json({
      success: true,
      message: 'Task notification processed',
      data: {
        executionId,
        noamWorkflowId,
        status,
        notificationSent: true,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Noam task notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process task notification',
      message: error.message
    });
  }
}));

// Helper function to generate task actions for Noam UI
function generateNoamTaskActions(status, executionId, workflowId) {
  const baseActions = [
    {
      id: 'view-details',
      label: 'View Details',
      type: 'primary',
      url: `/workflows/${workflowId}/executions/${executionId}`
    }
  ];

  switch (status) {
    case 'running':
      return [
        ...baseActions,
        {
          id: 'pause-workflow',
          label: 'Pause',
          type: 'secondary',
          action: 'pause',
          endpoint: `/api/universal/workflows/${executionId}/pause`
        }
      ];
      
    case 'paused':
      return [
        ...baseActions,
        {
          id: 'resume-workflow',
          label: 'Resume',
          type: 'primary',
          action: 'resume',
          endpoint: `/api/universal/workflows/${executionId}/resume`
        },
        {
          id: 'cancel-workflow',
          label: 'Cancel',
          type: 'danger',
          action: 'cancel',
          endpoint: `/api/universal/workflows/${executionId}/cancel`
        }
      ];
      
    case 'completed':
      return [
        ...baseActions,
        {
          id: 'view-outputs',
          label: 'View Results',
          type: 'success',
          url: `/workflows/${workflowId}/executions/${executionId}/outputs`
        },
        {
          id: 'run-again',
          label: 'Run Again',
          type: 'secondary',
          action: 'duplicate',
          endpoint: `/api/universal/workflows/execute`
        }
      ];
      
    case 'failed':
      return [
        ...baseActions,
        {
          id: 'retry-workflow',
          label: 'Retry',
          type: 'primary',
          action: 'retry',
          endpoint: `/api/universal/workflows/${executionId}/retry`
        },
        {
          id: 'view-errors',
          label: 'View Errors',
          type: 'danger',
          url: `/workflows/${workflowId}/executions/${executionId}/errors`
        }
      ];
      
    default:
      return baseActions;
  }
}

// Helper function to calculate workflow progress
function calculateWorkflowProgress(currentNode, nextNodes) {
  if (!currentNode) return { percentage: 0, stage: 'not-started' };
  if (!nextNodes || nextNodes.length === 0) return { percentage: 100, stage: 'completed' };
  
  // Simple progress calculation - can be enhanced based on workflow complexity
  return {
    percentage: 50, // Mid-progress
    stage: 'in-progress',
    currentNode: currentNode,
    remainingNodes: nextNodes.length
  };
}

// Helper function to generate webhook signature for Noam
function generateNoamWebhookSignature(payload) {
  const crypto = require('crypto');
  const secret = process.env.NOAM_WEBHOOK_SECRET || 'default-secret';
  
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

module.exports = router;