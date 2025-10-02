const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/requests.log' })
  ]
});

const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request details
  const requestLog = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?._id,
    timestamp: new Date().toISOString(),
    headers: {
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
      'x-api-key': req.get('X-API-Key') ? '[REDACTED]' : undefined
    }
  };

  // Log request body for non-GET requests (but redact sensitive data)
  if (req.method !== 'GET' && req.body) {
    requestLog.body = sanitizeRequestBody(req.body);
  }

  logger.info('Request started', requestLog);

  // Capture response details
  const originalSend = res.send;
  
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log response details
    const responseLog = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?._id,
      timestamp: new Date().toISOString(),
      responseSize: Buffer.byteLength(data, 'utf8')
    };

    // Log response body for errors
    if (res.statusCode >= 400) {
      try {
        responseLog.responseBody = JSON.parse(data);
      } catch (e) {
        responseLog.responseBody = data?.substring(0, 500);
      }
    }

    const logLevel = res.statusCode >= 500 ? 'error' : 
                    res.statusCode >= 400 ? 'warn' : 'info';
    
    logger.log(logLevel, 'Request completed', responseLog);

    // Call original send method
    originalSend.call(this, data);
  };

  next();
};

// Sanitize request body to remove sensitive information
const sanitizeRequestBody = (body) => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'apiKey',
    'accessToken',
    'refreshToken',
    'authorization'
  ];

  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  // Recursively sanitize nested objects
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeRequestBody(sanitized[key]);
    }
  }

  return sanitized;
};

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Log slow requests (over 5 seconds)
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration: `${duration.toFixed(2)}ms`,
        statusCode: res.statusCode,
        userId: req.user?._id,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add performance header
    res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
  });

  next();
};

// Request ID middleware for tracing
const requestId = (req, res, next) => {
  const id = req.get('X-Request-ID') || generateRequestId();
  req.requestId = id;
  res.set('X-Request-ID', id);
  next();
};

const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  // Log potential security events
  const securityEvents = [];

  // Check for common attack patterns
  const url = req.originalUrl.toLowerCase();
  const userAgent = req.get('User-Agent') || '';

  // SQL injection patterns
  if (url.includes('union select') || url.includes('drop table') || url.includes('insert into')) {
    securityEvents.push('potential_sql_injection');
  }

  // XSS patterns
  if (url.includes('<script>') || url.includes('javascript:') || url.includes('onerror=')) {
    securityEvents.push('potential_xss');
  }

  // Path traversal
  if (url.includes('../') || url.includes('..\\')) {
    securityEvents.push('potential_path_traversal');
  }

  // Suspicious user agents
  if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('scanner')) {
    securityEvents.push('automated_request');
  }

  // Log security events
  if (securityEvents.length > 0) {
    logger.warn('Security event detected', {
      events: securityEvents,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

// Request size monitoring
const requestSizeMonitor = (req, res, next) => {
  if (req.get('Content-Length')) {
    const size = parseInt(req.get('Content-Length'));
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (size > maxSize) {
      logger.warn('Large request detected', {
        method: req.method,
        url: req.originalUrl,
        size: `${(size / 1024 / 1024).toFixed(2)}MB`,
        userId: req.user?._id,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  next();
};

module.exports = {
  requestLogger,
  performanceMonitor,
  requestId,
  securityLogger,
  requestSizeMonitor
};