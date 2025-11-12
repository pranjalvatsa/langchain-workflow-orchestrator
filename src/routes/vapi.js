const express = require('express');
const router = express.Router();
const WorkflowExecutionService = require('../services/WorkflowExecutionService');
const { Workflow } = require('../models');

/**
 * VAPI Function Call Webhook - Create Booking
 * 
 * Called by VAPI when assistant invokes the create_booking function
 * Triggers the test-drive workflow with customer data
 */
router.post('/vapi/create-booking', async (req, res) => {
  try {
    console.log('📞 [VAPI] Booking request received:', JSON.stringify(req.body, null, 2));
    
    // Extract data from VAPI function call
    const functionCall = req.body.message?.functionCall || req.body.functionCall;
    const parameters = functionCall?.parameters || req.body;
    
    const {
      customerName,
      customerPhone,
      customerEmail,
      vehicleType,
      vehicleModel,
      preferredDate,
      preferredTime,
      additionalNotes
    } = parameters;
    
    // Extract VAPI call metadata
    const callId = req.body.message?.call?.id || req.body.callId;
    const callType = req.body.message?.call?.type || 'inbound';
    
    // Validate required fields
    if (!customerName || !customerPhone || !vehicleModel) {
      console.error('❌ [VAPI] Missing required fields');
      return res.json({
        result: "I apologize, but I'm missing some information. Could you please provide your name, phone number, and which vehicle you'd like to test drive?"
      });
    }
    
    // Find test-drive workflow (you can also use environment variable)
    const workflow = await Workflow.findOne({ 
      name: { $regex: /test.*drive/i }
    }).sort({ createdAt: -1 });
    
    if (!workflow) {
      console.error('❌ [VAPI] Test drive workflow not found');
      return res.json({
        result: "I apologize, but our booking system is temporarily unavailable. Please call back in a few minutes or leave your number for a callback."
      });
    }
    
    console.log(`✅ [VAPI] Using workflow: ${workflow.name} (${workflow._id})`);
    
    // Execute workflow - skip straight to human approval node
    const execution = await WorkflowExecutionService.executeWorkflow(
      workflow._id.toString(),
      {
        // Input data for workflow
        customerPreferences: {
          vehicleType: vehicleType || 'car',
          brands: [vehicleModel.split(' ')[0]], // Extract brand from model
          models: [vehicleModel],
          urgency: 'high'
        },
        schedulingInfo: {
          customerName,
          customerPhone,
          customerEmail: customerEmail || null,
          preferredDate,
          preferredTime,
          additionalNotes: additionalNotes || null
        },
        dealershipLocation: process.env.DEALERSHIP_LOCATION || 'Downtown Showroom',
        
        // VAPI metadata
        vapiCallId: callId,
        vapiCallType: callType,
        source: 'vapi'
      },
      {
        // Context
        skipToNode: 'human-approval', // Skip voice nodes, go to approval
        platform: 'vapi',
        callId
      }
    );
    
    console.log(`✅ [VAPI] Workflow execution started: ${execution._id}`);
    
    // Format date/time for customer-friendly message
    const dateObj = new Date(preferredDate);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Respond to VAPI - this message will be spoken to customer
    const responseMessage = `Perfect! I've submitted your request for a test drive of the ${vehicleModel} on ${formattedDate} at ${preferredTime}. Our sales team will review this and call you back within the next hour to confirm availability. You'll also receive a confirmation email. Is there anything else I can help you with today?`;
    
    res.json({
      result: responseMessage,
      metadata: {
        executionId: execution._id.toString(),
        workflowId: workflow._id.toString(),
        status: 'pending_approval'
      }
    });
    
  } catch (error) {
    console.error('❌ [VAPI] Error creating booking:', error);
    
    // Return user-friendly error message that VAPI will speak
    res.status(500).json({
      result: "I apologize, but I'm having trouble processing your booking right now. Could you please try again in a few minutes, or would you prefer to leave your contact information for a callback?"
    });
  }
});

/**
 * VAPI Call Status Webhook
 * 
 * Receives status updates about calls (started, ended, etc.)
 * Useful for analytics and monitoring
 */
