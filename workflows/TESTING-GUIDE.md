# Testing the Test Drive Booking Workflow

## Quick Start - Test in 5 Minutes

### Step 1: Start Your Server

```bash
cd /Users/pranjalvatsa/Documents/Projects/langchain-workflow-orchestrator
node server.js
```

Expected output:
```
Server running on port 3000
MongoDB connected
```

---

### Step 2: Create the Workflow

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d @workflows/test-drive-booking-workflow.json
```

**Response:**
```json
{
  "success": true,
  "workflowId": "6729abc123def456",
  "message": "Workflow created successfully"
}
```

💡 **Save the `workflowId`** - you'll need it for testing!

---

### Step 3: Test Without Voice (Simplified)

Since voice testing requires audio files, let's first test with **text simulation**:

```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "YOUR_WORKFLOW_ID_HERE",
    "inputs": {
      "dealershipLocation": "Downtown Showroom, 123 Main St",
      "customerInput": "I am interested in a Tesla Model 3",
      "skipVoice": true
    },
    "context": {
      "testMode": true
    }
  }'
```

---

## 🎯 Complete Testing Scenarios

### Scenario 1: Happy Path - Successful Booking

**Input:**
```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "YOUR_WORKFLOW_ID",
    "inputs": {
      "dealershipLocation": "Downtown Showroom",
      "customerPreferences": {
        "vehicleType": "electric",
        "brands": ["Tesla", "Rivian"],
        "models": ["Model 3", "R1T"],
        "features": ["autopilot", "long range"],
        "budgetRange": "$40,000-$60,000",
        "urgency": "high"
      },
      "schedulingInfo": {
        "customerName": "John Doe",
        "customerPhone": "+1-555-0123",
        "customerEmail": "john.doe@example.com",
        "preferredDate": "2025-11-10",
        "preferredTime": "14:00",
        "additionalNotes": "First time electric car buyer"
      }
    }
  }'
```

**Expected Flow:**
1. ✅ Extracts preferences
2. ✅ Checks inventory → Available
3. ✅ Collects schedule
4. ⏸️ **PAUSES at human approval** (creates Task)
5. ⏳ Waiting for sales team...

**Check Pending Tasks:**
```bash
curl -X GET "http://localhost:3000/api/human-review/tasks?status=pending" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "tasks": [
    {
      "taskId": "task-abc123",
      "executionId": "exec-xyz789",
      "nodeId": "human-approval",
      "status": "pending",
      "title": "Sales Team Approval",
      "description": "Test Drive Booking Request",
      "data": {
        "customerName": "John Doe",
        "customerPhone": "+1-555-0123",
        "customerEmail": "john.doe@example.com",
        "vehicleModel": "Tesla Model 3",
        "preferredDate": "2025-11-10",
        "preferredTime": "14:00"
      },
      "createdAt": "2025-11-05T10:30:00.000Z"
    }
  ]
}
```

**Approve the Booking:**
```bash
curl -X POST http://localhost:3000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-abc123",
    "actionId": "approve",
    "feedback": "Vehicle available, booking confirmed"
  }'
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Workflow resumed successfully",
  "execution": {
    "status": "completed",
    "finalOutput": "Your test drive for Tesla Model 3 is confirmed for November 10th at 2:00 PM..."
  }
}
```

---

### Scenario 2: Rejection Path - Booking Declined

**Approve the booking but with rejection:**
```bash
curl -X POST http://localhost:3000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-abc123",
    "actionId": "reject",
    "feedback": "Vehicle already booked for that time slot"
  }'
```

**Expected Result:**
- Workflow continues to `rejection-response` node
- Generates polite rejection message
- Ends with "Call Completed - Not Booked"

---

### Scenario 3: No Vehicle Available

**Input with unavailable vehicle:**
```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "YOUR_WORKFLOW_ID",
    "inputs": {
      "customerPreferences": {
        "vehicleType": "supercar",
        "brands": ["Bugatti"],
        "models": ["Chiron"],
        "budgetRange": "$3,000,000+"
      }
    }
  }'
```

**Expected Flow:**
1. Checks inventory
2. No vehicles available (condition fails)
3. Goes to `not-available-response` node
4. Suggests alternatives
5. Ends with "Call Completed - No Availability"

---

## 🎙️ Testing With Real Voice

### Option A: Test with Pre-recorded Audio File

**1. Create a test audio file:**

Record yourself saying:
> "Hi, I'm interested in test driving a Tesla Model 3. I'd like to schedule for this Saturday around 2 PM. My name is John Doe, my phone is 555-0123, and email is john@example.com."

Save as `test-customer-voice.mp3`

**2. Upload to accessible URL:**
```bash
# Using a simple file server
npx http-server . -p 8080

