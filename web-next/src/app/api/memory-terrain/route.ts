import { NextRequest, NextResponse } from 'next/server'

// Types for terrain data
interface TopicCluster {
  id: string
  topic: string
  count: number
  centroid: [number, number]  // 2D position (0-1 range)
  radius: number
  intensity: number
}

interface TemporalBucket {
  timestamp: number
  density: number
}

interface TerrainData {
  heightmap: number[][]
  clusters: TopicCluster[]
  temporalDensity: TemporalBucket[]
  metadata: {
    totalMemories: number
    dateRange: { start: string; end: string }
    generatedAt: string
  }
}

// Simple cache for expensive operations
let cachedTerrain: TerrainData | null = null
let cacheTimestamp = 0
const CACHE_DURATION_MS = 60 * 1000 // 1 minute server-side cache

/**
 * Generate heightmap from memory clusters
 * Uses Gaussian blobs centered on topic clusters
 */
function generateHeightmapFromClusters(
  clusters: TopicCluster[],
  resolution: number
): number[][] {
  const heightmap: number[][] = Array(resolution)
    .fill(null)
    .map(() => Array(resolution).fill(0))

  // Add Gaussian blob for each cluster
  for (const cluster of clusters) {
    const [cx, cy] = cluster.centroid
    const sigma = cluster.radius * resolution * 0.15

    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = j / resolution
        const y = i / resolution
        const dx = x - cx
        const dy = y - cy
        const distSq = dx * dx + dy * dy
        const gaussian = Math.exp(-distSq / (2 * sigma * sigma / (resolution * resolution)))
        heightmap[i][j] += gaussian * cluster.intensity
      }
    }
  }

  // Add procedural noise layer for visual interest
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const x = j / resolution
      const y = i / resolution
      // Multi-octave noise approximation
      const noise =
        Math.sin(x * 12 + y * 8) * 0.1 +
        Math.sin(x * 24 + 1.3) * Math.cos(y * 24 + 0.7) * 0.05 +
        Math.sin(x * 48 + 2.1) * Math.cos(y * 48 + 1.4) * 0.025
      heightmap[i][j] += noise * 0.3
    }
  }

  // Normalize to [0, 1]
  let minVal = Infinity
  let maxVal = -Infinity
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      minVal = Math.min(minVal, heightmap[i][j])
      maxVal = Math.max(maxVal, heightmap[i][j])
    }
  }

  const range = maxVal - minVal || 1
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      heightmap[i][j] = (heightmap[i][j] - minVal) / range
    }
  }

  return heightmap
}

/**
 * Fetch memories from Mem0 API if configured
 */
async function fetchMem0Memories(
  apiKey: string | undefined
): Promise<{ memories: Array<{ memory: string; id: string }>; topics: string[] } | null> {
  if (!apiKey) return null

  try {
    const response = await fetch('https://api.mem0.ai/v1/memories/', {
      method: 'GET',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) return null

    const data = await response.json()
    const memories = data.results || data.memories || []

    // Extract topics from memory content (simple keyword extraction)
    const topicCounts = new Map<string, number>()
    const commonWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can',
      'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
      'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once',
      'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
      'neither', 'not', 'only', 'own', 'same', 'than', 'too', 'very',
      'just', 'also', 'now', 'user', 'assistant', 'said', 'that', 'this'
    ])

    for (const mem of memories) {
      const text = (mem.memory || '').toLowerCase()
      const words = text.split(/\W+/).filter(
        (w: string) => w.length > 3 && !commonWords.has(w)
      )
      for (const word of words) {
        topicCounts.set(word, (topicCounts.get(word) || 0) + 1)
      }
    }

    // Get top topics
    const topics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([topic]) => topic)

    return { memories, topics }
  } catch {
    return null
  }
}

/**
 * Generate demo clusters when no memory data is available
 */
