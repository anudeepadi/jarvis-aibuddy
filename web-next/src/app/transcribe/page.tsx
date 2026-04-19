'use client'

import { useState, useCallback } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'
import { useSpeechToText } from '@/hooks/useSpeechToText'
import { Mic, Square, Copy, Check, Trash2, ArrowLeft, Sun, Moon } from 'lucide-react'
import Link from 'next/link'

export default function TranscribePage() {
  const { theme, toggleTheme, _hasHydrated } = useJarvisStore()
  const { state, transcript, interimTranscript, audioLevel, start, stop, clear, isReady } = useSpeechToText()
  const [copied, setCopied] = useState(false)

  const isDark = theme === 'dark'

  const handleStartStop = useCallback(async () => {
    if (state === 'recording') {
      stop()
    } else if (state === 'idle') {
      await start()
    }
  }, [state, start, stop])

  const handleCopy = useCallback(async () => {
    if (!transcript) return

    try {
      await navigator.clipboard.writeText(transcript)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }, [transcript])

  const handleClear = useCallback(() => {
    clear()
  }, [clear])

  // Wait for hydration
  if (!_hasHydrated) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? 'bg-[#0d0d0d]' : 'bg-[#f5f5f5]'}`}>
        <div className={`animate-pulse ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
          Loading...
        </div>
      </div>
    )
  }

  const displayText = transcript + (interimTranscript ? (transcript ? ' ' : '') + interimTranscript : '')
  const hasContent = displayText.trim().length > 0

  return (
    <main className={`min-h-screen ${isDark ? 'bg-[#0d0d0d]' : 'bg-[#f5f5f5]'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 px-4 py-3 ${isDark ? 'bg-[#0d0d0d]/80' : 'bg-[#f5f5f5]/80'} backdrop-blur-md border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/10 text-black/70'}`}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Voice Transcription
            </h1>
          </div>

          <button
            onClick={toggleTheme}
            className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10 text-white/70' : 'hover:bg-black/10 text-black/70'}`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="pt-20 pb-32 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Status indicator */}
          <div className="mb-6 text-center">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${
              state === 'recording'
                ? 'bg-red-500/20 text-red-400'
                : state === 'processing'
                ? 'bg-yellow-500/20 text-yellow-400'
                : isDark
                ? 'bg-white/10 text-white/60'
                : 'bg-black/10 text-black/60'
            }`}>
              {state === 'recording' && (
                <span
                  className="w-2 h-2 rounded-full bg-red-500"
                  style={{
                    animation: 'pulse 1s ease-in-out infinite',
                    transform: `scale(${1 + audioLevel * 0.5})`,
                  }}
                />
              )}
              <span className="text-sm font-medium">
                {state === 'recording'
                  ? 'Listening...'
                  : state === 'processing'
                  ? 'Processing...'
                  : 'Ready to transcribe'}
              </span>
            </div>
          </div>

          {/* Transcript area */}
          <div
            className={`min-h-[300px] max-h-[60vh] overflow-y-auto rounded-2xl p-6 ${
              isDark
                ? 'bg-white/5 border border-white/10'
                : 'bg-white border border-black/10 shadow-sm'
            }`}
          >
            {hasContent ? (
              <p className={`text-lg leading-relaxed ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {transcript}
                {interimTranscript && (
                  <span className={isDark ? 'text-white/50' : 'text-gray-400'}>
                    {transcript ? ' ' : ''}{interimTranscript}
                  </span>
                )}
                {state === 'recording' && (
                  <span className="inline-block w-0.5 h-5 ml-0.5 bg-blue-500 animate-pulse" />
                )}
              </p>
            ) : (
              <p className={`text-lg ${isDark ? 'text-white/30' : 'text-gray-400'} text-center mt-24`}>
                {state === 'recording'
                  ? 'Start speaking...'
                  : 'Press the microphone button to start transcribing'}
              </p>
            )}
          </div>

          {/* Word count */}
          {hasContent && (
            <div className={`mt-3 text-sm ${isDark ? 'text-white/40' : 'text-gray-500'} text-right`}>
              {displayText.trim().split(/\s+/).length} words • {displayText.length} characters
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className={`fixed bottom-0 left-0 right-0 px-4 py-6 ${isDark ? 'bg-[#0d0d0d]/80' : 'bg-[#f5f5f5]/80'} backdrop-blur-md border-t ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
          {/* Clear button */}
          <button
            onClick={handleClear}
            disabled={!hasContent || state !== 'idle'}
            className={`p-3 rounded-full transition-all ${
              hasContent && state === 'idle'
                ? isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white/70'
                  : 'bg-black/10 hover:bg-black/20 text-black/70'
                : isDark
                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                : 'bg-black/5 text-black/20 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-5 h-5" />
          </button>

          {/* Main record/stop button */}
          <button
            onClick={handleStartStop}
            disabled={state === 'processing'}
            className={`relative p-6 rounded-full transition-all transform active:scale-95 ${
              state === 'recording'
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : state === 'processing'
                ? isDark
                  ? 'bg-white/20 text-white/50 cursor-not-allowed'
                  : 'bg-black/20 text-black/50 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/30'
            }`}
          >
            {/* Pulsing ring when recording */}
            {state === 'recording' && (
              <span
                className="absolute inset-0 rounded-full bg-red-500/30"
                style={{
                  transform: `scale(${1 + audioLevel * 0.3})`,
                  transition: 'transform 0.1s ease-out',
                }}
              />
            )}
            {state === 'recording' ? (
              <Square className="w-7 h-7 relative z-10" fill="currentColor" />
            ) : (
              <Mic className="w-7 h-7 relative z-10" />
            )}
          </button>

          {/* Copy button */}
          <button
            onClick={handleCopy}
            disabled={!transcript || state !== 'idle'}
            className={`p-3 rounded-full transition-all ${
              transcript && state === 'idle'
                ? copied
                  ? 'bg-green-500/20 text-green-400'
                  : isDark
                  ? 'bg-white/10 hover:bg-white/20 text-white/70'
                  : 'bg-black/10 hover:bg-black/20 text-black/70'
                : isDark
                ? 'bg-white/5 text-white/20 cursor-not-allowed'
                : 'bg-black/5 text-black/20 cursor-not-allowed'
            }`}
          >
            {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>

        {/* Hint text */}
        <p className={`mt-3 text-center text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
          {state === 'recording'
            ? 'Click the stop button when done'
            : 'Your speech will be transcribed in real-time'}
        </p>
      </div>

      {/* Global styles for pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </main>
  )
}
