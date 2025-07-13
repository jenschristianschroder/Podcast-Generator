import { createLogger } from '../utils/logger.js';
import { AzureOpenAIService } from '../services/azureOpenAIService.js';
import { AzureAIFoundryClient } from '../services/azureAIFoundryClient.js';
import { AgentError } from '../middleware/errorHandler.js';
import { config } from '../config/config.js';

const logger = createLogger('BaseAgent');

/**
 * Base class for all AI agents
 * Provides common functionality for Azure AI Foundry and Azure OpenAI interactions
 */
export class BaseAgent {
  constructor(name, systemPrompt, options = {}) {
    this.name = name;
    this.systemPrompt = systemPrompt;
    this.logger = createLogger(`Agent:${name}`);
    
    // Initialize both services
    this.openaiService = new AzureOpenAIService();
    this.foundryClient = new AzureAIFoundryClient();
    
    // Get the Azure AI Foundry agent ID for this agent
    this.agentId = this.getAgentId();
    
    // Default options
    this.options = {
      maxTokens: 4000,
      temperature: 0.7,
      retryAttempts: 3,
      timeout: 30000,
      useFoundryAgent: true, // Prefer Foundry agents when available
      ...options
    };
  }

  /**
   * Get the Azure AI Foundry agent ID for this agent
   */
  getAgentId() {
    const agentIdMap = {
      'PlannerAgent': config.agents.plannerAgentId,
      'ResearchAgent': config.agents.researchAgentId,
      'OutlineAgent': config.agents.outlineAgentId,
      'ScriptAgent': config.agents.scriptAgentId,
      'ToneAgent': config.agents.toneAgentId,
      'EditorAgent': config.agents.editorAgentId
    };

    const agentId = agentIdMap[this.name];
    
    if (!agentId) {
      this.logger.warn('No Azure AI Foundry agent ID configured, will use OpenAI fallback', {
        agent: this.name
      });
    }

    return agentId;
  }

  /**
   * Execute the agent with input data
   * Must be implemented by subclasses
   */
  async execute(input) {
    throw new Error(`Execute method must be implemented by ${this.name} agent`);
  }

  /**
   * Make a chat completion request using Azure AI Foundry or fallback to OpenAI
   */
  async chatComplete(userMessage, options = {}) {
    const completionOptions = {
      ...this.options,
      ...options
    };

    try {
      this.logger.debug('Making chat completion request', {
        userMessageLength: userMessage.length,
        useFoundryAgent: completionOptions.useFoundryAgent && !!this.agentId,
        agentId: this.agentId
      });

      // Try to use Azure AI Foundry agent first
      if (completionOptions.useFoundryAgent && this.agentId) {
        return await this.chatCompleteWithFoundry(userMessage, completionOptions);
      } else {
        // Fallback to direct OpenAI
        return await this.chatCompleteWithOpenAI(userMessage, completionOptions);
      }

    } catch (error) {
      this.logger.error('Chat completion failed', {
        error: error.message,
        userMessageLength: userMessage.length,
        agentId: this.agentId
      });

      throw new AgentError(
        `${this.name} execution failed: ${error.message}`,
        this.name,
        error
      );
    }
  }

