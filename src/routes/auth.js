const express = require('express');
const AuthService = require('../services/AuthService');
const { asyncHandler } = require('../middleware/errorHandler');
const { userRateLimit } = require('../middleware/auth');

const router = express.Router();
const authService = new AuthService();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               noamUserId:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input data
 *       409:
 *         description: User already exists
 */
router.post('/register', userRateLimit(5), async (req, res) => {
  try {
    const { email, password, firstName, lastName, noamUserId } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email, password, first name, and last name are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email',
        message: 'Please provide a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        error: 'Weak password',
        message: 'Password must be at least 8 characters long'
      });
    }

    console.log('Attempting to register user:', { email, firstName, lastName, noamUserId });

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      noamUserId
    });

    console.log('Registration successful:', result);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });
  } catch (error) {
    console.error('Registration error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', userRateLimit(10), asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: 'Missing credentials',
      message: 'Email and password are required'
    });
  }

  const deviceInfo = {
    userAgent: req.get('User-Agent'),
    ip: req.ip
  };

  const result = await authService.login(email, password, deviceInfo);

  res.json({
    success: true,
    message: 'Login successful',
    data: result
  });
}));

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 */
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      error: 'Missing refresh token',
      message: 'Refresh token is required'
    });
  }

  const tokens = await authService.refreshToken(refreshToken);

  res.json({
    success: true,
    message: 'Token refreshed successfully',
    data: tokens
  });
}));

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const userId = req.user?._id;

  if (userId && refreshToken) {
    await authService.logout(userId, refreshToken);
  }

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * @swagger
 * /api/auth/logout-all:
 *   post:
 *     summary: Logout from all devices
 *     tags: [Authentication]
 */
router.post('/logout-all', asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  if (userId) {
    await authService.logoutAll(userId);
  }

  res.json({
    success: true,
    message: 'Logged out from all devices'
  });
}));

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 */
router.post('/change-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user?._id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      error: 'Missing passwords',
      message: 'Current password and new password are required'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      error: 'Weak password',
      message: 'New password must be at least 8 characters long'
    });
  }

  await authService.changePassword(userId, currentPassword, newPassword);

  res.json({
    success: true,
    message: 'Password changed successfully'
  });
}));

/**
 * @swagger
 * /api/auth/integrate-noam:
 *   post:
 *     summary: Integrate with Noam account
 *     tags: [Authentication]
 */
router.post('/integrate-noam', asyncHandler(async (req, res) => {
  const { noamToken, noamUserId } = req.body;
  const userId = req.user?._id;

  if (!noamToken || !noamUserId) {
    return res.status(400).json({
      error: 'Missing Noam credentials',
      message: 'Noam token and user ID are required'
    });
  }

  const user = await authService.integateWithNoam(userId, noamToken, noamUserId);

  res.json({
    success: true,
    message: 'Noam integration completed',
    data: { user }
  });
}));

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify current token
 *     tags: [Authentication]
 */
router.get('/verify', asyncHandler(async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(400).json({
      error: 'Missing token',
      message: 'Authorization token is required'
    });
  }

  const result = await authService.verifyToken(token);

  res.json({
    success: true,
    message: 'Token is valid',
    data: result
  });
}));

module.exports = router;