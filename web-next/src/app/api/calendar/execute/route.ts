import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidAccessToken, getCalendarClient } from '@/lib/google-calendar'

interface CalendarFunctionArgs {
  summary?: string
  start?: string
  end?: string
  location?: string
  description?: string
  eventId?: string
  timeMin?: string
  timeMax?: string
  maxResults?: number
  query?: string
}

// POST /api/calendar/execute - Execute calendar functions from LLM
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { function_name, arguments: args } = body as {
      function_name: string
      arguments: CalendarFunctionArgs
    }

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

    switch (function_name) {
      case 'create_calendar_event': {
        const { summary, start, end, location, description } = args

        if (!summary || !start || !end) {
          return NextResponse.json({
            success: false,
            error: 'Missing required fields: summary, start, end',
          })
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

        return NextResponse.json({
          success: true,
          message: `Created event "${summary}" on ${new Date(start).toLocaleDateString()}`,
          event: {
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
            htmlLink: response.data.htmlLink,
          },
        })
      }

      case 'list_calendar_events': {
        const {
          timeMin = new Date().toISOString(),
          timeMax = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          maxResults = 10,
          query,
        } = args

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
          description: event.description,
        }))

        if (events.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'No events found in the specified time range.',
            events: [],
          })
        }

        return NextResponse.json({
          success: true,
          message: `Found ${events.length} event(s)`,
          events,
        })
      }

      case 'update_calendar_event': {
        const { eventId, summary, start, end, location, description } = args

        if (!eventId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: eventId',
          })
        }

        // Get existing event first
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

        return NextResponse.json({
          success: true,
          message: `Updated event "${response.data.summary}"`,
          event: {
            id: response.data.id,
            summary: response.data.summary,
            start: response.data.start,
            end: response.data.end,
          },
        })
      }

      case 'delete_calendar_event': {
        const { eventId } = args

        if (!eventId) {
          return NextResponse.json({
            success: false,
            error: 'Missing required field: eventId',
          })
        }

        // Get event details before deleting for confirmation message
        const eventToDelete = await calendar.events.get({
          calendarId: 'primary',
          eventId,
        })

        await calendar.events.delete({
          calendarId: 'primary',
          eventId,
        })

        return NextResponse.json({
          success: true,
          message: `Deleted event "${eventToDelete.data.summary}"`,
        })
      }

      case 'check_availability': {
        const {
          timeMin = new Date().toISOString(),
          timeMax = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        } = args

        const response = await calendar.events.list({
          calendarId: 'primary',
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
        })

        const events = response.data.items || []

        if (events.length === 0) {
          return NextResponse.json({
            success: true,
            message: 'You are free during this time period.',
            available: true,
            events: [],
          })
        }

        const busyTimes = events.map((event) => ({
          summary: event.summary,
          start: event.start?.dateTime || event.start?.date,
          end: event.end?.dateTime || event.end?.date,
        }))

        return NextResponse.json({
          success: true,
          message: `You have ${events.length} event(s) during this time.`,
          available: false,
          events: busyTimes,
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown function: ${function_name}`,
        })
    }
  } catch (error) {
    console.error('Calendar execute error:', error)
    const message = error instanceof Error ? error.message : 'Failed to execute calendar function'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