  /**
   * Chat completion using Azure AI Foundry agent
   */
  async chatCompleteWithFoundry(userMessage, options = {}) {
    try {
      // Check if Azure AI Foundry is available
      if (!this.foundryClient.isAvailable()) {
        logger.warn('Azure AI Foundry not available, falling back to OpenAI', {
          agentId: this.agentId
        });
        return await this.chatCompleteWithOpenAI(userMessage, options);
      }

      this.logger.debug('Using Azure AI Foundry agent', {
        agentId: this.agentId
      });

      // Create a thread for this conversation
      const thread = await this.foundryClient.createThread({
        agent: this.name,
        timestamp: new Date().toISOString()
      });
      
      // Create and process the run with the Foundry agent
      const run = await this.foundryClient.createAndProcessRun(
        thread.id,
        this.agentId,
        userMessage,
        {
          instructions: options.instructions,
          additionalInstructions: options.additionalInstructions,
          timeoutMs: options.timeout || 60000,
          metadata: {
            agent: this.name,
            userMessageLength: userMessage.length
          }
        }
      );

      if (run.status === 'failed') {
        const errorMessage = run.lastError || 'Azure AI Foundry agent run failed';
        this.logger.warn('Azure AI Foundry run failed, falling back to OpenAI', {
          error: errorMessage,
          agentId: this.agentId,
          runId: run.id
        });
        
        // Fallback to OpenAI
        return await this.chatCompleteWithOpenAI(userMessage, options);
      }

      // Extract the response content
      const result = {
        content: run.response.content,
        usage: {
          totalTokens: run.usage?.totalTokens || this.estimateTokens(userMessage + run.response.content),
          promptTokens: run.usage?.promptTokens || this.estimateTokens(userMessage),
          completionTokens: run.usage?.completionTokens || this.estimateTokens(run.response.content)
        },
        threadId: thread.id,
        runId: run.id,
        agentId: this.agentId,
        model: run.model || 'azure-ai-foundry-agent'
      };

      this.logger.info('Azure AI Foundry agent response received', {
        agentId: this.agentId,
        responseLength: result.content.length,
        threadId: thread.id,
        runId: run.id,
        totalTokens: result.usage.totalTokens,
        responsePreview: result.content.substring(0, 300) + '...' // Show first 300 chars
      });

      return result;

    } catch (error) {
      this.logger.warn('Azure AI Foundry failed, falling back to OpenAI', {
        error: error.message,
        agentId: this.agentId,
        statusCode: error.statusCode
      });

      // Fallback to OpenAI
      return await this.chatCompleteWithOpenAI(userMessage, options);
    }
  }

