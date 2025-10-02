const AuthService = require('../services/AuthService');

const authService = new AuthService();

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('X-API-Key');
    
    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    const { user, decoded } = await authService.verifyToken(token);
    
    req.user = user;
    req.tokenData = decoded;
    
    next();
  } catch (error) {
    if (error.message === 'Token expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please refresh your token or login again'
      });
    }
    
    return res.status(401).json({
      error: 'Invalid token',
      message: error.message
    });
  }
};

// Role-based access control middleware
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please login to access this resource'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: `This resource requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// Workspace access middleware
const requireWorkspaceAccess = async (req, res, next) => {
  try {
    const workflowId = req.params.workflowId || req.params.id;
    
    if (!workflowId) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Workflow ID is required'
      });
    }

    const { Workflow } = require('../models');
    const workflow = await Workflow.findById(workflowId);
    
    if (!workflow) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Workflow not found'
      });
    }

    const userId = req.user._id.toString();
    const hasAccess = 
      workflow.ownerId.toString() === userId ||
      workflow.sharing.collaborators.some(c => c.userId.toString() === userId) ||
      workflow.sharing.public === true;

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'You do not have permission to access this workflow'
      });
    }

    req.workflow = workflow;
    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Rate limiting per user
const userRateLimit = (requestsPerMinute = 60) => {
  const userRequests = new Map();
  
  return (req, res, next) => {
    const userId = req.user?._id?.toString() || req.ip;
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute window
    
    if (!userRequests.has(userId)) {
      userRequests.set(userId, []);
    }
    
    const requests = userRequests.get(userId);
    
    // Remove old requests
    while (requests.length > 0 && requests[0] < windowStart) {
      requests.shift();
    }
    
    if (requests.length >= requestsPerMinute) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${requestsPerMinute} requests per minute`,
        retryAfter: Math.ceil((requests[0] + 60000 - now) / 1000)
      });
    }
    
    requests.push(now);
    next();
  };
};

// API key authentication middleware
const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.header('X-API-Key');
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide a valid API key'
      });
    }

    // Validate API key format
    if (!apiKey.startsWith('lwo_')) {
      return res.status(401).json({
        error: 'Invalid API key format',
        message: 'API key must start with "lwo_"'
      });
    }

    // In a real implementation, you would validate against a database
    // For now, we'll just check if it matches a pattern
    const { User } = require('../models');
    const user = await User.findOne({
      'apiKeys.key': apiKey,
      'apiKeys.active': true
    });

    if (!user) {
      return res.status(401).json({
        error: 'Invalid API key',
        message: 'The provided API key is not valid or has been revoked'
      });
    }

    // Update last used timestamp
    const apiKeyRecord = user.apiKeys.find(k => k.key === apiKey);
    if (apiKeyRecord) {
      apiKeyRecord.lastUsed = new Date();
      await user.save();
    }

    req.user = user;
    req.apiKey = apiKeyRecord;
    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      try {
        const { user, decoded } = await authService.verifyToken(token);
        req.user = user;
        req.tokenData = decoded;
      } catch (error) {
        // Ignore authentication errors for optional auth
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

module.exports = {
  authMiddleware,
  requireRole,
  requireWorkspaceAccess,
  userRateLimit,
  apiKeyAuth,
  optionalAuth
};