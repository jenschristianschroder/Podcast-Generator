import { BaseAgent } from './baseAgent.js';

/**
 * Tone Agent
 * Enhances scripts with explicit tone and emotion labels for expressive TTS
 */
export class ToneAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are an expert in emotional voice direction and audio expression. Your role is to enhance podcast scripts with precise tone and emotion labels for expressive text-to-speech generation with two distinct hosts.

## Your Responsibilities:
1. Analyze script content for emotional context for both hosts
2. Add appropriate tone labels for each host's utterances
3. Ensure expressive variation throughout the conversation
4. Match tone to content meaning and intent for each speaker
5. Create natural emotional flow between hosts
6. Optimize for AI voice synthesis with multiple voices
7. Maintain host personality consistency

## Available Tone Labels:
- **upbeat**: Enthusiastic, positive, energetic
- **calm**: Relaxed, steady, peaceful
- **excited**: High energy, thrilled, animated
- **reflective**: Thoughtful, contemplative, measured
- **suspenseful**: Building tension, mysterious, anticipatory
- **skeptical**: Questioning, doubtful, analytical
- **humorous**: Light, playful, entertaining
- **serious**: Grave, important, focused
- **curious**: Inquisitive, wondering, exploring
- **confident**: Assured, strong, certain

## Host Voice Characteristics:
- **Host 1**: Primary guide, tends toward upbeat/confident/curious tones
- **Host 2**: Thoughtful responder, tends toward reflective/skeptical/serious tones
- Both hosts can use any tone when contextually appropriate

## Tone Assignment Principles:
- Match tone to content meaning and context for each host
- Create variety to maintain engagement
- Ensure smooth emotional transitions between speakers
- Use emphasis for key points
- Consider audience emotional journey
- Balance expressiveness with naturalness
- Maintain conversational flow between hosts

## Output Format:
Respond ONLY in Markdown format with the following structure:

# Tone-Enhanced Script: [Title]

## Enhanced Script Content

