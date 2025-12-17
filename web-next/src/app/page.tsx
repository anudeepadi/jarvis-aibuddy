'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useJarvisStore } from '@/store/jarvis-store'
import { useElevenLabs } from '@/hooks/useElevenLabs'
import { useOpenAI } from '@/hooks/useOpenAI'
import { useGroqVoice } from '@/hooks/useGroqVoice'
import { useCartesiaStream } from '@/hooks/useCartesiaStream'
import { FibonacciSphere } from '@/components/FibonacciSphere'
import { SettingsModal } from '@/components/SettingsModal'

function LoadingScreen() {
  return (
    <main className="w-full h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="text-white text-xl tracking-wide">Jarvis</div>
    </main>
  )
}

function JarvisInterface() {
  const [showSettings, setShowSettings] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const { data: session } = useSession()

  const {
    state,
    provider,
    ttsProvider,
    theme,
    toggleTheme,
    isConnected,
    currentTranscript,
    messages,
    micPermission,
    elevenLabsAgentId,
    openaiApiKey,
    groqApiKey,
    cartesiaApiKey,
    lastMemorySaved,
    lastMemoryRetrieved,
    memoryEnabled,
  } = useJarvisStore()

  const elevenLabs = useElevenLabs()
  const openAI = useOpenAI()
  const groqVoice = useGroqVoice()
  const cartesiaStream = useCartesiaStream()

  // Provider selection: cartesia (best value), elevenlabs (best quality), groq (cheapest), openai (fallback)
  const currentProvider =
    provider === 'cartesia' ? cartesiaStream :
    provider === 'groq' ? groqVoice :
    provider === 'elevenlabs' ? elevenLabs :
    openAI

  // Cartesia provider: needs Groq API key, and Cartesia key only if using Cartesia TTS (not Edge)
  const isConfigured =
    provider === 'cartesia' ? (!!groqApiKey && (ttsProvider === 'edge' || !!cartesiaApiKey)) :
    provider === 'groq' ? !!groqApiKey :
    provider === 'elevenlabs' ? !!elevenLabsAgentId :
    !!openaiApiKey

  useEffect(() => {
    if (!isConfigured) {
      setShowSettings(true)
    }
  }, [isConfigured])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showSettings && e.target === document.body) {
        e.preventDefault()
        if (isConnected) {
          // If speaking, interrupt instead of ending
          if (state === 'speaking' && 'interrupt' in currentProvider && typeof (currentProvider as { interrupt?: () => void }).interrupt === 'function') {
            (currentProvider as { interrupt: () => void }).interrupt()
          } else {
            currentProvider.endConversation()
          }
        } else if (isConfigured) {
          currentProvider.startConversation()
        }
      } else if (e.code === 'Escape') {
        if (showSettings) {
          setShowSettings(false)
        } else if (isConnected) {
          currentProvider.endConversation()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConnected, isConfigured, showSettings, currentProvider, state])

  const handleMainAction = useCallback(() => {
    if (!isConfigured) {
      setShowSettings(true)
      return
    }

    if (isConnected) {
      currentProvider.endConversation()
    } else {
      currentProvider.startConversation()
    }
  }, [isConnected, isConfigured, currentProvider])

  // Handle sphere click - interrupt if speaking
  const handleSphereClick = useCallback(() => {
    if (state === 'speaking' && 'interrupt' in currentProvider && typeof (currentProvider as { interrupt?: () => void }).interrupt === 'function') {
      (currentProvider as { interrupt: () => void }).interrupt()
    }
  }, [state, currentProvider])

  // Get display text based on state - only show transcript when speaking
  const getDisplayText = () => {
    // Only show AI response when actually speaking (not while processing)
    if (state === 'speaking' && currentTranscript) {
      return currentTranscript
    }

    // Show user's message while thinking (typing indicator shown separately)
    if (state === 'thinking') {
      // Find the last user message if any
      if (messages.length > 0) {
        const lastMsg = messages[messages.length - 1]
        if (lastMsg.role === 'user') {
          return `"${lastMsg.content}"`
        }
      }
      return ''
    }

    // While listening, show nothing (just visual feedback from sphere)
    if (state === 'listening') {
      return ''
    }

    return ''
  }

  const displayText = getDisplayText()
  const isAISpeaking = state === 'speaking'

  // Theme-based colors
  const isDark = theme === 'dark'
  const bgColor = isDark ? 'bg-[#0d0d0d]' : 'bg-[#f5f5f5]'
  const textColor = isDark ? 'text-white' : 'text-gray-900'
  const mutedColor = isDark ? 'text-gray-500' : 'text-gray-400'
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-300'
  const buttonBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white'
  const buttonHover = isDark ? 'hover:bg-[#252525]' : 'hover:bg-gray-100'

  return (
    <main className={`relative w-full h-screen ${bgColor} overflow-hidden`}>
      {/* Status indicators (top left) */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
        {/* Memory retrieved indicator */}
        {lastMemoryRetrieved && memoryEnabled && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className={`text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'} flex items-center gap-1`}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              {lastMemoryRetrieved.count} {lastMemoryRetrieved.count === 1 ? 'memory' : 'memories'} found
            </span>
          </div>
        )}

        {/* Memory saved indicator */}
        {lastMemorySaved && memoryEnabled && (
          <div className="flex items-center gap-2 animate-fade-in">
            <span className={`text-xs ${isDark ? 'text-emerald-400' : 'text-emerald-600'} flex items-center gap-1`}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Remembered
            </span>
          </div>
        )}
      </div>

      {/* Top bar with user menu, theme toggle and settings */}
      <div className="absolute top-6 right-6 z-20 flex items-center gap-3">
        {/* User menu */}
        {session?.user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-8 h-8 rounded-full border border-gray-700"
                />
              ) : (
                <div className={`w-8 h-8 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-300'} flex items-center justify-center`}>
                  <span className={`text-sm font-medium ${textColor}`}>
                    {session.user.name?.[0] || session.user.email?.[0] || '?'}
                  </span>
                </div>
              )}
              <svg className={`w-4 h-4 ${mutedColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                <div className={`absolute right-0 mt-2 w-56 rounded-xl ${isDark ? 'bg-gray-900' : 'bg-white'} border ${borderColor} shadow-lg z-40 overflow-hidden`}>
                  <div className={`px-4 py-3 border-b ${borderColor}`}>
                    <p className={`text-sm font-medium ${textColor} truncate`}>{session.user.name}</p>
                    <p className={`text-xs ${mutedColor} truncate`}>{session.user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className={`w-full px-4 py-3 text-left text-sm ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'} transition-colors flex items-center gap-2`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className={`w-10 h-10 flex items-center justify-center rounded-full ${mutedColor} hover:${textColor} hover:bg-white/10 transition-colors`}
          aria-label="Toggle theme"
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>

        {/* Settings button */}
        <button
          onClick={() => setShowSettings(true)}
          className={`w-10 h-10 flex items-center justify-center rounded-full ${mutedColor} hover:${textColor} hover:bg-white/10 transition-colors`}
          aria-label="Settings"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Transcript above sphere */}
      <div className="absolute top-[8%] left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-6">
        {/* State indicator */}
        {isConnected && (
          <div className="flex justify-center mb-2">
            <span className={`text-xs uppercase tracking-widest ${
              isAISpeaking ? 'text-cyan-400' : mutedColor
            }`}>
              {state === 'speaking' ? 'Speaking' : state === 'listening' ? 'Listening' : state === 'thinking' ? 'Thinking' : state}
            </span>
          </div>
        )}

        {/* Transcript text with max height and scroll */}
        {displayText && (
          <div className="max-h-[25vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600">
            <p className={`text-center leading-relaxed transition-all ${
              isAISpeaking
                ? `${textColor} text-lg`
                : `${isDark ? 'text-gray-300' : 'text-gray-600'} text-base italic`
            }`}>
              {displayText}
            </p>
          </div>
        )}

        {/* Typing indicator when thinking */}
        {state === 'thinking' && (
          <div className="flex justify-center items-center gap-1 mt-3">
            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'} animate-bounce`} style={{ animationDelay: '0ms' }} />
            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'} animate-bounce`} style={{ animationDelay: '150ms' }} />
            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'} animate-bounce`} style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Interrupt hint when speaking */}
        {state === 'speaking' && (
          <p className={`text-center text-xs ${mutedColor} mt-2`}>
            Tap sphere or press SPACE to interrupt
          </p>
        )}
      </div>

      {/* Sphere - clickable to interrupt */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-[280px] h-[280px] md:w-[350px] md:h-[350px] ${state === 'speaking' ? 'cursor-pointer' : ''}`}
          onClick={handleSphereClick}
        >
          <FibonacciSphere theme={theme} />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
        {/* End Session label */}
        {isConnected && (
          <span className={`${mutedColor} text-sm`}>
            {state === 'speaking' ? 'Interrupt or End' : 'End Session'}
          </span>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-4">
          {isConnected && (
            <button
              onClick={() => currentProvider.endConversation()}
              className={`w-14 h-14 rounded-full ${buttonBg} border ${borderColor} flex items-center justify-center ${buttonHover} transition-colors`}
            >
              <svg className={`w-6 h-6 ${textColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            onClick={handleMainAction}
            disabled={micPermission === 'denied'}
            className={`w-14 h-14 rounded-full ${buttonBg} border ${borderColor} flex items-center justify-center ${buttonHover} transition-colors ${micPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className={`w-6 h-6 ${textColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </main>
  )
}

export default function JarvisPage() {
  const hasHydrated = useJarvisStore((s) => s._hasHydrated)

  if (!hasHydrated) {
    return <LoadingScreen />
  }

  return <JarvisInterface />
}
