# Universal Workflow Engine - API Reference

Complete API documentation for the LangChain Workflow Orchestrator Universal Engine.

## 🌐 Base URL
```
Production: https://your-domain.com/api
Development: http://localhost:8000/api
```

## 🔐 Authentication

All protected endpoints require JWT token in the Authorization header:
```http
Authorization: Bearer <your-jwt-token>
```

### Obtain Token
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

---

## 🌟 Universal Workflow Engine

### Execute Any Workflow
Execute any workflow template by its ID.

```http
POST /universal/workflows/execute
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "templateId": "string (required)",
  "workflowId": "string (optional - alternative to templateId)",
  "input": "object (optional)",
  "variables": "object (optional)",
  "metadata": "object (optional)"
}
```

**Response:**
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
    "input": {
      "callTranscript": "Customer complaint"
    }
  }
}
```

**Examples:**
```bash
# Call Deflection
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "call-deflection-v1",
    "input": {
      "callTranscript": "Customer wants to cancel subscription",
      "customerPhone": "+1234567890"
    }
  }'

# Business Insights
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "input": {
      "reportType": "daily",
      "timeRange": "last_24h",
      "recipients": ["team@company.com"]
    }
  }'
```

---

### Schedule Any Workflow
Schedule any workflow to run at specific times or intervals.

```http
POST /universal/workflows/schedule
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "templateId": "string (required)",
  "workflowId": "string (optional)",
  "schedule": "string (required)",
  "input": "object (optional)",
  "timezone": "string (optional, default: UTC)",
  "enabled": "boolean (optional, default: true)"
}
```

**Schedule Formats:**
- `"daily@09:00"` - Every day at 9 AM
- `"weekly@monday@14:30"` - Every Monday at 2:30 PM
- `"monthly@1@12:00"` - 1st of every month at noon
- `"*/15 * * * *"` - Every 15 minutes (cron format)

**Example:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/schedule \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "schedule": "daily@09:00",
    "input": {
      "reportType": "daily",
      "format": "pdf"
    },
    "timezone": "America/New_York"
  }'
```

---

### Trigger Workflows by Event
Trigger workflows based on event types (universal webhook system).

```http
POST /universal/workflows/trigger
Content-Type: application/json
```

**Request Body:**
```json
{
  "eventType": "string (required)",
  "data": "object (optional)",
  "source": "string (optional)"
}
```

**Common Event Types:**
- `call_transcription` - Phone call completed
- `new_customer_signup` - Customer registered
- `scheduled_report` - Time-based trigger
- `data_request` - Manual data analysis request

**Example:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "call_transcription",
    "data": {
      "transcript": "Customer complaint about billing",
      "phoneNumber": "+1234567890",
      "callId": "call-789"
    },
    "source": "phone_system"
  }'
```

---

### Get Available Tools
List all available tools in the Universal Engine.

```http
GET /universal/tools
```

**Response:**
```json
{
  "success": true,
  "message": "Found 14 available tools",
  "data": {
    "tools": [
      {
        "name": "calculator",
        "description": "Mathematical expressions and calculations",
        "type": "Tool"
      },
      {
        "name": "search",
        "description": "Web search for current information",
        "type": "Tool"
      },
      {
        "name": "api_caller",
        "description": "Make HTTP requests to external APIs",
        "type": "Tool"
      }
    ],
    "totalCount": 14
  }
}
```

---

## 📋 Template Management

### List Templates
Get all available workflow templates with filtering and pagination.

```http
GET /templates
```

**Query Parameters:**
- `category` - Filter by category (analytics, customer-service, etc.)
- `tags` - Comma-separated tags
- `search` - Search in name/description
- `status` - published, draft, archived
- `public` - true/false for public templates
- `limit` - Number of results (default: 20)
- `offset` - Pagination offset (default: 0)

**Example:**
```bash
curl "http://localhost:8000/api/templates?category=analytics&public=true&limit=10"
```

---

### Export for Noam App
Export templates in Noam-compatible format for visual editing.

```http
POST /templates/import/noam
Content-Type: application/json
```

**Request Body:**
```json
{
  "templateIds": ["string[]"] (optional),
  "category": "string (optional)",
  "includePrivate": "boolean (optional, default: false)"
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/templates/import/noam \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": ["call-deflection-v1", "insights-analytics-v1"],
    "includePrivate": false
  }'
