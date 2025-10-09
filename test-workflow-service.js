const mongoose = require('mongoose');
const WorkflowService = require('./src/services/WorkflowService');

// Use same MongoDB connection from create-weather-workflow.js
const MONGODB_URI = 'mongodb+srv://ecommerceworkflowchecker:OqX2KBD7ELpMZnf3@langchain-workflow-clust.azskq.mongodb.net/langchain-workflow-orchestrator?retryWrites=true&w=majority&appName=langchain-workflow-cluster';

async function testWorkflowService() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    const workflowService = new WorkflowService();
    
    console.log('Testing getWorkflowByTemplateId...');
    const workflow = await workflowService.getWorkflowByTemplateId('weather-summary-v3');
    
    if (workflow) {
      console.log('✅ Successfully found workflow:', {
        id: workflow.id,
        templateId: workflow.templateId,
        name: workflow.name,
        nodesCount: workflow.nodes?.length || 0
      });
    } else {
      console.log('❌ No workflow found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

testWorkflowService();