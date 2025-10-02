# 🚀 Deployment Guide: LangChain Workflow Backend to Render

This guide will help you deploy the LangChain Workflow orchestrator to Render for integration with your Noam app.

## 📋 Prerequisites

1. **GitHub Account** - Your code needs to be in a GitHub repository
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **MongoDB Atlas** - For database hosting (or use Render's MongoDB)
4. **OpenAI API Key** - For AI workflow capabilities

## 🛠️ Step 1: Prepare Your Repository

1. **Initialize Git** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit - LangChain Workflow Backend"
   ```

2. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/yourusername/langchain-workflow-orchestrator.git
   git branch -M main
   git push -u origin main
   ```

## 🗄️ Step 2: Set Up MongoDB Database

### Option A: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (free tier available)
3. Get your connection string: `mongodb+srv://username:password@cluster.mongodb.net/langchain-workflows`

### Option B: Render MongoDB
1. In Render dashboard, create a new MongoDB database
2. Note the connection string provided

## 🌐 Step 3: Deploy to Render

1. **Connect GitHub Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `langchain-workflow-orchestrator` repository

2. **Configure Service Settings**:
   - **Name**: `langchain-workflow-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Starter` (free tier)

3. **Set Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   MONGODB_URI=your-mongodb-connection-string
   OPENAI_API_KEY=your-openai-api-key
   JWT_SECRET=your-secure-jwt-secret
   FRONTEND_URL=https://your-noam-app.vercel.app
   NOAM_APP_URL=https://your-noam-app.vercel.app
   LOG_LEVEL=info
   ```

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete (~5-10 minutes)

## 🔗 Step 4: Configure Noam App Integration

Your deployed API will be available at:
```
https://your-service-name.onrender.com
```

### Key Endpoints for Noam Integration:

1. **Health Check**:
   ```
   GET https://your-service-name.onrender.com/health
   ```

2. **Start Customer Offer Workflow**:
   ```
   POST https://your-service-name.onrender.com/api/customer-workflows/offer-prediction
   Headers: Authorization: Bearer YOUR_TOKEN
   Body: {
     "customerId": "CUST_12345",
     "assignee": "user@company.com"
   }
   ```

3. **Monitor Workflow Progress**:
   ```
   GET https://your-service-name.onrender.com/api/customer-workflows/executions/{executionId}/status
   ```

4. **Webhook for Task Completion** (Noam → Backend):
   ```
   POST https://your-service-name.onrender.com/api/customer-workflows/webhooks/noam-task
   Body: {
     "taskId": "TASK_123",
     "status": "completed",
     "decision": "approved",
     "feedback": "Looks good!"
   }
   ```

## 🔧 Step 5: Update Noam App Configuration

In your Noam app, update the API base URL:

```javascript
// In your Noam app configuration
const API_BASE_URL = 'https://your-service-name.onrender.com';

// Example API call from Noam
const startWorkflow = async (customerId, assignee) => {
  const response = await fetch(`${API_BASE_URL}/api/customer-workflows/offer-prediction`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      customerId,
      assignee
    })
  });
  
  return response.json();
};
```

## 🧪 Step 6: Test the Deployment

1. **Test Health Endpoint**:
   ```bash
   curl https://your-service-name.onrender.com/health
   ```
   Expected response:
   ```json
   {
     "status": "ok",
     "message": "LangChain Backend is running",
     "timestamp": "2025-10-02T10:00:00.000Z",
     "version": "1.0.0"
   }
   ```

2. **Test Workflow Templates**:
   ```bash
   curl https://your-service-name.onrender.com/api/templates
   ```

3. **Test Integration with Noam**:
   - Create a test customer offer workflow
   - Monitor the execution progress
   - Verify webhook callbacks work

## 🎯 Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Application environment | Yes | `production` |
| `PORT` | Server port | No | `10000` |
| `MONGODB_URI` | Database connection | Yes | `mongodb+srv://...` |
| `OPENAI_API_KEY` | OpenAI API key | Yes | `sk-...` |
| `JWT_SECRET` | JWT signing secret | Yes | `your-secret-key` |
| `FRONTEND_URL` | Noam app URL | Yes | `https://your-noam-app.vercel.app` |
| `NOAM_APP_URL` | Noam app base URL | No | Same as FRONTEND_URL |
| `LOG_LEVEL` | Logging level | No | `info` |

## 🔒 Security Considerations

1. **API Keys**: Never commit API keys to git. Use Render's environment variables.
2. **CORS**: The app is configured to only allow requests from your Noam app URL.
3. **Rate Limiting**: 100 requests per 15 minutes per IP by default.
4. **JWT**: Secure JWT secrets are required for authentication.

## 📊 Monitoring and Logs

1. **Render Logs**: View real-time logs in Render dashboard
2. **Health Monitoring**: Automatic health checks on `/health`
3. **Error Tracking**: All errors logged to files and console

## 🚨 Troubleshooting

### Common Issues:

1. **Build Fails**:
   - Check Node.js version compatibility
   - Verify all dependencies are listed in package.json
   - Check build logs for specific errors

2. **Database Connection Issues**:
   - Verify MongoDB URI is correct
   - Check IP whitelist in MongoDB Atlas
   - Ensure database exists

3. **CORS Errors**:
   - Verify FRONTEND_URL matches your Noam app domain
   - Check Noam app is making requests to correct URL

4. **Authentication Issues**:
   - Ensure JWT_SECRET is set
   - Verify API tokens are being sent correctly

### Getting Help:

- Check Render logs for detailed error messages
- Use the health endpoint to verify service status
- Test individual endpoints with curl/Postman

## ✅ Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] MongoDB database created and configured
- [ ] Render web service created and deployed
- [ ] All environment variables set
- [ ] Health endpoint responding
- [ ] Noam app updated with new API URL
- [ ] Test workflow execution working
- [ ] Webhook integration tested

Your LangChain Workflow Backend is now ready for production use with your Noam app! 🎉