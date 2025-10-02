const mongoose = require('mongoose');

// User Schema for Noam integration
const userSchema = new mongoose.Schema({
  // Basic Information
  noamUserId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Authentication
  passwordHash: {
    type: String,
    select: false // Don't include in queries by default
  },
  refreshTokens: [{
    token: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: Date,
    userAgent: String,
    ipAddress: String
  }],
  
  // Authorization & Permissions
  role: {
    type: String,
    enum: ['admin', 'manager', 'developer', 'user'],
    default: 'user'
  },
  permissions: [{
    resource: String, // 'workflows', 'executions', 'templates', etc.
    actions: [String] // ['create', 'read', 'update', 'delete', 'execute']
  }],
  
  // Noam Integration
  noamAccountId: {
    type: String,
    required: true,
    index: true
  },
  noamEnvironment: {
    type: String,
    enum: ['development', 'staging', 'production'],
    default: 'development'
  },
  noamApiKeyHash: {
    type: String,
    select: false
  },
  
  // User Preferences
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      webhook: { type: Boolean, default: false }
    },
    defaultModel: {
      type: String,
      default: 'gpt-3.5-turbo'
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  
  // Activity Tracking
  lastLoginAt: Date,
  lastActiveAt: Date,
  loginCount: { type: Number, default: 0 },
  
  // Status
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  isSuspended: { type: Boolean, default: false },
  suspensionReason: String,
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'users'
});

// Indexes
userSchema.index({ noamUserId: 1, noamAccountId: 1 });
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Methods
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.passwordHash;
  delete user.refreshTokens;
  delete user.noamApiKeyHash;
  return user;
};

userSchema.methods.hasPermission = function(resource, action) {
  if (this.role === 'admin') return true;
  
  const permission = this.permissions.find(p => p.resource === resource);
  return permission && permission.actions.includes(action);
};

userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('User', userSchema);