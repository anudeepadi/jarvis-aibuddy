'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

export function useGroqVoice() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)
  const isRecordingRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastAudioLevelRef = useRef(0)

  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([])

  const {
    groqApiKey,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    continuousMode,
  } = useJarvisStore()

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices()
      setAvailableVoices(voices)
    }

    loadVoices()
    speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      speechSynthesis.onvoiceschanged = null
    }
  }, [])

  // Get the best voice for Jarvis (prefer British male voice)
  const getJarvisVoice = useCallback(() => {
    // Priority: British English male > Any English male > Default
    const priorities = [
      (v: SpeechSynthesisVoice) => v.name.includes('Daniel') && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.name.includes('James') && v.lang.startsWith('en'),
      (v: SpeechSynthesisVoice) => v.lang === 'en-GB' && v.name.toLowerCase().includes('male'),
      (v: SpeechSynthesisVoice) => v.lang === 'en-GB',
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en') && v.name.toLowerCase().includes('male'),
      (v: SpeechSynthesisVoice) => v.lang.startsWith('en'),
    ]

    for (const check of priorities) {
      const voice = availableVoices.find(check)
      if (voice) return voice
    }

    return availableVoices[0] || null
  }, [availableVoices])

  // Speak text using Web Speech API
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!text) {
        resolve()
        return
      }

      // Cancel any ongoing speech
      speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      speechSynthRef.current = utterance

      const voice = getJarvisVoice()
      if (voice) {
        utterance.voice = voice
      }

      utterance.rate = 1.0
      utterance.pitch = 0.9
      utterance.volume = 1.0

      // Simulate audio levels during speech
      let speakingInterval: NodeJS.Timeout | null = null

      utterance.onstart = () => {
        setState('speaking')
        speakingInterval = setInterval(() => {
          // Simulate varying audio levels
          const level = 0.3 + Math.random() * 0.4 + Math.sin(Date.now() / 100) * 0.15
          setAudioLevel(Math.max(0.2, Math.min(0.8, level)))
        }, 50)
      }

      utterance.onend = () => {
        if (speakingInterval) clearInterval(speakingInterval)
        setAudioLevel(0)
        resolve()
      }

      utterance.onerror = (event) => {
        if (speakingInterval) clearInterval(speakingInterval)
        setAudioLevel(0)
        if (event.error !== 'canceled') {
          reject(new Error(event.error))
        } else {
          resolve()
        }
      }

      speechSynthesis.speak(utterance)
    })
  }, [getJarvisVoice, setState, setAudioLevel])

  // Transcribe audio using Groq Whisper
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', audioBlob)
    formData.append('apiKey', groqApiKey)

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Transcription failed')
    }

    const data = await response.json()
    return data.text || ''
  }, [groqApiKey])

  // Get chat response from Groq LLM
  const getChatResponse = useCallback(async (message: string): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        apiKey: groqApiKey,
        provider: 'groq',
      }),
    })

    if (!response.ok) {
      throw new Error('Chat failed')
    }

    const data = await response.json()
    return data.text || ''
  }, [groqApiKey])

  // Process recorded audio
  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return

    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    audioChunksRef.current = []

    try {
      setState('thinking')
      setCurrentTranscript('Processing...')

      // Transcribe
      const transcript = await transcribeAudio(audioBlob)

      if (!transcript.trim()) {
        setState('listening')
        setCurrentTranscript('')
        return
      }

      setCurrentTranscript(transcript)
      addMessage('user', transcript)

      // Get response
      const response = await getChatResponse(transcript)
      setCurrentTranscript(response)
      addMessage('assistant', response)

      // Speak response
      await speak(response)

      // Continue listening if in continuous mode
      if (continuousMode && isRecordingRef.current) {
        setState('listening')
        setCurrentTranscript('')
      } else {
        setState('listening')
        setCurrentTranscript('')
      }
    } catch (error) {
      console.error('Processing error:', error)
      setState('error')
      setCurrentTranscript('Error processing audio')
      setTimeout(() => {
        if (isRecordingRef.current) {
          setState('listening')
          setCurrentTranscript('')
        }
      }, 2000)
    }
  }, [transcribeAudio, getChatResponse, speak, setState, setCurrentTranscript, addMessage, continuousMode])

  // Audio analysis for visualization and silence detection
  const startAudioAnalysis = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      setMicPermission('granted')

      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256

      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)

      // Set up MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorderRef.current.onstop = () => {
        processAudio()
      }

      const analyzeAudio = () => {
        if (!analyserRef.current || !mediaStreamRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = average / 255

        // Only update audio level if not speaking
        const currentState = useJarvisStore.getState().state
        if (currentState === 'listening') {
          setAudioLevel(normalizedLevel)
        }

        // Silence detection for auto-stop
        if (currentState === 'listening' && isRecordingRef.current) {
          if (normalizedLevel < 0.02) {
            // Low audio - start silence timer
            if (!silenceTimeoutRef.current && lastAudioLevelRef.current >= 0.02) {
              silenceTimeoutRef.current = setTimeout(() => {
                // Stop recording after silence
                if (mediaRecorderRef.current?.state === 'recording') {
                  mediaRecorderRef.current.stop()
                }
                silenceTimeoutRef.current = null
              }, 1500) // 1.5 seconds of silence
            }
          } else {
            // Audio detected - clear silence timer
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current)
              silenceTimeoutRef.current = null
            }
          }
          lastAudioLevelRef.current = normalizedLevel
        }

        animationFrameRef.current = requestAnimationFrame(analyzeAudio)
      }

      analyzeAudio()
      return true
    } catch (error) {
      console.error('Audio analysis error:', error)
      setMicPermission('denied')
      return false
    }
  }, [setAudioLevel, setMicPermission, processAudio])

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    mediaRecorderRef.current = null
    setAudioLevel(0)
  }, [setAudioLevel])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!groqApiKey) {
      console.error('No Groq API key configured')
      return false
    }

    try {
      const audioReady = await startAudioAnalysis()
      if (!audioReady) {
        return false
      }

      isRecordingRef.current = true
      setIsConnected(true)
      setState('listening')

      // Start recording
      if (mediaRecorderRef.current) {
        audioChunksRef.current = []
        mediaRecorderRef.current.start(100) // Collect data every 100ms
      }

      return true
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setState('error')
      stopAudioAnalysis()
      return false
    }
  }, [groqApiKey, startAudioAnalysis, stopAudioAnalysis, setState, setIsConnected])

  // End conversation
  const endConversation = useCallback(async () => {
    isRecordingRef.current = false

    // Cancel any ongoing speech
    speechSynthesis.cancel()

    // Stop recording
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }

    stopAudioAnalysis()
    setIsConnected(false)
    setState('idle')
    setCurrentTranscript('')
  }, [stopAudioAnalysis, setIsConnected, setState, setCurrentTranscript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      speechSynthesis.cancel()
      stopAudioAnalysis()
    }
  }, [stopAudioAnalysis])

  return {
    startConversation,
    endConversation,
    isReady: !!groqApiKey,
    availableVoices,
  }
}
