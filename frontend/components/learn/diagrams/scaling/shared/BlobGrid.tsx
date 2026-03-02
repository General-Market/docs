'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

/* -- Types -- */

interface BlobGridProps {
  position: [number, number, number]
  cellCount?: number
  cellSize?: number
  baseColor: string
  highlightColor: string
  highlightedIndices: number[]
  label?: string
}

/* -- Component -- */

/**
 * InstancedMesh grid of cubes with per-instance color highlighting.
 * cellCount must be a perfect square (e.g., 4, 9, 16, 25).
 * Highlighted cells get `highlightColor`, others get `baseColor`.
 */
export function BlobGrid({
  position,
  cellCount = 16,
  cellSize = 0.06,
  baseColor,
  highlightColor,
  highlightedIndices,
  label,
}: BlobGridProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummyRef = useRef(new THREE.Object3D())
  const elapsedRef = useRef(0)

  const gridSide = useMemo(() => Math.round(Math.sqrt(cellCount)), [cellCount])
  const gap = cellSize * 0.3

  // Pre-compute base transforms once
  const cellPositions = useMemo(() => {
    const totalWidth = gridSide * cellSize + (gridSide - 1) * gap
    const offset = totalWidth / 2 - cellSize / 2
    const positions: [number, number][] = []

    for (let i = 0; i < cellCount; i++) {
      const row = Math.floor(i / gridSide)
      const col = i % gridSide
      const x = col * (cellSize + gap) - offset
      const z = row * (cellSize + gap) - offset
      positions.push([x, z])
    }
    return positions
  }, [cellCount, cellSize, gridSide, gap])

  // Build the per-instance color attribute
  const colorArray = useMemo(() => {
    const base = new THREE.Color(baseColor)
    const highlight = new THREE.Color(highlightColor)
    const arr = new Float32Array(cellCount * 3)

    const highlightSet = new Set(highlightedIndices)
    for (let i = 0; i < cellCount; i++) {
      const c = highlightSet.has(i) ? highlight : base
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [cellCount, baseColor, highlightColor, highlightedIndices])

  // Set non-highlighted cell matrices once, and apply colors
  const prevHighlightKeyRef = useRef('')
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    const dummy = dummyRef.current
    const highlightSet = new Set(highlightedIndices)

    for (let i = 0; i < cellCount; i++) {
      if (!highlightSet.has(i)) {
        const [x, z] = cellPositions[i]
        dummy.position.set(x, 0, z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true

    // Apply per-instance color
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
    mesh.instanceColor = colorAttr

    prevHighlightKeyRef.current = highlightedIndices.join(',')
  }, [cellCount, cellPositions, colorArray, highlightedIndices])

  // Only animate highlighted cells with a gentle lift
  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    elapsedRef.current += delta
    const t = elapsedRef.current
    const dummy = dummyRef.current
    const highlightSet = new Set(highlightedIndices)

    let needsUpdate = false
    for (let i = 0; i < cellCount; i++) {
      if (highlightSet.has(i)) {
        const [x, z] = cellPositions[i]
        const lift = Math.sin(t * 2 + i * 0.5) * 0.008 + 0.01
        dummy.position.set(x, lift, z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        needsUpdate = true
      }
    }
    if (needsUpdate) {
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group position={position}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, cellCount]}
      >
        <boxGeometry args={[cellSize, cellSize * 0.5, cellSize]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.5}
        />
      </instancedMesh>

      {label && (
        <Html
          center
          position={[0, cellSize * 0.5 + 0.1, 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <p className="text-[10px] font-bold text-black tracking-tight">
            {label}
          </p>
        </Html>
      )}
    </group>
  )
}
