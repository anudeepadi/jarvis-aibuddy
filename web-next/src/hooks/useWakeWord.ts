'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Porcupine built-in keywords (string type for our API)
type KeywordName = 'alexa' | 'americano' | 'blueberry' | 'bumblebee' | 'computer' | 'grapefruit' | 'grasshopper' | 'hey google' | 'hey siri' | 'jarvis' | 'ok google' | 'picovoice' | 'porcupine' | 'terminator'

interface UseWakeWordOptions {
  keyword?: KeywordName
  accessKey?: string
  onWakeWord?: () => void
  sensitivity?: number // 0.0 to 1.0, higher = more sensitive but more false positives
}

interface UseWakeWordReturn {
  isListening: boolean
  isLoading: boolean
  error: string | null
  startListening: () => Promise<void>
  stopListening: () => void
  isSupported: boolean
}

export function useWakeWord(options: UseWakeWordOptions = {}): UseWakeWordReturn {
  const {
    keyword = 'jarvis', // Built-in "Jarvis" keyword!
    accessKey = process.env.NEXT_PUBLIC_PICOVOICE_ACCESS_KEY,
    onWakeWord,
    sensitivity = 0.5,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSupported, setIsSupported] = useState(true)

  const porcupineRef = useRef<unknown>(null)
  const webVoiceProcessorRef = useRef<unknown>(null)

  // Check browser support
  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
      'AudioContext' in window &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices

    setIsSupported(supported)
  }, [])

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Wake word detection is not supported in this browser')
      return
    }

    if (!accessKey) {
      setError('Picovoice access key not configured. Get one free at console.picovoice.ai')
      return
    }

    if (isListening) return

    setIsLoading(true)
    setError(null)

    try {
      // Dynamic import to avoid SSR issues
      const { Porcupine, BuiltInKeyword } = await import('@picovoice/porcupine-web')
      const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor')

      // Map keyword string to library enum
      const keywordMap: Record<string, typeof BuiltInKeyword[keyof typeof BuiltInKeyword]> = {
        alexa: BuiltInKeyword.Alexa,
        americano: BuiltInKeyword.Americano,
        blueberry: BuiltInKeyword.Blueberry,
        bumblebee: BuiltInKeyword.Bumblebee,
        computer: BuiltInKeyword.Computer,
        grapefruit: BuiltInKeyword.Grapefruit,
        grasshopper: BuiltInKeyword.Grasshopper,
        'hey google': BuiltInKeyword.HeyGoogle,
        'hey siri': BuiltInKeyword.HeySiri,
        jarvis: BuiltInKeyword.Jarvis,
        'ok google': BuiltInKeyword.OkayGoogle,
        picovoice: BuiltInKeyword.Picovoice,
        porcupine: BuiltInKeyword.Porcupine,
        terminator: BuiltInKeyword.Terminator,
      }

      const builtInKeyword = keywordMap[keyword.toLowerCase()]
      if (!builtInKeyword) {
        throw new Error(`Unknown keyword: ${keyword}`)
      }

      // Detection callback
      const detectionCallback = (detection: { label: string; index: number }) => {
        if (detection.index >= 0) {
          console.log(`Wake word detected: ${detection.label}`)
          onWakeWord?.()
        }
      }

      // Create Porcupine instance with the new API
      // The sensitivity is included in the keyword object
      const keywordWithSensitivity = {
        builtin: builtInKeyword,
        sensitivity,
      }

      const porcupine = await Porcupine.create(
        accessKey,
        [keywordWithSensitivity],
        detectionCallback,
        { publicPath: '/porcupine/' }  // Model path (optional, uses default)
      )

      porcupineRef.current = porcupine

      // Start voice processor
      await WebVoiceProcessor.subscribe(porcupine)
      webVoiceProcessorRef.current = WebVoiceProcessor

      setIsListening(true)
      setIsLoading(false)
      console.log(`Wake word detection started. Listening for "${keyword}"...`)
    } catch (err) {
      setIsLoading(false)
      const message = err instanceof Error ? err.message : 'Failed to start wake word detection'
      setError(message)
      console.error('Wake word error:', err)
    }
  }, [isSupported, accessKey, isListening, keyword, sensitivity, onWakeWord])

  const stopListening = useCallback(async () => {
    if (!isListening) return

    try {
      if (webVoiceProcessorRef.current && porcupineRef.current) {
        const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor')
        await WebVoiceProcessor.unsubscribe(porcupineRef.current as Parameters<typeof WebVoiceProcessor.unsubscribe>[0])
      }

      if (porcupineRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (porcupineRef.current as any).release?.()
      }

      porcupineRef.current = null
      webVoiceProcessorRef.current = null
      setIsListening(false)
      console.log('Wake word detection stopped')
    } catch (err) {
      console.error('Error stopping wake word:', err)
    }
  }, [isListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        stopListening()
      }
    }
  }, [isListening, stopListening])

  return {
    isListening,
    isLoading,
    error,
    startListening,
    stopListening,
    isSupported,
  }
}
