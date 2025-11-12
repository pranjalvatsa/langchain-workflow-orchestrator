# Testing Test Drive Workflow with VAPI

## What is VAPI?

VAPI is a voice AI platform that provides:
- **Phone numbers** for inbound/outbound calls
- **Voice AI agents** with GPT-4, ElevenLabs, etc.
- **Function calling** to trigger your workflows
- **WebSockets** for real-time conversation
- **Built-in STT/TTS** - No need for separate Whisper/TTS nodes

## 🎯 Architecture: VAPI + Your Workflow

```
Phone Call → VAPI (Voice Agent) → Function Call → Your Workflow (HITL) → Response
```

### Why This Works Better
- ✅ VAPI handles all voice conversation
- ✅ Your workflow handles **business logic + human approval**
- ✅ VAPI calls your workflow when booking is ready
- ✅ Sales team approves via your dashboard
- ✅ VAPI continues conversation with result

---

## 🚀 Quick Setup (15 Minutes)

### Step 1: Sign Up for VAPI

1. Go to https://vapi.ai
2. Create account
3. Get API key from dashboard
4. Get a phone number (optional for testing)

### Step 2: Create VAPI Assistant

**Option A: Via Dashboard (Easiest)**

1. Go to **Assistants** → **Create New Assistant**
2. Configure:

```yaml
Name: Test Drive Booking Agent
Model: gpt-4
Voice: ElevenLabs - Rachel (or any voice you like)
First Message: "Hi! Thanks for calling. I'd love to help you schedule a test drive. What kind of vehicle are you interested in today?"

System Prompt:
You are a friendly automotive sales agent for a car dealership. Your goal is to help customers book test drives.

CONVERSATION FLOW:
1. Greet the customer warmly
2. Ask what type of vehicle they're interested in (car, bike, SUV, electric, etc.)
3. Ask about specific preferences (brand, model, features)
4. Collect their contact information (name, phone, email)
5. Ask for their preferred date and time
6. Once you have all information, call the create_booking function

Be conversational, friendly, and brief. Each response should be 2-3 sentences max.

Required information to collect:
- Vehicle type and model preferences
- Customer name
- Customer phone
- Customer email  
- Preferred date
- Preferred time

Once you have all this, call create_booking function.
```

3. Add **Function** (Tool):

```json
{
  "name": "create_booking",
  "description": "Creates a test drive booking and submits for approval",
  "parameters": {
    "type": "object",
    "required": [
      "customerName",
      "customerPhone",
      "customerEmail",
      "vehicleType",
      "vehicleModel",
      "preferredDate",
      "preferredTime"
    ],
    "properties": {
      "customerName": {
        "type": "string",
        "description": "Customer's full name"
      },
      "customerPhone": {
        "type": "string",
        "description": "Customer's phone number"
      },
      "customerEmail": {
        "type": "string",
        "description": "Customer's email address"
      },
      "vehicleType": {
        "type": "string",
        "description": "Type of vehicle (car, bike, SUV, electric, etc.)"
      },
      "vehicleModel": {
        "type": "string",
        "description": "Specific vehicle model they want to test drive"
      },
      "preferredDate": {
        "type": "string",
        "description": "Preferred date in YYYY-MM-DD format"
      },
      "preferredTime": {
        "type": "string",
        "description": "Preferred time in HH:MM format (24-hour)"
      },
      "additionalNotes": {
        "type": "string",
        "description": "Any additional notes or requirements"
      }
    }
  },
  "url": "https://your-server.com/api/vapi/create-booking",
  "method": "POST"
}
```

**Option B: Via API (Automated)**

```javascript
// create-vapi-assistant.js
const axios = require('axios');

async function createVAPIAssistant() {
  const response = await axios.post('https://api.vapi.ai/assistant', {
    name: 'Test Drive Booking Agent',
    model: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      systemPrompt: `You are a friendly automotive sales agent for a car dealership. Your goal is to help customers book test drives.

CONVERSATION FLOW:
1. Greet the customer warmly
2. Ask what type of vehicle they're interested in
3. Ask about specific preferences (brand, model, features)
4. Collect contact information (name, phone, email)
5. Ask for preferred date and time
6. Once you have all information, call the create_booking function

