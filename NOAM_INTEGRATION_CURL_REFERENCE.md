# 🔗 Universal Workflow Engine - Complete cURL API Reference for Noam Integration

This document provides comprehensive cURL examples for all API endpoints in the Universal Workflow Engine, ready for Noam integration.

## 🔑 **Authentication**

All endpoints require API key authentication using the `X-API-Key` header:

```bash
# Your production API key
export API_KEY="lwo_5c73d37ba4a2843408fc231508ee0f2f_55644d7ad59d2bc1abed33e5a17f34f3fdd03a0206e954259979fa6d4722d622"
export BASE_URL="https://langchain-workflow-orchestrator.onrender.com/api"
```

---

## 🚀 **Universal Workflow Engine Endpoints**

### **1. Execute Any Workflow**
Execute workflows by template ID or workflow ID.

```bash
# Execute Call Deflection Workflow
curl -X POST ${BASE_URL}/universal/workflows/execute \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "call-deflection-v1",
    "input": {
      "callTranscript": "Customer is frustrated about billing charges",
      "customerPhone": "+1234567890",
      "callerInfo": {
        "name": "John Doe",
        "accountId": "ACC123"
      }
    },
    "metadata": {
      "source": "noam-app",
      "priority": "high"
    }
  }'

# Execute Business Insights Workflow  
curl -X POST ${BASE_URL}/universal/workflows/execute \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "input": {
      "reportType": "daily",
      "timeRange": "last_24h",
      "recipients": ["team@company.com"],
      "format": "pdf"
    }
  }'

# Execute Custom Workflow
curl -X POST ${BASE_URL}/universal/workflows/execute \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "workflow-custom-123",
    "input": {
      "message": "Hello from Noam",
      "timestamp": "2025-10-03T12:00:00Z"
    },
    "variables": {
      "environment": "production",
      "debug": false
    }
  }'
```

### **2. Schedule Workflows**
Schedule workflows to run at specific times or intervals.

```bash
# Schedule Daily Report
curl -X POST ${BASE_URL}/universal/workflows/schedule \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "schedule": "daily@09:00",
    "input": {
      "reportType": "daily",
      "recipients": ["manager@company.com"]
    },
    "timezone": "America/New_York",
    "enabled": true
  }'

# Schedule Weekly Business Review
curl -X POST ${BASE_URL}/universal/workflows/schedule \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "business-review-v1", 
    "schedule": "weekly@monday@14:00",
    "input": {
      "period": "weekly",
      "includeMetrics": true
    }
  }'

# Schedule with Cron Expression
curl -X POST ${BASE_URL}/universal/workflows/schedule \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "monitoring-check-v1",
    "schedule": "*/15 * * * *",
    "input": {
      "checkType": "health",
      "services": ["api", "database"]
    }
  }'
```

### **3. Trigger Workflows by Events**
Trigger workflows based on events (webhook-style).

```bash
# Trigger on Call Transcription Event
curl -X POST ${BASE_URL}/universal/workflows/trigger \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "call_transcription",
    "data": {
      "callId": "call_789",
      "transcript": "Customer complaint about billing issue",
      "phoneNumber": "+1234567890",
      "duration": 180
    },
    "source": "phone_system"
  }'

# Trigger on Customer Signup
curl -X POST ${BASE_URL}/universal/workflows/trigger \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "new_customer_signup",
    "data": {
      "customerId": "CUST_456",
      "email": "newcustomer@company.com",
      "plan": "premium",
      "signupSource": "website"
    }
  }'

# Trigger Data Analysis Request
curl -X POST ${BASE_URL}/universal/workflows/trigger \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "data_request",
    "data": {
      "requestId": "REQ_789",
      "dataType": "sales",
      "dateRange": "2025-09-01:2025-09-30",
      "requester": "analyst@company.com"
    }
  }'
```

### **4. Get Available Tools**
List all tools available in the Universal Engine.

```bash
# Get All Available Tools
curl -X GET ${BASE_URL}/universal/tools \
  -H "X-API-Key: ${API_KEY}"
```

---

## 📋 **Template Management**

### **5. List Workflow Templates**
Get available workflow templates with filtering.

```bash
# Get All Templates
curl -X GET ${BASE_URL}/templates \
  -H "X-API-Key: ${API_KEY}"

# Filter by Category
curl -X GET "${BASE_URL}/templates?category=analytics&public=true&limit=10" \
  -H "X-API-Key: ${API_KEY}"

# Search Templates
curl -X GET "${BASE_URL}/templates?search=call%20deflection&status=published" \
  -H "X-API-Key: ${API_KEY}"

# Filter by Tags
curl -X GET "${BASE_URL}/templates?tags=customer-service,automation" \
  -H "X-API-Key: ${API_KEY}"
```

