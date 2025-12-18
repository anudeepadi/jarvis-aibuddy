import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getValidAccessToken, getCalendarClient } from '@/lib/google-calendar'

// GET /api/calendar/[eventId] - Get a single event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await params

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)

    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    })

    return NextResponse.json({ event: response.data })
  } catch (error) {
    console.error('Calendar get event error:', error)
    const message = error instanceof Error ? error.message : 'Failed to get event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT /api/calendar/[eventId] - Update an event
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await params
    const body = await request.json()
    const { summary, start, end, location, description, attendees } = body

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)

    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId,
    })

    // Build update object, only including provided fields
    const updateResource: {
      summary?: string
      location?: string
      description?: string
      start?: { date?: string; dateTime?: string; timeZone?: string }
      end?: { date?: string; dateTime?: string; timeZone?: string }
      attendees?: { email: string }[]
    } = {}

    if (summary !== undefined) updateResource.summary = summary
    if (location !== undefined) updateResource.location = location
    if (description !== undefined) updateResource.description = description

    if (start !== undefined) {
      const isAllDay = !start.includes('T')
      updateResource.start = isAllDay
        ? { date: start }
        : { dateTime: start, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    }

    if (end !== undefined) {
      const isAllDay = !end.includes('T')
      updateResource.end = isAllDay
        ? { date: end }
        : { dateTime: end, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
    }

    if (attendees !== undefined && Array.isArray(attendees)) {
      updateResource.attendees = attendees.map((email: string) => ({ email }))
    }

    const response = await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        ...existingEvent.data,
        ...updateResource,
      },
    })

    return NextResponse.json({
      event: response.data,
      message: `Event updated successfully`,
    })
  } catch (error) {
    console.error('Calendar update error:', error)
    const message = error instanceof Error ? error.message : 'Failed to update event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/calendar/[eventId] - Delete an event
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { eventId } = await params

    const accessToken = await getValidAccessToken(session.user.id)
    const calendar = getCalendarClient(accessToken)

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
    })

    return NextResponse.json({
      message: 'Event deleted successfully',
    })
  } catch (error) {
    console.error('Calendar delete error:', error)
    const message = error instanceof Error ? error.message : 'Failed to delete event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