Be conversational, friendly, and brief. Each response should be 2-3 sentences max.`,
      functions: [
        {
          name: 'create_booking',
          description: 'Creates a test drive booking and submits for approval',
          parameters: {
            type: 'object',
            required: ['customerName', 'customerPhone', 'customerEmail', 'vehicleType', 'vehicleModel', 'preferredDate', 'preferredTime'],
            properties: {
              customerName: { type: 'string', description: 'Customer full name' },
              customerPhone: { type: 'string', description: 'Customer phone' },
              customerEmail: { type: 'string', description: 'Customer email' },
              vehicleType: { type: 'string', description: 'Vehicle type (car/bike/SUV/electric)' },
              vehicleModel: { type: 'string', description: 'Specific model' },
              preferredDate: { type: 'string', description: 'Date in YYYY-MM-DD' },
              preferredTime: { type: 'string', description: 'Time in HH:MM' },
              additionalNotes: { type: 'string', description: 'Additional notes' }
            }
          },
          url: 'https://your-server.com/api/vapi/create-booking',
          method: 'POST'
        }
      ]
    },
    voice: {
      provider: 'elevenlabs',
      voiceId: 'rachel' // Or: 'nova', 'alloy', 'echo', etc.
    },
    firstMessage: "Hi! Thanks for calling. I'd love to help you schedule a test drive. What kind of vehicle are you interested in today?"
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('✅ VAPI Assistant created:', response.data.id);
  console.log('Phone number:', response.data.phoneNumber);
  return response.data;
}

createVAPIAssistant().catch(console.error);
```

Run:
```bash
export VAPI_API_KEY="your-vapi-key"
node create-vapi-assistant.js
```

---

### Step 3: Create Webhook Endpoint

VAPI will call this when the assistant uses `create_booking` function:

```javascript
// Add to your server.js or create new routes/vapi.js

const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * VAPI Function Call Webhook
 * Called when VAPI assistant invokes create_booking function
 */
router.post('/vapi/create-booking', async (req, res) => {
  try {
    console.log('📞 VAPI booking request:', req.body);
    
    const {
      customerName,
      customerPhone,
      customerEmail,
      vehicleType,
      vehicleModel,
      preferredDate,
      preferredTime,
      additionalNotes
    } = req.body.message.functionCall.parameters;
    
    const callId = req.body.message.call?.id;
    
    // Execute your workflow (skip voice nodes, go straight to approval)
    const execution = await axios.post('http://localhost:3000/api/universal/workflows/execute', {
      workflowId: process.env.TEST_DRIVE_WORKFLOW_ID,
      inputs: {
        // Skip to human approval with all data
        skipToNode: 'human-approval',
        customerPreferences: {
          vehicleType,
          models: [vehicleModel],
          urgency: 'high'
        },
        schedulingInfo: {
          customerName,
          customerPhone,
          customerEmail,
          preferredDate,
          preferredTime,
          additionalNotes
        },
        dealershipLocation: 'Downtown Showroom',
        vapiCallId: callId
      },
      context: {
        source: 'vapi',
        callId
      }
    });
    
    console.log('✅ Workflow triggered:', execution.data.executionId);
    
    // Respond to VAPI - this is what the assistant will say
    res.json({
      result: `Perfect! I've submitted your request for a test drive of the ${vehicleModel} on ${preferredDate} at ${preferredTime}. Our team will review this and call you back within the next hour to confirm. Is there anything else I can help you with?`
    });
    
  } catch (error) {
    console.error('❌ Error creating booking:', error);
    
    // VAPI will speak this error message
    res.json({
      result: "I apologize, but I'm having trouble processing your booking right now. Could you please call back in a few minutes, or would you prefer to leave your contact information for a callback?"
    });
  }
});

/**
 * VAPI Call Status Webhook (Optional)
 * Get notified when call starts, ends, etc.
 */
router.post('/vapi/status', async (req, res) => {
  const { type, call } = req.body;
  
  console.log(`📞 VAPI Call ${type}:`, call.id);
  
  if (type === 'call-ended') {
    // Log call metrics
    console.log('Call duration:', call.duration);
    console.log('Call cost:', call.cost);
  }
  
  res.sendStatus(200);
});

