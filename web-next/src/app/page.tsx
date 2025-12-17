'use client'

import { useState, useEffect, useCallback } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'
import { useElevenLabs } from '@/hooks/useElevenLabs'
import { useOpenAI } from '@/hooks/useOpenAI'
import { useGroqVoice } from '@/hooks/useGroqVoice'
import { useCartesia } from '@/hooks/useCartesia'
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

  const {
    state,
    provider,
    isConnected,
    currentTranscript,
    messages,
    micPermission,
    elevenLabsAgentId,
    openaiApiKey,
    groqApiKey,
    cartesiaApiKey,
  } = useJarvisStore()

  const elevenLabs = useElevenLabs()
  const openAI = useOpenAI()
  const groqVoice = useGroqVoice()
  const cartesia = useCartesia()

  // Provider selection: cartesia (best value), elevenlabs (best quality), groq (cheapest), openai (fallback)
  const currentProvider =
    provider === 'cartesia' ? cartesia :
    provider === 'groq' ? groqVoice :
    provider === 'elevenlabs' ? elevenLabs :
    openAI

  const isConfigured =
    provider === 'cartesia' ? (!!groqApiKey && !!openaiApiKey && !!cartesiaApiKey) :
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
          currentProvider.endConversation()
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
  }, [isConnected, isConfigured, showSettings, currentProvider])

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

  // Get display text based on state
  const getDisplayText = () => {
    // Show current transcript first (real-time)
    if (currentTranscript) {
      return currentTranscript
    }

    // Find the last relevant message
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1]
      if (state === 'speaking' && lastMsg.role === 'assistant') {
        return lastMsg.content
      }
      if (state === 'listening' && lastMsg.role === 'assistant') {
        return lastMsg.content
      }
    }

    return ''
  }

  const displayText = getDisplayText()
  const isAISpeaking = state === 'speaking'

  return (
    <main className="relative w-full h-screen bg-[#0d0d0d] overflow-hidden">
      {/* Settings button */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-6 right-6 z-20 w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
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

      {/* Transcript above sphere */}
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 z-10 w-full max-w-2xl px-6">
        {/* State indicator */}
        {isConnected && (
          <div className="flex justify-center mb-3">
            <span className={`text-xs uppercase tracking-widest ${
              isAISpeaking ? 'text-cyan-400' : 'text-gray-500'
            }`}>
              {state === 'speaking' ? 'Speaking' : state === 'listening' ? 'Listening' : state}
            </span>
          </div>
        )}

        {/* Transcript text */}
        {displayText && (
          <p className={`text-center leading-relaxed transition-all ${
            isAISpeaking
              ? 'text-white text-xl'
              : 'text-gray-300 text-lg'
          }`}>
            {displayText}
          </p>
        )}
      </div>

      {/* Sphere */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[280px] h-[280px] md:w-[350px] md:h-[350px]">
          <FibonacciSphere />
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-4">
        {/* End Session label */}
        {isConnected && (
          <span className="text-gray-400 text-sm">End Session</span>
        )}

        {/* Buttons */}
        <div className="flex items-center gap-4">
          {isConnected && (
            <button
              onClick={() => currentProvider.endConversation()}
              className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-gray-700 flex items-center justify-center hover:bg-[#252525] transition-colors"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            onClick={handleMainAction}
            disabled={micPermission === 'denied'}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
              isConnected
                ? 'bg-[#1a1a1a] border border-gray-700 hover:bg-[#252525]'
                : 'bg-[#1a1a1a] border border-gray-700 hover:bg-[#252525]'
            } ${micPermission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
