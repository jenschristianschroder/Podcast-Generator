import { BaseAgent } from './baseAgent.js';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { config } from '../config/config.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TTSAgent');

/**
 * Text-to-Speech Agent
 * Converts tone-enhanced scripts into audio files using Azure OpenAI TTS
 */
export class TTSAgent extends BaseAgent {
  constructor() {
    const systemPrompt = `You are an audio production expert specializing in text-to-speech generation. Your role is to convert tone-enhanced scripts into high-quality audio files.

This agent doesn't use chat completions but rather coordinates TTS generation and audio processing.`;

    super('TTSAgent', systemPrompt, {
      maxTokens: 1000,
      temperature: 0.1
    });
  }

  /**
   * Execute TTS generation for the entire script
   */
  async execute(input) {
    this.logger.agentStart(this.name, input);
    
    try {
      this.validateInput(input);
      
      const {
        script,
        utterances,
        chapters,
        podcastTempDir
      } = input;

      // Use podcast-specific temp directory if provided, otherwise use default
      this.tempDir = podcastTempDir || config.tempDir;
      
      this.logger.info('Using temp directory for TTS files', {
        tempDir: this.tempDir,
        isPodcastSpecific: !!podcastTempDir
      });

      // Parse utterances if not provided
      const processedUtterances = utterances || this.parseUtterancesFromScript(script);
      
      // Group utterances by chapters
      const chapterGroups = this.groupUtterancesByChapters(processedUtterances, chapters);
      
      // Generate audio for each chapter with multiple speakers
      const audioFiles = [];
      
      for (let i = 0; i < chapterGroups.length; i++) {
        const chapterUtterances = chapterGroups[i];
        const chapterAudio = await this.generateChapterAudio(chapterUtterances, i + 1);
        
        // Generate individual audio files per utterance for proper voice switching
        const utteranceAudioFiles = await this.generateUtteranceAudioFiles(chapterUtterances, i + 1);
        
        // Concatenate utterance files into chapter file
        const chapterAudioPath = await this.concatenateUtteranceAudio(utteranceAudioFiles, i + 1);
        
        chapterAudio.path = chapterAudioPath;
        chapterAudio.utteranceFiles = utteranceAudioFiles;
        
        audioFiles.push(chapterAudio);
      }

      // Calculate total statistics
      const totalDuration = audioFiles.reduce((sum, file) => sum + file.duration, 0);
      const totalUtterances = processedUtterances.length;
      const speakerStats = {
        host1: processedUtterances.filter(u => u.speaker === 'host1').length,
        host2: processedUtterances.filter(u => u.speaker === 'host2').length
      };

      const result = {
        audioFiles: audioFiles.map(file => file.path),
        metadata: {
          totalFiles: audioFiles.length,
          totalDuration,
          totalUtterances,
          voices: config.tts.voices,
          speakerDistribution: speakerStats,
          averageDurationPerUtterance: Math.round(totalDuration / totalUtterances * 100) / 100,
          chaptersGenerated: chapterGroups.length
        },
        audioDetails: audioFiles
      };

      this.logger.agentComplete(this.name, {
        audioFilesGenerated: audioFiles.length,
        totalDuration: Math.round(totalDuration),
        totalUtterances,
        speakerStats
      });

      return result;

    } catch (error) {
      this.logger.agentError(this.name, error);
      throw error;
    }
  }

  /**
   * Parse utterances from script if not provided
   */
  parseUtterancesFromScript(script) {
    const utterances = [];
    let utteranceIndex = 0;

    // Try to extract Host 1/Host 2 speaker-labeled utterances first
    const speakerRegex = /\*\*Host\s+([12])\*\*[:\s]*(?:\[([^\]]+)\])?\s*(.+?)(?=\*\*Host\s+[12]\*\*|$)/gs;
    let match;

