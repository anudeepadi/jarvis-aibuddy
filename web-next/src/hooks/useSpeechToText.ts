'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

type RecordingState = 'idle' | 'recording' | 'processing'

interface UseSpeechToTextReturn {
  state: RecordingState
  transcript: string
  interimTranscript: string
  audioLevel: number
  start: () => Promise<boolean>
  stop: () => void
  clear: () => void
  isReady: boolean
}

/**
 * Simple Speech-to-Text hook
 *
 * Uses Web Speech API for real-time interim results
 * and optionally Groq Whisper for final transcription accuracy
 */
export function useSpeechToText(): UseSpeechToTextReturn {
  const [state, setState] = useState<RecordingState>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)

  const { groqApiKey } = useJarvisStore()

  // Refs for audio recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Web Speech API for real-time interim results
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Initialize Web Speech API
  const initSpeechRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Web Speech API not supported')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          final += result[0].transcript + ' '
        } else {
          interim += result[0].transcript
        }
      }

      if (final) {
        setTranscript(prev => prev + final)
      }
      setInterimTranscript(interim)
    }

    recognition.onerror = (event) => {
      console.warn('Speech recognition error:', event.error)
      // Don't stop on errors like 'no-speech' - just continue
      if (event.error === 'aborted' || event.error === 'network') {
        // These are fatal errors
      }
    }

    recognition.onend = () => {
      // Restart if still recording (handle browser auto-stop)
      if (state === 'recording' && recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch {
          // Already started
        }
      }
    }

    return recognition
  }, [state])

  // Audio level visualization
  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Also set up MediaRecorder for Groq backup transcription
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      // Visualize audio levels
      const analyze = () => {
        if (!analyserRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(average / 255)

        animationFrameRef.current = requestAnimationFrame(analyze)
      }
      analyze()

      return true
    } catch (error) {
      console.error('Failed to access microphone:', error)
      return false
    }
  }, [])

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    mediaRecorderRef.current = null
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  // Transcribe with Groq Whisper (for final accuracy boost)
  const transcribeWithGroq = useCallback(async (audioBlob: Blob): Promise<string> => {
    if (!groqApiKey) return ''

    const formData = new FormData()
    formData.append('audio', audioBlob)
    formData.append('apiKey', groqApiKey)

    try {
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) return ''
      const data = await response.json()
      return data.text || ''
    } catch {
      return ''
    }
  }, [groqApiKey])

  // Start recording
  const start = useCallback(async () => {
    if (state !== 'idle') return false

    // Start audio analysis and recording
    const audioReady = await startAudioAnalysis()
    if (!audioReady) return false

    // Initialize and start Web Speech API
    recognitionRef.current = initSpeechRecognition()
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (error) {
        console.warn('Failed to start speech recognition:', error)
      }
    }

    // Start MediaRecorder for Groq backup
    audioChunksRef.current = []
    mediaRecorderRef.current?.start(100)

    setState('recording')
    return true
  }, [state, startAudioAnalysis, initSpeechRecognition])

  // Stop recording
  const stop = useCallback(async () => {
    if (state !== 'recording') return

    setState('processing')

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }

    // Stop media recorder and get final blob
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    // Clear interim transcript
    setInterimTranscript('')

    // Stop audio analysis
    stopAudioAnalysis()

    // Optional: Use Groq for final transcription refinement
    // Only if we have API key and recorded audio
    if (groqApiKey && audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      const groqTranscript = await transcribeWithGroq(audioBlob)

      // If Groq gives us a result, use it as a refinement
      // But keep Web Speech result if Groq fails
      if (groqTranscript.trim()) {
        setTranscript(groqTranscript)
      }
    }

    audioChunksRef.current = []
    setState('idle')
  }, [state, groqApiKey, stopAudioAnalysis, transcribeWithGroq])

  // Clear transcript
  const clear = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      stopAudioAnalysis()
    }
  }, [stopAudioAnalysis])

  return {
    state,
    transcript,
    interimTranscript,
    audioLevel,
    start,
    stop,
    clear,
    isReady: true, // Web Speech API doesn't require API key
  }
}
