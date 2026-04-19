'use client'

import { useCallback, useRef, useEffect } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

// ═══════════════════════════════════════════════════════════════════════════════
// JARVIS SOUND SYSTEM - Premium Audio Feedback
// Uses Web Audio API for procedural sounds (no external files needed)
// ═══════════════════════════════════════════════════════════════════════════════

type SoundType =
  | 'click'
  | 'hover'
  | 'connect'
  | 'disconnect'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'error'
  | 'success'

interface SoundConfig {
  frequency: number
  duration: number
  type: OscillatorType
  gain: number
  attack?: number
  decay?: number
  filterFreq?: number
}

// Sound configurations for each interaction type
const SOUND_CONFIGS: Record<SoundType, SoundConfig> = {
  click: {
    frequency: 440,
    duration: 0.08,
    type: 'sine',
    gain: 0.15,
    attack: 0.005,
    decay: 0.075,
  },
  hover: {
    frequency: 880,
    duration: 0.04,
    type: 'sine',
    gain: 0.05,
    attack: 0.01,
    decay: 0.03,
  },
  connect: {
    frequency: 523.25, // C5
    duration: 0.3,
    type: 'sine',
    gain: 0.2,
    attack: 0.05,
    decay: 0.25,
    filterFreq: 2000,
  },
  disconnect: {
    frequency: 392, // G4
    duration: 0.25,
    type: 'sine',
    gain: 0.15,
    attack: 0.02,
    decay: 0.23,
  },
  listening: {
    frequency: 659.25, // E5
    duration: 0.15,
    type: 'sine',
    gain: 0.12,
    attack: 0.02,
    decay: 0.13,
  },
  thinking: {
    frequency: 783.99, // G5
    duration: 0.12,
    type: 'triangle',
    gain: 0.1,
    attack: 0.02,
    decay: 0.1,
  },
  speaking: {
    frequency: 1046.5, // C6
    duration: 0.18,
    type: 'sine',
    gain: 0.12,
    attack: 0.03,
    decay: 0.15,
  },
  error: {
    frequency: 220, // A3
    duration: 0.3,
    type: 'sawtooth',
    gain: 0.15,
    attack: 0.01,
    decay: 0.29,
    filterFreq: 800,
  },
  success: {
    frequency: 880,
    duration: 0.2,
    type: 'sine',
    gain: 0.15,
    attack: 0.02,
    decay: 0.18,
  },
}

export function useSounds() {
  const audioContextRef = useRef<AudioContext | null>(null)
  const soundEnabled = useJarvisStore((s) => s.soundEnabled ?? true)
  const previousStateRef = useRef<string | null>(null)

  // Initialize AudioContext on first interaction (browser requirement)
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume()
    }
    return audioContextRef.current
  }, [])

  // Play a procedural sound
  const playSound = useCallback((type: SoundType) => {
    if (!soundEnabled) return

    try {
      const ctx = getAudioContext()
      const config = SOUND_CONFIGS[type]
      const now = ctx.currentTime

      // Create oscillator
      const oscillator = ctx.createOscillator()
      oscillator.type = config.type
      oscillator.frequency.setValueAtTime(config.frequency, now)

      // Create gain node for envelope
      const gainNode = ctx.createGain()
      gainNode.gain.setValueAtTime(0, now)

      // Attack
      gainNode.gain.linearRampToValueAtTime(
        config.gain,
        now + (config.attack || 0.01)
      )

      // Decay
      gainNode.gain.exponentialRampToValueAtTime(
        0.001,
        now + config.duration
      )

      // Optional low-pass filter for smoother sounds
      if (config.filterFreq) {
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.setValueAtTime(config.filterFreq, now)
        oscillator.connect(filter)
        filter.connect(gainNode)
      } else {
        oscillator.connect(gainNode)
      }

      gainNode.connect(ctx.destination)

      // Start and stop
      oscillator.start(now)
      oscillator.stop(now + config.duration)

      // Cleanup
      oscillator.onended = () => {
        oscillator.disconnect()
        gainNode.disconnect()
      }
    } catch (error) {
      // Silently fail if audio context creation fails
      console.debug('Sound playback failed:', error)
    }
  }, [soundEnabled, getAudioContext])

  // Play ascending chord for connect
  const playConnectSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      const ctx = getAudioContext()
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5 (C major)

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        gain.gain.setValueAtTime(0, now + i * 0.08)
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.08 + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + i * 0.08)
        osc.stop(now + 0.6)
      })
    } catch {
      // Silent fail
    }
  }, [soundEnabled, getAudioContext])

  // Play descending notes for disconnect
  const playDisconnectSound = useCallback(() => {
    if (!soundEnabled) return

    try {
      const ctx = getAudioContext()
      const now = ctx.currentTime
      const notes = [659.25, 523.25, 392] // E5, C5, G4 (descending)

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, now)

        gain.gain.setValueAtTime(0, now + i * 0.06)
        gain.gain.linearRampToValueAtTime(0.1, now + i * 0.06 + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now + i * 0.06)
        osc.stop(now + 0.5)
      })
    } catch {
      // Silent fail
    }
  }, [soundEnabled, getAudioContext])

  // Hook to play state change sounds automatically
  const state = useJarvisStore((s) => s.state)

  useEffect(() => {
    if (previousStateRef.current !== state && previousStateRef.current !== null) {
      // State changed - play appropriate sound
      if (state === 'listening') playSound('listening')
      else if (state === 'thinking') playSound('thinking')
      else if (state === 'speaking') playSound('speaking')
      else if (state === 'error') playSound('error')
    }
    previousStateRef.current = state
  }, [state, playSound])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return {
    playSound,
    playConnectSound,
    playDisconnectSound,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT SOUND TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type { SoundType }