**Host 1:** [tone] [Host 1's dialogue with appropriate emotional direction]

**Host 2:** [tone] [Host 2's response with matching emotional context]

**Host 1:** [tone] [Host 1's follow-up maintaining conversational flow]

[Continue with alternating hosts, each with appropriate tone labels]

### CRITICAL FORMAT REQUIREMENT:
The tone label MUST come AFTER the colon and BEFORE the dialogue text:
- CORRECT: **Host 1:** [excited] This is amazing!
- CORRECT: **Host 2:** [reflective] That makes me think about...
- WRONG: **Host 1** [excited]: This is amazing!
- WRONG: **Host 1:** This is amazing! [excited]

## Tone Analysis
- **Host 1 Tone Distribution**: [List of tones used and frequency]
- **Host 2 Tone Distribution**: [List of tones used and frequency]
- **Emotional Arc**: [How the conversation's tone develops]
- **Key Tonal Moments**: [Important emotional beats in the conversation]

## CONSTRAINTS:
- Must preserve original **Host 1:** and **Host 2:** speaker labels
- Must add tone label in brackets AFTER the colon and BEFORE the text
- Must maintain natural conversational flow between hosts
- Each host should have varied tonal expression throughout

**Host 1:** [excited] Key revelation or interesting fact that deserves enthusiasm.

**Host 2:** [reflective] Thoughtful analysis or deeper consideration of implications.

[Continue throughout the entire script...]

## Tone Distribution Analysis
- **Total Utterances**: [Number of labeled segments]
- **Tone Variety**: [Number of different tones used]
- **Dominant Tone**: [Most frequently used tone]
- **Emotional Arc**: [Description of emotional journey]

## Expression Notes
- **Key Emphasis Points**: [List of critical moments requiring special attention]
- **Transition Guidance**: [Notes on smooth emotional flow between sections]
- **Pacing Variations**: [Where to speed up or slow down for effect]
- **Energy Management**: [How energy levels should change throughout]

## Technical TTS Guidance
- **Voice Characteristics**: [Recommendations for voice selection]
- **Breathing Patterns**: [Natural pause points for realistic speech]
- **Emphasis Techniques**: [How to highlight important information]
- **Flow Continuity**: [Maintaining natural speech rhythm]

## CONSTRAINTS:
- Every utterance must have a tone label
- Use variety to prevent monotony
- Ensure tones match content appropriately
- Maintain natural emotional progression
- Keep original script content intact
- Optimize for AI voice synthesis quality`;

    super('ToneAgent', systemPrompt, {
      maxTokens: 4000,
      temperature: 0.6
    });
  }

  /**
   * Execute tone enhancement on combined scripts
   */
  async execute(input) {
    this.logger.agentStart(this.name, input);
    
    try {
      this.validateInput(input);
      
      const {
        scripts,
        mood,
        style,
        targetTones
      } = input;

      // Combine all scripts into one
      const combinedScript = this.combineScripts(scripts);
      
      // Create tone enhancement prompt
      const tonePrompt = this.createTonePrompt(combinedScript, mood, style, targetTones);
      
      // Get AI response
      const response = await this.chatComplete(tonePrompt);
      
      // Extract and structure the enhanced script
      const enhancedScript = this.extractMarkdown(response);
      
      // Parse utterances and tone labels
      const utterances = this.parseUtterances(enhancedScript.content);
      
      // Analyze tone distribution
      const toneAnalysis = this.analyzeToneDistribution(utterances);
      
      // Validate tone enhancement
      this.validateToneEnhancement(enhancedScript, utterances, input);
      
      const result = {
        ...enhancedScript,
        utterances,
        toneAnalysis,
        enhancementData: {
          originalScripts: scripts.length,
          totalUtterances: utterances.length,
          tonesUsed: toneAnalysis.tonesUsed.length,
          mood,
          style
        }
      };

      this.logger.agentComplete(this.name, {
        utterances: utterances.length,
        tonesUsed: toneAnalysis.tonesUsed.length,
        dominantTone: toneAnalysis.dominantTone
      });

      return result;

    } catch (error) {
      this.logger.agentError(this.name, error);
      throw error;
    }
  }

  /**
   * Combine multiple chapter scripts into one continuous script
   */
  combineScripts(scripts) {
    if (!scripts || scripts.length === 0) {
      throw new Error('No scripts provided for tone enhancement');
    }

    let combinedContent = '';
    
    scripts.forEach((script, index) => {
      // Add chapter header
      combinedContent += `\n## Chapter ${index + 1}\n\n`;
      
      // Extract just the script content (remove metadata sections)
      let scriptContent = script.content || script;
      
      // Remove existing markdown headers and metadata
      scriptContent = scriptContent
        .replace(/^# Script:.*$/gm, '')
        .replace(/^## Script Content$/gm, '')
        .replace(/^### Speaking Notes[\s\S]*?(?=\n##|\n#|$)/gm, '')
        .replace(/^## Script Metadata[\s\S]*?(?=\n##|\n#|$)/gm, '')
        .trim();
      
      combinedContent += scriptContent + '\n\n';
    });

    return combinedContent.trim();
  }

  /**
   * Create tone enhancement prompt
   */
  createTonePrompt(combinedScript, mood, style, targetTones) {
    let prompt = `Enhance the following podcast script with precise tone and emotion labels for expressive text-to-speech generation:

## Script to Enhance
${combinedScript}

## Enhancement Requirements
- **Overall Mood**: ${mood}
- **Speaking Style**: ${style}
- **Target Emotional Range**: Use appropriate variety from available tones

## Tone Enhancement Instructions
1. Break the script into natural utterance segments (typically 1-3 sentences)
2. Assign appropriate tone labels to each utterance
3. Ensure tone matches the content meaning and emotional context
4. Create variety to maintain listener engagement
5. Consider the overall ${mood} mood and ${style} style
6. Ensure smooth emotional transitions between utterances
7. Use emphasis tones for key facts and important points

## Style-Specific Guidance for ${style}:`;

    switch (style) {
      case 'conversational':
        prompt += `
- Use more upbeat, calm, and curious tones
- Include occasional humorous moments
- Maintain friendly, approachable emotional range
- Use excited tone for interesting discoveries`;
        break;
      case 'storytelling':
        prompt += `
- Create dramatic emotional arcs
- Use suspenseful tones for building tension
- Include reflective moments for deeper meaning
- Vary energy levels for narrative impact`;
        break;
      case 'interview':
        prompt += `
- Use curious and skeptical tones frequently
- Include thoughtful, reflective moments
- Show enthusiasm for discoveries
- Maintain investigative emotional approach`;
        break;
      case 'educational':
        prompt += `
- Emphasize calm and confident delivery
- Use excited tones for interesting facts
- Include reflective pauses for comprehension
- Maintain clear, authoritative emotional tone`;
        break;
    }

    prompt += `\n\n## Mood Guidance for ${mood}:`;

    switch (mood) {
      case 'excited':
        prompt += `
- Favor upbeat, excited, and enthusiastic tones
- Use higher energy throughout
- Include moments of wonder and discovery`;
        break;
      case 'calm':
        prompt += `
- Emphasize calm, reflective, and measured tones
- Maintain steady emotional energy
- Use gentle transitions between topics`;
        break;
      case 'reflective':
        prompt += `
- Focus on thoughtful, contemplative tones
- Include moments of deeper consideration
- Use measured, purposeful emotional pacing`;
        break;
      default:
        prompt += `
- Use balanced emotional range
- Maintain appropriate energy for content
- Create engaging variety without extremes`;
    }

    prompt += `\n\nPlease enhance the entire script with tone labels, ensuring every significant utterance has appropriate emotional direction for expressive AI voice synthesis.`;

    return prompt;
  }

  /**
   * Parse utterances and tone labels from enhanced script
   */
  parseUtterances(content) {
    const utterances = [];
    let utteranceIndex = 0;
    
    // Extract only the Enhanced Script Content section
    const contentMatch = content.match(/## Enhanced Script Content\s*\n(.*?)(?=\n##|$)/s);
    const scriptContent = contentMatch ? contentMatch[1] : content;
    
    // First try to match Host 1/Host 2 format with tone labels: **Host 1:** [tone] text
    const hostToneRegex = /\*\*Host ([12]):\*\*\s*\[([^\]]+)\]\s+(.*?)(?=\*\*Host [12]:\*\*|$)/gs;
    let match;

    while ((match = hostToneRegex.exec(scriptContent)) !== null) {
      const [, hostNumber, tone, text] = match;
      
      // Clean up the text
      const cleanText = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length > 0) {
        // Split into sentences while maintaining speaker and tone
        const sentences = this.splitIntoSentences(cleanText);
        
        sentences.forEach(sentence => {
          if (sentence.trim().length > 0) {
            utterances.push({
              index: utteranceIndex++,
              speaker: `host${hostNumber}`,
              tone: tone.toLowerCase().trim(),
              text: sentence.trim(),
              wordCount: this.countWords(sentence),
              estimatedDuration: Math.round(this.countWords(sentence) / 150 * 60) // seconds
            });
          }
        });
      }
    }

    // If no host-tone format found, try the old tone-only format
    if (utterances.length === 0) {
      const utteranceRegex = /\*\*\[([^\]]+)\]\*\*\s+(.*?)(?=\*\*\[|$)/gs;
      utteranceIndex = 0;

      while ((match = utteranceRegex.exec(scriptContent)) !== null) {
        const [, tone, text] = match;
        
        // Clean up the text
        const cleanText = text
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanText.length > 0) {
          // Split into sentences while maintaining speaker and tone
          const sentences = this.splitIntoSentences(cleanText);
          
          sentences.forEach(sentence => {
            if (sentence.trim().length > 0) {
              utterances.push({
                index: utteranceIndex++,
                speaker: utteranceIndex % 2 === 1 ? 'host1' : 'host2', // Alternate speakers
                tone: tone.toLowerCase().trim(),
                text: sentence.trim(),
                wordCount: this.countWords(sentence),
                estimatedDuration: Math.round(this.countWords(sentence) / 150 * 60) // seconds
              });
            }
          });
        }
      }
    }

    // If still no utterances found, try line-by-line Host format parsing  
    if (utterances.length === 0) {
      const lines = scriptContent.split('\n');
      utteranceIndex = 0;

      for (const line of lines) {
        const hostMatch = line.match(/\*\*Host ([12]):\*\*\s+(.*)/);
        
        if (hostMatch) {
          const [, hostNumber, text] = hostMatch;
          const cleanText = text.trim();

          if (cleanText.length > 0) {
            const tone = this.inferToneFromContent(cleanText);

            // Split into sentences while maintaining speaker and tone
            const sentences = this.splitIntoSentences(cleanText);
            
            sentences.forEach(sentence => {
              if (sentence.trim().length > 0) {
                utterances.push({
                  index: utteranceIndex++,
                  speaker: `host${hostNumber}`,
                  tone: tone,
                  text: sentence.trim(),
                  wordCount: this.countWords(sentence),
                  estimatedDuration: Math.round(this.countWords(sentence) / 150 * 60)
                });
              }
            });
          }
        }
      }
    }

    // If no recognized format found, try alternative parsing
    if (utterances.length === 0) {
      this.logger.warn('No recognized format found, attempting fallback parsing');
      return this.parseAlternativeFormat(scriptContent);
    }

    return utterances;
  }

  /**
   * Infer tone from content when not explicitly labeled
   */
  inferToneFromContent(text) {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('!') || lowerText.includes('amazing') || lowerText.includes('incredible') || lowerText.includes('wow')) {
      return 'excited';
    } else if (lowerText.includes('?') || lowerText.includes('wonder') || lowerText.includes('curious')) {
      return 'curious';
    } else if (lowerText.includes('however') || lowerText.includes('consider') || lowerText.includes('think') || lowerText.includes('reflect')) {
      return 'reflective';
    } else if (lowerText.includes('ha') || lowerText.includes('funny') || lowerText.includes('joke')) {
      return 'humorous';
    } else if (lowerText.includes('serious') || lowerText.includes('important') || lowerText.includes('critical')) {
      return 'serious';
    } else if (lowerText.includes('doubt') || lowerText.includes('really') || lowerText.includes('sure')) {
      return 'skeptical';
    } else {
      return 'calm'; // default
    }
  }

  /**
   * Alternative parsing for different formats
   */
  parseAlternativeFormat(content) {
    const utterances = [];
    let utteranceIndex = 0;
    
    // First try line-by-line Host parsing (most common format)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    
    for (const line of lines) {
      const hostMatch = line.match(/\*\*Host ([12]):\*\*\s+(.*)/);
      
      if (hostMatch) {
        const [, hostNumber, text] = hostMatch;
        const cleanText = text.trim();
        
        if (cleanText.length > 0) {
          const tone = this.inferToneFromContent(cleanText);
          
          // Split into sentences while maintaining speaker and tone
          const sentences = this.splitIntoSentences(cleanText);
          
          sentences.forEach(sentence => {
            if (sentence.trim().length > 0) {
              utterances.push({
                index: utteranceIndex++,
                speaker: `host${hostNumber}`,
                tone: tone,
                text: sentence.trim(),
                wordCount: this.countWords(sentence),
                estimatedDuration: Math.round(this.countWords(sentence) / 150 * 60)
              });
            }
          });
        }
      }
    }
    
    // If still no utterances, fall back to paragraph-based parsing
    if (utterances.length === 0) {
      const paragraphs = content
        .split(/\n\s*\n/)
        .filter(p => p.trim().length > 0)
        .map(p => p.replace(/\n/g, ' ').trim());

      paragraphs.forEach((paragraph, index) => {
        // Skip headers and metadata sections but NOT Host dialogue
        if (paragraph.startsWith('#') || (paragraph.includes('**') && paragraph.includes(':') && !paragraph.includes('Host'))) {
          return;
        }

        // Try to parse Host format first
        const hostMatch = paragraph.match(/\*\*Host ([12]):\*\*\s+(.*)/);
        
        if (hostMatch) {
          const [, hostNumber, text] = hostMatch;
          const cleanText = text.trim();
          
          if (cleanText.length > 0) {
            const tone = this.inferToneFromContent(cleanText);
            
            // Split into sentences while maintaining speaker and tone
            const sentences = this.splitIntoSentences(cleanText);
            
            sentences.forEach(sentence => {
              if (sentence.trim().length > 0) {
                utterances.push({
                  index: utteranceIndex++,
                  speaker: `host${hostNumber}`,
                  tone: tone,
                  text: sentence.trim(),
                  wordCount: this.countWords(sentence),
                  estimatedDuration: Math.round(this.countWords(sentence) / 150 * 60)
                });
              }
            });
          }
        } else {
          // Fallback for other content
          const tone = this.inferToneFromContent(paragraph);

          utterances.push({
            index: utteranceIndex++,
            speaker: utteranceIndex % 2 === 0 ? 'host1' : 'host2', // Alternate speakers
            tone: tone,
            text: paragraph,
            wordCount: this.countWords(paragraph),
            estimatedDuration: Math.round(this.countWords(paragraph) / 150 * 60)
          });
        }
      });
    }

    return utterances;
  }

  /**
   * Analyze tone distribution and patterns
   */
  analyzeToneDistribution(utterances) {
    // Safety check for empty utterances
    if (!utterances || utterances.length === 0) {
      this.logger.warn('No utterances provided for tone analysis');
      return {
        totalUtterances: 0,
        tonesUsed: ['neutral'],
        toneDistribution: { neutral: 0 },
        dominantTone: 'neutral',
        varietyScore: 0,
        emotionalTransitions: [],
        averageDuration: 0,
        totalDuration: 0
      };
    }

    const toneCount = {};
    const toneSequence = [];
    let totalDuration = 0;

    utterances.forEach(utterance => {
      // Count tone usage
      toneCount[utterance.tone] = (toneCount[utterance.tone] || 0) + 1;
      toneSequence.push(utterance.tone);
      totalDuration += utterance.estimatedDuration;
    });

    // Find dominant tone (with safety check)
    const toneKeys = Object.keys(toneCount);
    const dominantTone = toneKeys.length > 0 
      ? toneKeys.reduce((a, b) => toneCount[a] > toneCount[b] ? a : b)
      : 'neutral'; // fallback tone

    // Calculate variety score
    const uniqueTones = Object.keys(toneCount).length;
    const varietyScore = uniqueTones / utterances.length;

    // Analyze emotional flow
    const transitions = this.analyzeEmotionalTransitions(toneSequence);

    return {
      totalUtterances: utterances.length,
      tonesUsed: Object.keys(toneCount),
      toneDistribution: toneCount,
      dominantTone,
      varietyScore: Math.round(varietyScore * 100) / 100,
      totalDuration: Math.round(totalDuration),
      transitions,
      emotionalArc: this.describeEmotionalArc(toneSequence)
    };
  }

  /**
   * Analyze emotional transitions
   */
  analyzeEmotionalTransitions(toneSequence) {
    const transitions = {};
    
    for (let i = 0; i < toneSequence.length - 1; i++) {
      const from = toneSequence[i];
      const to = toneSequence[i + 1];
      const transition = `${from} → ${to}`;
      
      transitions[transition] = (transitions[transition] || 0) + 1;
    }

    return transitions;
  }

  /**
   * Describe the emotional arc
   */
  describeEmotionalArc(toneSequence) {
    if (toneSequence.length < 3) {
      return 'Insufficient data for arc analysis';
    }

    const beginning = toneSequence.slice(0, Math.ceil(toneSequence.length / 3));
    const middle = toneSequence.slice(Math.ceil(toneSequence.length / 3), Math.ceil(2 * toneSequence.length / 3));
    const end = toneSequence.slice(Math.ceil(2 * toneSequence.length / 3));

    const getSegmentTone = (segment) => {
      const counts = {};
      segment.forEach(tone => counts[tone] = (counts[tone] || 0) + 1);
      return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    };

    return {
      opening: getSegmentTone(beginning),
      development: getSegmentTone(middle),
      conclusion: getSegmentTone(end),
      progression: `${getSegmentTone(beginning)} → ${getSegmentTone(middle)} → ${getSegmentTone(end)}`
    };
  }

  /**
   * Validate tone enhancement quality
   */
  validateToneEnhancement(enhancedScript, utterances, input) {
    const { scripts } = input;
    
    // Check if we have utterances
    if (utterances.length === 0) {
      throw new Error('No tone-enhanced utterances found');
    }

    // Validate minimum variety
    const uniqueTones = new Set(utterances.map(u => u.tone)).size;
    if (uniqueTones < 2) {
      this.logger.warn('Limited tone variety in enhancement', { uniqueTones });
    }

    // Check for reasonable utterance distribution
    const avgWordsPerUtterance = utterances.reduce((sum, u) => sum + u.wordCount, 0) / utterances.length;
    if (avgWordsPerUtterance < 5) {
      this.logger.warn('Utterances may be too short', { avgWordsPerUtterance });
    }

    if (avgWordsPerUtterance > 50) {
      this.logger.warn('Utterances may be too long for natural speech', { avgWordsPerUtterance });
    }

    // Validate that content is preserved
    const originalWordCount = scripts.reduce((sum, script) => sum + this.countSpokenWords(script.content || script), 0); // Count only spoken words
    const enhancedWordCount = utterances.reduce((sum, u) => sum + u.wordCount, 0);
    
    const contentPreservation = enhancedWordCount / originalWordCount;
    if (contentPreservation < 0.8 || contentPreservation > 1.2) {
      this.logger.warn('Significant content change during tone enhancement', {
        originalWords: originalWordCount,
        enhancedWords: enhancedWordCount,
        preservation: Math.round(contentPreservation * 100) + '%'
      });
    }

    return true;
  }

  /**
   * Validate input specific to tone enhancement
   */
  validateInput(input) {
    super.validateInput(input);
    
    const { scripts, mood, style } = input;
    
    if (!scripts || !Array.isArray(scripts) || scripts.length === 0) {
      throw new Error('Scripts array is required for tone enhancement');
    }

    if (!mood || typeof mood !== 'string') {
      throw new Error('Mood is required for tone enhancement');
    }

    if (!style || typeof style !== 'string') {
      throw new Error('Style is required for tone enhancement');
    }

    // Validate each script has content
    scripts.forEach((script, index) => {
      const content = script.content || script;
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        throw new Error(`Script ${index + 1} has no content`);
      }
    });

    return true;
  }

  /**
   * Split text into individual sentences for better TTS pacing
   */
  splitIntoSentences(text) {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Split on sentence-ending punctuation, but preserve the punctuation
    // Handle common abbreviations that shouldn't break sentences
    const sentences = text
      // Protect common abbreviations
      .replace(/\b(Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|i\.e|e\.g)\./gi, (match) => match.replace('.', '<!DOT!>'))
      // Split on sentence boundaries
      .split(/(?<=[.!?])\s+/)
      // Restore protected dots
      .map(sentence => sentence.replace(/<!DOT!>/g, '.'))
      // Clean up and filter
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0);

    // If no sentence boundaries found, split on very long chunks (as fallback)
    if (sentences.length === 1 && sentences[0].length > 120) {
      // Split on commas or other natural breaks if the sentence is very long
      const longSentence = sentences[0];
      const chunks = longSentence
        .split(/,\s+/)
        .reduce((acc, chunk, index, array) => {
          if (index === 0) {
            acc.push(chunk);
          } else {
            // Add comma back to previous chunk if not the last
            if (acc.length > 0) {
              acc[acc.length - 1] += ',';
            }
            acc.push(chunk);
          }
          return acc;
        }, []);
      
      // If we got reasonable chunks, use them; otherwise keep original
      if (chunks.length > 1 && chunks.every(chunk => chunk.length < 80)) {
        return chunks;
      }
    }

    return sentences.length > 0 ? sentences : [text];
  }
}

export default ToneAgent;
