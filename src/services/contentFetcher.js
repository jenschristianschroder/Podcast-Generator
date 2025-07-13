import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { readFile } from 'fs/promises';
import { extname } from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('ContentFetcher');

/**
 * Content Fetcher Service
 * Handles fetching and extracting content from various sources (URLs, files)
 */
export class ContentFetcher {
  constructor() {
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Fetch content from a source (URL or file path)
   */
  async fetchContent(source) {
    if (!source) {
      return null;
    }

    logger.info('Fetching content from source', { source: source.substring(0, 100) });

    try {
      if (this.isUrl(source)) {
        return await this.fetchFromUrl(source);
      } else {
        return await this.fetchFromFile(source);
      }
    } catch (error) {
      logger.error('Failed to fetch content', { source, error: error.message });
      throw new Error(`Failed to fetch content from ${source}: ${error.message}`);
    }
  }

  /**
   * Check if source is a URL
   */
  isUrl(source) {
    try {
      new URL(source);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fetch content from URL
   */
  async fetchFromUrl(url) {
    logger.debug('Fetching from URL', { url });

    const response = await fetch(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PodcastGenerator/1.0; +https://example.com/bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const html = await response.text();

    if (contentType.includes('text/html')) {
      return this.extractFromHtml(html, url);
    } else if (contentType.includes('text/plain') || contentType.includes('text/markdown')) {
      return {
        title: this.extractTitleFromUrl(url),
        content: html,
        source: url,
        wordCount: this.countWords(html)
      };
    } else {
      throw new Error(`Unsupported content type: ${contentType}`);
    }
  }

  /**
   * Extract readable content from HTML
   */
  extractFromHtml(html, url) {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, nav, header, footer, aside, .advertisement, .ad, .sidebar').remove();
    
    // Try to find the main content
    let content = '';
    let title = '';

    // Extract title
    title = $('title').text().trim() || 
            $('h1').first().text().trim() || 
            this.extractTitleFromUrl(url);

    // Try different content extraction strategies
    const contentSelectors = [
      'main',
      'article', 
      '.content',
      '.post-content',
      '.entry-content', 
      '.article-content',
      '[role="main"]',
      '#content',
      '#main'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0 && element.text().trim().length > 100) {
        content = element.text().trim();
        break;
      }
    }

    // Fallback: extract from body
    if (!content || content.length < 100) {
      $('body').find('h1, h2, h3, h4, h5, h6, p, div, span').each((_, element) => {
        const text = $(element).text().trim();
        if (text.length > 20) {
          content += text + '\n\n';
        }
      });
    }

    // Clean up content
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    if (content.length < 100) {
      throw new Error('Insufficient content extracted from URL');
    }

    return {
      title,
      content,
      source: url,
      wordCount: this.countWords(content)
    };
  }

  /**
   * Fetch content from local file
   */
  async fetchFromFile(filePath) {
    logger.debug('Fetching from file', { filePath });

    const content = await readFile(filePath, 'utf-8');
    const extension = extname(filePath).toLowerCase();
    
    let processedContent = content;
    let title = '';

    // Extract title from markdown files
    if (extension === '.md' || extension === '.markdown') {
      const titleMatch = content.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1].trim() : '';
    }

    // For other text files, try to extract first line as title
    if (!title) {
      const firstLine = content.split('\n')[0].trim();
      if (firstLine.length > 0 && firstLine.length < 100) {
        title = firstLine;
      }
    }

    return {
      title: title || filePath,
      content: processedContent,
      source: filePath,
      wordCount: this.countWords(processedContent)
    };
  }

  /**
   * Extract title from URL
   */
  extractTitleFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      
      // Extract meaningful part from path
      const parts = pathname.split('/').filter(part => part.length > 0);
      if (parts.length > 0) {
        return parts[parts.length - 1]
          .replace(/[-_]/g, ' ')
          .replace(/\.(html?|php|aspx?)$/i, '')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
      
      return urlObj.hostname;
    } catch {
      return 'Unknown Title';
    }
  }

  /**
   * Count words in text
   */
  countWords(text) {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Validate and sanitize fetched content
   */
  validateContent(content) {
    if (!content || !content.content) {
      throw new Error('No content extracted');
    }

    if (content.wordCount < 50) {
      throw new Error('Content too short (minimum 50 words required)');
    }

    if (content.wordCount > 50000) {
      logger.warn('Content very long, may need summarization', { 
        wordCount: content.wordCount 
      });
    }

    return content;
  }
}
