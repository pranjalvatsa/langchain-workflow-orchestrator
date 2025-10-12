const mongoose = require("mongoose");

// Workflow Node Schema
const workflowNodeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["trigger", "start", "end", "agent", "llm", "tool", "condition", "loop", "humanReview", "webhook", "delay", "parallel", "merge"],
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    // Make node data flexible to allow arbitrary fields (e.g., externalTask)
    data: { type: mongoose.Schema.Types.Mixed, required: true },

    // Execution configuration
    config: mongoose.Schema.Types.Mixed,

    // Validation status
    isValid: { type: Boolean, default: true },
    validationErrors: [String],

    // Version tracking
    version: { type: Number, default: 1 },
  },
  { _id: false }
);

// Workflow Edge Schema
const workflowEdgeSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: String,
    targetHandle: String,
    label: String,
    type: {
      type: String,
      enum: ["default", "conditional", "success", "error"],
      default: "default",
    },

    // Conditional edge configuration
    condition: {
      type: String,
      conditionType: {
        type: String,
        enum: ["always", "conditional", "success", "error"],
      },
      expression: String,
    },

    // Animation and styling
    animated: { type: Boolean, default: false },
    style: mongoose.Schema.Types.Mixed,
  },
  { _id: false }
);

// Main Workflow Schema
const workflowSchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    category: {
      type: String,
      enum: ["marketing", "sales", "support", "automation", "analysis", "integration", "custom"],
      default: "custom",
    },
    tags: [String],

    // Ownership & Access
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    collaborators: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["viewer", "editor", "admin"], default: "viewer" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    noamAccountId: {
      type: String,
      required: true,
      index: true,
    },

    // Workflow Definition
    nodes: [workflowNodeSchema],
    edges: [workflowEdgeSchema],

    // Configuration
    config: {
      timeout: { type: Number, default: 300000 }, // 5 minutes
      maxConcurrentExecutions: { type: Number, default: 10 },
      retryPolicy: {
        maxRetries: { type: Number, default: 3 },
        retryDelay: { type: Number, default: 5000 },
      },
      errorNotifications: {
        enabled: { type: Boolean, default: true },
        recipients: [String], // Email addresses or user IDs
      },
      scheduling: {
        enabled: { type: Boolean, default: false },
        cronExpression: String,
        timezone: { type: String, default: "UTC" },
        nextRunAt: Date,
      },
    },

    // Status & Lifecycle
    status: {
      type: String,
      enum: ["draft", "active", "paused", "archived", "deprecated"],
      default: "draft",
      index: true,
    },

    // Version Management
    version: {
      major: { type: Number, default: 1 },
      minor: { type: Number, default: 0 },
      patch: { type: Number, default: 0 },
    },
    parentWorkflowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workflow",
    },
    isTemplate: { type: Boolean, default: false },

    // Validation
    isValid: { type: Boolean, default: false },
    validationErrors: [String],
    lastValidatedAt: Date,

    // Analytics & Metrics
    metrics: {
      totalExecutions: { type: Number, default: 0 },
      successfulExecutions: { type: Number, default: 0 },
      failedExecutions: { type: Number, default: 0 },
      averageExecutionTime: Number,
      lastExecutionAt: Date,
      avgDailyExecutions: Number,
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    publishedAt: Date,
    archivedAt: Date,
  },
  {
    timestamps: true,
    collection: "workflows",
  }
);

// Indexes
workflowSchema.index({ owner: 1, status: 1 });
workflowSchema.index({ noamAccountId: 1, status: 1 });
workflowSchema.index({ category: 1, isTemplate: 1 });
workflowSchema.index({ "config.scheduling.nextRunAt": 1 });
workflowSchema.index({ tags: 1 });
workflowSchema.index({ createdAt: -1 });

// Virtual for full version string
workflowSchema.virtual("versionString").get(function () {
  return `${this.version.major}.${this.version.minor}.${this.version.patch}`;
});

// Methods
workflowSchema.methods.incrementVersion = function (type = "patch") {
  switch (type) {
    case "major":
      this.version.major += 1;
      this.version.minor = 0;
      this.version.patch = 0;
      break;
    case "minor":
      this.version.minor += 1;
      this.version.patch = 0;
      break;
    default:
      this.version.patch += 1;
  }
  return this.versionString;
};

workflowSchema.methods.validate = function () {
  const errors = [];

  // Check for at least one trigger node
  const triggerNodes = this.nodes.filter((node) => node.type === "trigger");
  if (triggerNodes.length === 0) {
    errors.push("Workflow must have at least one trigger node");
  }

  // Check for orphaned nodes
  const connectedNodes = new Set();
  this.edges.forEach((edge) => {
    connectedNodes.add(edge.source);
    connectedNodes.add(edge.target);
  });

  const orphanedNodes = this.nodes.filter((node) => node.type !== "trigger" && !connectedNodes.has(node.id));

  if (orphanedNodes.length > 0) {
    errors.push(`Orphaned nodes found: ${orphanedNodes.map((n) => n.data.label).join(", ")}`);
  }

  this.validationErrors = errors;
  this.isValid = errors.length === 0;
  this.lastValidatedAt = new Date();

  return this.isValid;
};

workflowSchema.pre("save", function (next) {
  this.updatedAt = new Date();

  // Auto-validate on save
  if (this.isModified("nodes") || this.isModified("edges")) {
    this.validate();
  }

  next();
});

module.exports = mongoose.model("Workflow", workflowSchema);
