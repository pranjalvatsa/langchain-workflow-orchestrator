const axios = require('axios');

// Create a working complex workflow by modifying the successful contract workflow
async function createWorkingComplexWorkflow() {
  console.log('Creating working complex workflow...');

  const workflowData = {
    "name": "Document Review with Final Processing V3",
    "description": "Document analysis → Human review → Final report generation",
    "version": { "major": 1, "minor": 0, "patch": 0 },
    "tags": ["document-review", "human-approval", "final-step"],
    "nodes": [
      {
        "id": "start-1",
        "type": "start",
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Start Document Process",
          "description": "Initialize document review workflow"
        }
      },
      {
        "id": "ai-document-analyzer-2",
        "type": "llm",
        "position": { "x": 300, "y": 100 },
        "data": {
          "label": "AI Document Analysis",
          "description": "Analyze document content for risks and compliance",
          "model": "gpt-4o-mini",
          "temperature": 0.3,
          "maxTokens": 700,
          "systemPrompt": "You are an expert legal document analyzer. Review documents thoroughly and provide detailed analysis including risks, compliance, and recommendations.",
          "userPrompt": "Analyze this {{documentType}} for {{companyName}} (Value: ${{documentValue}}).\n\nDocument Content: {{documentContent}}\n\nProvide comprehensive analysis including:\n1. Key findings and terms\n2. Risk assessment \n3. Compliance considerations\n4. Recommendations\n5. Critical points requiring human review"
        }
      },
      {
        "id": "human-approval-3",
        "type": "human_review",
        "position": { "x": 500, "y": 100 },
        "data": {
          "label": "Human Review & Decision",
          "description": "Human review of AI analysis and approval decision",
          "reviewPrompt": "Please review the AI document analysis and make your approval decision",
          "reviewInstructions": "Review the AI analysis carefully. Consider risks, compliance issues, and recommendations before approving or rejecting.",
          "externalTask": {
            "enabled": true,
            "apiConfig": {
              "endpoint": "https://noam-vision-backend.onrender.com/api/tasks",
              "method": "POST",
              "headers": {
                "Content-Type": "application/json",
                "Authorization": "Bearer {{NOAM_API_TOKEN}}"
              },
              "body": {
                "title": "Document Approval Required: {{companyName}}",
                "description": "AI analysis completed for {{documentType}} worth ${{documentValue}}. Please review the analysis and approve or reject the document.",
                "role_id": "d1a3f53a-c4fd-4eda-a283-97618057b4ea",
                "data": {
                  "nodeId": "human-approval-3",
                  "executionId": "{{executionId}}",
                  "companyName": "{{companyName}}",
                  "documentType": "{{documentType}}",
                  "documentValue": "{{documentValue}}",
                  "workflowType": "document_approval",
                  "aiAnalysis": "{{ai-document-analyzer-2_output}}"
                }
              }
            }
          }
        }
      },
      {
        "id": "final-report-generator-4",
        "type": "llm",
        "position": { "x": 700, "y": 100 },
        "data": {
          "label": "Final Executive Report",
          "description": "Generate comprehensive final report based on AI analysis and human decision",
          "model": "gpt-4o-mini",
          "temperature": 0.1,
          "maxTokens": 800,
          "systemPrompt": "You are a professional business report writer. Create comprehensive executive reports that summarize analysis results and decisions.",
          "userPrompt": "Create a final executive report for the {{documentType}} review:\n\n**Company:** {{companyName}}\n**Document Type:** {{documentType}}\n**Document Value:** ${{documentValue}}\n\n**AI Analysis Results:**\n{{ai-document-analyzer-2_output}}\n\n**Human Review Decision:**\n- Approved: {{human-approval-3_approved}}\n- Review Notes: {{human-approval-3_reviewNotes}}\n- Reviewed At: {{human-approval-3_reviewedAt}}\n\nGenerate a comprehensive report including:\n1. Executive Summary\n2. Document Analysis Overview\n3. Key Findings and Risks\n4. Human Review Decision and Rationale\n5. Next Steps and Recommendations\n6. Final Approval Status\n\nFormat as a professional business report."
        }
      },
      {
        "id": "end-5",
        "type": "end",
        "position": { "x": 900, "y": 100 },
        "data": {
          "label": "Process Complete",
          "description": "Document review workflow completed"
        }
      }
    ],
    "edges": [
      {
        "id": "e1-2",
        "source": "start-1",
        "target": "ai-document-analyzer-2",
        "type": "smoothstep"
      },
      {
        "id": "e2-3",
        "source": "ai-document-analyzer-2",
        "target": "human-approval-3",
        "type": "smoothstep"
      },
      {
        "id": "e3-4",
        "source": "human-approval-3",
        "target": "final-report-generator-4",
        "type": "smoothstep"
      },
      {
        "id": "e4-5",
        "source": "final-report-generator-4",
        "target": "end-5",
        "type": "smoothstep"
      }
    ],
    "settings": {
      "concurrency": 1,
      "maxRetries": 3,
      "retryDelay": 5000,
      "timeout": 300000,
      "environment": "development"
    }
  };

  try {
    const response = await axios.post(
      'https://langchain-workflow-orchestrator.onrender.com/api/workflows',
      workflowData,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622'
        }
      }
    );

    console.log('✅ Complex workflow created successfully!');
    console.log('Workflow ID:', response.data.data.workflow._id);
    return response.data.data.workflow._id;

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

createWorkingComplexWorkflow()
  .then(workflowId => {
    console.log('\n🎯 Workflow created! ID:', workflowId);
    console.log('\n📋 CURL Commands for Testing:');
    console.log('\n1. Execute Workflow:');
    console.log(`curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/workflows/${workflowId}/execute" \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "X-API-Key: lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622" \\');
    console.log('  -d \'{\n    "companyName": "TechCorp Solutions",\n    "documentType": "acquisition agreement",\n    "documentContent": "ACQUISITION AGREEMENT between TechCorp Solutions as Acquirer and DataFlow Analytics as Target Company. Purchase price $15 million cash plus $5 million earnout based on 2026-2027 performance metrics. Key assets include proprietary ML algorithms, customer database of 500+ enterprise clients, and 45-person engineering team. Due diligence period 60 days with standard reps and warranties.",\n    "documentValue": "20000000",\n    "_metadata": {\n      "testRun": true,\n      "description": "Testing pause/resume functionality with final processing node",\n      "source": "test-complex-workflow"\n    }\n  }\'');
    
    console.log('\n2. Check Status (Replace {EXECUTION_ID}):');
    console.log('curl -X GET "https://langchain-workflow-orchestrator.onrender.com/api/executions/{EXECUTION_ID}" \\');
    console.log('  -H "X-API-Key: lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622"');
    
    console.log('\n3. Approve (Replace {EXECUTION_ID} and {TASK_ID}):');
    console.log('curl -X POST "https://langchain-workflow-orchestrator.onrender.com/api/webhooks/human-review/{EXECUTION_ID}/human-approval-3" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{\n    "taskId": "{TASK_ID}",\n    "action": "approve",\n    "reviewedBy": "senior.analyst@techcorp.com",\n    "comments": "Acquisition agreement analysis looks comprehensive. Risks are acceptable and due diligence period is adequate. Approved for finalization."\n  }\'');
  })
  .catch(error => {
    console.error('Failed to create workflow:', error);
    process.exit(1);
  });