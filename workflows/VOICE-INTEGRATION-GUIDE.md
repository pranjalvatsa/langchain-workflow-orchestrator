# Voice Integration Guide for Test Drive Booking Workflow

## Overview
GPT-4 (text model) **cannot** process voice directly. Here are **3 architectures** for adding voice capabilities to your workflow:

---

## 🎯 **Option 1: STT → GPT-4 → TTS Pipeline** (Current Implementation)

### Architecture
```
Audio Input → Whisper (STT) → GPT-4 (Text) → TTS → Audio Output
```

### Models Used
1. **OpenAI Whisper** (`whisper-1`) - Speech-to-Text
2. **GPT-4o Audio Preview** - Text processing with audio awareness
3. **OpenAI TTS** (`tts-1` or `tts-1-hd`) - Text-to-Speech

### Workflow Flow
```
Customer speaks → Whisper transcription → GPT-4 response → TTS audio → Play to customer
```

### Implementation (Already in workflow)

#### Node 1: Speech-to-Text
```json
{
  "type": "tool",
  "toolName": "api_caller",
  "parameters": {
    "url": "https://api.openai.com/v1/audio/transcriptions",
    "method": "POST",
    "body": {
      "file": "{{inputs.audioFile}}",
      "model": "whisper-1"
    }
  }
}
```

#### Node 2: Text Processing
```json
{
  "type": "llm",
  "data": {
    "prompt": "Customer said: {{speech-to-text.output.text}}\n\nRespond naturally...",
    "model": "gpt-4o-audio-preview"
  }
}
```

#### Node 3: Text-to-Speech
```json
{
  "type": "tool",
  "toolName": "api_caller",
  "parameters": {
    "url": "https://api.openai.com/v1/audio/speech",
    "method": "POST",
    "body": {
      "model": "tts-1-hd",
      "voice": "nova",
      "input": "{{greeting-agent.output}}"
    }
  }
}
```

### Voice Options
- **alloy** - Neutral, balanced
- **echo** - Male, clear
- **fable** - British accent, warm
- **onyx** - Deep, authoritative
- **nova** - Friendly, energetic (recommended for sales)
- **shimmer** - Soft, pleasant

### Pros
✅ Most control over each step
✅ Can process/modify text before TTS
✅ Works with any voice platform
✅ Cost-effective

### Cons
❌ Higher latency (3 API calls per interaction)
❌ More complex workflow
❌ No native conversation memory

### Best For
- Complex workflows needing text processing
- Integration with existing systems
- Maximum customization

---

## 🎯 **Option 2: OpenAI Realtime API** (Recommended for Production)

### Architecture
```
Audio Stream ↔ GPT-4o Realtime (Native Voice) ↔ Audio Stream
```

### Model
**GPT-4o Realtime** - Native voice input/output with low latency

### How It Works
- **WebSocket connection** - Bidirectional audio streaming
- **Native voice processing** - No separate STT/TTS
- **Ultra-low latency** - ~320ms response time
- **Function calling** - Can call APIs mid-conversation

### Implementation Example

```javascript
const { RealtimeClient } = require('@openai/realtime-api-beta');

const client = new RealtimeClient({
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-realtime-preview-2024-10-01'
});

// Configure session
await client.updateSession({
  instructions: `You are a friendly automotive sales agent. Help customers book test drives.
  
  When customer expresses interest:
  1. Ask about vehicle preferences (car/bike/SUV)
  2. Collect contact info
  3. Suggest available time slots
  
  Keep responses brief and natural.`,
  
  voice: 'nova',
  turn_detection: { type: 'server_vad' }, // Automatic turn detection
  
  tools: [
    {
      name: 'check_inventory',
      description: 'Check vehicle availability',
      parameters: {
        type: 'object',
        properties: {
          vehicleType: { type: 'string' },
          model: { type: 'string' }
        }
      }
    },
    {
      name: 'create_booking',
      description: 'Create test drive booking',
      parameters: {
        type: 'object',
        properties: {
          customerName: { type: 'string' },
          vehicleModel: { type: 'string' },
          date: { type: 'string' },
          time: { type: 'string' }
        }
      }
    }
  ]
});

// Handle function calls
client.on('conversation.function_call', async (event) => {
  if (event.name === 'check_inventory') {
    // Call your inventory API
    const result = await checkInventoryAPI(event.arguments);
    
    // Send result back to conversation
    await client.submitFunctionCallOutput({
      call_id: event.call_id,
      output: JSON.stringify(result)
    });
  }
  
  if (event.name === 'create_booking') {
    // Trigger workflow approval
    const executionId = await executeWorkflow({
      workflowId: 'test-drive-booking',
      inputs: event.arguments
    });
    
    await client.submitFunctionCallOutput({
      call_id: event.call_id,
      output: JSON.stringify({ 
        success: true, 
        executionId,
        message: 'Booking submitted for approval'
      })
    });
  }
});

// Connect to audio stream
await client.connect();
```

### Integration with Your Workflow

The Realtime API can trigger your workflow at specific points:

