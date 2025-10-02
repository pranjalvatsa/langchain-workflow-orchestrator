# LangChain Workflow Orchestrator - Universal Workflow Engine

A **scalable, universal workflow orchestration platform** using LangChain that can execute **ANY workflow without code changes**. Features a Universal Workflow Engine that eliminates the need for workflow-specific endpoints.

## 🌟 **Universal Workflow Engine - Key Innovation**

**The Problem**: Creating separate endpoints for each workflow is **not scalable**.

**The Solution**: **3 Universal Endpoints** that can handle **ANY workflow via configuration**:

```bash
# Execute ANY workflow by template ID
POST /api/universal/workflows/execute

# Schedule ANY workflow  
POST /api/universal/workflows/schedule  

# Trigger workflows by event type
POST /api/universal/workflows/trigger
```

### 🎯 **Scalability Benefits**
- ✅ **Unlimited Workflows**: Add any number of workflows without code changes
- ✅ **Configuration-Driven**: JSON/YAML templates define everything
- ✅ **Tool Library**: 14+ universal tools available to all workflows
- ✅ **Noam App Integration**: Visual editing with reverse engineering
- ✅ **Template Database**: Persistent workflow templates with versioning

## 🚀 Overview

This platform provides a complete **Universal Workflow Engine** that enables:

### **Core Features**
- **🔄 Universal Execution**: Any workflow executes via the same 3 endpoints
- **🛠️ Tool Library**: 14+ tools (calculator, search, API calls, LLM, human review, etc.)
- **📋 Template System**: Database-stored workflow templates with versioning
- **🎨 Visual Integration**: Noam app compatibility with ReactFlow canvas
- **⏰ Scheduling**: Universal scheduling for any workflow
- **🔗 Event Triggers**: Universal webhook system for any event type

### **Pre-Built Workflow Templates**
1. **📞 Call Deflection** - Customer service automation with AI + human escalation  
2. **📊 Business Insights** - Analytics, reporting, and multi-channel publishing
3. **👋 Customer Onboarding** - Automated welcome sequences and setup

### **Technical Stack**
- **AI Integration**: OpenAI GPT models and LangChain framework
- **Real-time**: WebSocket-based live monitoring and execution  
- **Authentication**: JWT-based user management
- **Database**: MongoDB with template storage and versioning
- **Production Ready**: Logging, monitoring, error handling, deployment configs

## 🏗️ Architecture

```
langchain-workflow-orchestrator/
├── server.js              # Main server entry point
├── src/
│   ├── models/            # MongoDB schemas
│   │   ├── User.js        # User management
│   │   ├── Workflow.js    # Workflow definitions  
│   │   ├── WorkflowTemplate.js # Universal templates (NEW)
│   │   └── WorkflowExecution.js # Execution tracking
│   ├── services/          # Core business logic
│   │   ├── LangChainService.js    # AI orchestration + 14 Tools
│   │   ├── WorkflowService.js     # Workflow management
│   │   ├── WorkflowExecutionService.js # Universal execution
│   │   └── AuthService.js         # Authentication
│   ├── routes/            # API endpoints
│   │   ├── universal.js   # Universal Workflow Engine (NEW)
│   │   ├── templates.js   # Template management (NEW)
│   │   ├── auth.js        # Authentication endpoints
│   │   ├── workflows.js   # Legacy workflow endpoints
│   │   └── webhooks.js    # Universal webhook system
│   └── templates/         # Pre-built workflow templates
│       ├── call-deflection-workflow.js
│       ├── insights-workflow.js  
│       └── deploy-to-database.js  # Template deployment
```

## 🛠️ Universal Tool Library (14 Tools)

The platform includes 14 universal tools that can be used in **any workflow**:

