const express = require('express');
const { WorkflowTemplate } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

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
router.get('/', optionalAuth, asyncHandler(async (req, res) => {
  const {
    category,
    tags,
    search,
    limit = 20,
    offset = 0
  } = req.query;

  const query = { active: true };

  if (category) {
    query.category = category;
  }

  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : tags.split(',');
    query.tags = { $in: tagArray };
  }

  if (search) {
    query.$text = { $search: search };
  }

  const templates = await WorkflowTemplate.find(query)
    .sort({ popularity: -1, createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(offset))
    .select('-template.nodes.config.secrets -template.configuration.secrets');

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
        hasMore: parseInt(offset) + templates.length < total
      }
    }
  });
}));

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
router.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const templateId = req.params.id;

  const template = await WorkflowTemplate.findOne({
    _id: templateId,
    active: true
  }).select('-template.nodes.config.secrets -template.configuration.secrets');

  if (!template) {
    return res.status(404).json({
      error: 'Template not found',
      message: 'The requested template does not exist or is not active'
    });
  }

  // Increment view count
  template.analytics.views += 1;
  await template.save();

  res.json({
    success: true,
    data: { template }
  });
}));

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
router.post('/:id/use', asyncHandler(async (req, res) => {
  const templateId = req.params.id;
  const userId = req.user._id.toString();
  const { name, customization = {} } = req.body;

  const template = await WorkflowTemplate.findOne({
    _id: templateId,
    active: true
  });

  if (!template) {
    return res.status(404).json({
      error: 'Template not found',
      message: 'The requested template does not exist or is not active'
    });
  }

  // Create workflow from template
  const WorkflowService = require('../services/WorkflowService');
  const workflowService = new WorkflowService();

  const workflowData = {
    name: name || `${template.name} (from template)`,
    description: template.description,
    nodes: template.template.nodes,
    edges: template.template.edges,
    configuration: {
      ...template.template.configuration,
      ...customization.configuration
    },
    tags: [...(template.tags || []), 'from-template'],
    category: template.category
  };

  const workflow = await workflowService.createWorkflow(workflowData, userId);

  // Update template usage analytics
  template.analytics.uses += 1;
  template.analytics.lastUsed = new Date();
  await template.save();

  res.status(201).json({
    success: true,
    message: 'Workflow created from template',
    data: { workflow, template: { id: template._id, name: template.name } }
  });
}));

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
router.get('/meta/categories', asyncHandler(async (req, res) => {
  const categories = await WorkflowTemplate.distinct('category', { active: true });
  
  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const count = await WorkflowTemplate.countDocuments({ 
        category, 
        active: true 
      });
      return { name: category, count };
    })
  );

  res.json({
    success: true,
    data: { categories: categoriesWithCounts }
  });
}));

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
router.get('/meta/tags', asyncHandler(async (req, res) => {
  const pipeline = [
    { $match: { active: true } },
    { $unwind: '$tags' },
    { $group: { _id: '$tags', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 50 },
    { $project: { name: '$_id', count: 1, _id: 0 } }
  ];

  const tags = await WorkflowTemplate.aggregate(pipeline);

  res.json({
    success: true,
    data: { tags }
  });
}));

module.exports = router;