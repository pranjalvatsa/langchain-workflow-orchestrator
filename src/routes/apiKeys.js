const express = require('express');
const crypto = require('crypto');
const { ApiKey } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: List user API keys
 *     tags: [API Keys]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  const apiKeys = await ApiKey.find({ 
    owner: userId,
    isActive: true 
  }).select('-keyHash').sort({ createdAt: -1 });

  const formattedKeys = apiKeys.map(key => ({
    id: key._id,
    name: key.name,
    description: key.description,
    keyId: key.keyId,
    keyPreview: `${key.keyPrefix}***${key.keyId.slice(-4)}`,
    permissions: key.permissions,
    scopes: key.scopes,
    isActive: key.isActive,
    noamAccountId: key.noamAccountId,
    usage: key.usage,
    rateLimit: key.rateLimit,
    createdAt: key.createdAt,
    expiresAt: key.expiresAt
  }));

  res.json({
    success: true,
    data: { 
      apiKeys: formattedKeys,
      totalCount: formattedKeys.length
    }
  });
}));

/**
 * @swagger
 * /api/keys/generate:
 *   post:
 *     summary: Generate new API key for Universal Workflow Engine
 *     description: Creates a new API key with full access to Universal Workflow Engine for Noam integration
 *     tags: [API Keys]
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
 *               - noamAccountId
 *             properties:
 *               name:
 *                 type: string
 *                 description: Human-readable name for the API key
 *                 example: "Noam Integration Key"
 *               description:
 *                 type: string
 *                 description: Optional description
 *                 example: "API key for Noam app to access Universal Workflow Engine"
 *               noamAccountId:
 *                 type: string
 *                 description: Noam account ID for tracking
 *                 example: "noam_account_123"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     resource:
 *                       type: string
 *                       enum: [workflows, executions, templates, universal]
 *                     actions:
 *                       type: array
 *                       items:
 *                         type: string
 *                         enum: [read, write, execute, delete]
 *               expiresIn:
 *                 type: string
 *                 description: Expiration time (e.g., "30d", "1y", "never")
 *                 example: "1y"
 *               rateLimit:
 *                 type: object
 *                 properties:
 *                   requestsPerMinute:
 *                     type: number
 *                     default: 1000
 *                   requestsPerHour:
 *                     type: number
 *                     default: 10000
 *                   requestsPerDay:
 *                     type: number
 *                     default: 100000
 *     responses:
 *       201:
 *         description: API key created successfully
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
 *                     apiKey:
 *                       type: string
 *                       description: Full API key (only shown once)
 *                     keyId:
 *                       type: string
 *                     permissions:
 *                       type: array
 *                     expiresAt:
 *                       type: string
 *                     usage:
 *                       type: object
 */
router.post('/generate', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { 
    name, 
    description, 
    noamAccountId, 
    permissions,
    expiresIn = "1y",
    rateLimit 
  } = req.body;

  if (!name || !noamAccountId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      message: 'name and noamAccountId are required'
    });
  }

  // Check if user has reached API key limit
  const existingKeys = await ApiKey.countDocuments({ 
    owner: userId,
    isActive: true 
  });

  if (existingKeys >= 10) {
    return res.status(400).json({
      success: false,
      error: 'API key limit reached',
      message: 'You can have a maximum of 10 active API keys'
    });
  }

  // Generate unique key ID and API key
  const keyId = crypto.randomBytes(16).toString('hex');
  const keyValue = `lwo_${keyId}_${crypto.randomBytes(32).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');
  const keyPrefix = `lwo_${keyId.substring(0, 8)}`;

  // Default permissions for Universal Workflow Engine
  const defaultPermissions = permissions || [
    {
      resource: 'universal',
      actions: ['read', 'write', 'execute']
    },
    {
      resource: 'workflows',
      actions: ['read', 'execute']
    },
    {
      resource: 'templates', 
      actions: ['read', 'write']
    },
    {
      resource: 'executions',
      actions: ['read', 'write']
    }
  ];

  // Default rate limits for Noam integration
  const defaultRateLimit = {
    requestsPerMinute: rateLimit?.requestsPerMinute || 1000,
    requestsPerHour: rateLimit?.requestsPerHour || 10000,
    requestsPerDay: rateLimit?.requestsPerDay || 100000
  };

  // Calculate expiration date
  let expiresAt = null;
  if (expiresIn && expiresIn !== 'never') {
    const duration = parseTimeString(expiresIn);
    if (duration) {
      expiresAt = new Date(Date.now() + duration);
    }
  }

  // Create API key document
  const apiKeyDoc = new ApiKey({
    name,
    description: description || `API key for ${name}`,
    keyId,
    keyHash,
    keyPrefix,
    owner: userId,
    noamAccountId,
    permissions: defaultPermissions,
    scopes: generateScopes(defaultPermissions),
    rateLimit: defaultRateLimit,
    usage: {
      totalRequests: 0,
      lastUsedAt: null,
      requestsThisMinute: 0,
      lastMinuteReset: new Date()
    },
    isActive: true,
    expiresAt
  });

  await apiKeyDoc.save();

  console.log(`✅ API key generated: ${keyId} for user ${req.user.email} (Noam: ${noamAccountId})`);

  res.status(201).json({
    success: true,
    message: 'API key generated successfully',
    data: {
      id: apiKeyDoc._id,
      name: apiKeyDoc.name,
      description: apiKeyDoc.description,
      apiKey: keyValue, // Only shown once
      keyId: apiKeyDoc.keyId,
      keyPreview: `${keyPrefix}***${keyId.slice(-4)}`,
      permissions: apiKeyDoc.permissions,
      scopes: apiKeyDoc.scopes,
      rateLimit: apiKeyDoc.rateLimit,
      noamAccountId: apiKeyDoc.noamAccountId,
      expiresAt: apiKeyDoc.expiresAt,
      
      // Integration information for Noam
      integration: {
        endpoints: {
          execute: '/api/universal/workflows/execute',
          schedule: '/api/universal/workflows/schedule', 
          trigger: '/api/universal/workflows/trigger',
          import: '/api/templates/import/reactflow',
          export: '/api/templates/import/noam'
        },
        usage: {
          header: 'X-API-Key',
          example: `curl -H "X-API-Key: ${keyValue}" https://your-domain.com/api/universal/workflows/execute`
        }
      }
    }
  });
}));

