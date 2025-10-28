// bullmq-queue.js
// BullMQ queue setup for HITL workflow resume jobs

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Queue for workflow resume jobs
const workflowResumeQueue = new Queue('workflow-resume', {
  connection: redisConnection,
});


module.exports = {
  workflowResumeQueue,
  redisConnection,
};
