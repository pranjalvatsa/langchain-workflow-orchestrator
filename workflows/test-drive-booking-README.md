# Test Drive Booking - Voice Agent Workflow

## Overview
This workflow implements an AI-powered voice agent for automotive test-drive booking. It handles the complete customer journey from greeting to booking confirmation with human approval checkpoints.

## Workflow Flow

```
Start → Greeting & Interest → Extract Preferences → Check Inventory
         ↓                                              ↓
    [No vehicles available]                    [Vehicles available]
         ↓                                              ↓
    Alt Response → End                      Schedule Collection
                                                       ↓
                                              Extract Booking Details
                                                       ↓
                                              Human Approval (HITL)
                                                  ↙        ↘
                                            [Approve]   [Reject]
                                                ↓          ↓
                                          Create Booking  Rejection
                                                ↓          ↓
                                          Send Confirmation
                                                ↓
                                          Confirmation Response
                                                ↓
                                               End
```

## Key Features

### 1. **Conversational AI Agents**
- **Greeting Agent**: Natural conversation to collect vehicle preferences
- **Schedule Agent**: Collects booking date/time and contact information
- Uses GPT-4 for natural, voice-optimized responses

### 2. **Intelligent Data Extraction**
- Parses natural language into structured JSON
- Extracts: vehicle type, brands, models, features, budget, urgency
- Validates and formats booking details

### 3. **Inventory Integration**
- Real-time availability check via API
- Alternative suggestions when exact match not available
- Location-based inventory filtering

### 4. **Human-in-the-Loop (HITL)**
- Sales team reviews each booking before confirmation
- Approve/Reject workflow with context
- Ensures quality control and prevents invalid bookings

### 5. **Multi-Channel Notifications**
- Email confirmation
- SMS confirmation
- CRM integration for sales team tracking

## API Integration Points

### Required APIs
1. **Inventory API** - Check vehicle availability
2. **CRM API** - Create booking records
3. **Notification API** - Send confirmations

### Environment Variables
```bash
OPENAI_API_KEY=your-openai-key
INVENTORY_API_KEY=your-inventory-api-key
CRM_API_KEY=your-crm-api-key
NOTIFICATION_API_KEY=your-notification-api-key
```

## How to Use

### 1. Create Workflow from Template

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d @workflows/test-drive-booking-workflow.json
```

Response:
```json
{
  "success": true,
  "workflowId": "67890abcdef",
  "message": "Workflow created successfully"
}
```

### 2. Execute Workflow (Triggered by Voice Call)

```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "workflowId": "67890abcdef",
    "inputs": {
      "dealershipLocation": "Downtown Showroom, 123 Main St",
      "callerId": "+1234567890",
      "callSource": "voice_system"
    },
    "context": {
      "sessionId": "call-session-12345",
      "platform": "voice_agent"
    }
  }'
```

Response:
```json
{
  "success": true,
  "executionId": "exec-abc123",
  "status": "waiting_human_review",
  "message": "Workflow paused at human approval step",
  "currentNode": "human-approval"
}
```

### 3. Get Pending Approvals

```bash
curl -X GET "http://localhost:3000/api/human-review/tasks?status=pending" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "task-xyz789",
      "executionId": "exec-abc123",
      "nodeId": "human-approval",
      "status": "pending",
      "title": "Sales Team Approval",
      "description": "Test Drive Booking Request",
      "data": {
        "customerName": "John Doe",
        "customerPhone": "+1234567890",
        "customerEmail": "john@example.com",
        "vehicleModel": "Tesla Model 3",
        "preferredDate": "2025-11-10",
        "preferredTime": "14:00"
      },
      "createdAt": "2025-11-05T10:30:00Z"
    }
  ]
}
```

### 4. Approve/Reject Booking

```bash
# Approve
curl -X POST http://localhost:3000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "taskId": "task-xyz789",
    "actionId": "approve",
    "feedback": "Booking confirmed - vehicle available"
  }'

# Reject
curl -X POST http://localhost:3000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "taskId": "task-xyz789",
    "actionId": "reject",
    "feedback": "Vehicle already booked for that time slot"
  }'
```

### 5. Get Workflow Execution Status

```bash
curl -X GET "http://localhost:3000/api/universal/workflows/executions/exec-abc123" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Voice System Integration

### Twilio Integration Example

