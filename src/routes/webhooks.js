const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

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

module.exports = router;