'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { X, ChevronLeft, ChevronRight, Plus, Calendar, Clock, MapPin } from 'lucide-react'
import { EventModal } from './EventModal'

interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
}

interface CalendarViewProps {
  onClose: () => void
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function CalendarView({ onClose }: CalendarViewProps) {
  const { data: session } = useSession()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!session) return

    setLoading(true)
    try {
      // Get first and last day of current month view (including partial weeks)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)

      // Extend to full weeks
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - startDate.getDay())
      const endDate = new Date(lastDay)
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()))

      const response = await fetch(
        `/api/calendar?timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}&maxResults=100`
      )

      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error('Failed to fetch events:', error)
    } finally {
      setLoading(false)
    }
  }, [session, currentDate])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days: (Date | null)[] = []

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      const prevDate = new Date(year, month, -startingDay + i + 1)
      days.push(prevDate)
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }

    // Add days after the month to complete the grid
    const remainingDays = 42 - days.length // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i))
    }

    return days
  }

  const getEventsForDay = (date: Date) => {
    return events.filter((event) => {
      const eventStart = event.start.dateTime || event.start.date
      if (!eventStart) return false
      const eventDate = new Date(eventStart)
      return (
        eventDate.getFullYear() === date.getFullYear() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getDate() === date.getDate()
      )
    })
  }

  const formatEventTime = (event: CalendarEvent) => {
    if (event.start.date) return 'All day'
    if (event.start.dateTime) {
      return new Date(event.start.dateTime).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    }
    return ''
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth()
  }

  const handleDayClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvent(null)
    setShowEventModal(true)
  }

  const handleEventClick = (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedEvent(event)
    setSelectedDate(null)
    setShowEventModal(true)
  }

  const handleEventSaved = () => {
    setShowEventModal(false)
    setSelectedEvent(null)
    setSelectedDate(null)
    fetchEvents()
  }

  const handleEventDeleted = () => {
    setShowEventModal(false)
    setSelectedEvent(null)
    fetchEvents()
  }

  if (!session) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 text-center max-w-md">
          <Calendar className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Sign in Required</h2>
          <p className="text-zinc-400 mb-4">
            Please sign in with Google to access your calendar.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Calendar
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-zinc-400" />
              </button>
              <span className="text-white font-medium min-w-[160px] text-center">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-zinc-400" />
              </button>
              <button
                onClick={goToToday}
                className="ml-2 px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
              >
                Today
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDate(new Date())
                setSelectedEvent(null)
                setShowEventModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Event
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-medium text-zinc-500 py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {getDaysInMonth().map((date, index) => {
                  if (!date) return <div key={index} />

                  const dayEvents = getEventsForDay(date)
                  const isCurrentMonthDay = isCurrentMonth(date)
                  const isTodayDate = isToday(date)

                  return (
                    <div
                      key={index}
                      onClick={() => handleDayClick(date)}
                      className={`
                        min-h-[100px] p-1 rounded-lg border cursor-pointer transition-colors
                        ${isCurrentMonthDay ? 'bg-zinc-800/50 border-zinc-700' : 'bg-zinc-900/50 border-zinc-800'}
                        ${isTodayDate ? 'ring-2 ring-cyan-400/50' : ''}
                        hover:bg-zinc-700/50
                      `}
                    >
                      <div
                        className={`
                          text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full
                          ${isTodayDate ? 'bg-cyan-500 text-white' : ''}
                          ${isCurrentMonthDay ? 'text-white' : 'text-zinc-600'}
                        `}
                      >
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            onClick={(e) => handleEventClick(event, e)}
                            className="text-xs px-1.5 py-0.5 bg-cyan-600/20 text-cyan-300 rounded truncate hover:bg-cyan-600/30 transition-colors"
                            title={event.summary}
                          >
                            {formatEventTime(event)} {event.summary}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-xs text-zinc-500 px-1.5">
                            +{dayEvents.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Upcoming Events Panel */}
        <div className="border-t border-zinc-800 p-4 max-h-[200px] overflow-auto">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Upcoming Events</h3>
          <div className="space-y-2">
            {events
              .filter((e) => {
                const eventDate = new Date(e.start.dateTime || e.start.date || '')
                return eventDate >= new Date()
              })
              .slice(0, 5)
              .map((event) => (
                <div
                  key={event.id}
                  onClick={(e) => handleEventClick(event, e)}
                  className="flex items-start gap-3 p-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <div className="flex-shrink-0">
                    <Calendar className="w-4 h-4 text-cyan-400 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {event.summary}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(event.start.dateTime || event.start.date || '').toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        {event.start.dateTime &&
                          new Date(event.start.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            {events.filter((e) => new Date(e.start.dateTime || e.start.date || '') >= new Date()).length === 0 && (
              <p className="text-sm text-zinc-500">No upcoming events</p>
            )}
          </div>
        </div>
      </div>

      {/* Event Modal */}
      {showEventModal && (
        <EventModal
          event={selectedEvent}
          defaultDate={selectedDate}
          onClose={() => {
            setShowEventModal(false)
            setSelectedEvent(null)
            setSelectedDate(null)
          }}
          onSaved={handleEventSaved}
          onDeleted={handleEventDeleted}
        />
      )}
    </div>
  )
}
