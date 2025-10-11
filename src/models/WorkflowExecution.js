const mongoose = require('mongoose');

// Execution Step Schema
const executionStepSchema = new mongoose.Schema({
  stepId: { type: String, required: true },
  nodeId: { type: String, required: true },
  nodeType: { type: String, required: true },
  nodeName: String,
  
  // Execution details
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'skipped', 'waiting_approval', 'waiting', 'waiting_human_review'],
    default: 'pending',
    index: true
  },
  
  // Timing
  startedAt: Date,
  completedAt: Date,
  duration: Number, // milliseconds
  
  // Input/Output
  input: mongoose.Schema.Types.Mixed,
  output: mongoose.Schema.Types.Mixed,
  transformedInput: mongoose.Schema.Types.Mixed,
  
  // Error handling
  error: {
    message: String,
    code: String,
    stack: String,
    retryAttempt: { type: Number, default: 0 }
  },
  
  // Agent-specific data
  agentExecution: {
    model: String,
    provider: String,
    tokenUsage: {
      promptTokens: Number,
      completionTokens: Number,
      totalTokens: Number
    },
    cost: Number,
    responseTime: Number
  },
  
  // Tool-specific data
  toolExecution: {
    toolName: String,
    apiCalls: [{
      url: String,
      method: String,
      statusCode: Number,
      responseTime: Number,
      retryAttempt: Number
    }]
  },
  
  // Human review data
  humanReview: {
    // Internal review data
    assignedTo: String,
    reviewedBy: String,
    reviewedAt: Date,
    approved: Boolean,
    reviewNotes: String,
    escalated: Boolean,
    
    // External API integration
    externalTask: {
      enabled: { type: Boolean, default: false },
      apiConfig: {
        endpoint: String,
        method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH'], default: 'POST' },
        headers: mongoose.Schema.Types.Mixed,
        body: mongoose.Schema.Types.Mixed,
        authType: { type: String, enum: ['none', 'bearer', 'apikey', 'basic'], default: 'none' },
        credentials: mongoose.Schema.Types.Mixed
      },
      taskId: String, // External task ID from NOAM
      taskStatus: { type: String, enum: ['pending', 'assigned', 'in_progress', 'completed', 'rejected'], default: 'pending' },
      callbackUrl: String, // Webhook URL for task updates
      taskResponse: mongoose.Schema.Types.Mixed, // Response from external system
      createdAt: Date,
      completedAt: Date
    }
  },
  
  // Metadata
  metadata: mongoose.Schema.Types.Mixed,
  logs: [{
    level: { type: String, enum: ['debug', 'info', 'warn', 'error'] },
    message: String,
    timestamp: { type: Date, default: Date.now },
    data: mongoose.Schema.Types.Mixed
  }]
}, { _id: false, timestamps: true });

// Main Workflow Execution Schema
const workflowExecutionSchema = new mongoose.Schema({
  // Basic Information
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workflow',
    required: true,
    index: true
  },
  workflowVersion: String,
  executionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Execution Context
  triggeredBy: {
    type: {
      type: String,
      enum: ['user', 'schedule', 'webhook', 'api', 'event', 'noam'],
      required: true
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    source: String, // IP, webhook URL, etc.
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // Status & Lifecycle
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled', 'paused', 'waiting', 'waiting_human_review'],
    default: 'pending',
    index: true
  },
  
  // Timing
  startedAt: { type: Date, default: Date.now, index: true },
  completedAt: Date,
  duration: Number, // milliseconds
  estimatedDuration: Number,
  
  // Execution Steps
  steps: [executionStepSchema],
  currentStep: String, // Current step ID
  
  // Input/Output
  initialInput: mongoose.Schema.Types.Mixed,
  finalOutput: mongoose.Schema.Types.Mixed,
  variables: mongoose.Schema.Types.Mixed, // Workflow variables
  
  // Error handling
  error: {
    message: String,
    code: String,
    stack: String,
    nodeId: String, // Node where error occurred
    stepId: String,
    retryable: { type: Boolean, default: false }
  },
  
  // Resource Usage
  resourceUsage: {
    tokenUsage: {
      totalPromptTokens: { type: Number, default: 0 },
      totalCompletionTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 }
    },
    estimatedCost: { type: Number, default: 0 },
    apiCalls: { type: Number, default: 0 },
    executionTime: { type: Number, default: 0 }
  },
  
  // Performance Metrics
  metrics: {
    stepsCompleted: { type: Number, default: 0 },
    stepsTotal: { type: Number, default: 0 },
    successRate: Number,
    averageStepTime: Number,
    bottleneckSteps: [String] // Step IDs that took longest
  },
  
  // Audit & Compliance
  auditLog: [{
    action: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String
  }],
  
  // Notifications
  notifications: [{
    type: { type: String, enum: ['email', 'sms', 'webhook', 'slack'] },
    recipient: String,
    status: { type: String, enum: ['pending', 'sent', 'failed'] },
    sentAt: Date,
    message: String
  }],
  
  // Retry Information
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: Date,
  retryReason: String,
  
  // Tags and Labels
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'critical'],
    default: 'normal'
  },
  
  // Noam Integration
  noamAccountId: { type: String, index: true },
  noamContext: {
    customerId: String,
    sessionId: String,
    requestId: String,
    metadata: mongoose.Schema.Types.Mixed
  },
  
  // Metadata
  environment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'workflow_executions'
});

