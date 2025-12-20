import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidAccessToken, getCalendarClient } from '@/lib/google-calendar'

const CALENDAR_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'create_calendar_event',
      description: 'Create a new calendar event. Use this when the user wants to schedule, add, or create a meeting, appointment, or event.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'The title/name of the event',
          },
          start: {
            type: 'string',
            description: 'Start time in ISO 8601 format (e.g., 2024-01-15T14:00:00)',
          },
          end: {
            type: 'string',
            description: 'End time in ISO 8601 format. If not specified by user, default to 1 hour after start',
          },
          location: {
            type: 'string',
            description: 'Location of the event (optional)',
          },
          description: {
            type: 'string',
            description: 'Description or notes for the event (optional)',
          },
        },
        required: ['summary', 'start', 'end'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_calendar_events',
      description: 'List calendar events. Use this when the user wants to see, check, or know about their schedule, calendar, meetings, or appointments.',
      parameters: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start of time range in ISO 8601 format. Defaults to now.',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range in ISO 8601 format. Defaults to 7 days from now.',
          },
          maxResults: {
            type: 'number',
            description: 'Maximum number of events to return. Defaults to 10.',
          },
          query: {
            type: 'string',
            description: 'Free text search query to filter events (optional)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_calendar_event',
      description: 'Update an existing calendar event. Use this when the user wants to change, modify, move, reschedule, or update an event.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to update',
          },
          summary: {
            type: 'string',
            description: 'New title for the event (optional)',
          },
          start: {
            type: 'string',
            description: 'New start time in ISO 8601 format (optional)',
          },
          end: {
            type: 'string',
            description: 'New end time in ISO 8601 format (optional)',
          },
          location: {
            type: 'string',
            description: 'New location (optional)',
          },
          description: {
            type: 'string',
            description: 'New description (optional)',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_calendar_event',
      description: 'Delete a calendar event. Use this when the user wants to cancel, remove, or delete a meeting or event.',
      parameters: {
        type: 'object',
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to delete',
          },
        },
        required: ['eventId'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_availability',
      description: 'Check if the user is free or busy during a specific time. Use this when the user asks if they are available or free.',
      parameters: {
        type: 'object',
        properties: {
          timeMin: {
            type: 'string',
            description: 'Start of time range to check in ISO 8601 format',
          },
          timeMax: {
            type: 'string',
            description: 'End of time range to check in ISO 8601 format',
          },
        },
        required: ['timeMin', 'timeMax'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description: 'Get current weather and forecast. Use this when the user asks about weather, temperature, or if they should bring an umbrella.',
      parameters: {
        type: 'object',
        properties: {
          lat: {
            type: 'number',
            description: 'Latitude of the location',
          },
          lon: {
            type: 'number',
            description: 'Longitude of the location',
          },
        },
        required: ['lat', 'lon'],
      },
    },
  },
]

function getSystemPrompt(memoryContext?: string, userLocation?: { lat: number; lon: number; city?: string }): string {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  let prompt = `You are Jarvis, an intelligent AI assistant inspired by the AI from Iron Man. You are helpful, witty, and concise. Keep responses brief and conversational since they will be spoken aloud. Avoid markdown formatting, bullet points, or long explanations - speak naturally as if having a conversation.

## Current Date/Time
Today is ${dateStr}. The current time is ${timeStr} (${timezone}).`

  // Add location context if available
  if (userLocation) {
    prompt += `\n\n## User Location
The user is located at coordinates (${userLocation.lat}, ${userLocation.lon})${userLocation.city ? ` in ${userLocation.city}` : ''}.
When they ask about weather, use the get_weather function with these coordinates.`
  }

  prompt += `

## Calendar Functions
You have access to the user's Google Calendar. When the user asks about their schedule, wants to create events, or manage their calendar, use the appropriate function. Always use ISO 8601 format for dates and times, with the user's timezone (${timezone}).

When creating events:
- Parse natural language times like "tomorrow at 2pm" into proper ISO 8601 format
- If no end time is specified, default to 1 hour after start
- Confirm the event details briefly after creation

When listing events:
- Summarize the events naturally in conversation
- Include the time and title of each event

## Weather
You can check the weather using the get_weather function. When reporting weather:
- Include current temperature and conditions
- Mention if rain or snow is expected
- Give practical advice like "bring an umbrella" when appropriate`

  if (memoryContext) {
    prompt += `\n\n## User Background\n${memoryContext}\n\nUse this information naturally in conversation without explicitly mentioning "memories" or "I remember".`
  }

  return prompt
}

interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

