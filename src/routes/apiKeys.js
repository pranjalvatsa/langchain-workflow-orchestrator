const express = require('express');
const crypto = require('crypto');
const { User } = require('../models');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * /api/keys:
 *   get:
 *     summary: List user API keys
 *     tags: [API Keys]
 *     responses:
 *       200:
 *         description: List of API keys
 */
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const user = await User.findById(userId).select('apiKeys');

  const apiKeys = user.apiKeys.map(key => ({
    id: key._id,
    name: key.name,
    keyPreview: `${key.key.substring(0, 8)}...${key.key.slice(-4)}`,
    permissions: key.permissions,
    active: key.active,
    createdAt: key.createdAt,
    lastUsed: key.lastUsed,
    expiresAt: key.expiresAt
  }));

  res.json({
    success: true,
    data: { apiKeys }
  });
}));

/**
 * @swagger
 * /api/keys:
 *   post:
 *     summary: Create new API key
 *     tags: [API Keys]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *               expiresIn:
 *                 type: string
 *     responses:
 *       201:
 *         description: API key created successfully
 */
router.post('/', asyncHandler(async (req, res) => {
  const userId = req.user._id.toString();
  const { name, permissions = ['read', 'write'], expiresIn } = req.body;

  if (!name) {
    return res.status(400).json({
      error: 'Missing name',
      message: 'API key name is required'
    });
  }

  const user = await User.findById(userId);

  // Check if user has reached API key limit
  const activeKeys = user.apiKeys.filter(key => key.active);
  if (activeKeys.length >= 10) {
    return res.status(400).json({
      error: 'API key limit reached',
      message: 'You can have a maximum of 10 active API keys'
    });
  }

  // Generate API key
  const keyValue = `lwo_${crypto.randomBytes(32).toString('hex')}`;
  
  // Calculate expiration date
  let expiresAt = null;
  if (expiresIn) {
    const duration = parseTimeString(expiresIn);
    if (duration) {
      expiresAt = new Date(Date.now() + duration);
    }
  }

  const apiKey = {
    name,
    key: keyValue,
    permissions,
    active: true,
    createdAt: new Date(),
    expiresAt
  };

  user.apiKeys.push(apiKey);
  await user.save();

  const createdKey = user.apiKeys[user.apiKeys.length - 1];

  res.status(201).json({
    success: true,
    message: 'API key created successfully',
    data: {
      id: createdKey._id,
      name: createdKey.name,
      key: keyValue, // Only shown once
      permissions: createdKey.permissions,
      expiresAt: createdKey.expiresAt
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

// Helper function to parse time strings like "30d", "1h", "15m"
function parseTimeString(timeString) {
  const units = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  const match = timeString.match(/^(\d+)([smhd])$/);
  if (!match) {
    return null;
  }

  const [, value, unit] = match;
  return parseInt(value) * units[unit];
}

module.exports = router;