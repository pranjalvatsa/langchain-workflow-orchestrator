const mongoose = require('mongoose');
const { WorkflowTemplate, User } = require('./src/models');

async function debugSchema() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('✅ Connected to MongoDB');

    // Check the actual schema definition
    console.log('🔍 WorkflowTemplate Schema:');
    const schema = WorkflowTemplate.schema;
    console.log('nodes type:', schema.paths.nodes);
    console.log('edges type:', schema.paths.edges);

    // Try to create a simple template
    const simpleTemplate = new WorkflowTemplate({
      name: 'Debug Test',
      description: 'Testing schema',
      category: 'custom',
      templateId: 'debug-test-123',
      nodes: [
        {
          id: 'test-1',
          type: 'start',
          position: { x: 100, y: 100 },
          data: { label: 'Test Node' }
        }
      ],
      edges: [
        {
          id: 'e1',
          source: 'test-1',
          target: 'test-2'
        }
      ],
      author: new mongoose.Types.ObjectId(),
      status: 'draft'
    });

    console.log('🧪 Testing template creation...');
    await simpleTemplate.validate();
    console.log('✅ Validation passed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.errors) {
      Object.keys(error.errors).forEach(key => {
        console.error(`  ${key}:`, error.errors[key].message);
        console.error(`  Expected:`, error.errors[key].kind);
        console.error(`  Got:`, typeof error.errors[key].value, error.errors[key].valueType);
      });
    }
  } finally {
    await mongoose.disconnect();
  }
}

debugSchema();