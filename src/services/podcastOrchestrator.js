import { join } from 'path';
import { writeFile } from 'fs/promises';
import { createLogger } from '../utils/logger.js';
import { config } from '../config/config.js';
import { AgentError } from '../middleware/errorHandler.js';

// Import all agents
import { PlannerAgent } from '../agents/plannerAgent.js';
import { ResearchAgent } from '../agents/researchAgent.js';
import { OutlineAgent } from '../agents/outlineAgent.js';
import { ScriptAgent } from '../agents/scriptAgent.js';
import { ToneAgent } from '../agents/toneAgent.js';
import { EditorAgent } from '../agents/editorAgent.js';
import { TTSAgent } from '../agents/ttsAgent.js';
import { AudioService } from './audioService.js';
import { ContentFetcher } from './contentFetcher.js';

const logger = createLogger('PodcastOrchestrator');

/**
 * Orchestrates the multi-agent pipeline for podcast generation
 * Manages the flow from brief to final audio file
 */
export class PodcastOrchestrator {
  constructor() {
    this.agents = {
      planner: new PlannerAgent(),
      research: new ResearchAgent(),
      outline: new OutlineAgent(),
      script: new ScriptAgent(),
      tone: new ToneAgent(),
      editor: new EditorAgent(),
      tts: new TTSAgent()
    };
    
    this.audioService = new AudioService();
    this.contentFetcher = new ContentFetcher();
    this.activeGenerations = new Map();
  }

