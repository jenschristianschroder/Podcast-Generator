# Multi‑Agent Podcast Generator – Initial Technical Requirements

## 1 Overview
A server‑side Node.js application that orchestrates multiple Azure AI Foundry agents to transform a user‑supplied **Markdown brief** into a fully‑voiced podcast episode (`podcast.mp3`). All intermediate artefacts (research notes, outlines, scripts, edits) are also Markdown for maximum portability.

## 2 Goals & Non‑goals
|                      | **In‑scope** | **Out‑of‑scope** |
|----------------------|--------------|------------------|
|Single‑episode generation | ✅ | ⛔ continuous series management |
|Text‑to‑speech (TTS) with GPT‑4o‑mini‑TTS | ✅ | ⛔ third‑party voice cloning |
|Automatic research via BingGrounding | ✅ | ⛔ pay‑walled content scraping |
|Automated quality checks | ✅ | ⛔ human editorial review |

## 3 High‑Level Features
* **Markdown in / Markdown out**: All user inputs and agent messages use Markdown.
* **Pluggable Agent Chain**: Planner → Research → Outline → Script → Tone → Editor → TTS.
* **Voice Expressiveness**: Each utterance explicitly carries an emotion/tone label.
* **Duration Accuracy**: Word budget adheres to *150 wpm ± 5 %*.
* **Policy & Safety**: Built‑in moderation before TTS.
* **Audio Stitching**: `ffmpeg` concatenates per‑chapter MP3s.

## 4 Functional Requirements
### 4.1 User Inputs
| Field | Type | Default | Notes |
|-------|------|---------|-------|
|`topic`|string| — (required)|Main subject|
|`focus`|string|""|Narrower angle|
|`mood`|enum|`Neutral`|Overall vibe of episode|
|`style`|enum|`Storytelling and Questions/Comments`|Dialogue pattern|
|`chapters`|int|`3`|1 – 10 supported|
|`durationMin`|int|`5`|1 – 120 minutes|
|`source`|url/path|null|Optional reference doc|

### 4.2 PlannerAgent
* Parses brief, fills defaults.
* Calculates `wordsPerChapter = durationMin × 150 / chapters`.
* Emits a JSON **plan** with speakers, tone plan, outline skeleton & research queries.

### 4.3 ResearchAgent
* Uses **BingGrounding** to retrieve up‑to‑date facts.
* Returns Markdown bullet list (`- fact [source]`).

### 4.4 OutlineAgent
* Consumes the plan; expands each chapter into: _title_, _goals_, and _time allocation_.

### 4.5 ScriptAgents (N = chapters)
* Generates dialogue for its chapter.
* Hard word‑limit: `wordsPerChapter`.
* Output Markdown dialogue: `**Host 1:** text`.

### 4.6 ToneAgent
* Rewrites every line to: `Host X: say the following in a [tone] tone: "…"`.
* Allowed tones
  ```
  upbeat, calm, excited, reflective, suspenseful,
  skeptical, humorous, angry, sad, hopeful
  ```

### 4.7 EditorAgent
* Validates:
  1. Template conformity.
  2. Word‑count ±5 % of target.
  3. No contradictions vs research.
  4. Policy compliance (profanity, disallowed content).
* Emits cleaned, concatenated Markdown or `<!-- EDITOR‑BLOCKER: reason -->`.

### 4.8 TTSAgent
* Model: `gpt‑4o‑mini‑tts`.
* Receives plain text (Markdown stripped).
* Produces one MP3 per chapter (or whole script).

## 5 Data‑flow Diagram (ASCII)
```
User -> PlannerAgent -> ResearchAgent ----
       |                 |               |
       v                 v               |
   OutlineAgent     Research Notes       |
       |                 |               |
       +-> ScriptAgents (parallel)       |
                     |                   |
                     v                   |
                 ToneAgent               |
                     |                   |
                     v                   |
                 EditorAgent -----------
                     |
                     v
                 TTSAgent
                     |
                     v
                ffmpeg concat
                     |
                     v
               podcast.mp3
```

## 6 Input / Output Formats
### 6.1 User Brief (example)
```md
### Topic
The 2024–25 AI hardware arms‑race

### Chapters
4

### Duration
6 minutes
```

### 6.2 Plan (excerpt)
```json
{
  "chapters": 4,
  "wordsPerChapter": 225,
  "speakers": ["Host 1", "Host 2"],
  "tonePlan": {"Host 1": "excited", "Host 2": "curious"}
}
```

## 7 Word‑Budget Formulae
* **Total words** ≈ `durationMin × 150`.
* **Chapter words** = `totalWords / chapters`.
* **Tone prefix overhead**: subtract ≈9 words per utterance.

## 8 Constraints
* **Latency**: ≤ 60 s wall‑clock for a 5‑min episode.
* **Cost ceiling**: ≤ $0.02 per minute of audio.
* **Markdown fidelity**: No HTML tags.
* **Content policy**: Must pass Azure OpenAI moderation **before** TTS.

## 9 Tech Stack
| Layer | Choice | Notes |
|-------|--------|-------|
|Runtime|Node 18 LTS|ESM modules|
|Agents |Azure AI Foundry|`@azure/ai-agents` SDK|
|TTS    |GPT‑4o‑mini‑TTS|`openai.audio.speech`|
|Audio  |ffmpeg|`fluent-ffmpeg` npm wrapper|
|Markdown utils|`marked`, `strip-markdown`|parsing & stripping|

## 10 Testing & QA
* **Unit**: Planner formulae, regex tone checker.
* **Integration**: Stubbed agent responses → ensure pipeline passes.
* **E2E**: Generate a 2‑min episode nightly; diff against golden snapshot.
* **Load**: Parallel 25 requests; measure P95 latency.

## 11 Deployment
1. Build Docker image (`node:lts-alpine`).
2. Inject Azure credentials as secrets.
3. Run behind Azure Container Apps or AKS.
4. Mount Blob Storage for artefact caching.

## 12 Future Enhancements
* **Multi‑language** episodes (Planner would set locale).
* **Dynamic ad slots** (Planner + ScriptAgents handle placement).
* **SSML output** instead of plain text for richer prosody control.

---