| Tool | Description | Use Cases |
|------|-------------|-----------|
| **calculator** | Mathematical expressions | Calculations, pricing, metrics |
| **search** | Web search engine | Research, current events, data lookup |
| **text_processor** | Text transformation | Content processing, formatting |
| **data_validator** | Data validation | Input validation, quality checks |
| **api_caller** | HTTP requests | External integrations, data fetching |
| **customer_data_api** | Customer data access | CRM integration, profile lookup |
| **noam_task_creator** | Human approval tasks | Human-in-the-loop workflows |
| **task_status_poller** | Task status monitoring | Workflow state management |
| **agent_escalation** | Human agent routing | Customer service escalation |
| **call_response_api** | Call system integration | Phone system responses |
| **call_transcription_processor** | Call analysis | Call center automation |
| **metrics_fetcher** | Analytics data | Business intelligence, reporting |
| **report_publisher** | Multi-channel publishing | Email, Slack, dashboard distribution |
| **scheduler** | Workflow scheduling | Automated execution, cron jobs |
│   │   ├── workflows.js   # Workflow CRUD
│   │   ├── executions.js  # Execution management
│   │   ├── customerWorkflows.js # Customer offer workflows
│   │   └── users.js       # User management
│   └── middleware/        # Express middleware
├── logs/                  # Application logs
├── DEPLOYMENT.md          # Deployment guide
├── render.yaml           # Render deployment config
└── package.json          # Dependencies and scripts
```

## 🌐 Deployment (Production Ready)

### Quick Deploy to Render:
```bash
# 1. Run deployment script
./deploy.sh

# 2. Push to GitHub
git push origin main

# 3. Connect to Render and deploy
# See DEPLOYMENT.md for detailed instructions
```

### Production URLs:
- **Health Check**: `https://your-service.onrender.com/health`
- **Customer Workflows**: `https://your-service.onrender.com/api/customer-workflows`
- **Templates**: `https://your-service.onrender.com/api/templates`

## 🔧 Installation & Setup

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)
- OpenAI API key

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

Update `.env` with your configuration:
```env
# Server Configuration
NODE_ENV=development
PORT=8000
HOST=localhost

# Database
MONGODB_URI=mongodb+srv://your-connection-string

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# External Service Integration (optional)
EXTERNAL_API_URL=https://api.external-service.com
EXTERNAL_CLIENT_ID=your-external-client-id
EXTERNAL_CLIENT_SECRET=your-external-client-secret

# CORS (for frontend integration)
CORS_ORIGIN=http://localhost:3000,https://your-frontend-app.com
```

### 3. Start the Server
```bash
npm start
```

Server will be available at: `http://localhost:8000`

## 🔌 Universal API Documentation

### 🌟 **Universal Workflow Engine Endpoints**

These **3 endpoints** can handle **ANY workflow** without code changes:

#### **1. Execute Any Workflow**
```http
POST /api/universal/workflows/execute
Content-Type: application/json

{
  "templateId": "call-deflection-v1",    // Or any template ID
  "input": {
    "callTranscript": "Customer wants to cancel subscription",
    "customerEmail": "customer@example.com"
  },
  "variables": {                         // Optional variable overrides
    "priority": "high"
  },
  "metadata": {                          // Optional execution metadata
    "source": "api",
    "requestId": "req-123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Workflow execution started",
  "data": {
    "executionId": "exec-456",
    "workflowId": "workflow-789",
    "templateId": "call-deflection-v1",
    "status": "started"
  }
}
```

#### **2. Schedule Any Workflow**
```http
POST /api/universal/workflows/schedule
Content-Type: application/json

{
  "templateId": "insights-analytics-v1",
  "schedule": "daily@09:00",             // Cron-like scheduling
  "input": {
    "reportType": "daily",
    "recipients": ["team@company.com"]
  },
  "timezone": "UTC",
  "enabled": true
}
```

