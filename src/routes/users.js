const express = require('express');
const AuthService = require('../services/AuthService');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const authService = new AuthService();

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const user = req.user;

  res.json({
    success: true,
    data: { user }
  });
}));

/**
 * @swagger
 * /api/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               preferences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const updates = req.body;

  const updatedUser = await authService.updateUserProfile(userId, updates);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user: updatedUser }
  });
}));

/**
 * @swagger
 * /api/users/preferences:
 *   put:
 *     summary: Update user preferences
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               theme:
 *                 type: string
 *                 enum: [light, dark]
 *               notifications:
 *                 type: object
 *               defaultModel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Preferences updated successfully
 */
router.put('/preferences', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { User } = require('../models');

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { preferences: req.body } },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Preferences updated successfully',
    data: { preferences: user.preferences }
  });
}));

/**
 * @swagger
 * /api/users/notifications:
 *   get:
 *     summary: Get user notifications
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: User notifications
 */
router.get('/notifications', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const limit = parseInt(req.query.limit) || 50;

  const notificationService = req.app.get('notificationService');
  const notifications = await notificationService.getNotifications(userId, limit);
  const unreadCount = await notificationService.getUnreadCount(userId);

  res.json({
    success: true,
    data: {
      notifications,
      unreadCount,
      count: notifications.length
    }
  });
}));

/**
 * @swagger
 * /api/users/notifications/{id}/read:
 *   post:
 *     summary: Mark notification as read
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.post('/notifications/:id/read', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const notificationId = req.params.id;

  const notificationService = req.app.get('notificationService');
  const marked = await notificationService.markNotificationAsRead(userId, notificationId);

  if (marked) {
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } else {
    res.status(404).json({
      error: 'Notification not found',
      message: 'The specified notification could not be found'
    });
  }
}));

/**
 * @swagger
 * /api/users/usage:
 *   get:
 *     summary: Get user usage statistics
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: User usage statistics
 */
router.get('/usage', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { User, Workflow, WorkflowExecution } = require('../models');

  const user = await User.findById(userId);
  const workflowCount = await Workflow.countDocuments({ ownerId: userId });
  const executionCount = await WorkflowExecution.countDocuments({ userId });

  // Get executions this month
  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const monthlyExecutions = await WorkflowExecution.countDocuments({
    userId,
    'metrics.startTime': { $gte: thisMonth }
  });

  const usage = {
    workflows: {
      total: workflowCount,
      limit: user.limits?.workflows || 100
    },
    executions: {
      total: executionCount,
      monthly: monthlyExecutions,
      monthlyLimit: user.limits?.monthlyExecutions || 1000
    },
    storage: {
      used: user.usage?.storageUsed || 0,
      limit: user.limits?.storage || 1024 * 1024 * 1024 // 1GB
    },
    apiCalls: {
      monthly: user.usage?.monthlyApiCalls || 0,
      monthlyLimit: user.limits?.monthlyApiCalls || 10000
    }
  };

  res.json({
    success: true,
    data: { usage }
  });
}));

/**
 * @swagger
 * /api/users/dashboard:
 *   get:
 *     summary: Get user dashboard data
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { Workflow, WorkflowExecution } = require('../models');

  // Recent workflows
  const recentWorkflows = await Workflow.find({ ownerId: userId })
    .sort({ 'metadata.lastModified': -1 })
    .limit(5)
    .select('name description status metadata');

  // Recent executions
  const recentExecutions = await WorkflowExecution.find({ userId })
    .sort({ 'metrics.startTime': -1 })
    .limit(10)
    .populate('workflowId', 'name')
    .select('workflowId status metrics.startTime metrics.duration');

  // Execution statistics for the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  
  const executionStats = await WorkflowExecution.aggregate([
    {
      $match: {
        userId: req.user._id,
        'metrics.startTime': { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$metrics.startTime' }
        },
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const dashboard = {
    recentWorkflows,
    recentExecutions,
    statistics: {
      totalWorkflows: await Workflow.countDocuments({ ownerId: userId }),
      totalExecutions: await WorkflowExecution.countDocuments({ userId }),
      executionTrend: executionStats
    }
  };

  res.json({
    success: true,
    data: { dashboard }
  });
}));

module.exports = router;