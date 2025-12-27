'use client'

import { useCallback, useRef, useEffect, useState } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

/**
 * Gemini 2.5 Flash Native Audio Hook
 *
 * Uses Google's Gemini Live API for bidirectional real-time audio streaming.
 * This provides native audio-to-audio conversation without separate STT/TTS steps.
 *
 * Features:
 * - Native audio input/output (no separate STT/TTS)
 * - 30 HD voices in 24 languages
 * - Proactive Audio (responds only when relevant)
 * - Affective Dialog (understands emotional expressions)
 * - Improved barge-in support
 * - Function calling support
 * - Seamless multilingual support
 *
 * Audio Formats:
 * - Input: Raw 16-bit PCM at 16kHz, little-endian
 * - Output: Raw 16-bit PCM at 24kHz, little-endian
 */

// Audio configuration constants
const INPUT_SAMPLE_RATE = 16000
const OUTPUT_SAMPLE_RATE = 24000
const CHUNK_SIZE = 4096 // PCM samples per chunk

// Gemini Live voice options (30 HD voices available)
export type GeminiVoice =
  | 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede'
  | 'Orbit' | 'Clio' | 'Zephyr' | 'Nova' | 'Aria'

interface GeminiLiveConfig {
  model: string
  generationConfig?: {
    responseModalities?: string[]
    speechConfig?: {
      voiceConfig?: {
        prebuiltVoiceConfig?: {
          voiceName: string
        }
      }
    }
  }
  systemInstruction?: {
    parts: Array<{ text: string }>
  }
  // Enable transcription for both input and output audio
  outputAudioTranscription?: Record<string, never>
  inputAudioTranscription?: Record<string, never>
  tools?: Array<{
    functionDeclarations: Array<{
      name: string
      description: string
      parameters?: Record<string, unknown>
    }>
  }>
}

interface WebSocketMessage {
  type: string
  data?: unknown
}

// PCM Audio Conversion Utilities
function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    // Clamp to [-1, 1] and convert to 16-bit range
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16Array
}

function int16ToFloat32(int16Array: Int16Array): Float32Array {
  const float32Array = new Float32Array(int16Array.length)
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 0x8000
  }
  return float32Array
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// Downsample audio from browser's sample rate (usually 44100 or 48000) to 16kHz
function downsampleTo16kHz(audioData: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === INPUT_SAMPLE_RATE) {
    return audioData
  }

  const ratio = inputSampleRate / INPUT_SAMPLE_RATE
  const newLength = Math.round(audioData.length / ratio)
  const result = new Float32Array(newLength)

  for (let i = 0; i < newLength; i++) {
    const index = Math.floor(i * ratio)
    result[i] = audioData[index]
  }

  return result
}

