const cron = require('node-cron');
const winston = require('winston');

class SchedulerService {
  constructor(workflowExecutionService) {
    this.workflowExecutionService = workflowExecutionService;
    this.scheduledJobs = new Map();
    
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/scheduler.log' })
      ]
    });
  }

  start() {
    this.logger.info('Scheduler service started');
    
    // Start cleanup job - runs every hour
    this.scheduleJob('cleanup', '0 * * * *', async () => {
      await this.cleanupExpiredExecutions();
    });

    // Start health check job - runs every 5 minutes
    this.scheduleJob('health-check', '*/5 * * * *', async () => {
      await this.performHealthCheck();
    });
  }

  scheduleJob(id, cronExpression, task) {
    try {
      if (this.scheduledJobs.has(id)) {
        this.scheduledJobs.get(id).destroy();
      }

      const job = cron.schedule(cronExpression, async () => {
        try {
          await task();
        } catch (error) {
          this.logger.error(`Error in scheduled job ${id}:`, error);
        }
      }, {
        scheduled: true,
        timezone: process.env.TIMEZONE || 'UTC'
      });

      this.scheduledJobs.set(id, job);
      this.logger.info(`Scheduled job ${id} with expression: ${cronExpression}`);
      
      return job;
    } catch (error) {
      this.logger.error(`Error scheduling job ${id}:`, error);
      throw error;
    }
  }

  scheduleWorkflowExecution(workflowId, userId, cronExpression, inputs = {}, options = {}) {
    const jobId = `workflow_${workflowId}_${Date.now()}`;
    
    try {
      const job = this.scheduleJob(jobId, cronExpression, async () => {
        const { Workflow } = require('../models');
        const workflow = await Workflow.findById(workflowId);
        
        if (!workflow) {
          this.logger.error(`Scheduled workflow ${workflowId} not found`);
          this.unscheduleJob(jobId);
          return;
        }

        if (workflow.status !== 'published') {
          this.logger.warn(`Scheduled workflow ${workflowId} is not published, skipping execution`);
          return;
        }

        await this.workflowExecutionService.executeWorkflow(
          workflow,
          userId,
          inputs,
          { ...options, scheduled: true }
        );
      });

      return {
        jobId,
        scheduled: true,
        nextRun: this.getNextRunTime(cronExpression)
      };
    } catch (error) {
      this.logger.error(`Error scheduling workflow execution:`, error);
      throw error;
    }
  }

  unscheduleJob(jobId) {
    try {
      if (this.scheduledJobs.has(jobId)) {
        this.scheduledJobs.get(jobId).destroy();
        this.scheduledJobs.delete(jobId);
        this.logger.info(`Unscheduled job: ${jobId}`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Error unscheduling job ${jobId}:`, error);
      throw error;
    }
  }

  getScheduledJobs() {
    const jobs = [];
    for (const [id, job] of this.scheduledJobs) {
      jobs.push({
        id,
        running: job.running,
        scheduled: job.scheduled
      });
    }
    return jobs;
  }

  async cleanupExpiredExecutions() {
    try {
      const { WorkflowExecution } = require('../models');
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      
      const result = await WorkflowExecution.deleteMany({
        'metrics.startTime': { $lt: cutoffDate },
        status: { $in: ['completed', 'failed', 'aborted'] }
      });

      this.logger.info(`Cleaned up ${result.deletedCount} expired executions`);
    } catch (error) {
      this.logger.error('Error cleaning up expired executions:', error);
    }
  }

  async performHealthCheck() {
    try {
      // Check database connection
      const mongoose = require('mongoose');
      if (mongoose.connection.readyState !== 1) {
        this.logger.error('Database connection lost');
        return;
      }

      // Check active executions
      const activeCount = this.workflowExecutionService.activeExecutions.size;
      if (activeCount > 100) {
        this.logger.warn(`High number of active executions: ${activeCount}`);
      }

      // Check memory usage
      const memUsage = process.memoryUsage();
      const memUsageMB = memUsage.heapUsed / 1024 / 1024;
      if (memUsageMB > 1000) {
        this.logger.warn(`High memory usage: ${memUsageMB.toFixed(2)}MB`);
      }

      this.logger.debug(`Health check completed - Active executions: ${activeCount}, Memory: ${memUsageMB.toFixed(2)}MB`);
    } catch (error) {
      this.logger.error('Error in health check:', error);
    }
  }

  getNextRunTime(cronExpression) {
    try {
      const cronParser = require('cron-parser');
      const interval = cronParser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      this.logger.error('Error parsing cron expression:', error);
      return null;
    }
  }

  validateCronExpression(expression) {
    try {
      const cronParser = require('cron-parser');
      cronParser.parseExpression(expression);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  stop() {
    for (const [id, job] of this.scheduledJobs) {
      job.destroy();
    }
    this.scheduledJobs.clear();
    this.logger.info('Scheduler service stopped');
  }
}

module.exports = SchedulerService;