# Or upload to S3, Cloudinary, etc.
```

**3. Execute workflow with audio:**
```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "YOUR_WORKFLOW_ID",
    "inputs": {
      "audioFile": "http://localhost:8080/test-customer-voice.mp3",
      "dealershipLocation": "Downtown Showroom"
    }
  }'
```

**Expected:**
- Whisper transcribes audio
- GPT-4o processes text
- TTS generates response audio
- Returns audio URL in response

---

### Option B: Test with OpenAI Whisper Directly

**1. Install OpenAI SDK:**
```bash
npm install openai
```

**2. Create test script:**

```javascript
// test-voice-workflow.js
const OpenAI = require('openai');
const fs = require('fs');
const axios = require('axios');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testVoiceWorkflow() {
  // Step 1: Convert voice to text
  console.log('📝 Transcribing audio...');
  
  const transcription = await openai.audio.transcriptions.create({
    file: fs.createReadStream('./test-audio.mp3'),
    model: 'whisper-1'
  });
  
  console.log('Customer said:', transcription.text);
  
  // Step 2: Execute workflow with transcription
  console.log('\n🚀 Executing workflow...');
  
  const response = await axios.post('http://localhost:3000/api/universal/workflows/execute', {
    workflowId: 'YOUR_WORKFLOW_ID',
    inputs: {
      transcribedText: transcription.text,
      dealershipLocation: 'Downtown Showroom'
    }
  });
  
  console.log('\n✅ Workflow result:', response.data);
  
  // Step 3: Convert response to speech
  if (response.data.agentResponse) {
    console.log('\n🔊 Generating voice response...');
    
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'nova',
      input: response.data.agentResponse
    });
    
    const buffer = Buffer.from(await mp3.arrayBuffer());
    fs.writeFileSync('./agent-response.mp3', buffer);
    
    console.log('✅ Voice response saved to agent-response.mp3');
  }
}

testVoiceWorkflow().catch(console.error);
```

**3. Run test:**
```bash
node test-voice-workflow.js
```

---

### Option C: Test with Twilio (Live Phone Call)

**1. Install Twilio:**
```bash
npm install twilio
```

**2. Create Twilio webhook:**

```javascript
// Add to your server.js or create new file
const twilio = require('twilio');

app.post('/voice/incoming', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Greet and record
  twiml.say({
    voice: 'Polly.Joanna'
  }, 'Hi! Thanks for calling. What vehicle are you interested in test driving?');
  
  twiml.record({
    maxLength: 30,
    action: '/voice/process-recording',
    transcribe: false
  });
  
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/voice/process-recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  
  console.log('📞 Processing customer voice:', recordingUrl);
  
  try {
    // Execute workflow
    const execution = await axios.post('http://localhost:3000/api/universal/workflows/execute', {
      workflowId: process.env.TEST_DRIVE_WORKFLOW_ID,
      inputs: {
        audioFile: recordingUrl + '.mp3',
        callSid: req.body.CallSid,
        dealershipLocation: 'Downtown Showroom'
      }
    });
    
    const twiml = new twilio.twiml.VoiceResponse();
    
    if (execution.data.status === 'waiting_human_review') {
      twiml.say('Thank you! I\'ve submitted your request. Our team will call you back shortly to confirm.');
    } else if (execution.data.agentResponseAudio) {
      // Play TTS audio response
      twiml.play(execution.data.agentResponseAudio);
    }
    
    res.type('text/xml');
    res.send(twiml.toString());
  } catch (error) {
    console.error('Error:', error);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Sorry, there was an error. Please call back.');
    res.type('text/xml');
    res.send(twiml.toString());
  }
});
```

**3. Test with Twilio phone number:**
```bash
# Set webhook URL in Twilio console
https://your-server.com/voice/incoming

# Call your Twilio number and speak
```

---

## 🔍 Monitoring Workflow Execution

### Check Workflow Status

```bash
curl -X GET "http://localhost:3000/api/universal/workflows/executions/YOUR_EXECUTION_ID" \
  -H "Content-Type: application/json"
```

### View Execution Logs

```bash
curl -X GET "http://localhost:3000/api/universal/workflows/executions/YOUR_EXECUTION_ID/logs" \
  -H "Content-Type: application/json"
```

### List All Executions

```bash
curl -X GET "http://localhost:3000/api/universal/workflows/executions?workflowId=YOUR_WORKFLOW_ID" \
  -H "Content-Type: application/json"
