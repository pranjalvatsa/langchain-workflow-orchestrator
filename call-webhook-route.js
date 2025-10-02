// Add this route to your Express app (in routes/ folder)

const express = require('express');
const WorkflowExecutionService = require('../services/WorkflowExecutionService');

const router = express.Router();
const workflowExecutionService = new WorkflowExecutionService();

// Webhook endpoint for call transcriptions
router.post('/webhook/call-transcription', async (req, res) => {
  try {
    const { callId, transcription, callerInfo, audioUrl, metadata } = req.body;

    // Validate required fields
    if (!callId || !transcription) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'callId and transcription are required'
      });
    }

    // Find the call deflection workflow (you'll need to store the workflow ID)
    const CALL_DEFLECTION_WORKFLOW_ID = process.env.CALL_DEFLECTION_WORKFLOW_ID || 'call-deflection-workflow';
    
    // Trigger workflow execution
    const executionResult = await workflowExecutionService.executeWorkflow(
      CALL_DEFLECTION_WORKFLOW_ID,
      {
        callId,
        transcription,
        callerInfo: callerInfo || {},
        audioUrl,
        metadata: metadata || {},
        timestamp: new Date().toISOString()
      }
    );

    res.status(200).json({
      success: true,
      message: 'Call deflection workflow triggered',
      executionId: executionResult.executionId,
      callId: callId
    });

  } catch (error) {
    console.error('Call transcription webhook error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Get status of call processing
router.get('/webhook/call-status/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    // TODO: Look up execution by callId
    // For now, return mock status
    res.json({
      callId: callId,
      status: 'processing',
      stage: 'intent_classification',
      estimatedCompletion: '30 seconds'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;