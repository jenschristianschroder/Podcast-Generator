import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config/config.js';
import { logger } from './utils/logger.js';
import { rateLimiter } from './middleware/rateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { podcastRoutes } from './routes/podcastRoutes.js';
import { healthRoutes } from './routes/healthRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Server {
  constructor() {
    this.app = express();
    this.port = config.port;
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression and parsing
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Rate limiting
    this.app.use(rateLimiter);

    // Request logging
    this.app.use(requestLogger);

    // Static file serving for audio files
    this.app.use('/api/audio', express.static(join(__dirname, '../output')));
  }

  setupRoutes() {
    // Health check routes
    this.app.use('/api/health', healthRoutes);
    
    // Main podcast generation routes
    this.app.use('/api', podcastRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Multi-Agent Podcast Generator',
        version: '1.0.0',
        status: 'healthy',
        endpoints: {
          generate: 'POST /api/generate',
          status: 'GET /api/status/:id',
          audio: 'GET /api/audio/:id.mp3',
          health: 'GET /api/health'
        }
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  setupErrorHandling() {
    this.app.use(errorHandler);
  }

  async start() {
    try {
      // Validate environment configuration
      await this.validateEnvironment();

      // Create necessary directories
      await this.createDirectories();

      // Start server
      this.server = this.app.listen(this.port, () => {
        logger.info(`🚀 Multi-Agent Podcast Generator started on port ${this.port}`);
        logger.info(`📝 Environment: ${config.nodeEnv}`);
        logger.info(`🎵 Audio output directory: ${config.audioOutputDir}`);
        logger.info(`📊 Log level: ${config.logLevel}`);
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async validateEnvironment() {
    const requiredEnvVars = [
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    logger.info('✅ Environment validation passed');
  }

  async createDirectories() {
    const { mkdirSync } = await import('fs');
    const dirs = [config.tempDir, config.audioOutputDir];
    
    dirs.forEach(dir => {
      try {
        mkdirSync(dir, { recursive: true });
        logger.debug(`📁 Created directory: ${dir}`);
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
      }
    });
  }

  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Received ${signal}. Graceful shutdown initiated.`);
      
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed.');
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          logger.error('Could not close connections in time, forcefully shutting down');
          process.exit(1);
        }, 10000);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new Server();
  server.start().catch(error => {
    logger.error('Failed to start application:', error);
    process.exit(1);
  });
}

export { Server };
