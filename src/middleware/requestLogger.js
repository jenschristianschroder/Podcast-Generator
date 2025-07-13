import { logger } from '../utils/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request logging middleware
 * Logs all incoming requests with correlation IDs and performance metrics
 */
export const requestLogger = (req, res, next) => {
  // Generate correlation ID for request tracking
  req.correlationId = uuidv4();
  
  // Start time for performance measurement
  const startTime = Date.now();

  // Extract useful request information
  const requestInfo = {
    correlationId: req.correlationId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer')
  };

  // Log request start (excluding sensitive body data)
  const loggedBody = sanitizeRequestBody(req.body);
  logger.http('Request started', {
    ...requestInfo,
    body: loggedBody,
    query: req.query,
    params: req.params
  });

  // Override res.end to capture response information
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    // Calculate response time
    const duration = Date.now() - startTime;
    
    // Capture response information
    const responseInfo = {
      correlationId: req.correlationId,
      statusCode: res.statusCode,
      contentLength: res.get('Content-Length'),
      duration: `${duration}ms`
    };

    // Log response with appropriate level based on status code
    if (res.statusCode >= 500) {
      logger.error('Request completed with server error', {
        ...requestInfo,
        ...responseInfo
      });
    } else if (res.statusCode >= 400) {
      logger.warn('Request completed with client error', {
        ...requestInfo,
        ...responseInfo
      });
    } else {
      logger.http('Request completed successfully', {
        ...requestInfo,
        ...responseInfo
      });
    }

    // Log performance warning for slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow request detected', {
        correlationId: req.correlationId,
        duration: `${duration}ms`,
        url: req.originalUrl,
        method: req.method
      });
    }

    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };

  // Add correlation ID to response headers for client tracking
  res.set('X-Correlation-ID', req.correlationId);

  next();
};

/**
 * Sanitize request body to remove sensitive information from logs
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'authorization',
    'auth',
    'credentials'
  ];

  const sanitized = { ...body };

  // Recursively sanitize nested objects
  function sanitizeObject(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullPath = path ? `${path}.${key}` : key;
      
      // Check if field name contains sensitive keywords
      const isSensitive = sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      );

      if (isSensitive) {
        obj[key] = '[REDACTED]';
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitizeObject(value, fullPath);
      }
    }
  }

  sanitizeObject(sanitized);
  return sanitized;
}

/**
 * Enhanced request logger for specific operations
 */
export class OperationLogger {
  constructor(operation, correlationId) {
    this.operation = operation;
    this.correlationId = correlationId;
    this.startTime = Date.now();
    this.steps = [];
  }

  step(stepName, metadata = {}) {
    const stepTime = Date.now();
    const stepInfo = {
      step: stepName,
      timestamp: new Date().toISOString(),
      elapsed: `${stepTime - this.startTime}ms`,
      correlationId: this.correlationId,
      ...metadata
    };

    this.steps.push(stepInfo);
    
    logger.debug(`${this.operation} - ${stepName}`, stepInfo);
  }

  complete(result = {}) {
    const duration = Date.now() - this.startTime;
    
    logger.info(`${this.operation} completed`, {
      correlationId: this.correlationId,
      duration: `${duration}ms`,
      totalSteps: this.steps.length,
      result: typeof result === 'object' ? Object.keys(result) : result
    });

    return {
      operation: this.operation,
      correlationId: this.correlationId,
      duration,
      steps: this.steps,
      result
    };
  }

  error(error, step = null) {
    const duration = Date.now() - this.startTime;
    
    logger.error(`${this.operation} failed`, {
      correlationId: this.correlationId,
      duration: `${duration}ms`,
      failedStep: step,
      error: error.message,
      stack: error.stack,
      completedSteps: this.steps.length
    });

    return {
      operation: this.operation,
      correlationId: this.correlationId,
      duration,
      error: error.message,
      failedStep: step,
      completedSteps: this.steps
    };
  }
}

export default requestLogger;
