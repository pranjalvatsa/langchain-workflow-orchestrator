# LangChain Workflow Orchestrator - Backend Microservice

A comprehensive backend microservice for orchestrating AI workflows using LangChain. This service provides RESTful APIs and real-time capabilities for managing and executing complex AI workflow pipelines with **Noam app integration**.

## 🚀 Overview

This backend microservice provides a complete workflow orchestration platform that enables:
- **Workflow Management**: Create, update, validate, and manage AI workflows
- **AI Model Integration**: Support for OpenAI GPT models and other LLM providers  
- **Real-time Execution**: WebSocket-based live workflow monitoring and execution
- **Human-in-the-Loop**: Task creation and approval workflows with Noam app
- **Customer Offer Prediction**: 4-step AI-powered recommendation workflow
- **User Management**: JWT-based authentication and authorization
- **API-First Design**: RESTful APIs for seamless integration with any frontend
- **Scalable Architecture**: Production-ready with logging, monitoring, and error handling
- **Render Deployment**: Ready for cloud deployment with comprehensive configuration

## 🎯 Customer Offer Workflow (Noam Integration)

### 4-Step Workflow Architecture:
1. **START NODE** - Initialize workflow with customer ID
2. **API NODE** - Fetch customer data (mock/real API)
3. **LLM NODE** - AI offer prediction using OpenAI
4. **HUMAN APPROVAL** - Create task in Noam app for approval

### Key Features:
- ✅ Generic API/webhook nodes for any service integration
- ✅ Pause/resume workflow for human approval
- ✅ Real-time progress monitoring via Socket.IO
- ✅ Configurable endpoints and parameters
- ✅ Mock data ready for immediate testing

## 🏗️ Architecture

```
langchain-workflow-orchestrator/
├── server.js              # Main server entry point
├── src/
│   ├── models/            # MongoDB schemas
│   │   ├── User.js        # User management
│   │   ├── Workflow.js    # Workflow definitions
│   │   └── WorkflowExecution.js # Execution tracking
│   ├── services/          # Core business logic
│   │   ├── LangChainService.js    # AI orchestration + Tools
│   │   ├── WorkflowService.js     # Workflow management
│   │   ├── WorkflowTemplateService.js # Template management
│   │   ├── AuthService.js         # Authentication
│   │   └── ExecutionService.js    # Workflow execution
│   ├── routes/            # API endpoints
│   │   ├── auth.js        # Authentication endpoints
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

## 🔌 API Integration Guide

This microservice provides RESTful APIs that can be consumed by any frontend application or other services.

### API Client Integration

Here's how to integrate with this backend from any application:

#### HTTP Client Setup
```javascript
// Example using axios (works with any HTTP client)
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication
apiClient.interceptors.request.use((config) => {
  const token = getAuthToken(); // Your token storage method
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

#### Basic API Usage Examples

**Authentication:**
```javascript
// Login
const loginResponse = await apiClient.post('/auth/login', {
  email: 'user@example.com',
  password: 'password'
});
const { accessToken } = loginResponse.data.data.tokens;

// Register
const registerResponse = await apiClient.post('/auth/register', {
  email: 'newuser@example.com',
  password: 'password',
  firstName: 'John',
  lastName: 'Doe'
});
```

**Workflow Management:**
```javascript
// Create a workflow
const workflow = await apiClient.post('/workflows', {
  name: 'My AI Workflow',
  description: 'A sample workflow',
  nodes: [
    {
      id: 'node-1',
      type: 'llm',
      config: {
        prompt: 'Hello, {{input}}',
        model: 'gpt-3.5-turbo'
      },
      position: { x: 100, y: 100 }
    }
  ],
  edges: [],
  category: 'general'
});

// Get all workflows
const workflows = await apiClient.get('/workflows');

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

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- Rate limiting per user and globally
- Input validation and sanitization
- CORS protection
- Helmet security headers
- API key management
- Request logging and monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details

## 🆘 Support

For issues and questions:
- Check the logs in `backend/logs/`
- Verify environment configuration
- Test API endpoints at http://localhost:8000/docs
- Ensure MongoDB connection is working

### Common Issues

**MongoDB Connection Failed**
- Verify MONGODB_URI in .env
- Check network connectivity
- Ensure MongoDB Atlas whitelist includes your IP

**CORS Errors**
- Add your frontend application URL to CORS_ORIGIN in .env
- Restart the backend server

**Authentication Issues**
- Verify JWT_SECRET is set
- Check token expiration
- Ensure proper Authorization header format

---

🎉 **Ready to Integrate!** This microservice is now ready to power your AI workflow applications!