export function useGeminiLive() {
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const playbackContextRef = useRef<AudioContext | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioQueueRef = useRef<AudioBuffer[]>([])
  const isPlayingRef = useRef(false)
  const isRecordingRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const setupCompletePromiseRef = useRef<{ resolve: () => void; reject: (err: Error) => void } | null>(null)

  // Transcript accumulation
  const currentTranscriptRef = useRef('')
  const userTranscriptRef = useRef('')

  const {
    geminiApiKey,
    geminiVoice,
    memoryEnabled,
    mem0ApiKey,
    userLocation,
    messages,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    setLastMemorySaved,
    setLastMemoryRetrieved,
  } = useJarvisStore()

  // Build system instruction with context
  const buildSystemInstruction = useCallback(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    let instruction = `You are Jarvis, an intelligent AI assistant inspired by the AI from Iron Man. You are helpful, witty, and concise. Keep responses brief and conversational since you are speaking directly through audio. Speak naturally as if having a conversation.

IMPORTANT: Wait for the user to speak first before responding. Do not say anything until you hear the user's voice. Listen patiently and respond only after the user has finished speaking.

## Current Date/Time
Today is ${dateStr}. The current time is ${timeStr} (${timezone}).`

    if (userLocation) {
      instruction += `\n\n## User Location
The user is located at coordinates (${userLocation.lat}, ${userLocation.lon})${userLocation.city ? ` in ${userLocation.city}` : ''}.`
    }

    return instruction
  }, [userLocation])

  // Get memory context from Mem0
  const getMemoryContext = useCallback(async (query: string): Promise<string> => {
    if (!memoryEnabled || !mem0ApiKey) return ''

    try {
      const response = await fetch('https://api.mem0.ai/v1/memories/search/', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${mem0ApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          user_id: 'jarvis-user',
          limit: 5,
        }),
      })

      if (!response.ok) return ''

      const data = await response.json()
      if (data.results && data.results.length > 0) {
        const memories = data.results.map((m: { memory: string }) => m.memory).join('\n- ')
        setLastMemoryRetrieved({
          count: data.results.length,
          query: query.slice(0, 50),
          timestamp: Date.now(),
        })
        setTimeout(() => setLastMemoryRetrieved(null), 5000)
        return `\n\n## User Background\nRelevant memories about the user:\n- ${memories}\n\nUse this information naturally in conversation without explicitly mentioning "memories".`
      }
    } catch (error) {
      console.warn('Memory fetch failed:', error)
    }
    return ''
  }, [memoryEnabled, mem0ApiKey, setLastMemoryRetrieved])

  // Save conversation to Mem0
  const saveToMemory = useCallback(async (userMessage: string, assistantResponse: string) => {
    if (!memoryEnabled || !mem0ApiKey) return

    try {
      const response = await fetch('https://api.mem0.ai/v1/memories/', {
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
      if (response.ok) {
        setLastMemorySaved(Date.now())
        setTimeout(() => setLastMemorySaved(null), 3000)
      }
    } catch (error) {
      console.warn('Memory save failed:', error)
    }
  }, [memoryEnabled, mem0ApiKey, setLastMemorySaved])

  // Play audio from queue
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    isPlayingRef.current = true
    const buffer = audioQueueRef.current.shift()!

    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
    }

    const source = playbackContextRef.current.createBufferSource()
    source.buffer = buffer

    // Create analyser for audio level visualization
    const analyser = playbackContextRef.current.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    analyser.connect(playbackContextRef.current.destination)

    // Visualize playback audio level
    const visualize = () => {
      if (!playbackContextRef.current || !isPlayingRef.current) return
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(average / 255)
      if (isPlayingRef.current) {
        requestAnimationFrame(visualize)
      }
    }

    source.onended = () => {
      isPlayingRef.current = false
      setAudioLevel(0)
      // Play next chunk if available
      if (audioQueueRef.current.length > 0) {
        playNextAudio()
      } else {
        // Audio done, switch to listening if still connected
        if (sessionActiveRef.current) {
          setState('listening')
        }
      }
    }

    setState('speaking')
    source.start()
    visualize()
  }, [setState, setAudioLevel])

  // Handle incoming WebSocket messages
  const handleMessage = useCallback(async (event: MessageEvent) => {
    try {
      // Handle binary audio data (comes as Blob)
      if (event.data instanceof Blob) {
        const arrayBuffer = await event.data.arrayBuffer()
        const int16Data = new Int16Array(arrayBuffer)
        const float32Data = int16ToFloat32(int16Data)

        // Create AudioBuffer and queue for playback
        if (!playbackContextRef.current) {
          playbackContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
        }

        const audioBuffer = playbackContextRef.current.createBuffer(
          1, // mono
          float32Data.length,
          OUTPUT_SAMPLE_RATE
        )
        audioBuffer.getChannelData(0).set(float32Data)
        audioQueueRef.current.push(audioBuffer)

        // Set speaking state and start playback if not already playing
        setState('speaking')
        if (!isPlayingRef.current) {
          playNextAudio()
        }
        return
      }

      // Handle JSON text messages
      const rawData = event.data as string
      console.log('Gemini Live raw message:', rawData.substring(0, 500))

      const message = JSON.parse(rawData)
      console.log('Gemini Live message keys:', Object.keys(message))

      // Handle server content (audio response)
      if (message.serverContent) {
        const { serverContent } = message

        // Handle model turn (audio/text response)
        if (serverContent.modelTurn) {
          const { parts } = serverContent.modelTurn

          for (const part of parts || []) {
            // Handle audio data
            if (part.inlineData?.mimeType?.startsWith('audio/')) {
              const audioData = base64ToArrayBuffer(part.inlineData.data)
              const int16Data = new Int16Array(audioData)
              const float32Data = int16ToFloat32(int16Data)

              // Create AudioBuffer and queue for playback
              if (!playbackContextRef.current) {
                playbackContextRef.current = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE })
              }

              const audioBuffer = playbackContextRef.current.createBuffer(
                1, // mono
                float32Data.length,
                OUTPUT_SAMPLE_RATE
              )
              audioBuffer.getChannelData(0).set(float32Data)
              audioQueueRef.current.push(audioBuffer)

              // Start playback if not already playing
              if (!isPlayingRef.current) {
                playNextAudio()
              }
            }

            // Handle text transcript
            if (part.text) {
              currentTranscriptRef.current += part.text
              setCurrentTranscript(currentTranscriptRef.current)
            }
          }
        }

        // Handle turn completion
        if (serverContent.turnComplete) {
          const assistantMessage = currentTranscriptRef.current.trim()
          if (assistantMessage) {
            addMessage('assistant', assistantMessage)

            // Save to memory
            const userMessage = userTranscriptRef.current.trim()
            if (userMessage) {
              saveToMemory(userMessage, assistantMessage)
            }
          }
          currentTranscriptRef.current = ''
          userTranscriptRef.current = ''
        }

        // Handle interrupted response
        if (serverContent.interrupted) {
          console.log('Response was interrupted (barge-in)')
          // Clear audio queue for clean barge-in
          audioQueueRef.current = []
          isPlayingRef.current = false
          currentTranscriptRef.current = ''
          setState('listening')
          setCurrentTranscript('')
        }
      }

      // Handle tool calls
      if (message.toolCall) {
        console.log('Tool call received:', message.toolCall)
        // TODO: Implement tool call handling (calendar, weather, etc.)
      }

      // Handle setup complete (check both camelCase and snake_case)
      // Also check for the field existence even if it's an empty object
      const hasSetupComplete = 'setupComplete' in message || 'setup_complete' in message
      if (hasSetupComplete) {
        console.log('✅ Gemini Live session setup complete!')
        console.log('setupComplete value:', message.setupComplete || message.setup_complete)
        sessionActiveRef.current = true
        // Resolve the setup promise so startConversation can proceed
        if (setupCompletePromiseRef.current) {
          setupCompletePromiseRef.current.resolve()
          setupCompletePromiseRef.current = null
        }
      }

      // Handle user transcript (what the user said) - from input transcription
      if (message.serverContent?.inputTranscription?.text) {
        const userText = message.serverContent.inputTranscription.text
        userTranscriptRef.current = userText
        setCurrentTranscript(userText)
      }

      // Handle output transcription (what the AI is saying as text)
      if (message.serverContent?.outputTranscription?.text) {
        const aiText = message.serverContent.outputTranscription.text
        currentTranscriptRef.current = aiText
        setCurrentTranscript(aiText)
      }

      // Legacy: Handle user transcript from clientContent
      if (message.clientContent?.turnComplete && message.clientContent?.text) {
        userTranscriptRef.current = message.clientContent.text
        addMessage('user', message.clientContent.text)
      }

    } catch (error) {
      console.error('Error handling Gemini message:', error)
    }
  }, [setState, setCurrentTranscript, addMessage, saveToMemory, playNextAudio])

  // Start audio capture and processing
  const startAudioCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      })

      mediaStreamRef.current = stream
      setMicPermission('granted')

      // Create audio context for capturing
      audioContextRef.current = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE })

      // If browser uses different sample rate, we'll need to resample
      const actualSampleRate = audioContextRef.current.sampleRate

      sourceRef.current = audioContextRef.current.createMediaStreamSource(stream)

      // Create analyser for input visualization
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      sourceRef.current.connect(analyserRef.current)

      // Use ScriptProcessor for audio capture (deprecated but widely supported)
      // In production, consider using AudioWorklet for better performance
      processorRef.current = audioContextRef.current.createScriptProcessor(CHUNK_SIZE, 1, 1)

      processorRef.current.onaudioprocess = (e) => {
        // Only send audio when WebSocket is open, we're recording, and session is active
        if (!wsRef.current ||
            wsRef.current.readyState !== WebSocket.OPEN ||
            !isRecordingRef.current ||
            !sessionActiveRef.current) {
          return
        }

        // Don't send audio while AI is speaking (to prevent feedback)
        const currentState = useJarvisStore.getState().state
        if (currentState === 'speaking') {
          return
        }

        const inputData = e.inputBuffer.getChannelData(0)

        // Downsample if necessary
        const resampledData = downsampleTo16kHz(inputData, actualSampleRate)

        // Convert to 16-bit PCM
        const pcmData = float32ToInt16(resampledData)

        // Send audio data as base64 using the correct API format
        const base64Audio = arrayBufferToBase64(pcmData.buffer as ArrayBuffer)

        wsRef.current.send(JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio,
            }
          }
        }))
      }

      sourceRef.current.connect(processorRef.current)
      processorRef.current.connect(audioContextRef.current.destination)

      // Audio level visualization for input
      const visualizeInput = () => {
        if (!analyserRef.current || !isRecordingRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length

        // Only update level if not speaking
        const currentState = useJarvisStore.getState().state
        if (currentState === 'listening') {
          setAudioLevel(average / 255)
        }

        animationFrameRef.current = requestAnimationFrame(visualizeInput)
      }

      visualizeInput()
      return true
    } catch (error) {
      console.error('Failed to start audio capture:', error)
      setMicPermission('denied')
      return false
    }
  }, [setMicPermission, setAudioLevel])

  // Stop audio capture
  const stopAudioCapture = useCallback(() => {
    isRecordingRef.current = false

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect()
      sourceRef.current = null
    }

    if (analyserRef.current) {
      analyserRef.current = null
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

    audioQueueRef.current = []
    isPlayingRef.current = false
    setAudioLevel(0)
  }, [setAudioLevel])

  // Connect to Gemini Live API
  const connectWebSocket = useCallback(async () => {
    if (!geminiApiKey) {
      console.error('Gemini API key not configured')
      return false
    }

    // Build the WebSocket URL for Gemini Live API
    // The Multimodal Live API uses v1beta with BidiGenerateContent
    // See: https://ai.google.dev/api/live
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`

    return new Promise<boolean>((resolve) => {
      try {
        wsRef.current = new WebSocket(wsUrl)

        wsRef.current.onopen = async () => {
          console.log('Gemini Live WebSocket connected')

          // Get memory context for better responses
          const recentMessages = messages.slice(-5).map(m => m.content).join(' ')
          const memoryContext = await getMemoryContext(recentMessages)

          // Send setup message with correct API format
          // Using gemini-2.0-flash-exp which is the stable Live API model
          const setupMessage: GeminiLiveConfig = {
            model: 'models/gemini-2.0-flash-exp',
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: geminiVoice || 'Kore',
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{ text: buildSystemInstruction() + memoryContext }]
            },
          }

          console.log('Sending Gemini setup:', JSON.stringify(setupMessage, null, 2))

          // Create promise to wait for setup complete
          const setupPromise = new Promise<void>((setupResolve, setupReject) => {
            setupCompletePromiseRef.current = { resolve: setupResolve, reject: setupReject }

            // Timeout after 10 seconds
            setTimeout(() => {
              if (setupCompletePromiseRef.current) {
                setupCompletePromiseRef.current.reject(new Error('Setup timeout'))
                setupCompletePromiseRef.current = null
              }
            }, 10000)
          })

          wsRef.current?.send(JSON.stringify({ setup: setupMessage }))

          try {
            await setupPromise
            console.log('Gemini Live setup complete, ready for audio')
            resolve(true)
          } catch (err) {
            console.error('Setup failed:', err)
            resolve(false)
          }
        }

        wsRef.current.onmessage = handleMessage

        wsRef.current.onerror = (error) => {
          console.error('Gemini Live WebSocket error:', error)
          setState('error')
          setCurrentTranscript('Connection error')
          resolve(false)
        }

        wsRef.current.onclose = (event) => {
          console.log('Gemini Live WebSocket closed:', event.code, event.reason)
          // Common close codes:
          // 1000 = Normal closure
          // 1001 = Going away
          // 1006 = Abnormal closure (connection dropped)
          // 1008 = Policy violation (auth issue)
          // 1011 = Server error
          if (event.code === 1008) {
            console.error('Auth error - check API key or model access. Reason:', event.reason)
            setCurrentTranscript('Auth error: ' + (event.reason || 'Invalid API key'))
          } else if (event.code === 1011) {
            console.error('Server error:', event.reason)
            setCurrentTranscript('Server error: ' + (event.reason || 'Try again'))
          } else if (event.code !== 1000) {
            console.error('Unexpected close:', event.code, event.reason)
            setCurrentTranscript('Connection closed: ' + (event.reason || `Code ${event.code}`))
          }
          sessionActiveRef.current = false
          if (setupCompletePromiseRef.current) {
            setupCompletePromiseRef.current.reject(new Error('WebSocket closed'))
            setupCompletePromiseRef.current = null
          }
          if (isRecordingRef.current) {
            stopAudioCapture()
            setIsConnected(false)
            setState('idle')
          }
        }
      } catch (error) {
        console.error('Failed to connect to Gemini Live:', error)
        resolve(false)
      }
    })
  }, [geminiApiKey, geminiVoice, messages, buildSystemInstruction, getMemoryContext, handleMessage, setState, setCurrentTranscript, setIsConnected, stopAudioCapture])

  // Interrupt current response (barge-in)
  const interrupt = useCallback(() => {
    // Clear audio queue
    audioQueueRef.current = []
    isPlayingRef.current = false

    // Stop any playing audio by closing and recreating playback context
    if (playbackContextRef.current) {
      playbackContextRef.current.close().catch(() => {})
      playbackContextRef.current = null
    }

    // Clear transcript
    currentTranscriptRef.current = ''
    setCurrentTranscript('')
    setAudioLevel(0)

    // Switch back to listening
    if (sessionActiveRef.current) {
      setState('listening')
    }
  }, [setState, setCurrentTranscript, setAudioLevel])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!geminiApiKey) {
      console.error('Missing Gemini API key')
      return false
    }

    try {
      setState('thinking')
      setCurrentTranscript('Connecting...')

      // Connect WebSocket first
      const wsConnected = await connectWebSocket()
      if (!wsConnected) {
        setState('error')
        setCurrentTranscript('Failed to connect')
        return false
      }

      // Start audio capture
      const audioStarted = await startAudioCapture()
      if (!audioStarted) {
        wsRef.current?.close()
        setState('error')
        setCurrentTranscript('Microphone access denied')
        return false
      }

      isRecordingRef.current = true
      setIsConnected(true)
      setCurrentTranscript('')
      setState('listening')

      return true
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setState('error')
      return false
    }
  }, [geminiApiKey, connectWebSocket, startAudioCapture, setState, setCurrentTranscript, setIsConnected])

  // End conversation
  const endConversation = useCallback(async () => {
    sessionActiveRef.current = false
    isRecordingRef.current = false

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    // Stop audio
    stopAudioCapture()

    // Reset state
    setIsConnected(false)
    setState('idle')
    setCurrentTranscript('')
    currentTranscriptRef.current = ''
    userTranscriptRef.current = ''
  }, [stopAudioCapture, setIsConnected, setState, setCurrentTranscript])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      stopAudioCapture()
    }
  }, [stopAudioCapture])

  const isReady = !!geminiApiKey

  return {
    startConversation,
    endConversation,
    interrupt,
    isReady,
  }
}