```

---

### Import from Noam App
Import ReactFlow workflows created in Noam canvas into Universal Engine.

```http
POST /templates/import/reactflow
Content-Type: application/json
```

**Request Body:**
```json
{
  "workflow": {
    "name": "string (required)",
    "description": "string (optional)",
    "category": "string (optional)",
    "nodes": "array (required)",
    "edges": "array (required)"
  },
  "noamMetadata": {
    "noamWorkflowId": "string (required)",
    "noamUserId": "string (optional)",
    "noamAccountId": "string (optional)"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow successfully imported from Noam",
  "data": {
    "templateId": "noam-import-1696270000-abc123",
    "_id": "670d1a2b3c4d5e6f7g8h9i0j",
    "name": "Customer Support Automation",
    "category": "imported",
    "executionEndpoints": {
      "execute": "/api/universal/workflows/execute",
      "schedule": "/api/universal/workflows/schedule",
      "trigger": "/api/universal/workflows/trigger"
    },
    "sampleExecution": {
      "templateId": "noam-import-1696270000-abc123",
      "input": {
        "message": "Sample input from Noam workflow",
        "timestamp": "2025-10-02T17:46:00Z"
      }
    },
    "noamIntegration": {
      "imported": true,
      "noamWorkflowId": "noam-workflow-123",
      "importedAt": "2025-10-02T17:46:00Z"
    }
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8000/api/templates/import/reactflow \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "name": "Customer Support Automation",
      "description": "AI-powered support ticket routing",
      "category": "customer-service",
      "nodes": [
        {
          "id": "trigger-1",
          "type": "input",
          "position": { "x": 100, "y": 100 },
          "data": {
            "label": "New Support Ticket",
            "parameters": {
              "ticketId": "string",
              "customerEmail": "string",
              "issue": "string"
            }
          }
        },
        {
          "id": "llm-1",
          "type": "api",
          "position": { "x": 300, "y": 100 },
          "data": {
            "label": "Analyze Issue",
            "tool": "llm_chat",
            "parameters": {
              "model": "gpt-3.5-turbo",
              "prompt": "Analyze: {{issue}}"
            }
          }
        }
      ],
      "edges": [
        {
          "id": "e1-2",
          "source": "trigger-1",
          "target": "llm-1"
        }
      ]
    },
    "noamMetadata": {
      "noamWorkflowId": "noam-workflow-123",
      "noamUserId": "user-456",
      "noamAccountId": "account-789"
    }
  }'
```

---

## 🔔 **Noam Integration & Task Notifications**

### Send Task Notifications to Noam
Automatically sends workflow execution updates to Noam app for task management.

```http
POST /webhooks/noam/task-notifications
Content-Type: application/json
```

**Request Body:**
```json
{
  "executionId": "string (required)",
  "workflowId": "string (optional)",
  "templateId": "string (optional)",
  "noamWorkflowId": "string (required)",
  "status": "started|running|completed|failed|paused",
  "taskData": {
    "title": "string",
    "description": "string",
    "priority": "low|medium|high",
    "assignee": "string",
    "inputs": "object",
    "outputs": "object"
  },
  "noamAccountId": "string",
  "noamUserId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task notification processed",
  "data": {
    "executionId": "exec-abc123",
    "noamWorkflowId": "noam-workflow-123",
    "status": "running",
    "notificationSent": true,
    "timestamp": "2025-10-02T17:46:00Z"
  }
}
```

This endpoint is automatically called when executing workflows imported from Noam.

---

## 🎯 **Bi-Directional Integration Examples**

### Complete Noam → Universal Engine → Noam Flow

1. **Create in Noam ReactFlow Canvas:**
```javascript
// In Noam app - create workflow visually
const workflowData = {
  name: "Lead Qualification",
  nodes: [...], // Created via drag-and-drop
  edges: [...]
};
```

2. **Push to Universal Engine:**
```bash
curl -X POST http://localhost:8000/api/templates/import/reactflow \
  -d '{"workflow": workflowData, "noamMetadata": {...}}'
```

3. **Execute on Universal Engine:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -d '{"templateId": "noam-import-123", "input": {...}}'
```

4. **Receive Task Updates in Noam:**
```json
{
  "task": {
    "title": "Lead Qualification - Running",
    "actions": [
      {"label": "View Details", "url": "/workflows/..."},
      {"label": "Pause", "endpoint": "/api/universal/workflows/.../pause"}
    ]
  }
}
```

---

## 🎯 Pre-Built Workflow Examples

### Call Deflection Workflow
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "call-deflection-v1",
    "input": {
      "callTranscript": "Customer is frustrated about billing charges",
      "customerPhone": "+1234567890"
    }
  }'