// Indexes
workflowExecutionSchema.index({ workflowId: 1, status: 1 });
workflowExecutionSchema.index({ status: 1, startedAt: -1 });
workflowExecutionSchema.index({ 'triggeredBy.userId': 1, startedAt: -1 });
workflowExecutionSchema.index({ noamAccountId: 1, startedAt: -1 });
workflowExecutionSchema.index({ environment: 1, status: 1 });
workflowExecutionSchema.index({ priority: 1, status: 1 });
workflowExecutionSchema.index({ nextRetryAt: 1 });

// Methods
workflowExecutionSchema.methods.addStep = function(step) {
  this.steps.push({
    ...step,
    stepId: step.stepId || `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  });
  this.metrics.stepsTotal = this.steps.length;
  return this.steps[this.steps.length - 1];
};

workflowExecutionSchema.methods.updateStep = function(stepId, updates) {
  const step = this.steps.id(stepId) || this.steps.find(s => s.stepId === stepId);
  if (step) {
    Object.assign(step, updates);
    
    // Update metrics
    if (updates.status === 'completed') {
      this.metrics.stepsCompleted += 1;
    }
    
    if (updates.completedAt && step.startedAt) {
      step.duration = updates.completedAt - step.startedAt;
    }
  }
  return step;
};

workflowExecutionSchema.methods.calculateMetrics = function() {
  const completedSteps = this.steps.filter(s => s.status === 'completed');
  this.metrics.stepsCompleted = completedSteps.length;
  this.metrics.successRate = this.metrics.stepsTotal > 0 ? 
    (completedSteps.length / this.metrics.stepsTotal) * 100 : 0;
  
  if (completedSteps.length > 0) {
    const totalTime = completedSteps.reduce((sum, step) => sum + (step.duration || 0), 0);
    this.metrics.averageStepTime = totalTime / completedSteps.length;
  }
  
  // Calculate total resource usage
  this.resourceUsage.tokenUsage.totalPromptTokens = this.steps.reduce(
    (sum, step) => sum + (step.agentExecution?.tokenUsage?.promptTokens || 0), 0
  );
  this.resourceUsage.tokenUsage.totalCompletionTokens = this.steps.reduce(
    (sum, step) => sum + (step.agentExecution?.tokenUsage?.completionTokens || 0), 0
  );
  this.resourceUsage.tokenUsage.totalTokens = 
    this.resourceUsage.tokenUsage.totalPromptTokens + 
    this.resourceUsage.tokenUsage.totalCompletionTokens;
};

workflowExecutionSchema.methods.addAuditEntry = function(action, performedBy, details = {}, req = null) {
  this.auditLog.push({
    action,
    performedBy,
    details,
    ipAddress: req?.ip || 'unknown',
    userAgent: req?.get('User-Agent') || 'unknown'
  });
};

workflowExecutionSchema.methods.canRetry = function() {
  return this.status === 'failed' && 
         this.retryCount < this.maxRetries && 
         this.error?.retryable !== false;
};

workflowExecutionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Calculate duration if execution is completed
  if (this.completedAt && this.startedAt) {
    this.duration = this.completedAt - this.startedAt;
  }
  
  // Auto-calculate metrics
  this.calculateMetrics();
  
  next();
});

module.exports = mongoose.model('WorkflowExecution', workflowExecutionSchema);