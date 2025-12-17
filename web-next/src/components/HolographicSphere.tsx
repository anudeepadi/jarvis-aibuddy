'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useJarvisStore, ConversationState } from '@/store/jarvis-store'

const STATE_COLORS: Record<ConversationState, { primary: number[], glow: number[] }> = {
  idle: {
    primary: [0, 212, 255],    // Cyan
    glow: [0, 212, 255, 0.3],
  },
  listening: {
    primary: [0, 128, 255],    // Blue
    glow: [0, 128, 255, 0.4],
  },
  thinking: {
    primary: [139, 92, 246],   // Purple
    glow: [139, 92, 246, 0.4],
  },
  speaking: {
    primary: [0, 255, 136],    // Green
    glow: [0, 255, 136, 0.4],
  },
  error: {
    primary: [255, 107, 53],   // Orange
    glow: [255, 107, 53, 0.4],
  },
}

interface Particle {
  x: number
  y: number
  z: number
  baseX: number
  baseY: number
  baseZ: number
  size: number
  offset: number
  ring: number
}

export function HolographicSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)
  const particlesRef = useRef<Particle[]>([])
  const rotationRef = useRef({ x: 0, y: 0 })
  const breatheRef = useRef(0)
  const currentColorRef = useRef([0, 212, 255])

  const state = useJarvisStore((s) => s.state)
  const audioLevel = useJarvisStore((s) => s.audioLevel)
  const audioLevelRef = useRef(0)
  const targetAudioLevelRef = useRef(0)

  // Update refs when store changes
  useEffect(() => {
    targetAudioLevelRef.current = audioLevel
  }, [audioLevel])

  const createParticles = useCallback((radius: number) => {
    const particles: Particle[] = []
    const numParticles = 1200

    // Fibonacci sphere distribution for main particles
    for (let i = 0; i < numParticles * 0.7; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / (numParticles * 0.7))
      const theta = Math.PI * (1 + Math.sqrt(5)) * i

      particles.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
        baseX: Math.sin(phi) * Math.cos(theta),
        baseY: Math.sin(phi) * Math.sin(theta),
        baseZ: Math.cos(phi),
        size: Math.random() * 1.5 + 0.5,
        offset: Math.random() * Math.PI * 2,
        ring: 0,
      })
    }

    // Orbital rings
    const numRings = 3
    const particlesPerRing = Math.floor(numParticles * 0.3 / numRings)

    for (let ring = 0; ring < numRings; ring++) {
      const ringRadius = 1.1 + ring * 0.15
      const tilt = (ring * 30 - 15) * (Math.PI / 180)

      for (let i = 0; i < particlesPerRing; i++) {
        const angle = (i / particlesPerRing) * Math.PI * 2
        const x = Math.cos(angle) * ringRadius
        const y = Math.sin(angle) * ringRadius * Math.cos(tilt)
        const z = Math.sin(angle) * ringRadius * Math.sin(tilt)

        particles.push({
          x, y, z,
          baseX: x,
          baseY: y,
          baseZ: z,
          size: Math.random() * 1 + 0.3,
          offset: Math.random() * Math.PI * 2,
          ring: ring + 1,
        })
      }
    }

    return particles
  }, [])

  const animate = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    const width = rect.width
    const height = rect.height

    // Set canvas size
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) * 0.28

    // Initialize particles if needed
    if (particlesRef.current.length === 0) {
      particlesRef.current = createParticles(radius)
    }

    // Get target color
    const targetColor = STATE_COLORS[state].primary

    // Smooth color interpolation
    for (let i = 0; i < 3; i++) {
      currentColorRef.current[i] += (targetColor[i] - currentColorRef.current[i]) * 0.05
    }

    // Smooth audio level
    audioLevelRef.current += (targetAudioLevelRef.current - audioLevelRef.current) * 0.15
    targetAudioLevelRef.current *= 0.95

    // Update rotation
    rotationRef.current.y += 0.003 + audioLevelRef.current * 0.015
    breatheRef.current += 0.012

    const breatheScale = 1 + Math.sin(breatheRef.current) * 0.02
    const audioScale = 1 + audioLevelRef.current * 0.3

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // Draw ambient glow
    const [r, g, b] = currentColorRef.current
    const glowGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius * 2
    )
    glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.08 + audioLevelRef.current * 0.15})`)
    glowGradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${0.04 + audioLevelRef.current * 0.08})`)
    glowGradient.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${0.01 + audioLevelRef.current * 0.03})`)
    glowGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glowGradient
    ctx.fillRect(0, 0, width, height)

    // Update and sort particles
    const cosY = Math.cos(rotationRef.current.y)
    const sinY = Math.sin(rotationRef.current.y)
    const cosX = Math.cos(rotationRef.current.x)
    const sinX = Math.sin(rotationRef.current.x)

    const particles = particlesRef.current.map((p) => {
      // Rotation around Y axis
      let x = p.baseX * cosY - p.baseZ * sinY
      let z = p.baseX * sinY + p.baseZ * cosY
      let y = p.baseY

      // Rotation around X axis
      const tempY = y * cosX - z * sinX
      z = y * sinX + z * cosX
      y = tempY

      // Ring-specific rotation
      if (p.ring > 0) {
        const ringSpeed = 1 + p.ring * 0.5
        const ringAngle = rotationRef.current.y * ringSpeed
        const cos = Math.cos(ringAngle)
        const sin = Math.sin(ringAngle)
        const newX = p.baseX * cos - p.baseZ * sin
        const newZ = p.baseX * sin + p.baseZ * cos
        x = newX
        z = newZ
      }

      // Audio displacement
      const displacement = audioLevelRef.current * 0.25 * Math.sin(breatheRef.current * 3 + p.offset)

      return {
        ...p,
        x: x * (breatheScale + displacement) * audioScale,
        y: y * (breatheScale + displacement) * audioScale,
        z: z * (breatheScale + displacement) * audioScale,
      }
    })

    // Sort by z-depth
    particles.sort((a, b) => a.z - b.z)

    // Draw particles
    for (const p of particles) {
      const scale = (p.z + 1.5) / 2.5
      const projectedX = centerX + p.x * radius
      const projectedY = centerY + p.y * radius
      const particleSize = p.size * scale * (1 + audioLevelRef.current * 0.5)
      const alpha = 0.2 + scale * 0.8

      // Particle glow
      if (particleSize > 1) {
        const glowSize = particleSize * 3
        const particleGlow = ctx.createRadialGradient(
          projectedX, projectedY, 0,
          projectedX, projectedY, glowSize
        )
        particleGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`)
        particleGlow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = particleGlow
        ctx.fillRect(
          projectedX - glowSize,
          projectedY - glowSize,
          glowSize * 2,
          glowSize * 2
        )
      }

      // Particle core
      ctx.beginPath()
      ctx.arc(projectedX, projectedY, particleSize, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
      ctx.fill()
    }

    // Draw central core
    const coreGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, radius * 0.15
    )
    coreGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.4 + audioLevelRef.current * 0.3})`)
    coreGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.1)`)
    coreGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = coreGradient
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius * 0.15, 0, Math.PI * 2)
    ctx.fill()

    animationRef.current = requestAnimationFrame(animate)
  }, [state, createParticles])

  useEffect(() => {
    animate()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute rounded-full transition-all duration-1000"
        style={{
          width: '70%',
          height: '70%',
          background: `radial-gradient(circle, transparent 60%, rgba(${STATE_COLORS[state].primary.join(',')}, 0.05) 100%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ maxWidth: '600px', maxHeight: '600px' }}
      />

      {/* Scan line overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="scan-line" />
      </div>
    </div>
  )
}
