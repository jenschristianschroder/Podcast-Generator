import ffmpeg from 'fluent-ffmpeg';
import { join, normalize } from 'path';
import { existsSync, createReadStream, mkdirSync } from 'fs';
import { access, constants } from 'fs/promises';
import { createLogger } from '../utils/logger.js';
import { config } from '../config/config.js';

const logger = createLogger('AudioService');

/**
 * Audio processing service using FFmpeg
 * Handles audio concatenation, format conversion, and metadata extraction
 */
export class AudioService {
  constructor() {
    this.validateFFmpeg();
  }

  /**
   * Validate FFmpeg installation
   */
  validateFFmpeg() {
    try {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          logger.error('FFmpeg validation failed', { error: err.message });
          throw new Error('FFmpeg is not properly installed or configured');
        }
        
        logger.debug('FFmpeg validation successful', {
          formatsAvailable: Object.keys(formats).length
        });
      });
    } catch (error) {
      logger.error('FFmpeg not available', { error: error.message });
      throw error;
    }
  }

  /**
   * Concatenate multiple audio files into a single file
   */
  async concatenateAudio(audioFiles, outputPath) {
    if (!audioFiles || audioFiles.length === 0) {
      throw new Error('No audio files provided for concatenation');
    }

    // Normalize the output path for Windows compatibility
    const normalizedOutputPath = normalize(outputPath);
    
    // Ensure output directory exists
    const outputDir = join(normalizedOutputPath, '..');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    logger.info('Starting audio concatenation', {
      inputFiles: audioFiles.length,
      outputPath: normalizedOutputPath
    });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let command = ffmpeg();

      // Add all input files
      audioFiles.forEach((filePath, index) => {
        if (!existsSync(filePath)) {
          reject(new Error(`Audio file not found: ${filePath}`));
          return;
        }
        command = command.input(filePath);
        logger.debug(`Added input file ${index + 1}`, { path: filePath });
      });

      // Configure concatenation
      command
        .on('start', (commandLine) => {
          logger.debug('FFmpeg command started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('Concatenation progress', {
            percent: progress.percent,
            currentTime: progress.timemark
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('Audio concatenation failed', {
            error: err.message,
            stdout,
            stderr,
            outputPath: normalizedOutputPath,
            inputFiles: audioFiles
          });
          reject(new Error(`Audio concatenation failed: ${err.message}`));
        })
        .on('end', () => {
          const duration = Date.now() - startTime;
          logger.info('Audio concatenation completed', {
            outputPath: normalizedOutputPath,
            duration: `${duration}ms`,
            inputFiles: audioFiles.length
          });
          resolve(normalizedOutputPath);
        })
        // Set output format and codec - simplified
        .audioCodec('libmp3lame')
        // Simple concatenation filter
        .complexFilter([
          {
            filter: 'concat',
            options: {
              n: audioFiles.length,
              v: 0,
              a: 1
            },
            outputs: 'out'
          }
        ])
        .outputOptions(['-map', '[out]'])
        .save(normalizedOutputPath);
    });
  }

  /**
   * Get audio file duration in seconds
   */
  async getAudioDuration(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('Failed to get audio duration', {
            filePath,
            error: err.message
          });
          reject(new Error(`Failed to get audio duration: ${err.message}`));
          return;
        }

        const duration = metadata.format.duration;
        logger.debug('Audio duration retrieved', {
          filePath,
          duration: `${duration}s`
        });

        resolve(parseFloat(duration));
      });
    });
  }

  /**
   * Get detailed audio metadata
   */
  async getAudioMetadata(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Audio file not found: ${filePath}`);
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          logger.error('Failed to get audio metadata', {
            filePath,
            error: err.message
          });
          reject(new Error(`Failed to get audio metadata: ${err.message}`));
          return;
        }

        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        
        const result = {
          duration: parseFloat(metadata.format.duration),
          bitrate: parseInt(metadata.format.bit_rate),
          size: parseInt(metadata.format.size),
          format: metadata.format.format_name,
          codec: audioStream?.codec_name,
          sampleRate: audioStream?.sample_rate,
          channels: audioStream?.channels,
          tags: metadata.format.tags || {}
        };

        logger.debug('Audio metadata retrieved', {
          filePath,
          duration: result.duration,
          codec: result.codec,
          bitrate: result.bitrate
        });

        resolve(result);
      });
    });
  }

  /**
   * Convert audio format
   */
  async convertAudio(inputPath, outputPath, options = {}) {
    if (!existsSync(inputPath)) {
      throw new Error(`Input audio file not found: ${inputPath}`);
    }

    const defaultOptions = {
      codec: 'libmp3lame',
      bitrate: 128,
      frequency: 44100,
      channels: 2,
      ...options
    };

    logger.info('Starting audio conversion', {
      inputPath,
      outputPath,
      options: defaultOptions
    });

    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      ffmpeg(inputPath)
        .on('start', (commandLine) => {
          logger.debug('Audio conversion started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('Conversion progress', {
            percent: progress.percent,
            currentTime: progress.timemark
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('Audio conversion failed', {
            error: err.message,
            stdout,
            stderr
          });
          reject(new Error(`Audio conversion failed: ${err.message}`));
        })
        .on('end', () => {
          const duration = Date.now() - startTime;
          logger.info('Audio conversion completed', {
            outputPath,
            duration: `${duration}ms`
          });
          resolve(outputPath);
        })
        .audioCodec(defaultOptions.codec)
        .audioBitrate(defaultOptions.bitrate)
        .audioFrequency(defaultOptions.frequency)
        .audioChannels(defaultOptions.channels)
        .save(outputPath);
    });
  }

  /**
   * Add fade effects to audio
   */
  async addFadeEffects(inputPath, outputPath, fadeInDuration = 0.5, fadeOutDuration = 0.5) {
    if (!existsSync(inputPath)) {
      throw new Error(`Input audio file not found: ${inputPath}`);
    }

    logger.info('Adding fade effects', {
      inputPath,
      outputPath,
      fadeIn: fadeInDuration,
      fadeOut: fadeOutDuration
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('error', (err) => {
          logger.error('Fade effects failed', { error: err.message });
          reject(new Error(`Fade effects failed: ${err.message}`));
        })
        .on('end', () => {
          logger.info('Fade effects completed', { outputPath });
          resolve(outputPath);
        })
        .audioFilters([
          `afade=t=in:ss=0:d=${fadeInDuration}`,
          `afade=t=out:st=-${fadeOutDuration}:d=${fadeOutDuration}`
        ])
        .save(outputPath);
    });
  }

  /**
   * Normalize audio levels
   */
  async normalizeAudio(inputPath, outputPath, targetLUFS = -23) {
    if (!existsSync(inputPath)) {
      throw new Error(`Input audio file not found: ${inputPath}`);
    }

    logger.info('Normalizing audio', {
      inputPath,
      outputPath,
      targetLUFS
    });

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('error', (err) => {
          logger.error('Audio normalization failed', { error: err.message });
          reject(new Error(`Audio normalization failed: ${err.message}`));
        })
        .on('end', () => {
          logger.info('Audio normalization completed', { outputPath });
          resolve(outputPath);
        })
        .audioFilters([
          `loudnorm=I=${targetLUFS}:TP=-1:LRA=7:measured_I=-30:measured_LRA=7:measured_TP=-1`
        ])
        .save(outputPath);
    });
  }

  /**
   * Create audio silence
   */
  async createSilence(duration, outputPath) {
    logger.info('Creating silence', {
      duration: `${duration}s`,
      outputPath
    });

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(`anullsrc=channel_layout=stereo:sample_rate=44100`)
        .inputFormat('lavfi')
        .duration(duration)
        .on('error', (err) => {
          logger.error('Silence creation failed', { error: err.message });
          reject(new Error(`Silence creation failed: ${err.message}`));
        })
        .on('end', () => {
          logger.info('Silence created', { outputPath });
          resolve(outputPath);
        })
        .audioCodec('libmp3lame')
        .save(outputPath);
    });
  }

  /**
   * Validate audio file integrity
   */
  async validateAudioFile(filePath) {
    try {
      await access(filePath, constants.F_OK);
      const metadata = await this.getAudioMetadata(filePath);
      
      const isValid = metadata.duration > 0 && 
                     metadata.codec && 
                     metadata.sampleRate > 0;

      logger.debug('Audio file validation', {
        filePath,
        isValid,
        duration: metadata.duration,
        codec: metadata.codec
      });

      return {
        valid: isValid,
        metadata
      };

    } catch (error) {
      logger.warn('Audio file validation failed', {
        filePath,
        error: error.message
      });

      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Get service health status
   */
  getHealth() {
    try {
      // Test FFmpeg availability
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) throw err;
      });

      return {
        status: 'healthy',
        ffmpegAvailable: true,
        supportedFormats: ['mp3', 'wav', 'aac', 'ogg']
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        ffmpegAvailable: false,
        error: error.message
      };
    }
  }
}

export default AudioService;
