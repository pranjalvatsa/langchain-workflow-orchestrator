const express = require("express");
const { WorkflowTemplate } = require("../models");
const { asyncHandler } = require("../middleware/errorHandler");
const { optionalAuth, authMiddleware } = require("../middleware/auth");
const WorkflowService = require("../services/WorkflowService");

const router = express.Router();
const workflowService = new WorkflowService();

// Use the existing WorkflowTemplate model from the models/index.js
const UniversalWorkflowTemplate = WorkflowTemplate;

/**
 * @swagger
 * /api/templates:
 *   get:
 *     summary: List workflow templates
 *     tags: [Templates]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of templates
 */
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const { category, tags, search, limit = 20, offset = 0 } = req.query;

    const query = { active: true };

    if (category) {
      query.category = category;
    }

    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray };
    }

    if (search) {
      query.$text = { $search: search };
    }

    const templates = await WorkflowTemplate.find(query)
      .sort({ popularity: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .select("-template.nodes.config.secrets -template.configuration.secrets");

    const total = await WorkflowTemplate.countDocuments(query);

    res.json({
      success: true,
      data: {
        templates,
        count: templates.length,
        total,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + templates.length < total,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/templates/{id}:
 *   get:
 *     summary: Get template by ID
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template details
 *       404:
 *         description: Template not found
 */
router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const templateId = req.params.id;

    const template = await WorkflowTemplate.findOne({
      templateId: templateId,
      active: true,
    }).select("-template.nodes.config.secrets -template.configuration.secrets");

    if (!template) {
      return res.status(404).json({
        error: "Template not found",
        message: "The requested template does not exist or is not active",
      });
    }

    // Increment view count
    if (!template.analytics) {
      template.analytics = { uses: 0, lastUsed: null, views: 0 };
    }
    template.analytics.uses += 1;
    template.analytics.lastUsed = new Date();
    await template.save();

    res.json({
      success: true,
      data: { template },
    });
  })
);

/**
 * @swagger
 * /api/templates/{id}/use:
 *   post:
 *     summary: Create workflow from template
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               customization:
 *                 type: object
 *     responses:
 *       201:
 *         description: Workflow created from template
 */
router.post(
  "/:id/use",
  asyncHandler(async (req, res) => {
    const templateId = req.params.id;
    const userId = req.user._id.toString();
    const { name, customization = {} } = req.body;

    const template = await WorkflowTemplate.findOne({
      templateId: templateId,
      active: true,
    });

    if (!template) {
      return res.status(404).json({
        error: "Template not found",
        message: "The requested template does not exist or is not active",
      });
    }

    // Create workflow from template
    const WorkflowService = require("../services/WorkflowService");
    const workflowService = new WorkflowService();

    const workflowData = {
      name: name || `${template.name} (from template)`,
      description: template.description,
      nodes: template.nodes, // <-- fix here
      edges: template.edges, // <-- fix here
      configuration: {
        ...template.configuration,
        ...customization.configuration,
      },
      tags: [...(template.tags || []), "from-template"],
      category: template.category,
    };

    const workflow = await workflowService.createWorkflow(workflowData, userId);

     // Removed analytics usage tracking to prevent errors

    res.status(201).json({
      success: true,
      message: "Workflow created from template",
      data: {
        workflow,
        template: {
          id: template.templateId || template._id || null,
          name: template.name || null
        }
      }
    });
  })
);

/**
 * @swagger
 * /api/templates/categories:
 *   get:
 *     summary: Get template categories
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get(
  "/meta/categories",
  asyncHandler(async (req, res) => {
    const categories = await WorkflowTemplate.distinct("category", { active: true });

    const categoriesWithCounts = await Promise.all(
      categories.map(async (category) => {
        const count = await WorkflowTemplate.countDocuments({
          category,
          active: true,
        });
        return { name: category, count };
      })
    );

    res.json({
      success: true,
      data: { categories: categoriesWithCounts },
    });
  })
);

/**
 * @swagger
 * /api/templates/tags:
 *   get:
 *     summary: Get popular template tags
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: List of popular tags
 */
router.get(
  "/meta/tags",
  asyncHandler(async (req, res) => {
    const pipeline = [
      { $match: { active: true } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 },
      { $project: { name: "$_id", count: 1, _id: 0 } },
    ];

    const tags = await WorkflowTemplate.aggregate(pipeline);

    res.json({
      success: true,
      data: { tags },
    });
  })
);

/**
 * @swagger
 * /api/templates/import/noam:
 *   post:
 *     summary: Export templates for Noam app import
 *     description: Export workflow templates in Noam-compatible ReactFlow format
 *     tags: [Templates]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               templateIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               category:
 *                 type: string
 *               includePrivate:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Templates exported for Noam import
 */
router.post(
  "/import/noam",
  asyncHandler(async (req, res) => {
    const { templateIds, category, includePrivate = false } = req.body;

    try {
      const query = { active: true };

      if (templateIds && templateIds.length > 0) {
        query._id = { $in: templateIds };
      }
      if (category) {
        query.category = category;
      }
      if (!includePrivate) {
        query.isPublic = true;
      }

      const templates = await WorkflowTemplate.find(query).populate("createdBy", "name email").lean();

      const noamExport = {
        exportInfo: {
          timestamp: new Date().toISOString(),
          source: "langchain-workflow-orchestrator",
          version: "1.0.0",
          totalTemplates: templates.length,
          categories: [...new Set(templates.map((t) => t.category))],
        },
        workflows: templates.map((template) => ({
          // Core identification
          id: template._id.toString(),
          templateId: template.templateId || template._id.toString(),
          name: template.name,
          description: template.description,
          category: template.category,

          // ReactFlow format for canvas import
          reactFlow: {
            nodes: (template.nodes || []).map((node) => ({
              id: node.id || `node-${Math.random().toString(36).substr(2, 9)}`,
              type: node.type || "default",
              position: node.position || { x: 0, y: 0 },
              data: {
                label: node.data?.label || node.name || "Node",
                description: node.data?.description || "",
                tool: node.data?.tool,
                parameters: node.data?.parameters || {},
                ...node.data,
                // Mark as imported from Universal Engine
                imported: true,
                source: "universal-engine",
                originalTemplate: template._id.toString(),
              },
            })),
            edges: (template.edges || []).map((edge) => ({
              id: edge.id || `edge-${Math.random().toString(36).substr(2, 9)}`,
              source: edge.source,
              target: edge.target,
              type: edge.type || "default",
              label: edge.label || "",
              ...edge,
            })),
            viewport: { x: 0, y: 0, zoom: 1 },
          },

          // Metadata for Noam app
          metadata: {
            tags: template.tags || [],
            complexity: template.complexity || "medium",
            estimatedRuntime: template.estimatedRuntime || "5-10 minutes",
            toolsUsed: (template.nodes || []).filter((node) => node.data?.tool).map((node) => node.data.tool),
            nodeCount: (template.nodes || []).length,
            edgeCount: (template.edges || []).length,

            // Import tracking
            importedFrom: "langchain-orchestrator",
            importedAt: new Date().toISOString(),
            originalId: template._id.toString(),
            originalVersion: template.version || "1.0.0",
          },

          // Configuration for execution
          configuration: {
            maxConcurrentExecutions: 5,
            timeoutMinutes: 30,
            retryPolicy: "exponential",
            triggers: template.triggers || [],
            requiredEnvironment: template.requiredEnvironment || [],
            inputSchema: template.inputSchema || {},
          },
        })),
      };

      // Update download tracking
      await WorkflowTemplate.updateMany(
        { _id: { $in: templates.map((t) => t._id) } },
        {
          $inc: { downloadCount: 1 },
          $set: { lastDownloaded: new Date() },
        }
      );

      res.json({
        success: true,
        message: `Exported ${templates.length} workflow templates for Noam app import`,
        data: noamExport,
        instructions: {
          import: "Use this data to import workflows into Noam app",
          format: "ReactFlow compatible canvas format",
          reverse_engineering: "Each workflow can be edited in Noam visual editor",
        },
      });
    } catch (error) {
      console.error("Noam export error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export templates for Noam",
        message: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/templates/{id}/reactflow:
 *   get:
 *     summary: Get template in ReactFlow format
 *     description: Get a specific template formatted for ReactFlow canvas
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Template in ReactFlow format
 *       404:
 *         description: Template not found
 */
router.get(
  "/:id/reactflow",
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const template = await WorkflowTemplate.findById(id).lean();

      if (!template) {
        return res.status(404).json({
          success: false,
          error: "Template not found",
        });
      }

      const reactFlowData = {
        id: template._id.toString(),
        name: template.name,
        description: template.description,

        // Canvas data
        nodes: (template.nodes || []).map((node) => ({
          id: node.id || `node-${Math.random().toString(36).substr(2, 9)}`,
          type: node.type || "default",
          position: node.position || { x: 0, y: 0 },
          data: {
            label: node.data?.label || node.name || "Node",
            ...node.data,
          },
        })),

        // Metadata
        metadata: {
          category: template.category,
          tags: template.tags || [],
          toolsUsed: (template.nodes || []).filter((node) => node.data?.tool).map((node) => node.data.tool),
        },
      };

      res.json({
        success: true,
        data: reactFlowData,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Failed to get ReactFlow format",
        message: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/templates/save-from-universal:
 *   post:
 *     summary: Save a Universal Workflow Engine template
 *     description: Save a workflow template from the Universal Workflow Engine format
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - name
 *               - description
 *               - nodes
 *               - edges
 *     responses:
 *       201:
 *         description: Template saved successfully
 */
router.post(
  "/save-from-universal",
  asyncHandler(async (req, res) => {
    const templateData = req.body;

    // Debug: Log the received data
    console.log("Received template data:", {
      templateId: templateData.templateId,
      nodesType: typeof templateData.nodes,
      nodesLength: templateData.nodes?.length,
      edgesType: typeof templateData.edges,
      edgesLength: templateData.edges?.length,
      firstNode: templateData.nodes?.[0],
    });

    try {
      // Create new WorkflowTemplate using the existing model
      const template = new UniversalWorkflowTemplate({
        templateId: templateData.templateId,
        name: templateData.name,
        description: templateData.description,
        version: templateData.version || "1.0.0",
        category: templateData.category || "automation", // Required at root level
        nodes: templateData.nodes || [],
        edges: templateData.edges || [],
        configuration: templateData.configuration || {},
        metadata: {
          tags: templateData.tags || [],
          complexity: templateData.complexity || "medium",
          isPublic: templateData.isPublic || false,
          ...templateData.metadata,
        },
        author: req.user?.id || req.user?._id || new (require("mongoose").Types.ObjectId)(), // Required author field
        status: "published",
      });

      await template.save();

      res.status(201).json({
        success: true,
        message: "Universal workflow template saved successfully",
        data: {
          id: template._id,
          templateId: template.templateId,
          name: template.name,
          version: template.version,
          noamImportUrl: `/api/templates/${template._id}/reactflow`,
        },
      });
    } catch (error) {
      console.error("Save universal template error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save universal template",
        message: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/templates/import/reactflow:
 *   post:
 *     summary: Import workflow from Noam ReactFlow canvas
 *     description: Accepts ReactFlow workflow from Noam app and creates Universal Engine template
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               workflow:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   description:
 *                     type: string
 *                   category:
 *                     type: string
 *                   nodes:
 *                     type: array
 *                   edges:
 *                     type: array
 *               noamMetadata:
 *                 type: object
 *                 properties:
 *                   noamWorkflowId:
 *                     type: string
 *                   noamUserId:
 *                     type: string
 *                   noamAccountId:
 *                     type: string
 *     responses:
 *       201:
 *         description: Workflow successfully imported
 *       400:
 *         description: Invalid workflow format
 */
router.post(
  "/import/reactflow",
  authMiddleware,
  asyncHandler(async (req, res) => {
    try {
      const { workflow, noamMetadata } = req.body;

      if (!workflow || !workflow.nodes || !workflow.edges) {
        return res.status(400).json({
          success: false,
          error: "Invalid workflow format",
          message: "Workflow must contain nodes and edges arrays",
        });
      }

      // Generate unique template ID
      const templateId = `noam-import-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

      // Convert ReactFlow format to Universal Engine format
      const universalTemplate = {
        templateId: templateId,
        name: workflow.name || "Imported from Noam",
        description: workflow.description || "Workflow imported from Noam ReactFlow canvas",
        category: workflow.category || "imported",
        version: "1.0.0",

        // Noam integration metadata
        noamIntegration: {
          imported: true,
          noamWorkflowId: noamMetadata?.noamWorkflowId,
          noamUserId: noamMetadata?.noamUserId,
          noamAccountId: noamMetadata?.noamAccountId,
          importedAt: new Date().toISOString(),
          lastSyncedAt: new Date().toISOString(),
        },

        // Convert ReactFlow nodes to Universal Engine format
        nodes: workflow.nodes.map((node) => ({
          id: node.id,
          type: mapReactFlowTypeToUniversal(node.type),
          position: node.position,
          data: {
            label: node.data?.label || "Node",
            description: node.data?.description || "",

            // Map ReactFlow tools to Universal Engine tools
            tool: mapReactFlowToolToUniversal(node.data?.tool || node.data?.nodeType),
            parameters: node.data?.parameters || node.data?.config || {},

            // Preserve original ReactFlow data for round-trip compatibility
            originalReactFlowData: node.data,

            // Add Universal Engine specific configurations
            ...(node.data?.tool && {
              toolConfig: generateUniversalToolConfig(node.data.tool, node.data.parameters),
            }),
          },
        })),

        // Convert ReactFlow edges to Universal Engine format
        edges: workflow.edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edge.type || "default",
          label: edge.label || "",
          conditions: edge.data?.conditions || null,
        })),

        // Universal Engine execution configuration
        execution: {
          trigger: detectWorkflowTrigger(workflow.nodes),
          timeout: 300000, // 5 minutes default
          retryPolicy: {
            maxRetries: 3,
            retryDelay: 1000,
          },
        },

        // Template metadata
        tags: workflow.tags || ["noam-import", "reactflow"],
        isPublic: false, // Private by default for imported workflows
        status: "published",
        createdBy: noamMetadata?.noamUserId || "noam-import",
      };

      // Save to database
      const savedTemplate = await WorkflowTemplate.create(universalTemplate);

      console.log(`✅ Successfully imported ReactFlow workflow: ${templateId}`);

      res.status(201).json({
        success: true,
        message: "Workflow successfully imported from Noam",
        data: {
          templateId: savedTemplate.templateId,
          _id: savedTemplate._id,
          name: savedTemplate.name,
          category: savedTemplate.category,

          // Provide execution endpoints for Noam
          executionEndpoints: {
            execute: `/api/universal/workflows/execute`,
            schedule: `/api/universal/workflows/schedule`,
            trigger: `/api/universal/workflows/trigger`,
          },

          // Sample execution payload for Noam
          sampleExecution: {
            templateId: savedTemplate.templateId,
            input: generateSampleInput(workflow.nodes),
            metadata: {
              source: "noam-app",
              noamWorkflowId: noamMetadata?.noamWorkflowId,
            },
          },

          // Noam integration info
          noamIntegration: universalTemplate.noamIntegration,
        },
      });
    } catch (error) {
      console.error("ReactFlow import error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to import ReactFlow workflow",
        message: error.message,
      });
    }
  })
);

// Helper function to map ReactFlow node types to Universal Engine types
function mapReactFlowTypeToUniversal(reactFlowType) {
  const typeMapping = {
    input: "trigger",
    default: "task",
    output: "response",
    decision: "condition",
    api: "tool",
    llm: "tool",
    human: "humanReview",
    webhook: "trigger",
    schedule: "trigger",
  };

  return typeMapping[reactFlowType] || "task";
}

// Helper function to map ReactFlow tools to Universal Engine tools
function mapReactFlowToolToUniversal(reactFlowTool) {
  const toolMapping = {
    calculator: "calculator",
    search: "search",
    api_call: "api_caller",
    llm_chat: "llm",
    email: "email_sender",
    database: "database_query",
    webhook: "webhook_sender",
    human_review: "human_review",
    scheduler: "scheduler",
    file_processor: "file_processor",
  };

  return toolMapping[reactFlowTool] || "calculator";
}

// Helper function to generate Universal Engine tool configuration
function generateUniversalToolConfig(toolName, parameters) {
  const baseConfig = {
    tool: toolName,
    parameters: parameters || {},
  };

  // Add tool-specific default configurations
  switch (toolName) {
    case "llm":
      return {
        ...baseConfig,
        model: parameters?.model || "gpt-3.5-turbo",
        temperature: parameters?.temperature || 0.7,
        maxTokens: parameters?.maxTokens || 1000,
      };

    case "api_call":
      return {
        ...baseConfig,
        method: parameters?.method || "GET",
        headers: parameters?.headers || {},
        timeout: parameters?.timeout || 30000,
      };

    case "human_review":
      return {
        ...baseConfig,
        timeout: parameters?.timeout || 86400000, // 24 hours
        assignee: parameters?.assignee || "auto-assign",
      };

    default:
      return baseConfig;
  }
}

// Helper function to detect workflow trigger type
function detectWorkflowTrigger(nodes) {
  const triggerNode = nodes.find((node) => node.type === "input" || node.data?.nodeType === "trigger" || node.data?.tool === "webhook");

  if (triggerNode) {
    if (triggerNode.data?.tool === "webhook") return "webhook";
    if (triggerNode.data?.schedule) return "schedule";
    return "manual";
  }

  return "manual";
}

// Helper function to generate sample input based on workflow nodes
function generateSampleInput(nodes) {
  const inputNode = nodes.find((node) => node.type === "input");

  if (inputNode && inputNode.data?.parameters) {
    return inputNode.data.parameters;
  }

  // Generate basic sample input
  return {
    message: "Sample input from Noam workflow",
    timestamp: new Date().toISOString(),
  };
}

module.exports = router;