module.exports = router;
```

**Add to server.js:**
```javascript
const vapiRoutes = require('./src/routes/vapi');
app.use('/api', vapiRoutes);
```

---

### Step 4: Configure VAPI Webhooks

In VAPI Dashboard:
1. Go to your Assistant
2. Under **Server URL** → Set function URL:
   ```
   https://your-server.com/api/vapi/create-booking
   ```
3. Under **Webhooks** → Add status webhook:
   ```
   https://your-server.com/api/vapi/status
   ```

**Using ngrok for local testing:**
```bash
# Install ngrok
brew install ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL in VAPI
https://abc123.ngrok.io/api/vapi/create-booking
```

---

## 🧪 Testing the Integration

### Test 1: Web Call (Easiest)

VAPI provides a web interface for testing:

1. Go to VAPI Dashboard
2. Find your assistant
3. Click **"Test Call"**
4. Speak to the agent:
   - "Hi, I want to test drive a Tesla Model 3"
   - "My name is John Doe"
   - "My phone is 555-0123"
   - "My email is john@example.com"
   - "I'd like to come in this Saturday at 2 PM"

5. Agent should call your webhook
6. Check your server logs
7. Check pending approvals:
   ```bash
   curl -X GET "http://localhost:3000/api/human-review/tasks?status=pending"
   ```

### Test 2: Phone Call

1. Get phone number from VAPI dashboard
2. Call the number
3. Have conversation with agent
4. Agent triggers workflow
5. Sales team approves via dashboard
6. (Optional) VAPI can call customer back with confirmation

### Test 3: Programmatic Call

```javascript
// make-test-call.js
const axios = require('axios');

async function makeTestCall() {
  const response = await axios.post('https://api.vapi.ai/call/phone', {
    assistantId: 'YOUR_ASSISTANT_ID',
    phoneNumber: '+1-555-0123', // Customer's number
    customer: {
      name: 'John Doe'
    }
  }, {
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
    }
  });
  
  console.log('📞 Call initiated:', response.data.id);
}

makeTestCall().catch(console.error);
```

---

## 🔄 Complete Flow Example

### What Happens Step-by-Step

```
1. Customer calls VAPI phone number
   ↓
2. VAPI: "Hi! What vehicle are you interested in?"
   ↓
3. Customer: "I want to test drive a Tesla Model 3"
   ↓
4. VAPI: "Great choice! Can I get your name?"
   ↓
5. Customer provides: name, phone, email, date, time
   ↓
6. VAPI calls create_booking function
   ↓
7. Your webhook receives data
   ↓
8. Webhook triggers your workflow (human-approval node)
   ↓
9. Task created for sales team
   ↓
10. VAPI: "Perfect! Our team will confirm shortly."
    ↓
11. Call ends
    ↓
12. Sales team sees task in dashboard
    ↓
13. Sales team approves/rejects
    ↓
14. Workflow continues (creates booking, sends confirmation)
    ↓
