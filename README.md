# 🎙️ Multi-Agent Podcast Generator

An AI-powered podcast generation system that transforms written topics into fully-voiced podcast episodes using Azure OpenAI and a sophisticated multi-agent pipeline.

## ✨ Features

- **🤖 Multi-Agent Pipeline**: Specialized AI agents for planning, research, scripting, tone enhancement, and editing
- **🎭 Two-Host Conversations**: Dynamic dialogue between Host 1 (`alloy` voice) and Host 2 (`echo` voice)
- **🔊 High-Quality TTS**: Azure OpenAI `gpt-4o-mini-tts` for natural-sounding speech
- **📊 Accurate Duration Control**: Precise word counting ensures podcasts match target duration
- **🎨 Tone Enhancement**: Emotional expression labels for engaging, natural conversations
- **🐳 Docker Ready**: Containerized for easy deployment and scaling
- **⚡ Production Ready**: Comprehensive logging, error handling, and health monitoring

## 🚀 Quick Start

### Option 1: Using Docker (Recommended)

1. **Clone and Configure**:
   ```bash
   git clone <repository-url>
   cd Podcast-Generator
   cp .env.example .env
   # Edit .env with your Azure credentials (see Configuration section)
   ```

2. **Build and Run Container**:
   ```bash
   docker build -t multi-agent-podcast .
   docker run -d --name podcast-generator -p 3000:3000 --env-file .env multi-agent-podcast
   ```

3. **Generate Your First Podcast**:
   ```bash
   # Windows
   .\quick-generate.bat
   
   # Linux/macOS
   ./quick-generate.sh
   ```

### Option 2: Local Development

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your Azure credentials
   ```

3. **Start Server**:
   ```bash
   npm start
   ```

## 📋 Configuration

### Required Environment Variables

Create a `.env` file with your Azure credentials:

```env
# Azure AI Foundry Configuration
AZURE_AI_PROJECT_ENDPOINT=https://your-project.services.ai.azure.com/api/projects/your-project
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP_NAME=your-resource-group
AZURE_AI_PROJECT_NAME=your-project-name

# Azure OpenAI Configuration (for TTS)
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-openai-api-key

# Agent IDs (from Azure AI Foundry)
PLANNER_AGENT_ID=asst_your_planner_agent_id
RESEARCH_AGENT_ID=asst_your_research_agent_id
OUTLINE_AGENT_ID=asst_your_outline_agent_id
SCRIPT_AGENT_ID=asst_your_script_agent_id
TONE_AGENT_ID=asst_your_tone_agent_id
EDITOR_AGENT_ID=asst_your_editor_agent_id

# TTS Configuration
TTS_MODEL=gpt-4o-mini-tts
TTS_VOICE_HOST1=alloy
TTS_VOICE_HOST2=echo
TTS_SPEED=1.0
```

### Voice Options

Available OpenAI TTS voices:
- `alloy` - Neutral, balanced (Host 1 default)
- `echo` - Clear, articulate (Host 2 default) 
- `fable` - Warm, expressive
- `onyx` - Deep, authoritative
- `nova` - Bright, energetic
- `shimmer` - Soft, gentle

## 🎯 How to Generate Podcasts

### Method 1: Quick Start Scripts (Easiest)

**Windows:**
```batch
.\quick-generate.bat
```

**Linux/macOS:**
```bash
./quick-generate.sh
```

Choose from preset podcast types or create custom topics with guided prompts.

### Method 2: Command Line Tool

Use the `generate-podcast.js` script directly:

```bash
# Basic podcast
node generate-podcast.js --topic "Artificial Intelligence" --duration 5

# Advanced options
node generate-podcast.js \
  --topic "Climate Change Solutions" \
  --focus "Renewable energy and carbon capture" \
  --mood "optimistic" \
  --duration 8 \
  --chapters 4 \
  --style "conversational"
```

**Available Options:**
- `--topic` (required): Main subject of the podcast
- `--focus` (optional): Specific angle or focus area
- `--mood` (optional): `neutral`, `excited`, `calm`, `reflective` (default: `neutral`)
- `--style` (optional): `conversational`, `storytelling`, `interview` (default: `conversational`)
- `--duration` (optional): Duration in minutes, 1-120 (default: `5`)
- `--chapters` (optional): Number of chapters, 1-10 (default: `3`)

### Method 3: HTTP API

Generate podcasts programmatically using the REST API:

```bash
curl -X POST http://localhost:3000/api/v1/podcasts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "The Future of Remote Work",
    "focus": "Impact on productivity and work-life balance",
    "mood": "optimistic",
    "style": "conversational",
    "chapters": 3,
    "durationMin": 7
  }'
```

**API Response:**
```json
{
  "id": "3c2327a8-1f9a-442c-98cd-98df7a90169a",
  "status": "completed",
  "audioUrl": "/api/audio/3c2327a8-1f9a-442c-98cd-98df7a90169a.mp3",
  "metadata": {
    "duration": 420,
    "wordCount": 450,
    "chapters": 3,
    "actualWordsPerMinute": 150,
    "accuracy": "excellent"
  }
}
```

### Method 4: Configuration File (Optional)

Create a JSON configuration file for reusable settings:

```json
{
  "topic": "The Evolution of Remote Work", 
  "focus": "Impact on productivity, work-life balance, and company culture",
  "mood": "optimistic",
  "style": "conversational", 
  "chapters": 3,
  "durationMin": 7
}
```

Then generate using your config:
```bash
node generate-podcast.js --config my-config.json