#### **3. Trigger Workflows by Event**
```http
POST /api/universal/workflows/trigger
Content-Type: application/json

{
  "eventType": "call_transcription",     // Event that triggers workflows
  "data": {
    "transcript": "Customer complaint about billing",
    "phoneNumber": "+1234567890",
    "callId": "call-123"
  },
  "source": "phone_system"
}
```

#### **4. Get Available Tools**
```http
GET /api/universal/tools

Response:
{
  "success": true,
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
      }
      // ... 12 more tools
    ],
    "totalCount": 14
  }
}
```

### 📋 **Template Management API**

#### **List Templates**
```http
GET /api/templates?category=analytics&tags=reporting&public=true

Response:
{
  "success": true,
  "data": {
    "templates": [
      {
        "templateId": "insights-analytics-v1",
        "name": "Business Insights Analytics",
        "description": "Automated reporting workflow",
        "category": "analytics", 
        "metadata": {
          "tags": ["reporting", "analytics"],
          "complexity": "medium",
          "nodeCount": 8,
          "edgeCount": 7
        }
      }
    ],
    "pagination": {
      "total": 3,
      "hasMore": false
    }
  }
}
```

#### **Get Template Details**
```http
GET /api/templates/insights-analytics-v1?format=reactflow

Response:
{
  "success": true,
  "data": {
    "id": "insights-analytics-v1",
    "name": "Business Insights Analytics",
    "nodes": [
      {
        "id": "start",
        "type": "start", 
        "position": { "x": 100, "y": 100 },
        "data": {
          "label": "Insights Request"
        }
      }
      // ... more nodes
    ],
    "edges": [
      {
        "id": "e1",
        "source": "start",
        "target": "validate-request"
      }
      // ... more edges  
    ]
  }
}
```

#### **🎨 Noam App Integration**
```http
# Export templates for Noam app import
POST /api/templates/import/noam
Content-Type: application/json

{
  "templateIds": ["call-deflection-v1", "insights-analytics-v1"],
  "includePrivate": false
}

Response:
{
  "success": true,
  "message": "Exported 2 templates for Noam import",
  "data": {
    "exportInfo": {
      "timestamp": "2025-10-02T12:00:00.000Z",
      "source": "langchain-workflow-orchestrator",
      "totalTemplates": 2
    },
    "workflows": [
      {
        "id": "68de685ba0cf7b12eee94441",
        "templateId": "call-deflection-v1",
        "name": "Call Deflection Automation",
        "reactFlow": {
          "nodes": [...],  // ReactFlow compatible format
          "edges": [...],
          "viewport": { "x": 0, "y": 0, "zoom": 1 }
        },
        "metadata": {
          "importedFrom": "langchain-orchestrator",
          "toolsUsed": ["api_caller", "noam_task_creator"],
          "complexity": "medium"
        }
      }
    ]
  }
}
```

## 🎯 **Pre-Built Workflow Examples**

### **📞 Call Deflection Workflow**

**Purpose**: Automated customer service with AI analysis and human escalation

**Execution:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "call-deflection-v1",
    "input": {
      "callTranscript": "Customer is frustrated about billing charges",
      "customerPhone": "+1234567890",
      "callId": "call-456"
    }
  }'
```

**Workflow Steps:**
1. **Classify Intent** → AI analyzes call transcript 
2. **Generate Response** → Create appropriate response
3. **Human Review** → Create task in Noam app if needed
4. **Send Response** → Deliver response to customer
5. **Escalate** → Route to human agent if required

### **📊 Business Insights Workflow**

**Purpose**: Automated data analysis and multi-channel reporting

**Execution:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1",
    "input": {
      "reportType": "daily",
      "timeRange": "last_24h",
      "recipients": ["team@company.com"],
      "slackChannel": "#insights"
    }
  }'
```

**Scheduled Execution:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "insights-analytics-v1", 
    "schedule": "daily@09:00",
    "input": {
      "reportType": "daily",
      "format": "pdf"
    }
  }'