    while ((match = speakerRegex.exec(script)) !== null) {
      const [, hostNumber, tone, text] = match;
      
      const cleanText = text
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length > 0) {
        utterances.push({
          index: utteranceIndex++,
          speaker: `host${hostNumber}`,
          tone: tone ? tone.toLowerCase().trim() : undefined,
          text: cleanText,
          wordCount: this.countSpokenWords(cleanText) // Count only spoken words
        });
      }
    }

    // If no speaker-labeled utterances found, try tone-labeled format
    if (utterances.length === 0) {
      const toneRegex = /\*\*\[([^\]]+)\]\*\*\s+(.*?)(?=\*\*\[|$)/gs;
      
      while ((match = toneRegex.exec(script)) !== null) {
        const [, tone, text] = match;
        
        const cleanText = text
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (cleanText.length > 0) {
          utterances.push({
            index: utteranceIndex++,
            speaker: utteranceIndex % 2 === 1 ? 'host1' : 'host2', // Alternate speakers
            tone: tone.toLowerCase().trim(),
            text: cleanText,
            wordCount: this.countSpokenWords(cleanText) // Count only spoken words
          });
        }
      }
    }

    // If still no utterances found, split by paragraphs and alternate speakers
    if (utterances.length === 0) {
      const paragraphs = script
        .split(/\n\s*\n/)
        .filter(p => p.trim().length > 0 && !p.startsWith('#'))
        .map(p => p.replace(/\n/g, ' ').trim());

      paragraphs.forEach((paragraph, index) => {
        utterances.push({
          index: index,
          speaker: index % 2 === 0 ? 'host1' : 'host2', // Alternate speakers
          text: paragraph,
          wordCount: this.countSpokenWords(paragraph) // Count only spoken words
        });
      });
    }

    this.logger.debug('Parsed utterances from script', {
      utterancesFound: utterances.length,
      totalWords: utterances.reduce((sum, u) => sum + u.wordCount, 0),
      host1Count: utterances.filter(u => u.speaker === 'host1').length,
      host2Count: utterances.filter(u => u.speaker === 'host2').length
    });

    return utterances;
  }

  /**
   * Group utterances by chapters
   */
  groupUtterancesByChapters(utterances, chapters) {
    const groups = [];
    const utterancesPerChapter = Math.ceil(utterances.length / chapters);

    for (let i = 0; i < chapters; i++) {
      const start = i * utterancesPerChapter;
      const end = Math.min(start + utterancesPerChapter, utterances.length);
      const chapterUtterances = utterances.slice(start, end);
      
      if (chapterUtterances.length > 0) {
        groups.push(chapterUtterances);
      }
    }

    // If we have fewer groups than chapters, create empty groups
    while (groups.length < chapters && utterances.length > 0) {
      groups.push([]);
    }

    this.logger.debug('Grouped utterances by chapters', {
      totalUtterances: utterances.length,
      chapters,
      groupSizes: groups.map(g => g.length)
    });

    return groups;
  }

  /**
   * Generate audio for a chapter
   */
  async generateChapterAudio(utterances, chapterNumber) {
    if (!utterances || utterances.length === 0) {
      throw new Error(`No utterances provided for chapter ${chapterNumber}`);
    }

    this.logger.info(`Generating audio for chapter ${chapterNumber}`, {
      utterances: utterances.length,
      totalWords: utterances.reduce((sum, u) => sum + u.wordCount, 0),
      host1Count: utterances.filter(u => u.speaker === 'host1').length,
      host2Count: utterances.filter(u => u.speaker === 'host2').length
    });

    const chapterAudioSegments = [];
    let totalDuration = 0;

    // Generate audio for each utterance with appropriate voice
    for (const utterance of utterances) {
      try {
        const voice = this.getVoiceForSpeaker(utterance.speaker);
        const audioSegment = await this.generateUtteranceAudio(utterance, chapterNumber, voice);
        chapterAudioSegments.push(audioSegment);
        totalDuration += audioSegment.duration;

        this.logger.debug(`Generated audio for utterance ${utterance.index}`, {
          speaker: utterance.speaker,
          voice,
          words: utterance.wordCount,
          duration: audioSegment.duration
        });

      } catch (error) {
        this.logger.error(`Failed to generate audio for utterance ${utterance.index}`, {
          error: error.message,
          speaker: utterance.speaker,
          utterance: utterance.text.substring(0, 50)
        });
        throw error;
      }
    }

    return {
      path: null, // Will be set after concatenation
      chapter: chapterNumber,
      utterances: utterances.length,
      wordCount: utterances.reduce((sum, u) => sum + u.wordCount, 0),
      duration: totalDuration,
      segments: chapterAudioSegments,
      speakers: {
        host1: utterances.filter(u => u.speaker === 'host1').length,
        host2: utterances.filter(u => u.speaker === 'host2').length
      }
    };
  }

  /**
   * Generate individual audio files for each utterance in a chapter
   */
  async generateUtteranceAudioFiles(utterances, chapterNumber) {
    const utteranceFiles = [];
    
    for (const utterance of utterances) {
      const voice = this.getVoiceForSpeaker(utterance.speaker);
      const audioPath = await this.generateSingleUtteranceAudio(utterance.text, utterance.index, chapterNumber, voice);
      
      utteranceFiles.push({
        path: audioPath,
        utteranceIndex: utterance.index,
        speaker: utterance.speaker,
        voice,
        duration: this.estimateAudioDuration(utterance.wordCount),
        wordCount: utterance.wordCount
      });
    }
    
    return utteranceFiles;
  }

  /**
   * Generate audio for a single utterance
   */
  async generateSingleUtteranceAudio(text, utteranceIndex, chapterNumber, voice) {
    try {
      this.logger.debug(`Generating TTS audio for utterance ${utteranceIndex}`, {
        textLength: text.length,
        voice,
        chapterNumber
      });

      // Use configured TTS speed (should be 1.0 for normal speech)
      const ttsSpeed = config.tts.speed;
      
      // Generate audio using Azure OpenAI TTS
      const audioResponse = await this.openaiService.generateSpeech(text, {
        voice,
        speed: ttsSpeed,
        responseFormat: 'mp3'
      });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `chapter-${chapterNumber}-utterance-${utteranceIndex}-${timestamp}.mp3`;
      const audioPath = join(this.tempDir, filename);

      // Save audio to file
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      await writeFile(audioPath, audioBuffer);

      this.logger.debug(`Utterance audio generated successfully`, {
        audioPath,
        audioSize: `${Math.round(audioBuffer.length / 1024)}KB`,
        utteranceIndex,
        voice
      });

      return audioPath;

    } catch (error) {
      this.logger.error(`TTS generation failed for utterance ${utteranceIndex}`, {
        error: error.message,
        textLength: text.length,
        voice
      });
      throw new Error(`TTS generation failed for utterance: ${error.message}`);
    }
  }

  /**
   * Concatenate utterance audio files into a single chapter file
   */
  async concatenateUtteranceAudio(utteranceFiles, chapterNumber) {
    const { AudioService } = await import('../services/audioService.js');
    const audioService = new AudioService();
    
    const inputPaths = utteranceFiles.map(file => file.path);
    const timestamp = Date.now();
    const outputPath = join(this.tempDir, `chapter-${chapterNumber}-combined-${timestamp}.mp3`);
    
    // Ensure temp directory exists
    const { mkdirSync, existsSync } = await import('fs');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
    
    this.logger.info(`About to concatenate audio`, {
      chapterNumber,
      inputFiles: inputPaths.length,
      outputPath,
      tempDir: this.tempDir
    });
    
    try {
      this.logger.info(`Concatenating ${inputPaths.length} utterance files for chapter ${chapterNumber}`);
      
      await audioService.concatenateAudio(inputPaths, outputPath);
      
      this.logger.info(`Chapter audio concatenation completed`, {
        chapterNumber,
        inputFiles: inputPaths.length,
        outputPath
      });
      
      return outputPath;
      
    } catch (error) {
      this.logger.error(`Failed to concatenate chapter audio`, {
        chapterNumber,
        error: error.message,
        inputFiles: inputPaths.length
      });
      throw error;
    }
  }

  /**
   * Get the appropriate voice for a speaker
   */
  getVoiceForSpeaker(speaker) {
    const voiceMap = {
      'host1': config.tts.voices.host1,
      'host2': config.tts.voices.host2
    };
    
    return voiceMap[speaker] || config.tts.voices.host1; // Default to host1 voice
  }

  /**
   * Combine utterances into TTS-optimized text
   */
  combineUtterancesForTTS(utterances) {
    let combinedText = '';

    utterances.forEach((utterance, index) => {
      // Add natural pauses between utterances
      if (index > 0) {
        combinedText += ' ... '; // Natural pause
      }

      // Some TTS models support SSML-like tone hints
      const toneHint = this.getToneHintForTTS(utterance.tone);
      combinedText += `${toneHint}${utterance.text}`;
    });

    return combinedText.trim();
  }

  /**
   * Get tone hint for TTS (if supported by the model)
   */
  getToneHintForTTS(tone) {
    // Azure OpenAI TTS doesn't currently support tone hints in the same way
    // This is prepared for future enhancement
    const toneHints = {
      'excited': '',
      'calm': '',
      'reflective': '',
      'upbeat': '',
      'serious': '',
      'humorous': '',
      'curious': '',
      'confident': '',
      'skeptical': '',
      'suspenseful': ''
    };

    return toneHints[tone] || '';
  }

  /**
   * Generate audio for a single utterance (if needed for fine control)
   */
  async generateUtteranceAudio(utterance, chapterNumber, voice) {
    const { text, tone, index } = utterance;
    
    // For now, we'll use the combined approach
    // This method is here for future fine-grained control
    
    return {
      index,
      tone,
      text: text.substring(0, 50) + '...',
      duration: this.estimateAudioDuration(utterance.wordCount),
      wordCount: utterance.wordCount
    };
  }

  /**
   * Generate single audio file for chapter
   */
  async generateSingleAudio(text, chapterNumber, voice) {
    try {
      this.logger.info(`Generating TTS audio for chapter ${chapterNumber}`, {
        textLength: text.length,
        voice,
        estimatedDuration: this.estimateAudioDuration(this.countSpokenWords(text)) // Count only spoken words
      });

      // Use configured TTS speed (should be 1.0 for normal speech)
      const ttsSpeed = config.tts.speed;
      
      // Generate audio using Azure OpenAI TTS
      const audioResponse = await this.openaiService.generateSpeech(text, {
        voice: voice || config.tts.voice,
        speed: ttsSpeed,
        responseFormat: 'mp3'
      });

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `chapter-${chapterNumber}-${timestamp}.mp3`;
      const audioPath = join(this.tempDir, filename);

      // Save audio to file
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      await writeFile(audioPath, audioBuffer);

      this.logger.info(`Audio generated successfully for chapter ${chapterNumber}`, {
        audioPath,
        audioSize: `${Math.round(audioBuffer.length / 1024)}KB`
      });

      return audioPath;

    } catch (error) {
      this.logger.error(`TTS generation failed for chapter ${chapterNumber}`, {
        error: error.message,
        textLength: text.length
      });
      throw new Error(`TTS generation failed: ${error.message}`);
    }
  }

  /**
   * Estimate audio duration based on word count
   */
  estimateAudioDuration(wordCount) {
    // Average speaking rate: 150 words per minute
    const wordsPerSecond = 150 / 60; // 2.5 words per second
    return Math.round(wordCount / wordsPerSecond * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Apply moderation before TTS generation
   */
  async moderateContent(text) {
    try {
      this.logger.debug('Moderating content before TTS', {
        textLength: text.length
      });

      const moderationResult = await this.openaiService.moderateContent(text);
      
      if (moderationResult.flagged) {
        const flaggedCategories = Object.keys(moderationResult.categories)
          .filter(cat => moderationResult.categories[cat]);
        
        this.logger.warn('Content flagged by moderation', {
          categories: flaggedCategories
        });

        throw new Error(`Content moderation failed: ${flaggedCategories.join(', ')}`);
      }

      this.logger.debug('Content moderation passed');
      return true;

    } catch (error) {
      this.logger.error('Content moderation failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Validate text for TTS generation
   */
  validateTextForTTS(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('Invalid text for TTS generation');
    }

    if (text.trim().length === 0) {
      throw new Error('Empty text provided for TTS generation');
    }

    if (text.length > 4000) {
      this.logger.warn('Text is quite long for single TTS generation', {
        textLength: text.length
      });
    }

    // Check for problematic characters or patterns
    const problematicPatterns = [
      /[^\w\s.,!?;:'"()-]/g, // Non-standard characters
      /\b(http|www)\./gi,    // URLs
      /\b\d{10,}\b/g         // Very long numbers
    ];

    problematicPatterns.forEach((pattern, index) => {
      const matches = text.match(pattern);
      if (matches) {
        this.logger.warn(`Potentially problematic content for TTS (pattern ${index + 1})`, {
          matches: matches.slice(0, 3) // Show first 3 matches
        });
      }
    });

    return true;
  }

  /**
   * Validate input specific to TTS generation
   */
  validateInput(input) {
    super.validateInput(input);
    
    const { script, chapters, voice } = input;
    
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      throw new Error('Script content is required for TTS generation');
    }

    if (!chapters || chapters < 1 || chapters > 20) {
      throw new Error('Chapters must be between 1 and 20');
    }

    if (voice && typeof voice !== 'string') {
      throw new Error('Voice must be a string');
    }

    // Validate script is suitable for TTS
    this.validateTextForTTS(script);

    return true;
  }

  /**
   * Get health status of TTS service
   */
  getHealth() {
    return {
      ...super.getHealth(),
      ttsService: 'azure-openai',
      supportedVoices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
      supportedFormats: ['mp3', 'opus', 'aac', 'flac'],
      maxTextLength: 4000
    };
  }

  /**
   * Calculate optimal TTS speed to achieve target words per minute
   */
  calculateOptimalSpeed(targetWordsPerMinute = 150) {
    // Based on empirical testing: TTS at speed 0.2 produces approximately 96 WPM
    // Calculate ratio to achieve target WPM
    const baseWPMAtSpeed02 = 96; // Empirically measured with speed 0.2
    const baseSpeed = 0.2;
    const targetSpeed = (targetWordsPerMinute / baseWPMAtSpeed02) * baseSpeed;
    
    // Clamp speed to valid range (0.25 to 4.0 for OpenAI TTS)
    const clampedSpeed = Math.max(0.25, Math.min(4.0, targetSpeed));
    
    this.logger.debug('Calculated optimal TTS speed', {
      targetWordsPerMinute,
      baseWPMAtSpeed02,
      baseSpeed,
      calculatedSpeed: targetSpeed,
      clampedSpeed
    });
    
    return clampedSpeed;
  }
}

export default TTSAgent;
