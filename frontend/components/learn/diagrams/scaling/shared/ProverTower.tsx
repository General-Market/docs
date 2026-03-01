'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/* ── Types ── */

interface ProverTowerProps {
  position: [number, number, number]
  color: string
  agrees: boolean
  label?: string
  height?: number
  reducedMotion?: boolean
}

/* ── Checkmark shape ── */

function CheckMark({ color }: { color: string }) {
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    // Checkmark path
    s.moveTo(-0.04, 0.0)
    s.lineTo(-0.015, -0.03)
    s.lineTo(0.05, 0.04)
    s.lineTo(0.04, 0.05)
    s.lineTo(-0.015, -0.01)
    s.lineTo(-0.03, 0.01)
    s.closePath()
    return s
  }, [])

  return (
    <mesh rotation={[0, 0, 0]}>
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial color={color} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ── X mark shape ── */

function XMark({ color }: { color: string }) {
  return (
    <group>
      {/* First stroke of the X */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.08, 0.015]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
      {/* Second stroke of the X */}
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <planeGeometry args={[0.08, 0.015]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ── Main component ── */

export function ProverTower({
  position,
  color,
  agrees,
  label,
  height = 0.7,
  reducedMotion = false,
}: ProverTowerProps) {
  const towerRef = useRef<THREE.Group>(null!)
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!)

  const towerWidth = 0.2
  const towerDepth = 0.2

  // Emissive pulse for agreeing towers
  useFrame(({ clock }, delta) => {
    if (!materialRef.current || reducedMotion || !agrees) return
    const t = clock.getElapsedTime()
    const pulse = (Math.sin(t * 3) + 1) / 2 // 0 to 1
    materialRef.current.emissiveIntensity = 0.1 + pulse * 0.3
  })

  // Hover lift
  useFrame(({ clock }, delta) => {
    if (!towerRef.current || reducedMotion) return
    const t = clock.getElapsedTime()
    towerRef.current.position.y =
      position[1] + Math.sin(t * 1.2 + position[0] * 2) * 0.008
  })

  const emissiveColor = agrees ? '#22c55e' : '#000000'
  const iconColor = agrees ? '#22c55e' : '#9ca3af'
  const towerColor = agrees ? color : '#d4d4d8'

  return (
    <group ref={towerRef} position={position}>
      {/* Tower body */}
      <RoundedBox
        args={[towerWidth, height, towerDepth]}
        radius={0.025}
        smoothness={4}
        castShadow
        position={[0, height / 2, 0]}
      >
        <meshStandardMaterial
          ref={materialRef}
          color={towerColor}
          roughness={0.5}
          emissive={emissiveColor}
          emissiveIntensity={agrees ? 0.2 : 0}
        />
      </RoundedBox>

      {/* Icon overlay on front face */}
      <group position={[0, height * 0.65, towerDepth / 2 + 0.002]}>
        {agrees ? (
          <CheckMark color={iconColor} />
        ) : (
          <XMark color={iconColor} />
        )}
      </group>

      {/* Accent cap on top */}
      <RoundedBox
        args={[towerWidth + 0.02, 0.02, towerDepth + 0.02]}
        radius={0.005}
        smoothness={4}
        position={[0, height + 0.01, 0]}
      >
        <meshStandardMaterial
          color={agrees ? '#22c55e' : '#9ca3af'}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Label */}
      {label && (
        <Html
          center
          position={[0, height + 0.12, 0]}
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