```

**Workflow Steps:**
1. **Validate Request** → Check parameters and permissions
2. **Fetch Metrics** → Collect data from multiple sources  
3. **AI Analysis** → Generate insights using GPT-4
4. **Generate Report** → Create formatted report
5. **Publish Multi-Channel** → Email, Slack, dashboard
6. **Schedule Next** → Set up recurring execution

### **👋 Customer Onboarding Workflow** 

**Purpose**: Automated welcome sequence and account setup

**Execution:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "customer-onboarding-v1",
    "input": {
      "email": "newcustomer@company.com",
      "name": "New Customer", 
      "accountType": "premium",
      "source": "website"
    }
  }'
```

## 🔄 **Noam App Integration & Reverse Engineering**

### **Import Templates to Noam**

1. **Export All Templates:**
```bash
curl -X POST http://localhost:8000/api/templates/import/noam \
  -H "Content-Type: application/json" \
  -d '{}' > noam-import.json
```

2. **Import Specific Templates:**
```bash
curl -X POST http://localhost:8000/api/templates/import/noam \
  -H "Content-Type: application/json" \
  -d '{
    "templateIds": ["call-deflection-v1", "insights-analytics-v1"],
    "includePrivate": false
  }' > selected-templates.json
```

### **Reverse Engineering Process**

1. **📥 Import**: Templates imported as ReactFlow canvases in Noam
2. **✏️ Visual Edit**: Modify workflows in Noam's visual editor
3. **📤 Export**: Modified workflows exported back to Universal Engine
4. **▶️ Execute**: Same universal endpoints work immediately

### 🔐 **Authentication Endpoints**

#### **Login**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "user-123",
      "email": "user@example.com", 
      "name": "John Doe"
    },
    "tokens": {
      "accessToken": "jwt-token-here",
      "refreshToken": "refresh-token-here"
    }
  }
}
```

#### **Register**
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword",
  "name": "New User",
  "noamAccountId": "noam-account-123",
  "noamUserId": "noam-user-456"
}
```

## ⚡ **Quick Start Guide**

### **1. Installation**
```bash
# Clone the repository
git clone https://github.com/pranjalvatsa/langchain-workflow-orchestrator.git
cd langchain-workflow-orchestrator

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### **2. Environment Configuration**
```env
# Server Configuration
NODE_ENV=development
PORT=8000

# Database - MongoDB Atlas recommended
MONGODB_URI=mongodb+srv://your-connection-string

# OpenAI for AI workflows
OPENAI_API_KEY=your-openai-api-key

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS for frontend integration
CORS_ORIGIN=http://localhost:3000

# Optional: External integrations
SENDGRID_API_KEY=your-sendgrid-key
SLACK_BOT_TOKEN=your-slack-bot-token
```

### **3. Deploy Pre-Built Templates**
```bash
# Deploy the 3 universal workflow templates to database
node src/templates/quick-deploy.js
```

**Output:**
```
✅ Saved 2 templates to database
   1. Call Deflection Automation (call-deflection-v1)
   2. Business Insights Analytics (insights-analytics-v1)

🔗 Noam App Integration URLs:
   POST http://localhost:8000/api/templates/import/noam
```

### **4. Start the Server**
```bash
npm start
```

**Server available at:** `http://localhost:8000`

### **5. Test Universal Endpoints**

**Execute Call Deflection:**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "call-deflection-v1",
    "input": {
      "callTranscript": "Customer complaint about billing"
    }
  }'
```

**Get Available Tools:**
```bash
curl http://localhost:8000/api/universal/tools
```

**Export for Noam:**
```bash
curl -X POST http://localhost:8000/api/templates/import/noam \
  -H "Content-Type: application/json" \
  -d '{}' > noam-templates.json
```

## 💻 **Client Integration Examples**

### **JavaScript/Node.js**
```javascript
import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: { 'Content-Type': 'application/json' }
});

