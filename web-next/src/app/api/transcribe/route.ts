import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio') as Blob
    const apiKey = formData.get('apiKey') as string

    if (!audio || !apiKey) {
      return NextResponse.json(
        { error: 'Missing audio or apiKey' },
        { status: 400 }
      )
    }

    // Create form data for Groq
    const groqFormData = new FormData()
    groqFormData.append('file', audio, 'audio.webm')
    groqFormData.append('model', 'whisper-large-v3-turbo')
    groqFormData.append('response_format', 'json')

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: groqFormData,
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Groq transcription error:', error)
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json({ text: data.text })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