### **6. Import Workflow from Noam (ReactFlow Canvas)**
Import workflows created in Noam's ReactFlow canvas.

```bash
# Import Simple Workflow from Noam
curl -X POST ${BASE_URL}/templates/import/reactflow \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "name": "Customer Support Automation",
      "description": "AI-powered support ticket routing created in Noam",
      "category": "customer-service",
      "nodes": [
        {
          "id": "trigger-1",
          "type": "input",
          "position": {"x": 100, "y": 100},
          "data": {
            "label": "New Support Ticket",
            "parameters": {
              "ticketId": "string",
              "customerEmail": "string", 
              "issue": "string",
              "priority": "string"
            }
          }
        },
        {
          "id": "llm-1",
          "type": "api", 
          "position": {"x": 300, "y": 100},
          "data": {
            "label": "Analyze Issue",
            "tool": "llm_chat",
            "parameters": {
              "model": "gpt-3.5-turbo",
              "prompt": "Analyze this support ticket and categorize: {{issue}}",
              "temperature": 0.3
            }
          }
        },
        {
          "id": "human-1",
          "type": "human",
          "position": {"x": 500, "y": 100},
          "data": {
            "label": "Human Review",
            "tool": "human_review", 
            "parameters": {
              "assignee": "support-team@company.com",
              "timeout": 86400000,
              "escalationRules": ["high_priority", "complex_issue"]
            }
          }
        }
      ],
      "edges": [
        {
          "id": "e1-2",
          "source": "trigger-1",
          "target": "llm-1",
          "label": "Process"
        },
        {
          "id": "e2-3",
          "source": "llm-1", 
          "target": "human-1",
          "label": "Review"
        }
      ]
    },
    "noamMetadata": {
      "noamWorkflowId": "noam-workflow-support-123",
      "noamUserId": "user-456",
      "noamAccountId": "account-789"
    }
  }'

# Import Lead Qualification Workflow
curl -X POST ${BASE_URL}/templates/import/reactflow \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "name": "Lead Qualification Pipeline",
      "description": "Automated lead scoring and routing",
      "category": "sales",
      "nodes": [
        {
          "id": "webhook-1",
          "type": "input",
          "position": {"x": 50, "y": 50},
          "data": {
            "label": "Lead Webhook",
            "tool": "webhook",
            "parameters": {
              "source": "website_form"
            }
          }
        },
        {
          "id": "api-1",
          "type": "api",
          "position": {"x": 200, "y": 50},
          "data": {
            "label": "Enrich Data",
            "tool": "api_call",
            "parameters": {
              "url": "https://api.clearbit.com/v2/people/find",
              "method": "GET",
              "headers": {"Authorization": "Bearer {{CLEARBIT_API_KEY}}"}
            }
          }
        },
        {
          "id": "llm-2",
          "type": "api",
          "position": {"x": 350, "y": 50},
          "data": {
            "label": "Score Lead",
            "tool": "llm_chat",
            "parameters": {
              "prompt": "Score this lead 1-10 based on: {{enrichedData}}"
            }
          }
        }
      ],
      "edges": [
        {"id": "e1", "source": "webhook-1", "target": "api-1"},
        {"id": "e2", "source": "api-1", "target": "llm-2"}
      ]
    },
    "noamMetadata": {
      "noamWorkflowId": "noam-lead-pipeline-456",
      "noamUserId": "sales-user-123",
      "noamAccountId": "account-789"
    }
  }'
```

### **7. Export Templates to Noam**
Export Universal Engine templates for visual editing in Noam.

```bash
# Export Specific Templates to Noam
curl -X POST ${BASE_URL}/templates/import/noam \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": ["call-deflection-v1", "insights-analytics-v1"],
    "includePrivate": false
  }'

# Export by Category
curl -X POST ${BASE_URL}/templates/import/noam \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "category": "customer-service",
    "includePrivate": true
  }'

# Export All Public Templates
curl -X POST ${BASE_URL}/templates/import/noam \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "includePrivate": false
  }'
```

---

## 🔔 **Webhooks & Notifications**

### **8. Send Task Notifications to Noam**
Send workflow execution updates to Noam for task management.

