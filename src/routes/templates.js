const express = require('express');
const { WorkflowTemplate } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { optionalAuth } = require('../middleware/auth');
const WorkflowService = require('../services/WorkflowService');

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
router.post('/import/noam', asyncHandler(async (req, res) => {
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

    const templates = await WorkflowTemplate.find(query)
      .populate('createdBy', 'name email')
      .lean();

    const noamExport = {
      exportInfo: {
        timestamp: new Date().toISOString(),
        source: 'langchain-workflow-orchestrator',
        version: '1.0.0',
        totalTemplates: templates.length,
        categories: [...new Set(templates.map(t => t.category))]
      },
      workflows: templates.map(template => ({
        // Core identification
        id: template._id.toString(),
        templateId: template.templateId || template._id.toString(),
        name: template.name,
        description: template.description,
        category: template.category,
        
        // ReactFlow format for canvas import
        reactFlow: {
          nodes: (template.nodes || []).map(node => ({
            id: node.id || `node-${Math.random().toString(36).substr(2, 9)}`,
            type: node.type || 'default',
            position: node.position || { x: 0, y: 0 },
            data: {
              label: node.data?.label || node.name || 'Node',
              description: node.data?.description || '',
              tool: node.data?.tool,
              parameters: node.data?.parameters || {},
              ...node.data,
              // Mark as imported from Universal Engine
              imported: true,
              source: 'universal-engine',
              originalTemplate: template._id.toString()
            }
          })),
          edges: (template.edges || []).map(edge => ({
            id: edge.id || `edge-${Math.random().toString(36).substr(2, 9)}`,
            source: edge.source,
            target: edge.target,
            type: edge.type || 'default',
            label: edge.label || '',
            ...edge
          })),
          viewport: { x: 0, y: 0, zoom: 1 }
        },
        
        // Metadata for Noam app
        metadata: {
          tags: template.tags || [],
          complexity: template.complexity || 'medium',
          estimatedRuntime: template.estimatedRuntime || '5-10 minutes',
          toolsUsed: (template.nodes || [])
            .filter(node => node.data?.tool)
            .map(node => node.data.tool),
          nodeCount: (template.nodes || []).length,
          edgeCount: (template.edges || []).length,
          
          // Import tracking
          importedFrom: 'langchain-orchestrator',
          importedAt: new Date().toISOString(),
          originalId: template._id.toString(),
          originalVersion: template.version || '1.0.0'
        },
        
        // Configuration for execution
        configuration: {
          maxConcurrentExecutions: 5,
          timeoutMinutes: 30,
          retryPolicy: 'exponential',
          triggers: template.triggers || [],
          requiredEnvironment: template.requiredEnvironment || [],
          inputSchema: template.inputSchema || {}
        }
      }))
    };

    // Update download tracking
    await WorkflowTemplate.updateMany(
      { _id: { $in: templates.map(t => t._id) } },
      { 
        $inc: { downloadCount: 1 },
        $set: { lastDownloaded: new Date() }
      }
    );

    res.json({
      success: true,
      message: `Exported ${templates.length} workflow templates for Noam app import`,
      data: noamExport,
      instructions: {
        import: 'Use this data to import workflows into Noam app',
        format: 'ReactFlow compatible canvas format',
        reverse_engineering: 'Each workflow can be edited in Noam visual editor'
      }
    });

  } catch (error) {
    console.error('Noam export error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export templates for Noam',
      message: error.message
    });
  }
}));

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
router.get('/:id/reactflow', asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const template = await WorkflowTemplate.findById(id).lean();
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const reactFlowData = {
      id: template._id.toString(),
      name: template.name,
      description: template.description,
      
      // Canvas data
      nodes: (template.nodes || []).map(node => ({
        id: node.id || `node-${Math.random().toString(36).substr(2, 9)}`,
        type: node.type || 'default',
        position: node.position || { x: 0, y: 0 },
        data: {
          label: node.data?.label || node.name || 'Node',
          ...node.data
        }
      })),
      
      edges: (template.edges || []).map(edge => ({
        id: edge.id || `edge-${Math.random().toString(36).substr(2, 9)}`,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'default',
        ...edge
      })),
      
      // Metadata
      metadata: {
        category: template.category,
        tags: template.tags || [],
        toolsUsed: (template.nodes || [])
          .filter(node => node.data?.tool)
          .map(node => node.data.tool)
      }
    };

    res.json({
      success: true,
      data: reactFlowData
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get ReactFlow format',
      message: error.message
    });
  }
}));

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
router.post('/save-from-universal', asyncHandler(async (req, res) => {
  const templateData = req.body;

  try {
    // Create new WorkflowTemplate using the existing model
    const template = new UniversalWorkflowTemplate({
      templateId: templateData.templateId,
      name: templateData.name,
      description: templateData.description,
      version: templateData.version || '1.0.0',
      nodes: templateData.nodes || [],
      edges: templateData.edges || [],
      configuration: templateData.configuration || {},
      metadata: {
        category: templateData.category || 'other',
        tags: templateData.tags || [],
        complexity: templateData.complexity || 'medium',
        isPublic: templateData.isPublic || false,
        ...templateData.metadata
      },
      createdBy: req.user?.id || 'system',
      status: 'published'
    });

    await template.save();

    res.status(201).json({
      success: true,
      message: 'Universal workflow template saved successfully',
      data: {
        id: template._id,
        templateId: template.templateId,
        name: template.name,
        version: template.version,
        noamImportUrl: `/api/templates/${template._id}/reactflow`
      }
    });

  } catch (error) {
    console.error('Save universal template error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save universal template',
      message: error.message
    });
  }
}));

module.exports = router;