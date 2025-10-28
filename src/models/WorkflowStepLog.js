const mongoose = require('mongoose');

const workflowStepLogSchema = new mongoose.Schema({
  executionId: { type: String, required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  stepIndex: { type: Number },
  inputData: { type: mongoose.Schema.Types.Mixed }, // Data received by this node
  outputData: { type: mongoose.Schema.Types.Mixed }, // Data produced by this node
  previousNodeId: { type: String },
  previousOutput: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['started', 'completed', 'failed', 'waiting_human_review'], default: 'started' },
  error: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now },
  durationMs: { type: Number },
});

module.exports = mongoose.model('WorkflowStepLog', workflowStepLogSchema);
