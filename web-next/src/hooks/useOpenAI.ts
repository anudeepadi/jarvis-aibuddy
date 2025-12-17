'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

// Use global type from src/types/speech.d.ts
export function useOpenAI() {
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isProcessingRef = useRef(false)

  const {
    openaiApiKey,
    mem0ApiKey,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    continuousMode,
    memoryEnabled,
    voiceEnabled,
    messages,
  } = useJarvisStore()

  // Search memories
  const searchMemories = useCallback(async (query: string) => {
    if (!memoryEnabled || !mem0ApiKey) return []

    try {
      const response = await fetch('https://api.mem0.ai/v1/memories/search/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${mem0ApiKey}`,
        },
        body: JSON.stringify({
          query,
          filters: { user_id: 'jarvis_user' },
          limit: 5,
        }),
      })

      if (!response.ok) return []
      const data = await response.json()
      return data.results || data || []
    } catch {
      return []
    }
  }, [memoryEnabled, mem0ApiKey])

  // Save to memory
  const addMemory = useCallback(async (content: string) => {
    if (!memoryEnabled || !mem0ApiKey) return

    try {
      await fetch('https://api.mem0.ai/v1/memories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${mem0ApiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content }],
          user_id: 'jarvis_user',
        }),
      })
    } catch (err) {
      console.error('Memory save error:', err)
    }
  }, [memoryEnabled, mem0ApiKey])

  // Call OpenAI
  const callOpenAI = useCallback(async (userMessage: string) => {
    const memories = await searchMemories(userMessage)

    let systemPrompt = `You are JARVIS, an advanced AI assistant inspired by the AI from Iron Man.
You are helpful, intelligent, and speak with a refined British accent.
Keep responses concise but informative. Be witty when appropriate.
You have access to the user's conversation history and memories.`

    if (memories.length > 0) {
      const memoryContext = memories
        .map((m: any) => m.memory || m.text || m.content)
        .filter(Boolean)
        .join('\n- ')
      systemPrompt += `\n\nRelevant memories about the user:\n- ${memoryContext}`
    }

    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: 'user', content: userMessage },
    ]

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: conversationMessages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)

      const data = await response.json()
      const assistantMessage = data.choices[0].message.content

      // Save to memory in background
      addMemory(`User: ${userMessage}\nJarvis: ${assistantMessage}`)

      return assistantMessage
    } catch (error) {
      console.error('OpenAI error:', error)
      return "I encountered an error processing your request. Please try again."
    }
  }, [openaiApiKey, messages, searchMemories, addMemory])

  // Text-to-speech
  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!voiceEnabled) {
        resolve()
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      // Try to find a British voice
      const voices = speechSynthesis.getVoices()
      const preferredVoice = voices.find((v) =>
        v.name.includes('Daniel') ||
        v.name.includes('Google UK') ||
        v.lang.includes('en-GB')
      )
      if (preferredVoice) utterance.voice = preferredVoice

      utterance.onstart = () => {
        setState('speaking')
        // Simulate audio level for speaking
        const interval = setInterval(() => {
          setAudioLevel(0.3 + Math.random() * 0.4)
        }, 100)
        utterance.onend = () => {
          clearInterval(interval)
          setAudioLevel(0)
          resolve()
        }
        utterance.onerror = () => {
          clearInterval(interval)
          setAudioLevel(0)
          resolve()
        }
      }

      speechSynthesis.speak(utterance)
    })
  }, [voiceEnabled, setState, setAudioLevel])

  // Process user input
  const processInput = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current) return

    isProcessingRef.current = true
    addMessage('user', text)
    setState('thinking')
    setCurrentTranscript('')

    try {
      const response = await callOpenAI(text)
      addMessage('assistant', response)
      await speak(response)
    } catch (error) {
      console.error('Processing error:', error)
      setState('error')
    }

    isProcessingRef.current = false

    if (continuousMode) {
      setTimeout(() => {
        if (recognitionRef.current) {
          setState('listening')
          try {
            recognitionRef.current.start()
          } catch {}
        }
      }, 500)
    } else {
      setState('idle')
    }
  }, [addMessage, setState, setCurrentTranscript, callOpenAI, speak, continuousMode])

  // Audio analysis
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

      const analyze = () => {
        if (!analyserRef.current || !mediaStreamRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(average / 255)

        requestAnimationFrame(analyze)
      }

      analyze()
      return true
    } catch (error) {
      console.error('Audio error:', error)
      setMicPermission('denied')
      return false
    }
  }, [setAudioLevel, setMicPermission])

  const stopAudioAnalysis = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }, [setAudioLevel])

  // Speech recognition
  const initSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported')
      return null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    let currentTranscript = ''

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }

      if (interim) {
        currentTranscript = interim
        setCurrentTranscript(interim)

        // Reset silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        silenceTimerRef.current = setTimeout(() => {
          if (currentTranscript.trim()) {
            recognition.stop()
            processInput(currentTranscript.trim())
            currentTranscript = ''
          }
        }, 1500)
      }

      if (final) {
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current)
        }
        recognition.stop()
        processInput(final.trim())
        currentTranscript = ''
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech error:', event.error)
      }
    }

    recognition.onend = () => {
      // Auto-restart if in continuous mode and not processing
      if (continuousMode && !isProcessingRef.current && mediaStreamRef.current) {
        setTimeout(() => {
          try {
            recognition.start()
          } catch {}
        }, 100)
      }
    }

    return recognition
  }, [setCurrentTranscript, processInput, continuousMode])

  // Start session
  const startConversation = useCallback(async () => {
    if (!openaiApiKey) {
      console.error('No OpenAI API key')
      return false
    }

    const audioReady = await startAudioAnalysis()
    if (!audioReady) return false

    recognitionRef.current = initSpeechRecognition()
    if (!recognitionRef.current) return false

    setIsConnected(true)
    setState('listening')

    try {
      recognitionRef.current.start()
    } catch {}

    return true
  }, [openaiApiKey, startAudioAnalysis, initSpeechRecognition, setIsConnected, setState])

  // End session
  const endConversation = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current)
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {}
      recognitionRef.current = null
    }

    stopAudioAnalysis()
    speechSynthesis.cancel()
    setIsConnected(false)
    setState('idle')
    setCurrentTranscript('')
  }, [stopAudioAnalysis, setIsConnected, setState, setCurrentTranscript])

  // Cleanup
  useEffect(() => {
    return () => {
      endConversation()
    }
  }, [endConversation])

  return {
    startConversation,
    endConversation,
    isReady: !!openaiApiKey,
  }
}
