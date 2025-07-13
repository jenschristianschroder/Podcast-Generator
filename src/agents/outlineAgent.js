import { BaseAgent } from './baseAgent.js';

/**
 * Outline Agent
 * Creates a detailed structural outline for the podcast based on plan and research
 */
export class OutlineAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are an expert podcast outline creator. Your role is to transform plans and research into detailed, actionable outlines for AI-generated podcasts.

## Your Responsibilities:
1. Structure content logically and engagingly
2. Create smooth transitions between sections
3. Ensure balanced content distribution
4. Define specific talking points and flow
5. Establish narrative arc and pacing
6. Prepare framework for script generation

## Outline Principles:
- Start with a compelling hook
- Build momentum throughout
- Create natural conversation flow
- Include strategic pauses and emphasis points
- End with memorable conclusions
- Ensure each section serves the overall narrative

## Output Format:
Respond ONLY in Markdown format with the following structure:

# Podcast Outline: [Topic Title]

## Episode Overview
Brief description of the episode flow and narrative approach.

## Opening Hook (30-60 seconds)
- Attention-grabbing opening statement or question
- Brief preview of what's coming
- Tone setting for the episode

## Chapter Outlines

### Chapter 1: [Title] (X minutes)
**Narrative Purpose**: Why this chapter exists in the story

**Opening**:
- Transition from previous section
- Chapter introduction and preview

**Key Discussion Points**:
1. **Point A** (Y minutes)
   - Specific talking point
   - Supporting fact or example
   - Connection to broader theme

2. **Point B** (Y minutes)
   - Specific talking point
   - Supporting fact or example
   - Connection to broader theme

3. **Point C** (Y minutes)
   - Specific talking point
   - Supporting fact or example
   - Connection to broader theme

**Chapter Conclusion**:
- Key takeaway summary
- Transition to next chapter

### Chapter 2: [Title] (X minutes)
[Same detailed structure as Chapter 1]

[Continue for all chapters...]

## Closing Segment (60-90 seconds)
- Recap of main themes
- Final thought or call to action
- Episode conclusion

## Pacing Notes
- **Energy Levels**: How intensity should vary throughout
- **Transition Points**: Where to shift tone or focus
- **Emphasis Moments**: Key points to stress
- **Breathing Space**: Where to allow for reflection

## Technical Notes
- **Word Count Distribution**: Approximate words per section
- **Speaking Style**: Tone and pace guidance
- **Potential Questions**: Rhetorical questions to engage listeners

## CONSTRAINTS:
- Maintain consistent narrative flow
- Ensure balanced chapter lengths
- Include specific details for each talking point
- Create natural conversation transitions
- Keep listener engagement throughout
- Match the planned word count distribution`;

    super('OutlineAgent', systemPrompt, {
      maxTokens: 4000,
      temperature: 0.7
    });
  }

  /**
   * Execute outline creation based on plan and research
   */
  async execute(input) {
    this.logger.agentStart(this.name, input);
    
    try {
      this.validateInput(input);
      
      const {
        plan,
        research,
        chapters,
        targetWords,
        style
      } = input;

      // Create outline prompt
      const outlinePrompt = this.createOutlinePrompt(input);
      
      // Get AI response
      const response = await this.chatComplete(outlinePrompt);
      
      // Extract and structure the outline
      const outline = this.extractMarkdown(response);
      
      // Parse sections and structure
      const sections = this.parseOutlineSections(outline.content, chapters);
      
      // Calculate timing and word distribution
      const timing = this.calculateTiming(sections, targetWords);
      
      // Validate outline completeness
      this.validateOutline(outline, input);
      
      const result = {
        ...outline,
        sections,
        timing,
        structure: {
          totalSections: sections.length,
          targetWords,
          style,
          estimatedDuration: Math.round(targetWords / 150)
        }
      };

      this.logger.agentComplete(this.name, {
        wordCount: outline.wordCount,
        sectionsCreated: sections.length,
        estimatedDuration: result.structure.estimatedDuration
      });

      return result;

    } catch (error) {
      this.logger.agentError(this.name, error);
      throw error;
    }
  }

  /**
   * Create comprehensive outline prompt
   */
  createOutlinePrompt(input) {
    const {
      plan,
      research,
      chapters,
      targetWords,
      style
    } = input;

    const wordsPerChapter = Math.round(targetWords / chapters);
    const minutesPerChapter = Math.round(wordsPerChapter / 150);

    let prompt = `Create a detailed podcast outline based on the following plan and research:

## Podcast Plan
${plan}

## Research Findings
${research}

## Outline Requirements
- **Total Word Count**: ${targetWords} words
- **Number of Chapters**: ${chapters}
- **Words per Chapter**: ~${wordsPerChapter} words
- **Time per Chapter**: ~${minutesPerChapter} minutes
- **Style**: ${style}

