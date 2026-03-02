'use client'

import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/* ── Merged geometry factory ── */

/**
 * Creates a merged BufferGeometry combining:
 * - Sphere head at the top
 * - Cylinder body in the middle
 * - Flat cylinder (disk) base at the bottom
 *
 * Total height ~0.32 units (centered at origin). Suitable for instancedMesh
 * crowd rendering where hundreds of validator figures are needed.
 */
export function createValidatorGeometry(): THREE.BufferGeometry {
  // Head: sphere at top
  const headGeo = new THREE.SphereGeometry(0.045, 10, 8)
  headGeo.translate(0, 0.14, 0)

  // Body: tapered cylinder
  const bodyGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.14, 8)
  bodyGeo.translate(0, 0.04, 0)

  // Base: flat disk
  const baseGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10)
  baseGeo.translate(0, -0.035, 0)

  const merged = mergeGeometries([headGeo, bodyGeo, baseGeo], false)

  // Dispose source geometries
  headGeo.dispose()
  bodyGeo.dispose()
  baseGeo.dispose()

  if (!merged) {
    // Fallback: return a simple box if merge fails
    return new THREE.BoxGeometry(0.08, 0.22, 0.08)
  }

  return merged
}

/* ── Standalone single-use component ── */

/**
 * Standalone validator figure for placing a single instance in a scene.
 * Uses the merged geometry internally.
 */
export function ValidatorFigure({
  position,
  color,
  scale: scaleVal = 1,
}: {
  position: [number, number, number]
  color: string
  scale?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const geometry = useMemo(() => createValidatorGeometry(), [])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      position={position}
      scale={scaleVal}
    >
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  )
}