async function executeCalendarFunction(
  functionName: string,
  args: Record<string, unknown>,
  userId: string
): Promise<{ success: boolean; message: string; data?: unknown }> {
  try {
    const accessToken = await getValidAccessToken(userId)
    const calendar = getCalendarClient(accessToken)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    switch (functionName) {
      case 'create_calendar_event': {
        const { summary, start, end, location, description } = args as {
          summary: string
          start: string
          end: string
          location?: string
          description?: string
        }

        const isAllDay = !start.includes('T')
        const response = await calendar.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary,
            location,
            description,
            start: isAllDay ? { date: start } : { dateTime: start, timeZone },
            end: isAllDay ? { date: end } : { dateTime: end, timeZone },
          },
        })

        return {
          success: true,
          message: `Created event "${summary}"`,
          data: {
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            htmlLink: response.data.htmlLink,
          },
        }
      }

      case 'list_calendar_events': {
        const {
          timeMin = new Date().toISOString(),
          timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults = 10,
          query,
        } = args as {
          timeMin?: string
          timeMax?: string
          maxResults?: number
          query?: string
        }

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          maxResults,
          singleEvents: true,
          orderBy: 'startTime',
          q: query,
        })

        const events = (response.data.items || []).map((event) => ({
          id: event.id,
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
          location: event.location,
        }))

        return {
          success: true,
          message: events.length > 0 ? `Found ${events.length} event(s)` : 'No events found',
          data: { events },
        }
      }

      case 'update_calendar_event': {
        const { eventId, summary, start, end, location, description } = args as {
          eventId: string
          summary?: string
          start?: string
          end?: string
          location?: string
          description?: string
        }

        const existingEvent = await calendar.events.get({
          calendarId: 'primary',
          eventId,
        })

        const updateData: Record<string, unknown> = { ...existingEvent.data }
        if (summary !== undefined) updateData.summary = summary
        if (location !== undefined) updateData.location = location
        if (description !== undefined) updateData.description = description
        if (start !== undefined) {
          const isAllDay = !start.includes('T')
          updateData.start = isAllDay ? { date: start } : { dateTime: start, timeZone }
        }
        if (end !== undefined) {
          const isAllDay = !end.includes('T')
          updateData.end = isAllDay ? { date: end } : { dateTime: end, timeZone }
        }

        const response = await calendar.events.update({
          calendarId: 'primary',
          eventId,
          requestBody: updateData,
        })

        return {
          success: true,
          message: `Updated event "${response.data.summary}"`,
          data: {
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
          },
        }
      }

      case 'delete_calendar_event': {
        const { eventId } = args as { eventId: string }

        const eventToDelete = await calendar.events.get({
          calendarId: 'primary',
          eventId,
        })

        await calendar.events.delete({
          calendarId: 'primary',
          eventId,
        })

        return {
          success: true,
          message: `Deleted event "${eventToDelete.data.summary}"`,
        }
      }

      case 'check_availability': {
        const { timeMin, timeMax } = args as { timeMin: string; timeMax: string }

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        })

        const events = response.data.items || []
        if (events.length === 0) {
          return {
            success: true,
            message: 'You are free during this time.',
            data: { available: true, events: [] },
          }
        }

        return {
          success: true,
          message: `You have ${events.length} event(s) during this time.`,
          data: {
            available: false,
            events: events.map((e) => ({
              summary: e.summary,
              start: e.start?.dateTime || e.start?.date,
              end: e.end?.dateTime || e.end?.date,
            })),
          },
        }
      }

      case 'get_weather': {
        const { lat, lon } = args as { lat: number; lon: number }

        try {
          const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
          const weatherResponse = await fetch(`${baseUrl}/api/weather?lat=${lat}&lon=${lon}`)

          if (!weatherResponse.ok) {
            throw new Error('Weather API error')
          }

          const weather = await weatherResponse.json()

          return {
            success: true,
            message: `Current weather: ${weather.current.temp}°, ${weather.current.description}`,
            data: weather,
          }
        } catch {
          return {
            success: false,
            message: 'Failed to fetch weather data',
          }
        }
      }

      default:
        return { success: false, message: `Unknown function: ${functionName}` }
    }
  } catch (error) {
    console.error('Function execution error:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Operation failed',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      message,
      apiKey,
      provider = 'groq',
      conversationHistory = [],
      memoryContext,
      userLocation,
    } = (await request.json()) as {
      message: string
      apiKey: string
      provider?: string
      conversationHistory?: ConversationMessage[]
      memoryContext?: string
      userLocation?: { lat: number; lon: number; city?: string }
    }

    if (!message || !apiKey) {
      return new Response(JSON.stringify({ error: 'Missing message or apiKey' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user is authenticated for calendar access
    const session = await auth()
    const userId = session?.user?.id
    const hasCalendarAccess = !!userId

    const apiUrl =
      provider === 'groq'
        ? 'https://api.groq.com/openai/v1/chat/completions'
        : 'https://api.openai.com/v1/chat/completions'

    const model = provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'

    const historyMessages = conversationHistory.slice(-10).map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    const systemPrompt = getSystemPrompt(memoryContext, userLocation)

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
        { role: 'user', content: message },
      ],
      max_tokens: 500,
      temperature: 0.7,
      stream: true,
    }

    // Only include tools if user has calendar access
    // Note: Groq supports function calling with llama-3.3-70b-versatile
    if (hasCalendarAccess) {
      requestBody.tools = CALENDAR_TOOLS
      requestBody.tool_choice = 'auto'
    }

    let response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    // If tools cause an error, retry without them
    if (!response.ok && hasCalendarAccess) {
      const errorText = await response.text()
      console.error('Chat stream error with tools, retrying without:', errorText)

      // Remove tools and retry
      delete requestBody.tools
      delete requestBody.tool_choice

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })
    }

    if (!response.ok) {
      const error = await response.text()
      console.error('Chat stream error:', error)
      return new Response(JSON.stringify({ error: 'Chat failed' }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    // State for tracking tool calls
    let accumulatedToolCalls: Map<number, ToolCall> = new Map()
    let isToolCallResponse = false

    const transformStream = new TransformStream({
      async transform(chunk, controller) {
        const text = decoder.decode(chunk)
        const lines = text.split('\n').filter((line) => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              console.log('Stream complete, tool calls:', accumulatedToolCalls.size)
              // Check if we have accumulated tool calls to execute
              if (accumulatedToolCalls.size > 0 && userId) {
                isToolCallResponse = true

                // Execute each tool call
                for (const [, toolCall] of accumulatedToolCalls) {
                  try {
                    const args = JSON.parse(toolCall.function.arguments)
                    const result = await executeCalendarFunction(
                      toolCall.function.name,
                      args,
                      userId
                    )

                    // Send tool result to indicate function was called
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          tool_call: {
                            name: toolCall.function.name,
                            result,
                          },
                        })}\n\n`
                      )
                    )

                    // Make a follow-up call to get the LLM's natural response
                    const followUpResponse = await fetch(apiUrl, {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        model,
                        messages: [
                          { role: 'system', content: systemPrompt },
                          ...historyMessages,
                          { role: 'user', content: message },
                          {
                            role: 'assistant',
                            content: null,
                            tool_calls: [
                              {
                                id: toolCall.id,
                                type: 'function',
                                function: {
                                  name: toolCall.function.name,
                                  arguments: toolCall.function.arguments,
                                },
                              },
                            ],
                          },
                          {
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            content: JSON.stringify(result),
                          },
                        ],
                        max_tokens: 300,
                        temperature: 0.7,
                        stream: true,
                      }),
                    })

                    if (followUpResponse.ok && followUpResponse.body) {
                      const reader = followUpResponse.body.getReader()
                      while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        const followUpText = decoder.decode(value)
                        const followUpLines = followUpText
                          .split('\n')
                          .filter((l) => l.trim() !== '')

                        for (const followUpLine of followUpLines) {
                          if (followUpLine.startsWith('data: ')) {
                            const followUpData = followUpLine.slice(6)
                            if (followUpData === '[DONE]') continue
                            try {
                              const json = JSON.parse(followUpData)
                              const content = json.choices[0]?.delta?.content || ''
                              if (content) {
                                controller.enqueue(
                                  encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
                                )
                              }
                            } catch {
                              // Skip malformed JSON
                            }
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.error('Tool call error:', error)
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          text: "I'm sorry, I couldn't complete that calendar operation. Please try again.",
                        })}\n\n`
                      )
                    )
                  }
                }
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              return
            }

            try {
              const json = JSON.parse(data)
              const delta = json.choices[0]?.delta

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index ?? 0
                  if (!accumulatedToolCalls.has(index)) {
                    accumulatedToolCalls.set(index, {
                      id: tc.id || `call_${index}`,
                      type: 'function',
                      function: { name: '', arguments: '' },
                    })
                  }
                  const accumulated = accumulatedToolCalls.get(index)!
                  if (tc.id) accumulated.id = tc.id
                  if (tc.function?.name) accumulated.function.name = tc.function.name
                  if (tc.function?.arguments)
                    accumulated.function.arguments += tc.function.arguments
                }
              }

              // Handle regular content
              const content = delta?.content || ''
              if (content && !isToolCallResponse) {
                console.log('Streaming text chunk:', content.slice(0, 50))
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
        Connection: 'keep-alive',
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
