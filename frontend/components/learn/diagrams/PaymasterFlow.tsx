'use client'

import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

function StepBox({ position, label, sub, color = '#fff', accentColor = '#888', index = 0 }: {
  position: [number, number, number]; label: string; sub: string
  color?: string; accentColor?: string; index?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  const [hovered, setHovered] = useState(false)
  const w = 1.2, h = 0.22, d = 0.8

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.position.y = position[1] + Math.sin(t * 0.4 + index * 0.8) * 0.015 + (hovered ? 0.04 : 0)
  })

  return (
    <group ref={ref} position={position}
      onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <RoundedBox args={[w, h, d]} radius={0.02} smoothness={4} castShadow>
        <meshStandardMaterial color={hovered ? '#fff' : color} roughness={0.7} />
      </RoundedBox>
      {/* Top color wash */}
      <mesh position={[0, h / 2 + 0.001, 0]}>
        <planeGeometry args={[w - 0.04, d - 0.04]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.12} />
      </mesh>
      {/* Front accent bar */}
      <mesh position={[0, h / 2 + 0.002, -d / 2 + 0.015]}>
        <planeGeometry args={[w - 0.04, 0.025]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <Html center position={[0, h / 2 + 0.24, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[10px] font-mono font-bold" style={{ color: accentColor }}>{String(index + 1).padStart(2, '0')}</p>
          <p className="text-[11px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          <p className="text-[8px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>
        </div>
      </Html>
    </group>
  )
}

function FlowArrow({ start, end, color = '#888' }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += 0.1
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return new THREE.TubeGeometry(curve, 20, 0.01, 6, false)
  }, [start, end])

  return <mesh geometry={tubeGeo}><meshStandardMaterial color={color} roughness={0.4} /></mesh>
}

function FlowParticles({ start, end, count = 6, color = '#888' }: {
  start: THREE.Vector3; end: THREE.Vector3; count?: number; color?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const mid = useMemo(() => {
    const m = start.clone().lerp(end, 0.5)
    m.y += 0.1
    return m
  }, [start, end])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(start, mid, end), [start, mid, end])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.2 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.scale.setScalar(0.02 * Math.sin(p * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </instancedMesh>
  )
}

function StepRiser({ position, width = 1.4, depth = 1.0 }: {
  position: [number, number, number]; width?: number; depth?: number
}) {
  return (
    <RoundedBox args={[width, 0.02, depth]} radius={0.008} smoothness={4} position={position} receiveShadow>
      <meshBasicMaterial color="#ffffff" />
    </RoundedBox>
  )
}

// U-shape layout: validation left → paymaster center → execute right → refund loops back
const STEPS = [
  { pos: [-1.8, 0.12, 1.0] as [number, number, number], label: 'Validate', sub: 'ACCEPT sender', color: '#dcfce7', accent: '#22c55e' },
  { pos: [0, 0.12, 1.0] as [number, number, number], label: 'Paymaster', sub: 'ACCEPT gas', color: '#fef9c3', accent: '#eab308' },
  { pos: [1.8, 0.12, 1.0] as [number, number, number], label: 'Pay Token', sub: 'RAI → paymaster', color: '#ffedd5', accent: '#f59e0b' },
  { pos: [1.8, 0.12, -0.8] as [number, number, number], label: 'Execute', sub: 'swap, stake, mint', color: '#dbeafe', accent: '#3b82f6' },
  { pos: [-1.8, 0.12, -0.8] as [number, number, number], label: 'Refund', sub: 'unused gas → user', color: '#f3f4f6', accent: '#9ca3af' },
]

export function PaymasterFlow() {
  const connections = useMemo(() => STEPS.slice(0, -1).map((s, i) => ({
    start: new THREE.Vector3(...s.pos),
    end: new THREE.Vector3(...STEPS[i + 1].pos),
    color: STEPS[i + 1].accent,
  })), [])

  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[380px] md:h-[440px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [0, 5.5, 5.5], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Step risers under each step */}
              {STEPS.map((s, i) => (
                <StepRiser key={`step-${i}`} position={[s.pos[0], 0.01, s.pos[2]]} />
              ))}

              {STEPS.map((s, i) => (
                <StepBox key={i} position={s.pos} label={s.label} sub={s.sub} color={s.color} accentColor={s.accent} index={i} />
              ))}
              {connections.map((c, i) => (
                <group key={i}>
                  <FlowArrow start={c.start} end={c.end} color={c.color} />
                  <FlowParticles start={c.start} end={c.end} color={c.color} />
                </group>
              ))}
              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2.3} autoRotate autoRotateSpeed={0.4} dampingFactor={0.05} />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Validate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-yellow-100 border border-yellow-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Paymaster</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-100 border border-blue-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Execute</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
