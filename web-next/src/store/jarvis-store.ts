import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ConversationState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
export type AIProvider = 'elevenlabs' | 'openai'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface JarvisStore {
  // Hydration state
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

  // Connection state
  state: ConversationState
  setState: (state: ConversationState) => void

  // Provider selection
  provider: AIProvider
  setProvider: (provider: AIProvider) => void

  // API Keys (persisted)
  elevenLabsApiKey: string
  elevenLabsAgentId: string
  openaiApiKey: string
  mem0ApiKey: string
  setApiKey: (key: 'elevenLabsApiKey' | 'elevenLabsAgentId' | 'openaiApiKey' | 'mem0ApiKey', value: string) => void

  // Settings
  voiceEnabled: boolean
  setVoiceEnabled: (enabled: boolean) => void
  continuousMode: boolean
  setContinuousMode: (enabled: boolean) => void
  memoryEnabled: boolean
  setMemoryEnabled: (enabled: boolean) => void

  // Conversation history
  messages: Message[]
  addMessage: (role: 'user' | 'assistant', content: string) => void
  clearMessages: () => void

  // Transcript (live)
  currentTranscript: string
  setCurrentTranscript: (text: string) => void

  // Audio level (for visualization)
  audioLevel: number
  setAudioLevel: (level: number) => void

  // Session
  isConnected: boolean
  setIsConnected: (connected: boolean) => void

  // Permission state
  micPermission: 'prompt' | 'granted' | 'denied'
  setMicPermission: (permission: 'prompt' | 'granted' | 'denied') => void
}

export const useJarvisStore = create<JarvisStore>()(
  persist(
    (set) => ({
      // Hydration tracking
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Initial state
      state: 'idle',
      setState: (state) => set({ state }),

      provider: 'elevenlabs',
      setProvider: (provider) => set({ provider }),

      // API Keys
      elevenLabsApiKey: '',
      elevenLabsAgentId: '',
      openaiApiKey: '',
      mem0ApiKey: '',
      setApiKey: (key, value) => set({ [key]: value }),

      // Settings
      voiceEnabled: true,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      continuousMode: true,
      setContinuousMode: (continuousMode) => set({ continuousMode }),
      memoryEnabled: true,
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),

      // Conversation
      messages: [],
      addMessage: (role, content) => set((state) => ({
        messages: [...state.messages, {
          id: Date.now().toString(),
          role,
          content,
          timestamp: Date.now()
        }]
      })),
      clearMessages: () => set({ messages: [] }),

      // Transcript
      currentTranscript: '',
      setCurrentTranscript: (currentTranscript) => set({ currentTranscript }),

      // Audio
      audioLevel: 0,
      setAudioLevel: (audioLevel) => set({ audioLevel }),

      // Connection
      isConnected: false,
      setIsConnected: (isConnected) => set({ isConnected }),

      // Permissions
      micPermission: 'prompt',
      setMicPermission: (micPermission) => set({ micPermission }),
    }),
    {
      name: 'jarvis-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
      partialize: (state) => ({
        elevenLabsApiKey: state.elevenLabsApiKey,
        elevenLabsAgentId: state.elevenLabsAgentId,
        openaiApiKey: state.openaiApiKey,
        mem0ApiKey: state.mem0ApiKey,
        provider: state.provider,
        voiceEnabled: state.voiceEnabled,
        continuousMode: state.continuousMode,
        memoryEnabled: state.memoryEnabled,
      }),
    }
  )
)
