'use client'

import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

function FrameBox({ position, label, sub, color = '#e8f5e9', accentColor = '#22c55e', delay = 0 }: {
  position: [number, number, number]; label: string; sub: string
  color?: string; accentColor?: string; delay?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  const [hovered, setHovered] = useState(false)
  const w = 1.3, h = 0.22, d = 0.9

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.position.y = position[1] + Math.sin(t * 0.5 + delay) * 0.015 + (hovered ? 0.04 : 0)
  })

  return (
    <group ref={ref} position={position}
      onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Main box */}
      <RoundedBox args={[w, h, d]} radius={0.02} smoothness={4} castShadow>
        <meshStandardMaterial color={hovered ? '#fff' : color} roughness={0.7} />
      </RoundedBox>
      {/* Top accent stripe */}
      <mesh position={[0, h / 2 + 0.001, 0]}>
        <planeGeometry args={[w - 0.04, d - 0.04]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.15} />
      </mesh>
      {/* Front accent bar */}
      <mesh position={[0, h / 2 + 0.002, -d / 2 + 0.015]}>
        <planeGeometry args={[w - 0.04, 0.025]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      {/* Label */}
      <Html center position={[0, h / 2 + 0.22, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>
        </div>
      </Html>
    </group>
  )
}

function FlowArrow({ start, end, color = '#22c55e' }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += 0.12
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return new THREE.TubeGeometry(curve, 20, 0.012, 6, false)
  }, [start, end])

  return <mesh geometry={tubeGeo}><meshStandardMaterial color={color} roughness={0.3} /></mesh>
}

function FlowParticles({ start, end, count = 8, color = '#22c55e' }: {
  start: THREE.Vector3; end: THREE.Vector3; count?: number; color?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const mid = useMemo(() => {
    const m = start.clone().lerp(end, 0.5)
    m.y += 0.12
    return m
  }, [start, end])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(start, mid, end), [start, mid, end])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.2 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.scale.setScalar(0.025 * Math.sin(p * Math.PI))
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

function StepRiser({ position, width = 1.5, depth = 1.1 }: {
  position: [number, number, number]; width?: number; depth?: number
}) {
  return (
    <RoundedBox args={[width, 0.02, depth]} radius={0.008} smoothness={4} position={position} receiveShadow>
      <meshBasicMaterial color="#ffffff" />
    </RoundedBox>
  )
}

function CalldataRibbon() {
  const count = 20
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-2.1, 0.5, 0),
    new THREE.Vector3(0, 0.9, -0.5),
    new THREE.Vector3(2.1, 0.5, 0)
  ), [])
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 30, 0.005, 4, false), [curve])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.08 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.scale.setScalar(0.015 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={tubeGeo}><meshBasicMaterial color="#c4b5fd" transparent opacity={0.4} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} />
      </instancedMesh>
      <Html center position={[0, 0.95, -0.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] text-violet-400 tracking-[0.12em] uppercase whitespace-nowrap font-bold">shared calldata</p>
      </Html>
    </group>
  )
}

const FRAMES = [
  { pos: [-2.1, 0.12, 0] as [number, number, number], label: 'Frame 1', sub: 'Validation', color: '#dcfce7', accent: '#22c55e', delay: 0 },
  { pos: [-0.7, 0.12, 0] as [number, number, number], label: 'Frame 2', sub: 'Execution', color: '#dbeafe', accent: '#3b82f6', delay: 1 },
  { pos: [0.7, 0.12, 0] as [number, number, number], label: 'Frame 3', sub: 'Execution', color: '#dbeafe', accent: '#3b82f6', delay: 2 },
  { pos: [2.1, 0.12, 0] as [number, number, number], label: 'Frame N', sub: '...', color: '#f3f4f6', accent: '#9ca3af', delay: 3 },
]

export function FrameTransactionScene() {
  const connections = useMemo(() => FRAMES.slice(0, -1).map((f, i) => ({
    start: new THREE.Vector3(...f.pos),
    end: new THREE.Vector3(...FRAMES[i + 1].pos),
  })), [])

  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[340px] md:h-[400px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [0, 5, 6], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Step risers under each frame */}
              {FRAMES.map((f, i) => (
                <StepRiser key={`step-${i}`} position={[f.pos[0], 0.01, f.pos[2]]} />
              ))}

              {/* Pipeline: left to right */}
              {FRAMES.map((f, i) => (
                <FrameBox key={i} position={f.pos} label={f.label} sub={f.sub} color={f.color} accentColor={f.accent} delay={f.delay} />
              ))}
              {connections.map((c, i) => (
                <group key={i}>
                  <FlowArrow start={c.start} end={c.end} color={FRAMES[i + 1].accent} />
                  <FlowParticles start={c.start} end={c.end} count={6} color={FRAMES[i + 1].accent} />
                </group>
              ))}
              <CalldataRibbon />
              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2.3} autoRotate autoRotateSpeed={0.4} dampingFactor={0.05} />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Validation</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-100 border border-blue-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Execution</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-4 h-2" viewBox="0 0 16 8"><path d="M1 7 Q8 1 15 7" stroke="#8b5cf6" fill="none" strokeWidth="1.5" /></svg>
              <span className="text-[10px] text-text-muted tracking-wide">Shared Calldata</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
