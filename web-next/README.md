# Jarvis AI Voice Assistant

A Next.js voice assistant with AI-powered responses, weather, location, and wake word detection.

## Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)

## Quick Start

### 1. Start PostgreSQL Database

```bash
docker run -d --name postgres-jarvis \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=jarvis \
  -p 5433:5432 \
  postgres:15-alpine
```

### 2. Configure Environment

Create `.env` file:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/jarvis"
```

Create `.env.local` file with your API keys:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/jarvis"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI Providers
OPENAI_API_KEY="your-openai-key"
GROQ_API_KEY="your-groq-key"
CARTESIA_API_KEY="your-cartesia-key"
ELEVENLABS_API_KEY="your-elevenlabs-key"
MEM0_API_KEY="your-mem0-key"
PICOVOICE_API_KEY="your-picovoice-key"
```

### 3. Install Dependencies & Setup Database

```bash
npm install
npx prisma db push
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- Voice input with wake word detection ("Hey Jarvis")
- AI-powered responses via OpenAI/Groq
- Text-to-speech via Cartesia/ElevenLabs
- Weather information
- Location awareness
- Google OAuth authentication
- Persistent memory with Mem0

## Tech Stack

- Next.js 15
- TypeScript
- Prisma + PostgreSQL
- NextAuth.js
- Tailwind CSS
- Zustand (state management)
