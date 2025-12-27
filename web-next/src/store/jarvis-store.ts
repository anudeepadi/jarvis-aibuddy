import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ConversationState = 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
export type AIProvider = 'elevenlabs' | 'openai' | 'groq' | 'cartesia' | 'gemini-live'
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
export type CartesiaVoice = 'british-butler' | 'confident-british' | 'deep-narrator' | 'professional-male' | 'wise-man' | 'reading-man' | 'professional-female' | 'british-lady' | 'warm-female' | 'commercial-lady'
export type EdgeVoice = 'british-male' | 'american-male' | 'australian-male' | 'british-female' | 'american-female' | 'australian-female'
export type GeminiVoice = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede' | 'Orbit' | 'Clio' | 'Zephyr' | 'Nova' | 'Aria'
export type TTSProvider = 'cartesia' | 'edge'
export type Theme = 'dark' | 'light'
export type Language = 'auto' | 'en' | 'hi' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ja' | 'ko' | 'zh' | 'ar' | 'ru'

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
  groqApiKey: string
  cartesiaApiKey: string
  geminiApiKey: string
  mem0ApiKey: string
  setApiKey: (key: 'elevenLabsApiKey' | 'elevenLabsAgentId' | 'openaiApiKey' | 'groqApiKey' | 'cartesiaApiKey' | 'geminiApiKey' | 'mem0ApiKey', value: string) => void

  // Settings
  voiceEnabled: boolean
  setVoiceEnabled: (enabled: boolean) => void
  continuousMode: boolean
  setContinuousMode: (enabled: boolean) => void
  memoryEnabled: boolean
  setMemoryEnabled: (enabled: boolean) => void
  openaiVoice: OpenAIVoice
  setOpenaiVoice: (voice: OpenAIVoice) => void
  cartesiaVoice: CartesiaVoice
  setCartesiaVoice: (voice: CartesiaVoice) => void
  geminiVoice: GeminiVoice
  setGeminiVoice: (voice: GeminiVoice) => void
  ttsProvider: TTSProvider
  setTtsProvider: (provider: TTSProvider) => void
  edgeVoice: EdgeVoice
  setEdgeVoice: (voice: EdgeVoice) => void
  language: Language
  setLanguage: (language: Language) => void

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

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void

  // Memory feedback
  lastMemorySaved: number | null
  setLastMemorySaved: (timestamp: number | null) => void

  // Memory retrieval visibility
  lastMemoryRetrieved: { count: number; query: string; timestamp: number } | null
  setLastMemoryRetrieved: (data: { count: number; query: string; timestamp: number } | null) => void

  // Calendar UI
  showCalendar: boolean
  setShowCalendar: (show: boolean) => void

  // Wake Word
  wakeWordEnabled: boolean
  setWakeWordEnabled: (enabled: boolean) => void

  // Location
  userLocation: { lat: number; lon: number; city?: string } | null
  setUserLocation: (location: { lat: number; lon: number; city?: string } | null) => void
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
      groqApiKey: '',
      cartesiaApiKey: '',
      geminiApiKey: '',
      mem0ApiKey: '',
      setApiKey: (key, value) => set({ [key]: value }),

      // Settings
      voiceEnabled: true,
      setVoiceEnabled: (voiceEnabled) => set({ voiceEnabled }),
      continuousMode: true,
      setContinuousMode: (continuousMode) => set({ continuousMode }),
      memoryEnabled: true,
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      openaiVoice: 'onyx',
      setOpenaiVoice: (openaiVoice) => set({ openaiVoice }),
      cartesiaVoice: 'british-butler',
      setCartesiaVoice: (cartesiaVoice) => set({ cartesiaVoice }),
      geminiVoice: 'Puck', // Default Gemini HD voice
      setGeminiVoice: (geminiVoice) => set({ geminiVoice }),
      ttsProvider: 'edge', // Default to free Edge TTS
      setTtsProvider: (ttsProvider) => set({ ttsProvider }),
      edgeVoice: 'british-male', // Best JARVIS voice
      setEdgeVoice: (edgeVoice) => set({ edgeVoice }),
      language: 'en', // Default to English, no auto-detection
      setLanguage: (language) => set({ language }),

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

      // Theme
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

      // Memory feedback
      lastMemorySaved: null,
      setLastMemorySaved: (lastMemorySaved) => set({ lastMemorySaved }),

      // Memory retrieval visibility
      lastMemoryRetrieved: null,
      setLastMemoryRetrieved: (lastMemoryRetrieved) => set({ lastMemoryRetrieved }),

      // Calendar UI
      showCalendar: false,
      setShowCalendar: (showCalendar) => set({ showCalendar }),

      // Wake Word
      wakeWordEnabled: false,
      setWakeWordEnabled: (wakeWordEnabled) => set({ wakeWordEnabled }),

      // Location
      userLocation: null,
      setUserLocation: (userLocation) => set({ userLocation }),
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
        groqApiKey: state.groqApiKey,
        cartesiaApiKey: state.cartesiaApiKey,
        geminiApiKey: state.geminiApiKey,
        mem0ApiKey: state.mem0ApiKey,
        provider: state.provider,
        voiceEnabled: state.voiceEnabled,
        continuousMode: state.continuousMode,
        memoryEnabled: state.memoryEnabled,
        openaiVoice: state.openaiVoice,
        cartesiaVoice: state.cartesiaVoice,
        geminiVoice: state.geminiVoice,
        ttsProvider: state.ttsProvider,
        edgeVoice: state.edgeVoice,
        language: state.language,
        theme: state.theme,
        messages: state.messages, // Persist conversation history
        wakeWordEnabled: state.wakeWordEnabled,
      }),
    }
  )
)
