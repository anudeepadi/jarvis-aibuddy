'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useJarvisStore } from '@/store/jarvis-store'
import { useElevenLabs } from '@/hooks/useElevenLabs'
import { useOpenAI } from '@/hooks/useOpenAI'
import { useGroqVoice } from '@/hooks/useGroqVoice'
import { useCartesiaStream } from '@/hooks/useCartesiaStream'
import { useGeminiLive } from '@/hooks/useGeminiLive'
import { useLocation } from '@/hooks/useLocation'
import { useWakeWord } from '@/hooks/useWakeWord'
import { FibonacciSphere } from '@/components/FibonacciSphere'
import { SettingsModal } from '@/components/SettingsModal'
import { CalendarView } from '@/components/calendar/CalendarView'
import { StatusHeader } from '@/components/ui/StatusHeader'

// ═══════════════════════════════════════════════════════════════════════════════
// FRAMER MOTION VARIANTS - Reusable animation configurations
// ═══════════════════════════════════════════════════════════════════════════════

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOADING SCREEN - Cinematic Intro
// ═══════════════════════════════════════════════════════════════════════════════

function LoadingScreen() {
  return (
    <motion.main
      className="w-full h-screen bg-void-50 flex items-center justify-center relative overflow-hidden"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Atmospheric background */}
      <div className="atmospheric-bg" />
      <div className="noise-overlay" />

      {/* Logo with glow - animated entrance */}
      <motion.div
        className="relative z-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="text-2xl font-light tracking-[0.3em] text-white/90 text-glow-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          JARVIS
        </motion.div>
        <motion.div
          className="flex items-center gap-1.5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-intelligence-500 animate-pulse" />
          <span className="text-xs font-mono text-white/40 tracking-widest uppercase">
            Initializing
          </span>
        </motion.div>
      </motion.div>
    </motion.main>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN JARVIS INTERFACE - Cinematic AI Companion
// ═══════════════════════════════════════════════════════════════════════════════

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
    geminiApiKey,
    lastMemorySaved,
    lastMemoryRetrieved,
    memoryEnabled,
    showCalendar,
    setShowCalendar,
    wakeWordEnabled,
    setWakeWordEnabled,
    setUserLocation,
  } = useJarvisStore()

  const elevenLabs = useElevenLabs()
  const openAI = useOpenAI()
  const groqVoice = useGroqVoice()
  const cartesiaStream = useCartesiaStream()
  const geminiLive = useGeminiLive()

  // Location hook
  const { location, requestLocation, permissionStatus: locationPermission } = useLocation()

  useEffect(() => {
    if (location) {
      setUserLocation({
        lat: location.latitude,
        lon: location.longitude,
        city: location.city,
      })
    }
  }, [location, setUserLocation])

  useEffect(() => {
    if (locationPermission === 'prompt') {
      const timer = setTimeout(() => requestLocation(), 2000)
      return () => clearTimeout(timer)
    }
  }, [locationPermission, requestLocation])

  // Provider selection
  const currentProvider =
    provider === 'gemini-live' ? geminiLive :
    provider === 'cartesia' ? cartesiaStream :
    provider === 'groq' ? groqVoice :
    provider === 'elevenlabs' ? elevenLabs :
    openAI

  const isConfigured =
    provider === 'gemini-live' ? !!geminiApiKey :
    provider === 'cartesia' ? (!!groqApiKey && (ttsProvider === 'edge' || !!cartesiaApiKey)) :
    provider === 'groq' ? !!groqApiKey :
    provider === 'elevenlabs' ? !!elevenLabsAgentId :
    !!openaiApiKey

  // Wake word detection
  const handleWakeWord = useCallback(() => {
    if (isConfigured && !isConnected) {
      console.log('Wake word detected! Starting conversation...')
      currentProvider.startConversation()
    }
  }, [isConfigured, isConnected, currentProvider])

  const {
    isListening: isWakeWordListening,
    isLoading: isWakeWordLoading,
    startListening: startWakeWord,
    stopListening: stopWakeWord,
    isSupported: isWakeWordSupported,
  } = useWakeWord({
    keyword: 'jarvis',
    onWakeWord: handleWakeWord,
  })

  useEffect(() => {
    if (wakeWordEnabled && isConfigured && !isWakeWordListening && !isWakeWordLoading) {
      startWakeWord()
    } else if (!wakeWordEnabled && isWakeWordListening) {
      stopWakeWord()
    }
  }, [wakeWordEnabled, isConfigured, isWakeWordListening, isWakeWordLoading, startWakeWord, stopWakeWord])

  useEffect(() => {
    if (isConnected && isWakeWordListening) {
      stopWakeWord()
    } else if (!isConnected && wakeWordEnabled && !isWakeWordListening && isConfigured) {
      const timer = setTimeout(() => startWakeWord(), 500)
      return () => clearTimeout(timer)
    }
  }, [isConnected, wakeWordEnabled, isWakeWordListening, isConfigured, startWakeWord, stopWakeWord])

  useEffect(() => {
    if (!isConfigured) setShowSettings(true)
  }, [isConfigured])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !showSettings && e.target === document.body) {
        e.preventDefault()
        if (isConnected) {
          if (state === 'speaking' && 'interrupt' in currentProvider && typeof (currentProvider as { interrupt?: () => void }).interrupt === 'function') {
            (currentProvider as { interrupt: () => void }).interrupt()
          } else {
            currentProvider.endConversation()
          }
        } else if (isConfigured) {
          currentProvider.startConversation()
        }
      } else if (e.code === 'Escape') {
        if (showSettings) setShowSettings(false)
        else if (isConnected) currentProvider.endConversation()
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
    if (isConnected) currentProvider.endConversation()
    else currentProvider.startConversation()
  }, [isConnected, isConfigured, currentProvider])

  const handleSphereClick = useCallback(() => {
    if (state === 'speaking' && 'interrupt' in currentProvider && typeof (currentProvider as { interrupt?: () => void }).interrupt === 'function') {
      (currentProvider as { interrupt: () => void }).interrupt()
    }
  }, [state, currentProvider])

  // Display text logic
  const getDisplayText = () => {
    if (state === 'speaking' && currentTranscript) return currentTranscript
    if (state === 'thinking' && messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg.role === 'user') return `"${lastMsg.content}"`
    }
    return ''
  }

  const displayText = getDisplayText()
  const isAISpeaking = state === 'speaking'

  // Theme-based styling
  const isDark = theme === 'dark'

  // Get orb container class based on state
  const getOrbContainerClass = () => {
    const base = 'orb-container'
    if (!isConnected) return base
    if (state === 'speaking') return `${base} active speaking`
    if (state === 'thinking') return `${base} active thinking`
    if (state === 'listening') return `${base} active listening`
    return `${base} active`
  }

  return (
    <motion.main
      className={`relative w-full h-screen overflow-hidden ${isDark ? '' : 'light-mode'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          ATMOSPHERIC BACKGROUND LAYER
          ═══════════════════════════════════════════════════════════════════ */}
      <div className={isDark ? 'atmospheric-bg-animated' : 'atmospheric-bg-light'} />
      <div className={`noise-overlay ${isDark ? '' : 'noise-overlay-light'}`} />

      {/* ═══════════════════════════════════════════════════════════════════
          HUD STATUS HEADER
          ═══════════════════════════════════════════════════════════════════ */}
      <motion.div
        className="absolute top-4 left-4 right-4 z-20"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <StatusHeader />
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════════════
          MEMORY INDICATORS (Below Status Header)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute top-16 left-6 z-20 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {lastMemoryRetrieved && memoryEnabled && (
            <motion.div
              key="memory-retrieved"
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <span className="text-xs text-status-listening flex items-center gap-1.5 font-mono">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                  <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                </svg>
                {lastMemoryRetrieved.count} {lastMemoryRetrieved.count === 1 ? 'memory' : 'memories'} retrieved
              </span>
            </motion.div>
          )}
          {lastMemorySaved && memoryEnabled && (
            <motion.div
              key="memory-saved"
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <span className="text-xs text-status-online flex items-center gap-1.5 font-mono">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Memory saved
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TOP BAR - User Menu & Controls
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute top-16 right-6 z-20 flex items-center gap-2">
        {/* User menu */}
        {session?.user && (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 rounded-full glass glass-hover transition-smooth"
            >
              {session.user.image ? (
                <img
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  className="w-7 h-7 rounded-full border border-white/10"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-void-600 flex items-center justify-center">
                  <span className="text-sm font-medium text-white/80">
                    {session.user.name?.[0] || session.user.email?.[0] || '?'}
                  </span>
                </div>
              )}
              <svg className="w-3.5 h-3.5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-elevated overflow-hidden z-40 animate-scale-in">
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-sm font-medium text-white truncate">{session.user.name}</p>
                    <p className="text-xs text-white/40 font-mono truncate">{session.user.email}</p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="w-full px-4 py-3 text-left text-sm text-status-error hover:bg-status-error/10 transition-colors flex items-center gap-2"
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

        {/* Control buttons - Glass style */}
        <div className="flex items-center gap-1.5">
          {isWakeWordSupported && (
            <button
              onClick={() => setWakeWordEnabled(!wakeWordEnabled)}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-smooth ${
                wakeWordEnabled
                  ? isWakeWordListening
                    ? 'glass-active text-status-online'
                    : 'glass text-status-warning'
                  : 'glass glass-hover text-white/40 hover:text-white/70'
              }`}
              aria-label={wakeWordEnabled ? 'Disable wake word' : 'Enable wake word'}
              title={wakeWordEnabled ? (isWakeWordListening ? 'Listening for "Hey Jarvis"' : 'Wake word loading...') : 'Click to enable "Hey Jarvis"'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.536a5 5 0 001.414 1.414m2.828-9.9a9 9 0 012.828-2.828" />
                {!wakeWordEnabled && (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6" />
                )}
              </svg>
            </button>
          )}

          <button
            onClick={() => setShowCalendar(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full glass glass-hover text-white/40 hover:text-white/70 transition-smooth"
            aria-label="Calendar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <button
            onClick={toggleTheme}
            className="w-10 h-10 flex items-center justify-center rounded-full glass glass-hover text-white/40 hover:text-white/70 transition-smooth"
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

          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center rounded-full glass glass-hover text-white/40 hover:text-white/70 transition-smooth"
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TRANSCRIPT DISPLAY - Above Sphere
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-6">
        {/* State indicator */}
        {isConnected && (
          <div className="flex justify-center mb-3">
            <span className={`text-[10px] font-mono uppercase tracking-[0.2em] ${
              isAISpeaking ? 'text-intelligence-400 text-glow-sm' : 'text-white/30'
            }`}>
              {state === 'speaking' ? '◉ Speaking' : state === 'listening' ? '◎ Listening' : state === 'thinking' ? '◈ Processing' : state}
            </span>
          </div>
        )}

        {/* Transcript text */}
        {displayText && (
          <div className="max-h-[25vh] overflow-y-auto scrollbar-thin">
            <p className={`text-center leading-relaxed transition-all duration-300 ${
              isAISpeaking
                ? 'text-white text-lg'
                : 'text-white/50 text-base italic'
            }`}>
              {displayText}
            </p>
          </div>
        )}

        {/* Thinking indicator */}
        {state === 'thinking' && (
          <div className="flex justify-center items-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-neural-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-neural-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-neural-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Interrupt hint */}
        {state === 'speaking' && (
          <p className="text-center text-[10px] font-mono text-white/20 mt-3 tracking-wider">
            TAP SPHERE OR PRESS SPACE TO INTERRUPT
          </p>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SPHERE VISUALIZATION - Central Focus
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`w-[280px] h-[280px] md:w-[350px] md:h-[350px] ${getOrbContainerClass()} ${state === 'speaking' ? 'cursor-pointer' : ''}`}
          onClick={handleSphereClick}
        >
          <FibonacciSphere theme={theme} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM CONTROLS - Action Buttons
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
        {/* Status label */}
        {isConnected && (
          <span className="text-[10px] font-mono text-white/30 tracking-widest uppercase">
            {state === 'speaking' ? 'Interrupt or End' : 'End Session'}
          </span>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          {isConnected && (
            <button
              onClick={() => currentProvider.endConversation()}
              className="w-14 h-14 rounded-full glass glass-hover flex items-center justify-center transition-smooth group"
            >
              <svg className="w-6 h-6 text-white/50 group-hover:text-status-error transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            onClick={handleMainAction}
            disabled={micPermission === 'denied'}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-smooth ${
              micPermission === 'denied'
                ? 'glass opacity-50 cursor-not-allowed'
                : isConnected
                  ? 'glass-active shadow-glow-cyan'
                  : 'glass glass-hover hover:shadow-glow-cyan'
            }`}
          >
            <svg className={`w-7 h-7 ${isConnected ? 'text-intelligence-400' : 'text-white/60'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </button>
        </div>

        {/* Keyboard hint */}
        {!isConnected && isConfigured && (
          <span className="text-[10px] font-mono text-white/20 tracking-wider">
            PRESS SPACE TO START
          </span>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════════ */}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      {showCalendar && <CalendarView onClose={() => setShowCalendar(false)} />}
    </main>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export default function JarvisPage() {
  const hasHydrated = useJarvisStore((s) => s._hasHydrated)

  if (!hasHydrated) {
    return <LoadingScreen />
  }

  return <JarvisInterface />
}
