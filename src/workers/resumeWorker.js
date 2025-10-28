// src/workers/resumeWorker.js
// BullMQ worker to resume paused workflows after human review

const { Worker } = require('bullmq');
const { workflowResumeQueue, redisConnection } = require('../services/bullmq-queue');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const { Workflow, WorkflowExecution } = require('../models');

// Worker to process resume jobs
const worker = new Worker(
  'workflow-resume',
  async (job) => {
    const { executionId, resumeData } = job.data;
    console.log(`[RESUME WORKER] Resuming workflow execution ${executionId} with data:`, resumeData);

    // Load execution and workflow from DB
    const execution = await WorkflowExecution.findOne({ executionId });
    if (!execution) throw new Error(`Execution not found: ${executionId}`);
    const workflow = await Workflow.findById(execution.workflowId);
    if (!workflow) throw new Error(`Workflow not found: ${execution.workflowId}`);

    // Prepare context for resumption
    const context = {
      ...execution.pauseState?.context,
      humanReviewAction: resumeData.action,
      humanReviewFeedback: resumeData.feedback,
      // Add any other review data as needed
    };

    // Optionally, update execution status
    execution.status = 'running';
    execution.pauseState = undefined;
    await execution.save();

    // Resume workflow from the paused node
    // You may want to call a dedicated resume method, e.g.:
    const engine = new WorkflowExecutionService();
    await engine.resumeWorkflowAfterReview(executionId, execution.pauseState?.currentNodeId, resumeData.action, context);

    console.log(`[RESUME WORKER] Workflow ${executionId} resumed.`);
  },
  { connection: redisConnection }
);

worker.on('completed', (job) => {
  console.log(`[RESUME WORKER] Job completed: ${job.id}`);
});
worker.on('failed', (job, err) => {
  console.error(`[RESUME WORKER] Job failed: ${job.id}`, err);
});

console.log('[RESUME WORKER] Worker started and listening for resume jobs...');
