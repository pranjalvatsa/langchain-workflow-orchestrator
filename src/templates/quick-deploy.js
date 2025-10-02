const mongoose = require('mongoose');
const { WorkflowTemplate } = require('../models');
const User = require('../models/User');

// Import the 2 working templates
const callDeflectionTemplate = require('./call-deflection-workflow');
const insightsTemplate = require('./insights-workflow');

require('dotenv').config();

/**
 * Quick Template Deployment
 * Deploy the 2 main workflow templates to database
 */

async function deployTemplates() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
    console.log('✅ Connected to MongoDB');

    // Get or create system user
    let systemUser = await User.findOne({ email: 'system@langchain-orchestrator.com' });
    if (!systemUser) {
      systemUser = new User({
        email: 'system@langchain-orchestrator.com',
        name: 'Universal Workflow Engine',
        role: 'admin',
        isActive: true,
        noamAccountId: 'universal-system',
        noamUserId: 'template-deployer'
      });
      await systemUser.save();
      console.log('✅ Created system user');
    }

    const templates = [
      {
        templateId: 'call-deflection-v1',
        name: 'Call Deflection Automation',
        description: 'Automated customer service call handling with AI analysis and human escalation',
        category: 'customer-service',
        template: callDeflectionTemplate
      },
      {
        templateId: 'insights-analytics-v1', 
        name: 'Business Insights Analytics',
        description: 'Automated data collection, analysis, and reporting workflow for business insights',
        category: 'analytics',
        template: insightsTemplate
      }
    ];

    const savedTemplates = [];

    for (const templateInfo of templates) {
      try {
        console.log(`\\n📝 Saving: ${templateInfo.name}`);
        
        // Check if exists
        let template = await WorkflowTemplate.findOne({ templateId: templateInfo.templateId });
        
        if (template) {
          console.log('   ⚠️  Template exists, updating...');
          template.nodes = templateInfo.template.nodes || [];
          template.edges = templateInfo.template.edges || [];
          template.configuration = templateInfo.template.configuration || {};
          template.triggers = templateInfo.template.triggers || [];
          template.tags = templateInfo.template.metadata?.tags || template.tags;
          await template.save();
        } else {
          console.log('   ✨ Creating new template...');
          template = new WorkflowTemplate({
            templateId: templateInfo.templateId,
            name: templateInfo.name,
            description: templateInfo.description,
            category: templateInfo.category,
            version: '1.0.0',
            nodes: templateInfo.template.nodes || [],
            edges: templateInfo.template.edges || [],
            triggers: templateInfo.template.triggers || [],
            configuration: templateInfo.template.configuration || {},
            tags: templateInfo.template.metadata?.tags || ['automation'],
            complexity: 'medium',
            isPublic: true,
            active: true,
            createdBy: systemUser._id,
            downloadCount: 0
          });
          await template.save();
        }
        
        console.log(`   ✅ Saved: ${template._id}`);
        savedTemplates.push({
          _id: template._id,
          name: template.name,
          templateId: template.templateId,
          metadata: {
            nodeCount: (template.nodes || []).length,
            edgeCount: (template.edges || []).length
          }
        });
        
      } catch (error) {
        console.error(`   ❌ Failed to save ${templateInfo.templateId}:`, error.message);
      }
    }

    console.log('\\n🎉 Deployment Complete!');
    console.log('========================');
    console.log(`✅ Saved ${savedTemplates.length} templates to database`);
    
    savedTemplates.forEach((template, i) => {
      console.log(`   ${i + 1}. ${template.name} (${template.templateId})`);
      console.log(`      Database ID: ${template._id}`);
      console.log(`      Nodes: ${template.metadata.nodeCount}, Edges: ${template.metadata.edgeCount}`);
    });

    console.log('\\n🔗 Noam App Integration URLs:');
    console.log('==============================');
    console.log('📥 Export all templates:');
    console.log('   POST http://localhost:8000/api/templates/import/noam');
    
    console.log('\\n📋 Individual ReactFlow exports:');
    savedTemplates.forEach(template => {
      console.log(`   GET http://localhost:8000/api/templates/${template._id}/reactflow`);
    });

    console.log('\\n🚀 Universal Engine Examples:');
    console.log('===============================');
    console.log('📞 Execute Call Deflection:');
    console.log('   POST http://localhost:8000/api/universal/workflows/execute');
    console.log('   {"templateId":"call-deflection-v1","input":{"callTranscript":"Customer complaint"}}');
    
    console.log('\\n📊 Execute Insights Workflow:');
    console.log('   POST http://localhost:8000/api/universal/workflows/execute'); 
    console.log('   {"templateId":"insights-analytics-v1","input":{"reportType":"daily"}}');

    await mongoose.disconnect();
    console.log('\\n✅ Disconnected from MongoDB');
    
    return savedTemplates;

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

// Run deployment
if (require.main === module) {
  deployTemplates().catch(console.error);
}

module.exports = deployTemplates;