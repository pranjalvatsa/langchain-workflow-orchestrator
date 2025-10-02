const winston = require('winston');

class NotificationService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/notifications.log' })
      ]
    });

    // Initialize notification channels
    this.channels = {
      email: this.initEmailChannel(),
      webhook: this.initWebhookChannel(),
      inApp: this.initInAppChannel()
    };
  }

  initEmailChannel() {
    if (!process.env.EMAIL_SERVICE_ENABLED) {
      return null;
    }

    const nodemailer = require('nodemailer');
    
    return nodemailer.createTransporter({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }

  initWebhookChannel() {
    return {
      send: async (url, data) => {
        try {
          const fetch = (await import('node-fetch')).default;
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'LangChain-Workflow-Orchestrator/1.0'
            },
            body: JSON.stringify(data)
          });
          
          return { success: response.ok, status: response.status };
        } catch (error) {
          this.logger.error('Webhook notification failed:', error);
          return { success: false, error: error.message };
        }
      }
    };
  }

  initInAppChannel() {
    return {
      notifications: new Map(),
      
      send: async (userId, notification) => {
        if (!this.notifications.has(userId)) {
          this.notifications.set(userId, []);
        }
        
        const userNotifications = this.notifications.get(userId);
        userNotifications.push({
          ...notification,
          id: this.generateNotificationId(),
          timestamp: new Date(),
          read: false
        });

        // Keep only last 100 notifications per user
        if (userNotifications.length > 100) {
          userNotifications.splice(0, userNotifications.length - 100);
        }

        return { success: true };
      },

      getNotifications: (userId, limit = 50) => {
        const userNotifications = this.notifications.get(userId) || [];
        return userNotifications.slice(-limit).reverse();
      },

      markAsRead: (userId, notificationId) => {
        const userNotifications = this.notifications.get(userId) || [];
        const notification = userNotifications.find(n => n.id === notificationId);
        if (notification) {
          notification.read = true;
          return true;
        }
        return false;
      }
    };
  }

  async notifyWorkflowComplete(execution, workflow, user) {
    const notification = {
      type: 'workflow_complete',
      title: 'Workflow Completed',
      message: `Workflow "${workflow.name}" completed successfully`,
      data: {
        workflowId: workflow._id,
        executionId: execution.id,
        duration: execution.metrics.duration,
        outputs: execution.outputs
      }
    };

    await this.sendNotification(user, notification);
  }

  async notifyWorkflowFailed(execution, workflow, user, error) {
    const notification = {
      type: 'workflow_failed',
      title: 'Workflow Failed',
      message: `Workflow "${workflow.name}" failed: ${error.message}`,
      data: {
        workflowId: workflow._id,
        executionId: execution.id,
        error: error.message,
        failedNode: execution.executionSteps
          .filter(step => step.status === 'failed')
          .pop()?.nodeId
      }
    };

    await this.sendNotification(user, notification);
  }

  async notifySystemUpdate(message, users = []) {
    const notification = {
      type: 'system_update',
      title: 'System Update',
      message,
      data: {
        timestamp: new Date()
      }
    };

    for (const user of users) {
      await this.sendNotification(user, notification);
    }
  }

  async notifyResourceLimit(user, resource, limit, current) {
    const notification = {
      type: 'resource_limit',
      title: 'Resource Limit Warning',
      message: `You are approaching your ${resource} limit (${current}/${limit})`,
      data: {
        resource,
        limit,
        current,
        percentage: (current / limit) * 100
      }
    };

    await this.sendNotification(user, notification);
  }

  async sendNotification(user, notification) {
    try {
      const userId = user._id || user.id || user;
      const userPreferences = user.preferences?.notifications || {};

      // Send in-app notification (always)
      await this.channels.inApp.send(userId, notification);

      // Send email notification if enabled
      if (userPreferences.email && this.shouldSendEmail(notification.type, userPreferences)) {
        await this.sendEmailNotification(user, notification);
      }

      // Send webhook notification if configured
      if (user.webhookUrl && userPreferences.webhook) {
        await this.sendWebhookNotification(user.webhookUrl, notification);
      }

      this.logger.info(`Notification sent to user ${userId}: ${notification.type}`);
    } catch (error) {
      this.logger.error('Error sending notification:', error);
    }
  }

  async sendEmailNotification(user, notification) {
    if (!this.channels.email) {
      return;
    }

    try {
      const emailTemplate = this.getEmailTemplate(notification.type);
      const html = this.renderEmailTemplate(emailTemplate, notification, user);

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@langchain-workflow.com',
        to: user.email,
        subject: notification.title,
        html
      };

      await this.channels.email.sendMail(mailOptions);
    } catch (error) {
      this.logger.error('Error sending email notification:', error);
    }
  }

  async sendWebhookNotification(webhookUrl, notification) {
    try {
      const payload = {
        event: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        timestamp: new Date().toISOString()
      };

      const result = await this.channels.webhook.send(webhookUrl, payload);
      
      if (!result.success) {
        this.logger.error(`Webhook notification failed: ${result.error || result.status}`);
      }
    } catch (error) {
      this.logger.error('Error sending webhook notification:', error);
    }
  }

  shouldSendEmail(notificationType, preferences) {
    switch (notificationType) {
      case 'workflow_complete':
        return preferences.workflowComplete !== false;
      case 'workflow_failed':
        return preferences.workflowFailed !== false;
      case 'system_update':
        return preferences.systemUpdates === true;
      case 'resource_limit':
        return preferences.resourceLimits !== false;
      default:
        return true;
    }
  }

  getEmailTemplate(type) {
    const templates = {
      workflow_complete: {
        subject: 'Workflow Completed Successfully',
        template: 'workflow-complete.html'
      },
      workflow_failed: {
        subject: 'Workflow Execution Failed',
        template: 'workflow-failed.html'
      },
      system_update: {
        subject: 'System Update Notification',
        template: 'system-update.html'
      },
      resource_limit: {
        subject: 'Resource Limit Warning',
        template: 'resource-limit.html'
      }
    };

    return templates[type] || templates.workflow_complete;
  }

  renderEmailTemplate(template, notification, user) {
    // Simple template rendering - in production, use a proper template engine
    const baseTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>${notification.title}</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4f46e5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9fafb; }
            .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
            .button { display: inline-block; padding: 10px 20px; background: #4f46e5; color: white; text-decoration: none; border-radius: 4px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>LangChain Workflow Orchestrator</h1>
            </div>
            <div class="content">
                <h2>${notification.title}</h2>
                <p>Hello ${user.firstName || user.email},</p>
                <p>${notification.message}</p>
                ${this.renderNotificationData(notification)}
            </div>
            <div class="footer">
                <p>This is an automated notification from LangChain Workflow Orchestrator.</p>
                <p>To manage your notification preferences, please visit your account settings.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return baseTemplate;
  }

  renderNotificationData(notification) {
    if (!notification.data) {
      return '';
    }

    let html = '<div style="margin: 20px 0; padding: 15px; background: white; border-radius: 4px;">';
    
    switch (notification.type) {
      case 'workflow_complete':
        html += `
          <h3>Execution Details</h3>
          <p><strong>Workflow ID:</strong> ${notification.data.workflowId}</p>
          <p><strong>Execution ID:</strong> ${notification.data.executionId}</p>
          <p><strong>Duration:</strong> ${Math.round(notification.data.duration / 1000)}s</p>
        `;
        break;
      
      case 'workflow_failed':
        html += `
          <h3>Error Details</h3>
          <p><strong>Workflow ID:</strong> ${notification.data.workflowId}</p>
          <p><strong>Execution ID:</strong> ${notification.data.executionId}</p>
          <p><strong>Error:</strong> ${notification.data.error}</p>
          <p><strong>Failed Node:</strong> ${notification.data.failedNode || 'Unknown'}</p>
        `;
        break;
      
      case 'resource_limit':
        html += `
          <h3>Resource Usage</h3>
          <p><strong>Resource:</strong> ${notification.data.resource}</p>
          <p><strong>Current Usage:</strong> ${notification.data.current}</p>
          <p><strong>Limit:</strong> ${notification.data.limit}</p>
          <p><strong>Usage:</strong> ${notification.data.percentage.toFixed(1)}%</p>
        `;
        break;
    }
    
    html += '</div>';
    return html;
  }

  generateNotificationId() {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getNotifications(userId, limit = 50) {
    return this.channels.inApp.getNotifications(userId, limit);
  }

  async markNotificationAsRead(userId, notificationId) {
    return this.channels.inApp.markAsRead(userId, notificationId);
  }

  async getUnreadCount(userId) {
    const notifications = this.channels.inApp.getNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }
}

module.exports = NotificationService;