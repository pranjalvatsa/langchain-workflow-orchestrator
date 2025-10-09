const { Workflow, WorkflowTemplate } = require('../models');
const winston = require('winston');

class WorkflowTemplateService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/workflow-templates.log' })
      ]
    });
  }

  /**
   * Create the Customer Offer Prediction Workflow Template
   * 4-node workflow: Start → Customer API → LLM Prediction → Human Approval
   */
  async createCustomerOfferWorkflow(userId, workflowName = 'Customer Offer Prediction') {
    try {
      const workflowData = {
        name: workflowName,
        description: 'AI-powered customer offer prediction with human approval workflow',
        userId: userId,
        version: '1.0.0',
        tags: ['customer', 'ai', 'offers', 'human-approval'],
        nodes: [
          // 1. START NODE
          {
            id: 'start_node',
            type: 'trigger',
            position: { x: 100, y: 100 },
            data: {
              label: 'Start Workflow',
              description: 'Initialize customer offer prediction workflow',
              triggerConfig: {
                triggerType: 'manual',
                inputSchema: {
                  customerId: { type: 'string', required: true, description: 'Customer ID to analyze' },
                  assignee: { type: 'string', required: false, description: 'Task assignee for approval' }
                }
              }
            }
          },

          // 2. CUSTOMER DATA API NODE
          {
            id: 'customer_api_node',
            type: 'tool',
            position: { x: 300, y: 100 },
            data: {
              label: 'Fetch Customer Data',
              description: 'Retrieve customer purchase history and preferences',
              toolConfig: {
                toolName: 'customer_data_api',
                toolType: 'api',
                parameters: {
                  customerId: '{{inputs.customerId}}'
                },
                timeout: 30000,
                retryConfig: {
                  maxRetries: 3,
                  retryDelay: 2000
                }
              }
            }
          },

          // 3. LLM OFFER PREDICTION NODE
          {
            id: 'llm_prediction_node',
            type: 'agent',
            position: { x: 500, y: 100 },
            data: {
              label: 'AI Offer Prediction',
              description: 'Generate personalized offer recommendations using AI',
              agentConfig: {
                model: 'gpt-4',
                provider: 'openai',
                temperature: 0.3,
                maxTokens: 1500,
                systemPrompt: `You are an expert e-commerce recommendation engine. Analyze customer data and generate personalized offer predictions.

INSTRUCTIONS:
1. Analyze the customer's purchase history, preferences, and spending patterns
2. Identify the next best offer based on their behavior
3. Provide a confidence score (0.0 to 1.0) for your recommendation
4. Include reasoning for your recommendation
5. Suggest 2-3 alternative offers

RESPONSE FORMAT (JSON):
{
  "primaryOffer": {
    "product": "Product Name",
    "category": "Category",
    "discount": "X%",
    "originalPrice": 999.99,
    "offerPrice": 799.99,
    "reasoning": "Why this offer is recommended",
    "confidence": 0.85
  },
  "alternativeOffers": [
    {
      "product": "Alternative Product",
      "category": "Category", 
      "discount": "Y%",
      "confidence": 0.70
    }
  ],
  "customerInsights": {
    "spendingTier": "high/medium/low",
    "preferredCategory": "Category",
    "buyingFrequency": "frequent/occasional/rare",
    "pricesensitivity": "low/medium/high"
  }
}`,
                userPrompt: `Analyze this customer data and generate offer predictions:

Customer Data: {{customer_api_node.output.data}}

Please provide your recommendation in the specified JSON format.`,
                promptVariables: ['customer_api_node.output.data'],
                memoryEnabled: false
              }
            }
          },

          // 4. HUMAN APPROVAL NODE
          {
            id: 'human_approval_node',
            type: 'humanReview',
            position: { x: 700, y: 100 },
            data: {
              label: 'Human Approval',
              description: 'Create task in Noam app for human review and approval',
              humanReviewConfig: {
                reviewType: 'approval',
                timeout: 86400000, // 24 hours
                assignee: '{{inputs.assignee}}',
                taskConfig: {
                  taskTitle: 'Approve Customer Offer: {{inputs.customerId}}',
                  taskDescription: `Please review and approve/reject the AI-generated offer for customer {{inputs.customerId}}.

Customer Profile:
- Customer ID: {{inputs.customerId}}
- Total Spent: $` + '{{customer_api_node.output.data.metrics.totalSpent}}' + `
- Favorite Category: {{customer_api_node.output.data.metrics.favoriteCategory}}

AI Recommendation:
{{llm_prediction_node.output}}

Please review the offer and decide:
- APPROVE: If the offer is suitable for the customer
- REJECT: If the offer needs refinement`,
                  priority: 'medium',
                  data: {
                    customerId: '{{inputs.customerId}}',
                    customerData: '{{customer_api_node.output.data}}',
                    aiPrediction: '{{llm_prediction_node.output}}'
                  }
                }
              }
            }
          }
        ],

        // WORKFLOW CONNECTIONS
        edges: [
          {
            id: 'start_to_api',
            source: 'start_node',
            target: 'customer_api_node',
            type: 'default'
          },
          {
            id: 'api_to_llm',
            source: 'customer_api_node',
            target: 'llm_prediction_node',
            type: 'default',
            conditions: [
              {
                field: 'customer_api_node.output.success',
                operator: 'equals',
                value: true
              }
            ]
          },
          {
            id: 'llm_to_human',
            source: 'llm_prediction_node',
            target: 'human_approval_node',
            type: 'default'
          }
        ],

        // WORKFLOW CONFIGURATION
        configuration: {
          maxExecutionTime: 3600000, // 1 hour
          retryPolicy: {
            maxRetries: 2,
            retryDelay: 5000
          },
          errorHandling: {
            continueOnError: false,
            notifyOnFailure: true
          },
          variables: {
            customerId: {
              type: 'string',
              required: true,
              description: 'Customer ID to generate offers for'
            },
            assignee: {
              type: 'string',
              required: false,
              description: 'User assigned to approve the task'
            }
          }
        },

        // WORKFLOW METADATA
        metadata: {
          category: 'customer-engagement',
          useCase: 'offer-prediction',
          integrations: ['noam-app', 'openai'],
          estimatedRunTime: '5-30 minutes',
          requiredPermissions: ['customer.read', 'task.create'],
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };

      // Create the workflow
      const workflow = new Workflow(workflowData);
      await workflow.save();

      this.logger.info(`Customer offer workflow created: ${workflow._id}`);
      
      return workflow;
    } catch (error) {
      this.logger.error('Error creating customer offer workflow:', error);
      throw error;
    }
  }

  /**
   * Get predefined workflow templates
   */
  async getWorkflowTemplates() {
    try {
      const templates = [
        {
          id: 'customer-offer-prediction',
          name: 'Customer Offer Prediction',
          description: 'AI-powered customer offer prediction with human approval',
          category: 'customer-engagement',
          nodes: 4,
          estimatedTime: '5-30 minutes',
          requiredIntegrations: ['OpenAI', 'Noam App'],
          tags: ['ai', 'customer', 'offers', 'approval']
        },
        {
          id: 'customer-sentiment-analysis',
          name: 'Customer Sentiment Analysis',
          description: 'Analyze customer feedback and generate response recommendations',
          category: 'customer-support',
          nodes: 3,
          estimatedTime: '2-10 minutes',
          requiredIntegrations: ['OpenAI'],
          tags: ['ai', 'sentiment', 'support']
        },
        {
          id: 'lead-qualification',
          name: 'Lead Qualification Workflow',
          description: 'Score and qualify leads using AI with sales team approval',
          category: 'sales',
          nodes: 5,
          estimatedTime: '10-60 minutes',
          requiredIntegrations: ['OpenAI', 'CRM', 'Noam App'],
          tags: ['ai', 'sales', 'leads', 'qualification']
        }
      ];

      return templates;
    } catch (error) {
      this.logger.error('Error getting workflow templates:', error);
      throw error;
    }
  }

  /**
   * Create workflow from template
   */
  async createFromTemplate(templateId, userId, customization = {}) {
    try {
      switch (templateId) {
        case 'customer-offer-prediction':
          return await this.createCustomerOfferWorkflow(
            userId, 
            customization.name || 'Customer Offer Prediction'
          );
        
        default:
          throw new Error(`Template not found: ${templateId}`);
      }
    } catch (error) {
      this.logger.error('Error creating workflow from template:', error);
      throw error;
    }
  }
}

module.exports = WorkflowTemplateService;