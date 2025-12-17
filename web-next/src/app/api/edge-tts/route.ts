import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import { randomUUID } from 'crypto'
import { promises as fs } from 'fs'
import path from 'path'

const execAsync = promisify(exec)

// Edge TTS voices - https://github.com/rany2/edge-tts
// These are Microsoft Azure voices, completely FREE
const EDGE_VOICES: Record<string, string> = {
  // Male voices (best for JARVIS)
  'british-male': 'en-GB-RyanNeural', // British male - closest to JARVIS
  'american-male': 'en-US-GuyNeural', // American male
  'australian-male': 'en-AU-WilliamNeural', // Australian male
  // Female voices
  'british-female': 'en-GB-SoniaNeural', // British female
  'american-female': 'en-US-JennyNeural', // American female
  'australian-female': 'en-AU-NatashaNeural', // Australian female
}

// Use /tmp directly on macOS (avoids permission issues with os.tmpdir())
const TEMP_DIR = '/tmp'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId = 'british-male', rate = '+0%', pitch = '+0Hz' } = await request.json()

    if (!text) {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 })
    }

    const voice = EDGE_VOICES[voiceId] || voiceId
    const tempFile = path.join(TEMP_DIR, `edge-tts-${randomUUID()}.mp3`)

    // Escape text for shell - replace quotes and special chars
    const escapedText = text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')

    try {
      // Call edge-tts CLI (Python version)
      await execAsync(
        `edge-tts --voice "${voice}" --rate="${rate}" --pitch="${pitch}" --text "${escapedText}" --write-media "${tempFile}"`,
        { timeout: 30000 }
      )

      // Read the generated audio
      const audioBuffer = await fs.readFile(tempFile)

      // Clean up temp file
      await fs.unlink(tempFile).catch(() => {})

      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString(),
        },
      })
    } catch (cmdError) {
      console.error('Edge TTS command error:', cmdError)
      // Clean up temp file if it exists
      await fs.unlink(tempFile).catch(() => {})
      throw cmdError
    }
  } catch (error) {
    console.error('Edge TTS error:', error)
    return NextResponse.json(
      { error: 'TTS failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
