const express = require("express");
const { Workflow } = require("../models");
const { asyncHandler } = require("../middleware/errorHandler");
const { authMiddleware } = require("../middleware/auth");
const WorkflowService = require("../services/WorkflowService");

const router = express.Router();
const workflowService = new WorkflowService();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/workflows/save-from-universal:
 *   post:
 *     summary: Save a Universal Workflow Engine workflow
 *     description: Save a workflow from the Universal Workflow Engine format as an individual workflow (not a template)
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - nodes
 *               - edges
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the workflow
 *                 example: "Customer Data Processing"
 *               description:
 *                 type: string
 *                 description: Description of the workflow
 *                 example: "Processes customer data and sends notifications"
 *               nodes:
 *                 type: array
 *                 description: Workflow nodes
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [trigger, agent, tool, condition, loop, humanReview, webhook, delay, parallel, merge]
 *                     position:
 *                       type: object
 *                       properties:
 *                         x:
 *                           type: number
 *                         y:
 *                           type: number
 *                     data:
 *                       type: object
 *                       properties:
 *                         label:
 *                           type: string
 *                         tool:
 *                           type: string
 *                         parameters:
 *                           type: object
 *               edges:
 *                 type: array
 *                 description: Workflow edges
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     source:
 *                       type: string
 *                     target:
 *                       type: string
 *               configuration:
 *                 type: object
 *                 properties:
 *                   maxConcurrentExecutions:
 *                     type: number
 *                     default: 5
 *                   timeoutMinutes:
 *                     type: number
 *                     default: 30
 *                   retryPolicy:
 *                     type: string
 *                     enum: [none, linear, exponential]
 *                     default: none
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["automation", "customer-service"]
 *               category:
 *                 type: string
 *                 enum: [marketing, sales, support, automation, analysis, integration, custom]
 *                 default: custom
 *     responses:
 *       201:
 *         description: Workflow saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     status:
 *                       type: string
 *                     version:
 *                       type: string
 *                     ownerId:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     executionUrl:
 *                       type: string
 *       400:
 *         description: Invalid workflow data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  "/save-from-universal",
  asyncHandler(async (req, res) => {
    const workflowData = req.body;

    // Debug: Log the received data
    console.log("Received workflow data:", {
      name: workflowData.name,
      nodesType: typeof workflowData.nodes,
      nodesLength: workflowData.nodes?.length,
      edgesType: typeof workflowData.edges,
      edgesLength: workflowData.edges?.length,
      firstNode: workflowData.nodes?.[0],
      metadata: workflowData.metadata,
      noamAccountId: workflowData.metadata?.noamAccountId,
      userNoamAccountId: req.user?.noamAccountId,
    });

    try {
      // Validate required fields
      if (!workflowData.name) {
        return res.status(400).json({
          success: false,
          error: "Missing required field",
          message: "Workflow name is required",
        });
      }

      if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
        return res.status(400).json({
          success: false,
          error: "Invalid workflow data",
          message: "Nodes array is required",
        });
      }

      if (!workflowData.edges || !Array.isArray(workflowData.edges)) {
        return res.status(400).json({
          success: false,
          error: "Invalid workflow data",
          message: "Edges array is required",
        });
      }

      // Get user ID from authenticated request
      const userId = req.user?.id || req.user?._id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: "Unauthorized",
          message: "User authentication required",
        });
      }

      // Transform Universal Workflow Engine format to WorkflowService format
      const transformedData = {
        ...workflowData,
        // Map required fields
        owner: userId, // Use 'owner' not 'ownerId'
        noamAccountId: String(workflowData.metadata?.noamAccountId || req.user?.noamAccountId || "default-account"), // Required field - convert to string
        nodes: workflowData.nodes.map((node) => {
          // Map node types from Universal Engine to WorkflowService format
          let mappedType = node.type;
          if (node.type === "agent") mappedType = "llm"; // LangChainService expects 'llm' for validation
          if (node.type === "start") mappedType = "start"; // Keep 'start' for execution compatibility
          if (node.type === "api") mappedType = "tool";
          if (node.type === "end") mappedType = "end"; // Keep 'end' for execution compatibility

          // Extract prompt for agent nodes
          const prompt = node.data?.prompt || node.data?.systemPrompt || node.data?.userPrompt || "Default prompt";

          // Extract tool name for tool nodes
          const toolName = node.data?.tool || node.data?.toolName || "default_tool";

          // Debug: Log tool node transformation
          if (node.type === "api" || mappedType === "tool") {
            console.log("Tool node transformation:", {
              originalType: node.type,
              mappedType: mappedType,
              nodeData: node.data,
              extractedToolName: toolName,
            });
          }

          const transformedNode = {
            ...node,
            type: mappedType,
            data: {
              ...node.data,
              label: node.data?.label || "Node",
            },
            config: {
              // For LLM nodes, ensure prompt is present
              ...(mappedType === "llm" && { prompt }),
              // For tool nodes, ensure toolName is present
              ...(mappedType === "tool" && { toolName }),
              // Common config
              parameters: node.data?.parameters || node.data?.config || {},
              ...node.config,
            },
          };

          // Debug: Log final transformed node for tool nodes
          if (mappedType === "tool") {
            console.log("Final tool node config:", {
              nodeId: transformedNode.id,
              type: transformedNode.type,
              config: transformedNode.config,
            });
          }

          return transformedNode;
        }),
      };

      // Debug: Log the transformed data
      console.log("Transformed workflow data:", {
        name: transformedData.name,
        owner: transformedData.owner,
        noamAccountId: transformedData.noamAccountId,
        noamAccountIdType: typeof transformedData.noamAccountId,
        nodesCount: transformedData.nodes?.length,
        firstNodeType: transformedData.nodes?.[0]?.type,
      });

      // Create workflow using WorkflowService
      const workflow = await workflowService.createWorkflow(transformedData, userId);

      res.status(201).json({
        success: true,
        message: "Universal workflow saved successfully",
        data: {
          id: workflow._id,
          name: workflow.name,
          description: workflow.description,
          status: workflow.status,
          version: workflow.version,
          ownerId: workflow.owner,
          createdAt: workflow.createdAt,
          executionUrl: `/api/universal/workflows/execute`,
        },
      });
    } catch (error) {
      console.error("Save universal workflow error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to save universal workflow",
        message: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     description: Retrieve a specific workflow by its ID
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Workflow ID
 *     responses:
 *       200:
 *         description: Workflow retrieved successfully
 *       404:
 *         description: Workflow not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const workflowId = req.params.id;
    const userId = req.user?.id || req.user?._id;

    try {
      const workflow = await Workflow.findById(workflowId);

      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: "Workflow not found",
          message: "The requested workflow does not exist",
        });
      }

      // Check if user has access to this workflow
      if (workflow.owner.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this workflow",
        });
      }

      res.status(200).json({
        success: true,
        data: { workflow },
      });
    } catch (error) {
      console.error("Get workflow error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve workflow",
        message: error.message,
      });
    }
  })
);

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: List user's workflows
 *     description: Get all workflows owned by the authenticated user
 *     tags: [Workflows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, active, paused, archived, deprecated]
 *         description: Filter by workflow status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by workflow category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of workflows to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of workflows to skip
 *     responses:
 *       200:
 *         description: Workflows retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?._id;
    const { status, category, limit = 20, offset = 0 } = req.query;

    try {
      // Build query filter
      const filter = { owner: userId };

      if (status) {
        filter.status = status;
      }

      if (category) {
        filter.category = category;
      }

      const workflows = await Workflow.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit)).skip(parseInt(offset)).select("-nodes -edges"); // Exclude large fields for list view

      const total = await Workflow.countDocuments(filter);

      res.status(200).json({
        success: true,
        data: {
          workflows,
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + workflows.length < total,
          },
        },
      });
    } catch (error) {
      console.error("List workflows error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve workflows",
        message: error.message,
      });
    }
  })
);

router.post('/create-direct', async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId; // Adjust as needed for auth
    const workflow = await workflowService.createDirectWorkflow(req.body, userId);
    res.json({ success: true, workflow });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
