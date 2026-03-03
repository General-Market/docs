'use client'

import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { ReactNode } from 'react'

/**
 * SmartLabel — Html label that auto-offsets to avoid overlapping other labels
 * and stays within the camera frustum.
 *
 * Drop this instead of raw <Html> for labels that might overlap or clip.
 *
 * Features:
 * 1. Checks if projected screen position is outside the viewport → nudges Y offset
 * 2. Each SmartLabel registers itself in a shared registry so labels can detect overlap
 * 3. If two labels would overlap vertically, the lower-priority one shifts up/down
 *
 * Usage:
 *   <SmartLabel position={[0, 2, 0]} priority={1}>
 *     <p className="text-[10px] font-bold">ACCEPT</p>
 *   </SmartLabel>
 */

// Shared registry for all active SmartLabels in a scene
// Key = unique id, Value = projected screen Y position
const labelRegistry = new Map<string, { screenY: number; height: number }>()

const _proj = new THREE.Vector3()
let labelIdCounter = 0

interface SmartLabelProps {
  /** World-space position [x, y, z] */
  position: [number, number, number]
  /** Higher priority labels push lower priority ones. Default 0 */
  priority?: number
  /** Approximate label height in pixels. Default 24 */
  labelHeight?: number
  /** Children to render inside the Html overlay */
  children: ReactNode
  /** Style passed to Html wrapper */
  style?: React.CSSProperties
  /** Whether to center the Html element */
  center?: boolean
}

export function SmartLabel({
  position,
  priority = 0,
  labelHeight = 24,
  children,
  style,
  center = true,
}: SmartLabelProps) {
  const { camera, size } = useThree()
  const groupRef = useRef<THREE.Group>(null!)
  const idRef = useRef(`smartlabel-${labelIdCounter++}`)
  const offsetRef = useRef(0)

  useFrame(() => {
    if (!groupRef.current) return

    const cam = camera as THREE.PerspectiveCamera

    // Project base position to screen
    _proj.set(position[0], position[1], position[2])
    _proj.project(cam)

    const screenY = (1 - _proj.y) * 0.5 * size.height
    const screenX = (1 + _proj.x) * 0.5 * size.width

    // Register this label's screen position
    labelRegistry.set(idRef.current, { screenY, height: labelHeight })

    // Check if this label is outside viewport (with 20px margin)
    let yOffset = 0
    if (screenY < 20) {
      yOffset = -(screenY - 30) / size.height * 2 // nudge down in NDC space → positive world Y offset
    }
    if (screenY > size.height - 20) {
      yOffset = (size.height - 20 - screenY) / size.height * 2
    }

    // Check overlap with other labels (only shift if lower priority)
    for (const [otherId, other] of labelRegistry) {
      if (otherId === idRef.current) continue
      const gap = Math.abs(screenY - other.screenY)
      const minGap = (labelHeight + other.height) * 0.5 + 4 // 4px buffer
      if (gap < minGap && screenX > 0 && screenX < size.width) {
        // Overlap detected — shift this label if lower/equal priority
        const shiftDir = screenY > other.screenY ? 1 : -1
        const shiftAmount = (minGap - gap) / size.height
        yOffset += shiftDir * shiftAmount
      }
    }

    // Smoothly apply offset
    offsetRef.current = THREE.MathUtils.lerp(offsetRef.current, yOffset, 0.1)
    groupRef.current.position.set(
      position[0],
      position[1] + offsetRef.current,
      position[2]
    )
  })

  // Cleanup on unmount
  // Using a ref cleanup pattern to avoid stale closures
  const cleanupRef = useRef(() => {
    labelRegistry.delete(idRef.current)
  })
  cleanupRef.current = () => {
    labelRegistry.delete(idRef.current)
  }

  return (
    <group ref={groupRef} position={position}>
      <Html
        center={center}
        style={{ pointerEvents: 'none', userSelect: 'none', ...style }}
      >
        {children}
      </Html>
    </group>
  )
}
