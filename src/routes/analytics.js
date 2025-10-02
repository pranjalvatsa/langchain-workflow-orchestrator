const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /api/analytics/overview:
 *   get:
 *     summary: Get analytics overview
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d, 1y]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Analytics overview
 */
router.get('/overview', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const period = req.query.period || '30d';
  
  const { Workflow, WorkflowExecution } = require('../models');

  // Calculate date range
  const periodDays = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365
  };
  
  const days = periodDays[period] || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get executions in period
  const executions = await WorkflowExecution.find({
    userId: req.user._id,
    'metrics.startTime': { $gte: startDate }
  });

  // Calculate metrics
  const overview = {
    period,
    totalExecutions: executions.length,
    successfulExecutions: executions.filter(e => e.status === 'completed').length,
    failedExecutions: executions.filter(e => e.status === 'failed').length,
    averageDuration: 0,
    totalWorkflows: await Workflow.countDocuments({ ownerId: userId }),
    activeWorkflows: await Workflow.countDocuments({ 
      ownerId: userId, 
      status: 'published' 
    })
  };

  // Calculate average duration for completed executions
  const completedExecutions = executions.filter(e => 
    e.status === 'completed' && e.metrics.duration
  );
  
  if (completedExecutions.length > 0) {
    overview.averageDuration = completedExecutions.reduce(
      (sum, e) => sum + e.metrics.duration, 0
    ) / completedExecutions.length;
  }

  // Success rate
  overview.successRate = overview.totalExecutions > 0 
    ? (overview.successfulExecutions / overview.totalExecutions) * 100 
    : 0;

  res.json({
    success: true,
    data: { overview }
  });
}));

/**
 * @swagger
 * /api/analytics/trends:
 *   get:
 *     summary: Get execution trends
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [hour, day, week]
 *           default: day
 *     responses:
 *       200:
 *         description: Execution trends
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = req.query.period || '30d';
  const granularity = req.query.granularity || 'day';
  
  const { WorkflowExecution } = require('../models');

  // Calculate date range
  const periodDays = { '7d': 7, '30d': 30, '90d': 90 };
  const days = periodDays[period] || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Build aggregation pipeline based on granularity
  const dateFormat = {
    hour: '%Y-%m-%d %H:00',
    day: '%Y-%m-%d',
    week: '%Y-%U'
  };

  const pipeline = [
    {
      $match: {
        userId,
        'metrics.startTime': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { 
            format: dateFormat[granularity], 
            date: '$metrics.startTime' 
          }
        },
        total: { $sum: 1 },
        successful: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        averageDuration: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'completed'] },
              '$metrics.duration',
              null
            ]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const trends = await WorkflowExecution.aggregate(pipeline);

  res.json({
    success: true,
    data: { trends, period, granularity }
  });
}));

/**
 * @swagger
 * /api/analytics/workflows:
 *   get:
 *     summary: Get workflow analytics
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Workflow analytics
 */
router.get('/workflows', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { Workflow, WorkflowExecution } = require('../models');

  // Get workflow performance data
  const pipeline = [
    {
      $match: { userId }
    },
    {
      $group: {
        _id: '$workflowId',
        totalExecutions: { $sum: 1 },
        successfulExecutions: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        failedExecutions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        averageDuration: {
          $avg: {
            $cond: [
              { $eq: ['$status', 'completed'] },
              '$metrics.duration',
              null
            ]
          }
        },
        lastExecution: { $max: '$metrics.startTime' }
      }
    },
    {
      $lookup: {
        from: 'workflows',
        localField: '_id',
        foreignField: '_id',
        as: 'workflow'
      }
    },
    {
      $unwind: '$workflow'
    },
    {
      $project: {
        workflowId: '$_id',
        workflowName: '$workflow.name',
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 1,
        successRate: {
          $cond: [
            { $gt: ['$totalExecutions', 0] },
            { $multiply: [{ $divide: ['$successfulExecutions', '$totalExecutions'] }, 100] },
            0
          ]
        },
        averageDuration: 1,
        lastExecution: 1
      }
    },
    { $sort: { totalExecutions: -1 } }
  ];

  const workflowAnalytics = await WorkflowExecution.aggregate(pipeline);

  res.json({
    success: true,
    data: { workflows: workflowAnalytics }
  });
}));

/**
 * @swagger
 * /api/analytics/errors:
 *   get:
 *     summary: Get error analytics
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [7d, 30d, 90d]
 *           default: 30d
 *     responses:
 *       200:
 *         description: Error analytics
 */
router.get('/errors', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const period = req.query.period || '30d';
  
  const { WorkflowExecution } = require('../models');

  const periodDays = { '7d': 7, '30d': 30, '90d': 90 };
  const days = periodDays[period] || 30;
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get failed executions with error details
  const failedExecutions = await WorkflowExecution.find({
    userId,
    status: 'failed',
    'metrics.startTime': { $gte: startDate }
  }).populate('workflowId', 'name');

  // Group errors by type and workflow
  const errorAnalytics = {
    totalErrors: failedExecutions.length,
    errorsByWorkflow: {},
    errorsByType: {},
    recentErrors: failedExecutions
      .sort((a, b) => b.metrics.startTime - a.metrics.startTime)
      .slice(0, 10)
      .map(exec => ({
        executionId: exec.id,
        workflowName: exec.workflowId?.name || 'Unknown',
        error: exec.error?.message || 'Unknown error',
        timestamp: exec.metrics.startTime
      }))
  };

  // Count errors by workflow
  failedExecutions.forEach(exec => {
    const workflowName = exec.workflowId?.name || 'Unknown';
    errorAnalytics.errorsByWorkflow[workflowName] = 
      (errorAnalytics.errorsByWorkflow[workflowName] || 0) + 1;
  });

  // Count errors by type
  failedExecutions.forEach(exec => {
    const errorType = exec.error?.message?.split(':')[0] || 'Unknown';
    errorAnalytics.errorsByType[errorType] = 
      (errorAnalytics.errorsByType[errorType] || 0) + 1;
  });

  res.json({
    success: true,
    data: { errors: errorAnalytics, period }
  });
}));

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Get performance analytics
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Performance analytics
 */
router.get('/performance', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { WorkflowExecution } = require('../models');

  // Get performance metrics for completed executions
  const completedExecutions = await WorkflowExecution.find({
    userId,
    status: 'completed',
    'metrics.duration': { $exists: true }
  });

  if (completedExecutions.length === 0) {
    return res.json({
      success: true,
      data: {
        performance: {
          totalExecutions: 0,
          averageDuration: 0,
          medianDuration: 0,
          p95Duration: 0,
          p99Duration: 0
        }
      }
    });
  }

  // Calculate duration statistics
  const durations = completedExecutions
    .map(e => e.metrics.duration)
    .sort((a, b) => a - b);

  const performance = {
    totalExecutions: durations.length,
    averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
    medianDuration: durations[Math.floor(durations.length / 2)],
    p95Duration: durations[Math.floor(durations.length * 0.95)],
    p99Duration: durations[Math.floor(durations.length * 0.99)],
    minDuration: durations[0],
    maxDuration: durations[durations.length - 1]
  };

  res.json({
    success: true,
    data: { performance }
  });
}));

module.exports = router;