// Execute any workflow
async function executeWorkflow(templateId, input) {
  const response = await client.post('/universal/workflows/execute', {
    templateId,
    input
  });
  return response.data;
}

// Usage examples
await executeWorkflow('call-deflection-v1', {
  callTranscript: 'Customer needs help with account'
});

await executeWorkflow('insights-analytics-v1', {
  reportType: 'weekly',
  recipients: ['team@company.com']
});
```

### **Python**
```python
import requests

class UniversalWorkflowClient:
    def __init__(self, base_url="http://localhost:8000/api"):
        self.base_url = base_url
        
    def execute_workflow(self, template_id, input_data):
        response = requests.post(f"{self.base_url}/universal/workflows/execute", 
                               json={"templateId": template_id, "input": input_data})
        return response.json()
    
    def schedule_workflow(self, template_id, schedule, input_data):
        response = requests.post(f"{self.base_url}/universal/workflows/schedule",
                               json={"templateId": template_id, "schedule": schedule, "input": input_data})
        return response.json()

# Usage
client = UniversalWorkflowClient()

# Execute call deflection
result = client.execute_workflow("call-deflection-v1", {
    "callTranscript": "Customer billing issue"
})

# Schedule daily insights
client.schedule_workflow("insights-analytics-v1", "daily@09:00", {
    "reportType": "daily"
})
```

### **React/Frontend Integration**
```jsx
import React, { useState } from 'react';

const WorkflowExecutor = () => {
  const [result, setResult] = useState(null);
  
  const executeWorkflow = async (templateId, input) => {
    const response = await fetch('/api/universal/workflows/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId, input })
    });
    const data = await response.json();
    setResult(data);
  };

  return (
    <div>
      <button onClick={() => executeWorkflow('call-deflection-v1', {
        callTranscript: 'Customer support request'
      })}>
        Execute Call Deflection
      </button>
      
      <button onClick={() => executeWorkflow('insights-analytics-v1', {
        reportType: 'daily'
      })}>
        Generate Insights Report
      </button>
      
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
};
```

// Execute a workflow
const execution = await apiClient.post('/executions', {
  workflowId: workflow.data.workflow._id,
  inputs: { input: 'World!' }
});
```

**Real-time Monitoring:**
```javascript
// WebSocket connection for real-time updates
import io from 'socket.io-client';

const socket = io('http://localhost:8000', {
  auth: { token: accessToken }
});

// Monitor workflow execution
socket.emit('join_execution', executionId);
socket.on('node_completed', (data) => {
  console.log('Node completed:', data);
});
socket.on('execution_completed', (data) => {
  console.log('Workflow completed:', data);
});
```

### Workflow Schema

Workflows follow this structure:
```json
{
  "name": "Workflow Name",
  "description": "Workflow description",
  "nodes": [
    {
      "id": "unique-node-id",
      "type": "llm|tool|condition|transform|memory",
      "config": {
        // Node-specific configuration
      },
      "position": { "x": 0, "y": 0 }
    }
  ],
  "edges": [
    {
      "id": "unique-edge-id",
      "source": "source-node-id",
      "target": "target-node-id",
      "condition": {
        "type": "success|failure|output_equals",
        "value": "comparison-value"
      }
    }
  ],
  "configuration": {
    "maxConcurrentExecutions": 5,
    "timeoutMinutes": 30
  }
}
```

### Node Types

