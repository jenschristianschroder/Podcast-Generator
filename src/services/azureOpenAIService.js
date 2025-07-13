import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { DefaultAzureCredential } from '@azure/identity';
import OpenAI from 'openai';
import { config } from '../config/config.js';
import { createLogger } from '../utils/logger.js';
import { AzureError } from '../middleware/errorHandler.js';

const logger = createLogger('AzureOpenAIService');

/**
 * Azure OpenAI Service
 * Handles all interactions with Azure OpenAI API including chat completions and TTS
 */
export class AzureOpenAIService {
  constructor() {
    this.client = null;
    this.openaiClient = null; // For TTS
    this.isInitialized = false;
    this.initializeClient();
  }

  /**
   * Initialize Azure OpenAI client with proper authentication
   */
  initializeClient() {
    try {
      const credential = config.azure.openai.apiKey 
        ? new AzureKeyCredential(config.azure.openai.apiKey)
        : new DefaultAzureCredential();

      this.client = new OpenAIClient(
        config.azure.openai.endpoint,
        credential,
        {
          apiVersion: config.azure.openai.apiVersion
        }
      );

      // Initialize standard OpenAI client for TTS with Azure endpoint
      this.openaiClient = new OpenAI({
        apiKey: config.azure.openai.apiKey,
        baseURL: `${config.azure.openai.endpoint}/openai/deployments/${config.tts.model}`,
        defaultQuery: { 'api-version': config.azure.openai.apiVersion },
        defaultHeaders: {
          'api-key': config.azure.openai.apiKey,
        }
      });

      this.isInitialized = true;
      logger.info('Azure OpenAI client initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Azure OpenAI client', { error: error.message });
      throw new AzureError('Failed to initialize Azure OpenAI client', 'OpenAI', error);
    }
  }

  /**
   * Test connection to Azure OpenAI
   */
  async testConnection() {
    if (!this.isInitialized) {
      throw new AzureError('Azure OpenAI client not initialized', 'OpenAI');
    }

    try {
      // Simple test call to verify connectivity
      const response = await this.client.getChatCompletions(
        'gpt-4', // Use a basic model for testing
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 5 }
      );

      logger.debug('Azure OpenAI connection test successful');
      return response;

    } catch (error) {
      logger.error('Azure OpenAI connection test failed', { error: error.message });
      throw new AzureError('Azure OpenAI connection failed', 'OpenAI', error);
    }
  }

  /**
   * Generate chat completion with retry logic
   */
  async getChatCompletion(messages, options = {}) {
    if (!this.isInitialized) {
      throw new AzureError('Azure OpenAI client not initialized', 'OpenAI');
    }

    const defaultOptions = {
      model: 'gpt-4o',
      maxTokens: 4000,
      temperature: 0.7,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
      ...options
    };

    let lastError;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`Chat completion attempt ${attempt}`, {
          model: defaultOptions.model,
          messageCount: messages.length,
          maxTokens: defaultOptions.maxTokens
        });

        const startTime = Date.now();
        
        const response = await this.client.getChatCompletions(
          defaultOptions.model,
          messages,
          {
            maxTokens: defaultOptions.maxTokens,
            temperature: defaultOptions.temperature,
            presencePenalty: defaultOptions.presencePenalty,
            frequencyPenalty: defaultOptions.frequencyPenalty,
            stop: defaultOptions.stop,
            topP: defaultOptions.topP
          }
        );

        const duration = Date.now() - startTime;
        
        logger.debug('Chat completion successful', {
          model: defaultOptions.model,
          duration,
          tokens: response.usage?.totalTokens,
          attempt
        });

        // Extract and return the response content
        const choice = response.choices?.[0];
        if (!choice?.message?.content) {
          throw new Error('No content in response');
        }

        return {
          content: choice.message.content,
          usage: response.usage,
          model: response.model,
          finishReason: choice.finishReason
        };

      } catch (error) {
        lastError = error;
        
        logger.warn(`Chat completion attempt ${attempt} failed`, {
          error: error.message,
          attempt,
          willRetry: attempt < maxRetries
        });

        // Don't retry on certain errors
        if (error.status === 400 || error.status === 401 || error.status === 403) {
          break;
        }

        // Exponential backoff with jitter
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('All chat completion attempts failed', {
      attempts: maxRetries,
      error: lastError.message
    });

    throw new AzureError('Chat completion failed after retries', 'OpenAI', lastError);
  }

  /**
   * Generate speech from text using Azure OpenAI TTS
   */
  async generateSpeech(text, options = {}) {
    if (!this.isInitialized) {
      throw new AzureError('Azure OpenAI client not initialized', 'OpenAI');
    }

    const defaultOptions = {
      model: config.tts.model,
      voice: options.voice || config.tts.voices.host1, // Use passed voice or default
      speed: config.tts.speed,
      responseFormat: config.tts.format,
      ...options
    };

    try {
      logger.debug('Generating speech with gpt-4o-mini-tts', {
        textLength: text.length,
        voice: defaultOptions.voice,
        model: defaultOptions.model
      });

      const startTime = Date.now();

      // Use the standard OpenAI SDK for TTS with Azure endpoint
      const response = await this.openaiClient.audio.speech.create({
        model: defaultOptions.model,
        input: text,
        voice: defaultOptions.voice,
        speed: defaultOptions.speed,
        response_format: defaultOptions.responseFormat
      });

      const duration = Date.now() - startTime;

      logger.debug('Speech generation successful', {
        textLength: text.length,
        voice: defaultOptions.voice,
        duration
      });

      return response;

    } catch (error) {
      logger.error('Speech generation failed', {
        error: error.message,
        textLength: text.length,
        voice: defaultOptions.voice,
        stack: error.stack
      });

      throw new AzureError('Speech generation failed', 'OpenAI TTS', error);
    }
  }

  /**
   * Moderate content for safety
   */
  async moderateContent(text) {
    if (!this.isInitialized) {
      throw new AzureError('Azure OpenAI client not initialized', 'OpenAI');
    }

    try {
      logger.debug('Moderating content', { textLength: text.length });

      const response = await this.client.getModerations(text);
      
      const result = response.results?.[0];
      if (!result) {
        throw new Error('No moderation result received');
      }

      logger.debug('Content moderation completed', {
        flagged: result.flagged,
        categories: Object.keys(result.categories).filter(cat => result.categories[cat])
      });

      return {
        flagged: result.flagged,
        categories: result.categories,
        categoryScores: result.categoryScores
      };

    } catch (error) {
      logger.error('Content moderation failed', {
        error: error.message,
        textLength: text.length
      });

      throw new AzureError('Content moderation failed', 'OpenAI', error);
    }
  }

  /**
   * Estimate token count for text
   */
  estimateTokens(text) {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate model availability
   */
  async validateModel(modelName) {
    try {
      // Try a simple completion to validate model access
      await this.getChatCompletion(
        [{ role: 'user', content: 'Test' }],
        { model: modelName, maxTokens: 1 }
      );
      return true;
    } catch (error) {
      logger.warn(`Model validation failed for ${modelName}`, { error: error.message });
      return false;
    }
  }

  /**
   * Get client health status
   */
  getHealth() {
    return {
      initialized: this.isInitialized,
      endpoint: config.azure.openai.endpoint,
      hasApiKey: !!config.azure.openai.apiKey
    };
  }
}

export default AzureOpenAIService;