  /**
   * Main orchestration method
   * Coordinates all agents to generate a complete podcast
   */
  async generatePodcast(request, progressCallback = null) {
    const { id, topic, focus, mood, style, chapters, durationMin, source } = request;
    
    logger.agentStart('Orchestrator', { id, topic: topic.substring(0, 50) });
    
    const startTime = Date.now();
    const artifacts = {};
    
    // Create podcast-specific temporary directory
    logger.debug('Config tempDir check', { tempDir: config.tempDir });
    
    if (!config.tempDir) {
      throw new Error('config.tempDir is not defined');
    }
    
    const podcastTempDir = join(config.tempDir, id);
    const { mkdirSync, existsSync } = await import('fs');
    if (!existsSync(podcastTempDir)) {
      mkdirSync(podcastTempDir, { recursive: true });
    }
    
    logger.info('Created podcast-specific temp directory', {
      podcastId: id,
      tempDir: podcastTempDir
    });
    
    try {
      // Step 1: Planning
      await this.updateProgress(progressCallback, 'planning', 1, 7);
      
      const planningInput = {
        topic,
        focus,
        chapters,
        durationMin,
        mood,
        style,
        targetWords: Math.round(durationMin * config.performance.wordsPerMinute)
      };
      
      logger.agentStart('PlannerAgent', planningInput);
      const plan = await this.agents.planner.execute(planningInput);
      artifacts.plan = plan;
      logger.agentComplete('PlannerAgent', { chaptersPlanned: plan.chapters?.length });

      // Step 2: Content Fetching & Research
      await this.updateProgress(progressCallback, 'research', 2, 7);
      
      let sourceContent = null;
      let research = null;
      
      if (source) {
        // Fetch and use source content for grounding
        logger.debug('Fetching source content for grounding', { source: source.substring(0, 100) });
        try {
          sourceContent = await this.contentFetcher.fetchContent(source);
          artifacts.sourceContent = sourceContent;
          
          // Use source content as primary research material
          research = {
            content: `# Research Based on Source Material\n\n## Source: ${sourceContent.title}\n\n${sourceContent.content}`,
            sources: [sourceContent.source],
            wordCount: sourceContent.wordCount,
            metadata: {
              sourceProvided: true,
              sourceWordCount: sourceContent.wordCount,
              sourceTitle: sourceContent.title
            }
          };
          
          logger.agentComplete('ContentFetcher', { 
            wordCount: sourceContent.wordCount,
            title: sourceContent.title 
          });
        } catch (error) {
          logger.error('Failed to fetch source content, falling back to standard research', { error: error.message });
          // Fall back to standard research if source fetching fails
          sourceContent = null;
        }
      }
      
      if (!sourceContent) {
        // Standard research when no source provided or source fetching failed
        const researchInput = {
          topic,
          focus,
          plan: plan.content,
          chapters: plan.chapters,
          source
        };
        
        logger.agentStart('ResearchAgent', researchInput);
        research = await this.agents.research.execute(researchInput);
        logger.agentComplete('ResearchAgent', { sourcesFound: research.sources?.length });
      }
      
      artifacts.research = research;

      // Step 3: Outline
      await this.updateProgress(progressCallback, 'outlining', 3, 7);
      
      const outlineInput = {
        plan: plan.content,
        research: research.content,
        chapters,
        targetWords: planningInput.targetWords,
        style
      };
      
      logger.agentStart('OutlineAgent', outlineInput);
      const outline = await this.agents.outline.execute(outlineInput);
      artifacts.outline = outline;
      logger.agentComplete('OutlineAgent', { sections: outline.sections?.length });

      // Step 4: Script Generation (parallel for chapters)
      await this.updateProgress(progressCallback, 'scripting', 4, 7);
      
      logger.agentStart('ScriptAgent', { chapters: outline.sections?.length });
      const scripts = await this.generateScriptsInParallel(outline, planningInput);
      artifacts.scripts = scripts;
      logger.agentComplete('ScriptAgent', { scriptsGenerated: scripts.length });

      // Step 5: Tone Enhancement
      await this.updateProgress(progressCallback, 'tone-enhancement', 5, 7);
      
      const toneInput = {
        scripts,
        mood,
        style,
        targetTones: config.availableTones
      };
      
      logger.agentStart('ToneAgent', toneInput);
      const toneEnhancedScript = await this.agents.tone.execute(toneInput);
      artifacts.toneScript = toneEnhancedScript;
      logger.agentComplete('ToneAgent', { utterances: toneEnhancedScript.utterances?.length });

      // Step 6: Editorial Review
      await this.updateProgress(progressCallback, 'editing', 6, 7);
      
      const editorInput = {
        script: toneEnhancedScript.content,
        targetWords: planningInput.targetWords,
        tolerance: config.performance.tolerancePercent,
        style,
        mood
      };
      
      logger.agentStart('EditorAgent', editorInput);
      const finalScript = await this.agents.editor.execute(editorInput);
      artifacts.finalScript = finalScript;
      logger.agentComplete('EditorAgent', { finalWordCount: finalScript.wordCount });

      // Step 7: Text-to-Speech Generation
      await this.updateProgress(progressCallback, 'audio-generation', 7, 7);
      
      const ttsInput = {
        script: finalScript.content,
        utterances: toneEnhancedScript.utterances,
        chapters: finalScript.chapters || chapters,
        podcastTempDir: podcastTempDir
      };
      
      logger.agentStart('TTSAgent', ttsInput);
      const audioFiles = await this.agents.tts.execute(ttsInput);
      artifacts.audioFiles = audioFiles;
      logger.agentComplete('TTSAgent', { 
        audioFilesGenerated: audioFiles.audioFiles.length,
        speakerDistribution: audioFiles.metadata.speakerDistribution 
      });

      // Step 8: Audio Concatenation with Jingle
      await this.updateProgress(progressCallback, 'audio-stitching', 7, 7);
      
      // Add jingle at the beginning
      const jinglePath = join(process.cwd(), 'assets', 'jingle.mp3');
      let audioFilesWithJingle = [...audioFiles.audioFiles];
      
      // Check if jingle exists and add it to the beginning
      try {
        const { existsSync } = await import('fs');
        if (existsSync(jinglePath)) {
          audioFilesWithJingle = [jinglePath, ...audioFiles.audioFiles];
          logger.info('Adding jingle to podcast', {
            jinglePath,
            chapterFiles: audioFiles.audioFiles.length,
            totalFiles: audioFilesWithJingle.length
          });
        } else {
          logger.warn('Jingle file not found, proceeding without jingle', { jinglePath });
        }
      } catch (error) {
        logger.warn('Error checking jingle file, proceeding without jingle', { 
          jinglePath, 
          error: error.message 
        });
      }
      
      const finalAudioPath = join(config.audioOutputDir, `${id}.mp3`);
      await this.audioService.concatenateAudio(audioFilesWithJingle, finalAudioPath);
      
      // Calculate final metadata
      const totalDuration = await this.audioService.getAudioDuration(finalAudioPath);
      const actualWordsPerMinute = Math.round(finalScript.wordCount / (totalDuration / 60));
      
      const metadata = {
        id,
        duration: totalDuration,
        wordCount: finalScript.wordCount,
        chapters: finalScript.chapters?.length || chapters,
        actualWordsPerMinute,
        targetWordsPerMinute: config.performance.wordsPerMinute,
        accuracy: this.calculateAccuracy(planningInput.targetWords, finalScript.wordCount),
        generationTime: Date.now() - startTime,
        topic: topic.substring(0, 100),
        mood,
        style
      };

      // Save artifacts to disk
      await this.saveArtifacts(id, artifacts);

      // Clean up podcast-specific temp directory
      await this.cleanupPodcastTempDir(podcastTempDir);

      logger.agentComplete('Orchestrator', {
        duration: totalDuration,
        wordCount: finalScript.wordCount,
        accuracy: metadata.accuracy
      });

      return {
        id,
        audioPath: finalAudioPath,
        artifacts,
        metadata
      };

    } catch (error) {
      logger.agentError('Orchestrator', error);
      
      // Clean up any partial files and podcast temp directory
      await this.cleanup(id);
      await this.cleanupPodcastTempDir(podcastTempDir);
      
      throw new AgentError(
        `Podcast generation failed: ${error.message}`,
        'Orchestrator',
        error
      );
    }
  }

