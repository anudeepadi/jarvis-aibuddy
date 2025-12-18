'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, Clock, MapPin, FileText, Trash2, ExternalLink } from 'lucide-react'

interface CalendarEvent {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
  description?: string
  htmlLink?: string
}

interface EventModalProps {
  event: CalendarEvent | null
  defaultDate: Date | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

export function EventModal({ event, defaultDate, onClose, onSaved, onDeleted }: EventModalProps) {
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [summary, setSummary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [isAllDay, setIsAllDay] = useState(false)

  const isEditing = !!event

  useEffect(() => {
    if (event) {
      setSummary(event.summary || '')
      setLocation(event.location || '')
      setDescription(event.description || '')

      if (event.start.date) {
        // All day event
        setIsAllDay(true)
        setStartDate(event.start.date)
        setEndDate(event.end.date || event.start.date)
        setStartTime('')
        setEndTime('')
      } else if (event.start.dateTime) {
        setIsAllDay(false)
        const start = new Date(event.start.dateTime)
        const end = new Date(event.end.dateTime || event.start.dateTime)
        setStartDate(start.toISOString().split('T')[0])
        setStartTime(start.toTimeString().slice(0, 5))
        setEndDate(end.toISOString().split('T')[0])
        setEndTime(end.toTimeString().slice(0, 5))
      }
    } else if (defaultDate) {
      const dateStr = defaultDate.toISOString().split('T')[0]
      setStartDate(dateStr)
      setEndDate(dateStr)
      // Default to current hour + 1
      const now = new Date()
      const startHour = now.getHours() + 1
      setStartTime(`${startHour.toString().padStart(2, '0')}:00`)
      setEndTime(`${(startHour + 1).toString().padStart(2, '0')}:00`)
    }
  }, [event, defaultDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!summary.trim()) {
      setError('Event title is required')
      return
    }

    if (!startDate) {
      setError('Start date is required')
      return
    }

    setLoading(true)

    try {
      let start: string
      let end: string

      if (isAllDay) {
        start = startDate
        end = endDate || startDate
      } else {
        const startDateTime = new Date(`${startDate}T${startTime || '00:00'}`)
        const endDateTime = new Date(`${endDate || startDate}T${endTime || startTime || '00:00'}`)

        // If end is before start, adjust
        if (endDateTime <= startDateTime) {
          endDateTime.setHours(startDateTime.getHours() + 1)
        }

        start = startDateTime.toISOString()
        end = endDateTime.toISOString()
      }

      const body = {
        summary: summary.trim(),
        start,
        end,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      }

      let response: Response

      if (isEditing && event) {
        response = await fetch(`/api/calendar/${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        response = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save event')
      }

      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!event || !confirm('Are you sure you want to delete this event?')) return

    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/calendar/${event.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete event')
      }

      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-zinc-900 rounded-xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Event' : 'New Event'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Event title"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
              autoFocus
            />
          </div>

          {/* All Day Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllDay}
              onChange={(e) => setIsAllDay(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-zinc-900"
            />
            <span className="text-sm text-zinc-300">All day event</span>
          </label>

          {/* Date/Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            {!isAllDay && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Start Time
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            {!isAllDay && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  End Time
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" />
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <div>
              {isEditing && event?.htmlLink && (
                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Google Calendar
                </a>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 px-3 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white transition-colors disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEditing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
