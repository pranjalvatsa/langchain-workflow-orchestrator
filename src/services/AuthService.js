const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const winston = require('winston');

class AuthService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/auth.log' })
      ]
    });

    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
  }

  async register(userData) {
    try {
      const { email, password, firstName, lastName, noamUserId } = userData;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { email },
          { noamUserId }
        ]
      });

      if (existingUser) {
        throw new Error('User already exists with this email or Noam ID');
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const user = new User({
        email,
        passwordHash: hashedPassword,
        name: `${firstName} ${lastName}`,
        noamUserId: noamUserId || `noam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        noamAccountId: noamUserId || `account_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        role: 'user',
        isActive: true,
        isEmailVerified: false,
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: false,
            webhook: false
          },
          defaultModel: 'gpt-3.5-turbo',
          timezone: 'UTC'
        },
        loginCount: 0
      });

      await user.save();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Update user with refresh token
      user.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTimeToMs(this.refreshTokenExpiresIn))
      });
      await user.save();

      this.logger.info(`User registered: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Registration error:', error);
      throw error;
    }
  }

  async login(email, password, deviceInfo = {}) {
    try {
      // Find user and include passwordHash
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is suspended
      if (user.isSuspended) {
        throw new Error(`Account suspended: ${user.suspensionReason || 'Contact administrator'}`);
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is not active');
      }

      // Update login info
      user.loginCount += 1;
      user.lastLoginAt = new Date();

      // Add device info if provided
      user.lastActiveAt = new Date();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Clean up expired refresh tokens and add new one
      user.refreshTokens = user.refreshTokens.filter(
        token => token.expiresAt > new Date()
      );
      
      user.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTimeToMs(this.refreshTokenExpiresIn)),
        userAgent: deviceInfo.userAgent,
        ipAddress: deviceInfo.ip
      });

      await user.save();

      this.logger.info(`User logged in: ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        tokens
      };
    } catch (error) {
      this.logger.error('Login error:', error);
      throw error;
    }
  }

  async handleFailedLogin(user) {
    // Since we removed security.loginAttempts, we'll skip this for now
    // or implement a simpler version
    throw new Error('Invalid credentials');
  }

  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtSecret);
      const user = await User.findById(decoded.userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Check if refresh token exists and is valid
      const tokenRecord = user.refreshTokens.find(
        token => token.token === refreshToken && token.expiresAt > new Date()
      );

      if (!tokenRecord) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Replace old refresh token with new one
      user.refreshTokens = user.refreshTokens.filter(
        token => token.token !== refreshToken
      );
      
      user.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTimeToMs(this.refreshTokenExpiresIn))
      });

      await user.save();

      return tokens;
    } catch (error) {
      this.logger.error('Token refresh error:', error);
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId, refreshToken) {
    try {
      const user = await User.findById(userId);
      if (user) {
        // Remove the specific refresh token
        user.refreshTokens = user.refreshTokens.filter(
          token => token.token !== refreshToken
        );
        await user.save();
      }

      this.logger.info(`User logged out: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Logout error:', error);
      throw error;
    }
  }

  async logoutAll(userId) {
    try {
      const user = await User.findById(userId);
      if (user) {
        // Remove all refresh tokens
        user.refreshTokens = [];
        await user.save();
      }

      this.logger.info(`User logged out from all devices: ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Logout all error:', error);
      throw error;
    }
  }

  async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.passwordHash = hashedPassword;
      user.lastPasswordChange = new Date();
      
      // Invalidate all refresh tokens (force re-login)
      user.refreshTokens = [];

      await user.save();

      this.logger.info(`Password changed for user: ${user.email}`);
      return true;
    } catch (error) {
      this.logger.error('Change password error:', error);
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      // Check if it's an API key (starts with 'lwo_')
      if (token.startsWith('lwo_')) {
        return await this.verifyApiKey(token);
      }
      
      // Otherwise, treat as JWT token
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await User.findById(decoded.userId);

      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return {
        user: this.sanitizeUser(user),
        decoded,
        authType: 'jwt'
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  async verifyApiKey(apiKey) {
    try {
      const { ApiKey } = require('../models');
      const User = require('../models/User');
      
      // Extract key ID from the API key format: lwo_keyId_hash
      const keyParts = apiKey.split('_');
      if (keyParts.length < 3 || keyParts[0] !== 'lwo') {
        throw new Error('Invalid API key format');
      }
      
      const keyId = keyParts[1];
      
      // Find the API key in database
      const apiKeyDoc = await ApiKey.findOne({ keyId }).select('+keyHash');
      
      if (!apiKeyDoc) {
        throw new Error('API key not found');
      }

      // Check if API key is active
      if (!apiKeyDoc.isActive) {
        throw new Error('API key is inactive');
      }

      // Check if API key has expired
      if (apiKeyDoc.expiresAt && apiKeyDoc.expiresAt < new Date()) {
        throw new Error('API key has expired');
      }

      // Verify the API key hash
      const crypto = require('crypto');
      const providedHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      
      if (providedHash !== apiKeyDoc.keyHash) {
        throw new Error('Invalid API key');
      }

      // Update last used timestamp and usage stats
      apiKeyDoc.usage.lastUsedAt = new Date();
      apiKeyDoc.usage.totalRequests += 1;
      
      // Simple rate limiting check
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);
      
      if (!apiKeyDoc.usage.requestsThisMinute) {
        apiKeyDoc.usage.requestsThisMinute = 1;
        apiKeyDoc.usage.lastMinuteReset = now;
      } else if (apiKeyDoc.usage.lastMinuteReset < oneMinuteAgo) {
        apiKeyDoc.usage.requestsThisMinute = 1;
        apiKeyDoc.usage.lastMinuteReset = now;
      } else {
        apiKeyDoc.usage.requestsThisMinute += 1;
      }

      // Check rate limits
      if (apiKeyDoc.usage.requestsThisMinute > apiKeyDoc.rateLimit.requestsPerMinute) {
        throw new Error('API key rate limit exceeded');
      }

      await apiKeyDoc.save();

      // Get the associated user
      const user = await User.findById(apiKeyDoc.owner);
      if (!user || !user.isActive) {
        throw new Error('Associated user not found or inactive');
      }

      this.logger.info(`API key authentication successful: ${keyId} for user ${user.email}`);

      return {
        user: this.sanitizeUser(user),
        apiKey: {
          id: apiKeyDoc._id,
          keyId: apiKeyDoc.keyId,
          name: apiKeyDoc.name,
          permissions: apiKeyDoc.permissions,
          scopes: apiKeyDoc.scopes,
          noamAccountId: apiKeyDoc.noamAccountId
        },
        authType: 'apikey'
      };
    } catch (error) {
      this.logger.error('API key verification error:', error);
      throw error;
    }
  }

  async integateWithNoam(userId, noamToken, noamUserId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify Noam token (implement actual verification)
      const noamUserData = await this.verifyNoamToken(noamToken);
      
      if (noamUserData.id !== noamUserId) {
        throw new Error('Noam user ID mismatch');
      }

      // Update user with Noam integration
      user.noamUserId = noamUserId;
      user.noamIntegration = {
        connected: true,
        connectedAt: new Date(),
        accessToken: noamToken,
        userData: noamUserData
      };

      await user.save();

      this.logger.info(`Noam integration completed for user: ${user.email}`);
      return this.sanitizeUser(user);
    } catch (error) {
      this.logger.error('Noam integration error:', error);
      throw error;
    }
  }

  async verifyNoamToken(token) {
    // Implement actual Noam API verification
    // This is a placeholder
    try {
      const response = await fetch(`${process.env.NOAM_API_URL}/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Invalid Noam token');
      }

      return await response.json();
    } catch (error) {
      throw new Error('Failed to verify Noam token');
    }
  }

  generateTokens(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      noamUserId: user.noamUserId
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn
    });

    const refreshToken = jwt.sign(
      { userId: user._id, type: 'refresh' },
      this.jwtSecret,
      { expiresIn: this.refreshTokenExpiresIn }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTimeToMs(this.jwtExpiresIn)
    };
  }

  sanitizeUser(user) {
    const userObj = user.toObject ? user.toObject() : user;
    delete userObj.passwordHash;
    delete userObj.refreshTokens;
    return userObj;
  }

  parseTimeToMs(timeString) {
    const units = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    const match = timeString.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error('Invalid time format');
    }

    const [, value, unit] = match;
    return parseInt(value) * units[unit];
  }

  async getUserByNoamId(noamUserId) {
    try {
      return await User.findOne({ noamUserId });
    } catch (error) {
      this.logger.error('Error finding user by Noam ID:', error);
      throw error;
    }
  }

  async updateUserProfile(userId, updates) {
    try {
      const allowedFields = ['firstName', 'lastName', 'preferences'];
      const sanitizedUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          sanitizedUpdates[key] = updates[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: sanitizedUpdates },
        { new: true }
      );

      return this.sanitizeUser(user);
    } catch (error) {
      this.logger.error('Error updating user profile:', error);
      throw error;
    }
  }
}

module.exports = AuthService;