```

### Business Insights Workflow
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "input": {
      "reportType": "daily",
      "timeRange": "last_24h",
      "recipients": ["team@company.com"]
    }
  }'
```

### Customer Onboarding Workflow
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "customer-onboarding-v1",
    "input": {
      "email": "newcustomer@company.com",
      "name": "New Customer",
      "accountType": "premium"
    }
  }'
```

---

## 🔐 Authentication

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

### Register
```http
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "name": "New User",
  "noamAccountId": "noam-account-123",
  "noamUserId": "noam-user-456"
}
```

---

## ⚠️ Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

**HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `404` - Not Found
- `500` - Internal Server Error

---

## 🚀 Universal Engine Benefits

- ✅ **3 Endpoints Handle Everything** - No workflow-specific endpoints needed
- ✅ **14 Universal Tools** - Available to all workflows
- ✅ **Configuration-Driven** - Add workflows via JSON templates
- ✅ **Noam Integration** - Visual editing with reverse engineering
- ✅ **Scalable** - Unlimited workflows without code changes

This Universal Workflow Engine revolutionizes workflow automation by eliminating the need for custom endpoints per workflow!

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@noamapp.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@noamapp.com",
      "firstName": "John",
      "lastName": "Doe"
    },
    "tokens": {
      "accessToken": "jwt_access_token",
      "refreshToken": "jwt_refresh_token"
    }
  }
}
```

---

## 🎯 Customer Offer Workflow

### Start Customer Offer Prediction Workflow
This is the main endpoint to start the 4-step workflow (Start → API Call → LLM Processing → Human Approval).

```http
POST /api/customer-workflows/offer-prediction
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "customerId": "customer_123",
  "assignee": "user_id_for_approval",
  "workflowName": "Customer Offer Generation"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Customer offer workflow started successfully",
  "data": {
    "workflowId": "workflow_id",
    "executionId": "execution_id",
    "status": "running",
    "customerId": "customer_123",
    "trackingUrl": "/api/executions/execution_id/status"
  }
}
```

**Workflow Steps:**
1. **START** - Initialize workflow
2. **API_CALL** - Fetch customer data from external API
3. **LLM_ANALYSIS** - Generate personalized offers using OpenAI
4. **HUMAN_APPROVAL** - Create task in Noam app for human review

---

## 📊 Workflow Status & Monitoring

### Get Workflow Execution Status
```http
GET /api/customer-workflows/status/{executionId}
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "executionId": "execution_id",
    "workflowId": "workflow_id",
    "workflowName": "Customer Offer Generation",
    "status": "waiting",
    "progress": 75,
    "currentStep": {
      "nodeId": "human_approval_node",
      "nodeName": "Human Approval Required",
      "waitingFor": "human_approval",
      "taskId": "noam_task_123",
      "createdAt": "2024-01-01T10:00:00Z",
      "timeout": 3600000
    },
    "latestSteps": [
      {
        "nodeId": "start_node",
        "nodeName": "Start",
        "status": "completed",
        "startTime": "2024-01-01T10:00:00Z",
        "endTime": "2024-01-01T10:00:01Z"
      }
    ],
    "inputs": {
      "customerId": "customer_123"
    },
    "outputs": {
      "customerData": {...},
      "generatedOffers": [...]
    },
    "metrics": {
      "startTime": "2024-01-01T10:00:00Z",
      "duration": 45000,
      "totalNodes": 4,
      "executedNodes": 3,
      "failedNodes": 0
    }
  }
}
```

