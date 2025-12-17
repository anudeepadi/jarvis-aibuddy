import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { text, apiKey, voice = 'onyx', speed = 1.0 } = await request.json()

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: 'Missing text or apiKey' },
        { status: 400 }
      )
    }

    // OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1', // Use tts-1-hd for higher quality
        input: text,
        voice: voice, // alloy, echo, fable, onyx, nova, shimmer
        speed: speed, // 0.25 to 4.0
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('OpenAI TTS error:', error)
      return NextResponse.json(
        { error: 'TTS failed' },
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
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
