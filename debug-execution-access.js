const mongoose = require('mongoose');
const { WorkflowExecution } = require('./src/models');
const { ApiKey } = require('./src/models');

async function debugExecutionAccess() {
  try {
    // Connect to production MongoDB
    await mongoose.connect('mongodb+srv://pranjalvatsa:dXfGNJ3sYz6IFm8y@cluster0.8fgvo.mongodb.net/langchain-workflow-orchestrator?retryWrites=true&w=majority&appName=Cluster0');
    
    console.log('🔗 Connected to MongoDB');
    
    // Find the execution
    const executionId = 'exec_1760003741943_47acpgt5k';
    const execution = await WorkflowExecution.findOne({ executionId });
    
    if (execution) {
      console.log('✅ Execution found:');
      console.log('Execution ID:', execution.executionId);
      console.log('Triggered By:', JSON.stringify(execution.triggeredBy, null, 2));
      console.log('Status:', execution.status);
      console.log('Started At:', execution.startedAt);
      
      // Check if triggeredBy.userId exists
      if (execution.triggeredBy && execution.triggeredBy.userId) {
        console.log('User ID from execution:', execution.triggeredBy.userId.toString());
      } else {
        console.log('❌ No triggeredBy.userId found in execution');
      }
    } else {
      console.log('❌ Execution not found');
    }
    
    // Find the API key and its associated user
    const apiKeyValue = 'lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622';
    const apiKey = await ApiKey.findOne({ key: apiKeyValue });
    
    if (apiKey) {
      console.log('\n✅ API Key found:');
      console.log('API Key User ID:', apiKey.userId.toString());
    } else {
      console.log('\n❌ API Key not found');
    }
    
    // Compare the user IDs
    if (execution && apiKey && execution.triggeredBy && execution.triggeredBy.userId) {
      const executionUserId = execution.triggeredBy.userId.toString();
      const apiKeyUserId = apiKey.userId.toString();
      
      console.log('\n🔍 Comparison:');
      console.log('Execution User ID:', executionUserId);
      console.log('API Key User ID:  ', apiKeyUserId);
      console.log('Match:', executionUserId === apiKeyUserId ? '✅' : '❌');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

debugExecutionAccess();