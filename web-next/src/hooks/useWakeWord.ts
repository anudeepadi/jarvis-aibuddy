'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

/**
 * Wake Word Detection Hook using Picovoice Porcupine
 *
 * Listens for "Jarvis" wake word and triggers callback when detected.
 * Requires a Picovoice API key (free tier available at console.picovoice.ai)
 */
export function useWakeWord(onWakeWordDetected: () => void) {
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const porcupineRef = useRef<unknown>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const {
    picovoiceApiKey,
    wakeWordEnabled,
  } = useJarvisStore()

  const startListening = useCallback(async () => {
    if (!picovoiceApiKey || !wakeWordEnabled) {
      setError('Wake word requires Picovoice API key')
      return false
    }

    try {
      // Dynamically import Porcupine to avoid SSR issues
      const { Porcupine } = await import('@picovoice/porcupine-web')

      // Initialize Porcupine with built-in "Jarvis" keyword
      const porcupine = await Porcupine.create(
        picovoiceApiKey,
        ['jarvis'], // Built-in wake word
        [0.5] // Sensitivity (0-1)
      )
      porcupineRef.current = porcupine

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create audio context
      audioContextRef.current = new AudioContext({ sampleRate: porcupine.sampleRate })
      const source = audioContextRef.current.createMediaStreamSource(stream)

      // Create processor for audio frames
      const processor = audioContextRef.current.createScriptProcessor(
        porcupine.frameLength,
        1,
        1
      )
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)
        const int16Array = new Int16Array(inputData.length)

        // Convert Float32 to Int16
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }

        // Process with Porcupine
        const keywordIndex = (porcupineRef.current as { process: (data: Int16Array) => number }).process(int16Array)
        if (keywordIndex >= 0) {
          console.log('Wake word "Jarvis" detected!')
          onWakeWordDetected()
        }
      }

      source.connect(processor)
      processor.connect(audioContextRef.current.destination)

      setIsListening(true)
      setError(null)
      return true
    } catch (err) {
      console.error('Wake word initialization error:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize wake word detection')
      return false
    }
  }, [picovoiceApiKey, wakeWordEnabled, onWakeWordDetected])

  const stopListening = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (porcupineRef.current) {
      (porcupineRef.current as { release: () => void }).release()
      porcupineRef.current = null
    }
    setIsListening(false)
  }, [])

  // Auto-start when enabled and API key is set
  useEffect(() => {
    if (wakeWordEnabled && picovoiceApiKey && !isListening) {
      startListening()
    } else if (!wakeWordEnabled && isListening) {
      stopListening()
    }

    return () => {
      stopListening()
    }
  }, [wakeWordEnabled, picovoiceApiKey, isListening, startListening, stopListening])

  return {
    isListening,
    error,
    startListening,
    stopListening,
  }
}
