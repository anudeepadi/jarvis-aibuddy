'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useJarvisStore } from '@/store/jarvis-store'

// Types matching the API response
export interface TopicCluster {
  id: string
  topic: string
  count: number
  centroid: [number, number]
  radius: number
  intensity: number
}

export interface TemporalBucket {
  timestamp: number
  density: number
}

export interface TerrainData {
  heightmap: number[][]
  clusters: TopicCluster[]
  temporalDensity: TemporalBucket[]
  metadata: {
    totalMemories: number
    dateRange: { start: string; end: string }
    generatedAt: string
  }
}

interface UseTerrainDataReturn {
  terrainData: TerrainData | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

// Client-side cache (5 minutes)
const CACHE_DURATION_MS = 5 * 60 * 1000
let cachedData: TerrainData | null = null
let cacheTimestamp = 0

/**
 * Generate procedural fallback terrain when API fails
 */
function generateProceduralTerrain(resolution: number): TerrainData {
  const heightmap: number[][] = []

  for (let i = 0; i < resolution; i++) {
    heightmap[i] = []
    for (let j = 0; j < resolution; j++) {
      const x = i / resolution
      const y = j / resolution

      // Multi-layer noise for interesting terrain
      const noise =
        Math.sin(x * 10) * Math.cos(y * 10) * 0.3 +
        Math.sin(x * 20 + 1) * Math.cos(y * 20 + 1) * 0.15 +
        Math.sin(x * 40 + 2) * Math.cos(y * 40 + 2) * 0.075

      // Add circular falloff for natural island effect
      const dx = x - 0.5
      const dy = y - 0.5
      const distFromCenter = Math.sqrt(dx * dx + dy * dy) * 2
      const falloff = 1 - Math.min(1, distFromCenter)

      heightmap[i][j] = Math.max(0, (noise + 0.5) * falloff * 0.8 + 0.1)
    }
  }

  return {
    heightmap,
    clusters: [
      { id: 'demo-1', topic: 'memories', count: 15, centroid: [0.5, 0.5], radius: 0.2, intensity: 0.8 },
      { id: 'demo-2', topic: 'tasks', count: 8, centroid: [0.3, 0.6], radius: 0.15, intensity: 0.6 },
      { id: 'demo-3', topic: 'voice', count: 12, centroid: [0.7, 0.4], radius: 0.18, intensity: 0.7 },
    ],
    temporalDensity: [],
    metadata: {
      totalMemories: 35,
      dateRange: { start: '', end: '' },
      generatedAt: new Date().toISOString(),
    },
  }
}

/**
 * Hook to fetch and cache terrain data for visualization
 *
 * Features:
 * - 5-minute client-side cache
 * - Automatic Mem0 API key injection from store
 * - Procedural fallback on error
 * - Manual refetch capability
 */
export function useTerrainData(resolution: number = 64): UseTerrainDataReturn {
  const [terrainData, setTerrainData] = useState<TerrainData | null>(cachedData)
  const [isLoading, setIsLoading] = useState(!cachedData)
  const [error, setError] = useState<Error | null>(null)
  const fetchingRef = useRef(false)

  // Get Mem0 API key from store for memory-based terrain
  const mem0ApiKey = useJarvisStore((s) => s.mem0ApiKey)

  const fetchTerrainData = useCallback(
    async (forceRefresh = false) => {
      // Prevent concurrent fetches
      if (fetchingRef.current) return
      fetchingRef.current = true

      // Check cache first (unless force refresh)
      if (!forceRefresh && cachedData && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
        setTerrainData(cachedData)
        setIsLoading(false)
        fetchingRef.current = false
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }

        // Include Mem0 API key if available (for real memory data)
        if (mem0ApiKey) {
          headers['x-mem0-api-key'] = mem0ApiKey
        }

        const url = `/api/memory-terrain?resolution=${resolution}${forceRefresh ? '&refresh=true' : ''}`
        const response = await fetch(url, { headers })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch terrain data`)
        }

        const data: TerrainData = await response.json()

        // Update cache
        cachedData = data
        cacheTimestamp = Date.now()

        setTerrainData(data)
        setError(null)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching terrain')
        console.warn('Terrain fetch failed, using procedural fallback:', error.message)
        setError(error)

        // Use procedural fallback on error
        const fallback = generateProceduralTerrain(resolution)
        setTerrainData(fallback)
      } finally {
        setIsLoading(false)
        fetchingRef.current = false
      }
    },
    [resolution, mem0ApiKey]
  )

  // Initial fetch on mount
  useEffect(() => {
    fetchTerrainData()
  }, [fetchTerrainData])

  // Expose refetch for manual refresh
  const refetch = useCallback(() => fetchTerrainData(true), [fetchTerrainData])

  return {
    terrainData,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Convert 2D heightmap array to Float32Array for GPU texture
 * Used by ParticleLandscape component
 */
export function heightmapToFloat32Array(heightmap: number[][]): Float32Array {
  const size = heightmap.length
  const data = new Float32Array(size * size * 4) // RGBA

  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const idx = (i * size + j) * 4
      const height = heightmap[i]?.[j] ?? 0
      data[idx] = height // R
      data[idx + 1] = height // G
      data[idx + 2] = height // B
      data[idx + 3] = 1 // A
    }
  }

  return data
}
