const mongoose = require('mongoose');
const callDeflectionTemplate = require('./src/templates/call-deflection-workflow');

// Import your models - adjust path as needed
const WorkflowTemplate = require('./src/models/index'); // Adjust based on your models structure

async function importCallDeflectionWorkflow() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('Connected to MongoDB');

    // Check if template already exists
    const existingTemplate = await WorkflowTemplate.findOne({ templateId: 'call-deflection-v1' });
    
    if (existingTemplate) {
      console.log('Call Deflection workflow template already exists. Updating...');
      
      // Update existing template
      Object.assign(existingTemplate, callDeflectionTemplate);
      existingTemplate.updatedAt = new Date();
      await existingTemplate.save();
      
      console.log('✅ Call Deflection workflow template updated successfully!');
      console.log(`Template ID: ${existingTemplate.templateId}`);
      console.log(`Template Name: ${existingTemplate.name}`);
    } else {
      console.log('Creating new Call Deflection workflow template...');
      
      // Create new template
      const newTemplate = new WorkflowTemplate(callDeflectionTemplate);
      await newTemplate.save();
      
      console.log('✅ Call Deflection workflow template created successfully!');
      console.log(`Template ID: ${newTemplate.templateId}`);
      console.log(`Template Name: ${newTemplate.name}`);
    }

    // Set environment variable for easy reference
    console.log('\n📝 Add this to your environment variables:');
    console.log('CALL_DEFLECTION_WORKFLOW_ID=call-deflection-v1');

    // Show usage instructions
    console.log('\n🚀 Usage Instructions:');
    console.log('1. Set the environment variable above');
    console.log('2. Test the workflow using: POST /api/webhooks/call-test');
    console.log('3. Use the workflow with: POST /api/webhooks/call-transcription');
    
    console.log('\n📊 Template Statistics:');
    console.log(`- Nodes: ${callDeflectionTemplate.nodes.length}`);
    console.log(`- Edges: ${callDeflectionTemplate.edges.length}`);
    console.log(`- Variables: ${callDeflectionTemplate.variables.length}`);
    console.log(`- Complexity: ${callDeflectionTemplate.config.complexity}`);

  } catch (error) {
    console.error('❌ Error importing Call Deflection workflow:', error);
    if (error.code === 11000) {
      console.error('Duplicate key error - template may already exist with this ID');
    }
  } finally {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the import
if (require.main === module) {
  importCallDeflectionWorkflow();
}

module.exports = importCallDeflectionWorkflow;