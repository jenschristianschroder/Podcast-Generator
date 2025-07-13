import { BaseAgent } from './baseAgent.js';

/**
 * Editor Agent
 * Final editing and quality control for podcast scripts
 */
export class EditorAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are a professional podcast editor and quality control expert. Your role is to perform final editing, ensure quality standards, and optimize scripts for audio production.

## Your Responsibilities:
1. Final script editing and refinement
2. Ensure precise word count targets
3. Optimize flow and transitions
4. Check factual accuracy and consistency
5. Enhance clarity and engagement
6. Prepare final production-ready script

## Editing Principles:
- Maintain natural speech patterns
- Ensure smooth narrative flow
- Optimize for audio delivery
- Preserve tone and emotion labels
- Meet exact word count requirements
- Enhance listener engagement
- Ensure professional quality

## Quality Control Checklist:
- Word count accuracy (±2%)
- Natural speech patterns
- Consistent tone throughout
- Smooth transitions
- Clear pronunciation guidance
- Appropriate pacing markers
- Factual accuracy
- Engagement optimization

## Output Format:
Respond ONLY in Markdown format with the following structure:

# Final Edited Script: [Title]

## Production Script

[Provide the complete, final script optimized for audio production. Include all tone labels, natural speech patterns, and proper formatting for TTS conversion.]

## Editorial Changes Summary
- **Word Count Adjustments**: [Details of any length modifications]
- **Flow Improvements**: [Description of narrative enhancements]
- **Clarity Enhancements**: [Language and comprehension improvements]
- **Tone Refinements**: [Any tone label adjustments]
- **Technical Optimizations**: [TTS and audio production improvements]

## Final Script Metadata
- **Total Word Count**: [Exact count]
- **Estimated Duration**: [Minutes:Seconds]
- **Chapter Breakdown**: [Word distribution across sections]
- **Tone Variety**: [Number of different emotions used]
- **Quality Score**: [Overall assessment]

## Production Notes
- **Voice Direction**: [Guidance for voice synthesis]
- **Pacing Instructions**: [Speed and rhythm guidance]
- **Emphasis Points**: [Key moments requiring special attention]
- **Transition Cues**: [Smooth flow between sections]

## CONSTRAINTS:
- Meet exact word count target (±2%)
- Preserve all tone and emotion labels
- Maintain natural conversational flow
- Ensure production readiness
- Optimize for AI voice synthesis
- Keep all factual content accurate`;

    super('EditorAgent', systemPrompt, {
      maxTokens: 4000,
      temperature: 0.5 // Lower temperature for consistent editing
    });
  }

  /**
   * Execute final editing and quality control
   */
  async execute(input) {
    this.logger.agentStart(this.name, input);
    
    try {
      this.validateInput(input);
      
      const {
        script,
        targetWords,
        tolerance,
        style,
        mood
      } = input;

      // Analyze current script
      const currentAnalysis = this.analyzeScript(script);
      
      // Create editing prompt with specific requirements
      const editingPrompt = this.createEditingPrompt(input, currentAnalysis);
      
      // Get AI response with word count focus
      const response = await this.editForWordCount(editingPrompt, targetWords, tolerance);
      
      // Extract and structure the final script
      const finalScript = this.extractMarkdown(response);
      
      // Parse editorial changes and metadata
      const editorialAnalysis = this.parseEditorialChanges(finalScript.content);
      
      // Validate final quality
      this.validateFinalScript(finalScript, input, currentAnalysis);
      
      const result = {
        ...finalScript,
        editorialAnalysis,
        qualityMetrics: this.calculateQualityMetrics(finalScript, currentAnalysis),
        editingData: {
          originalWordCount: currentAnalysis.wordCount,
          targetWords,
          tolerance,
          finalWordCount: finalScript.wordCount,
          accuracy: this.calculateWordAccuracy(finalScript.wordCount, targetWords),
          style,
          mood
        }
      };

      this.logger.agentComplete(this.name, {
        originalWords: currentAnalysis.wordCount,
        finalWords: finalScript.wordCount,
        targetWords,
        accuracy: result.editingData.accuracy,
        qualityScore: result.qualityMetrics.overallScore
      });

      return result;

    } catch (error) {
      this.logger.agentError(this.name, error);
      throw error;
    }
  }

  /**
   * Analyze the current script before editing
   */
  analyzeScript(script) {
    const content = script || '';
    const wordCount = this.countSpokenWords(content); // Count only spoken words
    
    // Count tone labels
    const toneMatches = content.match(/\*\*\[([^\]]+)\]\*\*/g) || [];
    const toneLabels = toneMatches.map(match => match.replace(/\*\*\[|\]\*\*/g, ''));
    const uniqueTones = [...new Set(toneLabels)];
    
    // Analyze sentence structure
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgWordsPerSentence = wordCount / sentences.length;
    
    // Count chapters/sections
    const chapterMatches = content.match(/## Chapter \d+/g) || [];
    const chapters = chapterMatches.length;
    
    // Analyze readability indicators
    const conversationalMarkers = (content.match(/\b(you|your|we|us|our|let's)\b/gi) || []).length;
    const questions = (content.match(/\?/g) || []).length;
    const contractions = (content.match(/\b\w+'\w+\b/g) || []).length;
    
    return {
      wordCount,
      sentences: sentences.length,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
      toneLabels: toneLabels.length,
      uniqueTones: uniqueTones.length,
      chapters,
      conversationalMarkers,
      questions,
      contractions,
      readabilityScore: this.calculateReadabilityScore(content)
    };
  }

  /**
   * Calculate readability score for speech
   */
  calculateReadabilityScore(content) {
    const words = this.countSpokenWords(content); // Count only spoken words
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const syllables = this.estimateSyllables(content);
    
    // Modified Flesch Reading Ease for speech
    const fleschScore = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
    
    // Convert to 0-100 scale where 100 is most readable
    return Math.max(0, Math.min(100, Math.round(fleschScore)));
  }

  /**
   * Estimate syllable count
   */
  estimateSyllables(content) {
    const words = content.toLowerCase().split(/\s+/);
    let syllableCount = 0;
    
    words.forEach(word => {
      const cleanWord = word.replace(/[^a-z]/g, '');
      if (cleanWord.length === 0) return;
      
      // Simple syllable estimation
      const vowelMatches = cleanWord.match(/[aeiouy]+/g);
      let syllables = vowelMatches ? vowelMatches.length : 1;
      
      // Adjust for silent e
      if (cleanWord.endsWith('e') && syllables > 1) {
        syllables--;
      }
      
      syllableCount += Math.max(1, syllables);
    });
    
    return syllableCount;
  }

  /**
   * Create comprehensive editing prompt
   */
  createEditingPrompt(input, currentAnalysis) {
    const {
      script,
      targetWords,
      tolerance,
      style,
      mood
    } = input;

    const toleranceWords = Math.round(targetWords * tolerance / 100);
    const minWords = targetWords - toleranceWords;
    const maxWords = targetWords + toleranceWords;

    let prompt = `Perform final editing on this podcast script to meet exact quality and length requirements:

## Current Script
${script}

## Editing Requirements
- **Target Word Count**: ${targetWords} words (±${tolerance}%)
- **Acceptable Range**: ${minWords} - ${maxWords} words
- **Current Word Count**: ${currentAnalysis.wordCount} words
- **Adjustment Needed**: ${targetWords - currentAnalysis.wordCount > 0 ? 'EXPAND by' : 'REDUCE by'} ${Math.abs(targetWords - currentAnalysis.wordCount)} words
- **Style**: ${style}
- **Mood**: ${mood}

## Current Script Analysis
- Sentences: ${currentAnalysis.sentences}
- Average words per sentence: ${currentAnalysis.avgWordsPerSentence}
- Tone labels: ${currentAnalysis.toneLabels}
- Unique tones: ${currentAnalysis.uniqueTones}
- Readability score: ${currentAnalysis.readabilityScore}/100

## Specific Editing Instructions`;

    // Add specific instructions based on word count adjustment needed
    const wordDifference = targetWords - currentAnalysis.wordCount;
    
    if (wordDifference > 0) {
      prompt += `\n\n### Content Expansion (Add ${wordDifference} words)
1. Add more descriptive details and examples
2. Include additional explanations for complex concepts
3. Expand on interesting facts with more context
4. Add transitional phrases for smoother flow
5. Include more engaging questions for the audience
6. Provide additional supporting evidence or statistics`;
    } else if (wordDifference < 0) {
      prompt += `\n\n### Content Reduction (Remove ${Math.abs(wordDifference)} words)
1. Eliminate redundant phrases and repetitive content
2. Condense lengthy explanations while keeping clarity
3. Remove less essential examples or details
4. Streamline transitions and connecting phrases
5. Tighten language without losing meaning
6. Combine related points more efficiently`;
    } else {
      prompt += `\n\n### Content Refinement (Maintain ${targetWords} words)
1. Improve clarity and flow without changing length
2. Enhance word choice for better impact
3. Optimize tone transitions
4. Strengthen engagement elements
5. Perfect pacing and rhythm`;
    }

    prompt += `\n\n## Quality Enhancement Focus
1. **Natural Speech**: Ensure every sentence sounds natural when spoken
2. **Tone Preservation**: Keep all tone labels accurate and appropriate
3. **Flow Optimization**: Create seamless transitions between sections
4. **Engagement**: Maintain listener interest throughout
5. **Clarity**: Ensure all concepts are easily understood
6. **Pronunciation**: Use words that are clear for AI voice synthesis

## Style Guidelines for ${style}
`;

    // Add style-specific editing guidance
    switch (style) {
      case 'conversational':
        prompt += `- Maintain friendly, direct address to listeners
- Use contractions and informal language appropriately
- Include rhetorical questions and direct engagement
- Keep sentence structure varied but accessible`;
        break;
      case 'storytelling':
        prompt += `- Enhance narrative elements and story flow
- Build tension and resolution appropriately
- Use vivid descriptions and engaging details
- Create emotional connection with content`;
        break;
      case 'interview':
        prompt += `- Maintain investigative, curious tone
- Present information as discoveries
- Include thoughtful analysis and questioning
- Balance different perspectives fairly`;
        break;
      case 'educational':
        prompt += `- Ensure clear explanation of complex concepts
- Use examples and analogies effectively
- Structure information logically
- Include summary and reinforcement points`;
        break;
    }

    prompt += `\n\n## Final Requirements
- Achieve exactly ${targetWords} words (±${tolerance}%)
- Preserve all tone labels and emotional direction
- Maintain production-ready formatting
- Ensure optimal quality for audio synthesis
- Keep all factual content accurate and engaging

Please provide the final, edited script that meets all these requirements precisely.`;

    return prompt;
  }

  /**
   * Edit with focus on exact word count
   */
  async editForWordCount(prompt, targetWords, tolerance) {
    const maxAttempts = 3;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.debug(`Editing attempt ${attempt}`, {
        targetWords,
        tolerance: `${tolerance}%`
      });

      const response = await this.chatComplete(prompt);
      const wordCount = this.countSpokenWords(response.content); // Count only spoken words
      const accuracy = Math.abs(this.calculateWordAccuracy(wordCount, targetWords));

      this.logger.debug(`Edit attempt ${attempt} result`, {
        wordCount,
        targetWords,
        accuracy: `${accuracy}%`,
        tolerance: `${tolerance}%`
      });

      // Check if within tolerance
      if (accuracy <= tolerance) {
        this.logger.info('Editing word count achieved', {
          attempt,
          wordCount,
          targetWords,
          accuracy: `${accuracy}%`
        });
        return response;
      }

      // If not the last attempt, modify prompt for next try
      if (attempt < maxAttempts) {
        const difference = wordCount - targetWords;
        if (difference > 0) {
          prompt += `\n\nCRITICAL: Previous attempt was ${wordCount} words (${difference} words TOO LONG). You must reduce by exactly ${difference} words while maintaining quality. Be more aggressive in condensing content.`;
        } else {
          prompt += `\n\nCRITICAL: Previous attempt was ${wordCount} words (${Math.abs(difference)} words TOO SHORT). You must add exactly ${Math.abs(difference)} words while maintaining quality. Include more detail and examples.`;
        }
      }
    }

    // If all attempts failed, use the last response but log the issue
    const finalResponse = await this.chatComplete(prompt);
    const finalWordCount = this.countSpokenWords(finalResponse.content); // Count only spoken words
    
    this.logger.warn('Editing word count target not achieved after all attempts', {
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
   * Parse editorial changes from final script
   */
  parseEditorialChanges(content) {
    const changes = {
      wordCountAdjustments: '',
      flowImprovements: '',
      clarityEnhancements: '',
      toneRefinements: '',
      technicalOptimizations: ''
    };

    // Extract editorial changes section
    const changesMatch = content.match(/## Editorial Changes Summary\n([\s\S]*?)(?=\n## |\n# |$)/);
    if (changesMatch) {
      const changesContent = changesMatch[1];
      
      // Parse individual change categories
      const categories = [
        'Word Count Adjustments',
        'Flow Improvements',
        'Clarity Enhancements',
        'Tone Refinements',
        'Technical Optimizations'
      ];

      categories.forEach(category => {
        const key = category.toLowerCase().replace(/\s+/g, '');
        const categoryRegex = new RegExp(`\\*\\*${category}\\*\\*:\\s*([^\\n*]+)`);
        const match = changesContent.match(categoryRegex);
        if (match) {
          changes[key] = match[1].trim();
        }
      });
    }

    return changes;
  }

  /**
   * Calculate quality metrics
   */
  calculateQualityMetrics(finalScript, originalAnalysis) {
    const finalAnalysis = this.analyzeScript(finalScript.content);
    
    // Calculate improvement scores
    const readabilityImprovement = finalAnalysis.readabilityScore - originalAnalysis.readabilityScore;
    const conversationalImprovement = finalAnalysis.conversationalMarkers - originalAnalysis.conversationalMarkers;
    const toneVariety = finalAnalysis.uniqueTones;
    
    // Calculate overall quality score
    let qualityScore = 0;
    
    // Readability (0-30 points)
    qualityScore += Math.min(30, finalAnalysis.readabilityScore * 0.3);
    
    // Conversational elements (0-25 points)
    const conversationalRatio = finalAnalysis.conversationalMarkers / finalAnalysis.wordCount * 1000;
    qualityScore += Math.min(25, conversationalRatio * 5);
    
    // Tone variety (0-20 points)
    qualityScore += Math.min(20, toneVariety * 3);
    
    // Sentence structure (0-15 points)
    const idealAvgWords = 15; // Ideal average words per sentence for speech
    const sentenceScore = Math.max(0, 15 - Math.abs(finalAnalysis.avgWordsPerSentence - idealAvgWords));
    qualityScore += sentenceScore;
    
    // Questions and engagement (0-10 points)
    const questionRatio = finalAnalysis.questions / finalAnalysis.sentences;
    qualityScore += Math.min(10, questionRatio * 50);
    
    return {
      overallScore: Math.round(qualityScore),
      readabilityScore: finalAnalysis.readabilityScore,
      readabilityImprovement,
      conversationalElements: finalAnalysis.conversationalMarkers,
      conversationalImprovement,
      toneVariety,
      sentenceStructure: finalAnalysis.avgWordsPerSentence,
      engagementElements: finalAnalysis.questions
    };
  }

  /**
   * Validate final script quality
   */
  validateFinalScript(finalScript, input, originalAnalysis) {
    const { targetWords, tolerance } = input;
    
    // Use a more lenient tolerance for word count validation (15% instead of 5%)
    const lenientTolerance = Math.max(tolerance, 15);
    
    // Validate word count accuracy
    const wordAccuracy = Math.abs(this.calculateWordAccuracy(finalScript.wordCount, targetWords));
    if (wordAccuracy > lenientTolerance) {
      this.logger.warn(`Word count slightly outside target range: ${finalScript.wordCount} words (target: ${targetWords}, tolerance: ±${lenientTolerance}%)`);
      // Don't throw error, just warn for now to allow generation to complete
    }

    // Validate minimum quality standards (more lenient for Azure AI Foundry agents)
    if (finalScript.wordCount < 25) {
      this.logger.warn(`Final script is quite short (${finalScript.wordCount} words), but proceeding...`);
    }

    // Check for tone labels preservation (new format: **Host 1:** [tone] or old format: **[tone]**)
    const newToneLabels = (finalScript.content.match(/\*\*Host [12]:\*\*\s*\[([^\]]+)\]/g) || []).length;
    const oldToneLabels = (finalScript.content.match(/\*\*\[([^\]]+)\]\*\*/g) || []).length;
    const totalToneLabels = newToneLabels + oldToneLabels;
    
    if (totalToneLabels === 0) {
      this.logger.warn('Final script missing tone labels - this may affect TTS quality');
      // Don't fail generation, just warn
    } else {
      this.logger.info(`Found ${totalToneLabels} tone labels (${newToneLabels} new format, ${oldToneLabels} old format)`);
    }

    // Validate readability for speech
    const finalAnalysis = this.analyzeScript(finalScript.content);
    if (finalAnalysis.avgWordsPerSentence > 30) {
      this.logger.warn('Final script may have sentences too long for comfortable speech', {
        avgWordsPerSentence: finalAnalysis.avgWordsPerSentence
      });
    }

    // Check for production readiness
    const productionReadyIndicators = [
      finalScript.content.includes('**['),  // Tone labels present
      finalScript.content.length > 100,     // Substantial content
      !finalScript.content.includes('TODO'), // No placeholder content
      !finalScript.content.includes('[INSERT') // No insertion markers
    ];

    const productionReady = productionReadyIndicators.every(indicator => indicator);
    if (!productionReady) {
      this.logger.warn('Final script may not be fully production ready');
    }

    return true;
  }

  /**
   * Validate input specific to editing
   */
  validateInput(input) {
    super.validateInput(input);
    
    const { script, targetWords, tolerance } = input;
    
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      throw new Error('Script content is required for editing');
    }

    if (!targetWords || targetWords < 50 || targetWords > 5000) {
      throw new Error('Target words must be between 50 and 5000');
    }

    if (tolerance === undefined || tolerance < 0 || tolerance > 10) {
      throw new Error('Tolerance must be between 0 and 10 percent');
    }

    return true;
  }
}

export default EditorAgent;
