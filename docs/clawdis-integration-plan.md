# Clawdis + Jarvis Hybrid Integration Plan

## User Goals (Priority Order)
1. **Mobile App Node**: Phone as remote microphone/display connected to Jarvis
2. **Personal assistant anywhere**: Access Jarvis from messaging apps
3. **Home automation hub**: Central controller accessible everywhere
4. **Full hybrid**: Run Clawdis gateway with Jarvis as the agent backend

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLAWDIS SURFACES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ WhatsApp │  │ Telegram │  │ Discord  │  │ iMessage │  │ iOS/Android  │  │
│  │  Bridge  │  │   Bot    │  │   Bot    │  │  Bridge  │  │  Mobile App  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│       └─────────────┴─────────────┴─────────────┴────────────────┘          │
│                                   │                                          │
│                      ┌────────────▼────────────┐                            │
│                      │   CLAWDIS GATEWAY       │                            │
│                      │   ws://127.0.0.1:18789  │                            │
│                      └────────────┬────────────┘                            │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   JARVIS GATEWAY ADAPTER      │
                    │   (NEW - WebSocket Client)    │
                    │   • Protocol translation      │
                    │   • Surface context injection │
                    │   • Voice/TTS routing         │
                    └───────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────────┐
        │                           │                               │
        ▼                           ▼                               ▼
