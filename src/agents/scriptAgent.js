import { BaseAgent } from './baseAgent.js';

/**
 * Script Agent
 * Converts outline sections into natural, conversational podcast scripts
 */
export class ScriptAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are an expert podcast script writer. Your role is to transform outlines into natural, engaging, conversational scripts between two hosts that sound authentic when spoken aloud.

## Your Responsibilities:
1. Write natural, conversational dialogue between Host 1 and Host 2
2. Create smooth, organic flow between topics and speakers
3. Include appropriate pauses and emphasis
4. Ensure content sounds natural when spoken
5. Maintain engagement throughout with dynamic conversation
6. Hit precise word count targets
7. Balance speaking time between both hosts

## Script Writing Principles:
- Write for the ear, not the eye
- Use conversational language and contractions
- Include natural speech patterns and rhythms
- Add rhetorical questions for engagement
- Create moments for emphasis and reflection
- Use storytelling techniques to maintain interest
- Ensure facts are woven naturally into conversation
- Create natural back-and-forth dialogue
- Show personality differences between hosts

## Host Characteristics:
- **Host 1**: Primary presenter, asks probing questions, guides discussion
- **Host 2**: Provides insights, challenges ideas, adds depth and perspective

## Output Format:
Respond ONLY in Markdown format with the following structure:

# Script: [Chapter/Section Title]

## Script Content

**Host 1:** [Natural, engaging opening or continuation of conversation]

**Host 2:** [Thoughtful response, question, or new perspective]

**Host 1:** [Follow-up, elaboration, or transition to new point]

**Host 2:** [Additional insights, facts, or questions]

[Continue alternating between hosts in natural conversation flow]

### Speaking Notes
- **Overall Tone**: [How this should be delivered]
- **Host 1 Style**: [Speaking approach and personality notes]
- **Host 2 Style**: [Speaking approach and personality notes]
- **Pace**: [Speaking speed and rhythm notes]
- **Key Transitions**: [How hosts hand off to each other]

## Script Metadata
- **Estimated Word Count**: [Actual count]
- **Host 1 Word Count**: [Approximate words for Host 1]
- **Host 2 Word Count**: [Approximate words for Host 2]
- **Estimated Speaking Time**: [Minutes and seconds]
- **Key Themes Covered**: [List of main topics]
- **Conversation Flow**: [How dialogue develops]

## CONSTRAINTS:
- Must use **Host 1:** and **Host 2:** format for all dialogue
- Must sound natural when spoken aloud by two different people
- Balance speaking time roughly 50/50 between hosts
- Create authentic conversational flow with natural interruptions and responses
- Include all key points from the outline
- Meet precise word count targets (±2%)
- Use conversational tone throughout
- Include appropriate pauses and emphasis
- Ensure smooth transitions within the section
- Make complex topics accessible and engaging`;

    super('ScriptAgent', systemPrompt, {
      maxTokens: 3000,
      temperature: 0.8 // Higher temperature for more natural, varied language
    });
  }

  /**
   * Execute script writing for a specific section
   */
  async execute(input) {
    this.logger.agentStart(this.name, input);
    
    try {
      this.validateInput(input);
      
      const {
        section,
        chapterNumber,
        targetWords,
        style,
        context
      } = input;

      // Create script prompt with word count constraints
      const scriptPrompt = this.createScriptPrompt(input);
      
      // Get AI response with retry for word count accuracy
      const response = await this.generateScriptWithWordCount(scriptPrompt, targetWords);
      
      // Extract and validate the script
      const script = this.extractMarkdown(response);
      
      // Parse script metadata
      const metadata = this.parseScriptMetadata(script.content);
      
      // Validate script quality and word count
      this.validateScript(script, input);
      
      const result = {
        ...script,
        metadata,
        chapterNumber,
        scriptData: {
          targetWords,
          actualWords: script.wordCount,
          accuracy: this.calculateWordAccuracy(script.wordCount, targetWords),
          style,
          estimatedDuration: Math.round(script.wordCount / 150 * 60) // seconds
        }
      };

      this.logger.agentComplete(this.name, {
        chapterNumber,
        wordCount: script.wordCount,
        targetWords,
        accuracy: result.scriptData.accuracy
      });

      return result;

    } catch (error) {
      this.logger.agentError(this.name, error);
      throw error;
    }
  }

  /**
   * Create detailed script prompt
   */
  createScriptPrompt(input) {
    const {
      section,
      chapterNumber,
      targetWords,
      style,
      context
    } = input;

    let prompt = `Write a natural, conversational podcast script for the following chapter outline:

