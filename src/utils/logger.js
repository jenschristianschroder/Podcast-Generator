import winston from 'winston';
import { config } from '../config/config.js';

/**
 * Centralized logging utility using Winston
 * Provides structured logging with different levels and formats
 */

// Define custom log levels and colors
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

winston.addColors(colors);

// Create custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: config.isDevelopment ? developmentFormat : productionFormat
  })
];

// Add file transports in production
if (config.isProduction) {
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: productionFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: productionFormat
    })
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: config.logLevel,
  levels,
  format: config.isDevelopment ? developmentFormat : productionFormat,
  transports,
  exitOnError: false
});

/**
 * Enhanced logging methods with context
 */
export class Logger {
  constructor(context = '') {
    this.context = context;
  }

  formatMessage(message, meta = {}) {
    const contextStr = this.context ? `[${this.context}] ` : '';
    const messageStr = typeof message === 'object' ? JSON.stringify(message) : message;
    
    return {
      message: `${contextStr}${messageStr}`,
      ...meta
    };
  }

  error(message, meta = {}) {
    logger.error(this.formatMessage(message, meta));
  }

  warn(message, meta = {}) {
    logger.warn(this.formatMessage(message, meta));
  }

  info(message, meta = {}) {
    logger.info(this.formatMessage(message, meta));
  }

  http(message, meta = {}) {
    logger.http(this.formatMessage(message, meta));
  }

  debug(message, meta = {}) {
    logger.debug(this.formatMessage(message, meta));
  }

  // Agent-specific logging methods
  agentStart(agentName, input = {}) {
    this.info(`🤖 ${agentName} started`, { 
      agent: agentName, 
      input: typeof input === 'object' ? Object.keys(input) : input 
    });
  }

  agentComplete(agentName, output = {}) {
    this.info(`✅ ${agentName} completed`, { 
      agent: agentName, 
      output: typeof output === 'object' ? Object.keys(output) : output 
    });
  }

  agentError(agentName, error) {
    this.error(`❌ ${agentName} failed`, { 
      agent: agentName, 
      error: error.message, 
      stack: error.stack 
    });
  }

  // Performance logging
  performance(operation, duration, metadata = {}) {
    this.info(`⏱️ ${operation} completed in ${duration}ms`, {
      operation,
      duration,
      ...metadata
    });
  }

  // Request logging
  request(method, url, statusCode, duration, metadata = {}) {
    this.http(`${method} ${url} ${statusCode} - ${duration}ms`, {
      method,
      url,
      statusCode,
      duration,
      ...metadata
    });
  }
}

/**
 * Create a logger instance with context
 */
export function createLogger(context) {
  return new Logger(context);
}

/**
 * Stream for Morgan HTTP logging middleware
 */
export const stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

export default logger;
