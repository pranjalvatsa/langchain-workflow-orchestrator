const mongoose = require('mongoose');
const WorkflowService = require('../services/WorkflowService');
const User = require('../models/User');

// Import workflow templates
const callDeflectionTemplate = require('./call-deflection-workflow');
const insightsTemplate = require('./insights-workflow');

require('dotenv').config();

/**
 * Universal Workflow Deployment Script
 * 
 * This script demonstrates how ANY workflow can be deployed 
 * without code changes - just configuration!
 * 
 * No more workflow-specific endpoints needed!
 */

class UniversalWorkflowDeployer {
  constructor() {
    this.workflowService = new WorkflowService();
  }

  async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/langchain-workflows');
      console.log('✅ Connected to MongoDB');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  async getSystemUser() {
    try {
      // Get or create a system user for template deployment
      let systemUser = await User.findOne({ email: 'system@langchain-orchestrator.com' });
      
      if (!systemUser) {
        systemUser = new User({
          email: 'system@langchain-orchestrator.com',
          name: 'System',
          role: 'admin',
          isActive: true,
          noamAccountId: 'system-account',
          noamUserId: 'system-user'
        });
        await systemUser.save();
        console.log('✅ Created system user for template deployment');
      }
      
      return systemUser;
    } catch (error) {
      console.error('❌ Error getting system user:', error);
      throw error;
    }
  }

  async deployTemplate(template, systemUserId) {
    try {
      console.log(`\n🚀 Deploying workflow template: ${template.name}`);
      console.log(`   Template ID: ${template.templateId}`);
      console.log(`   Category: ${template.category}`);
      console.log(`   Triggers: ${template.triggers.map(t => t.eventType).join(', ')}`);

      // Check if template already exists
      const existing = await this.workflowService.getWorkflowByTemplateId(template.templateId);
      if (existing) {
        console.log(`   ⚠️  Template already exists, skipping...`);
        return existing;
      }

      // Create workflow from template
      const workflow = await this.workflowService.createWorkflowFromTemplate(template, systemUserId);
      
      console.log(`   ✅ Successfully deployed template`);
      console.log(`   📝 Workflow ID: ${workflow._id}`);
      console.log(`   🎯 Trigger endpoints:`);
      
      // Show how to trigger this workflow
      for (const trigger of template.triggers) {
        console.log(`      POST /api/universal/workflows/trigger`);
        console.log(`      Body: { "eventType": "${trigger.eventType}", "data": {...} }`);
      }
      
      console.log(`   📅 Schedule endpoint:`);
      console.log(`      POST /api/universal/workflows/schedule`);
      console.log(`      Body: { "templateId": "${template.templateId}", "schedule": "daily@09:00" }`);
      
      console.log(`   ▶️  Execute endpoint:`);
      console.log(`      POST /api/universal/workflows/execute`);
      console.log(`      Body: { "templateId": "${template.templateId}", "input": {...} }`);

      return workflow;
    } catch (error) {
      console.error(`❌ Error deploying template ${template.templateId}:`, error);
      throw error;
    }
  }

  async deployAllTemplates() {
    try {
      console.log('🌟 Universal Workflow Engine - Template Deployment');
      console.log('====================================================');
      console.log('✨ Deploy ANY workflow without code changes!');
      console.log('✨ All workflows use the same universal endpoints!');
      console.log('✨ JSON/YAML configuration drives everything!');

      const systemUser = await this.getSystemUser();
      const templates = [callDeflectionTemplate, insightsTemplate];
      const deployedWorkflows = [];

      for (const template of templates) {
        try {
          const workflow = await this.deployTemplate(template, systemUser._id);
          deployedWorkflows.push(workflow);
        } catch (error) {
          console.error(`Failed to deploy ${template.templateId}:`, error.message);
        }
      }

      console.log('\n🎉 Deployment Summary');
      console.log('=====================');
      console.log(`✅ Successfully deployed ${deployedWorkflows.length} workflows`);
      console.log('✅ All workflows are now accessible via universal endpoints');
      console.log('✅ No workflow-specific code required!');

      console.log('\n📚 Universal API Usage Examples:');
      console.log('=================================');

      console.log('\n1️⃣  Execute Call Deflection Workflow:');
      console.log('   curl -X POST http://localhost:8000/api/universal/workflows/execute \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"templateId":"call-deflection-v1","input":{"callTranscript":"Customer wants to cancel..."}}\'');

      console.log('\n2️⃣  Execute Insights Workflow:');
      console.log('   curl -X POST http://localhost:8000/api/universal/workflows/execute \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"templateId":"insights-analytics-v1","input":{"reportType":"daily"}}\'');

      console.log('\n3️⃣  Schedule Insights Report:');
      console.log('   curl -X POST http://localhost:8000/api/universal/workflows/schedule \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"templateId":"insights-analytics-v1","schedule":"daily@09:00","input":{"reportType":"daily"}}\'');

      console.log('\n4️⃣  Trigger via Webhook (Call Transcription):');
      console.log('   curl -X POST http://localhost:8000/api/universal/workflows/trigger \\');
      console.log('     -H "Content-Type: application/json" \\');
      console.log('     -d \'{"eventType":"call_transcription","data":{"transcript":"..."}}\'');

      console.log('\n5️⃣  Get Available Tools:');
      console.log('   curl http://localhost:8000/api/universal/tools');

      console.log('\n🔧 Adding New Workflows:');
      console.log('========================');
      console.log('1. Create JSON/YAML template (no code changes!)');
      console.log('2. Define nodes using existing tools');
      console.log('3. Set up triggers for events');
      console.log('4. Deploy via universal endpoints');
      console.log('5. All existing endpoints work immediately!');

      return deployedWorkflows;

    } catch (error) {
      console.error('❌ Deployment failed:', error);
      throw error;
    }
  }

  async showAvailableTools() {
    try {
      console.log('\n🛠️  Available Tools for Workflow Building:');
      console.log('==========================================');
      
      const tools = this.workflowService.langChainService.tools;
      
      tools.forEach((tool, name) => {
        console.log(`   ✅ ${name}: ${tool.description || 'No description'}`);
      });

      console.log(`\n📊 Total Tools Available: ${tools.size}`);
      console.log('💡 Any tool can be used in any workflow via configuration!');
    } catch (error) {
      console.error('❌ Error showing tools:', error);
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Main execution
async function main() {
  const deployer = new UniversalWorkflowDeployer();
  
  try {
    await deployer.connect();
    await deployer.showAvailableTools();
    await deployer.deployAllTemplates();
  } catch (error) {
    console.error('❌ Deployment script failed:', error);
    process.exit(1);
  } finally {
    await deployer.disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = UniversalWorkflowDeployer;