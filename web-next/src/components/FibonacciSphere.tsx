'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useJarvisStore, Theme } from '@/store/jarvis-store'

interface FibonacciSphereProps {
  theme?: Theme
}

export function FibonacciSphere({ theme = 'dark' }: FibonacciSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rotationRef = useRef(0)
  const targetScaleRef = useRef(1)
  const currentScaleRef = useRef(1)

  const state = useJarvisStore((s) => s.state)
  const audioLevel = useJarvisStore((s) => s.audioLevel)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const points: { x: number; y: number; z: number }[] = []
    const numPoints = 800

    // Generate Fibonacci sphere points
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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }

    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const baseRadius = Math.min(rect.width, rect.height) * 0.38

      // Get current state from store
      const currentState = useJarvisStore.getState().state
      const currentAudioLevel = useJarvisStore.getState().audioLevel

      // Dynamic scale based on audio level
      const isActive = currentState === 'listening' || currentState === 'speaking'

      // Target scale: base + audio-reactive expansion
      // More dramatic expansion for speaking
      if (isActive) {
        const expansionMultiplier = currentState === 'speaking' ? 0.4 : 0.25
        targetScaleRef.current = 1 + (currentAudioLevel * expansionMultiplier)
      } else {
        targetScaleRef.current = 1
      }

      // Smooth interpolation to target scale
      currentScaleRef.current += (targetScaleRef.current - currentScaleRef.current) * 0.15

      const radius = baseRadius * currentScaleRef.current

      // Rotation speed - always rotating, faster when active
      const baseSpeed = currentState === 'thinking' ? 0.012 :
                        currentState === 'speaking' ? 0.006 :
                        currentState === 'listening' ? 0.004 : 0.002

      rotationRef.current += baseSpeed

      // Color based on state and theme
      const isActiveState = currentState !== 'idle' && currentState !== 'error'
      // Dark theme: cyan active, white idle
      // Light theme: cyan active, dark gray idle
      const dotColor = isActiveState
        ? '#00d4d4'
        : (theme === 'dark' ? '#e0e0e0' : '#404040')

      // Project and draw points
      const projected: { x: number; y: number; z: number }[] = []

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

        projected.push({ x: px, y: py, z: z2 })
      }

      // Sort by z for depth
      projected.sort((a, b) => a.z - b.z)

      // Draw dots
      for (const p of projected) {
        const depth = (p.z + 1) / 2
        const size = 1 + depth * 1.5
        const alpha = 0.2 + depth * 0.6

        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fillStyle = dotColor
        ctx.globalAlpha = alpha
        ctx.fill()
      }

      ctx.globalAlpha = 1

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
    />
  )
}