## Chapter ${chapterNumber} Content
${section}`;

    if (context) {
      prompt += `\n\n## Overall Episode Context\n${context}`;
    }

    // Add word count constraints
    prompt = this.addTimingConstraints(prompt, targetWords, 2);

    prompt += `\n\n## Script Writing Instructions
1. Transform the outline into natural, flowing speech
2. Use conversational language that sounds authentic when spoken
3. Include all key points from the outline
4. Make facts and information feel naturally integrated
5. Use the ${style} approach throughout
6. Include appropriate pauses indicated by paragraph breaks
7. Add rhetorical questions to maintain engagement
8. Ensure smooth flow from beginning to end

## Style Guidelines for ${style}:`;

    // Add style-specific guidance
    switch (style) {
      case 'conversational':
        prompt += `
- Use casual, friendly language
- Include personal observations and reactions
- Ask rhetorical questions frequently
- Use contractions and informal expressions
- Create a sense of speaking directly to the listener`;
        break;
      case 'storytelling':
        prompt += `
- Build narrative tension and release
- Use vivid descriptions and examples
- Create emotional connection with content
- Include story arcs within the chapter
- Use pacing to build engagement`;
        break;
      case 'interview':
        prompt += `
- Pose questions that would naturally arise
- Present different perspectives on topics
- Use a curious, investigative tone
- Include moments of discovery and insight
- Structure as exploration rather than lecture`;
        break;
      case 'educational':
        prompt += `
- Break down complex concepts clearly
- Use examples and analogies frequently
- Include clear explanations of terminology
- Build understanding progressively
- Summarize key points for retention`;
        break;
      default:
        prompt += `
- Maintain engaging, accessible tone
- Balance information with entertainment
- Use clear, understandable language
- Keep listener interest throughout`;
    }

    prompt += `\n\nRemember: This script will be converted to audio, so every word must sound natural when spoken aloud. Write exactly ${targetWords} words (±2%).`;

    return prompt;
  }

  /**
   * Generate script with word count accuracy attempts
   */
  async generateScriptWithWordCount(prompt, targetWords) {
    const maxAttempts = 3;
    const tolerance = 2; // 2% tolerance
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.debug(`Script generation attempt ${attempt}`, {
        targetWords,
        tolerance: `${tolerance}%`
      });

      const response = await this.chatComplete(prompt);
      const wordCount = this.countSpokenWords(response.content); // Count only spoken words
      const accuracy = this.calculateWordAccuracy(wordCount, targetWords);

      this.logger.debug(`Attempt ${attempt} result`, {
        wordCount,
        targetWords,
        accuracy: `${accuracy}%`
      });

      // Check if within tolerance
      if (Math.abs(accuracy) <= tolerance) {
        this.logger.info('Script word count achieved', {
          attempt,
          wordCount,
          targetWords,
          accuracy: `${accuracy}%`
        });
        return response;
      }

      // If not the last attempt, modify prompt for next try
      if (attempt < maxAttempts) {
        if (wordCount < targetWords) {
          prompt += `\n\nIMPORTANT: The previous attempt was ${wordCount} words, which is ${targetWords - wordCount} words SHORT. Please expand the content to reach exactly ${targetWords} words by adding more detail, examples, or explanations.`;
        } else {
          prompt += `\n\nIMPORTANT: The previous attempt was ${wordCount} words, which is ${wordCount - targetWords} words TOO LONG. Please condense the content to reach exactly ${targetWords} words by being more concise while keeping all key points.`;
        }
      }
    }

    // If all attempts failed, use the last response but log the issue
    const finalResponse = await this.chatComplete(prompt);
    const finalWordCount = this.countSpokenWords(finalResponse.content); // Count only spoken words
    
    this.logger.warn('Script word count target not achieved after all attempts', {
      attempts: maxAttempts,
      finalWordCount,
      targetWords,
      deviation: Math.abs(finalWordCount - targetWords)
    });

    return finalResponse;
  }

  /**
   * Calculate word count accuracy percentage
   */
  calculateWordAccuracy(actualWords, targetWords) {
    return Math.round(((actualWords - targetWords) / targetWords) * 10000) / 100;
  }

  /**
   * Parse script metadata from content
   */
  parseScriptMetadata(content) {
    const metadata = {
      speakingNotes: {},
      themes: [],
      factualElements: 0,
      estimatedTime: 0
    };

    // Extract speaking notes
    const speakingNotesMatch = content.match(/### Speaking Notes\n([\s\S]*?)(?=\n## |\n# |$)/);
    if (speakingNotesMatch) {
      const notesContent = speakingNotesMatch[1];
      
      // Extract individual note types
      const noteTypes = ['Tone', 'Pace', 'Emphasis', 'Transitions'];
      noteTypes.forEach(type => {
        const noteRegex = new RegExp(`\\*\\*${type}\\*\\*:\\s*([^\\n*]+)`);
        const match = notesContent.match(noteRegex);
        if (match) {
          metadata.speakingNotes[type.toLowerCase()] = match[1].trim();
        }
      });
    }

    // Extract themes from metadata section
    const themesMatch = content.match(/\*\*Key Themes Covered\*\*:\s*\[([^\]]+)\]/);
    if (themesMatch) {
      metadata.themes = themesMatch[1].split(',').map(theme => theme.trim());
    }

    // Count factual elements (rough estimation)
    const factPatterns = [
      /\d+%/g, // Percentages
      /\$[\d,]+/g, // Dollar amounts
      /\d{4}/g, // Years
      /\d+\s+(million|billion|thousand)/gi, // Large numbers
      /(research|study|report|survey)\s+(shows|indicates|found|suggests)/gi // Research citations
    ];

    factPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        metadata.factualElements += matches.length;
      }
    });

    return metadata;
  }

  /**
   * Validate script quality and requirements
   */
  validateScript(script, input) {
    const { targetWords, section } = input;
    
    // Validate word count accuracy
    const wordAccuracy = Math.abs(this.calculateWordAccuracy(script.wordCount, targetWords));
    if (wordAccuracy > 5) { // 5% tolerance for validation
      this.logger.warn('Script word count outside target range', {
        actualWords: script.wordCount,
        targetWords,
        accuracy: `${wordAccuracy}%`
      });
    }

    // Check script length (more lenient for Azure AI Foundry agents)
    if (script.wordCount < 25) {
      this.logger.warn(`Script is very short (${script.wordCount} words), but proceeding...`);
    }

    // Validate natural speech patterns
    const sentences = script.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = script.wordCount / sentences.length;
    
    if (avgWordsPerSentence > 25) {
      this.logger.warn('Script may have overly long sentences for speech', {
        avgWordsPerSentence: Math.round(avgWordsPerSentence)
      });
    }

    // Check for conversational elements
    const conversationalIndicators = [
      /\b(you|your|we|us|our)\b/gi,
      /\?/g, // Questions
      /\b(well|now|so|but|and)\b/gi, // Transition words
      /'/g // Contractions
    ];

    let conversationalScore = 0;
    conversationalIndicators.forEach(pattern => {
      const matches = script.content.match(pattern);
      if (matches) {
        conversationalScore += matches.length;
      }
    });

    const conversationalRatio = conversationalScore / script.wordCount;
    if (conversationalRatio < 0.05) {
      this.logger.warn('Script may not be conversational enough', {
        conversationalRatio: Math.round(conversationalRatio * 10000) / 100
      });
    }

    return true;
  }

  /**
   * Validate input specific to script writing
   */
  validateInput(input) {
    super.validateInput(input);
    
    const { section, targetWords, chapterNumber } = input;
    
    if (!section || typeof section !== 'string' || section.trim().length === 0) {
      throw new Error('Section content is required for script generation');
    }

    if (!targetWords || targetWords < 50 || targetWords > 2000) {
      throw new Error('Target words must be between 50 and 2000');
    }

    if (chapterNumber !== undefined && (chapterNumber < 1 || chapterNumber > 20)) {
      throw new Error('Chapter number must be between 1 and 20');
    }

    return true;
  }
}

export default ScriptAgent;