**LLM Node:**
```json
{
  "type": "llm",
  "config": {
    "prompt": "Your prompt with {{variables}}",
    "model": "gpt-4|gpt-3.5-turbo|gpt-4-turbo",
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

**Tool Node:**
```json
{
  "type": "tool",
  "config": {
    "toolName": "calculator|search|api_caller|text_processor",
    "input": "Tool input with {{variables}}"
  }
}
```

**Condition Node:**
```json
{
  "type": "condition",
  "config": {
    "condition": "{{output}} == 'success'",
    "truthyPath": "next-node-id-if-true",
    "falsyPath": "next-node-id-if-false"
  }
}
```

## 📚 API Documentation

Once the server is running, visit:
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh

#### Workflows
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `PUT /api/workflows/:id` - Update workflow
- `POST /api/workflows/:id/validate` - Validate workflow

#### Executions
- `POST /api/executions` - Execute workflow
- `GET /api/executions` - List executions
- `GET /api/executions/:id` - Get execution details
- `POST /api/executions/:id/abort` - Abort execution

## 🔧 Development

### Running in Development Mode
```bash
npm run dev  # Uses nodemon for auto-restart
```

### Testing
```bash
npm test
```

### Logging
Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output for development

## 🚀 Production Deployment

### Environment Variables for Production
```env
NODE_ENV=production
PORT=8000
MONGODB_URI=mongodb+srv://production-connection
JWT_SECRET=super-secure-production-secret
OPENAI_API_KEY=production-openai-key
CORS_ORIGIN=https://your-production-frontend.com
```

### PM2 Deployment
```bash
npm install -g pm2
pm2 start server.js --name "langchain-backend"
pm2 save
pm2 startup
```

## � **Production Deployment**

### **Environment Variables for Production**
```env
NODE_ENV=production
PORT=8000
MONGODB_URI=mongodb+srv://production-connection
JWT_SECRET=super-secure-production-secret-512-chars
OPENAI_API_KEY=production-openai-key
CORS_ORIGIN=https://your-production-frontend.com,https://noam.app

# External integrations
SENDGRID_API_KEY=production-sendgrid-key
SLACK_BOT_TOKEN=production-slack-token
```

### **Docker Deployment**
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t langchain-orchestrator .
docker run -p 8000:8000 --env-file .env langchain-orchestrator
```

### **PM2 Process Management**
```bash
npm install -g pm2
pm2 start server.js --name "universal-workflow-engine"
pm2 save
pm2 startup
```

## 🔐 **Security Features**

- **JWT Authentication** with refresh tokens and secure session management
- **Rate Limiting** per user and globally (100 requests/15min default)
- **Input Validation** and sanitization for all API endpoints
- **CORS Protection** with configurable origins
- **Helmet Security Headers** for XSS and clickjacking protection
- **API Key Management** for external service integrations
- **Request Logging** and comprehensive audit trails
- **Environment Isolation** between development and production

## 📊 **Monitoring & Observability**

### **Health Checks**
```bash
# Basic health
GET /health

# Detailed system status
GET /api/universal/tools

# Database connectivity
GET /api/templates?limit=1
```

### **Logging Structure**
```json
{
  "level": "info",
  "message": "Workflow executed",
  "timestamp": "2025-10-02T12:00:00.000Z",
  "templateId": "call-deflection-v1",
  "executionId": "exec-123",
  "userId": "user-456",
  "duration": 1250
}
```

## 🔧 **Creating Custom Workflows**

### **1. Define Template Structure**
```json
{
  "templateId": "my-custom-workflow-v1",
  "name": "My Custom Workflow",
  "description": "Custom automation workflow",
  "category": "automation",
  
  "nodes": [
    {
      "id": "start",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start" }
    },
    {
      "id": "api-call",
      "type": "tool", 
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "Fetch Data",
        "tool": "api_caller",
        "parameters": {
          "url": "https://api.example.com/data",
          "method": "GET",
          "headers": { "Authorization": "Bearer ${API_TOKEN}" }
        }
      }
    }
  ],
  
  "edges": [
    { "id": "e1", "source": "start", "target": "api-call" }
  ],
  
  "triggers": [
    {
      "eventType": "data_request",
      "enabled": true,
      "priority": "normal"
    }
  ]
}
```

### **2. Save to Database**
```bash
curl -X POST http://localhost:8000/api/templates/save-from-universal \
  -H "Content-Type: application/json" \
  -d @my-workflow-template.json
```

