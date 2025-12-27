'use client'

import { useRef, useEffect } from 'react'
import { useJarvisStore, Theme } from '@/store/jarvis-store'

interface FibonacciSphereProps {
  theme?: Theme
}

// ═══════════════════════════════════════════════════════════════════════════════
// CINEMATIC COLOR PALETTE
// ═══════════════════════════════════════════════════════════════════════════════

const COLORS = {
  idle: { r: 148, g: 163, b: 184 },      // Slate-400
  listening: { r: 59, g: 130, b: 246 },   // Blue-500
  thinking: { r: 168, g: 85, b: 247 },    // Purple-500
  speaking: { r: 6, g: 182, b: 212 },     // Cyan-500
  error: { r: 239, g: 68, b: 68 },        // Red-500
}

const COLORS_LIGHT = {
  idle: { r: 71, g: 85, b: 105 },         // Slate-600
  listening: { r: 37, g: 99, b: 235 },    // Blue-600
  thinking: { r: 147, g: 51, b: 234 },    // Purple-600
  speaking: { r: 8, g: 145, b: 178 },     // Cyan-600
  error: { r: 220, g: 38, b: 38 },        // Red-600
}

export function FibonacciSphere({ theme = 'dark' }: FibonacciSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const targetScaleRef = useRef(1)
  const currentScaleRef = useRef(1)
  const breatheRef = useRef(0)
  const colorTransitionRef = useRef({ r: 148, g: 163, b: 184 })

  const state = useJarvisStore((s) => s.state)
  const audioLevel = useJarvisStore((s) => s.audioLevel)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    // ─────────────────────────────────────────────────────────────────────────
    // Generate Fibonacci Sphere Points
    // ─────────────────────────────────────────────────────────────────────────
    const points: { x: number; y: number; z: number }[] = []
    const numPoints = 800

    const goldenRatio = (1 + Math.sqrt(5)) / 2
    for (let i = 0; i < numPoints; i++) {
      const theta = 2 * Math.PI * i / goldenRatio
      const phi = Math.acos(1 - 2 * (i + 0.5) / numPoints)
      points.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.sin(phi) * Math.sin(theta),
        z: Math.cos(phi),
      })
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Canvas Setup
    // ─────────────────────────────────────────────────────────────────────────
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    // ─────────────────────────────────────────────────────────────────────────
    // Animation Loop
    // ─────────────────────────────────────────────────────────────────────────
    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const baseRadius = Math.min(rect.width, rect.height) * 0.38

      // Get current state
      const currentState = useJarvisStore.getState().state
      const currentAudioLevel = useJarvisStore.getState().audioLevel
      const currentTheme = theme

      // ───────────────────────────────────────────────────────────────────────
      // Color Transition (Smooth interpolation between state colors)
      // ───────────────────────────────────────────────────────────────────────
      const palette = currentTheme === 'dark' ? COLORS : COLORS_LIGHT
      const targetColor = palette[currentState as keyof typeof palette] || palette.idle

      // Smooth color transition
      colorTransitionRef.current.r += (targetColor.r - colorTransitionRef.current.r) * 0.08
      colorTransitionRef.current.g += (targetColor.g - colorTransitionRef.current.g) * 0.08
      colorTransitionRef.current.b += (targetColor.b - colorTransitionRef.current.b) * 0.08

      const { r, g, b } = colorTransitionRef.current

      // ───────────────────────────────────────────────────────────────────────
      // Scale Animation (Audio-reactive + breathing)
      // ───────────────────────────────────────────────────────────────────────
      const isActive = currentState === 'listening' || currentState === 'speaking'

      // Breathing animation (subtle pulse even when idle)
      breatheRef.current += 0.02
      const breathe = Math.sin(breatheRef.current) * 0.02

      if (isActive) {
        const expansionMultiplier = currentState === 'speaking' ? 0.35 : 0.2
        targetScaleRef.current = 1 + (currentAudioLevel * expansionMultiplier) + breathe
      } else if (currentState === 'thinking') {
        // Faster breathing when thinking
        targetScaleRef.current = 1 + Math.sin(breatheRef.current * 2) * 0.04
      } else {
        targetScaleRef.current = 1 + breathe
      }

      // Smooth scale interpolation
      currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * 0.12
      const radius = baseRadius * currentScaleRef.current

      // ───────────────────────────────────────────────────────────────────────
      // Rotation Speed
      // ───────────────────────────────────────────────────────────────────────
      const rotationSpeed = currentState === 'thinking' ? 0.015 :
                            currentState === 'speaking' ? 0.008 :
                            currentState === 'listening' ? 0.005 : 0.002

      rotationRef.current += rotationSpeed

      // ───────────────────────────────────────────────────────────────────────
      // Project Points to 2D
      // ───────────────────────────────────────────────────────────────────────
      const projected: { x: number; y: number; z: number; size: number }[] = []

      for (const point of points) {
        // Rotate around Y axis
        const cosR = Math.cos(rotationRef.current)
        const sinR = Math.sin(rotationRef.current)
        const x = point.x * cosR - point.z * sinR
        const z = point.x * sinR + point.z * cosR
        const y = point.y

        // Slight tilt for 3D effect
        const tilt = 0.25
        const cosT = Math.cos(tilt)
        const sinT = Math.sin(tilt)
        const y2 = y * cosT - z * sinT
        const z2 = y * sinT + z * cosT

        // Project to 2D
        const px = centerX + x * radius
        const py = centerY + y2 * radius

        // Calculate dot size based on depth
        const depth = (z2 + 1) / 2
        const size = 1.2 + depth * 2

        projected.push({ x: px, y: py, z: z2, size })
      }

      // Sort by z for depth (back to front)
      projected.sort((a, b) => a.z - b.z)

      // ───────────────────────────────────────────────────────────────────────
      // Draw Ambient Glow (Background bloom)
      // ───────────────────────────────────────────────────────────────────────
      const isActiveState = currentState !== 'idle'
      const glowIntensity = isActiveState ? 0.15 + currentAudioLevel * 0.1 : 0.05

      const ambientGlow = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, radius * 1.2
      )
      ambientGlow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${glowIntensity})`)
      ambientGlow.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${glowIntensity * 0.3})`)
      ambientGlow.addColorStop(1, 'transparent')

      ctx.fillStyle = ambientGlow
      ctx.fillRect(0, 0, rect.width, rect.height)

      // ───────────────────────────────────────────────────────────────────────
      // Draw Particles with Bloom Effect
      // ───────────────────────────────────────────────────────────────────────
      for (const p of projected) {
        const depth = (p.z + 1) / 2
        const alpha = 0.25 + depth * 0.75

        // Bloom intensity based on state and audio
        const bloomBase = isActiveState ? 8 : 4
        const bloomAudio = isActive ? currentAudioLevel * 12 : 0
        const bloomSize = bloomBase + bloomAudio

        // Draw bloom/glow halo
        if (isActiveState || depth > 0.6) {
          ctx.save()
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`
          ctx.shadowBlur = bloomSize
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 0.8, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`
          ctx.fill()
          ctx.restore()
        }

        // Draw main particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`
        ctx.fill()

        // Draw bright core for front particles
        if (depth > 0.7) {
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(255, 255, 255, ${(depth - 0.7) * 2})`
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [theme])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ filter: 'contrast(1.05)' }}
    />
  )
}
