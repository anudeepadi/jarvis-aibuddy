'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

/**
 * Optimized Voice Hook with Streaming + Interruption Support
 *
 * Features:
 * 1. Stream LLM response with typewriter effect
 * 2. Sentence-chunked TTS in correct order
 * 3. Audio queue with interruption support
 * 4. Better silence detection
 * 5. Mem0 memory integration
 */
export function useCartesiaStream() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastAudioLevelRef = useRef(0)
  const processingRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Audio playback with ordering
  const orderedAudioQueueRef = useRef<Map<number, Blob>>(new Map())
  const nextPlayIndexRef = useRef(0)
  const isPlayingRef = useRef(false)
  const currentAudioRef = useRef<HTMLAudioElement | null>(null)
  const playbackFrameRef = useRef<number | null>(null)

  // Typewriter effect
  const typewriterIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const fullTextRef = useRef('')
  const displayedTextRef = useRef('')

  // Track speech detection for better follow-ups
  const speechDetectedRef = useRef(false)
  const speechStartTimeRef = useRef<number>(0)

  const {
    groqApiKey,
    ttsProvider,
    edgeVoice,
    cartesiaApiKey,
    cartesiaVoice,
    mem0ApiKey,
    memoryEnabled,
    language,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    continuousMode,
  } = useJarvisStore()

  // Typewriter animation
  const startTypewriter = useCallback((text: string, speed = 30) => {
    // Stop any existing typewriter
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current)
    }

    fullTextRef.current = text
    displayedTextRef.current = ''
    let index = 0

    typewriterIntervalRef.current = setInterval(() => {
      if (index < text.length) {
        // Add characters in chunks for smoother effect
        const chunkSize = Math.min(3, text.length - index)
        displayedTextRef.current = text.slice(0, index + chunkSize)
        setCurrentTranscript(displayedTextRef.current + '▋') // Blinking cursor
        index += chunkSize
      } else {
        // Done typing, show full text without cursor
        setCurrentTranscript(text)
        if (typewriterIntervalRef.current) {
          clearInterval(typewriterIntervalRef.current)
          typewriterIntervalRef.current = null
        }
      }
    }, speed)
  }, [setCurrentTranscript])

  const stopTypewriter = useCallback(() => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current)
      typewriterIntervalRef.current = null
    }
  }, [])

  // Interrupt: Stop speaking and return to listening
  const interrupt = useCallback(() => {
    // Stop typewriter
    stopTypewriter()

    // Stop current audio
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }

    // Clear audio queue
    orderedAudioQueueRef.current.clear()
    nextPlayIndexRef.current = 0
    isPlayingRef.current = false

    // Cancel playback animation
    if (playbackFrameRef.current) {
      cancelAnimationFrame(playbackFrameRef.current)
      playbackFrameRef.current = null
    }

    // Close playback context
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {})
      playbackContextRef.current = null
    }

    // Cancel any ongoing fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Reset processing state
    processingRef.current = false

    // Go back to listening
    setAudioLevel(0)
    setState('listening')
    setCurrentTranscript('')

    // Restart recording if connected
    if (isRecordingRef.current && mediaRecorderRef.current) {
      audioChunksRef.current = []
      if (mediaRecorderRef.current.state !== 'recording') {
        mediaRecorderRef.current.start(100)
      }
    }
  }, [setState, setAudioLevel, setCurrentTranscript, stopTypewriter])

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

  // Get TTS audio for a text chunk (with fallback)
  const getTTSAudio = useCallback(async (text: string): Promise<Blob> => {
    const tryEdgeTTS = async () => {
      const response = await fetch('/api/edge-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: edgeVoice || 'british-male', language }),
      })
      if (!response.ok) throw new Error('Edge TTS failed')
      return await response.blob()
    }

    const tryCartesiaTTS = async () => {
      if (!cartesiaApiKey) throw new Error('No Cartesia API key')
      const response = await fetch('/api/cartesia-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey: cartesiaApiKey, voiceId: cartesiaVoice || 'british-butler' }),
      })
      if (!response.ok) throw new Error('Cartesia TTS failed')
      return await response.blob()
    }

    try {
      if (ttsProvider === 'cartesia' && cartesiaApiKey) {
        return await tryCartesiaTTS()
      }
      return await tryEdgeTTS()
    } catch (error) {
      console.warn('Primary TTS failed, trying fallback:', error)
      try {
        if (ttsProvider === 'cartesia') {
          return await tryEdgeTTS()
        } else if (cartesiaApiKey) {
          return await tryCartesiaTTS()
        }
      } catch {
        // Both failed
      }
      throw new Error('All TTS providers failed')
    }
  }, [ttsProvider, cartesiaApiKey, cartesiaVoice, edgeVoice, language])

  // Play next audio in correct order
  const playNextInQueue = useCallback(async () => {
    if (isPlayingRef.current) return

    // Check if we have the next expected audio
    const nextAudio = orderedAudioQueueRef.current.get(nextPlayIndexRef.current)
    if (!nextAudio) return

    isPlayingRef.current = true
    orderedAudioQueueRef.current.delete(nextPlayIndexRef.current)

    const url = URL.createObjectURL(nextAudio)
    const audio = new Audio(url)
    currentAudioRef.current = audio

    try {
      playbackContextRef.current = new AudioContext()
      const source = playbackContextRef.current.createMediaElementSource(audio)
      const analyser = playbackContextRef.current.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyser.connect(playbackContextRef.current.destination)

      const visualize = () => {
        if (!playbackContextRef.current) return
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(average / 255)
        playbackFrameRef.current = requestAnimationFrame(visualize)
      }

      audio.onplay = () => {
        setState('speaking')
        visualize()
      }

      audio.onended = () => {
        if (playbackFrameRef.current) {
          cancelAnimationFrame(playbackFrameRef.current)
          playbackFrameRef.current = null
        }
        setAudioLevel(0)
        if (playbackContextRef.current) {
          playbackContextRef.current.close().catch(() => {})
          playbackContextRef.current = null
        }
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        isPlayingRef.current = false
        nextPlayIndexRef.current++

        // Play next chunk if available
        playNextInQueue()
      }

      audio.onerror = () => {
        if (playbackFrameRef.current) {
          cancelAnimationFrame(playbackFrameRef.current)
          playbackFrameRef.current = null
        }
        setAudioLevel(0)
        if (playbackContextRef.current) {
          playbackContextRef.current.close().catch(() => {})
          playbackContextRef.current = null
        }
        URL.revokeObjectURL(url)
        currentAudioRef.current = null
        isPlayingRef.current = false
        nextPlayIndexRef.current++

        // Try next chunk
        playNextInQueue()
      }

      await audio.play()
    } catch (error) {
      console.error('Audio playback error:', error)
      isPlayingRef.current = false
      URL.revokeObjectURL(url)
      currentAudioRef.current = null
      nextPlayIndexRef.current++
      playNextInQueue()
    }
  }, [setState, setAudioLevel])

  // Queue audio with index for correct ordering
  const queueAudioWithIndex = useCallback((audioBlob: Blob, index: number) => {
    orderedAudioQueueRef.current.set(index, audioBlob)
    // Try to play if not already playing
    if (!isPlayingRef.current) {
      playNextInQueue()
    }
  }, [playNextInQueue])

  // Split text into sentences for chunked TTS
  const splitIntoSentences = (text: string): string[] => {
    const matches = text.match(/[^.!?]+[.!?]+\s*/g)
    const sentences: string[] = matches ? [...matches] : []
    const remaining = text.replace(/[^.!?]+[.!?]+\s*/g, '').trim()
    if (remaining) sentences.push(remaining)
    return sentences.filter(s => s.trim().length > 0)
  }

  // Add memory context from Mem0
  const getMemoryContext = useCallback(async (message: string): Promise<string> => {
    if (!memoryEnabled || !mem0ApiKey) return ''

    try {
      const response = await fetch('https://api.mem0.ai/v1/memories/search/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${mem0ApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          user_id: 'jarvis-user',
          limit: 5,
        }),
      })

      if (!response.ok) return ''

      const data = await response.json()
      if (data.results && data.results.length > 0) {
        const memories = data.results.map((m: { memory: string }) => m.memory).join('\n- ')
        return `\n\nRelevant memories about the user:\n- ${memories}`
      }
    } catch (error) {
      console.warn('Memory fetch failed:', error)
    }
    return ''
  }, [memoryEnabled, mem0ApiKey])

  // Save to memory
  const saveToMemory = useCallback(async (userMessage: string, assistantResponse: string) => {
    if (!memoryEnabled || !mem0ApiKey) return

    try {
      await fetch('https://api.mem0.ai/v1/memories/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${mem0ApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: userMessage },
            { role: 'assistant', content: assistantResponse },
          ],
          user_id: 'jarvis-user',
        }),
      })
    } catch (error) {
      console.warn('Memory save failed:', error)
    }
  }, [memoryEnabled, mem0ApiKey])

  // Stream chat response and generate TTS in parallel (with correct ordering)
  const streamChatWithTTS = useCallback(async (message: string, memoryContext: string): Promise<string> => {
    abortControllerRef.current = new AbortController()

    // Reset audio queue
    orderedAudioQueueRef.current.clear()
    nextPlayIndexRef.current = 0
    let sentenceIndex = 0

    const response = await fetch('/api/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: memoryContext ? `${message}\n\n[Context: ${memoryContext}]` : message,
        apiKey: groqApiKey,
        provider: 'groq',
      }),
      signal: abortControllerRef.current.signal,
    })

    if (!response.ok) throw new Error('Chat stream failed')

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No reader available')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''
    const ttsPromises: Promise<void>[] = []

    try {
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

                // Update typewriter with current full text
                startTypewriter(fullText)

                // Check for complete sentences in buffer
                const sentences = splitIntoSentences(buffer)
                if (sentences.length > 0) {
                  const completeSentences = sentences.slice(0, -1)
                  const lastSentence = sentences[sentences.length - 1]
                  const lastIsComplete = /[.!?]\s*$/.test(lastSentence)

                  const toProcess = lastIsComplete ? sentences : completeSentences
                  buffer = lastIsComplete ? '' : lastSentence

                  for (const sentence of toProcess) {
                    if (sentence.trim()) {
                      // Capture current index for closure
                      const currentIndex = sentenceIndex++
                      const ttsPromise = getTTSAudio(sentence.trim())
                        .then(audioBlob => {
                          queueAudioWithIndex(audioBlob, currentIndex)
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
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Stream aborted (interrupted)')
        stopTypewriter()
        return fullText
      }
      throw error
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const currentIndex = sentenceIndex++
      const ttsPromise = getTTSAudio(buffer.trim())
        .then(audioBlob => {
          queueAudioWithIndex(audioBlob, currentIndex)
        })
        .catch(err => console.error('TTS error:', err))
      ttsPromises.push(ttsPromise)
    }

    // Show final text without cursor
    stopTypewriter()
    setCurrentTranscript(fullText)

    await Promise.all(ttsPromises)
    return fullText
  }, [groqApiKey, getTTSAudio, queueAudioWithIndex, startTypewriter, stopTypewriter, setCurrentTranscript])

  // Process recorded audio
  const processAudio = useCallback(async () => {
    if (audioChunksRef.current.length === 0 || processingRef.current) return

    processingRef.current = true
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
    audioChunksRef.current = []

    try {
      setState('thinking')
      setCurrentTranscript('Processing...▋')

      // Transcribe with Groq Whisper
      const transcript = await transcribeAudio(audioBlob)

      if (!transcript.trim()) {
        if (isRecordingRef.current) {
          setState('listening')
          setCurrentTranscript('')
          if (mediaRecorderRef.current?.state !== 'recording') {
            mediaRecorderRef.current?.start(100)
          }
        }
        processingRef.current = false
        return
      }

      setCurrentTranscript(`"${transcript}"`)
      addMessage('user', transcript)

      // Get memory context
      const memoryContext = await getMemoryContext(transcript)

      // Stream chat and generate TTS
      setState('thinking')
      const response = await streamChatWithTTS(transcript, memoryContext)

      if (response) {
        addMessage('assistant', response)

        // Save to memory in background
        saveToMemory(transcript, response)
      }

      // Wait for audio to finish
      const waitForAudio = () => new Promise<void>((resolve) => {
        const check = () => {
          if (!isPlayingRef.current && orderedAudioQueueRef.current.size === 0) {
            resolve()
          } else {
            setTimeout(check, 100)
          }
        }
        check()
      })

      await waitForAudio()

      // Continue listening
      if (isRecordingRef.current) {
        setState('listening')
        setCurrentTranscript('')
        speechDetectedRef.current = false
        if (mediaRecorderRef.current?.state !== 'recording') {
          mediaRecorderRef.current?.start(100)
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Processing error:', error)
        setState('error')
        setCurrentTranscript('Error - tap to retry')
        setTimeout(() => {
          if (isRecordingRef.current) {
            setState('listening')
            setCurrentTranscript('')
            if (mediaRecorderRef.current?.state !== 'recording') {
              mediaRecorderRef.current?.start(100)
            }
          }
        }, 1500)
      }
    }

    processingRef.current = false
  }, [transcribeAudio, streamChatWithTTS, getMemoryContext, saveToMemory, setState, setCurrentTranscript, addMessage])

  // Audio analysis with improved silence detection
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
        if (!processingRef.current && audioChunksRef.current.length > 0) {
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

        // Improved silence detection
        const SPEECH_THRESHOLD = 0.02
        const SILENCE_DURATION = 800 // ms - faster detection

        if (currentState === 'listening' && isRecordingRef.current && !processingRef.current) {
          if (normalizedLevel >= SPEECH_THRESHOLD) {
            // Speech detected
            if (!speechDetectedRef.current) {
              speechDetectedRef.current = true
              speechStartTimeRef.current = Date.now()
            }
            // Clear silence timer
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current)
              silenceTimeoutRef.current = null
            }
          } else if (speechDetectedRef.current) {
            // Silence after speech - start timer
            if (!silenceTimeoutRef.current) {
              silenceTimeoutRef.current = setTimeout(() => {
                const speechDuration = Date.now() - speechStartTimeRef.current
                // Only process if speech was longer than 300ms
                if (speechDuration > 300 && mediaRecorderRef.current?.state === 'recording' && audioChunksRef.current.length > 0) {
                  mediaRecorderRef.current.stop()
                }
                silenceTimeoutRef.current = null
              }, SILENCE_DURATION)
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
    stopTypewriter()
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (playbackFrameRef.current) {
      cancelAnimationFrame(playbackFrameRef.current)
      playbackFrameRef.current = null
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {})
      playbackContextRef.current = null
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    analyserRef.current = null
    mediaRecorderRef.current = null
    orderedAudioQueueRef.current.clear()
    nextPlayIndexRef.current = 0
    isPlayingRef.current = false
    speechDetectedRef.current = false
    setAudioLevel(0)
  }, [setAudioLevel, stopTypewriter])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!groqApiKey) {
      console.error('Missing Groq API key')
      return false
    }

    try {
      const audioReady = await startAudioAnalysis()
      if (!audioReady) return false

      isRecordingRef.current = true
      processingRef.current = false
      speechDetectedRef.current = false
      setIsConnected(true)
      setState('listening')

      // Start recording
      audioChunksRef.current = []
      mediaRecorderRef.current?.start(100)

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

  // Cleanup
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
    interrupt,
    isReady,
  }
}