### **3. Execute Immediately**
```bash
curl -X POST http://localhost:8000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "templateId": "my-custom-workflow-v1",
    "input": { "parameter": "value" }
  }'
```

## � **Scaling to Multiple Workflows**

The Universal Workflow Engine scales effortlessly:

### **Current Templates (No Code Changes)**
- ✅ Call Deflection Automation
- ✅ Business Insights Analytics  
- ✅ Customer Onboarding (ready)

### **Add Any New Workflow (Zero Code)**
1. Create JSON template
2. Use existing 14 tools
3. Save via API
4. Execute immediately

### **Examples of Additional Workflows**
- **Lead Qualification** - Score and route sales leads
- **Invoice Processing** - Extract data and approval workflow
- **Social Media Management** - Content creation and scheduling
- **Inventory Management** - Reorder automation and alerts
- **Employee Onboarding** - HR workflows and task assignment

**Key Point**: All use the same 3 universal endpoints! 🎯

## 🤝 **Contributing**

### **Development Setup**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/workflow-enhancement`
3. Add your workflow template to `src/templates/`
4. Test with universal endpoints
5. Submit pull request

### **Adding New Tools**
```javascript
// Add to src/services/LangChainService.js
const newTool = new Tool({
  name: 'my_new_tool',
  description: 'Description of what this tool does',
  func: async (input) => {
    // Tool implementation
    return JSON.stringify(result);
  }
});

this.tools.set('my_new_tool', newTool);
```

## 🆘 **Support & Troubleshooting**

### **Common Issues**

**❌ Template Execution Failed**
```bash
# Check available tools
curl http://localhost:8000/api/universal/tools

# Verify template exists
curl http://localhost:8000/api/templates
```

**❌ MongoDB Connection Failed**
- Verify `MONGODB_URI` in .env
- Check network connectivity and IP whitelist
- Test connection: `curl http://localhost:8000/health`

**❌ Noam Integration Issues**
```bash
# Test export endpoint
curl -X POST http://localhost:8000/api/templates/import/noam -d '{}'

# Check ReactFlow format
curl http://localhost:8000/api/templates/{template-id}/reactflow
```

**❌ Authentication Issues**
- Verify `JWT_SECRET` is set and secure
- Check token format: `Authorization: Bearer <token>`
- Test login: `curl -X POST /api/auth/login`

### **Debug Logs**
```bash
# Server logs
tail -f logs/combined.log

# MongoDB queries
NODE_ENV=development npm start

# Workflow execution
curl -X POST /api/universal/workflows/execute -d '{"templateId":"test","input":{}}' -v
```

### **Performance Optimization**
- **Database Indexes**: Templates indexed by templateId, category, status
- **Connection Pooling**: MongoDB connection pool configured
- **Rate Limiting**: Configurable per-user and global limits
- **Caching**: Template caching for faster execution

## 📝 **License**

MIT License - see LICENSE file for details

---

## 🎉 **Universal Workflow Engine - Ready!**

### **🌟 What You Get:**
- ✅ **3 Universal Endpoints** handle any workflow
- ✅ **14 Universal Tools** for any automation need  
- ✅ **Template Database** with versioning and management
- ✅ **Noam App Integration** with visual editing and reverse engineering
- ✅ **Zero Code Scaling** - add unlimited workflows via configuration
- ✅ **Production Ready** with security, monitoring, and deployment configs

### **🚀 Next Steps:**
1. **Deploy templates**: `node src/templates/quick-deploy.js`
2. **Test execution**: Use the universal endpoints
3. **Import to Noam**: Use `/import/noam` endpoint  
4. **Create custom workflows**: JSON templates only
5. **Scale infinitely**: No more workflow-specific endpoints!

**The Universal Workflow Engine revolutionizes workflow automation - scalable, maintainable, and future-proof!** 🎯