```

---

## 🧪 Mock Testing (No Real APIs)

Create a simplified test version without external API calls:

**1. Create mock workflow:**

```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Drive Booking - Mock Test",
    "description": "Simplified version for testing without APIs",
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "position": {"x": 100, "y": 100},
        "data": {"label": "Start"}
      },
      {
        "id": "mock-preferences",
        "type": "llm",
        "position": {"x": 300, "y": 100},
        "data": {
          "label": "Extract Preferences",
          "prompt": "Customer wants: {{inputs.customerInput}}\n\nExtract preferences as JSON.",
          "model": "gpt-3.5-turbo"
        }
      },
      {
        "id": "human-approval",
        "type": "agent_with_hitl",
        "position": {"x": 500, "y": 100},
        "data": {
          "label": "Approve Booking",
          "reviewMessage": "Customer wants: {{mock-preferences.output}}\n\nApprove?",
          "metadata": {"interruptType": "langgraph_hitl"}
        }
      },
      {
        "id": "end",
        "type": "end",
        "position": {"x": 700, "y": 100},
        "data": {"label": "Done"}
      }
    ],
    "edges": [
      {"id": "e1", "source": "start", "target": "mock-preferences"},
      {"id": "e2", "source": "mock-preferences", "target": "human-approval"},
      {"id": "e3", "source": "human-approval", "target": "end", "condition": "approve"}
    ]
  }'
```

**2. Test mock workflow:**

```bash
# Execute
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "MOCK_WORKFLOW_ID",
    "inputs": {
      "customerInput": "I want to test drive a Tesla Model 3 on Saturday at 2pm"
    }
  }'

# Get pending task
curl -X GET "http://localhost:3000/api/human-review/tasks?status=pending"

# Approve
curl -X POST http://localhost:3000/api/human-review/complete \
  -H "Content-Type: application/json" \
  -d '{"taskId": "TASK_ID", "actionId": "approve"}'
```

---

## 📊 Test Checklist

Use this checklist to verify everything works:

### Basic Functionality
- [ ] Workflow creates successfully
- [ ] Can execute workflow with inputs
- [ ] LLM nodes process text correctly
- [ ] Workflow pauses at HITL node
- [ ] Task appears in pending tasks list
- [ ] Can approve task
- [ ] Workflow continues after approval
- [ ] Can reject task
- [ ] Workflow handles rejection path
- [ ] Final output is generated

### Voice Functionality (if testing)
- [ ] Whisper transcribes audio correctly
- [ ] Transcription contains customer intent
- [ ] TTS generates audio response
- [ ] Audio quality is acceptable
- [ ] Response is appropriate length for voice

### Edge Cases
- [ ] Handles missing inputs gracefully
- [ ] Handles unavailable vehicles
- [ ] Handles invalid dates/times
- [ ] Timeout handling works
- [ ] Error messages are user-friendly

### Performance
- [ ] Workflow completes in < 30 seconds
- [ ] No memory leaks during execution
- [ ] Database properly stores execution state
- [ ] Logs are detailed enough for debugging

---

## 🐛 Troubleshooting

### Issue: Workflow doesn't pause at HITL node

**Check:**
```bash
# Verify node has HITL metadata
curl -X GET "http://localhost:3000/api/workflows/YOUR_WORKFLOW_ID"
```

Look for:
```json
{
  "metadata": {
    "interruptType": "langgraph_hitl"
  }
}
```

### Issue: No tasks in pending list

**Debug:**
```bash
# Check all tasks regardless of status
curl -X GET "http://localhost:3000/api/human-review/tasks"

# Check execution status
curl -X GET "http://localhost:3000/api/universal/workflows/executions/EXEC_ID"
```

### Issue: Voice transcription fails

**Verify:**
1. Audio file is accessible (check URL in browser)
2. Format is supported (mp3, wav, m4a, webm)
3. File size < 25MB
4. OPENAI_API_KEY is set correctly

```bash
# Test Whisper directly
curl https://api.openai.com/v1/audio/transcriptions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -F file="@/path/to/audio.mp3" \
  -F model="whisper-1"
```

### Issue: Workflow execution stuck

**Check logs:**
```bash
# Server logs
tail -f logs/app.log

# MongoDB execution status
# In MongoDB shell:
db.workflowexecutions.find({ _id: ObjectId("YOUR_EXECUTION_ID") })
```

---

## 🎯 Next Steps

1. **Test basic flow** → Mock workflow without voice
2. **Test HITL approval** → Verify pause/resume works
3. **Add voice** → Test with audio files
4. **Connect APIs** → Replace mock data with real inventory/CRM
5. **Production testing** → Test with Twilio/live calls

Need help with any step? Let me know!
