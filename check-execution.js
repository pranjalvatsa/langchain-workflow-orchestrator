const mongoose = require('mongoose');
const { WorkflowExecution } = require('./src/models');

async function checkExecution() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('✅ Connected to MongoDB');

    // Find the specific execution
    const executionId = 'exec_1760001170219_gp6k330qt';
    const execution = await WorkflowExecution.findOne({ executionId });

    if (execution) {
      console.log('🔍 Execution found:');
      console.log('  Status:', execution.status);
      console.log('  Started:', execution.startedAt);
      console.log('  Completed:', execution.completedAt);
      console.log('  Input:', JSON.stringify(execution.input, null, 2));
      console.log('  Result:', JSON.stringify(execution.result, null, 2));
      console.log('  Error:', execution.error);
      console.log('  Steps:', execution.steps?.length || 0);
      console.log('  Message:', execution.message);
      
      if (execution.steps && execution.steps.length > 0) {
        console.log('\n📋 Execution Steps:');
        execution.steps.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step.nodeId} (${step.status})`);
          if (step.error) console.log(`     Error: ${step.error}`);
        });
      }
    } else {
      console.log('❌ Execution not found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkExecution();