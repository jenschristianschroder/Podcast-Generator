# Azure AI Foundry Integration Guide

## 🎯 Overview

The Multi-Agent Podcast Generator now includes full Azure AI Foundry integration with intelligent fallback to Azure OpenAI. This provides:

- **Primary Mode**: Azure AI Foundry specialized agents
- **Fallback Mode**: Azure OpenAI with local agent definitions
- **Automatic Detection**: Seamless switching based on configuration
- **Production Ready**: Enterprise-grade error handling and retry logic

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Request                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  BaseAgent                                   │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │          Agent ID Available?                             │ │
│  └─────────────────┬──────────────────┬────────────────────┘ │
│                    │ Yes              │ No                   │
│                    ▼                  ▼                      │
│  ┌─────────────────────────────────┐ ┌──────────────────────┐ │
│  │    Azure AI Foundry Agent       │ │   Azure OpenAI       │ │
│  │                                 │ │   Local Agent        │ │
│  │ • Real-time thread creation     │ │   Definitions        │ │
│  │ • Managed agent processing      │ │                      │ │
│  │ • Advanced error handling       │ │ • Rich system        │ │
│  │ • Usage tracking                │ │   prompts            │ │
│  └─────────────────┬───────────────┘ │ • Fallback logic     │ │
│                    │ Fallback on     │ • Direct execution   │ │
│                    │ Error           │                      │ │
│                    └─────────────────┤                      │ │
│                                      └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 Setup Instructions

### 1. Install Dependencies

The system now includes the official Azure AI Projects SDK:

```bash
npm install @azure/ai-projects @azure/identity @azure/core-rest-pipeline
```

### 2. Azure AI Foundry Project Setup

