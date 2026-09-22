# Jarvis — local modifications

An adaptation of [isair/Jarvis](https://github.com/isair/jarvis), originally created by **Baris Sencan**, with a Next.js voice interface and additional provider/authentication integrations by Anudeep Adiraju. The original assistant, history and license remain attributed to upstream.

**Status:** experimental adaptation. This repository has local and hosted-provider paths; privacy and cost depend on the selected path. Cloud speech, LLM, memory and web-search requests can send data off the device.

## Local changes in this repository

The inherited history continues through upstream commit `cc0bb34051`. Subsequent local commits add:

- A [Next.js voice interface](web-next/src/app/page.tsx), with provider hooks and speech/chat API routes.
- Streaming responses and voice-provider options including OpenAI, Groq, Cartesia, ElevenLabs and Edge TTS.
- Language selection and conversation/memory handling in the browser interface.
- NextAuth/Prisma authentication and Docker/Railway configuration; the latest change switches authentication to JWT sessions for middleware compatibility.

Examples of these changes are [voice-interface work](https://github.com/anudeepadi/jarvis-aibuddy/commit/a07e78b8a3), [streaming work](https://github.com/anudeepadi/jarvis-aibuddy/commit/c1bf5e7d87) and [authentication work](https://github.com/anudeepadi/jarvis-aibuddy/commit/25b4bc592c). They identify the local contribution; they are not evidence that every provider integration is currently working.

## Run the inherited local assistant

Install [Ollama](https://ollama.com/download), then download the configured local models:

```bash
ollama pull gpt-oss:20b
ollama pull nomic-embed-text
git clone https://github.com/anudeepadi/jarvis-aibuddy.git
cd jarvis-aibuddy
bash scripts/run_macos.sh
```

Linux uses `bash scripts/run_linux.sh`; Windows uses `pwsh -ExecutionPolicy Bypass -File scripts/run_windows.ps1` with the Python/build prerequisites expected by that script. Model storage, memory, microphone access and audio dependencies are required. These platform flows have not been rerun for this documentation update.

See [examples/config.json](examples/config.json) for model, voice, profile and MCP configuration. Only configure external tools you intend the assistant to access. The inherited Python assistant and newer browser voice UI are separate entry points.

## Browser voice interface

```bash
cd web-next
npm ci
cp .env.local.example .env.local
```

Fill in your own database and authentication values, then prepare the Prisma client/schema for your development database and run `npm run dev`. Enter your selected provider keys in the browser Settings panel; this interface persists them in local browser storage (`jarvis-storage`) and sends them to the relevant API routes. [schema.prisma](web-next/prisma/schema.prisma) describes the PostgreSQL auth database. Provider availability and usage charges are determined by your accounts; examples contain no usable credentials.

The browser configuration and provider hooks live in [web-next/src/hooks](web-next/src/hooks) and [web-next/src/components/SettingsModal.tsx](web-next/src/components/SettingsModal.tsx). A successful page load does not establish a successful microphone → speech recognition → response → audio round trip.

## Attribution and license

The upstream [Jarvis AI Assistant License](LICENSE) credits Baris Sencan and permits non-commercial use under its stated conditions. Commercial use requires a separate license from the copyright holder. Existing source notices, funding configuration and the bundled wake-word model license are retained.

Support the original project through [GitHub Sponsors](https://github.com/sponsors/isair) or [Ko-fi](https://ko-fi.com/isair). This repository is not presented as an independently authored replacement for upstream Jarvis.