# Or use the provided example:
node generate-podcast.js --config example-config.json
```

## 🔄 Agent Pipeline

The system uses a sophisticated 7-agent pipeline:

```
1. 📋 PlannerAgent     → Creates structured chapter plans
2. 🔍 ResearchAgent    → Gathers relevant facts and context  
3. 📝 OutlineAgent     → Develops detailed content outlines
4. 🎬 ScriptAgent      → Generates natural conversation scripts
5. 🎭 ToneAgent        → Adds emotional expression labels
6. ✅ EditorAgent      → Quality control and word count validation
7. 🔊 TTSAgent         → Converts to high-quality audio
```

**Key Improvements:**
- **Accurate Word Counting**: Only counts actual spoken dialogue (ignores metadata, formatting, and tone labels)
- **Dynamic TTS Speed**: Automatically calibrated for natural 150 WPM speech rate
- **Enhanced Tone System**: Rich emotional expression for engaging conversations
- **Robust Error Handling**: Comprehensive validation and retry logic

## 🎵 Output

Generated podcasts include:

- **🎧 Audio File**: High-quality MP3 with natural two-host conversation
- **📄 Result JSON**: Complete metadata and generation details
- **🎙️ Voice Distribution**: Balanced dialogue between Host 1 and Host 2
- **⏱️ Accurate Duration**: Precise timing matching your requested length

## 🔧 API Reference

### Generate Podcast
```http
POST /api/v1/podcasts/generate
Content-Type: application/json

{
  "topic": "string (required)",
  "focus": "string (optional)",
  "mood": "neutral|excited|calm|reflective (default: neutral)",
  "style": "conversational|storytelling|interview (default: conversational)",
  "chapters": "number (1-10, default: 3)",
  "durationMin": "number (1-120, default: 5)"
}
```

### Check Status
```http
GET /api/v1/podcasts/{id}/status
```

### Download Audio
```http
GET /api/v1/audio/{id}.mp3
```

### Health Check
```http
GET /api/v1/health
```

## 🐳 Docker Management

### Build and Run
```bash
# Build image
docker build -t multi-agent-podcast .

# Run container
docker run -d --name podcast-generator -p 3000:3000 --env-file .env multi-agent-podcast

# Check logs
docker logs podcast-generator

# Stop and restart
docker stop podcast-generator
docker rm podcast-generator
docker run -d --name podcast-generator -p 3000:3000 --env-file .env multi-agent-podcast
```

### Container Health
```bash
# Check container status
docker ps

# View detailed logs
docker logs -f podcast-generator

# Access container shell
docker exec -it podcast-generator sh
```

## 🔧 Azure AI Foundry Setup

### 1. Create Azure AI Foundry Project

1. Go to [Azure AI Foundry](https://ai.azure.com)
2. Create a new project or use existing
3. Note your project endpoint and details

### 2. Create Required Agents

Create 6 specialized agents in Azure AI Foundry:

- **Planner Agent**: "Creates structured chapter plans from user briefs with precise word counts"
- **Research Agent**: "Gathers relevant facts and context using BingGrounding"  
- **Outline Agent**: "Develops detailed content outlines for podcast chapters"
- **Script Agent**: "Converts outlines to natural conversational scripts between two hosts"
- **Tone Agent**: "Enhances scripts with emotional tone labels for expressive TTS"
- **Editor Agent**: "Final quality control, word count validation, and content polishing"

### 3. Configure Environment

Add the agent IDs to your `.env` file. Each agent will have an ID like `asst_xxxxxxxxxxxxxxxxx`.

**Note**: If agent IDs are not configured, the system automatically falls back to direct Azure OpenAI calls.

## 🚀 Performance

- **⚡ Generation Speed**: ~3-4 minutes for a 5-minute podcast
- **💰 Cost Efficient**: ~$0.02 per minute of generated audio
- **🎯 Accuracy**: ±5% duration accuracy with improved word counting
- **🔄 Concurrent**: Supports multiple parallel podcast generations

## 🛠️ Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run with debugging
npm run dev:debug
```

### Code Quality
```bash
# Lint code  
npm run lint

# Format code
npm run format

# Type checking
npm run typecheck
```

## 📁 Project Structure

```
Podcast-Generator/
├── 📄 README.md              # This file
├── 📄 package.json           # Dependencies and scripts
├── 📄 Dockerfile             # Container configuration
├── 📄 .env.example           # Environment template
├── 📄 generate-podcast.js    # CLI generation tool
├── 📄 quick-generate.bat     # Windows quick-start script
├── 📄 quick-generate.sh      # Linux/macOS quick-start script
├── 📄 example-config.json    # Sample configuration (optional)
├── 📁 src/                   # Core application code
│   ├── 📁 agents/            # AI agent implementations
│   ├── 📁 services/          # Business logic services
│   ├── 📁 routes/            # API route handlers
│   ├── 📁 middleware/        # Express middleware
│   ├── 📁 config/            # Configuration management
│   └── 📁 utils/             # Utility functions
├── 📁 assets/                # Audio assets (jingles, etc.)
├── 📁 temp/                  # Temporary generation files
└── 📁 output/                # Generated podcast files
```

## 🐛 Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs podcast-generator

# Verify environment variables
docker exec -it podcast-generator env | grep AZURE
```

**Audio generation fails:**
```bash
# Check TTS configuration
curl http://localhost:3000/api/v1/health

# Verify Azure OpenAI connection
```

**Word count accuracy issues:**
- The system now uses sophisticated spoken-word-only counting
- Ignores metadata, formatting, and tone instructions
- Targets 150 words per minute for natural speech

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
NODE_ENV=development
```

## 📜 License

MIT License © 2025

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

---

**Ready to generate your first podcast?** 🎙️

Run `.\quick-generate.bat` (Windows) or `./quick-generate.sh` (Linux/macOS) to get started!