15. (Optional) Trigger VAPI outbound call to confirm
```

---

## 🎯 Advanced: Two-Way Integration

### Callback After Approval

When sales team approves, call customer back via VAPI:

```javascript
// In your humanReview.js route
router.post('/human-review/complete', async (req, res) => {
  const { taskId, actionId, feedback } = req.body;
  
  // ... existing approval logic ...
  
  if (actionId === 'approve') {
    const task = await Task.findById(taskId);
    const vapiCallId = task.metadata.vapiCallId;
    const customerPhone = task.data.customerPhone;
    
    // Make outbound call to confirm
    const confirmationCall = await axios.post('https://api.vapi.ai/call/phone', {
      assistantId: process.env.VAPI_CONFIRMATION_ASSISTANT_ID,
      phoneNumber: customerPhone,
      assistantOverrides: {
        firstMessage: `Hi ${task.data.customerName}! This is a confirmation call for your test drive. We're all set for ${task.data.preferredDate} at ${task.data.preferredTime}. See you then!`
      }
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_API_KEY}`
      }
    });
    
    console.log('📞 Confirmation call made:', confirmationCall.data.id);
  }
  
  res.json({ success: true });
});
```

### Real-Time Status Updates

Use VAPI webhooks to track conversation:

```javascript
router.post('/vapi/status', async (req, res) => {
  const { type, call, transcript } = req.body;
  
  switch(type) {
    case 'call-started':
      console.log('📞 Call started:', call.id);
      break;
      
    case 'function-call':
      console.log('🔧 Function called:', transcript.functionCall.name);
      break;
      
    case 'transcript':
      console.log('💬 Transcript:', transcript.text);
      // Log to your database for analytics
      break;
      
    case 'call-ended':
      console.log('📞 Call ended. Duration:', call.duration);
      console.log('Cost:', call.cost);
      break;
  }
  
  res.sendStatus(200);
});
```

---

## 📊 Monitoring & Analytics

### Track Key Metrics

```javascript
// Track VAPI calls and workflow conversions
router.post('/vapi/create-booking', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Execute workflow
    const execution = await executeWorkflow(/* ... */);
    
    // Log metrics
    await Analytics.create({
      type: 'vapi_booking',
      callId: req.body.message.call?.id,
      executionId: execution.data.executionId,
      customerData: {
        vehicleType: req.body.message.functionCall.parameters.vehicleType,
        vehicleModel: req.body.message.functionCall.parameters.vehicleModel
      },
      processingTime: Date.now() - startTime,
      status: 'pending_approval'
    });
    
    res.json({ result: 'Booking submitted...' });
  } catch (error) {
    // Log failure
    await Analytics.create({
      type: 'vapi_booking_failed',
      error: error.message,
      processingTime: Date.now() - startTime
    });
    
    res.json({ result: 'Error message...' });
  }
});
```

### Dashboard Queries

```javascript
// Get conversion rate
const totalCalls = await Analytics.count({ type: 'vapi_booking' });
const approvedBookings = await Analytics.count({ 
  type: 'vapi_booking',
  finalStatus: 'approved'
});
const conversionRate = (approvedBookings / totalCalls) * 100;

// Most requested vehicles
const popularVehicles = await Analytics.aggregate([
  { $match: { type: 'vapi_booking' } },
  { $group: {
      _id: '$customerData.vehicleModel',
      count: { $sum: 1 }
  }},
  { $sort: { count: -1 } },
  { $limit: 10 }
]);
```

---

## 🔧 Simplified Workflow for VAPI

Since VAPI handles all voice interaction, simplify your workflow to just:

```json
{
  "name": "Test Drive Approval - VAPI Edition",
  "nodes": [
    {
      "id": "start",
      "type": "start"
    },
    {
      "id": "check-inventory",
      "type": "tool",
      "data": {
        "toolName": "api_caller",
        "parameters": {
          "url": "https://your-api.com/inventory/check",
          "body": {
            "model": "{{inputs.schedulingInfo.vehicleModel}}"
          }
        }
      }
    },
    {
      "id": "human-approval",
      "type": "agent_with_hitl",
      "data": {
        "label": "Sales Team Approval",
        "metadata": { "interruptType": "langgraph_hitl" }
      }
    },
    {
      "id": "create-booking",
      "type": "tool",
      "data": {
        "toolName": "api_caller",
        "parameters": {
          "url": "https://your-crm.com/bookings",
          "method": "POST"
        }
      }
    },
    {
      "id": "send-confirmation",
      "type": "tool"
    },
    {
      "id": "end",
      "type": "end"
    }
  ]
}
```

**No STT/TTS nodes needed!** VAPI handles all voice.

---

## 💰 Cost Estimate

### VAPI Pricing (approximate)
- **Inbound calls**: ~$0.05/min
- **Outbound calls**: ~$0.10/min
- **Phone number**: ~$5/month

### Your Workflow
- **OpenAI API** (GPT-4 for approval text): ~$0.01/request
- **Your server**: Minimal cost

### Total Cost Per Call
- **3-minute call**: ~$0.15-$0.30
- **Much cheaper than human receptionist!**

---

## 🚀 Deployment Checklist

- [ ] VAPI assistant created
- [ ] Webhook endpoint deployed (publicly accessible)
- [ ] Workflow created in your system
- [ ] Environment variables set (VAPI_API_KEY, TEST_DRIVE_WORKFLOW_ID)
- [ ] Tested web call successfully
- [ ] Tested phone call successfully
- [ ] Sales team has approval dashboard access
- [ ] Monitoring/analytics configured
- [ ] Error handling tested
- [ ] Customer confirmation emails working

---

## 📚 Resources

- [VAPI Documentation](https://docs.vapi.ai)
- [VAPI Function Calling Guide](https://docs.vapi.ai/assistants/function-calling)
- [VAPI Webhooks](https://docs.vapi.ai/webhooks)
- [Example VAPI Projects](https://github.com/VAPIai/examples)

---

## 🐛 Troubleshooting

### Issue: VAPI not calling webhook

**Check:**
1. Webhook URL is publicly accessible (test with curl)
2. URL is HTTPS (required by VAPI)
3. Server is responding with 200 status
4. Check VAPI logs in dashboard

### Issue: Function not being called

**Check:**
1. Function parameters are clear in description
2. System prompt instructs to call function
3. All required parameters are collected
4. Test with explicit instruction: "Now create the booking"

### Issue: Workflow not triggering

**Check server logs:**
```bash
tail -f logs/app.log | grep vapi
```

**Test webhook directly:**
```bash
curl -X POST http://localhost:3000/api/vapi/create-booking \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "functionCall": {
        "parameters": {
          "customerName": "Test User",
          "customerPhone": "+1-555-0123",
          "customerEmail": "test@example.com",
          "vehicleType": "electric",
          "vehicleModel": "Tesla Model 3",
          "preferredDate": "2025-11-10",
          "preferredTime": "14:00"
        }
      }
    }
  }'
```

---

Ready to test? Let me know if you need help with any step!
