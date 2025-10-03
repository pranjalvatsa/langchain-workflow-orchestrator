# 🔑 API Key System for Universal Workflow Engine

## ✅ **Implementation Complete**

Your Universal Workflow Engine now has a **comprehensive API key system** that allows Noam to securely access all workflow engine APIs.

---

## 🎯 **Key Features Implemented**

### ✅ **API Key Generation**
- **Endpoint**: `POST /api/keys/generate`
- **Secure Format**: `lwo_keyId_hash` (e.g., `lwo_b77d50cd8b33711bb9ccf08adec4bc6a_817ae...`)
- **Database Storage**: MongoDB with hashed keys for security
- **Noam Integration**: Specific support for Noam account tracking

### ✅ **Authentication & Security**
- **Header-based**: Use `X-API-Key` header
- **Rate Limiting**: 1000/min, 10000/hour, 100000/day
- **Expiration**: Configurable (default 1 year)
- **Permissions**: Granular resource-based permissions
- **Usage Tracking**: Request counts and last used timestamps

### ✅ **Universal Engine Access**
- **Protected Endpoints**: All universal workflow endpoints require authentication
- **Scopes**: `universal:read`, `universal:write`, `universal:execute`
- **Templates**: Import/export workflow templates from Noam
- **Real-time**: Bi-directional workflow execution and notifications

---

## 🚀 **For Noam Integration**

### **Step 1: Generate API Key**
```bash
# First, authenticate as user
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "noam@yourcompany.com",
    "password": "SecurePassword123",
    "firstName": "Noam",
    "lastName": "User",
    "noamUserId": "noam_user_123"
  }'

# Extract accessToken from response, then generate API key
curl -X POST http://localhost:8000/api/keys/generate \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Noam Integration Key",
    "description": "API key for Noam app to access Universal Workflow Engine",
    "noamAccountId": "noam_account_123",
    "expiresIn": "1y"
  }'
```

**Response includes:**
- Full API key (only shown once)
- Key ID for tracking
- Permissions and scopes
- Rate limits
- Integration endpoints

### **Step 2: Use API Key in Noam**
```javascript
// In Noam app
const API_KEY = 'lwo_your_generated_api_key_here';
const WORKFLOW_ENGINE_BASE = 'https://your-domain.com/api';

// Example: Execute workflow
const response = await fetch(`${WORKFLOW_ENGINE_BASE}/universal/workflows/execute`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    templateId: 'call-deflection-v1',
    input: {
      callTranscript: 'Customer complaint',
      customerPhone: '+1234567890'
    }
  })
});
```

### **Step 3: Import ReactFlow Workflows**
```javascript
// Import workflow created in Noam's ReactFlow canvas
const importResponse = await fetch(`${WORKFLOW_ENGINE_BASE}/templates/import/reactflow`, {
  method: 'POST',
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    workflow: {
      name: 'Customer Support Automation',
      description: 'Created in Noam canvas',
      category: 'customer-service',
      nodes: [...], // ReactFlow nodes
      edges: [...]  // ReactFlow edges
    },
    noamMetadata: {
      noamWorkflowId: 'noam-workflow-123',
      noamUserId: 'user-456',
      noamAccountId: 'account-789'
    }
  })
});
```

---

## 📊 **API Key Management**

### **List API Keys**
```bash
curl -X GET http://localhost:8000/api/keys \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### **Monitor Usage**
API keys automatically track:
- Total requests
- Last used timestamp
- Rate limit usage
- Associated Noam account

### **Security Features**
- ✅ Keys are hashed in database (never stored in plain text)
- ✅ Rate limiting prevents abuse
- ✅ Expiration dates for automatic cleanup
- ✅ Scope-based permissions
- ✅ User association for audit trails

---

## 🎯 **Available Endpoints for Noam**

### **Universal Workflow Engine**
- `POST /api/universal/workflows/execute` - Execute any workflow
- `POST /api/universal/workflows/schedule` - Schedule workflows
- `POST /api/universal/workflows/trigger` - Event-triggered workflows
- `GET /api/universal/tools` - List available tools

### **Template Management**
- `GET /api/templates` - List workflow templates
- `POST /api/templates/import/reactflow` - Import from Noam
- `POST /api/templates/import/noam` - Export to Noam

### **Bi-directional Integration**
- Automatic task notifications to Noam when workflows execute
- Real-time status updates
- Workflow progress tracking

---

## ✅ **Test Results**

✅ **User Registration**: Working  
✅ **API Key Generation**: Working  
✅ **Database Storage**: Working  
✅ **Authentication**: Working  
✅ **Universal Engine Access**: Working  
✅ **Rate Limiting**: Working  
✅ **Security (Invalid Key Rejection)**: Working  
✅ **Bi-directional Integration**: Ready  

---

## 🔐 **Security Best Practices**

1. **Store API keys securely** in Noam's environment variables
2. **Use HTTPS** in production for all API calls
3. **Monitor rate limits** and implement exponential backoff
4. **Rotate keys regularly** (yearly expiration recommended)
5. **Track usage** via the API key management endpoints

---

**Your Universal Workflow Engine is now ready for secure Noam integration!** 🎉