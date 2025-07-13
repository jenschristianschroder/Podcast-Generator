import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

/**
 * Application configuration
 * Centralizes all environment variables and application settings
 */
export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // Azure Configuration
  azure: {
    aiProject: {
      endpoint: process.env.AZURE_AI_PROJECT_ENDPOINT,
      subscriptionId: process.env.AZURE_SUBSCRIPTION_ID,
      resourceGroupName: process.env.AZURE_RESOURCE_GROUP_NAME,
      projectName: process.env.AZURE_AI_PROJECT_NAME
    },
    openai: {
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-05-01-preview'
    },
    search: {
      endpoint: process.env.AZURE_SEARCH_ENDPOINT,
      apiKey: process.env.AZURE_SEARCH_API_KEY,
      indexName: process.env.AZURE_SEARCH_INDEX || 'podcast-research'
    }
  },

  // Agent Configuration
  agents: {
    plannerAgentId: process.env.PLANNER_AGENT_ID,
    researchAgentId: process.env.RESEARCH_AGENT_ID,
    outlineAgentId: process.env.OUTLINE_AGENT_ID,
    scriptAgentId: process.env.SCRIPT_AGENT_ID,
    toneAgentId: process.env.TONE_AGENT_ID,
    editorAgentId: process.env.EDITOR_AGENT_ID,
    // Fallback mode configuration
    useFoundryAgents: process.env.USE_FOUNDRY_AGENTS !== 'false', // Default to true
    foundryTimeoutMs: parseInt(process.env.FOUNDRY_TIMEOUT_MS) || 60000
  },

  // TTS Configuration
  tts: {
    model: process.env.TTS_MODEL || 'tts-1',
    voices: {
      host1: process.env.TTS_VOICE_HOST1 || 'alloy',
      host2: process.env.TTS_VOICE_HOST2 || 'echo'
    },
    speed: parseFloat(process.env.TTS_SPEED) || 1.0, // Normal speech rate
    format: process.env.TTS_FORMAT || 'mp3'
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },

  // File Storage
  tempDir: process.env.TEMP_DIR || join(__dirname, '../../temp'),
  audioOutputDir: process.env.AUDIO_OUTPUT_DIR || join(__dirname, '../../output'),

  // Performance Configuration
  performance: {
    maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS) || 5,
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS) || 60000,
    wordsPerMinute: 150, // Standard speaking rate
    tolerancePercent: 5 // ±5% word count tolerance
  },

  // Podcast Generation Defaults
  defaults: {
    chapters: 3,
    durationMin: 5,
    mood: 'neutral',
    style: 'storytelling',
    speakers: ['Host 1', 'Host 2']
  },

  // Validation Constraints
  constraints: {
    minChapters: 1,
    maxChapters: 10,
    minDurationMin: 1,
    maxDurationMin: 120,
    maxTopicLength: 500,
    maxFocusLength: 1000
  },

  // Available tones for TTS
  availableTones: [
    'upbeat', 'calm', 'excited', 'reflective', 'suspenseful',
    'skeptical', 'humorous', 'angry', 'sad', 'hopeful'
  ],

  // Available moods
  availableMoods: [
    'neutral', 'excited', 'calm', 'reflective', 'enthusiastic'
  ],

  // Available styles
  availableStyles: [
    'storytelling', 'conversational', 'interview', 'educational', 'narrative'
  ],

  // CORS Configuration
  allowedOrigins: process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:3001'],

  // Development flags
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test'
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const requiredFields = [
    'azure.openai.endpoint',
    'azure.openai.apiKey'
  ];

  const missingFields = [];

  requiredFields.forEach(field => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], config);
    if (!value) {
      missingFields.push(field);
    }
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required configuration: ${missingFields.join(', ')}`);
  }

  return true;
}

export default config;
