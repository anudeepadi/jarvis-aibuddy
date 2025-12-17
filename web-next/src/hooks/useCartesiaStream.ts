'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

/**
 * Optimized Cartesia Voice Hook with Streaming
 *
 * Latency optimizations:
 * 1. Stream LLM response (get text as it generates)
 * 2. Sentence-chunked TTS (start TTS before full response)
 * 3. Audio queue (play chunks in order as they arrive)
 *
 * Expected improvement: ~2.5s → ~1.2s to first audio
 */
export function useCartesiaStream() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastAudioLevelRef = useRef(0)
  const processingRef = useRef(false)

  // Audio playback queue
  const audioQueueRef = useRef<Blob[]>([])
  const isPlayingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)

  const {
    groqApiKey,
    ttsProvider,
    edgeVoice,
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

  // Transcribe audio using Groq Whisper
  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData()
    formData.append('audio', audioBlob)
    formData.append('apiKey', groqApiKey)

    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) throw new Error('Transcription failed')
    const data = await response.json()
    return data.text || ''
  }, [groqApiKey])

  // Get TTS audio for a text chunk
  const getTTSAudio = useCallback(async (text: string): Promise<Blob> => {
    const endpoint = ttsProvider === 'edge' || !cartesiaApiKey
      ? '/api/edge-tts'
      : '/api/cartesia-tts'

    const body = ttsProvider === 'edge' || !cartesiaApiKey
      ? { text, voiceId: edgeVoice || 'british-male' }
      : { text, apiKey: cartesiaApiKey, voiceId: cartesiaVoice || 'british-butler' }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) throw new Error('TTS failed')
    return await response.blob()
  }, [ttsProvider, cartesiaApiKey, cartesiaVoice, edgeVoice])

  // Play next audio in queue
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    isPlayingRef.current = true
    const audioBlob = audioQueueRef.current.shift()!

    const url = URL.createObjectURL(audioBlob)
    const audio = new Audio(url)
    currentAudioRef.current = audio

    // Set up audio visualization
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

    return new Promise<void>((resolve) => {
      audio.onplay = () => {
        setState('speaking')
        visualize()
      }

      audio.onended = () => {
        cancelAnimationFrame(visualizationFrame)
        setAudioLevel(0)
        audioContext.close()
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        isPlayingRef.current = false

        // Play next chunk if available
        if (audioQueueRef.current.length > 0) {
          playNextInQueue()
        }
        resolve()
      }

      audio.onerror = () => {
        cancelAnimationFrame(visualizationFrame)
        setAudioLevel(0)
        audioContext.close()
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        isPlayingRef.current = false
        resolve()
      }

      audio.play().catch(() => {
        isPlayingRef.current = false
        resolve()
      })
    })
  }, [setState, setAudioLevel])

  // Queue audio and start playing if not already
  const queueAudio = useCallback((audioBlob: Blob) => {
    audioQueueRef.current.push(audioBlob)
    if (!isPlayingRef.current) {
      playNextInQueue()
    }
  }, [playNextInQueue])

  // Split text into sentences for chunked TTS
  const splitIntoSentences = (text: string): string[] => {
    // Split on sentence boundaries while keeping the punctuation
    const matches = text.match(/[^.!?]+[.!?]+\s*/g)
    const sentences: string[] = matches ? [...matches] : []
    // If there's remaining text without punctuation, add it
    const remaining = text.replace(/[^.!?]+[.!?]+\s*/g, '').trim()
    if (remaining) sentences.push(remaining)
    return sentences.filter(s => s.trim().length > 0)
  }

  // Stream chat response and generate TTS in parallel
  const streamChatWithTTS = useCallback(async (message: string): Promise<string> => {
    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        apiKey: groqApiKey,
        provider: 'groq',
      }),
    })

    if (!response.ok) throw new Error('Chat stream failed')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader available')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''
    let processedLength = 0
    const ttsPromises: Promise<void>[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            if (json.text) {
              fullText += json.text
              buffer += json.text
              setCurrentTranscript(fullText)

              // Check for complete sentences in buffer
              const sentences = splitIntoSentences(buffer)
              if (sentences.length > 0) {
                // Process all complete sentences (all but potentially incomplete last one)
                const completeSentences = sentences.slice(0, -1)
                const lastSentence = sentences[sentences.length - 1]

                // Check if last sentence ends with punctuation (is complete)
                const lastIsComplete = /[.!?]\s*$/.test(lastSentence)

                const toProcess = lastIsComplete ? sentences : completeSentences
                buffer = lastIsComplete ? '' : lastSentence

                for (const sentence of toProcess) {
                  if (sentence.trim()) {
                    // Start TTS generation in parallel (don't await)
                    const ttsPromise = getTTSAudio(sentence.trim())
                      .then(audioBlob => {
                        queueAudio(audioBlob)
                      })
                      .catch(err => console.error('TTS error:', err))
                    ttsPromises.push(ttsPromise)
                  }
                }
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const ttsPromise = getTTSAudio(buffer.trim())
        .then(audioBlob => {
          queueAudio(audioBlob)
        })
        .catch(err => console.error('TTS error:', err))
      ttsPromises.push(ttsPromise)
    }

    // Wait for all TTS to be queued (not necessarily played)
    await Promise.all(ttsPromises)

    return fullText
  }, [groqApiKey, getTTSAudio, queueAudio, setCurrentTranscript])

  // Process recorded audio with streaming
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

      // Stream chat and generate TTS in parallel
      setCurrentTranscript('Thinking...')
      const response = await streamChatWithTTS(transcript)
      addMessage('assistant', response)

      // Wait for all audio to finish playing
      const waitForAudioComplete = () => {
        return new Promise<void>((resolve) => {
          const check = () => {
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
              resolve()
            } else {
              setTimeout(check, 100)
            }
          }
          check()
        })
      }

      await waitForAudioComplete()

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
  }, [transcribeAudio, streamChatWithTTS, setState, setCurrentTranscript, addMessage, continuousMode])

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

        const currentState = useJarvisStore.getState().state
        if (currentState === 'listening') {
          setAudioLevel(normalizedLevel)
        }

        // Silence detection - 1s for faster response
        if (currentState === 'listening' && isRecordingRef.current && !processingRef.current) {
          if (normalizedLevel < 0.015) {
            if (!silenceTimeoutRef.current && lastAudioLevelRef.current >= 0.015) {
              silenceTimeoutRef.current = setTimeout(() => {
                if (mediaRecorderRef.current?.state === 'recording' && audioChunksRef.current.length > 0) {
                  mediaRecorderRef.current.stop()
                }
                silenceTimeoutRef.current = null
              }, 1000)
            }
          } else {
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
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    analyserRef.current = null
    mediaRecorderRef.current = null
    audioQueueRef.current = []
    isPlayingRef.current = false
    setAudioLevel(0)
  }, [setAudioLevel])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!groqApiKey) {
      console.error('Missing Groq API key')
      return false
    }
    if (ttsProvider === 'cartesia' && !cartesiaApiKey) {
      console.error('Missing Cartesia API key (use Edge TTS for free)')
      return false
    }

    try {
      const audioReady = await startAudioAnalysis()
      if (!audioReady) return false

      isRecordingRef.current = true
      processingRef.current = false
      setIsConnected(true)
      setState('listening')
      startRecording()

      return true
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setState('error')
      stopAudioAnalysis()
      return false
    }
  }, [groqApiKey, cartesiaApiKey, ttsProvider, startAudioAnalysis, stopAudioAnalysis, setState, setIsConnected, startRecording])

  // End conversation
  const endConversation = useCallback(async () => {
    isRecordingRef.current = false
    processingRef.current = false

    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

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
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
      stopAudioAnalysis()
    }
  }, [stopAudioAnalysis])

  const isReady = !!groqApiKey && (ttsProvider === 'edge' || !!cartesiaApiKey)

  return {
    startConversation,
    endConversation,
    isReady,
  }
}