  /**
   * Chat completion using direct Azure OpenAI
   */
  async chatCompleteWithOpenAI(userMessage, options = {}) {
    const messages = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: userMessage }
    ];

    this.logger.debug('Using Azure OpenAI fallback', {
      systemPromptLength: this.systemPrompt.length
    });

    const result = await this.openaiService.getChatCompletion(messages, options);
    
    this.logger.debug('Azure OpenAI completion successful', {
      responseLength: result.content.length,
      tokens: result.usage?.totalTokens
    });

    return result;
  }

  /**
   * Validate input data
   * Can be overridden by subclasses for specific validation
   */
  validateInput(input) {
    if (!input || typeof input !== 'object') {
      throw new AgentError(`Invalid input for ${this.name} agent`, this.name);
    }
    return true;
  }

  /**
   * Extract and validate markdown content
   */
  extractMarkdown(response) {
    const content = response.content || response;
    
    if (typeof content !== 'string') {
      throw new AgentError(`Invalid response format from ${this.name} agent`, this.name);
    }

    return {
      content: content.trim(),
      metadata: this.extractMetadata(content),
      wordCount: this.countSpokenWords(content) // Use spoken word counter for podcast scripts
    };
  }

  /**
   * Extract metadata from markdown content
   */
  extractMetadata(content) {
    const metadata = {};
    
    // Extract headings
    const headings = content.match(/^#+\s+(.+)$/gm);
    if (headings) {
      metadata.headings = headings.map(h => h.replace(/^#+\s+/, ''));
    }

    // Extract lists
    const lists = content.match(/^[-*+]\s+(.+)$/gm);
    if (lists) {
      metadata.listItems = lists.length;
    }

    // Extract links
    const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g);
    if (links) {
      metadata.links = links.length;
    }

    return metadata;
  }

  /**
   * Count words in text
   */
  countWords(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Remove markdown formatting and count words
    const cleanText = text
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/`([^`]+)`/g, '$1') // Remove code formatting
      .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
      .trim();

    const words = cleanText.split(/\s+/).filter(word => word.length > 0);
    return words.length;
  }

  /**
   * Count only spoken words in podcast scripts
   * Ignores host labels, tone instructions, metadata, and formatting
   */
  countSpokenWords(content) {
    if (!content || typeof content !== 'string') {
      return 0;
    }

    // Remove markdown formatting and metadata sections
    let cleanContent = content
      // Remove markdown headers
      .replace(/#{1,6}\s+.*$/gm, '')
      // Remove metadata sections (## Script Metadata, ## Tone Analysis, etc.)
      .replace(/^##.*$/gm, '')
      .replace(/^###.*$/gm, '')
      // Remove bullet points and lists
      .replace(/^[-*+]\s+.*$/gm, '')
      // Remove technical notes and instructions
      .replace(/\[Continue.*?\]/gi, '')
      .replace(/\[.*?\]/g, '') // Remove all bracketed content
      // Remove speaking notes sections
      .replace(/Speaking Notes.*?(?=\n##|\n\*\*Host|\Z)/s, '')
      .replace(/Script Metadata.*?(?=\n##|\n\*\*Host|\Z)/s, '')
      .replace(/Tone Analysis.*?(?=\n##|\n\*\*Host|\Z)/s, '')
      .replace(/Expression Notes.*?(?=\n##|\n\*\*Host|\Z)/s, '')
      .replace(/Technical TTS Guidance.*?(?=\n##|\n\*\*Host|\Z)/s, '')
      .replace(/CONSTRAINTS:.*?(?=\n##|\n\*\*Host|\Z)/s, '');

    // Extract only the actual dialogue after host labels
    const dialogueLines = cleanContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.includes('**Host'))
      .map(line => {
        // Extract text after "**Host X:** [optional tone]"
        const match = line.match(/\*\*Host\s+\d+:\*\*\s*(?:\[.*?\])?\s*(.+)/i);
        return match ? match[1].trim() : '';
      })
      .filter(text => text.length > 0);

    // Count words in the actual spoken dialogue
    const totalSpokenText = dialogueLines.join(' ');
    const words = totalSpokenText
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .split(' ')
      .filter(word => word.length > 0);

    this.logger.debug('Spoken word count analysis', {
      totalLines: content.split('\n').length,
      dialogueLines: dialogueLines.length,
      spokenWords: words.length,
      sampleDialogue: dialogueLines.slice(0, 2)
    });

    return words.length;
  }

  /**
   * Format user input for the agent
   */
  formatInput(input) {
    const sections = [];

    // Add each input field as a section
    for (const [key, value] of Object.entries(input)) {
      if (value && typeof value === 'string') {
        sections.push(`## ${this.capitalizeFirst(key)}\n${value}`);
      } else if (value && typeof value === 'object') {
        sections.push(`## ${this.capitalizeFirst(key)}\n${JSON.stringify(value, null, 2)}`);
      } else if (value !== undefined && value !== null) {
        sections.push(`## ${this.capitalizeFirst(key)}\n${value}`);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Capitalize first letter
   */
  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Add timing constraints to prompts
   */
  addTimingConstraints(prompt, targetWords, tolerance = 5) {
    const constraintText = `\n\nIMPORTANT CONSTRAINTS:
- Target word count: ${targetWords} words (±${tolerance}%)
- Word count range: ${Math.round(targetWords * (1 - tolerance/100))} - ${Math.round(targetWords * (1 + tolerance/100))} words
- Speaking rate: 150 words per minute
- Estimated speaking time: ${Math.round(targetWords / 150)} minutes

Please ensure your response meets these word count requirements precisely.`;

    return prompt + constraintText;
  }

  /**
   * Validate word count against target
   */
  validateWordCount(content, targetWords, tolerance = 5) {
    const actualWords = this.countWords(content);
    const minWords = Math.round(targetWords * (1 - tolerance/100));
    const maxWords = Math.round(targetWords * (1 + tolerance/100));
    
    const isValid = actualWords >= minWords && actualWords <= maxWords;
    const deviation = Math.abs((actualWords - targetWords) / targetWords * 100);

    return {
      valid: isValid,
      actualWords,
      targetWords,
      minWords,
      maxWords,
      deviation: Math.round(deviation * 100) / 100
    };
  }

  /**
   * Get agent health status
   */
  getHealth() {
    const foundryHealth = this.foundryClient ? this.foundryClient.getHealth() : { status: 'not_configured' };
    const openaiHealth = this.openaiService ? this.openaiService.getHealth() : { status: 'not_configured' };

    return {
      name: this.name,
      status: 'healthy',
      agentId: this.agentId,
      foundryHealth,
      openaiHealth,
      hasFoundryAgent: !!this.agentId,
      preferredMode: this.agentId ? 'azure_ai_foundry' : 'azure_openai_fallback'
    };
  }

  /**
   * Get execution statistics
   */
  getStats() {
    return {
      name: this.name,
      executionCount: this.executionCount || 0,
      lastExecution: this.lastExecution || null,
      averageResponseTime: this.averageResponseTime || 0
    };
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokens(text) {
    if (!text || typeof text !== 'string') return 0;
    
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }
}

export default BaseAgent;
