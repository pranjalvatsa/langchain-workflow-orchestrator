const mongoose = require('mongoose');

const callDeflectionWorkflowTemplate = {
  name: "Call Deflection Workflow",
  description: "Automatically process incoming calls, classify intent, and route appropriately between auto-response and human escalation",
  category: "support",
  subcategory: "call_handling",
  tags: ["call-center", "automation", "customer-service", "ai-assistance"],
  
  templateId: "call-deflection-v1",
  version: {
    major: 1,
    minor: 0,
    patch: 0
  },
  
  // Workflow Definition
  nodes: [
    {
      id: "transcribe_trigger",
      type: "trigger", 
      position: { x: 100, y: 50 },
      data: {
        triggerConfig: {
          triggerType: "webhook",
          webhookPath: "/webhooks/call-transcription",
          expectedPayload: {
            callId: "string",
            transcription: "string", 
            callerInfo: "object",
            audioUrl: "string"
          }
        },
        label: "Call Transcription Received"
      }
    },
    {
      id: "intent_classification",
      type: "llm",
      position: { x: 100, y: 180 },
      data: {
        config: {
          prompt: `Analyze the following call transcription and classify the customer's intent. 

Call Transcription: "{{transcription}}"
Caller Information: {{callerInfo}}

Based on this call, determine if this is:
- RESOLVE: A simple question that can be answered automatically (order status, basic product info, simple billing questions)
- UNCERTAIN: A complex issue that requires human review (complaints, technical problems, refund requests, angry customers)

Consider factors like:
- Emotional tone (frustrated, angry, confused)
- Complexity of the request
- Whether standard information can resolve it
- If it involves account changes or sensitive issues

Respond with only one word: RESOLVE or UNCERTAIN`,
          temperature: 0.1,
          maxTokens: 10
        },
        model: "gpt-4",
        label: "Intent Classification"
      }
    },
    {
      id: "auto_response_agent",
      type: "llm", 
      position: { x: 50, y: 320 },
      data: {
        config: {
          prompt: `You are a helpful customer service agent. Based on the call transcription and customer information, provide a helpful, accurate, and empathetic response to resolve the customer's inquiry.

Call Transcription: "{{transcription}}"
Customer Information: {{callerInfo}}
Intent Classification: {{intent_classification_output}}

Guidelines:
- Be professional and empathetic
- Provide specific, actionable information
- If you mention order numbers or specific details, use the information provided
- Keep the response concise but complete
- End with an offer to help further if needed

Customer Service Response:`,
          temperature: 0.7,
          maxTokens: 300
        },
        model: "gpt-4",
        label: "Auto Response Generation"
      }
    },
    {
      id: "human_review",
      type: "humanReview",
      position: { x: 200, y: 320 },
      data: {
        humanReviewConfig: {
          taskConfig: {
            taskTitle: "Call Review Required - {{callerInfo.name || 'Customer'}}",
            taskDescription: "Please review this customer call and determine the appropriate response",
            data: {
              callId: "{{callId}}",
              transcription: "{{transcription}}",
              callerInfo: "{{callerInfo}}",
              classification: "{{intent_classification_output}}",
              timestamp: "{{metadata.webhookReceivedAt}}"
            },
            priority: "high"
          },
          timeout: 1800000 // 30 minutes
        },
        label: "Human Review"
      }
    },
    {
      id: "escalate_to_agent",
      type: "tool",
      position: { x: 280, y: 480 },
      data: {
        config: {
          toolName: "agent_escalation",
          input: {
            callId: "{{callId}}",
            transcription: "{{transcription}}",
            callerInfo: "{{callerInfo}}",
            priority: "high",
            reason: "Human review approved escalation",
            reviewResult: "{{human_review_output}}"
          }
        },
        label: "Escalate to Live Agent"
      }
    },
    {
      id: "send_auto_response",
      type: "tool",
      position: { x: 50, y: 480 },
      data: {
        config: {
          toolName: "call_response_api",
          input: {
            callId: "{{callId}}",
            response: "{{auto_response_agent_output}}",
            responseType: "automated"
          }
        },
        label: "Send Automated Response"
      }
    },
    {
      id: "send_human_response", 
      type: "tool",
      position: { x: 130, y: 480 },
      data: {
        config: {
          toolName: "call_response_api",
          input: {
            callId: "{{callId}}",
            response: "{{final_response}}",
            responseType: "human_reviewed"
          }
        },
        label: "Send Human-Reviewed Response"
      }
    }
  ],
  
  edges: [
    {
      id: "e1",
      source: "transcribe_trigger",
      target: "intent_classification",
      type: "default",
      data: {}
    },
    {
      id: "e2", 
      source: "intent_classification",
      target: "auto_response_agent",
      type: "conditional",
      condition: {
        type: "output_contains",
        value: "RESOLVE"
      },
      data: { label: "Simple Question" }
    },
    {
      id: "e3",
      source: "intent_classification",
      target: "human_review", 
      type: "conditional",
      condition: {
        type: "output_contains",
        value: "UNCERTAIN"
      },
      data: { label: "Complex Issue" }
    },
    {
      id: "e4",
      source: "auto_response_agent",
      target: "send_auto_response",
      type: "default",
      data: {}
    },
    {
      id: "e5",
      source: "human_review",
      target: "escalate_to_agent",
      type: "conditional",
      condition: {
        type: "output_contains",
        value: "escalate"
      },
      data: { label: "Escalate Decision" }
    },
    {
      id: "e6",
      source: "human_review", 
      target: "send_human_response",
      type: "conditional",
      condition: {
        type: "output_contains",
        value: "respond"
      },
      data: { label: "Respond Decision" }
    }
  ],
  
  // Template Configuration
  config: {
    requiredIntegrations: ["openai", "call_system", "agent_platform", "noam"],
    requiredPermissions: ["call_access", "agent_assignment", "human_review"],
    estimatedExecutionTime: 45000, // 45 seconds average
    complexity: "intermediate",
    industry: ["customer_service", "call_center", "support"],
    useCase: "call_deflection"
  },
  
  // Customizable Variables
  variables: [
    {
      name: "classification_confidence_threshold",
      type: "number",
      description: "Confidence threshold for auto-resolution (0.0 to 1.0)",
      defaultValue: 0.8,
      required: false,
      validation: {
        min: 0.1,
        max: 1.0
      }
    },
    {
      name: "escalation_priority",
      type: "string",
      description: "Priority level for agent escalation",
      defaultValue: "high",
      required: false,
      validation: {
        options: ["low", "medium", "high", "urgent"]
      }
    },
    {
      name: "human_review_timeout",
      type: "number", 
      description: "Timeout for human review in minutes",
      defaultValue: 30,
      required: false,
      validation: {
        min: 5,
        max: 120
      }
    },
    {
      name: "auto_response_max_tokens",
      type: "number",
      description: "Maximum tokens for auto-generated responses", 
      defaultValue: 300,
      required: false,
      validation: {
        min: 100,
        max: 500
      }
    },
    {
      name: "classification_model",
      type: "string",
      description: "AI model to use for intent classification",
      defaultValue: "gpt-4",
      required: false,
      validation: {
        options: ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"]
      }
    }
  ],
  
  // Documentation
  documentation: {
    overview: `The Call Deflection Workflow automatically processes incoming customer calls by:
1. Receiving call transcriptions via webhook
2. Using AI to classify the intent as simple (auto-resolvable) or complex
3. For simple questions: Generate and send automated responses
4. For complex issues: Route to human review with escalation options
5. Providing appropriate responses or agent escalation based on decisions`,
    
    prerequisites: [
      "OpenAI API key configured",
      "Call system integration for receiving transcriptions",
      "Agent platform integration for escalations", 
      "Noam app for human review tasks",
      "Webhook endpoint configured for call transcriptions"
    ],
    
    setupInstructions: `1. Configure environment variables:
   - OPENAI_API_KEY: Your OpenAI API key
   - CALL_DEFLECTION_WORKFLOW_ID: Set to 'call-deflection-v1'
   - NOAM_APP_URL: URL of your Noam app for task links

2. Set up webhook endpoint:
   - Configure your call system to POST transcriptions to /api/webhooks/call-transcription
   - Include callId, transcription, and callerInfo in the payload

3. Configure integrations:
   - Set up agent platform API for escalations
   - Configure call response system API
   - Connect Noam app for human review tasks

4. Test the workflow:
   - Use /api/webhooks/call-test endpoint with different scenarios
   - Monitor execution logs and adjust thresholds as needed`,
    
    usageGuide: `The workflow is triggered automatically when a call transcription is received via webhook.

Input Format:
{
  "callId": "unique-call-identifier",
  "transcription": "customer speech converted to text",
  "callerInfo": {
    "phone": "+1234567890",
    "customerId": "CUST_001", 
    "name": "John Doe",
    "tier": "gold"
  },
  "audioUrl": "optional-link-to-audio-file",
  "metadata": {}
}

The workflow will:
- Classify the intent automatically
- Route simple questions to auto-response
- Route complex issues to human review
- Generate appropriate responses or escalate to agents
- Provide status updates via the call status endpoint`,
    
    troubleshooting: `Common Issues:

1. Classification Accuracy:
   - Adjust classification prompts for your domain
   - Lower confidence threshold for more human reviews
   - Add domain-specific examples to prompts

2. Human Review Timeouts:
   - Increase timeout values in workflow variables
   - Set up monitoring alerts for pending tasks
   - Configure backup escalation procedures

3. Integration Failures:
   - Check API credentials and endpoints
   - Verify webhook payload formats
   - Monitor tool execution logs for errors

4. Response Quality:
   - Fine-tune response generation prompts
   - Adjust temperature and token limits
   - Add customer-specific context to responses`,
    
    examples: [
      {
        title: "Simple Order Status Inquiry",
        description: "Customer asking about delivery status",
        configuration: {
          scenario: "simple_question",
          expectedFlow: "transcribe → classify (RESOLVE) → auto_response → send_response",
          sampleInput: {
            transcription: "Hi, I placed an order yesterday and wanted to check when it will be delivered. My order number is 12345."
          }
        }
      },
      {
        title: "Complex Refund Request", 
        description: "Customer requesting refund with complaint",
        configuration: {
          scenario: "complex_issue",
          expectedFlow: "transcribe → classify (UNCERTAIN) → human_review → escalate_to_agent",
          sampleInput: {
            transcription: "I received my order but the product is completely different from what I ordered. I need a refund and want to speak to a manager."
          }
        }
      }
    ]
  },
  
  // Metadata
  isPublic: true,
  featured: true,
  author: "LangChain Workflow Team",
  authorEmail: "support@langchain-workflows.com",
  createdAt: new Date(),
  updatedAt: new Date()
};

module.exports = callDeflectionWorkflowTemplate;