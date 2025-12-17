'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

/**
 * Cartesia Voice Hook
 * Best value option: Groq STT (~$0.04/hr) + GPT-4o-mini + Cartesia TTS (~$0.04/1K chars)
 * Total: ~$0.02/min with ~800ms-1.2s latency
 */
export function useCartesia() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const isRecordingRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastAudioLevelRef = useRef(0)
  const processingRef = useRef(false)

  const {
    groqApiKey,
    openaiApiKey,
    cartesiaApiKey,
    cartesiaVoice,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    continuousMode,
  } = useJarvisStore()

  // Transcribe audio using Groq Whisper (fast & cheap)
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

  // Get chat response from GPT-4o-mini
  const getChatResponse = useCallback(async (message: string): Promise<string> => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        apiKey: openaiApiKey,
        provider: 'openai',
      }),
    })

    if (!response.ok) {
      throw new Error('Chat failed')
    }

    const data = await response.json()
    return data.text || ''
  }, [openaiApiKey])

  // Get TTS audio from Cartesia (ultra-low latency ~40ms)
  const getAudioResponse = useCallback(async (text: string): Promise<Blob> => {
    const response = await fetch('/api/cartesia-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        apiKey: cartesiaApiKey,
        voiceId: cartesiaVoice || 'british-butler',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`TTS failed: ${error}`)
    }

    return await response.blob()
  }, [cartesiaApiKey, cartesiaVoice])

  // Play audio with visualization
  const playAudio = useCallback((audioBlob: Blob): Promise<void> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(audioBlob)
      const audio = new Audio(url)
      audioElementRef.current = audio

      // Create audio context for visualization
      const audioContext = new AudioContext()
      const source = audioContext.createMediaElementSource(audio)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256

      source.connect(analyser)
      analyser.connect(audioContext.destination)

      let visualizationFrame: number

      const visualize = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(average / 255)
        visualizationFrame = requestAnimationFrame(visualize)
      }

      audio.onplay = () => {
        setState('speaking')
        visualize()
      }

      audio.onended = () => {
        cancelAnimationFrame(visualizationFrame)
        setAudioLevel(0)
        audioContext.close()
        URL.revokeObjectURL(url)
        audioElementRef.current = null
        resolve()
      }

      audio.onerror = (e) => {
        cancelAnimationFrame(visualizationFrame)
        setAudioLevel(0)
        audioContext.close()
        URL.revokeObjectURL(url)
        audioElementRef.current = null
        reject(e)
      }

      audio.play().catch(reject)
    })
  }, [setState, setAudioLevel])

  // Process recorded audio
  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0 || processingRef.current) return

    processingRef.current = true
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    audioChunksRef.current = []

    try {
      setState('thinking')
      setCurrentTranscript('Listening...')

      // Transcribe with Groq Whisper
      const transcript = await transcribeAudio(audioBlob)

      if (!transcript.trim()) {
        if (isRecordingRef.current) {
          setState('listening')
          setCurrentTranscript('')
          startRecording()
        }
        processingRef.current = false
        return
      }

      setCurrentTranscript(transcript)
      addMessage('user', transcript)

      // Get response from GPT-4o-mini
      setCurrentTranscript('Thinking...')
      const response = await getChatResponse(transcript)
      setCurrentTranscript(response)
      addMessage('assistant', response)

      // Get and play audio from Cartesia
      const audioResponse = await getAudioResponse(response)
      await playAudio(audioResponse)

      // Continue listening if connected
      if (isRecordingRef.current && continuousMode) {
        setState('listening')
        setCurrentTranscript('')
        startRecording()
      } else if (isRecordingRef.current) {
        setState('listening')
        setCurrentTranscript('')
        startRecording()
      }
    } catch (error) {
      console.error('Processing error:', error)
      setState('error')
      setCurrentTranscript('Error processing audio')
      setTimeout(() => {
        if (isRecordingRef.current) {
          setState('listening')
          setCurrentTranscript('')
          startRecording()
        }
      }, 2000)
    }

    processingRef.current = false
  }, [transcribeAudio, getChatResponse, getAudioResponse, playAudio, setState, setCurrentTranscript, addMessage, continuousMode])

  // Start recording
  const startRecording = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'recording') return

    audioChunksRef.current = []
    mediaRecorderRef.current.start(100)
  }, [])

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
        if (!processingRef.current) {
          processAudio()
        }
      }

      const analyzeAudio = () => {
        if (!analyserRef.current || !mediaStreamRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        const normalizedLevel = average / 255

        // Only update audio level if listening (not speaking)
        const currentState = useJarvisStore.getState().state
        if (currentState === 'listening') {
          setAudioLevel(normalizedLevel)
        }

        // Silence detection - 1s for faster response
        if (currentState === 'listening' && isRecordingRef.current && !processingRef.current) {
          if (normalizedLevel < 0.015) {
            // Low audio - start silence timer
            if (!silenceTimeoutRef.current && lastAudioLevelRef.current >= 0.015) {
              silenceTimeoutRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording' && audioChunksRef.current.length > 0) {
                  mediaRecorderRef.current.stop()
                }
                silenceTimeoutRef.current = null
              }, 1000) // 1s of silence - faster than OpenAI
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
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }
    analyserRef.current = null
    mediaRecorderRef.current = null
    setAudioLevel(0)
  }, [setAudioLevel])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!groqApiKey || !openaiApiKey || !cartesiaApiKey) {
      console.error('Missing API keys for Cartesia provider')
      return false
    }

    try {
      const audioReady = await startAudioAnalysis()
      if (!audioReady) {
        return false
      }

      isRecordingRef.current = true
      processingRef.current = false
      setIsConnected(true)
      setState('listening')

      // Start recording
      startRecording()

      return true
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setState('error')
      stopAudioAnalysis()
      return false
    }
  }, [groqApiKey, openaiApiKey, cartesiaApiKey, startAudioAnalysis, stopAudioAnalysis, setState, setIsConnected, startRecording])

  // End conversation
  const endConversation = useCallback(async () => {
    isRecordingRef.current = false
    processingRef.current = false

    // Stop any playing audio
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }

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
      if (audioElementRef.current) {
        audioElementRef.current.pause()
      }
      stopAudioAnalysis()
    }
  }, [stopAudioAnalysis])

  return {
    startConversation,
    endConversation,
    isReady: !!groqApiKey && !!openaiApiKey && !!cartesiaApiKey,
  }
}
