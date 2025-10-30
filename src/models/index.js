const mongoose = require("mongoose");

// Workflow Template Schema
const workflowTemplateSchema = new mongoose.Schema(
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
      required: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      required: true,
      enum: ["marketing", "sales", "support", "automation", "analysis", "integration", "nbo", "custom"],
    },
    subcategory: String,
    tags: [String],

    // Template Metadata
    templateId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    version: {
      major: { type: Number, default: 1 },
      minor: { type: Number, default: 0 },
      patch: { type: Number, default: 0 },
    },

    // Workflow Definition (inherited from Workflow schema)
    // Using flexible Mixed type to support various workflow formats
    nodes: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },
    edges: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    // Template Configuration
    config: {
      requiredIntegrations: [String], // ['openai', 'noam', 'email']
      requiredPermissions: [String],
      estimatedExecutionTime: Number,
      complexity: {
        type: String,
        enum: ["beginner", "intermediate", "advanced"],
        default: "beginner",
      },
      industry: [String], // ['ecommerce', 'saas', 'healthcare']
      useCase: String,
    },

    // Customization
    variables: [
      {
        name: { type: String, required: true },
        type: {
          type: String,
          enum: ["string", "number", "boolean", "array", "object"],
          required: true,
        },
        description: String,
        defaultValue: mongoose.Schema.Types.Mixed,
        required: { type: Boolean, default: false },
        validation: {
          pattern: String, // Regex for string validation
          min: Number, // Min value for numbers
          max: Number, // Max value for numbers
          options: [String], // Enum options
        },
      },
    ],

    // Documentation
    documentation: {
      overview: String,
      prerequisites: [String],
      setupInstructions: String,
      usageGuide: String,
      troubleshooting: String,
      examples: [
        {
          title: String,
          description: String,
          configuration: mongoose.Schema.Types.Mixed,
        },
      ],
    },

    // Media
    thumbnail: String, // URL to template thumbnail
    screenshots: [String],
    videos: [
      {
        title: String,
        url: String,
        type: { type: String, enum: ["tutorial", "demo", "overview"] },
      },
    ],

    // Publishing & Visibility
    isPublic: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    publishedAt: Date,

    // Author Information
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorInfo: {
      name: String,
      company: String,
      website: String,
      social: mongoose.Schema.Types.Mixed,
    },

    // Usage Statistics
    stats: {
      downloads: { type: Number, default: 0 },
      installs: { type: Number, default: 0 },
      rating: { type: Number, min: 0, max: 5, default: 0 },
      reviews: { type: Number, default: 0 },
      successfulExecutions: { type: Number, default: 0 },
      totalExecutions: { type: Number, default: 0 },
    },

    // Reviews and Ratings
    reviews: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        rating: { type: Number, min: 1, max: 5, required: true },
        comment: String,
        helpful: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // Pricing (for premium templates)
    pricing: {
      type: { type: String, enum: ["free", "paid", "freemium"], default: "free" },
      price: Number,
      currency: { type: String, default: "USD" },
      billingCycle: { type: String, enum: ["one-time", "monthly", "yearly"] },
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "review", "published", "deprecated"],
      default: "draft",
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: "workflow_templates",
  }
);

// API Key Management Schema
const apiKeySchema = new mongoose.Schema(
  {
    // Basic Information
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,

    // Key Details
    keyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    keyHash: {
      type: String,
      required: true,
      select: false,
    },
    keyPrefix: {
      type: String,
      required: true,
    },

    // Ownership
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    noamAccountId: {
      type: String,
      required: true,
      index: true,
    },

    // Permissions and Scope
    permissions: [
      {
        resource: String, // 'workflows', 'executions', 'templates'
        actions: [String], // ['read', 'write', 'execute', 'delete']
      },
    ],
    scopes: [String], // ['workflow:read', 'execution:write']

    // Rate Limiting
    rateLimit: {
      requestsPerMinute: { type: Number, default: 100 },
      requestsPerHour: { type: Number, default: 1000 },
      requestsPerDay: { type: Number, default: 10000 },
    },

    // Usage Tracking
    usage: {
      totalRequests: { type: Number, default: 0 },
      lastUsedAt: Date,
      requestsToday: { type: Number, default: 0 },
      requestsThisMonth: { type: Number, default: 0 },
    },

    // Restrictions
    ipWhitelist: [String],
    allowedOrigins: [String],

    // Status
    isActive: { type: Boolean, default: true },
    expiresAt: Date,

    // Metadata
    createdAt: { type: Date, default: Date.now },
    lastRotatedAt: Date,
  },
  {
    timestamps: true,
    collection: "api_keys",
  }
);

