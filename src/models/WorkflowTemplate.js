const mongoose = require("mongoose");

/**
 * WorkflowTemplate Schema
 *
 * Stores reusable workflow templates that can be imported into
 * the Noam app for visual editing and customization.
 *
 * Supports versioning, categorization, and marketplace features.
 */

const workflowTemplateSchema = new mongoose.Schema(
  {
    // Template Identity
    templateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
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
    version: {
      type: String,
      required: true,
      default: "1.0.0",
    },

    // Template Content (Universal Workflow Engine Format)
    // Using flexible schema to support various workflow formats
    nodes: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    edges: {
      type: mongoose.Schema.Types.Mixed,
      required: false,
    },

    // Workflow Configuration
    configuration: {
      // Execution settings
      maxConcurrentExecutions: { type: Number, default: 5 },
      timeoutMinutes: { type: Number, default: 30 },
      retryPolicy: {
        type: String,
        enum: ["none", "linear", "exponential"],
        default: "exponential",
      },

      // Trigger configuration for universal engine
      triggers: [
        {
          eventType: { type: String, required: true },
          enabled: { type: Boolean, default: true },
          priority: {
            type: String,
            enum: ["low", "normal", "high", "urgent"],
            default: "normal",
          },
          filter: Object, // Event filtering criteria
          schedule: String, // Cron expression for scheduled triggers
        },
      ],

      // Input/Output schema for validation
      inputSchema: Object, // JSON Schema for input validation
      outputSchema: Object, // JSON Schema for output validation

      // Environment requirements
      requiredEnvironment: [String], // Required env vars
      requiredTools: [String], // Required tools from LangChain service
      requiredIntegrations: [String], // Required external integrations
    },

    // Template Metadata
    metadata: {
      category: {
        type: String,
        required: true,
        enum: [
          "customer-service",
          "analytics",
          "marketing",
          "sales",
          "operations",
          "hr",
          "finance",
          "automation",
          "integration",
          "ai-analysis",
          "reporting",
          "notifications",
          "business-intelligence",
          "other",
        ],
      },
      tags: [String],
      complexity: {
        type: String,
        enum: ["simple", "medium", "complex", "expert"],
        default: "medium",
      },
      estimatedRuntime: String, // e.g., "5-10 minutes"

      // Template marketplace features
      isPublic: { type: Boolean, default: false },
      featured: { type: Boolean, default: false },
      downloadCount: { type: Number, default: 0 },
      rating: { type: Number, min: 0, max: 5 },
      ratingCount: { type: Number, default: 0 },

      // Documentation
      documentation: String, // URL to documentation
      examples: [
        {
          name: String,
          description: String,
          input: Object,
          expectedOutput: Object,
        },
      ],

      // Technical details
      nodeCount: Number,
      edgeCount: Number,
      toolsUsed: [String], // List of tools used in this template
      integrations: [String], // External integrations used

      // Compatibility
      minPlatformVersion: { type: String, default: "1.0.0" },
      supportedFormats: [
        {
          type: String,
          enum: ["reactflow", "bpmn", "drawio", "json"],
          default: "reactflow",
        },
      ],
    },

    // Template Lifecycle
    status: {
      type: String,
      enum: ["draft", "testing", "published", "deprecated", "archived"],
      default: "draft",
    },
    publishedAt: Date,
    deprecatedAt: Date,

    // Authorship and Versioning
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: String, // Organization/company name
    license: {
      type: String,
      enum: ["MIT", "Apache-2.0", "GPL-3.0", "Commercial", "Custom"],
      default: "MIT",
    },

    // Version history
    parentTemplate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkflowTemplate",
    },
    versionHistory: [
      {
        version: String,
        changes: String,
        createdAt: Date,
        createdBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Usage tracking
    deploymentCount: { type: Number, default: 0 },
    lastDeployed: Date,
    activeDeployments: { type: Number, default: 0 },

    // Noam App Integration
    noamCompatible: { type: Boolean, default: true },
    reactFlowExport: Object, // Pre-generated ReactFlow format
    lastExported: Date,
    exportCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: "workflow_templates",
  }
);

// Indexes for performance
workflowTemplateSchema.index({ templateId: 1 });
workflowTemplateSchema.index({ "metadata.category": 1 });
workflowTemplateSchema.index({ "metadata.tags": 1 });
workflowTemplateSchema.index({ status: 1 });
workflowTemplateSchema.index({ "metadata.isPublic": 1, "metadata.featured": 1 });
workflowTemplateSchema.index({ createdBy: 1 });

// Virtual for full template identification
workflowTemplateSchema.virtual("fullId").get(function () {
  return `${this.templateId}@${this.version}`;
});

// Methods
workflowTemplateSchema.methods.toReactFlow = function () {
  return {
    id: this.templateId,
    name: this.name,
    description: this.description,
    version: this.version,
    nodes: this.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        ...node.data,
        templateId: this.templateId,
      },
    })),
    edges: this.edges,
    metadata: {
      category: this.metadata.category,
      tags: this.metadata.tags,
      complexity: this.metadata.complexity,
      toolsUsed: this.metadata.toolsUsed,
    },
  };
};

workflowTemplateSchema.methods.incrementDownload = async function () {
  this.metadata.downloadCount += 1;
  this.exportCount += 1;
  this.lastExported = new Date();
  return this.save();
};

workflowTemplateSchema.methods.addRating = async function (rating) {
  const currentTotal = this.metadata.rating * this.metadata.ratingCount;
  this.metadata.ratingCount += 1;
  this.metadata.rating = (currentTotal + rating) / this.metadata.ratingCount;
  return this.save();
};

// Static methods
workflowTemplateSchema.statics.findPublished = function () {
  return this.find({ status: "published", "metadata.isPublic": true });
};

workflowTemplateSchema.statics.findByCategory = function (category) {
  return this.find({
    "metadata.category": category,
    status: "published",
    "metadata.isPublic": true,
  });
};

workflowTemplateSchema.statics.findByTags = function (tags) {
  return this.find({
    "metadata.tags": { $in: tags },
    status: "published",
    "metadata.isPublic": true,
  });
};

// Pre-save middleware
workflowTemplateSchema.pre("save", function (next) {
  // Auto-generate metadata
  if (this.isModified("nodes") || this.isModified("edges")) {
    this.metadata.nodeCount = this.nodes.length;
    this.metadata.edgeCount = this.edges.length;

    // Extract tools used
    this.metadata.toolsUsed = [...new Set(this.nodes.filter((node) => node.data.tool).map((node) => node.data.tool))];

    // Generate ReactFlow export
    this.reactFlowExport = this.toReactFlow();
  }

  // Set published date
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

// Export model with conflict checking
let WorkflowTemplate;
try {
  WorkflowTemplate = mongoose.model("WorkflowTemplate");
} catch {
  WorkflowTemplate = mongoose.model("WorkflowTemplate", workflowTemplateSchema);
}

module.exports = WorkflowTemplate;