```bash
# Workflow Started Notification
curl -X POST ${BASE_URL}/webhooks/noam/task-notifications \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "exec-abc123",
    "workflowId": "workflow-def456", 
    "templateId": "call-deflection-v1",
    "noamWorkflowId": "noam-workflow-123",
    "status": "started",
    "taskData": {
      "title": "Call Deflection - Processing",
      "description": "Analyzing customer call for deflection opportunities",
      "priority": "high",
      "assignee": "support-team@company.com",
      "inputs": {
        "callTranscript": "Customer complaint about billing"
      }
    },
    "noamAccountId": "account-789",
    "noamUserId": "user-456"
  }'

# Workflow Completed Notification
curl -X POST ${BASE_URL}/webhooks/noam/task-notifications \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "exec-abc123",
    "noamWorkflowId": "noam-workflow-123",
    "status": "completed",
    "taskData": {
      "title": "Call Deflection - Completed",
      "description": "Call successfully processed and response sent"
    },
    "outputs": {
      "recommendation": "escalate_to_billing_team",
      "confidence": 0.87,
      "response_sent": true
    }
  }'

# Workflow Failed Notification
curl -X POST ${BASE_URL}/webhooks/noam/task-notifications \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "exec-abc123",
    "noamWorkflowId": "noam-workflow-123", 
    "status": "failed",
    "taskData": {
      "title": "Workflow Failed",
      "description": "Workflow execution encountered an error",
      "error": "API timeout"
    }
  }'
```

---

## 🔑 **API Key Management**

### **9. Generate New API Keys**
Generate additional API keys for different Noam environments.

```bash
# Generate API Key for Noam Development
curl -X POST ${BASE_URL}/keys/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Noam Development Key",
    "description": "API key for Noam development environment",
    "noamAccountId": "noam_dev_account",
    "expiresIn": "6m"
  }'

# Generate API Key for Noam Production
curl -X POST ${BASE_URL}/keys/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Noam Production Key",
    "description": "API key for Noam production environment",
    "noamAccountId": "noam_prod_account",
    "expiresIn": "1y",
    "rateLimit": {
      "requestsPerMinute": 2000,
      "requestsPerHour": 20000,
      "requestsPerDay": 200000
    }
  }'
```

### **10. List API Keys**
Get information about existing API keys.

```bash
# List All API Keys
curl -X GET ${BASE_URL}/keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🧪 **Testing & Validation**

### **11. Health Check**
Verify the Universal Workflow Engine is running.

```bash
# Health Check
curl -X GET https://langchain-workflow-orchestrator.onrender.com/health

# Expected Response:
# {
#   "status": "ok",
#   "message": "LangChain Backend is running", 
#   "timestamp": "2025-10-03T12:00:00.000Z",
#   "version": "1.0.0"
# }
```

### **12. Authentication Test**
Test API key authentication.

```bash
# Test Valid API Key
curl -X GET ${BASE_URL}/universal/tools \
  -H "X-API-Key: ${API_KEY}"

# Test Invalid API Key (should return 401)
curl -X GET ${BASE_URL}/universal/tools \
  -H "X-API-Key: invalid_key_test"

# Test Missing API Key (should return 401)
curl -X GET ${BASE_URL}/universal/tools
```

---

## 📊 **Response Formats**

### **Success Response Example:**
```json
{
  "success": true,
  "message": "Workflow execution started",
  "data": {
    "executionId": "exec-abc123",
    "workflowId": "workflow-def456",
    "workflowName": "Call Deflection Automation",
    "templateId": "call-deflection-v1",
    "status": "started",
    "input": {...}
  }
}
```

### **Error Response Example:**
```json
{
  "success": false,
  "error": "Invalid API key",
  "message": "The provided API key is not valid or has expired"
}
```

---

## ⚡ **Quick Reference**

### **Essential Headers:**
```bash
X-API-Key: lwo_your_api_key_here
Content-Type: application/json
```

### **Base URLs:**
- **Production**: `https://langchain-workflow-orchestrator.onrender.com/api`
- **Development**: `http://localhost:8000/api`

### **Rate Limits:**
- 1000 requests/minute
- 10000 requests/hour  
- 100000 requests/day

### **Common HTTP Status Codes:**
- `200` - Success
- `201` - Created  
- `400` - Bad Request
- `401` - Unauthorized (invalid/missing API key)
- `404` - Not Found
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

---

**🎯 This reference provides everything Noam needs to integrate with the Universal Workflow Engine!**