// Audit Log Schema
const auditLogSchema = new mongoose.Schema(
  {
    // Event Information
    eventType: {
      type: String,
      required: true,
      enum: [
        "workflow_created",
        "workflow_updated",
        "workflow_deleted",
        "workflow_executed",
        "workflow_published",
        "user_login",
        "user_logout",
        "user_created",
        "api_key_created",
        "api_key_deleted",
        "template_published",
        "template_downloaded",
        "permission_granted",
        "permission_revoked",
      ],
    },

    // Actor Information
    actor: {
      type: { type: String, enum: ["user", "system", "api"], required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "ApiKey" },
      ipAddress: String,
      userAgent: String,
    },

    // Target Information
    target: {
      type: String, // 'workflow', 'user', 'template', etc.
      id: String, // Target resource ID
      name: String, // Target resource name
    },

    // Event Details
    details: mongoose.Schema.Types.Mixed,
    changes: mongoose.Schema.Types.Mixed, // Before/after values

    // Context
    noamAccountId: { type: String, index: true },
    environment: {
      type: String,
      enum: ["development", "staging", "production"],
      default: "development",
    },

    // Risk Assessment
    riskLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },

    // Metadata
    timestamp: { type: Date, default: Date.now, index: true },
    sessionId: String,
    requestId: String,
  },
  {
    collection: "audit_logs",
  }
);

// Notification Schema
const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Notification Details
    type: {
      type: String,
      enum: ["workflow_completed", "workflow_failed", "approval_required", "system_alert", "security_alert"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },

    // Channel Configuration
    channels: [
      {
        type: { type: String, enum: ["email", "sms", "push", "webhook"], required: true },
        address: String, // email address, phone number, webhook URL
        status: { type: String, enum: ["pending", "sent", "delivered", "failed"], default: "pending" },
        sentAt: Date,
        deliveredAt: Date,
        error: String,
      },
    ],

    // Context
    relatedWorkflow: { type: mongoose.Schema.Types.ObjectId, ref: "Workflow" },
    relatedExecution: { type: mongoose.Schema.Types.ObjectId, ref: "WorkflowExecution" },

    // Status
    isRead: { type: Boolean, default: false },
    readAt: Date,
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
    },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
  },
  {
    timestamps: true,
    collection: "notifications",
  }
);

// Indexes for all schemas
workflowTemplateSchema.index({ category: 1, isPublic: 1 });
workflowTemplateSchema.index({ tags: 1 });
workflowTemplateSchema.index({ "stats.rating": -1 });
workflowTemplateSchema.index({ publishedAt: -1 });

apiKeySchema.index({ owner: 1, isActive: 1 });
apiKeySchema.index({ expiresAt: 1 });
apiKeySchema.index({ "usage.lastUsedAt": -1 });

auditLogSchema.index({ "actor.userId": 1, timestamp: -1 });
auditLogSchema.index({ eventType: 1, timestamp: -1 });
auditLogSchema.index({ noamAccountId: 1, timestamp: -1 });

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ expiresAt: 1 });

module.exports = {
  WorkflowTemplate: mongoose.model("WorkflowTemplate", workflowTemplateSchema),
  Workflow: require("./Workflow"),
  WorkflowExecution: require("./WorkflowExecution"),
  WorkflowStepLog: require("./WorkflowStepLog"),
  User: require("./User"),
  ApiKey: mongoose.model("ApiKey", apiKeySchema),
  AuditLog: mongoose.model("AuditLog", auditLogSchema),
  Notification: mongoose.model("Notification", notificationSchema),
};