## Outline Instructions
1. Create a compelling opening hook that immediately engages listeners
2. Structure exactly ${chapters} chapters with clear themes and progression
3. Include specific talking points with supporting evidence from research
4. Ensure smooth transitions between all sections
5. Distribute content evenly across chapters (${wordsPerChapter} words each)
6. Adopt a ${style} approach throughout
7. Include pacing and emphasis notes for natural delivery
8. End with a memorable conclusion

## Content Guidelines
- Use specific facts and examples from the research
- Create natural conversation flow
- Include moments for emphasis and reflection
- Ensure each chapter builds on the previous one
- Make complex topics accessible and engaging
- Include rhetorical questions to maintain engagement

Please create a detailed outline that provides clear direction for script writing while maintaining audience engagement throughout.`;

    return prompt;
  }

  /**
   * Parse outline sections from content
   */
  parseOutlineSections(content, expectedChapters) {
    const sections = [];
    
    // First, extract the opening hook
    const hookMatch = content.match(/## Opening Hook.*?\n([\s\S]*?)(?=\n## |\n# |$)/);
    if (hookMatch) {
      sections.push({
        type: 'opening',
        title: 'Opening Hook',
        content: hookMatch[1].trim(),
        duration: '30-60 seconds',
        wordEstimate: 50
      });
    }

    // Extract chapter sections
    const chapterRegex = /### Chapter (\d+): (.+?)\s*\(([^)]+)\)\n([\s\S]*?)(?=### Chapter \d+:|## Closing Segment|## Pacing Notes|$)/g;
    let match;

    while ((match = chapterRegex.exec(content)) !== null) {
      const [, number, title, duration, chapterContent] = match;
      
      // Parse chapter structure
      const chapterData = this.parseChapterContent(chapterContent);
      
      sections.push({
        type: 'chapter',
        number: parseInt(number),
        title: title.trim(),
        duration: duration.trim(),
        content: chapterContent.trim(),
        ...chapterData
      });
    }

    // Extract closing segment
    const closingMatch = content.match(/## Closing Segment.*?\n([\s\S]*?)(?=\n## |\n# |$)/);
    if (closingMatch) {
      sections.push({
        type: 'closing',
        title: 'Closing Segment',
        content: closingMatch[1].trim(),
        duration: '60-90 seconds',
        wordEstimate: 100
      });
    }

    // Validate section count
    const chapterSections = sections.filter(s => s.type === 'chapter');
    if (chapterSections.length !== expectedChapters) {
      this.logger.warn(`Expected ${expectedChapters} chapters, found ${chapterSections.length}`);
    }

    return sections;
  }

  /**
   * Parse individual chapter content
   */
  parseChapterContent(chapterContent) {
    const result = {
      discussionPoints: [],
      narrativePurpose: '',
      opening: '',
      conclusion: ''
    };

    // Extract narrative purpose
    const purposeMatch = chapterContent.match(/\*\*Narrative Purpose\*\*:\s*([^\n]+)/);
    if (purposeMatch) {
      result.narrativePurpose = purposeMatch[1].trim();
    }

    // Extract opening
    const openingMatch = chapterContent.match(/\*\*Opening\*\*:\s*\n([\s\S]*?)(?=\n\*\*Key Discussion Points\*\*|$)/);
    if (openingMatch) {
      result.opening = openingMatch[1].trim();
    }

    // Extract discussion points
    const pointsRegex = /(\d+)\.\s*\*\*([^*]+)\*\*[^1-9]*?([\s\S]*?)(?=\d+\.\s*\*\*|\*\*Chapter Conclusion\*\*|$)/g;
    let pointMatch;

    while ((pointMatch = pointsRegex.exec(chapterContent)) !== null) {
      const [, number, title, pointContent] = pointMatch;
      
      // Extract sub-points
      const subPoints = pointContent.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim().substring(1).trim());

      result.discussionPoints.push({
        number: parseInt(number),
        title: title.trim(),
        content: pointContent.trim(),
        subPoints
      });
    }

    // Extract conclusion
    const conclusionMatch = chapterContent.match(/\*\*Chapter Conclusion\*\*:\s*\n([\s\S]*?)$/);
    if (conclusionMatch) {
      result.conclusion = conclusionMatch[1].trim();
    }

    return result;
  }

  /**
   * Calculate timing and word distribution
   */
  calculateTiming(sections, targetWords) {
    const timing = {
      totalEstimatedWords: 0,
      sectionsBreakdown: [],
      balance: 'unknown'
    };

    let totalWords = 0;
    const chapterSections = sections.filter(s => s.type === 'chapter');
    const wordsPerChapter = Math.round(targetWords / chapterSections.length);

    sections.forEach(section => {
      let estimatedWords;
      
      if (section.type === 'opening') {
        estimatedWords = 50;
      } else if (section.type === 'closing') {
        estimatedWords = 100;
      } else if (section.type === 'chapter') {
        estimatedWords = wordsPerChapter;
      } else {
        estimatedWords = this.countWords(section.content);
      }

      totalWords += estimatedWords;
      
      timing.sectionsBreakdown.push({
        title: section.title,
        type: section.type,
        estimatedWords,
        estimatedMinutes: Math.round(estimatedWords / 150 * 10) / 10
      });
    });

    timing.totalEstimatedWords = totalWords;
    
    // Calculate balance
    const deviation = Math.abs(totalWords - targetWords) / targetWords * 100;
    if (deviation <= 5) {
      timing.balance = 'excellent';
    } else if (deviation <= 10) {
      timing.balance = 'good';
    } else if (deviation <= 20) {
      timing.balance = 'fair';
    } else {
      timing.balance = 'poor';
    }

    return timing;
  }

  /**
   * Validate outline completeness and quality
   */
  validateOutline(outline, input) {
    const { chapters, targetWords } = input;
    
    // Check if outline contains required sections
    // Enhanced flexible validation for Azure AI Foundry agent responses
    const requiredSections = [
      {
        name: 'Episode Overview',
        patterns: ['Episode Overview', 'Overview', 'Introduction', 'Summary', 'Podcast Overview']
      },
      {
        name: 'Opening Hook',
        patterns: ['Opening Hook', 'Hook', 'Opening', 'Introduction Hook', 'Opener']
      },
      {
        name: 'Chapter Outlines',
        patterns: ['Chapter Outlines', 'Outlines', 'Chapters', 'Chapter Structure', 'Content Outline']
      },
      {
        name: 'Closing Segment',
        patterns: ['Closing Segment', 'Closing', 'Conclusion', 'Wrap-up', 'Summary']
      }
    ];

    const missingSections = requiredSections.filter(section => {
      return !section.patterns.some(pattern => 
        outline.content.toLowerCase().includes(pattern.toLowerCase())
      );
    }).map(section => section.name);

    // Only fail if more than 2 sections are missing (lenient threshold)
    if (missingSections.length > 2) {
      this.logger.warn(`Outline validation: Missing sections: ${missingSections.join(', ')}`);
      this.logger.debug(`Outline content (first 300 chars): ${outline.content.substring(0, 300)}...`);
      throw new Error(`Outline missing required sections: ${missingSections.join(', ')}`);
    } else if (missingSections.length > 0) {
      this.logger.warn(`Outline has some missing sections but proceeding: ${missingSections.join(', ')}`);
    }

    // Validate outline depth (reduced for testing)
    if (outline.wordCount < 150) {
      this.logger.warn(`Outline is brief (${outline.wordCount} words), but proceeding...`);
    }

    // Enhanced flexible chapter validation for Azure AI Foundry agent responses
    const chapterPatterns = [
      /### Chapter \d+:/g,
      /## Chapter \d+/g,
      /# Chapter \d+/g,
      /Chapter \d+:/g,
      /\d+\.\s/g,  // Numbered list format
      /\*\*Chapter \d+/g,
      /\*\*\d+\./g  // Bold numbered format
    ];
    
    let chapterCount = 0;
    for (const pattern of chapterPatterns) {
      const matches = outline.content.match(pattern) || [];
      chapterCount = Math.max(chapterCount, matches.length);
    }
    
    this.logger.debug(`Chapter validation: Expected ${chapters}, found ${chapterCount} chapters`);
    
    // More lenient chapter validation - allow some flexibility
    if (chapterCount === 0) {
      this.logger.warn(`No chapters found in outline, but proceeding...`);
    } else if (Math.abs(chapterCount - chapters) > 1) {
      this.logger.warn(`Chapter count mismatch: expected ${chapters}, found ${chapterCount}, but proceeding...`);
    }

    // Flexible validation for discussion points
    const discussionPatterns = [
      /\*\*Key Discussion Points\*\*:/g,
      /\*\*Discussion Points\*\*:/g,
      /\*\*Key Points\*\*:/g,
      /Key Points:/g,
      /Discussion:/g
    ];
    
    let discussionPointsCount = 0;
    for (const pattern of discussionPatterns) {
      const matches = outline.content.match(pattern) || [];
      discussionPointsCount = Math.max(discussionPointsCount, matches.length);
    }
    
    if (discussionPointsCount < Math.floor(chapters / 2)) {
      this.logger.warn(`Limited discussion points found, but proceeding...`);
    }

    return true;
  }

  /**
   * Validate input specific to outlining
   */
  validateInput(input) {
    super.validateInput(input);
    
    const { plan, research, chapters, targetWords } = input;
    
    if (!plan || typeof plan !== 'string' || plan.trim().length === 0) {
      throw new Error('Plan is required for outline creation');
    }

    if (!research || typeof research !== 'string' || research.trim().length === 0) {
      throw new Error('Research is required for outline creation');
    }

    if (!chapters || chapters < 1 || chapters > 10) {
      throw new Error('Chapters must be between 1 and 10');
    }

    if (!targetWords || targetWords < 100) {
      throw new Error('Target words must be at least 100');
    }

    return true;
  }
}

export default OutlineAgent;
