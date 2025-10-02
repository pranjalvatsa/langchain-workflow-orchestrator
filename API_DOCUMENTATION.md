# 🚀 LangChain Workflow Orchestrator API Documentation

**Base URL:** `https://langchain-workflow-orchestrator.onrender.com`

## 📋 Table of Contents
1. [Authentication](#authentication)
2. [Customer Offer Workflow](#customer-offer-workflow)
3. [Workflow Status & Monitoring](#workflow-status--monitoring)
4. [Webhooks](#webhooks)
5. [Testing Endpoints](#testing-endpoints)
6. [Error Handling](#error-handling)
7. [Integration Examples](#integration-examples)

---

## 🔐 Authentication

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@noamapp.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "noamUserId": "noam_user_123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
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