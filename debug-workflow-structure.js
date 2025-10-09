const mongoose = require('mongoose');
const WorkflowService = require('./src/services/WorkflowService');

// Use same MongoDB connection
const MONGODB_URI = 'mongodb+srv://ecommerceworkflowchecker:OqX2KBD7ELpMZnf3@langchain-workflow-clust.azskq.mongodb.net/langchain-workflow-orchestrator?retryWrites=true&w=majority&appName=langchain-workflow-cluster';

async function debugWorkflowStructure() {
  try {
    console.log('🔍 Debugging workflow structure for start node detection...');
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const workflowService = new WorkflowService();
    
    console.log('\n1️⃣ Getting workflow by template ID...');
    const workflow = await workflowService.getWorkflowByTemplateId('weather-summary-v3');
    
    if (!workflow) {
      console.log('❌ No workflow found');
      return;
    }

    console.log('\n2️⃣ Workflow Structure:');
    console.log('========================');
    console.log(`ID: ${workflow.id}`);
    console.log(`Template ID: ${workflow.templateId}`);
    console.log(`Name: ${workflow.name}`);
    console.log(`Nodes count: ${workflow.nodes?.length || 0}`);
    console.log(`Edges count: ${workflow.edges?.length || 0}`);

    console.log('\n3️⃣ Nodes Details:');
    console.log('===================');
    workflow.nodes?.forEach((node, index) => {
      console.log(`Node ${index + 1}: ID="${node.id}", Type="${node.type}", Label="${node.data?.label}"`);
    });

    console.log('\n4️⃣ Edges Details:');
    console.log('===================');
    workflow.edges?.forEach((edge, index) => {
      console.log(`Edge ${index + 1}: "${edge.source}" -> "${edge.target}"`);
    });

    console.log('\n5️⃣ Start Node Detection Logic:');
    console.log('===============================');
    const { nodes, edges } = workflow;
    
    // Same logic as WorkflowExecutionService
    const startNodes = nodes.filter(node => 
      !edges.some(edge => edge.target === node.id)
    );

    console.log(`Found ${startNodes.length} start nodes:`);
    startNodes.forEach(node => {
      console.log(`  - ${node.id} (${node.type}): ${node.data?.label}`);
    });

    if (startNodes.length === 0) {
      console.log('\n❌ NO START NODES FOUND! Debugging...');
      
      console.log('\nAll node IDs:');
      nodes.forEach(node => console.log(`  - "${node.id}"`));
      
      console.log('\nAll edge targets:');
      edges.forEach(edge => console.log(`  - "${edge.target}"`));
      
      console.log('\nNodes that have incoming edges:');
      nodes.forEach(node => {
        const hasIncoming = edges.some(edge => edge.target === node.id);
        console.log(`  - ${node.id}: ${hasIncoming ? 'HAS incoming' : 'NO incoming'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

debugWorkflowStructure();