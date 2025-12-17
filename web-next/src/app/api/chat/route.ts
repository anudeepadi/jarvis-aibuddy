import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, apiKey, provider = 'groq' } = await request.json()

    if (!message || !apiKey) {
      return NextResponse.json(
        { error: 'Missing message or apiKey' },
        { status: 400 }
      )
    }

    let response: Response
    let data: any

    if (provider === 'groq') {
      // Use Groq for fast, cheap LLM responses
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: `You are Jarvis, an intelligent AI assistant inspired by the AI from Iron Man. You are helpful, witty, and concise. Keep responses brief and conversational since they will be spoken aloud. Avoid markdown formatting, bullet points, or long explanations - speak naturally as if having a conversation.`
            },
            { role: 'user', content: message }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('Groq chat error:', error)
        return NextResponse.json(
          { error: 'Chat failed' },
          { status: response.status }
        )
      }

      data = await response.json()
      return NextResponse.json({
        text: data.choices[0]?.message?.content || 'I could not generate a response.'
      })
    } else if (provider === 'openai') {
      // Use OpenAI as alternative
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are Jarvis, an intelligent AI assistant inspired by the AI from Iron Man. You are helpful, witty, and concise. Keep responses brief and conversational since they will be spoken aloud. Avoid markdown formatting, bullet points, or long explanations - speak naturally as if having a conversation.`
            },
            { role: 'user', content: message }
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        console.error('OpenAI chat error:', error)
        return NextResponse.json(
          { error: 'Chat failed' },
          { status: response.status }
        )
      }

      data = await response.json()
      return NextResponse.json({
        text: data.choices[0]?.message?.content || 'I could not generate a response.'
      })
    }

    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