  /**
   * Generate scripts for chapters in parallel
   */
  async generateScriptsInParallel(outline, planningInput) {
    const { sections } = outline;
    const maxConcurrent = config.performance.maxConcurrentAgents;
    
    if (!sections || sections.length === 0) {
      throw new Error('No sections found in outline');
    }

    const scripts = [];
    const batches = this.createBatches(sections, maxConcurrent);

    for (const batch of batches) {
      const batchPromises = batch.map(async (section, index) => {
        const scriptInput = {
          section: section.content,
          chapterNumber: section.number || index + 1,
          targetWords: Math.round(planningInput.targetWords / sections.length),
          style: planningInput.style,
          context: outline.content
        };

        return await this.agents.script.execute(scriptInput);
      });

      const batchResults = await Promise.all(batchPromises);
      scripts.push(...batchResults);
    }

    return scripts;
  }

  /**
   * Create batches for parallel processing
   */
  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Update progress and call progress callback
   */
  async updateProgress(progressCallback, step, completed, total) {
    const progress = {
      step,
      completed,
      total,
      percentage: Math.round((completed / total) * 100),
      estimatedCompletion: this.estimateCompletion(completed, total)
    };

    if (progressCallback) {
      progressCallback(step, progress);
    }

    logger.debug('Progress update', progress);
  }

  /**
   * Estimate completion time
   */
  estimateCompletion(completed, total) {
    if (completed === 0) return null;
    
    const avgTimePerStep = 8000; // 8 seconds per step average
    const remainingSteps = total - completed;
    const estimatedMs = remainingSteps * avgTimePerStep;
    
    return new Date(Date.now() + estimatedMs).toISOString();
  }

  /**
   * Calculate word count accuracy
   */
  calculateAccuracy(target, actual) {
    const tolerance = config.performance.tolerancePercent;
    const difference = Math.abs(target - actual);
    const percentDifference = (difference / target) * 100;
    
    if (percentDifference <= tolerance) {
      return 'excellent';
    } else if (percentDifference <= tolerance * 2) {
      return 'good';
    } else if (percentDifference <= tolerance * 3) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Save all artifacts to disk
   */
  async saveArtifacts(id, artifacts) {
    try {
      const artifactsPath = join(config.audioOutputDir, `${id}-artifacts.json`);
      const artifactsData = {
        id,
        timestamp: new Date().toISOString(),
        artifacts: {
          plan: artifacts.plan?.content,
          research: artifacts.research?.content,
          outline: artifacts.outline?.content,
          scripts: artifacts.scripts?.map(s => s.content),
          toneScript: artifacts.toneScript?.content,
          finalScript: artifacts.finalScript?.content
        }
      };

      await writeFile(artifactsPath, JSON.stringify(artifactsData, null, 2));
      logger.debug('Artifacts saved', { path: artifactsPath });

    } catch (error) {
      logger.warn('Failed to save artifacts', { error: error.message });
      // Don't fail the entire process for artifact saving
    }
  }

  /**
   * Clean up partial files on failure
   */
  async cleanup(id) {
    try {
      const { unlink } = await import('fs/promises');
      const { existsSync } = await import('fs');
      
      const filesToClean = [
        join(config.audioOutputDir, `${id}.mp3`),
        join(config.audioOutputDir, `${id}-artifacts.json`),
        join(config.tempDir, `${id}-*.mp3`)
      ];

      for (const filePath of filesToClean) {
        if (existsSync(filePath)) {
          await unlink(filePath);
          logger.debug('Cleaned up file', { path: filePath });
        }
      }

    } catch (error) {
      logger.warn('Cleanup failed', { error: error.message });
    }
  }

  /**
   * Clean up podcast-specific temporary directory
   */
  async cleanupPodcastTempDir(podcastTempDir) {
    try {
      const { rmSync, existsSync } = await import('fs');
      
      if (existsSync(podcastTempDir)) {
        rmSync(podcastTempDir, { recursive: true, force: true });
        logger.info('Cleaned up podcast temp directory', { 
          tempDir: podcastTempDir 
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup podcast temp directory', { 
        tempDir: podcastTempDir,
        error: error.message 
      });
    }
  }

  /**
   * Get orchestrator health status
   */
  getHealth() {
    const agentHealth = {};
    
    for (const [name, agent] of Object.entries(this.agents)) {
      agentHealth[name] = agent.getHealth?.() || { status: 'unknown' };
    }

    return {
      status: 'healthy',
      activeGenerations: this.activeGenerations.size,
      agents: agentHealth,
      audioService: this.audioService.getHealth?.() || { status: 'unknown' }
    };
  }
}

export default PodcastOrchestrator;