┌───────────────┐        ┌───────────────────┐           ┌──────────────────┐
│ PYTHON DAEMON │        │  NEXT.JS WEB API  │           │  PYTHON HTTP API │
│   (Existing)  │        │    (Existing)     │           │      (NEW)       │
│ • Voice input │        │ • /api/chat-stream│           │ • /api/v1/chat   │
│ • VAD/Whisper │        │ • /api/calendar/* │           │ • /api/v1/memory │
│ • TTS output  │        │ • Auth (OAuth)    │           │ • /api/v1/tools  │
└───────────────┘        └───────────────────┘           └──────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      JARVIS CORE            │
                    │  • Reply Engine (Agentic)   │
                    │  • Memory (SQLite+Vectors)  │
                    │  • Tool Registry + MCP      │
                    │  • Profiles                 │
                    └─────────────────────────────┘
```

---

## Phased Implementation

### Phase 1: Foundation - HTTP API
**Goal:** Make Jarvis core accessible via HTTP without voice dependencies

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/jarvis/api/__init__.py` | API package |
| `src/jarvis/api/server.py` | FastAPI HTTP server |
| `src/jarvis/api/routes/chat.py` | Chat endpoints (sync + streaming) |
| `src/jarvis/api/routes/memory.py` | Memory search endpoints |
| `src/jarvis/api/routes/tools.py` | Direct tool invocation |
| `src/jarvis/api/deps.py` | Shared dependencies |

**Files to Modify:**
| File | Changes |
|------|---------|
| `src/jarvis/config.py` | Add `api_enabled`, `api_host`, `api_port` settings |
| `src/jarvis/main.py` | Add `--api` flag to start HTTP server |
| `src/jarvis/reply/engine.py` | Extract to be callable without daemon context |

**Endpoints:**
```
POST /api/v1/chat          - Synchronous chat
POST /api/v1/chat/stream   - Streaming chat (SSE)
GET  /api/v1/memory/search - Search conversation memory
POST /api/v1/tools/{name}  - Direct tool invocation
GET  /api/v1/health        - Health check
```

**Deliverable:** `curl http://localhost:5000/api/v1/chat -d '{"message":"hello"}'` works

---

### Phase 2: Gateway Adapter - Clawdis Connection
**Goal:** Connect to Clawdis Gateway as the agent backend

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/jarvis/gateway/__init__.py` | Gateway package |
| `src/jarvis/gateway/client.py` | WebSocket client to Clawdis |
| `src/jarvis/gateway/protocol.py` | Message encoding/decoding |
| `src/jarvis/gateway/router.py` | Surface-aware message routing |
| `src/jarvis/gateway/session.py` | Per-surface session management |

**Files to Modify:**
| File | Changes |
|------|---------|
| `src/jarvis/config.py` | Add `gateway_enabled`, `gateway_url` settings |
| `src/jarvis/main.py` | Add `--gateway` flag |
| `src/jarvis/memory/conversation.py` | Add `SurfaceDialogueManager` |

**Protocol Flow:**
```python
# Incoming from Clawdis
{
  "type": "message",
  "surface": "telegram",
  "session_id": "user_123_telegram",
  "content": "What's on my calendar tomorrow?"
}

# Response to Clawdis
{
  "type": "response",
  "session_id": "user_123_telegram",
  "content": "You have 3 events tomorrow...",
  "tools_used": ["list_calendar_events"]
}
```

**Deliverable:** Messages from Telegram/WhatsApp flow through Clawdis → Jarvis → response

---

### Phase 3: Mobile Node Voice Streaming
**Goal:** Phone as remote microphone/display with real-time voice

**Files to Create:**
| File | Purpose |
|------|---------|
| `src/jarvis/gateway/voice_stream.py` | Audio chunk handling |
| `src/jarvis/gateway/mobile_node.py` | Mobile-specific protocol |

**Files to Modify:**
| File | Changes |
|------|---------|
| `src/jarvis/listening/listener.py` | Extract VAD/Whisper for reuse |
| `src/jarvis/output/tts.py` | Add streaming output mode |

**Key Implementation:**
```python
class MobileVoiceSession:
    """Handles voice streaming from mobile Clawdis node"""

    async def receive_audio_chunk(self, chunk: bytes):
        self.audio_buffer.append(chunk)
        if self.audio_buffer.detect_speech_end():
            transcript = await self._transcribe()
            response = await self._get_jarvis_response(transcript)
            async for audio_chunk in self.tts.stream_speak(response):
                yield audio_chunk
```

**Deliverable:** Speak into phone → Jarvis processes → hear response on phone

---

### Phase 4: Clawdis Setup & Configuration
**Goal:** Clone and configure Clawdis to work with Jarvis backend

**Steps:**
1. Clone Clawdis: `git clone https://github.com/steipete/clawdis.git`
2. Configure Jarvis as agent backend (replace Pi agent)
3. Set up messaging surfaces (Telegram first - easiest)
4. Configure mobile node pairing

**Configuration:**
```json
// ~/.clawdis/clawdis.json
{
  "agent": {
    "type": "jarvis",
    "url": "ws://127.0.0.1:5001"
  },
  "routing": {
    "allowFrom": ["+1234567890"]
  },
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN"
  }
}
```

---

## Critical Files Summary

### New Files to Create (Python)
1. `src/jarvis/api/server.py` - FastAPI HTTP server
2. `src/jarvis/api/routes/chat.py` - Chat endpoints
3. `src/jarvis/gateway/client.py` - WebSocket client to Clawdis
4. `src/jarvis/gateway/router.py` - Message routing
5. `src/jarvis/gateway/voice_stream.py` - Mobile voice handling

### Files to Modify
1. `src/jarvis/config.py` - Add API/gateway settings
2. `src/jarvis/main.py` - Add `--api` and `--gateway` flags
3. `src/jarvis/reply/engine.py` - Make callable without daemon
4. `src/jarvis/memory/conversation.py` - Add surface-aware sessions

### Dependencies to Add
```
# requirements.txt additions
fastapi>=0.104.0
uvicorn>=0.24.0
websockets>=12.0
```

---

## What Jarvis Keeps (Strengths Preserved)
- ✅ Rich memory system (SQLite + FTS + vectors)
- ✅ Profile system (Developer, Business, Life Coach)
- ✅ Calendar integration
- ✅ Tool registry + MCP
- ✅ Document indexing
- ✅ Local voice processing (Whisper)

## What Clawdis Adds
- ✅ Multi-surface messaging (WhatsApp, Telegram, Discord, iMessage)
- ✅ Mobile apps as nodes (iOS/Android)
- ✅ Canvas visual workspace
- ✅ Gateway control plane
- ✅ Voice wake word on mobile

---

## Quick Start Commands (After Implementation)

```bash
# Start Jarvis API + Gateway Adapter
python -m jarvis --api --gateway

# Start Clawdis Gateway (in clawdis directory)
pnpm clawdis gateway --port 18789

# Link Telegram bot
pnpm clawdis login telegram

# Test from Telegram
# Send message to your bot → Jarvis responds
```

---

## Comparison Summary

| Aspect | Jarvis | Clawdis | Hybrid |
|--------|--------|---------|--------|
| **Voice** | Wake word + Whisper | Wake word + push-to-talk | Both |
| **Messaging** | Web only | WhatsApp/Telegram/Discord/iMessage | All surfaces |
| **Memory** | SQLite + vectors | Session-based | Jarvis memory |
| **Mobile** | Web PWA | Native iOS/Android | Native apps |
| **LLM** | Ollama/Gemini/OpenAI | Configurable | Jarvis providers |
| **Tools** | MCP + builtins | MCP + skills | Jarvis tools |

---

## Next Steps
1. ✅ Approve this plan
2. Start Phase 1: Create HTTP API for Jarvis
3. Clone Clawdis repository for reference
4. Set up Telegram bot token for testing
