const axios = require('axios');

// Complex workflow: Start → AI Analysis → Human Review → Final Report → End
const complexWorkflowTemplate = {
  name: "Complex Document Review Workflow",
  description: "Multi-stage document processing with human review checkpoint",
  version: { major: 1, minor: 0, patch: 0 },
  tags: ["document-processing", "human-review", "multi-stage"],
  nodes: [
    {
      id: "start-1",
      type: "start",
      position: { x: 100, y: 100 },
      data: {
        label: "Start Process",
        description: "Initialize document review process"
      }
    },
    {
      id: "ai-analyzer-2",
      type: "llm",
      position: { x: 300, y: 100 },
      data: {
        label: "AI Document Analysis",
        description: "Analyze document content and extract key information",
        model: "gpt-4o-mini",
        temperature: 0.3,
        maxTokens: 800,
        systemPrompt: "You are an expert document analyzer. Analyze the provided document and extract key insights, risks, and recommendations.",
        userPrompt: "Analyze this document for: {{documentType}}\n\nDocument Content: {{documentContent}}\nCompany: {{companyName}}\nValue: ${{documentValue}}\n\nProvide:\n1. Key findings and insights\n2. Risk assessment\n3. Compliance check\n4. Recommendations\n5. Summary of critical points that require human review\n\nFormat your response as a structured analysis report."
      }
    },
    {
      id: "human-review-3",
      type: "human_review",
      position: { x: 500, y: 100 },
      data: {
        label: "Human Review & Approval",
        description: "Review AI analysis and approve/reject the document",
        reviewPrompt: "Please review the AI analysis results and make a decision",
        reviewInstructions: "Carefully review the AI analysis, risk assessment, and recommendations. Approve if acceptable, reject if issues found.",
        externalTask: {
          enabled: true,
          apiConfig: {
            endpoint: "https://noam-vision-backend.onrender.com/api/tasks",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": "Bearer {{NOAM_API_TOKEN}}"
            },
            body: {
              title: "Document Review Required: {{companyName}}",
              description: "AI analysis completed for {{documentType}}. Document value: ${{documentValue}}. Please review the analysis and approve or reject.",
              role_id: "d1a3f53a-c4fd-4eda-a283-97618057b4ea",
              data: {
                nodeId: "human-review-3",
                executionId: "{{executionId}}",
                companyName: "{{companyName}}",
                documentType: "{{documentType}}",
                documentValue: "{{documentValue}}",
                workflowType: "document_review",
                aiAnalysis: "{{ai-analyzer-2_output}}"
              }
            }
          }
        }
      }
    },
    {
      id: "final-processor-4",
      type: "llm",
      position: { x: 700, y: 100 },
      data: {
        label: "Final Report Generator",
        description: "Generate final comprehensive report based on AI analysis and human approval",
        model: "gpt-4o-mini",
        temperature: 0.2,
        maxTokens: 1000,
        systemPrompt: "You are a professional report generator. Create a comprehensive final report based on the AI analysis and human review decision.",
        userPrompt: "Generate a final comprehensive report based on:\n\n**Document Details:**\n- Company: {{companyName}}\n- Document Type: {{documentType}}\n- Value: ${{documentValue}}\n\n**AI Analysis Results:**\n{{ai-analyzer-2_output}}\n\n**Human Review Decision:**\n- Approved: {{human-review-3_approved}}\n- Review Notes: {{human-review-3_reviewNotes}}\n- Reviewed At: {{human-review-3_reviewedAt}}\n\nCreate a professional final report that includes:\n1. Executive Summary\n2. Document Analysis Summary\n3. Review Decision and Rationale\n4. Next Steps and Recommendations\n5. Compliance Status\n6. Final Approval Status\n\nFormat as a formal business report with clear sections and professional language."
      }
    },
    {
      id: "end-5",
      type: "end",
      position: { x: 900, y: 100 },
      data: {
        label: "Process Complete",
        description: "Document review workflow completed"
      }
    }
  ],
  edges: [
    {
      id: "e1-2",
      source: "start-1",
      target: "ai-analyzer-2",
      type: "smoothstep"
    },
    {
      id: "e2-3",
      source: "ai-analyzer-2",
      target: "human-review-3",
      type: "smoothstep"
    },
    {
      id: "e3-4",
      source: "human-review-3",
      target: "final-processor-4",
      type: "smoothstep"
    },
    {
      id: "e4-5",
      source: "final-processor-4",
      target: "end-5",
      type: "smoothstep"
    }
  ],
  settings: {
    concurrency: 1,
    maxRetries: 3,
    retryDelay: 5000,
    timeout: 300000,
    environment: "development"
  }
};

// Create the workflow template
async function createComplexWorkflow() {
  try {
    console.log('Creating complex document review workflow...');
    
    const response = await axios.post(
      'https://langchain-workflow-orchestrator.onrender.com/api/workflows/templates',
      complexWorkflowTemplate,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': 'lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622'
        }
      }
    );

    console.log('✅ Complex workflow created successfully!');
    console.log('Workflow ID:', response.data.data.workflow._id);
    console.log('Template ID:', response.data.data.template._id);
    
    return {
      workflowId: response.data.data.workflow._id,
      templateId: response.data.data.template._id
    };
    
  } catch (error) {
    console.error('❌ Error creating workflow:', error.response?.data || error.message);
    throw error;
  }
}

// Execute the workflow creation
createComplexWorkflow()
  .then(result => {
    console.log('\n🎯 Next Steps:');
    console.log('1. Execute the workflow using the CURL command provided');
    console.log('2. Check status to confirm workflow pauses at human review');
    console.log('3. Approve via webhook to test resume functionality');
    console.log('4. Verify final node executes after approval');
    console.log('\nWorkflow Details:', result);
  })
  .catch(error => {
    console.error('Failed to create workflow:', error);
    process.exit(1);
  });