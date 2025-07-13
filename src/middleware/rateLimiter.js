import rateLimit from 'express-rate-limit';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limiting middleware to prevent abuse
 * Configurable based on environment variables
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: Math.ceil(config.rateLimit.windowMs / 1000)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Custom key generator (can be enhanced for user-specific limits)
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  },

  // Enhanced logging
  onLimitReached: (req, res, options) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
  },

  // Skip certain endpoints from rate limiting
  skip: (req) => {
    const skipPaths = ['/api/health', '/api/status'];
    return skipPaths.some(path => req.path.startsWith(path));
  }
});

/**
 * Stricter rate limiting for resource-intensive operations
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: {
    error: 'Too Many Generation Requests',
    message: 'Podcast generation rate limit exceeded. Please wait before creating another podcast.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  onLimitReached: (req, res, options) => {
    logger.warn('Strict rate limit exceeded for podcast generation', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body
    });
  }
});

export default rateLimiter;
