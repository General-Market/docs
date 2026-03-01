'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

/* ── Types ── */

interface TankModelProps {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  color: string
  fillColor: string
  fillPercent: number
  fillOscillation?: number
  capBar?: boolean
  showDrain?: boolean
  drainCount?: number
  growthChevrons?: boolean
  label?: string
  labelSub?: string
  scale?: number
  reducedMotion?: boolean
}

/* ── Drain particles ── */

function DrainParticles({
  count,
  tankWidth,
  tankHeight,
  tankDepth,
  fillColor,
  reducedMotion,
}: {
  count: number
  tankWidth: number
  tankHeight: number
  tankDepth: number
  fillColor: string
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Per-particle state: offset and speed
  const particles = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        xOff: (Math.random() - 0.5) * tankWidth * 0.6,
        zOff: (Math.random() - 0.5) * tankDepth * 0.6,
        speed: 0.3 + Math.random() * 0.4,
        phase: Math.random(),
      })),
    [count, tankWidth, tankDepth]
  )

  useFrame((_, delta) => {
    if (!meshRef.current) return
    const t = reducedMotion ? 0 : undefined

    for (let i = 0; i < count; i++) {
      const p = particles[i]
      if (t !== undefined) {
        // Static placement for reduced motion
        const y = -tankHeight * 0.3 + p.phase * tankHeight * 0.5
        dummy.position.set(p.xOff, y, p.zOff)
      } else {
        p.phase += delta * p.speed
        if (p.phase > 1) p.phase -= 1
        // Fall from top of tank interior to bottom
        const y = (tankHeight / 2) * (1 - 2 * p.phase)
        dummy.position.set(p.xOff, y, p.zOff)
      }
      dummy.scale.setScalar(0.015)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={fillColor} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ── Growth chevrons ── */

function GrowthChevrons({
  tankWidth,
  tankHeight,
  color,
  reducedMotion,
}: {
  tankWidth: number
  tankHeight: number
  color: string
  reducedMotion: boolean
}) {
  const refs = [
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
    useRef<THREE.Mesh>(null!),
  ]

  useFrame(({ clock }) => {
    if (reducedMotion) return
    const t = clock.getElapsedTime()
    for (let i = 0; i < 3; i++) {
      const mesh = refs[i].current
      if (!mesh) continue
      const phase = (t * 1.5 + i * 0.8) % (Math.PI * 2)
      const opacity = Math.max(0, Math.sin(phase)) * 0.6
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = opacity
    }
  })

  // Chevron shape: a simple "V" rotated to point upward
  const chevronShape = useMemo(() => {
    const shape = new THREE.Shape()
    const w = tankWidth * 0.25
    const h = 0.06
    shape.moveTo(-w, 0)
    shape.lineTo(0, h)
    shape.lineTo(w, 0)
    shape.lineTo(w - 0.015, -0.01)
    shape.lineTo(0, h - 0.02)
    shape.lineTo(-w + 0.015, -0.01)
    shape.closePath()
    return shape
  }, [tankWidth])

  return (
    <group position={[0, tankHeight / 2 + 0.05, 0]}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={refs[i]}
          position={[0, i * 0.08, 0]}
          rotation={[0, 0, 0]}
        >
          <shapeGeometry args={[chevronShape]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={reducedMotion ? 0.3 : 0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ── Main TankModel component ── */

export function TankModel({
  position,
  width,
  height,
  depth,
  color,
  fillColor,
  fillPercent,
  fillOscillation = 0,
  capBar = false,
  showDrain = false,
  drainCount = 8,
  growthChevrons = false,
  label,
  labelSub,
  scale: scaleVal = 1,
  reducedMotion = false,
}: TankModelProps) {
  const fillRef = useRef<THREE.Group>(null!)

  // Animate the fill level oscillation
  useFrame(({ clock }) => {
    if (!fillRef.current || reducedMotion || fillOscillation === 0) return
    const t = clock.getElapsedTime()
    const osc = Math.sin(t * 2) * fillOscillation
    const effectivePercent = Math.max(0, Math.min(1, fillPercent + osc))
    const fillHeight = height * effectivePercent
    fillRef.current.scale.y = Math.max(0.001, effectivePercent)
    fillRef.current.position.y = -height / 2 + fillHeight / 2
  })

  const wallThickness = 0.015
  const fillHeight = height * fillPercent
  const innerPad = wallThickness * 2

  return (
    <group position={position} scale={scaleVal}>
      {/* Tank walls: slightly transparent outer shell */}
      <RoundedBox
        args={[width, height, depth]}
        radius={0.03}
        smoothness={4}
        castShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.6}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </RoundedBox>

      {/* Fill level inner box */}
      <group
        ref={fillRef}
        position={[0, -height / 2 + fillHeight / 2, 0]}
        scale={[1, Math.max(0.001, fillPercent), 1]}
      >
        <RoundedBox
          args={[width - innerPad, height, depth - innerPad]}
          radius={0.02}
          smoothness={4}
        >
          <meshStandardMaterial
            color={fillColor}
            roughness={0.4}
            transparent
            opacity={0.7}
          />
        </RoundedBox>
      </group>

      {/* Cap bar: red bar across top edge when capped */}
      {capBar && (
        <RoundedBox
          args={[width + 0.02, 0.025, depth + 0.02]}
          radius={0.005}
          smoothness={4}
          position={[0, height / 2 + 0.012, 0]}
        >
          <meshStandardMaterial color="#ef4444" roughness={0.3} />
        </RoundedBox>
      )}

      {/* Drain particles */}
      {showDrain && (
        <DrainParticles
          count={drainCount}
          tankWidth={width}
          tankHeight={height}
          tankDepth={depth}
          fillColor={fillColor}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Growth chevrons above tank */}
      {growthChevrons && (
        <GrowthChevrons
          tankWidth={width}
          tankHeight={height}
          color={fillColor}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Label */}
      {label && (
        <Html
          center
          position={[0, height / 2 + (growthChevrons ? 0.35 : 0.15), 0]}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
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
      )}
    </group>
  )
}
