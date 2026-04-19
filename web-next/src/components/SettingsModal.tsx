'use client'

import { useState } from 'react'
import { useJarvisStore, OpenAIVoice, CartesiaVoice, EdgeVoice, TTSProvider, Theme, Language, VisualizationMode } from '@/store/jarvis-store'

const EDGE_VOICES: { id: EdgeVoice; name: string; description: string }[] = [
  { id: 'british-male', name: 'British Male', description: 'Ryan - Best for JARVIS' },
  { id: 'american-male', name: 'American Male', description: 'Guy - Clear & natural' },
  { id: 'australian-male', name: 'Australian Male', description: 'William - Friendly' },
  { id: 'british-female', name: 'British Female', description: 'Sonia - Professional' },
  { id: 'american-female', name: 'American Female', description: 'Jenny - Warm & clear' },
  { id: 'australian-female', name: 'Australian Female', description: 'Natasha - Upbeat' },
]

const OPENAI_VOICES: { id: OpenAIVoice; name: string; description: string }[] = [
  { id: 'onyx', name: 'Onyx', description: 'Deep & authoritative' },
  { id: 'echo', name: 'Echo', description: 'Warm & clear' },
  { id: 'fable', name: 'Fable', description: 'Expressive & British' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral & balanced' },
  { id: 'nova', name: 'Nova', description: 'Friendly & upbeat' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft & gentle' },
]

const CARTESIA_VOICES: { id: CartesiaVoice; name: string; description: string }[] = [
  { id: 'british-butler', name: 'Classy British', description: 'Refined & elegant' },
  { id: 'confident-british', name: 'Confident', description: 'Assertive British' },
  { id: 'deep-narrator', name: 'Newsman', description: 'Deep authoritative' },
  { id: 'professional-male', name: 'Support Man', description: 'Helpful & clear' },
  { id: 'wise-man', name: 'Wise Man', description: 'Calm & thoughtful' },
  { id: 'british-lady', name: 'British Lady', description: 'Elegant female' },
]

const LANGUAGES: { id: Language; name: string; description?: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'auto', name: 'Auto-detect', description: 'Detect from text' },
  { id: 'hi', name: 'Hindi' },
  { id: 'es', name: 'Spanish' },
  { id: 'fr', name: 'French' },
  { id: 'de', name: 'German' },
  { id: 'it', name: 'Italian' },
  { id: 'pt', name: 'Portuguese' },
  { id: 'ja', name: 'Japanese' },
  { id: 'ko', name: 'Korean' },
  { id: 'zh', name: 'Chinese' },
  { id: 'ar', name: 'Arabic' },
  { id: 'ru', name: 'Russian' },
]

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    provider,
    setProvider,
    elevenLabsApiKey,
    elevenLabsAgentId,
    openaiApiKey,
    groqApiKey,
    cartesiaApiKey,
    mem0ApiKey,
    setApiKey,
    voiceEnabled,
    setVoiceEnabled,
    continuousMode,
    setContinuousMode,
    memoryEnabled,
    setMemoryEnabled,
    openaiVoice,
    setOpenaiVoice,
    cartesiaVoice,
    setCartesiaVoice,
    ttsProvider,
    setTtsProvider,
    edgeVoice,
    setEdgeVoice,
    language,
    setLanguage,
    theme,
    setTheme,
    visualizationMode,
    setVisualizationMode,
  } = useJarvisStore()

  const isDark = theme === 'dark'

  const [localKeys, setLocalKeys] = useState({
    elevenLabsApiKey,
    elevenLabsAgentId,
    openaiApiKey,
    groqApiKey,
    cartesiaApiKey,
    mem0ApiKey,
  })

  const handleSave = () => {
    setApiKey('elevenLabsApiKey', localKeys.elevenLabsApiKey)
    setApiKey('elevenLabsAgentId', localKeys.elevenLabsAgentId)
    setApiKey('openaiApiKey', localKeys.openaiApiKey)
    setApiKey('groqApiKey', localKeys.groqApiKey)
    setApiKey('cartesiaApiKey', localKeys.cartesiaApiKey)
    setApiKey('mem0ApiKey', localKeys.mem0ApiKey)
    onClose()
  }

  if (!isOpen) return null

  // Theme-based colors
  const modalBg = isDark ? 'bg-[#1a1a1a]' : 'bg-white'
  const modalBorder = isDark ? 'border-gray-800' : 'border-gray-200'
  const textPrimary = isDark ? 'text-white' : 'text-gray-900'
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500'
  const textMuted = isDark ? 'text-gray-500' : 'text-gray-400'
  const inputBg = isDark ? 'bg-[#0d0d0d]' : 'bg-gray-50'
  const inputBorder = isDark ? 'border-gray-700' : 'border-gray-200'
  const buttonBorder = isDark ? 'border-gray-700' : 'border-gray-200'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className={`relative w-full max-w-md mx-4 ${modalBg} rounded-2xl border ${modalBorder} p-6 max-h-[90vh] overflow-y-auto`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-medium ${textPrimary}`}>Settings</h2>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors ${textSecondary} hover:${textPrimary}`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            Provider
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setProvider('cartesia')}
              className={`p-3 rounded-xl border transition-all ${
                provider === 'cartesia'
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="font-medium text-sm">Groq + TTS</div>
              <div className="text-xs text-green-500">FREE with Edge TTS</div>
            </button>
            <button
              onClick={() => setProvider('elevenlabs')}
              className={`p-3 rounded-xl border transition-all ${
                provider === 'elevenlabs'
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="font-medium text-sm">ElevenLabs</div>
              <div className="text-xs text-gray-500">Best Quality</div>
            </button>
            <button
              onClick={() => setProvider('groq')}
              className={`p-3 rounded-xl border transition-all ${
                provider === 'groq'
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="font-medium text-sm">Groq</div>
              <div className="text-xs text-gray-500">Cheapest ~$0.002/min</div>
            </button>
            <button
              onClick={() => setProvider('openai')}
              className={`p-3 rounded-xl border transition-all ${
                provider === 'openai'
                  ? 'border-cyan-500 bg-cyan-500/10 text-white'
                  : 'border-gray-700 hover:border-gray-600 text-gray-300'
              }`}
            >
              <div className="font-medium text-sm">OpenAI</div>
              <div className="text-xs text-gray-500">GPT + TTS ~$0.03/min</div>
            </button>
          </div>
        </div>

        {/* Cartesia Settings */}
        {provider === 'cartesia' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Groq API Key <span className="text-gray-600">(for STT + LLM)</span>
              </label>
              <input
                type="password"
                value={localKeys.groqApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, groqApiKey: e.target.value })}
                placeholder="gsk_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                console.groq.com - Free Whisper STT + Llama 70B
              </p>
            </div>

            {/* TTS Provider Toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Text-to-Speech
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setTtsProvider('edge')}
                  className={`p-3 rounded-xl border transition-all ${
                    ttsProvider === 'edge'
                      ? 'border-cyan-500 bg-cyan-500/10 text-white'
                      : 'border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">Edge TTS</div>
                  <div className="text-xs text-green-500">FREE - Microsoft</div>
                </button>
                <button
                  onClick={() => setTtsProvider('cartesia')}
                  className={`p-3 rounded-xl border transition-all ${
                    ttsProvider === 'cartesia'
                      ? 'border-cyan-500 bg-cyan-500/10 text-white'
                      : 'border-gray-700 hover:border-gray-600 text-gray-300'
                  }`}
                >
                  <div className="font-medium text-sm">Cartesia</div>
                  <div className="text-xs text-gray-500">~$0.01/min - 40ms</div>
                </button>
              </div>
            </div>

            {/* Cartesia API Key - only show if Cartesia TTS selected */}
            {ttsProvider === 'cartesia' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                  Cartesia API Key
                </label>
                <input
                  type="password"
                  value={localKeys.cartesiaApiKey}
                  onChange={(e) => setLocalKeys({ ...localKeys, cartesiaApiKey: e.target.value })}
                  placeholder="sk_car_xxxxxxxxxx"
                  className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  cartesia.ai - Ultra-low latency TTS
                </p>
              </div>
            )}

            {/* Voice Selection */}
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Voice
              </label>
              {ttsProvider === 'edge' ? (
                <div className="grid grid-cols-3 gap-2">
                  {EDGE_VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setEdgeVoice(voice.id)}
                      className={`p-2 rounded-lg border transition-all text-left ${
                        edgeVoice === voice.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className={`text-sm font-medium ${edgeVoice === voice.id ? 'text-white' : 'text-gray-300'}`}>
                        {voice.name}
                      </div>
                      <div className="text-xs text-gray-500">{voice.description}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {CARTESIA_VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setCartesiaVoice(voice.id)}
                      className={`p-2 rounded-lg border transition-all text-left ${
                        cartesiaVoice === voice.id
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className={`text-sm font-medium ${cartesiaVoice === voice.id ? 'text-white' : 'text-gray-300'}`}>
                        {voice.name}
                      </div>
                      <div className="text-xs text-gray-500">{voice.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Groq Settings */}
        {provider === 'groq' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Groq API Key
              </label>
              <input
                type="password"
                value={localKeys.groqApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, groqApiKey: e.target.value })}
                placeholder="gsk_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Free tier: Whisper STT + Llama 70B. Get key at console.groq.com
              </p>
            </div>
          </div>
        )}

        {/* ElevenLabs Settings */}
        {provider === 'elevenlabs' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Agent ID
              </label>
              <input
                type="text"
                value={localKeys.elevenLabsAgentId}
                onChange={(e) => setLocalKeys({ ...localKeys, elevenLabsAgentId: e.target.value })}
                placeholder="agent_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                API Key <span className="text-gray-600">(if auth enabled)</span>
              </label>
              <input
                type="password"
                value={localKeys.elevenLabsApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, elevenLabsApiKey: e.target.value })}
                placeholder="xi_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* OpenAI Settings */}
        {provider === 'openai' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                API Key
              </label>
              <input
                type="password"
                value={localKeys.openaiApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, openaiApiKey: e.target.value })}
                placeholder="sk-xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Voice
              </label>
              <div className="grid grid-cols-3 gap-2">
                {OPENAI_VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    onClick={() => setOpenaiVoice(voice.id)}
                    className={`p-2 rounded-lg border transition-all text-left ${
                      openaiVoice === voice.id
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className={`text-sm font-medium ${openaiVoice === voice.id ? 'text-white' : 'text-gray-300'}`}>
                      {voice.name}
                    </div>
                    <div className="text-xs text-gray-500">{voice.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mem0 Settings */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            Mem0 API Key <span className="text-gray-600">(optional)</span>
          </label>
          <input
            type="password"
            value={localKeys.mem0ApiKey}
            onChange={(e) => setLocalKeys({ ...localKeys, mem0ApiKey: e.target.value })}
            placeholder="m0-xxxxxxxxxx"
            className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
          />
        </div>

        {/* Toggles */}
        <div className={`space-y-4 mb-6 border-t ${modalBorder} pt-6`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm ${textPrimary}`}>Voice Responses</div>
              <div className={`text-xs ${textMuted}`}>Enable text-to-speech</div>
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                voiceEnabled ? 'bg-cyan-500' : (isDark ? 'bg-gray-700' : 'bg-gray-300')
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  voiceEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm ${textPrimary}`}>Continuous Mode</div>
              <div className={`text-xs ${textMuted}`}>Auto-resume listening</div>
            </div>
            <button
              onClick={() => setContinuousMode(!continuousMode)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                continuousMode ? 'bg-cyan-500' : (isDark ? 'bg-gray-700' : 'bg-gray-300')
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  continuousMode ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className={`text-sm ${textPrimary}`}>Memory</div>
              <div className={`text-xs ${textMuted}`}>Remember conversations</div>
            </div>
            <button
              onClick={() => setMemoryEnabled(!memoryEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                memoryEnabled ? 'bg-cyan-500' : (isDark ? 'bg-gray-700' : 'bg-gray-300')
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  memoryEnabled ? 'left-5' : 'left-0.5'
                }`}
              />
            </button>
          </div>

        </div>

        {/* Language Selection */}
        <div className={`mb-6 border-t ${modalBorder} pt-6`}>
          <label className={`block text-xs font-medium ${textSecondary} uppercase tracking-wide mb-3`}>
            Voice Language
          </label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className={`w-full px-3 py-2.5 rounded-lg ${inputBg} border ${inputBorder} ${textPrimary} focus:border-cyan-500 focus:outline-none text-sm`}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>
          <p className={`mt-1.5 text-xs ${textMuted}`}>
            {language === 'auto' ? 'Voice will match detected text language' : 'Fixed voice language regardless of text'}
          </p>
        </div>

        {/* Theme Selection */}
        <div className={`mb-6 border-t ${modalBorder} pt-6`}>
          <label className={`block text-xs font-medium ${textSecondary} uppercase tracking-wide mb-3`}>
            Theme
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setTheme('dark')}
              className={`p-3 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : `${buttonBorder} hover:border-gray-500`
              }`}
            >
              <div className={`font-medium text-sm ${theme === 'dark' ? textPrimary : textSecondary}`}>Dark</div>
              <div className={`text-xs ${textMuted}`}>Easier on eyes</div>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`p-3 rounded-xl border transition-all ${
                theme === 'light'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : `${buttonBorder} hover:border-gray-500`
              }`}
            >
              <div className={`font-medium text-sm ${theme === 'light' ? textPrimary : textSecondary}`}>Light</div>
              <div className={`text-xs ${textMuted}`}>Better visibility</div>
            </button>
          </div>
        </div>

        {/* Visualization Mode */}
        <div className={`mb-6 border-t ${modalBorder} pt-6`}>
          <label className={`block text-xs font-medium ${textSecondary} uppercase tracking-wide mb-3`}>
            Visualization
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setVisualizationMode('sphere')}
              className={`p-3 rounded-xl border transition-all ${
                visualizationMode === 'sphere'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : `${buttonBorder} hover:border-gray-500`
              }`}
            >
              <div className={`font-medium text-sm ${visualizationMode === 'sphere' ? textPrimary : textSecondary}`}>
                Sphere
              </div>
              <div className={`text-xs ${textMuted}`}>Classic JARVIS orb</div>
            </button>
            <button
              onClick={() => setVisualizationMode('terrain')}
              className={`p-3 rounded-xl border transition-all ${
                visualizationMode === 'terrain'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : `${buttonBorder} hover:border-gray-500`
              }`}
            >
              <div className={`font-medium text-sm ${visualizationMode === 'terrain' ? textPrimary : textSecondary}`}>
                Memory Terrain
              </div>
              <div className={`text-xs ${textMuted}`}>3D particle landscape</div>
            </button>
          </div>
          <p className={`mt-2 text-xs ${textMuted}`}>
            {visualizationMode === 'terrain'
              ? 'Terrain shaped by your memory patterns with reactive effects'
              : 'Classic animated sphere visualization'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2.5 rounded-xl border ${buttonBorder} text-sm font-medium ${textSecondary} hover:bg-black/5 transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2.5 rounded-xl bg-cyan-500 text-black text-sm font-medium hover:bg-cyan-400 transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
