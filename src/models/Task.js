const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  executionId: { type: String, required: true, index: true },
  nodeId: { type: String, required: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true },
  status: { type: String, enum: ['pending', 'completed', 'rejected'], default: 'pending' },
  data: { type: mongoose.Schema.Types.Mixed }, // Context and node data
  actions: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    loopBackNodeId: { type: String }, // Optional, for rejection loop-back
  }],
  metadata: { type: mongoose.Schema.Types.Mixed }, // Additional metadata (e.g., interruptType, threadId, nodeType)
  result: { type: mongoose.Schema.Types.Mixed }, // Result after completion
  feedback: { type: String }, // Human feedback
  completedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Task', taskSchema);