router.post('/vapi/status', async (req, res) => {
  try {
    const { type, call, transcript, artifact } = req.body;
    
    console.log(`📞 [VAPI] Call event: ${type}`, {
      callId: call?.id,
      duration: call?.duration,
      cost: call?.cost
    });
    
    switch(type) {
      case 'call-started':
        console.log('📞 [VAPI] Call started:', {
          id: call.id,
          type: call.type,
          phoneNumber: call.customer?.number
        });
        break;
        
      case 'function-call':
        console.log('🔧 [VAPI] Function called:', {
          function: transcript?.functionCall?.name,
          parameters: transcript?.functionCall?.parameters
        });
        break;
        
      case 'transcript':
        console.log('💬 [VAPI] Transcript:', {
          role: transcript?.role,
          text: transcript?.text
        });
        // TODO: Store transcript in database for analytics
        break;
        
      case 'call-ended':
        console.log('📞 [VAPI] Call ended:', {
          duration: call.duration,
          cost: call.cost,
          endedReason: call.endedReason
        });
        // TODO: Update analytics/metrics
        break;
        
      case 'hang':
        console.log('📞 [VAPI] Call hung up');
        break;
        
      default:
        console.log(`📞 [VAPI] Unknown event type: ${type}`);
    }
    
    res.sendStatus(200);
    
  } catch (error) {
    console.error('❌ [VAPI] Status webhook error:', error);
    res.sendStatus(500);
  }
});

/**
 * VAPI Assistant Configuration Endpoint
 * 
 * Returns the function definition for VAPI assistant
 * Useful for dynamic configuration
 */
router.get('/vapi/function-config', (req, res) => {
  res.json({
    name: 'create_booking',
    description: 'Creates a test drive booking and submits it for sales team approval',
    parameters: {
      type: 'object',
      required: [
        'customerName',
        'customerPhone',
        'vehicleModel',
        'preferredDate',
        'preferredTime'
      ],
      properties: {
        customerName: {
          type: 'string',
          description: 'Customer\'s full name'
        },
        customerPhone: {
          type: 'string',
          description: 'Customer\'s phone number with country code (e.g., +1-555-0123)'
        },
        customerEmail: {
          type: 'string',
          description: 'Customer\'s email address (optional but recommended)'
        },
        vehicleType: {
          type: 'string',
          description: 'Type of vehicle (car, bike, SUV, electric, truck, etc.)',
          enum: ['car', 'bike', 'suv', 'electric', 'truck', 'other']
        },
        vehicleModel: {
          type: 'string',
          description: 'Specific vehicle model they want to test drive (e.g., "Tesla Model 3", "Honda Civic")'
        },
        preferredDate: {
          type: 'string',
          description: 'Preferred date in YYYY-MM-DD format (e.g., "2025-11-10")'
        },
        preferredTime: {
          type: 'string',
          description: 'Preferred time in HH:MM 24-hour format (e.g., "14:00" for 2 PM)'
        },
        additionalNotes: {
          type: 'string',
          description: 'Any additional notes, requirements, or special requests'
        }
      }
    },
    url: `${process.env.PUBLIC_URL || 'https://your-server.com'}/api/vapi/create-booking`,
    method: 'POST'
  });
});

/**
 * Test endpoint to simulate VAPI function call
 * Useful for local testing without VAPI
 */
router.post('/vapi/test-booking', async (req, res) => {
  const testPayload = {
    message: {
      functionCall: {
        name: 'create_booking',
        parameters: {
          customerName: req.body.customerName || 'Test Customer',
          customerPhone: req.body.customerPhone || '+1-555-0123',
          customerEmail: req.body.customerEmail || 'test@example.com',
          vehicleType: req.body.vehicleType || 'electric',
          vehicleModel: req.body.vehicleModel || 'Tesla Model 3',
          preferredDate: req.body.preferredDate || '2025-11-10',
          preferredTime: req.body.preferredTime || '14:00',
          additionalNotes: req.body.additionalNotes || 'Test booking'
        }
      },
      call: {
        id: 'test-call-' + Date.now(),
        type: 'test'
      }
    }
  };
  
  // Forward to actual endpoint
  req.body = testPayload;
  return router.handle(req, res);
});

module.exports = router;