### Get All Workflow Executions
```http
GET /api/executions?status=running&limit=10&offset=0
Authorization: Bearer {accessToken}
```

---

## 🔄 Webhooks

### Noam Task Completion Webhook
This endpoint should be called by your Noam app when a human approval task is completed.

```http
POST /api/customer-workflows/webhooks/noam-task
Content-Type: application/json
Authorization: Bearer {accessToken} # or webhook signature verification

{
  "taskId": "noam_task_123",
  "status": "completed",
  "decision": "approved",
  "feedback": "Offers look good, approved for customer",
  "completedBy": "user_id",
  "completedAt": "2024-01-01T10:30:00Z",
  "workflowExecutionId": "execution_id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task completion processed successfully",
  "data": {
    "executionId": "execution_id",
    "taskId": "noam_task_123",
    "decision": "approved",
    "status": "completed"
  }
}
```

---

## 🧪 Testing Endpoints

### Mock Approval (For Testing)
Use this endpoint to simulate Noam app approval without actual integration.

```http
POST /api/customer-workflows/test/mock-approval
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "taskId": "noam_task_123",
  "decision": "approved",
  "feedback": "Test approval"
}
```

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T10:00:00Z",
  "uptime": 3600,
  "services": {
    "database": "connected",
    "langchain": "ready"
  }
}
```

---

## ⚠️ Error Handling

### Standard Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message",
  "code": "ERROR_CODE"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

---

## 🔧 Integration Examples

### 1. Noam App Integration Flow

```javascript
// 1. Start workflow from Noam canvas
const startWorkflow = async (customerId) => {
  const response = await fetch('https://langchain-workflow-orchestrator.onrender.com/api/customer-workflows/offer-prediction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      customerId: customerId,
      assignee: currentUserId,
      workflowName: 'Customer Offer Generation'
    })
  });
  
  const result = await response.json();
  return result.data.executionId;
};

// 2. Monitor workflow progress
const monitorWorkflow = async (executionId) => {
  const response = await fetch(`https://langchain-workflow-orchestrator.onrender.com/api/customer-workflows/status/${executionId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const status = await response.json();
  
  if (status.data.status === 'waiting' && status.data.currentStep.waitingFor === 'human_approval') {
    // Create task in Noam app
    createNoamTask({
      taskId: status.data.currentStep.taskId,
      title: 'Review Customer Offers',
      data: status.data.outputs,
      assignee: status.data.currentStep.assignee
    });
  }
  
  return status.data;
};

// 3. Handle task completion in Noam
const handleTaskCompletion = async (taskId, decision, feedback) => {
  const response = await fetch('https://langchain-workflow-orchestrator.onrender.com/api/customer-workflows/webhooks/noam-task', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      taskId: taskId,
      status: 'completed',
      decision: decision,
      feedback: feedback,
      completedBy: currentUserId,
      completedAt: new Date().toISOString()
    })
  });
  
  return await response.json();
};
```

### 2. WebSocket Real-time Updates

```javascript
// Connect to real-time updates
const socket = io('https://langchain-workflow-orchestrator.onrender.com', {
  auth: {
    token: accessToken
  }
});

// Listen for workflow progress
socket.on('workflowProgress', (data) => {
  console.log('Workflow progress:', data);
  updateNoamCanvas(data);
});

// Listen for task assignments
socket.on('taskAssigned', (data) => {
  console.log('New task assigned:', data);
  createNoamTask(data);
});

// Listen for workflow completion
socket.on('workflowCompleted', (data) => {
  console.log('Workflow completed:', data);
  showResults(data.outputs);
});
```

---

## 🎯 Quick Start for Noam Integration

1. **Register/Login** to get access token
2. **Start a workflow** using `/api/customer-workflows/offer-prediction`
3. **Monitor progress** using `/api/customer-workflows/status/{executionId}`
4. **Handle human approval** by calling the webhook when task is completed
5. **Get final results** from the workflow outputs

### Environment Variables Needed
- `OPENAI_API_KEY` - Your OpenAI API key
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - For authentication
- `CORS_ORIGIN` - Set to your Noam app URL

The API is now ready for integration with your Noam ReactFlow canvas! 🚀