import { NextRequest, NextResponse } from 'next/server'

// Cartesia Sonic voices - https://docs.cartesia.ai/build-with-cartesia/voices
const CARTESIA_VOICES: Record<string, string> = {
  // Male voices
  'british-butler': '63ff761e-74d5-4127-9e08-7976fe68070e', // Professional British male
  'confident-british': 'ee7ea9f8-c0c1-498c-9f62-ada6c02c0c47', // Confident British male
  'deep-narrator': '3b554273-4299-48b9-9aaf-eefd438e3941', // Deep male narrator
  'professional-male': 'e13cae5c-ec59-4f71-b0a6-266df3c9bb8e', // Professional male
  // Female voices
  'professional-female': 'eda5bbff-1ff1-4c99-b7b3-0dc8a9f9b4e4', // Professional female
  'warm-female': '21b81c14-f85b-436d-aff5-43f2e788ecf8', // Warm female narrator
}

export async function POST(request: NextRequest) {
  try {
    const { text, apiKey, voiceId = 'british-butler', speed = 1.0 } = await request.json()

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: 'Missing text or apiKey' },
        { status: 400 }
      )
    }

    // Get voice UUID from preset or use as-is if it's already a UUID
    const voiceUuid = CARTESIA_VOICES[voiceId] || voiceId

    // Cartesia TTS API - Bytes endpoint
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Cartesia-Version': '2025-04-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-2', // sonic-2 is production stable, sonic-3 for latest
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceUuid,
        },
        output_format: {
          container: 'mp3',
          encoding: 'mp3',
          sample_rate: 44100,
        },
        language: 'en',
        ...(speed !== 1.0 && {
          generation_config: {
            speed: speed === 'slow' ? 'slowest' : speed === 'fast' ? 'fastest' : 'normal',
          },
        }),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Cartesia TTS error:', error)
      return NextResponse.json(
        { error: `TTS failed: ${error}` },
        { status: response.status }
      )
    }

    // Return audio as binary
    const audioBuffer = await response.arrayBuffer()

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    })
  } catch (error) {
    console.error('Cartesia TTS error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
