#!/usr/bin/env node

/**
 * Podcast Generator Script
 * 
 * Easy-to-use script for generating podcasts with the Multi-Agent Podcast Generator
 * 
 * Usage:
 *   node generate-podcast.js
 *   node generate-podcast.js --topic "Your Topic" --duration 5
 *   node generate-podcast.js --config custom-config.json
 */

import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

// Default podcast configuration
const defaultConfig = {
  topic: "The Future of Artificial Intelligence",
  focus: "Impact on daily life and work automation",
  mood: "excited",
  style: "conversational", 
  chapters: 3,
  durationMin: 5
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = { ...defaultConfig };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--topic':
        config.topic = args[++i] || "";
        break;
      case '--focus':
        config.focus = args[++i] || "";
        break;
      case '--mood':
        const validMoods = ['neutral', 'excited', 'calm', 'reflective', 'enthusiastic'];
        const mood = args[++i] || "excited";
        config.mood = validMoods.includes(mood) ? mood : "excited";
        if (!validMoods.includes(mood)) {
          console.log(`⚠️  Warning: '${mood}' is not a valid mood. Using 'excited' instead.`);
          console.log(`   Valid moods: ${validMoods.join(', ')}`);
        }
        break;
      case '--style':
        config.style = args[++i] || "conversational";
        break;
      case '--chapters':
        config.chapters = parseInt(args[++i]) || 3;
        break;
      case '--duration':
        config.durationMin = parseInt(args[++i]) || 5;
        break;
      case '--source':
        config.source = args[++i] || "";
        break;
      case '--config':
        const configFile = args[++i];
        if (configFile && fs.existsSync(configFile)) {
          const fileConfig = JSON.parse(fs.readFileSync(configFile, 'utf8'));
          Object.assign(config, fileConfig);
        }
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }
  
  // Validate required fields
  if (!config.topic || config.topic.trim() === '') {
    console.error('❌ Error: Topic is required');
    console.log('Use --topic "Your Topic Here" or run with --help for usage');
    process.exit(1);
  }
  
  return config;
}

function showHelp() {
  console.log(`
🎙️ Multi-Agent Podcast Generator

Usage:
  node generate-podcast.js [options]

Options:
  --topic <string>     Topic for the podcast (required)
  --focus <string>     Specific focus or angle
  --source <string>    Source URL or file path for content grounding
  --mood <string>      Overall mood (neutral, excited, calm, reflective, enthusiastic)
  --style <string>     Conversation style (conversational, storytelling)
  --chapters <number>  Number of chapters (1-10)
  --duration <number>  Duration in minutes (1-120)
  --config <file>      Load configuration from JSON file
  --help              Show this help message

Examples:
  node generate-podcast.js --topic "Climate Change" --duration 8
  node generate-podcast.js --topic "Space Exploration" --mood reflective --chapters 4
  node generate-podcast.js --config my-podcast.json

Valid Moods: neutral, excited, calm, reflective, enthusiastic
Valid Styles: conversational, storytelling
  `);
}

async function generatePodcast() {
  try {
    console.log('🎙️ Starting Multi-Agent Podcast Generator...\n');
    
    const config = parseArgs();
    const podcastId = uuidv4();
    
    // Add unique ID to config
    config.id = podcastId;
    
    console.log('📝 Podcast Configuration:');
    console.log(`   ID: ${podcastId}`);
    console.log(`   Topic: ${config.topic}`);
    console.log(`   Focus: ${config.focus}`);
    console.log(`   Mood: ${config.mood}`);
    console.log(`   Style: ${config.style}`);
    console.log(`   Chapters: ${config.chapters}`);
    console.log(`   Duration: ${config.durationMin} minutes\n`);
    
    // Check if running in container or locally
    const isContainer = process.env.NODE_ENV === 'production' || process.env.CONTAINER === 'true';
    const baseUrl = isContainer ? 'http://localhost:3000' : 'http://localhost:3000';
    
    console.log('🚀 Sending request to podcast generator...');
    
    // Make request to the API
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ HTTP Error ${response.status}:`, errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    console.log('✅ Podcast generation started!');
    console.log(`📊 Generation ID: ${result.id}`);
    
    if (result.audioUrl) {
      console.log(`🎵 Audio will be available at: ${baseUrl}${result.audioUrl}`);
    }
    
    // Poll for completion
    console.log('\n⏳ Waiting for podcast generation to complete...');
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      try {
        const statusResponse = await fetch(`${baseUrl}/api/status/${result.id}`);
        const status = await statusResponse.json();
        
        if (status.status === 'completed') {
          console.log('\n🎉 Podcast generation completed!');
          console.log(`🎵 Audio file: ${baseUrl}/api/audio/${result.id}.mp3`);
          
          if (status.metadata) {
            console.log(`⏱️  Duration: ${Math.round(status.metadata.duration)} seconds`);
            console.log(`📝 Word count: ${status.metadata.wordCount} words`);
          }
          
          // Save result information to file
          const resultFile = `podcast-${result.id}.json`;
          fs.writeFileSync(resultFile, JSON.stringify({
            id: result.id,
            config,
            status,
            audioUrl: `${baseUrl}/api/audio/${result.id}.mp3`,
            generatedAt: new Date().toISOString()
          }, null, 2));
          
          console.log(`📄 Result saved to: ${resultFile}`);
          break;
        } else if (status.status === 'failed') {
          console.error('❌ Podcast generation failed:', status.error);
          process.exit(1);
        } else {
          process.stdout.write('.');
        }
        
        attempts++;
      } catch (error) {
        console.error('\n❌ Error checking status:', error.message);
        break;
      }
    }
    
    if (attempts >= maxAttempts) {
      console.log('\n⏰ Timeout waiting for completion. Check status manually.');
      console.log(`   Status URL: ${baseUrl}/api/status/${result.id}`);
    }
    
  } catch (error) {
    console.error('❌ Error generating podcast:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure the podcast generator server is running:');
      console.log('   Docker: docker run -p 3000:3000 --env-file .env multi-agent-podcast');
      console.log('   Local:  npm start');
    }
    
    process.exit(1);
  }
}

// Run the generator
generatePodcast();
