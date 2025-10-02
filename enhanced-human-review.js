// Enhancement to WorkflowExecutionService.js humanReview node
// Add this logic to handle "escalate" vs "respond" decisions

async executeHumanReviewNode(executionId, node, context) {
  try {
    const { humanReviewConfig } = node.data;
    const { taskConfig, timeout = 86400000 } = humanReviewConfig;
    
    // Process template variables
    const processedTaskConfig = this.processTemplateVariables(taskConfig, context);
    
    // Create task with escalation options
    const taskCreationInput = {
      taskTitle: processedTaskConfig.taskTitle,
      taskDescription: processedTaskConfig.taskDescription,
      taskData: {
        ...processedTaskConfig.data,
        // Add escalation options to the human reviewer
        availableActions: [
          {
            id: 'respond',
            label: 'Send Response to Customer',
            description: 'Provide a response directly to the customer'
          },
          {
            id: 'escalate', 
            label: 'Escalate to Human Agent',
            description: 'Transfer this call to a live human agent'
          }
        ]
      },
      priority: processedTaskConfig.priority || 'high',
      assignee: processedTaskConfig.assignee,
      workflowExecutionId: executionId
    };

    // Use existing task creation tool
    const taskResult = await this.langChainService.tools.get('noam_task_creator').func(
      JSON.stringify(taskCreationInput)
    );

    const taskData = JSON.parse(taskResult);
    if (!taskData.success) {
      throw new Error(`Failed to create human review task: ${taskData.error}`);
    }

    // Poll for task completion with enhanced decision handling
    const pollResult = await this.langChainService.tools.get('task_status_poller').func(
      JSON.stringify({
        taskId: taskData.taskId,
        maxWaitTime: timeout,
        pollInterval: 5000
      })
    );

    const pollData = JSON.parse(pollResult);
    if (!pollData.success) {
      throw new Error(`Human review task failed: ${pollData.error}`);
    }

    // Enhanced decision processing
    let finalDecision = pollData.decision;
    let responseText = pollData.feedback;
    let escalationReason = null;

    // If decision includes escalation info
    if (pollData.taskData && pollData.taskData.selectedAction) {
      finalDecision = pollData.taskData.selectedAction;
      responseText = pollData.taskData.responseText || pollData.feedback;
      escalationReason = pollData.taskData.escalationReason;
    }

    return {
      success: true,
      output: finalDecision, // 'respond' or 'escalate'
      metadata: {
        taskId: taskData.taskId,
        decision: finalDecision,
        responseText: responseText,
        escalationReason: escalationReason,
        reviewDuration: pollData.waitTime,
        reviewer: pollData.reviewer || 'unknown'
      }
    };

  } catch (error) {
    this.logger.error('Human review node error:', error);
    throw error;
  }
}