import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidAccessToken, getCalendarClient } from '@/lib/google-calendar'

// GET /api/calendar - List calendar events
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeMin = searchParams.get('timeMin') || new Date().toISOString()
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const maxResults = parseInt(searchParams.get('maxResults') || '50', 10)

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    })

    return NextResponse.json({
      events: response.data.items || [],
      nextPageToken: response.data.nextPageToken,
    })
  } catch (error) {
    console.error('Calendar list error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch events'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/calendar - Create a new event
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { summary, start, end, location, description, attendees } = body

    if (!summary || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required fields: summary, start, end' },
        { status: 400 }
      )
    }

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)

    // Determine if this is an all-day event or timed event
    const isAllDay = !start.includes('T')

    const eventResource: {
      summary: string
      location?: string
      description?: string
      start: { date?: string; dateTime?: string; timeZone?: string }
      end: { date?: string; dateTime?: string; timeZone?: string }
      attendees?: { email: string }[]
    } = {
      summary,
      location,
      description,
      start: isAllDay
        ? { date: start }
        : { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      end: isAllDay
        ? { date: end }
        : { dateTime: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }

    if (attendees && Array.isArray(attendees)) {
      eventResource.attendees = attendees.map((email: string) => ({ email }))
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: eventResource,
    })

    return NextResponse.json({
      event: response.data,
      message: `Event "${summary}" created successfully`,
    })
  } catch (error) {
    console.error('Calendar create error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
