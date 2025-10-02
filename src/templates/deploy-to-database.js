const mongoose = require('mongoose');
const WorkflowTemplate = require('../models/WorkflowTemplate');
const User = require('../models/User');

// Import workflow templates
const callDeflectionTemplate = require('./call-deflection-workflow');
const insightsTemplate = require('./insights-workflow');

require('dotenv').config();

/**
 * Universal Workflow Template Database Deployment
 * 
 * This script saves the 3 universal workflow templates to the database
 * and prepares them for Noam app integration.
 * 
 * Templates saved:
 * 1. Call Deflection - Customer service automation
 * 2. Business Insights - Analytics and reporting
 * 3. Customer Onboarding - (to be created)
 */

class TemplateDeploymentManager {
  constructor() {
    this.deployedTemplates = [];
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
        console.log('✅ Created system user for template deployment');
      }
      
      return systemUser;
    } catch (error) {
      console.error('❌ Error getting system user:', error);
      throw error;
    }
  }

  async saveTemplate(templateData, systemUserId) {
    try {
      console.log(`\n📝 Saving template: ${templateData.name}`);
      console.log(`   Template ID: ${templateData.templateId}`);
      console.log(`   Category: ${templateData.category || 'general'}`);
      console.log(`   Nodes: ${templateData.nodes?.length || 0}`);
      console.log(`   Edges: ${templateData.edges?.length || 0}`);

      // Check if template already exists
      const existing = await WorkflowTemplate.findOne({ templateId: templateData.templateId });
      if (existing) {
        console.log(`   ⚠️  Template already exists, updating...`);
        
        // Update existing template
        Object.assign(existing, {
          ...templateData,
          updatedAt: new Date(),
          'metadata.nodeCount': templateData.nodes?.length || 0,
          'metadata.edgeCount': templateData.edges?.length || 0
        });
        
        await existing.save();
        console.log(`   ✅ Template updated successfully`);
        return existing;
      }

      // Create new template
      const template = new WorkflowTemplate({
        templateId: templateData.templateId,
        name: templateData.name,
        description: templateData.description,
        version: templateData.version || '1.0.0',
        nodes: templateData.nodes || [],
        edges: templateData.edges || [],
        configuration: {
          maxConcurrentExecutions: 5,
          timeoutMinutes: 30,
          retryPolicy: 'exponential',
          triggers: templateData.triggers || [],
          requiredEnvironment: templateData.configuration?.requiredEnvironment || [],
          inputSchema: templateData.configuration?.inputSchema || {},
          ...templateData.configuration
        },
        metadata: {
          category: templateData.category || 'general',
          tags: templateData.metadata?.tags || templateData.tags || [],
          complexity: templateData.metadata?.complexity || 'medium',
          estimatedRuntime: templateData.metadata?.estimatedRuntime || '5-10 minutes',
          isPublic: true,
          featured: true,
          toolsUsed: (templateData.nodes || [])
            .filter(node => node.data?.tool)
            .map(node => node.data.tool),
          nodeCount: templateData.nodes?.length || 0,
          edgeCount: templateData.edges?.length || 0,
          examples: templateData.metadata?.examples || [],
          ...templateData.metadata
        },
        createdBy: systemUserId,
        status: 'published',
        publishedAt: new Date()
      });

      await template.save();
      
      console.log(`   ✅ Template saved to database`);
      console.log(`   🆔 Database ID: ${template._id}`);
      
      return template;

    } catch (error) {
      console.error(`❌ Error saving template ${templateData.templateId}:`, error);
      throw error;
    }
  }

  async createCustomerOnboardingTemplate() {
    return {
      templateId: 'customer-onboarding-v1',
      name: 'Customer Onboarding Automation',
      description: 'Automated customer onboarding workflow with welcome sequence, account setup, and initial engagement',
      version: '1.0.0',
      category: 'customer-service',
      
      triggers: [
        {
          eventType: 'new_customer_signup',
          enabled: true,
          priority: 'high',
          filter: {
            accountType: ['premium', 'standard', 'trial']
          }
        },
        {
          eventType: 'manual_onboarding',
          enabled: true,
          priority: 'normal',
          filter: {
            source: ['admin', 'sales', 'support']
          }
        }
      ],

      nodes: [
        {
          id: 'start',
          type: 'start',
          position: { x: 100, y: 100 },
          data: {
            label: 'New Customer',
            description: 'Customer onboarding initiated'
          }
        },
        {
          id: 'validate-customer',
          type: 'tool',
          position: { x: 300, y: 100 },
          data: {
            label: 'Validate Customer Data',
            tool: 'data_validator',
            parameters: {
              rules: {
                email: { required: true, format: 'email' },
                name: { required: true, minLength: 2 },
                accountType: { required: true, enum: ['premium', 'standard', 'trial'] }
              },
              data: {
                email: '\\${input.email}',
                name: '\\${input.name}',
                accountType: '\\${input.accountType}',
                phone: '\\${input.phone}'
              }
            },
            outputMapping: {
              isValid: 'valid',
              validationErrors: 'errors',
              cleanedData: 'data'
            }
          }
        },
        {
          id: 'fetch-customer-profile',
          type: 'tool',
          position: { x: 500, y: 100 },
          data: {
            label: 'Create Customer Profile',
            tool: 'customer_data_api',
            parameters: {
              action: 'create_profile',
              customerData: {
                email: '\\${node.validate-customer.cleanedData.email}',
                name: '\\${node.validate-customer.cleanedData.name}',
                accountType: '\\${input.accountType}',
                signupDate: '\\${new Date().toISOString()}',
                source: '\\${input.source || "website"}'
              }
            },
            outputMapping: {
              customerId: 'customer.id',
              profileCreated: 'success',
              customerProfile: 'customer'
            }
          }
        },
        {
          id: 'generate-welcome-message',
          type: 'llm',
          position: { x: 700, y: 100 },
          data: {
            label: 'Generate Welcome Message',
            model: 'gpt-4o',
            systemPrompt: 'You are a customer success specialist. Create personalized welcome messages for new customers based on their profile and account type. Be warm, professional, and helpful.',
            userPrompt: `Create a personalized welcome message for:

Customer: \\${node.validate-customer.cleanedData.name}
Email: \\${node.validate-customer.cleanedData.email}
Account Type: \\${input.accountType}
Signup Source: \\${input.source}

Include:
1. Warm welcome
2. Next steps for their account type
3. Available resources
4. Contact information for support

Keep it friendly and concise.`,
            outputMapping: {
              welcomeMessage: 'response',
              messageGenerated: 'success'
            }
          }
        },
        {
          id: 'send-welcome-email',
          type: 'tool',
          position: { x: 900, y: 100 },
          data: {
            label: 'Send Welcome Email',
            tool: 'api_caller',
            parameters: {
              url: 'https://api.sendgrid.com/v3/mail/send',
              method: 'POST',
              headers: {
                'Authorization': 'Bearer \\${SENDGRID_API_KEY}',
                'Content-Type': 'application/json'
              },
              body: {
                personalizations: [{
                  to: [{
                    email: '\\${node.validate-customer.cleanedData.email}',
                    name: '\\${node.validate-customer.cleanedData.name}'
                  }]
                }],
                from: {
                  email: 'welcome@company.com',
                  name: 'Customer Success Team'
                },
                subject: 'Welcome to Our Platform!',
                content: [{
                  type: 'text/html',
                  value: '\\${node.generate-welcome-message.welcomeMessage}'
                }]
              }
            },
            outputMapping: {
              emailSent: 'success',
              messageId: 'message_id'
            }
          }
        },
        {
          id: 'schedule-followup',
          type: 'tool',
          position: { x: 1100, y: 100 },
          data: {
            label: 'Schedule Follow-up',
            tool: 'scheduler',
            parameters: {
              workflowId: '\\${workflow.id}',
              schedule: 'in_3_days',
              input: {
                customerId: '\\${node.fetch-customer-profile.customerId}',
                followupType: 'check-in',
                accountType: '\\${input.accountType}',
                onboardingCompleted: true
              }
            },
            outputMapping: {
              followupScheduled: 'success',
              scheduleId: 'schedule.id'
            }
          }
        },
        {
          id: 'create-success-task',
          type: 'tool',
          position: { x: 1300, y: 100 },
          data: {
            label: 'Create Success Task',
            tool: 'noam_task_creator',
            parameters: {
              title: 'New Customer Onboarded: \\${node.validate-customer.cleanedData.name}',
              description: 'Review new customer onboarding and ensure successful setup',
              assignee: 'customer-success-team',
              priority: 'normal',
              context: {
                customerId: '\\${node.fetch-customer-profile.customerId}',
                customerName: '\\${node.validate-customer.cleanedData.name}',
                accountType: '\\${input.accountType}',
                onboardingDate: '\\${new Date().toISOString()}'
              }
            },
            outputMapping: {
              taskCreated: 'success',
              taskId: 'task.id'
            }
          }
        },
        {
          id: 'end',
          type: 'end',
          position: { x: 1500, y: 100 },
          data: {
            label: 'Onboarding Complete',
            description: 'Customer successfully onboarded'
          }
        }
      ],

      edges: [
        { id: 'e1', source: 'start', target: 'validate-customer' },
        { id: 'e2', source: 'validate-customer', target: 'fetch-customer-profile' },
        { id: 'e3', source: 'fetch-customer-profile', target: 'generate-welcome-message' },
        { id: 'e4', source: 'generate-welcome-message', target: 'send-welcome-email' },
        { id: 'e5', source: 'send-welcome-email', target: 'schedule-followup' },
        { id: 'e6', source: 'schedule-followup', target: 'create-success-task' },
        { id: 'e7', source: 'create-success-task', target: 'end' }
      ],

      configuration: {
        maxConcurrentExecutions: 10,
        timeoutMinutes: 20,
        retryPolicy: 'exponential',
        requiredEnvironment: [
          'SENDGRID_API_KEY',
          'CUSTOMER_API_KEY'
        ],
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            name: { type: 'string', minLength: 2 },
            accountType: { 
              type: 'string', 
              enum: ['premium', 'standard', 'trial'],
              default: 'standard'
            },
            phone: { type: 'string' },
            source: { 
              type: 'string',
              enum: ['website', 'mobile', 'referral', 'sales'],
              default: 'website'
            }
          },
          required: ['email', 'name', 'accountType']
        }
      },

      metadata: {
        tags: ['onboarding', 'customer-success', 'automation', 'welcome'],
        category: 'customer-service',
        complexity: 'medium',
        estimatedRuntime: '3-5 minutes',
        examples: [
          {
            name: 'Premium Customer Onboarding',
            description: 'Onboard a new premium customer',
            input: {
              email: 'john@company.com',
              name: 'John Smith',
              accountType: 'premium',
              phone: '+1234567890',
              source: 'sales'
            }
          },
          {
            name: 'Trial User Onboarding',
            description: 'Onboard a trial user from website',
            input: {
              email: 'trial@example.com',
              name: 'Trial User',
              accountType: 'trial',
              source: 'website'
            }
          }
        ]
      }
    };
  }

  async deployAllTemplates() {
    try {
      console.log('🌟 Universal Workflow Template Database Deployment');
      console.log('==================================================');
      console.log('💾 Saving workflow templates to database...');
      console.log('🔗 Preparing for Noam app integration...');

      const systemUser = await this.getSystemUser();
      
      // Create the third template
      const customerOnboardingTemplate = await this.createCustomerOnboardingTemplate();
      
      const templates = [
        callDeflectionTemplate,
        insightsTemplate,
        customerOnboardingTemplate
      ];

      for (const template of templates) {
        try {
          const savedTemplate = await this.saveTemplate(template, systemUser._id);
          this.deployedTemplates.push(savedTemplate);
        } catch (error) {
          console.error(`Failed to save ${template.templateId}:`, error.message);
        }
      }

      console.log('\n🎉 Deployment Summary');
      console.log('=====================');
      console.log(`✅ Successfully saved ${this.deployedTemplates.length} templates to database`);
      console.log('✅ Templates ready for Noam app import');
      console.log('✅ Universal endpoints configured');

      console.log('\n📊 Saved Templates:');
      this.deployedTemplates.forEach((template, index) => {
        console.log(`   ${index + 1}. ${template.name}`);
        console.log(`      ID: ${template._id}`);
        console.log(`      Template ID: ${template.templateId}`);
        console.log(`      Category: ${template.metadata.category}`);
        console.log(`      Nodes: ${template.metadata.nodeCount}`);
        console.log(`      Status: ${template.status}`);
      });

      console.log('\n🔗 Noam App Integration Endpoints:');
      console.log('===================================');

      console.log('\n1️⃣  Export All Templates for Noam:');
      console.log('   POST http://localhost:8000/api/templates/import/noam');
      console.log('   Body: {}');

      console.log('\n2️⃣  Export Specific Templates:');
      console.log('   POST http://localhost:8000/api/templates/import/noam');
      console.log('   Body: {');
      console.log('     "templateIds": ["' + this.deployedTemplates.map(t => t._id).join('", "') + '"]');
      console.log('   }');

      console.log('\n3️⃣  Get Individual ReactFlow Format:');
      this.deployedTemplates.forEach(template => {
        console.log(`   GET http://localhost:8000/api/templates/${template._id}/reactflow`);
      });

      console.log('\n🚀 Universal Execution Examples:');
      console.log('=================================');

      console.log('\n📞 Call Deflection:');
      console.log('   POST http://localhost:8000/api/universal/workflows/execute');
      console.log('   Body: {');
      console.log('     "templateId": "call-deflection-v1",');
      console.log('     "input": { "callTranscript": "Customer wants to cancel subscription" }');
      console.log('   }');

      console.log('\n📊 Business Insights:');
      console.log('   POST http://localhost:8000/api/universal/workflows/execute');
      console.log('   Body: {');
      console.log('     "templateId": "insights-analytics-v1",');
      console.log('     "input": { "reportType": "daily", "timeRange": "last_24h" }');
      console.log('   }');

      console.log('\n👋 Customer Onboarding:');
      console.log('   POST http://localhost:8000/api/universal/workflows/execute');
      console.log('   Body: {');
      console.log('     "templateId": "customer-onboarding-v1",');
      console.log('     "input": { "email": "new@customer.com", "name": "New Customer", "accountType": "premium" }');
      console.log('   }');

      console.log('\n💡 Reverse Engineering Plan:');
      console.log('=============================');
      console.log('1. Import templates into Noam app using export endpoints');
      console.log('2. Templates appear as ReactFlow canvases in Noam visual editor');
      console.log('3. Users can modify workflows visually in Noam');
      console.log('4. Modified workflows can be exported back to Universal Engine');
      console.log('5. No code changes needed - pure configuration approach!');

      return this.deployedTemplates;

    } catch (error) {
      console.error('❌ Template deployment failed:', error);
      throw error;
    }
  }

  async disconnect() {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

// Main execution
async function main() {
  const deployer = new TemplateDeploymentManager();
  
  try {
    await deployer.connect();
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

module.exports = TemplateDeploymentManager;