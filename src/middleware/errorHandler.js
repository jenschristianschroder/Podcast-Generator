import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

/**
 * Enhanced error handling middleware
 * Provides consistent error responses and logging
 */
export const errorHandler = (err, req, res, next) => {
  // Default error values
  let status = err.status || err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let code = err.code || 'INTERNAL_ERROR';

  // Enhanced error logging with request context
  const errorContext = {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code
    },
    request: {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      ip: req.ip
    },
    timestamp: new Date().toISOString()
  };

  // Handle specific error types
  switch (err.name) {
    case 'ValidationError':
      status = 400;
      code = 'VALIDATION_ERROR';
      message = 'Request validation failed';
      break;
      
    case 'CastError':
      status = 400;
      code = 'INVALID_ID';
      message = 'Invalid ID format';
      break;
      
    case 'JsonWebTokenError':
      status = 401;
      code = 'INVALID_TOKEN';
      message = 'Invalid authentication token';
      break;
      
    case 'TokenExpiredError':
      status = 401;
      code = 'TOKEN_EXPIRED';
      message = 'Authentication token expired';
      break;
      
    case 'MulterError':
      status = 400;
      code = 'FILE_UPLOAD_ERROR';
      message = 'File upload failed';
      break;

    case 'TimeoutError':
      status = 504;
      code = 'REQUEST_TIMEOUT';
      message = 'Request timeout - operation took too long';
      break;

    case 'AzureError':
      status = 502;
      code = 'AZURE_SERVICE_ERROR';
      message = 'Azure service temporarily unavailable';
      break;

    case 'AgentError':
      status = 422;
      code = 'AGENT_PROCESSING_ERROR';
      message = 'AI agent processing failed';
      break;
  }

  // Handle Azure OpenAI specific errors
  if (err.response?.status) {
    status = err.response.status;
    
    switch (err.response.status) {
      case 401:
        code = 'AZURE_AUTH_ERROR';
        message = 'Azure authentication failed';
        break;
      case 403:
        code = 'AZURE_PERMISSION_ERROR';
        message = 'Insufficient Azure permissions';
        break;
      case 429:
        code = 'AZURE_RATE_LIMIT';
        message = 'Azure service rate limit exceeded';
        break;
      case 500:
        code = 'AZURE_INTERNAL_ERROR';
        message = 'Azure service internal error';
        break;
    }
  }

  // Log error with appropriate level
  if (status >= 500) {
    logger.error('Server error occurred', errorContext);
  } else if (status >= 400) {
    logger.warn('Client error occurred', errorContext);
  }

  // Prepare error response
  const errorResponse = {
    error: {
      code,
      message,
      status,
      timestamp: new Date().toISOString()
    }
  };

  // Add validation details for validation errors
  if (err.details) {
    errorResponse.error.details = err.details;
  }

  // Add stack trace in development
  if (config.isDevelopment && status >= 500) {
    errorResponse.error.stack = err.stack;
    errorResponse.error.context = errorContext;
  }

  // Add retry information for certain errors
  if (status === 429 || status === 503 || status === 504) {
    errorResponse.error.retryAfter = err.retryAfter || 60;
    errorResponse.error.retryable = true;
  }

  // Send error response
  res.status(status).json(errorResponse);
};

/**
 * Async error wrapper to catch Promise rejections
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res) => {
  const error = {
    code: 'NOT_FOUND',
    message: `Route ${req.originalUrl} not found`,
    status: 404,
    timestamp: new Date().toISOString()
  };

  logger.warn('Route not found', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip
  });

  res.status(404).json({ error });
};

/**
 * Custom error classes
 */
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
    this.code = 'VALIDATION_ERROR';
    this.details = details;
  }
}

export class AgentError extends Error {
  constructor(message, agentName, originalError = null) {
    super(message);
    this.name = 'AgentError';
    this.status = 422;
    this.code = 'AGENT_PROCESSING_ERROR';
    this.agentName = agentName;
    this.originalError = originalError;
  }
}

export class AzureError extends Error {
  constructor(message, service, originalError = null) {
    super(message);
    this.name = 'AzureError';
    this.status = 502;
    this.code = 'AZURE_SERVICE_ERROR';
    this.service = service;
    this.originalError = originalError;
  }
}

export default errorHandler;
