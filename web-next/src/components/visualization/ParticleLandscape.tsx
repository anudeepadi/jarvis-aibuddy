'use client'

import React, { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { useJarvisStore, ConversationState } from '@/store/jarvis-store'
import { useTerrainData, heightmapToFloat32Array } from '@/hooks/useTerrainData'

// Configuration
const GRID_SIZE = 224 // 224 x 224 = ~50K particles
const PARTICLE_COUNT = GRID_SIZE * GRID_SIZE
const TERRAIN_SPREAD = 8 // World units
const HEIGHT_SCALE = 2.5

// State-based colors (RGB normalized)
const STATE_COLORS: Record<ConversationState, [number, number, number]> = {
  idle: [0, 0.83, 1], // Cyan #00d4ff
  listening: [0, 0.5, 1], // Blue #007fff
  thinking: [0.55, 0.36, 0.96], // Purple #8c5cf5
  speaking: [0, 1, 0.53], // Green #00ff87
  error: [1, 0.42, 0.21], // Orange #ff6b35
}

// Vertex shader - samples heightmap and applies effects
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAudioLevel;
  uniform sampler2D uHeightmap;
  uniform float uRippleTime;
  uniform float uRippleActive;
  uniform float uHeightScale;

  attribute vec2 aUv;

  varying float vHeight;
  varying float vDistFromCenter;

  void main() {
    vec3 pos = position;

    // Sample heightmap for base elevation
    float height = texture2D(uHeightmap, aUv).r;
    pos.y = height * uHeightScale;

    // Subtle wave animation
    float wave = sin(uTime * 1.5 + pos.x * 0.8 + pos.z * 0.6) * 0.08;
    wave += sin(uTime * 2.0 + pos.z * 1.2) * 0.04;
    pos.y += wave * (0.3 + uAudioLevel * 0.7);

    // Calculate distance from center for effects
    float dist = length(pos.xz);
    vDistFromCenter = dist;

    // Wake-word ripple effect
    if (uRippleActive > 0.5) {
      float rippleRadius = uRippleTime * 6.0;
      float rippleWidth = 1.5;
      float rippleFactor = smoothstep(rippleRadius - rippleWidth, rippleRadius, dist)
                         - smoothstep(rippleRadius, rippleRadius + rippleWidth, dist);
      float rippleHeight = sin(dist * 4.0 - uRippleTime * 12.0) * 0.4 * rippleFactor;
      rippleHeight *= 1.0 - smoothstep(0.0, 2.5, uRippleTime); // Fade out
      pos.y += rippleHeight;

      // Eruption effect - particles burst upward near center
      if (dist < 2.0 && uRippleTime < 0.8) {
        float eruptFactor = (1.0 - dist / 2.0) * (1.0 - uRippleTime / 0.8);
        pos.y += eruptFactor * sin(uRippleTime * 10.0) * 1.5;
      }
    }

    // Circular mask with soft falloff
    float maskRadius = 4.0;
    float mask = 1.0 - smoothstep(maskRadius * 0.7, maskRadius, dist);
    pos.y *= mask;

    vHeight = pos.y / uHeightScale;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Point size based on height and distance
    float size = 2.5 + height * 1.5;
    size *= (1.0 + uAudioLevel * 0.3);
    gl_PointSize = size * (200.0 / -mvPosition.z);
  }
`

// Fragment shader - renders particles with soft edges
const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAudioLevel;
  uniform float uRippleActive;
  uniform float uRippleTime;

  varying float vHeight;
  varying float vDistFromCenter;

  void main() {
    // Circular soft point
    vec2 center = gl_PointCoord - 0.5;
    float dist = length(center);
    if (dist > 0.5) discard;

    // Soft edge falloff
    float alpha = 1.0 - smoothstep(0.2, 0.5, dist);

    // Height-based intensity
    float intensity = 0.5 + vHeight * 0.5;

    // Base color with height variation
    vec3 color = uColor * intensity;

    // Audio reactivity - brightness boost
    color += uAudioLevel * 0.15;

    // Ripple glow effect
    if (uRippleActive > 0.5 && uRippleTime < 2.0) {
      float glowFactor = (1.0 - uRippleTime / 2.0) * 0.3;
      color += vec3(1.0, 1.0, 1.0) * glowFactor;
    }

    // Distance-based fade for depth
    alpha *= 0.6 + (1.0 - min(1.0, vDistFromCenter / 4.0)) * 0.4;

    gl_FragColor = vec4(color, alpha);
  }
`

/**
 * Inner component that renders the particle terrain
 * Separated to access Three.js context
 */
function TerrainParticles() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const pointsRef = useRef<THREE.Points>(null)

  // Zustand state subscriptions
  const state = useJarvisStore((s) => s.state)
  const audioLevel = useJarvisStore((s) => s.audioLevel)
  const wakeWordTriggered = useJarvisStore((s) => s.wakeWordTriggered)
  const wakeWordTimestamp = useJarvisStore((s) => s.wakeWordTimestamp)
  const setWakeWordTriggered = useJarvisStore((s) => s.setWakeWordTriggered)
  const theme = useJarvisStore((s) => s.theme)

  // Fetch terrain data
  const { terrainData, isLoading } = useTerrainData(64)

  // Generate heightmap texture from terrain data
  const heightmapTexture = useMemo(() => {
    if (!terrainData?.heightmap) {
      // Return empty texture while loading
      const emptyData = new Float32Array(64 * 64 * 4).fill(0.5)
      const tex = new THREE.DataTexture(emptyData as unknown as BufferSource, 64, 64, THREE.RGBAFormat, THREE.FloatType)
      tex.needsUpdate = true
      return tex
    }

    const size = terrainData.heightmap.length
    const data = heightmapToFloat32Array(terrainData.heightmap)
    const texture = new THREE.DataTexture(data as unknown as BufferSource, size, size, THREE.RGBAFormat, THREE.FloatType)
    texture.wrapS = THREE.ClampToEdgeWrapping
    texture.wrapT = THREE.ClampToEdgeWrapping
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
    return texture
  }, [terrainData])

  // Generate particle positions and UVs
  const { positions, uvs } = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const uvs = new Float32Array(PARTICLE_COUNT * 2)

    let idx = 0
    for (let i = 0; i < GRID_SIZE; i++) {
      for (let j = 0; j < GRID_SIZE; j++) {
        // Position in world space (centered at origin)
        const x = (i / (GRID_SIZE - 1) - 0.5) * TERRAIN_SPREAD
        const z = (j / (GRID_SIZE - 1) - 0.5) * TERRAIN_SPREAD

        // Add slight jitter for organic feel
        const jitter = 0.02
        positions[idx * 3] = x + (Math.random() - 0.5) * jitter
        positions[idx * 3 + 1] = 0 // Y is set by vertex shader
        positions[idx * 3 + 2] = z + (Math.random() - 0.5) * jitter

        // UV coordinates for heightmap sampling
        uvs[idx * 2] = i / (GRID_SIZE - 1)
        uvs[idx * 2 + 1] = j / (GRID_SIZE - 1)

        idx++
      }
    }

    return { positions, uvs }
  }, [])

  // Animation loop
  useFrame((frameState, delta) => {
    if (!materialRef.current) return

    const mat = materialRef.current.uniforms

    // Update time
    mat.uTime.value += delta

    // Update audio level (smoothed)
    const targetAudio = audioLevel
    mat.uAudioLevel.value += (targetAudio - mat.uAudioLevel.value) * 0.15

    // Update color based on conversation state
    const targetColor = STATE_COLORS[state] || STATE_COLORS.idle
    mat.uColor.value.set(targetColor[0], targetColor[1], targetColor[2])

    // Handle wake-word ripple effect
    if (wakeWordTriggered && wakeWordTimestamp) {
      const elapsed = (Date.now() - wakeWordTimestamp) / 1000
      mat.uRippleTime.value = elapsed
      mat.uRippleActive.value = 1.0

      // Auto-reset after 2.5 seconds
      if (elapsed > 2.5) {
        setWakeWordTriggered(false)
      }
    } else {
      // Smooth fade out
      mat.uRippleActive.value *= 0.95
      if (mat.uRippleActive.value < 0.01) {
        mat.uRippleActive.value = 0
      }
    }
  })

  // Shader uniforms
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAudioLevel: { value: 0 },
      uHeightmap: { value: heightmapTexture },
      uColor: { value: new THREE.Vector3(...STATE_COLORS.idle) },
      uRippleTime: { value: 0 },
      uRippleActive: { value: 0 },
      uHeightScale: { value: HEIGHT_SCALE },
    }),
    [heightmapTexture]
  )

  // Update heightmap texture when terrain data changes
  useEffect(() => {
    if (materialRef.current && heightmapTexture) {
      materialRef.current.uniforms.uHeightmap.value = heightmapTexture
    }
  }, [heightmapTexture])

  // Create Three.js elements - using createElement to bypass JSX type checking
  // @react-three/fiber's global JSX augmentation doesn't merge properly in Next.js strict mode
  const Points = 'points' as unknown as React.FC<{ ref: React.RefObject<THREE.Points | null>; children: React.ReactNode }>
  const BufferGeom = 'bufferGeometry' as unknown as React.FC<{ children: React.ReactNode }>
  const BufferAttr = 'bufferAttribute' as unknown as React.FC<{ attach: string; array: Float32Array; count: number; itemSize: number }>
  const ShaderMat = 'shaderMaterial' as unknown as React.FC<{
    ref: React.RefObject<THREE.ShaderMaterial | null>
    vertexShader: string
    fragmentShader: string
    uniforms: Record<string, { value: unknown }>
    transparent: boolean
    blending: THREE.Blending
    depthWrite: boolean
  }>

  return (
    <Points ref={pointsRef}>
      <BufferGeom>
        <BufferAttr attach="attributes-position" array={positions} count={PARTICLE_COUNT} itemSize={3} />
        <BufferAttr attach="attributes-aUv" array={uvs} count={PARTICLE_COUNT} itemSize={2} />
      </BufferGeom>
      <ShaderMat
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </Points>
  )
}

