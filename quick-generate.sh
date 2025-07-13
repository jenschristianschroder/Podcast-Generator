#!/bin/bash

# Quick Podcast Generator Script
# This script provides easy presets for common podcast types

echo "🎙️  Multi-Agent Podcast Generator - Quick Start"
echo ""
echo "Choose a podcast type:"
echo "1) Tech News (5 min)"
echo "2) AI & Future (8 min)" 
echo "3) Business Trends (6 min)"
echo "4) Science Discovery (10 min)"
echo "5) Custom Topic"
echo ""

read -p "Enter choice (1-5): " choice

case $choice in
  1)
    echo "🔧 Generating Tech News podcast..."
    node generate-podcast.js \
      --topic "Latest Technology Trends" \
      --focus "AI, blockchain, and emerging technologies" \
      --mood "excited" \
      --duration 5 \
      --chapters 3
    ;;
  2)
    echo "🤖 Generating AI & Future podcast..."
    node generate-podcast.js \
      --topic "The Future of Artificial Intelligence" \
      --focus "Impact on society, jobs, and daily life" \
      --mood "excited" \
      --duration 8 \
      --chapters 4
    ;;
  3)
    echo "💼 Generating Business Trends podcast..."
    node generate-podcast.js \
      --topic "Modern Business Innovation" \
      --focus "Digital transformation and startup culture" \
      --mood "neutral" \
      --duration 6 \
      --chapters 3
    ;;
  4)
    echo "🔬 Generating Science Discovery podcast..."
    node generate-podcast.js \
      --topic "Recent Scientific Breakthroughs" \
      --focus "Space exploration, medicine, and climate science" \
      --mood "reflective" \
      --duration 10 \
      --chapters 5
    ;;
  5)
    echo ""
    read -p "Enter your topic: " topic
    read -p "Enter focus/angle: " focus
    read -p "Duration (minutes): " duration
    
    echo "🎯 Generating custom podcast..."
    node generate-podcast.js \
      --topic "$topic" \
      --focus "$focus" \
      --duration "$duration" \
      --mood "excited"
    ;;
  *)
    echo "❌ Invalid choice. Please run again."
    exit 1
    ;;
esac