```javascript
// When booking is ready, trigger HITL workflow
client.on('conversation.function_call', async (event) => {
  if (event.name === 'create_booking') {
    // Start workflow at human-approval node
    const response = await fetch('http://localhost:3000/api/universal/workflows/execute', {
      method: 'POST',
      body: JSON.stringify({
        workflowId: 'test-drive-workflow-id',
        inputs: {
          customerName: event.arguments.customerName,
          vehicleModel: event.arguments.vehicleModel,
          preferredDate: event.arguments.date,
          preferredTime: event.arguments.time,
          // Skip conversational nodes, go straight to approval
          startNode: 'human-approval'
        }
      })
    });
    
    // Continue voice conversation while workflow runs in background
    const { executionId } = await response.json();
    
    // Agent can say: "Great! I've submitted your request. Our team will confirm shortly."
  }
});
```

### Pros
✅ **Ultra-low latency** (~320ms)
✅ Native voice understanding (tone, emotion)
✅ Natural conversation flow
✅ Built-in function calling
✅ Handles interruptions naturally

### Cons
❌ WebSocket required (more complex setup)
❌ Currently in beta
❌ Higher cost than separate APIs

### Best For
- Production voice agents
- Real-time phone systems
- Natural conversational experience
- Low-latency requirements

---

## 🎯 **Option 3: Third-Party Voice Platforms**

### Platforms with Built-in Voice Models

#### **1. ElevenLabs Conversational AI**
```javascript
const { ElevenLabs } = require('elevenlabs-node');

const conversationId = await elevenlabs.conversations.create({
  agentId: 'your-agent-id',
  systemPrompt: 'You are a car dealership sales agent...'
});

// Stream audio
conversationId.on('audio', (audioChunk) => {
  // Play to customer
});

// On booking intent detected, trigger your workflow
conversationId.on('intent.booking', async (data) => {
  await executeWorkflow({
    workflowId: 'test-drive-booking',
    inputs: data
  });
});
```

#### **2. Deepgram Aura (Voice AI)**
```javascript
const deepgram = new Deepgram(apiKey);

// Real-time transcription + TTS
const liveTranscription = deepgram.transcription.live({
  model: 'nova-2',
  language: 'en-US',
  punctuate: true
});

// When booking info collected, trigger workflow
liveTranscription.on('transcript', async (data) => {
  if (hasBookingIntent(data.transcript)) {
    const extracted = extractBookingDetails(data.transcript);
    await executeWorkflow({
      workflowId: 'test-drive-booking',
      inputs: extracted
    });
  }
});
```

#### **3. Retell AI (Phone AI Agents)**
```javascript
const retell = require('retell-sdk');

// Create voice agent
const agent = await retell.agent.create({
  llmWebsocketUrl: 'wss://your-server.com/llm-websocket',
  voice: {
    voiceId: 'elevenlabs-nova'
  },
  language: 'en-US'
});

// When agent needs to book, trigger workflow
app.post('/llm-websocket', async (req, res) => {
  const { transcript, callId } = req.body;
  
  if (detectBookingIntent(transcript)) {
    // Trigger your workflow
    const execution = await executeWorkflow({
      workflowId: 'test-drive-booking',
      inputs: {
        callId,
        ...extractedData
      }
    });
    
    // Return response to voice agent
    res.json({
      response: "Perfect! I've submitted your booking for confirmation."
    });
  }
});
```

#### **4. Bland AI (Phone Calls)**
```javascript
const blandAI = require('bland-ai');

const call = await blandAI.calls.create({
  phoneNumber: '+1234567890',
  task: 'Book a test drive for customer',
  voice: 'nova',
  webhook: 'https://your-server.com/bland-webhook'
});

// Webhook receives booking data
app.post('/bland-webhook', async (req, res) => {
  const { bookingData } = req.body;
  
  // Trigger workflow for human approval
  await executeWorkflow({
    workflowId: 'test-drive-booking',
    inputs: bookingData
  });
});
```

### Pros
✅ Purpose-built for voice
✅ Handle telephony integration
✅ Natural interruption handling
✅ Often include phone number provisioning

### Cons
❌ Vendor lock-in
❌ Less customization
❌ Additional cost

### Best For
- Quick deployment
- Phone-based systems
- Teams without AI expertise

---

## 📊 **Comparison Table**

| Feature | STT+GPT-4+TTS | Realtime API | Third-Party |
|---------|---------------|--------------|-------------|
| **Latency** | ~2-5 seconds | ~320ms | ~500ms-2s |
| **Cost (per min)** | ~$0.10 | ~$0.24 | $0.15-$0.50 |
| **Setup Complexity** | Medium | High | Low |
| **Customization** | High | High | Low-Medium |
| **Voice Quality** | Excellent | Excellent | Excellent |
| **Interruption Handling** | Poor | Excellent | Good |
| **Function Calling** | Manual | Native | Platform-specific |
| **Production Ready** | ✅ | ⚠️ (Beta) | ✅ |

---

## 🏗️ **Recommended Architecture for Your Use Case**

### **Hybrid Approach** (Best of Both Worlds)