function generateDemoClusters(): TopicCluster[] {
  const demoTopics = [
    { topic: 'conversations', x: 0.3, y: 0.4, intensity: 0.9 },
    { topic: 'calendar', x: 0.7, y: 0.3, intensity: 0.7 },
    { topic: 'tasks', x: 0.5, y: 0.6, intensity: 0.8 },
    { topic: 'memories', x: 0.2, y: 0.7, intensity: 0.6 },
    { topic: 'voice', x: 0.8, y: 0.65, intensity: 0.5 },
    { topic: 'assistant', x: 0.45, y: 0.25, intensity: 0.75 },
  ]

  return demoTopics.map((t, i) => ({
    id: `cluster-${i}`,
    topic: t.topic,
    count: Math.floor(t.intensity * 20),
    centroid: [t.x, t.y],
    radius: 0.1 + t.intensity * 0.15,
    intensity: t.intensity,
  }))
}

/**
 * Generate temporal density (memory activity over time)
 */
function generateTemporalDensity(memoryCount: number): TemporalBucket[] {
  const buckets: TemporalBucket[] = []
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000

  // Generate 30 days of data
  for (let i = 29; i >= 0; i--) {
    const timestamp = now - i * dayMs
    // Simulate activity pattern: higher on weekdays, lower on weekends
    const dayOfWeek = new Date(timestamp).getDay()
    const baseActivity = dayOfWeek === 0 || dayOfWeek === 6 ? 0.3 : 0.7
    const variation = Math.random() * 0.3
    const density = Math.min(1, baseActivity + variation) * (memoryCount / 100)

    buckets.push({ timestamp, density })
  }

  return buckets
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const resolution = Math.min(128, Math.max(32, parseInt(searchParams.get('resolution') || '64')))
  const forceRefresh = searchParams.get('refresh') === 'true'

  // Check cache
  if (!forceRefresh && cachedTerrain && Date.now() - cacheTimestamp < CACHE_DURATION_MS) {
    return NextResponse.json(cachedTerrain)
  }

  try {
    // Try to get Mem0 API key from header (client sends it)
    const mem0ApiKey = request.headers.get('x-mem0-api-key') || undefined

    // Attempt to fetch real memory data
    const memoryData = await fetchMem0Memories(mem0ApiKey)

    let clusters: TopicCluster[]
    let totalMemories: number

    if (memoryData && memoryData.memories.length > 0) {
      // Convert real memory topics to clusters
      totalMemories = memoryData.memories.length
      clusters = memoryData.topics.map((topic, i) => {
        // Distribute topics in a circular pattern with some randomness
        const angle = (i / memoryData.topics.length) * Math.PI * 2
        const radius = 0.2 + Math.random() * 0.25
        const x = 0.5 + Math.cos(angle) * radius
        const y = 0.5 + Math.sin(angle) * radius

        return {
          id: `cluster-${i}`,
          topic,
          count: Math.floor(Math.random() * 15) + 5,
          centroid: [Math.max(0.1, Math.min(0.9, x)), Math.max(0.1, Math.min(0.9, y))] as [number, number],
          radius: 0.08 + Math.random() * 0.12,
          intensity: 0.5 + Math.random() * 0.5,
        }
      })
    } else {
      // Use demo clusters
      clusters = generateDemoClusters()
      totalMemories = clusters.reduce((sum, c) => sum + c.count, 0)
    }

    // Generate heightmap from clusters
    const heightmap = generateHeightmapFromClusters(clusters, resolution)

    // Generate temporal density
    const temporalDensity = generateTemporalDensity(totalMemories)

    const terrainData: TerrainData = {
      heightmap,
      clusters,
      temporalDensity,
      metadata: {
        totalMemories,
        dateRange: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString(),
        },
        generatedAt: new Date().toISOString(),
      },
    }

    // Cache the result
    cachedTerrain = terrainData
    cacheTimestamp = Date.now()

    return NextResponse.json(terrainData)
  } catch (error) {
    console.error('Error generating terrain data:', error)

    // Return fallback procedural terrain on error
    const fallbackClusters = generateDemoClusters()
    const fallbackData: TerrainData = {
      heightmap: generateHeightmapFromClusters(fallbackClusters, resolution),
      clusters: fallbackClusters,
      temporalDensity: generateTemporalDensity(50),
      metadata: {
        totalMemories: 50,
        dateRange: { start: '', end: '' },
        generatedAt: new Date().toISOString(),
      },
    }

    return NextResponse.json(fallbackData)
  }
}
