'use client'

import { useJarvisStore } from '@/store/jarvis-store'

interface StatusHeaderProps {
  className?: string
}

export function StatusHeader({ className = '' }: StatusHeaderProps) {
  const {
    state,
    isConnected,
    theme,
    userLocation,
    memoryEnabled,
  } = useJarvisStore()

  const isDark = theme === 'dark'

  // Determine system status
  const getSystemStatus = () => {
    if (!isConnected) return { label: 'STANDBY', dotClass: 'status-dot-online' }
    switch (state) {
      case 'listening':
        return { label: 'LISTENING', dotClass: 'status-dot-listening' }
      case 'thinking':
        return { label: 'PROCESSING', dotClass: 'status-dot-thinking' }
      case 'speaking':
        return { label: 'SPEAKING', dotClass: 'status-dot-speaking' }
      case 'error':
        return { label: 'ERROR', dotClass: 'status-dot-error' }
      default:
        return { label: 'ONLINE', dotClass: 'status-dot-online' }
    }
  }

  const systemStatus = getSystemStatus()

  // Format location
  const locationDisplay = userLocation?.city || 'UNKNOWN'

  // Get current time
  const now = new Date()
  const timeDisplay = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  return (
    <div className={`flex items-center justify-between w-full ${className}`}>
      {/* Left side - System Status */}
      <div className="flex items-center gap-3">
        <div className={`hud-pill ${isDark ? '' : 'hud-pill-light'}`}>
          <span className={`status-dot ${systemStatus.dotClass}`} />
          <span>SYS: {systemStatus.label}</span>
        </div>

        {memoryEnabled && (
          <div className={`hud-pill ${isDark ? '' : 'hud-pill-light'}`}>
            <svg
              className="w-3 h-3 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
              />
            </svg>
            <span>MEM: ON</span>
          </div>
        )}
      </div>

      {/* Right side - Location, Time */}
      <div className="flex items-center gap-3">
        {userLocation && (
          <div className={`hud-pill ${isDark ? '' : 'hud-pill-light'}`}>
            <svg
              className="w-3 h-3 opacity-60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>LOC: {locationDisplay.toUpperCase()}</span>
          </div>
        )}

        <div className={`hud-pill ${isDark ? '' : 'hud-pill-light'}`}>
          <span className="opacity-60">◷</span>
          <span>{timeDisplay}</span>
        </div>
      </div>
    </div>
  )
}

// Compact version for mobile or minimal UI
export function StatusHeaderCompact({ className = '' }: StatusHeaderProps) {
  const { state, isConnected, theme } = useJarvisStore()
  const isDark = theme === 'dark'

  const getStatusInfo = () => {
    if (!isConnected) return { label: 'READY', dotClass: 'status-dot-online' }
    switch (state) {
      case 'listening':
        return { label: 'LISTENING', dotClass: 'status-dot-listening' }
      case 'thinking':
        return { label: 'THINKING', dotClass: 'status-dot-thinking' }
      case 'speaking':
        return { label: 'SPEAKING', dotClass: 'status-dot-speaking' }
      case 'error':
        return { label: 'ERROR', dotClass: 'status-dot-error' }
      default:
        return { label: 'ACTIVE', dotClass: 'status-dot-online' }
    }
  }

  const statusInfo = getStatusInfo()

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`hud-pill ${isDark ? '' : 'hud-pill-light'}`}>
        <span className={`status-dot ${statusInfo.dotClass}`} />
        <span>{statusInfo.label}</span>
      </div>
    </div>
  )
}