```
Phone Call → Twilio → Realtime API (Conversation) → Workflow (HITL Approval)
                           ↓
                    Extract booking data
                           ↓
                    Trigger your workflow
                           ↓
                    Human approval (sales team)
                           ↓
                    Callback to Realtime API
                           ↓
                    "Your booking is confirmed!"
```

### Implementation

#### 1. **Voice Layer** (Realtime API)
```javascript
// Handle customer conversation
const realtimeClient = new RealtimeClient({
  model: 'gpt-4o-realtime-preview',
  instructions: 'Collect test drive preferences and booking details',
  tools: [{
    name: 'submit_booking',
    parameters: { /* booking fields */ }
  }]
});

realtimeClient.on('conversation.function_call', async (event) => {
  if (event.name === 'submit_booking') {
    // Trigger your workflow
    const execution = await triggerWorkflow(event.arguments);
    
    // Tell customer to wait
    await realtimeClient.submitFunctionCallOutput({
      call_id: event.call_id,
      output: JSON.stringify({
        status: 'pending_approval',
        message: 'One moment while I confirm availability...'
      })
    });
    
    // Wait for approval (with timeout)
    const result = await waitForApproval(execution.executionId, 60000);
    
    if (result.approved) {
      await realtimeClient.sendText({
        text: `Great news! Your test drive is confirmed for ${result.date} at ${result.time}. You'll receive a confirmation email shortly.`
      });
    } else {
      await realtimeClient.sendText({
        text: `I apologize, but we're unable to confirm that time slot. Would you like to try a different time?`
      });
    }
  }
});
```

#### 2. **Workflow Layer** (Your LangChain Orchestrator)
```javascript
// Simplified workflow - just approval + booking
{
  "nodes": [
    { "id": "human-approval", "type": "agent_with_hitl" },
    { "id": "create-booking", "type": "tool" },
    { "id": "send-confirmation", "type": "tool" }
  ],
  "edges": [
    { "source": "human-approval", "target": "create-booking", "condition": "approve" }
  ]
}
```

#### 3. **Approval Callback**
```javascript
// When sales team approves
app.post('/api/human-review/complete', async (req, res) => {
  const { taskId, actionId } = req.body;
  
  // Complete workflow
  await completeWorkflow(taskId, actionId);
  
  // Notify Realtime API session
  await notifyVoiceSession(execution.sessionId, {
    approved: actionId === 'approve',
    bookingDetails: { /* ... */ }
  });
});
```

---

## 🚀 **Quick Start (Updated Workflow)**

### 1. Use Current STT+TTS Implementation

The workflow I just updated uses:
- **Whisper** for voice → text
- **GPT-4o Audio Preview** for text processing  
- **TTS-1 HD** for text → voice

This works out-of-the-box with your existing workflow engine!

### 2. Test with Audio Files

```bash
curl -X POST http://localhost:3000/api/universal/workflows/execute \
  -H "Content-Type: application/json" \
  -d '{
    "workflowId": "test-drive-workflow-id",
    "inputs": {
      "audioFile": "https://url-to-customer-audio.mp3",
      "dealershipLocation": "Downtown Showroom"
    }
  }'
```

### 3. Integrate with Twilio (Live Calls)

```javascript
const twilio = require('twilio');

app.post('/voice/incoming', async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Record customer speech
  twiml.say('Hi! What vehicle are you interested in?');
  twiml.record({
    maxLength: 30,
    action: '/voice/process-recording'
  });
  
  res.type('text/xml');
  res.send(twiml.toString());
});

app.post('/voice/process-recording', async (req, res) => {
  const recordingUrl = req.body.RecordingUrl;
  
  // Trigger workflow with audio
  const execution = await fetch('http://localhost:3000/api/universal/workflows/execute', {
    method: 'POST',
    body: JSON.stringify({
      workflowId: 'test-drive-workflow-id',
      inputs: {
        audioFile: recordingUrl,
        callSid: req.body.CallSid
      }
    })
  });
  
  // Get agent response (TTS audio)
  const { ttsAudioUrl } = await execution.json();
  
  // Play response
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.play(ttsAudioUrl);
  
  res.type('text/xml');
  res.send(twiml.toString());
});
```

---

## 💡 **Recommendations**

### For MVP/Testing
✅ Use **STT + GPT-4o + TTS** (current implementation)
- Easy to test
- Works with audio files or live streams
- No complex infrastructure

### For Production
✅ Upgrade to **OpenAI Realtime API**
- Much better user experience
- Natural conversations
- Lower latency
- Still trigger your workflow for HITL approval

### For Phone Systems
✅ Use **Third-Party Platform** (Retell, Bland) + Your Workflow
- Handles telephony complexity
- Built-in phone numbers
- Your workflow handles business logic

---

## 📚 Additional Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Whisper API Reference](https://platform.openai.com/docs/guides/speech-to-text)
- [TTS API Reference](https://platform.openai.com/docs/guides/text-to-speech)
- [Twilio Voice Integration](https://www.twilio.com/docs/voice)
- [Retell AI Documentation](https://docs.retellai.com)

Need help implementing any of these? Let me know!
