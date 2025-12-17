import { NextRequest, NextResponse } from 'next/server'

// Cartesia Sonic voices - verified IDs from https://developer.signalwire.com/voice/tts/cartesia/
const CARTESIA_VOICES: Record<string, string> = {
  // Male voices (best for JARVIS)
  'british-butler': '95856005-0332-41b0-935f-352e296aa0df', // Classy British Man
  'confident-british': '63ff761f-c1e8-414b-b969-d1833d1c870c', // Confident British Man
  'deep-narrator': 'd46abd1d-2d02-43e8-819f-51fb652c1c61', // Newsman - deep authoritative
  'professional-male': 'a167e0f3-df7e-4d52-a9c3-f949145efdab', // Customer Support Man
  'wise-man': 'b043dea0-a007-4bbe-a708-769dc0d0c569', // Wise Man
  'reading-man': 'f146dcec-e481-45be-8ad2-96e1e40e7f32', // Reading Man
  // Female voices
  'professional-female': '248be419-c632-4f23-adf1-5324ed7dbf1d', // Professional Woman
  'british-lady': '79a125e8-cd45-4c13-8a67-188112f4dd22', // British Lady
  'warm-female': '21b81c14-f85b-436d-aff5-43f2e788ecf8', // Laidback Woman
  'commercial-lady': 'c2ac25f9-ecc4-4f56-9095-651354df60c0', // Commercial Lady
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
