'use client'

import dynamic from 'next/dynamic'
import { useJarvisStore } from '@/store/jarvis-store'
import { FibonacciSphere } from '@/components/FibonacciSphere'

// Dynamic import for ParticleLandscape to reduce initial bundle
// Also prevents SSR issues with Three.js
const ParticleLandscape = dynamic(
  () => import('./ParticleLandscape').then((mod) => mod.ParticleLandscape),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    ),
  }
)

/**
 * VisualizationSwitch - Conditionally renders visualization based on user preference
 *
 * Supports two modes:
 * - 'sphere': Classic FibonacciSphere (Canvas 2D)
 * - 'terrain': ParticleLandscape (Three.js WebGL)
 *
 * The terrain is dynamically imported to avoid loading Three.js when not needed.
 */
export function VisualizationSwitch() {
  const visualizationMode = useJarvisStore((s) => s.visualizationMode)
  const theme = useJarvisStore((s) => s.theme)

  if (visualizationMode === 'terrain') {
    return <ParticleLandscape />
  }

  // Default to sphere visualization
  return <FibonacciSphere theme={theme} />
}

export default VisualizationSwitch
