'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useConversation } from '@elevenlabs/react'
import { useJarvisStore } from '@/store/jarvis-store'

export function useElevenLabs() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const {
    elevenLabsAgentId,
    elevenLabsApiKey,
    setState,
    setAudioLevel,
    setCurrentTranscript,
    addMessage,
    setIsConnected,
    setMicPermission,
    continuousMode,
    memoryEnabled,
    mem0ApiKey,
  } = useJarvisStore()

  // Web search client tool
  const searchWeb = useCallback(async (params: { query: string }): Promise<string> => {
    try {
      const response = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(params.query)}&format=json&no_html=1`
      )
      const data = await response.json()
      const results = data.RelatedTopics?.slice(0, 5).map((t: any) => t.Text || '').filter(Boolean) || []
      return results.length > 0 ? `Search results:\n${results.join('\n')}` : 'No results found.'
    } catch (error) {
      console.error('Search error:', error)
      return 'Search failed. Please try again.'
    }
  }, [])

  // Memory search client tool
  const searchMemory = useCallback(async (params: { query: string }): Promise<string> => {
    if (!memoryEnabled || !mem0ApiKey) {
      return 'Memory not enabled.'
    }

    try {
      const response = await fetch('https://api.mem0.ai/v1/memories/search/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${mem0ApiKey}`,
        },
        body: JSON.stringify({
          query: params.query,
          filters: { user_id: 'jarvis_user' },
          limit: 5,
        }),
      })

      if (!response.ok) return 'No memories found.'

      const data = await response.json()
      const memories = (data.results || data || [])
        .map((m: any) => m.memory || m.text || m.content)
        .filter(Boolean)
      return memories.length > 0 ? `Relevant memories:\n${memories.join('\n')}` : 'No relevant memories found.'
    } catch (error) {
      console.error('Memory search error:', error)
      return 'Memory search failed.'
    }
  }, [memoryEnabled, mem0ApiKey])

  // Save memory client tool
  const saveMemory = useCallback(async (params: { content: string }): Promise<string> => {
    if (!memoryEnabled || !mem0ApiKey) {
      return 'Memory not enabled.'
    }

    try {
      await fetch('https://api.mem0.ai/v1/memories/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${mem0ApiKey}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: params.content }],
          user_id: 'jarvis_user',
        }),
      })
      return 'Memory saved successfully.'
    } catch (error) {
      console.error('Memory save error:', error)
      return 'Failed to save memory.'
    }
  }, [memoryEnabled, mem0ApiKey])

  // Ref for speaking audio simulation
  const speakingAnimationRef = useRef<number | null>(null)
  const speakingStartTimeRef = useRef<number>(0)

  // Simulate dynamic audio level during speaking
  const startSpeakingAnimation = useCallback(() => {
    speakingStartTimeRef.current = Date.now()

    const animateSpeaking = () => {
      const elapsed = Date.now() - speakingStartTimeRef.current
      // Create varied audio levels using multiple sine waves for natural speech rhythm
      const t = elapsed / 1000
      const level = 0.3 +
        Math.sin(t * 8) * 0.15 +
        Math.sin(t * 12) * 0.1 +
        Math.sin(t * 3) * 0.2 +
        Math.random() * 0.1
      setAudioLevel(Math.max(0.2, Math.min(0.9, level)))
      speakingAnimationRef.current = requestAnimationFrame(animateSpeaking)
    }

    animateSpeaking()
  }, [setAudioLevel])

  const stopSpeakingAnimation = useCallback(() => {
    if (speakingAnimationRef.current) {
      cancelAnimationFrame(speakingAnimationRef.current)
      speakingAnimationRef.current = null
    }
  }, [])

  // ElevenLabs conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs')
      setIsConnected(true)
      setState('listening')
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs')
      setIsConnected(false)
      stopSpeakingAnimation()
      if (!continuousMode) {
        setState('idle')
      }
    },
    onMessage: (message) => {
      console.log('Message:', message)

      if (message.source === 'user') {
        if (message.message) {
          setCurrentTranscript(message.message)
          addMessage('user', message.message)
        }
      } else if (message.source === 'ai') {
        if (message.message) {
          setCurrentTranscript(message.message)
          addMessage('assistant', message.message)
        }
      }
    },
    onModeChange: (mode) => {
      console.log('Mode:', mode.mode)
      if (mode.mode === 'listening') {
        setState('listening')
        stopSpeakingAnimation()
        setCurrentTranscript('')
      } else if (mode.mode === 'speaking') {
        setState('speaking')
        startSpeakingAnimation()
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error)
      setState('error')
      stopSpeakingAnimation()
    },
    clientTools: {
      search_web: searchWeb,
      search_memory: searchMemory,
      save_memory: saveMemory,
    },
  })

  // Audio analysis for visualization
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

      const analyzeAudio = () => {
        if (!analyserRef.current || !mediaStreamRef.current) return

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)

        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        setAudioLevel(average / 255)

        animationFrameRef.current = requestAnimationFrame(analyzeAudio)
      }

      analyzeAudio()
      return true
    } catch (error) {
      console.error('Audio analysis error:', error)
      setMicPermission('denied')
      return false
    }
  }, [setAudioLevel, setMicPermission])

  const stopAudioAnalysis = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
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
    setAudioLevel(0)
  }, [setAudioLevel])

  // Get signed URL for authenticated agents
  const getSignedUrl = useCallback(async (): Promise<string | null> => {
    if (!elevenLabsApiKey) {
      // No API key means agent doesn't have authentication enabled
      return null
    }

    try {
      const response = await fetch('/api/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: elevenLabsAgentId,
          apiKey: elevenLabsApiKey,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to get signed URL:', error)
        return null
      }

      const data = await response.json()
      return data.signedUrl
    } catch (error) {
      console.error('Error fetching signed URL:', error)
      return null
    }
  }, [elevenLabsAgentId, elevenLabsApiKey])

  // Start conversation
  const startConversation = useCallback(async () => {
    if (!elevenLabsAgentId) {
      console.error('No agent ID configured')
      return false
    }

    try {
      // Start audio analysis first
      const audioReady = await startAudioAnalysis()
      if (!audioReady) {
        return false
      }

      setState('listening')

      // Get signed URL if API key is provided (for authenticated agents)
      const signedUrl = await getSignedUrl()

      // Start the ElevenLabs conversation
      if (signedUrl) {
        // Use signed URL for authenticated agents (websocket required for signedUrl)
        await conversation.startSession({
          signedUrl,
          connectionType: 'websocket',
        })
      } else {
        // Use agent ID directly for non-authenticated agents
        await conversation.startSession({
          agentId: elevenLabsAgentId,
          connectionType: 'webrtc',
        })
      }

      return true
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setState('error')
      stopAudioAnalysis()
      return false
    }
  }, [elevenLabsAgentId, conversation, setState, startAudioAnalysis, stopAudioAnalysis, getSignedUrl])

  // End conversation
  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession()
    } catch (error) {
      console.error('Error ending conversation:', error)
    }
    stopAudioAnalysis()
    setIsConnected(false)
    setState('idle')
  }, [conversation, setIsConnected, setState, stopAudioAnalysis])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioAnalysis()
      stopSpeakingAnimation()
    }
  }, [stopAudioAnalysis, stopSpeakingAnimation])

  return {
    startConversation,
    endConversation,
    isReady: !!elevenLabsAgentId,
    status: conversation.status,
    isSpeaking: conversation.isSpeaking,
  }
}
