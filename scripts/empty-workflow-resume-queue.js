// scripts/empty-workflow-resume-queue.js
// Script to empty the 'workflow-resume' BullMQ queue safely

require('dotenv').config({ path: '.env.production' });
const { Queue } = require('bullmq');
const Redis = require('ioredis');

const redisConnection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const queue = new Queue('workflow-resume', { connection: redisConnection });

(async () => {
  try {
    console.log('Draining waiting/delayed jobs...');
    await queue.drain();
    console.log('Cleaning completed jobs...');
    await queue.clean(0, 1000, 'completed');
    console.log('Cleaning failed jobs...');
    await queue.clean(0, 1000, 'failed');
    console.log('Obliterating queue (removes everything, including active jobs)...');
    await queue.obliterate({ force: true });
    await queue.close();
    redisConnection.disconnect();
    console.log('Queue emptied!');
  } catch (err) {
    console.error('Error emptying queue:', err);
    process.exit(1);
  }
  process.exit(0);
})();
