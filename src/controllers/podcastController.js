import { v4 as uuidv4 } from 'uuid';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile, access } from 'fs/promises';
import { createLogger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { PodcastOrchestrator } from '../services/podcastOrchestrator.js';
import { OperationLogger } from '../middleware/requestLogger.js';

const logger = createLogger('PodcastController');

/**
 * Controller for podcast generation endpoints
 * Handles HTTP requests and orchestrates the multi-agent pipeline
 */
export class PodcastController {
  constructor() {
    this.orchestrator = new PodcastOrchestrator();
    this.activeGenerations = new Map(); // Track ongoing generations
  }

  /**
   * Generate a new podcast episode
   */
  async generatePodcast(req, res) {
    const operationId = uuidv4();
    const operationLogger = new OperationLogger('generate-podcast', req.correlationId);
    
    try {
      // Extract and validate request parameters
      const {
        topic,
        focus,
        mood = config.defaults.mood,
        style = config.defaults.style,
        chapters = config.defaults.chapters,
        durationMin = config.defaults.durationMin,
        source
      } = req.body;

      operationLogger.step('request-validated', {
        topic: topic.substring(0, 50) + '...',
        chapters,
        durationMin,
        mood,
        style
      });

      // Create generation request
      const generationRequest = {
        id: operationId,
        topic,
        focus,
        mood,
        style,
        chapters,
        durationMin,
        source,
        status: 'queued',
        createdAt: new Date().toISOString(),
        correlationId: req.correlationId
      };

      // Store generation in active map
      this.activeGenerations.set(operationId, {
        ...generationRequest,
        startTime: Date.now()
      });

      operationLogger.step('generation-queued', { id: operationId });

      // Start generation asynchronously
      this.processGeneration(generationRequest, operationLogger)
        .catch(error => {
          logger.error('Generation failed', {
            id: operationId,
            error: error.message,
            correlationId: req.correlationId
          });
          
          // Update status to failed
          if (this.activeGenerations.has(operationId)) {
            const generation = this.activeGenerations.get(operationId);
            generation.status = 'failed';
            generation.error = error.message;
            generation.completedAt = new Date().toISOString();
          }
        });

      // Return immediate response with generation ID
      res.status(202).json({
        id: operationId,
        status: 'queued',
        message: 'Podcast generation started',
        estimatedDuration: `${durationMin * 12}s`, // Rough estimate: 12s per minute
        statusUrl: `/api/status/${operationId}`,
        correlationId: req.correlationId
      });

      operationLogger.complete({ id: operationId, status: 'queued' });

    } catch (error) {
      operationLogger.error(error, 'generate-podcast');
      throw error;
    }
  }

  /**
   * Get the status of a generation
   */
  async getStatus(req, res) {
    const { id } = req.params;
    
    try {
      const generation = this.activeGenerations.get(id);
      
      if (!generation) {
        return res.status(404).json({
          error: 'Generation not found',
          message: `No generation found with ID: ${id}`
        });
      }

      // Calculate progress and estimated completion
      const elapsed = Date.now() - generation.startTime;
      const response = {
        id,
        status: generation.status,
        createdAt: generation.createdAt,
        elapsed: `${Math.round(elapsed / 1000)}s`
      };

      // Add completion details if finished
      if (generation.status === 'completed') {
        response.completedAt = generation.completedAt;
        response.audioUrl = `/api/audio/${id}.mp3`;
        response.artifactsUrl = `/api/artifacts/${id}`;
        response.metadata = generation.metadata;
      }

      // Add error details if failed
      if (generation.status === 'failed') {
        response.error = generation.error;
        response.failedAt = generation.completedAt;
      }

      // Add progress information if in progress
      if (generation.status === 'processing') {
        response.currentStep = generation.currentStep;
        response.stepsCompleted = generation.stepsCompleted || 0;
        response.totalSteps = generation.totalSteps || 7;
        response.estimatedCompletion = generation.estimatedCompletion;
      }

      res.json(response);

    } catch (error) {
      logger.error('Failed to get generation status', {
        id,
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * Download generated audio file
   */
  async downloadAudio(req, res) {
    const { filename } = req.params;
    const id = filename.replace('.mp3', '');
    
    try {
      const audioPath = join(config.audioOutputDir, filename);
      
      // Check if file exists
      if (!existsSync(audioPath)) {
        return res.status(404).json({
          error: 'Audio file not found',
          message: `Audio file for generation ${id} not found`
        });
      }

      // Check if generation exists and is completed
      const generation = this.activeGenerations.get(id);
      if (!generation || generation.status !== 'completed') {
        return res.status(404).json({
          error: 'Generation not completed',
          message: 'Audio file is not ready or generation failed'
        });
      }

      // Set appropriate headers for audio file
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

      // Stream the file
      const { createReadStream } = await import('fs');
      const stream = createReadStream(audioPath);
      stream.pipe(res);

      logger.info('Audio file downloaded', {
        id,
        filename,
        correlationId: req.correlationId
      });

    } catch (error) {
      logger.error('Failed to download audio', {
        filename,
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * Get generation artifacts (research, script, etc.)
   */
  async getArtifacts(req, res) {
    const { id } = req.params;
    
    try {
      const generation = this.activeGenerations.get(id);
      
      if (!generation) {
        return res.status(404).json({
          error: 'Generation not found',
          message: `No generation found with ID: ${id}`
        });
      }

      if (generation.status !== 'completed') {
        return res.status(400).json({
          error: 'Generation not completed',
          message: 'Artifacts are only available for completed generations'
        });
      }

      res.json({
        id,
        artifacts: generation.artifacts || {},
        metadata: generation.metadata || {},
        generatedAt: generation.completedAt
      });

    } catch (error) {
      logger.error('Failed to get artifacts', {
        id,
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * List recent generations
   */
  async listGenerations(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const generations = Array.from(this.activeGenerations.entries())
        .map(([id, generation]) => ({
          id,
          topic: generation.topic.substring(0, 100),
          status: generation.status,
          createdAt: generation.createdAt,
          completedAt: generation.completedAt,
          durationMin: generation.durationMin,
          chapters: generation.chapters
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(offset, offset + limit);

      res.json({
        generations,
        total: this.activeGenerations.size,
        limit,
        offset
      });

    } catch (error) {
      logger.error('Failed to list generations', {
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * Cancel an ongoing generation
   */
  async cancelGeneration(req, res) {
    const { id } = req.params;
    
    try {
      const generation = this.activeGenerations.get(id);
      
      if (!generation) {
        return res.status(404).json({
          error: 'Generation not found',
          message: `No generation found with ID: ${id}`
        });
      }

      if (generation.status === 'completed' || generation.status === 'failed') {
        return res.status(400).json({
          error: 'Cannot cancel completed generation',
          message: 'Generation is already completed or failed'
        });
      }

      // Update status to cancelled
      generation.status = 'cancelled';
      generation.completedAt = new Date().toISOString();

      logger.info('Generation cancelled', {
        id,
        correlationId: req.correlationId
      });

      res.json({
        id,
        status: 'cancelled',
        message: 'Generation cancelled successfully'
      });

    } catch (error) {
      logger.error('Failed to cancel generation', {
        id,
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * Validate a brief without generating
   */
  async validateBrief(req, res) {
    try {
      const {
        topic,
        focus,
        durationMin = config.defaults.durationMin,
        chapters = config.defaults.chapters
      } = req.body;

      // Calculate estimated word count
      const targetWords = Math.round(durationMin * config.performance.wordsPerMinute);
      const wordsPerChapter = Math.round(targetWords / chapters);

      // Validate topic complexity and feasibility
      const validation = {
        valid: true,
        warnings: [],
        recommendations: [],
        estimates: {
          targetWords,
          wordsPerChapter,
          estimatedDuration: `${Math.round(targetWords / config.performance.wordsPerMinute)}min`,
          processingTime: `${Math.round(durationMin * 12)}s`
        }
      };

      // Topic length validation
      if (topic.length < 10) {
        validation.warnings.push('Topic is very short. Consider adding more detail for better results.');
      }

      if (topic.length > 200) {
        validation.recommendations.push('Topic is quite long. Consider focusing on key aspects.');
      }

      // Duration recommendations
      if (durationMin < 2) {
        validation.warnings.push('Very short duration may limit content depth.');
      }

      if (durationMin > 60) {
        validation.recommendations.push('Long podcasts may benefit from more chapters for better structure.');
      }

      // Chapter recommendations
      if (chapters > durationMin * 2) {
        validation.warnings.push('Many chapters for short duration may result in superficial coverage.');
      }

      res.json(validation);

    } catch (error) {
      logger.error('Failed to validate brief', {
        error: error.message,
        correlationId: req.correlationId
      });
      throw error;
    }
  }

  /**
   * Process generation asynchronously
   */
  async processGeneration(generationRequest, operationLogger) {
    const { id } = generationRequest;
    
    try {
      // Update status to processing
      const generation = this.activeGenerations.get(id);
      generation.status = 'processing';
      generation.currentStep = 'initializing';
      generation.totalSteps = 7;
      generation.stepsCompleted = 0;

      operationLogger.step('processing-started');

      // Start the orchestration process
      const result = await this.orchestrator.generatePodcast(
        generationRequest,
        (step, progress) => {
          // Update progress
          generation.currentStep = step;
          generation.stepsCompleted = progress.completed;
          generation.estimatedCompletion = progress.estimatedCompletion;
          
          operationLogger.step(step, { progress: progress.completed });
        }
      );

      // Update final status
      generation.status = 'completed';
      generation.completedAt = new Date().toISOString();
      generation.artifacts = result.artifacts;
      generation.metadata = result.metadata;

      operationLogger.complete(result);

      logger.info('Podcast generation completed successfully', {
        id,
        duration: result.metadata.duration,
        wordCount: result.metadata.wordCount
      });

    } catch (error) {
      operationLogger.error(error, 'process-generation');
      throw error;
    }
  }
}

export default PodcastController;