```javascript
const twilio = require('twilio');
const axios = require('axios');

// Incoming call webhook
app.post('/voice/incoming', async (req, res) => {
  const callSid = req.body.CallSid;
  const from = req.body.From;
  
  // Start workflow
  const execution = await axios.post('http://localhost:3000/api/universal/workflows/execute', {
    workflowId: 'test-drive-workflow-id',
    inputs: {
      dealershipLocation: 'Downtown Showroom',
      callerId: from
    },
    context: {
      sessionId: callSid,
      platform: 'twilio'
    }
  });
  
  // Use first agent response
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say({
    voice: 'alice'
  }, execution.data.nodes['greeting-agent'].output);
  
  // Gather customer input
  const gather = twiml.gather({
    input: 'speech',
    timeout: 5,
    action: '/voice/process-input'
  });
  
  res.type('text/xml');
  res.send(twiml.toString());
});
```

### Integration with Custom Voice AI

```python
import requests
from your_voice_ai import VoiceAI

voice_ai = VoiceAI()

# Start workflow
response = requests.post('http://localhost:3000/api/universal/workflows/execute', 
  json={
    'workflowId': 'test-drive-workflow-id',
    'inputs': {
      'dealershipLocation': 'Downtown Showroom',
      'callerId': caller_number
    }
  },
  headers={'Authorization': f'Bearer {jwt_token}'}
)

execution_id = response.json()['executionId']

# Get agent prompts and respond
while workflow_active:
  # Voice AI handles speech-to-text
  user_speech = voice_ai.listen()
  
  # Continue workflow with user input
  step_response = requests.post(
    f'http://localhost:3000/api/universal/workflows/continue/{execution_id}',
    json={'userInput': user_speech}
  )
  
  # Voice AI speaks response
  agent_response = step_response.json()['currentNode']['output']
  voice_ai.speak(agent_response)
```

## Workflow Nodes Explained

### Agent Nodes (`agent_with_hitl`)
- **greeting-agent**: Conversational greeting + interest collection
- **schedule-preferences**: Date/time and contact collection
- **human-approval**: HITL checkpoint for sales team

### LLM Nodes
- **extract-preferences**: Parse conversation → structured JSON
- **extract-booking-details**: Parse scheduling → booking details
- **confirmation-response**: Generate final confirmation message
- **rejection-response**: Generate polite rejection message
- **not-available-response**: Offer alternatives when no match

### Tool Nodes
- **inventory-check**: API call to check vehicle availability
- **create-booking**: API call to CRM system
- **send-confirmation**: API call to notification service

### Condition Nodes
- **availability-check**: Route based on inventory availability

## Customization

### Modify Voice Personality
Edit the `systemPrompt` in agent nodes:

```json
{
  "systemPrompt": "You are a [personality]. Your tone is [tone]. Your goal is to [goal]..."
}
```

### Add More Vehicle Details
Extend the `extract-preferences` prompt to capture:
- Color preferences
- Interior features
- Financing interest
- Trade-in details

### Multi-Language Support
Add language detection and switch models:

```json
{
  "id": "detect-language",
  "type": "llm",
  "data": {
    "prompt": "Detect the language of: {{userInput}}. Return only: en|es|fr|de"
  }
}
```

### Integration with Calendar Systems
Replace `create-booking` with calendar API:

```json
{
  "toolName": "api_caller",
  "parameters": {
    "url": "https://your-calendar.com/events",
    "method": "POST",
    "body": {
      "summary": "Test Drive: {{vehicleModel}}",
      "start": "{{preferredDate}}T{{preferredTime}}",
      "attendees": ["{{customerEmail}}", "sales@dealership.com"]
    }
  }
}
```

## Monitoring & Analytics

### Track Conversion Metrics

```bash
# Get all executions for this workflow
curl -X GET "http://localhost:3000/api/universal/workflows/executions?workflowId=67890abcdef" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Key Metrics to Track
- Total calls processed
- Conversion rate (calls → bookings)
- Average call duration
- Most requested vehicle types
- Approval vs rejection rate
- Time to human approval

## Troubleshooting

### Workflow Stuck at HITL Node
Check pending tasks:
```bash
curl -X GET "http://localhost:3000/api/human-review/tasks?executionId=exec-abc123"
```

### Voice Responses Too Long
Reduce `maxTokens` in agent config:
```json
{
  "maxTokens": 200  // Shorter responses
}
```

### Inventory API Failures
Add error handling node and fallback:
```json
{
  "configuration": {
    "errorHandling": {
      "onError": "fallback_to_manual",
      "retryCount": 3
    }
  }
}
```

## Next Steps

1. **Test the workflow**: Execute with sample data
2. **Integrate with your voice platform**: Twilio, Vapi, Retell, etc.
3. **Connect real APIs**: Inventory, CRM, notifications
4. **Train sales team**: On using the approval dashboard
5. **Monitor and optimize**: Track metrics and improve prompts

## Support

For questions or issues:
- Check logs: `GET /api/universal/workflows/executions/{executionId}/logs`
- Review documentation: See main README.md
- Test individual nodes: Use the workflow debugger
