// workflow-resume-worker.js
// BullMQ worker to process workflow resume jobs


require('dotenv').config({ path: '.env.production' });
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('MONGODB_URI:', process.env.MONGODB_URI);

const mongoose = require('mongoose');
// Connect to MongoDB before starting the worker
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

const { Worker } = require('bullmq');
const Redis = require('ioredis');
const WorkflowExecutionService = require('./WorkflowExecutionService');

// Connect to Redis
const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

// Worker to process resume jobs
const workflowResumeWorker = new Worker(
  'workflow-resume',
  async job => {
    const { executionId, resumeData } = job.data;
    console.log(`[BullMQ] Resuming workflow execution: ${executionId}`);
    try {
      // Resume workflow from paused state
      await WorkflowExecutionService.resumeWorkflow(executionId, resumeData);
      console.log(`[BullMQ] Workflow ${executionId} resumed successfully.`);
    } catch (err) {
      console.error(`[BullMQ] Error resuming workflow ${executionId}:`, err);
      throw err;
    }
  },
  {
    connection: redisConnection,
  }
);

module.exports = workflowResumeWorker;
