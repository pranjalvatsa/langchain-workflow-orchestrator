/**
 * Sample Human Review Workflow Creation Script
 * Creates a workflow that demonstrates the human review functionality with NOAM integration
 */

const humanReviewWorkflowPayload = {
  "templateId": "contract-approval-workflow-v1",
  "name": "Contract Approval Workflow V1",
  "description": "AI-generated contract with human approval via NOAM tasks",
  "category": "automation",
  "version": "1.0.0",
  "nodes": JSON.stringify([
    {
      "id": "start-1",
      "type": "start",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Contract Request",
        "description": "Workflow starts with contract parameters",
        "parameters": {
          "clientName": {
            "type": "string",
            "required": true,
            "description": "Name of the client"
          },
          "contractType": {
            "type": "string",
            "required": true,
            "description": "Type of contract (service, product, etc.)"
          },
          "value": {
            "type": "number",
            "required": true,
            "description": "Contract value in USD"
          }
        }
      }
    },
    {
      "id": "ai-contract-generator-2",
      "type": "llm",
      "position": {"x": 350, "y": 100},
      "data": {
        "label": "AI Contract Generator",
        "description": "Generate contract using AI based on parameters",
        "tool": "llm_chat",
        "parameters": {
          "model": "gpt-4o-mini",
          "temperature": 0.3,
          "maxTokens": 1000,
          "systemPrompt": "You are a legal contract specialist. Generate professional contracts based on the provided parameters.",
          "userPrompt": "Generate a {{contractType}} contract for client {{clientName}} with value ${{value}}. Include standard terms, deliverables, and payment schedule. Make it professional and legally sound."
        }
      }
    },
    {
      "id": "human-review-3",
      "type": "human_review",
      "position": {"x": 600, "y": 100},
      "data": {
        "label": "Manager Approval",
        "description": "Human review of AI-generated contract via NOAM",
        "reviewType": "approval",
        "instructions": "Please review the AI-generated contract for {{clientName}}. Check for accuracy, completeness, and compliance with company policies.",
        "reviewData": {
          "clientName": "{{clientName}}",
          "contractType": "{{contractType}}",
          "contractValue": "{{value}}",
          "generatedContract": "{{ai-contract-generator-2}}"
        },
        "externalTask": {
          "enabled": true,
          "endpoint": "https://noam-vision-backend.onrender.com/api/tasks",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer YOUR_NOAM_API_TOKEN",
            "Content-Type": "application/json"
          },
          "body": {
            "roleId": "d1a3f53a-c4fd-4eda-a283-97618057b4ea",
            "title": "Contract Approval Required: {{clientName}}",
            "description": "AI-generated {{contractType}} contract needs approval. Contract value: ${{value}}. Please review the generated contract and approve or reject.",
            "data": {
              "workflowType": "contract_approval",
              "clientName": "{{clientName}}",
              "contractType": "{{contractType}}",
              "contractValue": "{{value}}",
              "generatedContract": "{{ai-contract-generator-2}}",
              "executionId": "{{executionId}}",
              "nodeId": "human-review-3"
            }
          }
        }
      }
    },
    {
      "id": "contract-finalization-4",
      "type": "llm",
      "position": {"x": 850, "y": 100},
      "data": {
        "label": "Contract Finalization",
        "description": "Finalize approved contract with timestamps and signatures",
        "tool": "llm_chat",
        "parameters": {
          "model": "gpt-4o-mini",
          "temperature": 0.1,
          "maxTokens": 500,
          "systemPrompt": "You are a contract finalization specialist. Add final touches to approved contracts.",
          "userPrompt": "Finalize this approved contract: {{ai-contract-generator-2}}. Add today's date, approval timestamp, and signature blocks for both parties. Client: {{clientName}}, Company: [Company Name]."
        }
      }
    },
    {
      "id": "response-5",
      "type": "end",
      "position": {"x": 1100, "y": 100},
      "data": {
        "label": "Final Contract",
        "description": "Return the approved and finalized contract",
        "output": {
          "clientName": "{{clientName}}",
          "contractType": "{{contractType}}",
          "contractValue": "{{value}}",
          "finalContract": "{{contract-finalization-4}}",
          "approvedBy": "Manager",
          "approvedAt": "{{timestamp}}",
          "status": "approved_and_finalized"
        }
      }
    }
  ]),
  "edges": JSON.stringify([
    {"id": "e1-2", "source": "start-1", "target": "ai-contract-generator-2"},
    {"id": "e2-3", "source": "ai-contract-generator-2", "target": "human-review-3"},
    {"id": "e3-4", "source": "human-review-3", "target": "contract-finalization-4"},
    {"id": "e4-5", "source": "contract-finalization-4", "target": "response-5"}
  ]),
  "configuration": {
    "maxConcurrentExecutions": 3,
    "timeoutMinutes": 60,
    "retryPolicy": "exponential"
  },
  "tags": ["contracts", "human-review", "approval", "noam", "ai"],
  "complexity": "high",
  "isPublic": true
};

console.log('=== Human Review Workflow Template ===');
console.log('');
console.log('🚀 CURL Command to Create Template:');
console.log('');
console.log(`curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/templates/save-from-universal" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622" \\
  -d '${JSON.stringify(humanReviewWorkflowPayload, null, 2)}'`);
console.log('');
console.log('📋 CURL Command to Execute Workflow:');
console.log('');
console.log(`curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/universal/workflows/execute" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622" \\
  -d '{
    "templateId": "contract-approval-workflow-v1",
    "input": {
      "clientName": "Tech Startup Inc",
      "contractType": "service",
      "value": 50000
    },
    "metadata": {
      "testRun": true,
      "description": "Testing human review workflow with NOAM integration"
    }
  }'`);
console.log('');
console.log('🔄 CURL Command to Simulate NOAM Approval Response:');
console.log('');
console.log(`curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/webhooks/human-review/{executionId}/human-review-3" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskId": "noam_task_12345",
    "action": "approve",
    "reviewedBy": "manager@company.com",
    "comments": "Contract looks good, approved for finalization",
    "taskData": {
      "reviewDuration": "15 minutes",
      "reviewedSections": ["terms", "pricing", "deliverables"]
    }
  }'`);
console.log('');
console.log('❌ CURL Command to Simulate NOAM Rejection Response:');
console.log('');
console.log(`curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/webhooks/human-review/{executionId}/human-review-3" \\
  -H "Content-Type: application/json" \\
  -d '{
    "taskId": "noam_task_12345",
    "action": "reject",
    "comments": "Contract terms need revision - pricing is too low for scope",
    "reviewedBy": "manager@company.com",
    "taskData": {
      "reviewDuration": "10 minutes",
      "issuesFound": ["pricing", "scope_mismatch"]
    }
  }'`);
console.log('');
console.log('💡 Workflow Flow:');
console.log('1. Start with contract parameters (client, type, value)');
console.log('2. AI generates contract using GPT-4');
console.log('3. 🔄 PAUSE: Create NOAM task for human approval');
console.log('4. Human reviews via NOAM interface');
console.log('5. NOAM sends webhook with approve/reject decision');
console.log('6. ✅ If approved: AI finalizes contract → Complete');
console.log('   ❌ If rejected: Workflow stops');
console.log('');