const express = require('express');
const WorkflowService = require('../services/WorkflowService');
const { asyncHandler } = require('../middleware/errorHandler');
const { requireRole, requireWorkspaceAccess } = require('../middleware/auth');

const router = express.Router();
const workflowService = new WorkflowService();

/**
 * @swagger
 * /api/workflows:
 *   get:
 *     summary: List user workflows
 *     tags: [Workflows]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
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
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of workflows
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const filters = {
    status: req.query.status,
    category: req.query.category,
    tags: req.query.tags ? req.query.tags.split(',') : undefined,
    search: req.query.search,
    limit: parseInt(req.query.limit) || 50,
    offset: parseInt(req.query.offset) || 0
  };

  const workflows = await workflowService.listWorkflows(userId, filters);

  res.json({
    success: true,
    data: {
      workflows,
      count: workflows.length,
      filters
    }
  });
}));

/**
 * @swagger
 * /api/workflows:
 *   post:
 *     summary: Create a new workflow
 *     tags: [Workflows]
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
 *               description:
 *                 type: string
 *               nodes:
 *                 type: array
 *               edges:
 *                 type: array
 *               configuration:
 *                 type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               category:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workflow created successfully
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const workflowData = req.body;

  // Validate required fields
  if (!workflowData.name || !workflowData.nodes || !workflowData.edges) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'Name, nodes, and edges are required'
    });
  }

  const workflow = await workflowService.createWorkflow(workflowData, userId);

  res.status(201).json({
    success: true,
    message: 'Workflow created successfully',
    data: { workflow }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}:
 *   get:
 *     summary: Get workflow by ID
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow details
 *       404:
 *         description: Workflow not found
 */
router.get('/:id', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workflow = req.workflow; // Set by requireWorkspaceAccess middleware

  res.json({
    success: true,
    data: { workflow }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}:
 *   put:
 *     summary: Update workflow
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Workflow updated successfully
 */
router.put('/:id', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user._id.toString();
  const updates = req.body;

  // Check if user has write access
  const workflow = req.workflow;
  if (workflow.ownerId.toString() !== userId) {
    const collaboration = workflow.sharing.collaborators.find(c => c.userId.toString() === userId);
    if (!collaboration || collaboration.permissions !== 'write') {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'You do not have write permission for this workflow'
      });
    }
  }

  const updatedWorkflow = await workflowService.updateWorkflow(workflowId, updates, userId);

  res.json({
    success: true,
    message: 'Workflow updated successfully',
    data: { workflow: updatedWorkflow }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}:
 *   delete:
 *     summary: Delete workflow
 *     tags: [Workflows]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Workflow deleted successfully
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user._id.toString();

  await workflowService.deleteWorkflow(workflowId, userId);

  res.json({
    success: true,
    message: 'Workflow deleted successfully'
  });
}));

/**
 * @swagger
 * /api/workflows/{id}/validate:
 *   post:
 *     summary: Validate workflow
 *     tags: [Workflows]
 */
router.post('/:id/validate', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workflow = req.workflow;
  
  const validation = await workflowService.validateWorkflow(workflow);

  res.json({
    success: true,
    data: { validation }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}/share:
 *   post:
 *     summary: Share workflow
 *     tags: [Workflows]
 */
router.post('/:id/share', asyncHandler(async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user._id.toString();
  const sharing = req.body;

  const workflow = await workflowService.shareWorkflow(workflowId, userId, sharing);

  res.json({
    success: true,
    message: 'Workflow sharing updated',
    data: { workflow }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}/stats:
 *   get:
 *     summary: Get workflow statistics
 *     tags: [Workflows]
 */
router.get('/:id/stats', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user._id.toString();

  const stats = await workflowService.getWorkflowStats(workflowId, userId);

  res.json({
    success: true,
    data: { stats }
  });
}));

/**
 * @swagger
 * /api/workflows/{id}/export:
 *   get:
 *     summary: Export workflow
 *     tags: [Workflows]
 */
router.get('/:id/export', requireWorkspaceAccess, asyncHandler(async (req, res) => {
  const workflowId = req.params.id;
  const userId = req.user._id.toString();
  const format = req.query.format || 'json';

  const exportData = await workflowService.exportWorkflow(workflowId, userId, format);

  res.setHeader('Content-Type', format === 'yaml' ? 'text/yaml' : 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="workflow-${workflowId}.${format}"`);
  res.send(exportData);
}));

/**
 * @swagger
 * /api/workflows/import:
 *   post:
 *     summary: Import workflow
 *     tags: [Workflows]
 */
router.post('/import', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { data, format = 'json' } = req.body;

  if (!data) {
    return res.status(400).json({
      error: 'Missing data',
      message: 'Workflow data is required for import'
    });
  }

  const workflow = await workflowService.importWorkflow(data, userId, format);

  res.status(201).json({
    success: true,
    message: 'Workflow imported successfully',
    data: { workflow }
  });
}));

module.exports = router;