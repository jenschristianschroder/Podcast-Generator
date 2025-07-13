import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { asyncHandler } from '../middleware/errorHandler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';
import { validateRequest } from '../middleware/validation.js';
import { PodcastController } from '../controllers/podcastController.js';
import { config } from '../config/config.js';

const router = Router();
const podcastController = new PodcastController();

/**
 * Validation rules for podcast generation
 */
const generateValidation = [
  body('topic')
    .isString()
    .isLength({ min: 1, max: config.constraints.maxTopicLength })
    .withMessage(`Topic must be between 1 and ${config.constraints.maxTopicLength} characters`),
  
  body('focus')
    .optional()
    .isString()
    .isLength({ max: config.constraints.maxFocusLength })
    .withMessage(`Focus must be less than ${config.constraints.maxFocusLength} characters`),
  
  body('mood')
    .optional()
    .isIn(config.availableMoods)
    .withMessage(`Mood must be one of: ${config.availableMoods.join(', ')}`),
  
  body('style')
    .optional()
    .isIn(config.availableStyles)
    .withMessage(`Style must be one of: ${config.availableStyles.join(', ')}`),
  
  body('chapters')
    .optional()
    .isInt({ min: config.constraints.minChapters, max: config.constraints.maxChapters })
    .withMessage(`Chapters must be between ${config.constraints.minChapters} and ${config.constraints.maxChapters}`),
  
  body('durationMin')
    .optional()
    .isInt({ min: config.constraints.minDurationMin, max: config.constraints.maxDurationMin })
    .withMessage(`Duration must be between ${config.constraints.minDurationMin} and ${config.constraints.maxDurationMin} minutes`),
  
  body('source')
    .optional()
    .isString()
    .withMessage('Source must be a string (URL or file path)')
];

const statusValidation = [
  param('id')
    .isUUID()
    .withMessage('ID must be a valid UUID')
];

const audioValidation = [
  param('filename')
    .matches(/^[a-f0-9-]+\.mp3$/)
    .withMessage('Filename must be a valid UUID with .mp3 extension')
];

/**
 * Routes
 */

// Generate podcast episode
router.post('/generate', 
  strictRateLimiter,
  generateValidation,
  validateRequest,
  asyncHandler(podcastController.generatePodcast.bind(podcastController))
);

// Get generation status
router.get('/status/:id',
  statusValidation,
  validateRequest,
  asyncHandler(podcastController.getStatus.bind(podcastController))
);

// Download audio file
router.get('/audio/:filename',
  audioValidation,
  validateRequest,
  asyncHandler(podcastController.downloadAudio.bind(podcastController))
);

// List recent generations (for debugging/monitoring)
router.get('/generations',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a non-negative integer'),
  validateRequest,
  asyncHandler(podcastController.listGenerations.bind(podcastController))
);

// Get generation artifacts (research, script, etc.)
router.get('/artifacts/:id',
  statusValidation,
  validateRequest,
  asyncHandler(podcastController.getArtifacts.bind(podcastController))
);

// Cancel ongoing generation
router.delete('/generation/:id',
  statusValidation,
  validateRequest,
  asyncHandler(podcastController.cancelGeneration.bind(podcastController))
);

// Get supported configuration options
router.get('/config', (req, res) => {
  res.json({
    moods: config.availableMoods,
    styles: config.availableStyles,
    tones: config.availableTones,
    constraints: {
      chapters: {
        min: config.constraints.minChapters,
        max: config.constraints.maxChapters
      },
      duration: {
        min: config.constraints.minDurationMin,
        max: config.constraints.maxDurationMin
      },
      topic: {
        maxLength: config.constraints.maxTopicLength
      },
      focus: {
        maxLength: config.constraints.maxFocusLength
      }
    },
    defaults: config.defaults,
    performance: {
      wordsPerMinute: config.performance.wordsPerMinute,
      tolerancePercent: config.performance.tolerancePercent
    }
  });
});

// Validate brief without generating
router.post('/validate',
  generateValidation,
  validateRequest,
  asyncHandler(podcastController.validateBrief.bind(podcastController))
);

export { router as podcastRoutes };
export default router;
