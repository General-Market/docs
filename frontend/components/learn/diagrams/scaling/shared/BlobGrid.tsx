'use client'

import { useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

/* ── Types ── */

interface BlobGridProps {
  position: [number, number, number]
  cellCount?: number
  cellSize?: number
  baseColor: string
  highlightColor: string
  highlightedIndices: number[]
  label?: string
}

/* ── Component ── */

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

  const gridSide = useMemo(() => Math.round(Math.sqrt(cellCount)), [cellCount])
  const gap = cellSize * 0.3

  // Pre-compute transforms once
  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mats: THREE.Matrix4[] = []
    const totalWidth = gridSide * cellSize + (gridSide - 1) * gap
    const offset = totalWidth / 2 - cellSize / 2

    for (let i = 0; i < cellCount; i++) {
      const row = Math.floor(i / gridSide)
      const col = i % gridSide
      const x = col * (cellSize + gap) - offset
      const z = row * (cellSize + gap) - offset
      dummy.position.set(x, 0, z)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mats.push(dummy.matrix.clone())
    }
    return mats
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

  // Set instance matrices and colors on mount and when they change
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let i = 0; i < cellCount; i++) {
      mesh.setMatrixAt(i, matrices[i])
    }
    mesh.instanceMatrix.needsUpdate = true

    // Apply per-instance color
    const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
    mesh.instanceColor = colorAttr
  }, [cellCount, matrices, colorArray])

  // Subtle hover lift for highlighted cells
  useFrame(({ clock }, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    const t = clock.getElapsedTime()
    const dummy = new THREE.Object3D()
    const highlightSet = new Set(highlightedIndices)
    const totalWidth = gridSide * cellSize + (gridSide - 1) * gap
    const offset = totalWidth / 2 - cellSize / 2

    for (let i = 0; i < cellCount; i++) {
      const row = Math.floor(i / gridSide)
      const col = i % gridSide
      const x = col * (cellSize + gap) - offset
      const z = row * (cellSize + gap) - offset

      if (highlightSet.has(i)) {
        // Highlighted cells get a gentle lift animation
        const lift = Math.sin(t * 2 + i * 0.5) * 0.008 + 0.01
        dummy.position.set(x, lift, z)
      } else {
        dummy.position.set(x, 0, z)
      }

      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={position}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, cellCount]}
        castShadow
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
