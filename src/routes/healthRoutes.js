import { Router } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

const router = Router();

/**
 * Health check endpoints for monitoring and load balancers
 */

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv
  });
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv,
    dependencies: {}
  };

  try {
    // Check Azure OpenAI connection
    health.dependencies.azureOpenAI = await checkAzureOpenAI();
    
    // Check file system access
    health.dependencies.fileSystem = await checkFileSystem();
    
    // Check memory usage
    health.dependencies.memory = checkMemoryUsage();

    // Determine overall status
    const dependencyStatuses = Object.values(health.dependencies).map(dep => dep.status);
    const hasUnhealthy = dependencyStatuses.includes('unhealthy');
    const hasDegraded = dependencyStatuses.includes('degraded');
    
    if (hasUnhealthy) {
      health.status = 'unhealthy';
      res.status(503);
    } else if (hasDegraded) {
      health.status = 'degraded';
      res.status(200);
    }

    res.json(health);

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    
    health.status = 'unhealthy';
    health.error = error.message;
    
    res.status(503).json(health);
  }
});

// Readiness check for Kubernetes
router.get('/ready', async (req, res) => {
  try {
    // Check if all required services are ready
    const azureCheck = await checkAzureOpenAI();
    const fsCheck = await checkFileSystem();

    if (azureCheck.status === 'healthy' && fsCheck.status === 'healthy') {
      res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ 
        status: 'not ready', 
        timestamp: new Date().toISOString(),
        checks: { azure: azureCheck, fileSystem: fsCheck }
      });
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness check for Kubernetes
router.get('/live', (req, res) => {
  // Simple liveness check - if the server responds, it's alive
  res.json({ 
    status: 'alive', 
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
});

/**
 * Health check helper functions
 */

async function checkAzureOpenAI() {
  try {
    // Import here to avoid circular dependencies
    const { AzureOpenAIService } = await import('../services/azureOpenAIService.js');
    const openaiService = new AzureOpenAIService();
    
    // Simple test call to check connectivity
    await openaiService.testConnection();
    
    return {
      status: 'healthy',
      responseTime: Date.now(),
      message: 'Azure OpenAI connection successful'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'Azure OpenAI connection failed'
    };
  }
}

async function checkFileSystem() {
  try {
    const { access, constants } = await import('fs/promises');
    
    // Check if temp and output directories are accessible
    await access(config.tempDir, constants.F_OK | constants.W_OK);
    await access(config.audioOutputDir, constants.F_OK | constants.W_OK);
    
    return {
      status: 'healthy',
      message: 'File system access successful',
      directories: {
        temp: config.tempDir,
        output: config.audioOutputDir
      }
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      message: 'File system access failed'
    };
  }
}

function checkMemoryUsage() {
  const memUsage = process.memoryUsage();
  const totalMB = Math.round(memUsage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  // Define memory thresholds (adjust based on your requirements)
  const memoryThresholds = {
    warning: 512, // MB
    critical: 1024 // MB
  };
  
  let status = 'healthy';
  let message = 'Memory usage normal';
  
  if (totalMB > memoryThresholds.critical) {
    status = 'unhealthy';
    message = 'Memory usage critical';
  } else if (totalMB > memoryThresholds.warning) {
    status = 'degraded';
    message = 'Memory usage elevated';
  }
  
  return {
    status,
    message,
    usage: {
      rss: `${totalMB}MB`,
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`
    },
    thresholds: memoryThresholds
  };
}

export { router as healthRoutes };
export default router;
