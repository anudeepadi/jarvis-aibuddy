'use client'

import { useState } from 'react'
import { useJarvisStore, OpenAIVoice, CartesiaVoice } from '@/store/jarvis-store'

const OPENAI_VOICES: { id: OpenAIVoice; name: string; description: string }[] = [
  { id: 'onyx', name: 'Onyx', description: 'Deep & authoritative' },
  { id: 'echo', name: 'Echo', description: 'Warm & clear' },
  { id: 'fable', name: 'Fable', description: 'Expressive & British' },
  { id: 'alloy', name: 'Alloy', description: 'Neutral & balanced' },
  { id: 'nova', name: 'Nova', description: 'Friendly & upbeat' },
  { id: 'shimmer', name: 'Shimmer', description: 'Soft & gentle' },
]

const CARTESIA_VOICES: { id: CartesiaVoice; name: string; description: string }[] = [
  { id: 'british-butler', name: 'British Butler', description: 'Professional British' },
  { id: 'confident-british', name: 'Confident', description: 'Assertive British' },
  { id: 'deep-narrator', name: 'Deep Narrator', description: 'Deep male voice' },
  { id: 'professional-male', name: 'Professional', description: 'Business male' },
  { id: 'professional-female', name: 'Pro Female', description: 'Business female' },
  { id: 'warm-female', name: 'Warm Female', description: 'Friendly narrator' },
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
  } = useJarvisStore()

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#1a1a1a] rounded-2xl border border-gray-800 p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-white">Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
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
              <div className="font-medium text-sm">Cartesia</div>
              <div className="text-xs text-gray-500">Best Value ~$0.02/min</div>
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
                Groq API Key <span className="text-gray-600">(for STT)</span>
              </label>
              <input
                type="password"
                value={localKeys.groqApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, groqApiKey: e.target.value })}
                placeholder="gsk_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                console.groq.com - Free Whisper STT
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                OpenAI API Key <span className="text-gray-600">(for LLM)</span>
              </label>
              <input
                type="password"
                value={localKeys.openaiApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, openaiApiKey: e.target.value })}
                placeholder="sk-xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                platform.openai.com - GPT-4o-mini
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Cartesia API Key <span className="text-gray-600">(for TTS)</span>
              </label>
              <input
                type="password"
                value={localKeys.cartesiaApiKey}
                onChange={(e) => setLocalKeys({ ...localKeys, cartesiaApiKey: e.target.value })}
                placeholder="sk_car_xxxxxxxxxx"
                className="w-full px-3 py-2.5 rounded-lg bg-[#0d0d0d] border border-gray-700 text-white placeholder-gray-600 focus:border-cyan-500 focus:outline-none font-mono text-sm"
              />
              <p className="mt-1.5 text-xs text-gray-500">
                cartesia.ai - Ultra-low latency TTS (~40ms)
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                Voice
              </label>
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
        <div className="space-y-4 mb-6 border-t border-gray-800 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-white">Voice Responses</div>
              <div className="text-xs text-gray-500">Enable text-to-speech</div>
            </div>
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                voiceEnabled ? 'bg-cyan-500' : 'bg-gray-700'
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
              <div className="text-sm text-white">Continuous Mode</div>
              <div className="text-xs text-gray-500">Auto-resume listening</div>
            </div>
            <button
              onClick={() => setContinuousMode(!continuousMode)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                continuousMode ? 'bg-cyan-500' : 'bg-gray-700'
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
              <div className="text-sm text-white">Memory</div>
              <div className="text-xs text-gray-500">Remember conversations</div>
            </div>
            <button
              onClick={() => setMemoryEnabled(!memoryEnabled)}
              className={`w-11 h-6 rounded-full transition-colors relative ${
                memoryEnabled ? 'bg-cyan-500' : 'bg-gray-700'
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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-300 hover:bg-white/5 transition-colors"
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