/**
 * @swagger
 * /api/keys/{id}:
 *   put:
 *     summary: Update API key
 *     tags: [API Keys]
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
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: API key updated successfully
 */
router.put('/:id', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const keyId = req.params.id;
  const { name, permissions, active } = req.body;

  const user = await User.findById(userId);
  const apiKey = user.apiKeys.id(keyId);

  if (!apiKey) {
    return res.status(404).json({
      error: 'API key not found',
      message: 'The specified API key does not exist'
    });
  }

  // Update fields
  if (name !== undefined) apiKey.name = name;
  if (permissions !== undefined) apiKey.permissions = permissions;
  if (active !== undefined) apiKey.active = active;

  await user.save();

  res.json({
    success: true,
    message: 'API key updated successfully',
    data: {
      id: apiKey._id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      active: apiKey.active
    }
  });
}));

/**
 * @swagger
 * /api/keys/{id}:
 *   delete:
 *     summary: Delete API key
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key deleted successfully
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const keyId = req.params.id;

  const user = await User.findById(userId);
  const apiKey = user.apiKeys.id(keyId);

  if (!apiKey) {
    return res.status(404).json({
      error: 'API key not found',
      message: 'The specified API key does not exist'
    });
  }

  user.apiKeys.pull(keyId);
  await user.save();

  res.json({
    success: true,
    message: 'API key deleted successfully'
  });
}));

/**
 * @swagger
 * /api/keys/{id}/regenerate:
 *   post:
 *     summary: Regenerate API key
 *     tags: [API Keys]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: API key regenerated successfully
 */
router.post('/:id/regenerate', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const keyId = req.params.id;

  const user = await User.findById(userId);
  const apiKey = user.apiKeys.id(keyId);

  if (!apiKey) {
    return res.status(404).json({
      error: 'API key not found',
      message: 'The specified API key does not exist'
    });
  }

  // Generate new key value
  const newKeyValue = `lwo_${crypto.randomBytes(32).toString('hex')}`;
  apiKey.key = newKeyValue;
  apiKey.createdAt = new Date();
  apiKey.lastUsed = null;

  await user.save();

  res.json({
    success: true,
    message: 'API key regenerated successfully',
    data: {
      id: apiKey._id,
      key: newKeyValue, // Only shown once
      name: apiKey.name
    }
  });
}));

// Helper function to parse time strings like "30d", "1h", "15m", "1y"
function parseTimeString(timeString) {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    M: 30 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000
  };

  const match = timeString.match(/^(\d+)([smhdwMy])$/);
  if (!match) {
    return null;
  }

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}

// Helper function to generate scopes from permissions
function generateScopes(permissions) {
  const scopes = [];
  
  permissions.forEach(permission => {
    permission.actions.forEach(action => {
      scopes.push(`${permission.resource}:${action}`);
    });
  });
  
  return scopes;
}

module.exports = router;