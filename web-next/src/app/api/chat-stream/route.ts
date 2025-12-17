import { NextRequest } from 'next/server'

const BASE_SYSTEM_PROMPT = `You are Jarvis, an intelligent AI assistant inspired by the AI from Iron Man. You are helpful, witty, and concise. Keep responses brief and conversational since they will be spoken aloud. Avoid markdown formatting, bullet points, or long explanations - speak naturally as if having a conversation.`

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { message, apiKey, provider = 'groq', conversationHistory = [], memoryContext } = await request.json() as {
      message: string
      apiKey: string
      provider?: string
      conversationHistory?: ConversationMessage[]
      memoryContext?: string
    }

    if (!message || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing message or apiKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const apiUrl = provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions'

    const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

    // Build messages array with conversation history (last 5 exchanges = 10 messages)
    const historyMessages = conversationHistory.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // Build system prompt with memory context if available
    let systemPrompt = BASE_SYSTEM_PROMPT
    if (memoryContext) {
      systemPrompt += `\n\n## User Background\n${memoryContext}\n\nUse this information naturally in conversation without explicitly mentioning "memories" or "I remember".`
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...historyMessages,
          { role: 'user', content: message }
        ],
        max_tokens: 300,
        temperature: 0.7,
        stream: true, // Enable streaming
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Chat stream error:', error)
      return new Response(JSON.stringify({ error: 'Chat failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Transform the OpenAI/Groq stream to text chunks
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk)
        const lines = text.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              return
            }
            try {
              const json = JSON.parse(data)
              const content = json.choices[0]?.delta?.content || ''
              if (content) {
                // Send each text chunk as SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`))
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      },
    })

    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat stream error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