/**
 * Camera controller - positions camera above terrain
 */
function CameraSetup() {
  const { camera } = useThree()

  useEffect(() => {
    camera.position.set(0, 6, 7)
    camera.lookAt(0, 0, 0)
  }, [camera])

  // Subtle camera animation
  useFrame((state) => {
    const t = state.clock.elapsedTime
    camera.position.x = Math.sin(t * 0.1) * 0.5
    camera.position.z = 7 + Math.cos(t * 0.08) * 0.3
    camera.lookAt(0, 0, 0)
  })

  return null
}

/**
 * Main ParticleLandscape component
 * Wraps Three.js canvas with terrain visualization
 */
export function ParticleLandscape() {
  const theme = useJarvisStore((s) => s.theme)

  return (
    <div className="w-full h-full absolute inset-0">
      <Canvas
        camera={{ position: [0, 6, 7], fov: 55 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        style={{ background: 'transparent' }}
        dpr={[1, 2]} // Limit pixel ratio for performance
      >
        <CameraSetup />
        {/* Cast to bypass Three.js JSX type augmentation issue */}
        {(() => {
          const Light = 'ambientLight' as unknown as React.FC<{ intensity: number }>
          return <Light intensity={0.3} />
        })()}
        <TerrainParticles />
        <EffectComposer>
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}

export default ParticleLandscape
