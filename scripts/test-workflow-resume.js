// scripts/test-workflow-resume.js
// Automated test for a 6-step workflow with 2 human-in-the-loop nodes

require('dotenv').config({ path: '.env.production' });
const mongoose = require('mongoose');
const { WorkflowExecution } = require('../src/models');
const WorkflowExecutionService = require('../src/services/WorkflowExecutionService');
const Workflow = require('../src/models/Workflow');

const TEST_WORKFLOW_ID = '68ff81feaab833f396c74c7a';
const { Types } = require('mongoose');
const TEST_USER_ID = new Types.ObjectId();

async function main() {
  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log('Connected to MongoDB');

  // 1. Load the workflow definition
  const workflow = await Workflow.findById(TEST_WORKFLOW_ID);
  if (!workflow) {
    console.error('Workflow not found:', TEST_WORKFLOW_ID);
    process.exit(1);
  }
  console.log('Loaded workflow:', workflow._id, workflow.name);

  // 2. Start a new execution
  const service = new WorkflowExecutionService();
  const execution = await service.executeWorkflow(workflow, TEST_USER_ID, { test: true });
  console.log('Started execution:', execution.executionId);

  // 3. Poll for pause at first human review node
  let pausedExecution = null;
  for (let i = 0; i < 20; i++) { // Wait up to 20s
    pausedExecution = await WorkflowExecution.findOne({ executionId: execution.executionId, status: 'waiting_human_review' });
    if (pausedExecution) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!pausedExecution) {
    console.error('Execution did not pause for human review in time.');
    process.exit(1);
  }
  console.log('Paused at human review node:', pausedExecution.pauseState?.lastNodeId);

  // 4. Simulate human review completion (approve)
  // You may need to update the task in DB or call your API here if required by your logic
  // For now, we just enqueue the resume job
  const resumeData = {
    lastNodeId: pausedExecution.pauseState?.lastNodeId,
    context: pausedExecution.pauseState?.context || pausedExecution.inputs,
  };
  await WorkflowExecutionService.enqueueResumeJob(pausedExecution.executionId, resumeData);
  console.log('Enqueued resume job after first human review.');

  // 5. Poll for pause at second human review node
  let pausedExecution2 = null;
  for (let i = 0; i < 20; i++) { // Wait up to 20s
    pausedExecution2 = await WorkflowExecution.findOne({ executionId: execution.executionId, status: 'waiting_human_review' });
    if (pausedExecution2 && pausedExecution2.pauseState?.lastNodeId !== resumeData.lastNodeId) break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!pausedExecution2) {
    console.error('Execution did not pause at second human review node in time.');
    process.exit(1);
  }
  console.log('Paused at second human review node:', pausedExecution2.pauseState?.lastNodeId);
    // Add a 60-second delay to ensure DB state is committed
    console.log("[Test] Paused execution found. Waiting 60 seconds to ensure DB state is committed...");
    await sleep(60000);
    console.log("[Test] 60 seconds elapsed. Proceeding to check pauseState...");

  // 6. Simulate second human review completion (approve)
  const resumeData2 = {
    lastNodeId: pausedExecution2.pauseState?.lastNodeId,
    context: pausedExecution2.pauseState?.context || pausedExecution2.inputs,
  };
  await WorkflowExecutionService.enqueueResumeJob(pausedExecution2.executionId, resumeData2);
  console.log('Enqueued resume job after second human review.');

  // 7. Wait for completion
  let finalExecution = null;
  for (let i = 0; i < 20; i++) { // Wait up to 20s
    finalExecution = await WorkflowExecution.findOne({ executionId: execution.executionId });
    if (finalExecution.status === 'completed' || finalExecution.status === 'failed') break;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!finalExecution) {
    console.error('Execution did not complete in time.');
    process.exit(1);
  }
  console.log('Final execution status:', finalExecution.status);
  console.log('Final outputs:', finalExecution.outputs);

  process.exit(0);
}

main().catch(err => {
  console.error('Test script error:', err);
  process.exit(1);
});
