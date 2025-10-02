const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
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
        password: hashedPassword,
        firstName,
        lastName,
        noamUserId,
        role: 'user',
        status: 'active',
        preferences: {
          theme: 'light',
          notifications: {
            email: true,
            push: false,
            workflowComplete: true,
            workflowFailed: true,
            systemUpdates: false
          },
          defaultModel: 'gpt-3.5-turbo'
        },
        security: {
          twoFactorEnabled: false,
          lastPasswordChange: new Date(),
          loginAttempts: 0,
          lockUntil: null
        }
      });

      await user.save();

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Update user with refresh token
      user.security.refreshTokens.push({
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
      // Find user
      const user = await User.findOne({ email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if account is locked
      if (user.security.lockUntil && user.security.lockUntil > Date.now()) {
        const lockTimeRemaining = Math.ceil((user.security.lockUntil - Date.now()) / 1000 / 60);
        throw new Error(`Account locked. Try again in ${lockTimeRemaining} minutes`);
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return await this.handleFailedLogin(user);
      }

      // Check if user is active
      if (user.status !== 'active') {
        throw new Error('Account is not active');
      }

      // Reset login attempts on successful login
      user.security.loginAttempts = 0;
      user.security.lockUntil = null;
      user.security.lastLogin = new Date();

      // Add device info if provided
      if (deviceInfo.userAgent || deviceInfo.ip) {
        user.security.devices.push({
          userAgent: deviceInfo.userAgent,
          ip: deviceInfo.ip,
          lastUsed: new Date()
        });

        // Keep only last 10 devices
        if (user.security.devices.length > 10) {
          user.security.devices = user.security.devices.slice(-10);
        }
      }

      // Generate tokens
      const tokens = this.generateTokens(user);

      // Clean up expired refresh tokens and add new one
      user.security.refreshTokens = user.security.refreshTokens.filter(
        token => token.expiresAt > new Date()
      );
      
      user.security.refreshTokens.push({
        token: tokens.refreshToken,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + this.parseTimeToMs(this.refreshTokenExpiresIn))
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
    user.security.loginAttempts += 1;
    
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockTime = parseInt(process.env.ACCOUNT_LOCK_TIME) || 30 * 60 * 1000; // 30 minutes

    if (user.security.loginAttempts >= maxAttempts) {
      user.security.lockUntil = new Date(Date.now() + lockTime);
      await user.save();
      throw new Error('Too many failed login attempts. Account locked');
    }

    await user.save();
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
      const tokenRecord = user.security.refreshTokens.find(
        token => token.token === refreshToken && token.expiresAt > new Date()
      );

      if (!tokenRecord) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Replace old refresh token with new one
      user.security.refreshTokens = user.security.refreshTokens.filter(
        token => token.token !== refreshToken
      );
      
      user.security.refreshTokens.push({
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
        user.security.refreshTokens = user.security.refreshTokens.filter(
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
        user.security.refreshTokens = [];
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
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      user.password = hashedPassword;
      user.security.lastPasswordChange = new Date();
      
      // Invalidate all refresh tokens (force re-login)
      user.security.refreshTokens = [];

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
      const decoded = jwt.verify(token, this.jwtSecret);
      const user = await User.findById(decoded.userId);

      if (!user || user.status !== 'active') {
        throw new Error('User not found or inactive');
      }

      return {
        user: this.sanitizeUser(user),
        decoded
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
    delete userObj.password;
    delete userObj.security.refreshTokens;
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