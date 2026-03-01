'use client'

import { useRef } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/* ── Types ── */

interface PlatformStageProps {
  position: [number, number, number]
  width: number
  depth: number
  color: string
  label: string
  labelColor: string
  height?: number
  stairFrom?: [number, number, number]
  stairRiserHeight?: number
  labelSub?: string
}

/* ── Component ── */

export function PlatformStage({
  position,
  width,
  depth,
  color,
  label,
  labelColor,
  height = 0.08,
  stairFrom,
  stairRiserHeight,
  labelSub,
}: PlatformStageProps) {
  const groupRef = useRef<THREE.Group>(null!)

  // Stair riser: a vertical connector from a previous platform to this one
  const stairRiser = stairFrom && stairRiserHeight != null && stairRiserHeight > 0
  const stairWidth = Math.min(width * 0.3, 0.6)
  const stairDepth = 0.08

  return (
    <group ref={groupRef}>
      {/* Main platform */}
      <group position={position}>
        <RoundedBox
          args={[width, height, depth]}
          radius={0.02}
          smoothness={4}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color={color} roughness={0.75} />
        </RoundedBox>

        {/* Accent line along front edge */}
        <mesh position={[0, height / 2 + 0.001, -depth / 2 + 0.01]}>
          <planeGeometry args={[width - 0.04, 0.018]} />
          <meshBasicMaterial color={labelColor} />
        </mesh>

        {/* Label */}
        <Html
          center
          position={[0, height / 2 + 0.15, 0]}
          style={{ pointerEvents: 'none', userSelect: 'none', whiteSpace: 'nowrap' }}
        >
          <div className="text-center">
            <p className="text-[10px] font-bold text-black tracking-tight">
              {label}
            </p>
            {labelSub && (
              <p className="text-[9px] text-zinc-500 mt-0.5">{labelSub}</p>
            )}
          </div>
        </Html>
      </group>

      {/* Stair riser connecting from a previous platform */}
      {stairRiser && stairFrom && stairRiserHeight != null && (
        <group
          position={[
            (stairFrom[0] + position[0]) / 2,
            (stairFrom[1] + position[1]) / 2,
            (stairFrom[2] + position[2]) / 2,
          ]}
        >
          <RoundedBox
            args={[stairWidth, stairRiserHeight, stairDepth]}
            radius={0.01}
            smoothness={4}
            castShadow
          >
            <meshStandardMaterial
              color={color}
              roughness={0.8}
              transparent
              opacity={0.5}
            />
          </RoundedBox>
        </group>
      )}
    </group>
  )
}