1. **Create AI Foundry Project**:
   - Go to [Azure AI Foundry](https://ai.azure.com)
   - Create a new project or use existing
   - Note your project endpoint: `https://your-project.services.ai.azure.com/api/projects/your-project`

2. **Create Specialized Agents**:
   
   Create 6 agents in your Azure AI Foundry project:

   **Planner Agent:**
   ```
   Name: Podcast Planner
   Instructions: You are a professional podcast planning expert. Create detailed, structured plans for AI-generated podcasts based on user briefs with precise word counts and chapter breakdowns.
   ```

   **Research Agent:**
   ```
   Name: Podcast Researcher  
   Instructions: You are a research specialist. Gather relevant facts and context information for podcast topics using available tools and knowledge.
   ```

   **Outline Agent:**
   ```
   Name: Content Outliner
   Instructions: You are a content structuring expert. Develop detailed outlines for podcast episodes with clear chapter flows and talking points.
   ```

   **Script Agent:**
   ```
   Name: Script Writer
   Instructions: You are a script writer. Convert outlines into natural conversational scripts between two hosts with balanced dialogue.
   ```

   **Tone Agent:**
   ```
   Name: Tone Specialist
   Instructions: You are a tone specialist. Enhance scripts with appropriate emotional tone labels for expressive text-to-speech.
   ```

   **Editor Agent:**
   ```
   Name: Editorial Expert
   Instructions: You are an editorial expert. Perform final quality control, word count validation, and content polishing.
   ```

3. **Get Agent IDs**:
   Each agent will have an ID like `asst_xxxxxxxxxxxxxxxxxxxx`. Copy these for your environment configuration.

### 3. Environment Configuration

Update your `.env` file with Azure AI Foundry settings:

```env
# Azure AI Foundry Configuration
AZURE_AI_PROJECT_ENDPOINT=https://your-project.services.ai.azure.com/api/projects/your-project
AZURE_SUBSCRIPTION_ID=your-subscription-id
AZURE_RESOURCE_GROUP_NAME=your-resource-group
AZURE_AI_PROJECT_NAME=your-project-name

# Azure Authentication (Optional - for Service Principal)
# AZURE_TENANT_ID=your-tenant-id
# AZURE_CLIENT_ID=your-client-id  
# AZURE_CLIENT_SECRET=your-client-secret

# Agent IDs from Azure AI Foundry
PLANNER_AGENT_ID=asst_your_planner_agent_id
RESEARCH_AGENT_ID=asst_your_research_agent_id
OUTLINE_AGENT_ID=asst_your_outline_agent_id
SCRIPT_AGENT_ID=asst_your_script_agent_id
TONE_AGENT_ID=asst_your_tone_agent_id
EDITOR_AGENT_ID=asst_your_editor_agent_id

# Agent Behavior
USE_FOUNDRY_AGENTS=true
FOUNDRY_TIMEOUT_MS=60000

# Azure OpenAI (Required for TTS and fallback)
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
```

## 🚀 Usage Modes

### Mode 1: Full Azure AI Foundry (Recommended)

When all agent IDs are configured:
- ✅ Uses specialized Azure AI Foundry agents
- ✅ Advanced conversation threading  
- ✅ Enhanced context management
- ✅ Professional agent capabilities
- ✅ Automatic fallback on errors

### Mode 2: Hybrid Mode 

When some agent IDs are configured:
- ✅ Uses Foundry for configured agents
- ✅ Uses OpenAI fallback for missing agents
- ✅ Seamless mixed execution
- ✅ Gradual migration path

### Mode 3: Fallback Mode

When no agent IDs are configured:
- ✅ Uses Azure OpenAI with rich local prompts
- ✅ Full functionality maintained
- ✅ No Azure AI Foundry dependency
- ✅ Works out-of-the-box

## 🔍 Testing Your Integration

Run the integration test to verify everything works:

```bash
node test-foundry-integration.js
```

Expected output:
```
🧪 Testing Azure AI Foundry Integration

1️⃣ Testing Azure AI Foundry Client initialization...
✅ Client Health: {
  "status": "connected",
  "endpoint": "https://your-project.services.ai.azure.com/...",
  "clientInitialized": true
}

2️⃣ Testing Planner Agent initialization...
✅ Agent Health: {
  "name": "PlannerAgent",
  "agentId": "asst_xxxxxxxxxxxxxxxxxxxx",
  "preferredMode": "azure_ai_foundry"
}

3️⃣ Testing agent execution...
✅ Agent execution completed successfully!
⏱️ Execution time: 3240ms
📄 Response length: 1847 characters
📊 Word count: 312 words

🚀 Execution mode: Azure AI Foundry
✅ All tests completed successfully! 🎉
```

## 🔧 Advanced Configuration

### Authentication Options

**1. Default Azure Credential (Recommended):**
```env
# No additional config needed - uses managed identity, CLI, etc.
```

**2. Service Principal:**
```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

**3. User-Assigned Managed Identity:**
```env
AZURE_CLIENT_ID=your-managed-identity-client-id
```

### Performance Tuning

```env
# Increase timeout for complex agents
FOUNDRY_TIMEOUT_MS=90000

# Disable Foundry for testing fallback
USE_FOUNDRY_AGENTS=false

# Enable debug logging
LOG_LEVEL=debug
```

## 🛠️ Troubleshooting

### Common Issues

**1. "Azure AI Foundry client not initialized"**
```bash
# Check your endpoint configuration
echo $AZURE_AI_PROJECT_ENDPOINT

# Verify authentication
az account show
```

**2. "Agent run failed"**
- ✅ Verify agent ID is correct
- ✅ Check agent is published and active
- ✅ Ensure sufficient quota/credits
- ✅ Review agent instructions for conflicts

**3. "Credential authentication failed"**
- ✅ Use `az login` for DefaultAzureCredential
- ✅ Verify service principal credentials
- ✅ Check managed identity configuration

### Debug Mode

Enable detailed logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

Then check logs for detailed execution flow:
```bash
docker logs podcast-generator 2>&1 | grep -E "(Azure AI Foundry|BaseAgent|credential)"
```

## 📊 Performance Comparison

| Feature | Azure AI Foundry | Azure OpenAI Fallback |
|---------|------------------|------------------------|
| **Specialized Agents** | ✅ Purpose-built | ✅ Rich local prompts |
| **Context Management** | ✅ Advanced threading | ⚠️ Basic conversation |
| **Error Recovery** | ✅ Managed retries | ✅ Custom retry logic |
| **Cost** | 💰 Agent-based pricing | 💰 Token-based pricing |
| **Latency** | ⚡ ~3-4s | ⚡ ~2-3s |
| **Setup Complexity** | 🔧 Medium (agent creation) | 🔧 Low (API keys only) |

## 🎯 Best Practices

### 1. **Gradual Migration**
- Start with one agent ID (e.g., `PLANNER_AGENT_ID`)
- Test thoroughly before adding others
- Monitor performance and costs

### 2. **Error Handling**
- Always configure Azure OpenAI as fallback
- Set appropriate timeouts (60s recommended)
- Monitor failed runs and adjust

### 3. **Security**
- Use Managed Identity in production
- Rotate Service Principal secrets regularly
- Enable Azure Monitor for audit trails

### 4. **Cost Optimization**
- Monitor agent usage in Azure portal
- Set up cost alerts and quotas
- Consider hybrid mode for development

## 🔗 References

- [Azure AI Foundry Documentation](https://docs.microsoft.com/en-us/azure/ai-studio/)
- [Azure AI Projects SDK](https://www.npmjs.com/package/@azure/ai-projects)
- [Azure Identity SDK](https://docs.microsoft.com/en-us/javascript/api/@azure/identity/)
- [Azure OpenAI Service](https://docs.microsoft.com/en-us/azure/cognitive-services/openai/)

---

🎙️ **Ready to create professional podcasts with Azure AI Foundry!**
