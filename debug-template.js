const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const { WorkflowTemplate } = require('./src/models');

async function debugTemplate() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('✅ Connected to MongoDB');

    // Find the weather template
    const template = await WorkflowTemplate.findOne({ templateId: 'weather-summary-v3' });
    
    if (!template) {
      console.log('❌ Template not found');
      return;
    }

    console.log('📋 Template found:');
    console.log('   Template ID:', template.templateId);
    console.log('   Name:', template.name);
    console.log('   Author:', template.author);
    
    console.log('\n🔍 Nodes data:');
    console.log('   Type:', typeof template.nodes);
    console.log('   Content:', template.nodes);
    
    console.log('\n🔍 Edges data:');
    console.log('   Type:', typeof template.edges);
    console.log('   Content:', template.edges);

    // Try to parse them
    console.log('\n🧪 Parsing test:');
    try {
      const parsedNodes = JSON.parse(template.nodes);
      console.log('   Parsed nodes count:', parsedNodes.length);
      console.log('   First node:', parsedNodes[0]);
    } catch (e) {
      console.log('   ❌ Failed to parse nodes:', e.message);
    }

    try {
      const parsedEdges = JSON.parse(template.edges);
      console.log('   Parsed edges count:', parsedEdges.length);
    } catch (e) {
      console.log('   ❌ Failed to parse edges:', e.message);
    }

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugTemplate();