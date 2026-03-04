'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

/* ── Entity box with accent ── */
function Entity({ position, label, sub, color, accentColor, delay = 0 }: {
  position: [number, number, number]; label: string; sub?: string
  color: string; accentColor: string; delay?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  const w = 1.0, h = 0.16, d = 0.6

  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.4 + delay) * 0.012
  })

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[w, h, d]} radius={0.015} smoothness={4} castShadow>
        <meshStandardMaterial color={color} roughness={0.7} />
      </RoundedBox>
      <mesh position={[0, h / 2 + 0.001, -d / 2 + 0.01]}>
        <planeGeometry args={[w - 0.04, 0.018]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <Html center position={[0, h / 2 + 0.15, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[9px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          {sub && <p className="text-[7px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>}
        </div>
      </Html>
    </group>
  )
}

/* ── Arrow connection ── */
function Arrow({ start, end, color = '#888' }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += 0.06
    return new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(start, mid, end), 16, 0.006, 6, false)
  }, [start, end])
  return <mesh geometry={tubeGeo}><meshStandardMaterial color={color} transparent opacity={0.4} roughness={0.4} /></mesh>
}

/* ── Particles ── */
function Particles({ start, end, color = '#888', count = 6 }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string; count?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const mid = useMemo(() => {
    const m = start.clone().lerp(end, 0.5)
    m.y += 0.06
    return m
  }, [start, end])
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(start, mid, end), [start, mid, end])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.2 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.scale.setScalar(0.015 * Math.sin(p * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ── Step riser ── */
function StepRiser({ position, width = 1.2, depth = 0.8 }: {
  position: [number, number, number]; width?: number; depth?: number
}) {
  return (
    <RoundedBox args={[width, 0.02, depth]} radius={0.008} smoothness={4} position={position} receiveShadow>
      <meshBasicMaterial color="#ffffff" />
    </RoundedBox>
  )
}

/* ── Column base ── */
function ColumnBase({ position, color, width = 3.2, depth = 6 }: {
  position: [number, number, number]; color: string; width?: number; depth?: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} transparent opacity={0.2} roughness={0.95} />
    </mesh>
  )
}

// BEFORE side: complex fragmented architecture
const BEFORE = [
  { pos: [-1.8, 0.08, 2.2] as [number, number, number], label: 'Smart Wallet', sub: 'ERC-4337', color: '#fee2e2', accent: '#ef4444' },
  { pos: [-1.8, 0.08, 1.2] as [number, number, number], label: 'Bundler', sub: 'off-chain relay', color: '#fee2e2', accent: '#ef4444' },
  { pos: [-1.8, 0.08, 0.2] as [number, number, number], label: 'Paymaster Relay', sub: 'intermediary', color: '#fee2e2', accent: '#ef4444' },
  { pos: [-1.8, 0.08, -0.8] as [number, number, number], label: 'Multicall Hack', sub: 'batch workaround', color: '#fef3c7', accent: '#f59e0b' },
  { pos: [-1.8, 0.08, -1.8] as [number, number, number], label: 'Broadcaster', sub: 'centralized relayer', color: '#fee2e2', accent: '#ef4444' },
  { pos: [-1.8, 0.08, -2.8] as [number, number, number], label: 'Chain', sub: 'limited EOA', color: '#f3f4f6', accent: '#9ca3af' },
]

// AFTER side: clean unified architecture
const AFTER = [
  { pos: [1.8, 0.08, 2.2] as [number, number, number], label: 'Any Account', sub: 'EOA or smart', color: '#dcfce7', accent: '#22c55e' },
  { pos: [1.8, 0.08, 1.0] as [number, number, number], label: 'Frame TX', sub: 'N frames, 1 primitive', color: '#dbeafe', accent: '#3b82f6' },
  { pos: [1.8, 0.08, -0.2] as [number, number, number], label: 'On-Chain Paymaster', sub: 'DEX, no relay', color: '#fef9c3', accent: '#eab308' },
  { pos: [1.8, 0.08, -1.4] as [number, number, number], label: 'Public Mempool', sub: 'direct submit', color: '#dcfce7', accent: '#22c55e' },
  { pos: [1.8, 0.08, -2.8] as [number, number, number], label: 'Chain', sub: 'full framework', color: '#dcfce7', accent: '#22c55e' },
]

export function BeforeAfterScene() {
  const beforeConns = useMemo(() => BEFORE.slice(0, -1).map((b, i) => ({
    start: new THREE.Vector3(...b.pos),
    end: new THREE.Vector3(...BEFORE[i + 1].pos),
  })), [])

  const afterConns = useMemo(() => AFTER.slice(0, -1).map((a, i) => ({
    start: new THREE.Vector3(...a.pos),
    end: new THREE.Vector3(...AFTER[i + 1].pos),
  })), [])

  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[420px] md:h-[520px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [0, 6, 8], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Step risers under entities */}
              {[...BEFORE, ...AFTER].map((e, i) => (
                <StepRiser key={`step-${i}`} position={[e.pos[0], -0.005, e.pos[2]]} />
              ))}

              {/* Column zones */}
              <ColumnBase position={[-1.8, 0.002, -0.3]} color="#fca5a5" width={3} depth={7} />
              <ColumnBase position={[1.8, 0.002, -0.3]} color="#86efac" width={3} depth={7} />

              {/* Column labels */}
              <Html center position={[-1.8, 1.0, 2.6]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <div className="text-center">
                  <p className="text-[11px] text-red-400 tracking-[0.15em] uppercase whitespace-nowrap font-bold">Before 8141</p>
                  <p className="text-[8px] text-red-300 whitespace-nowrap mt-0.5">6 intermediaries</p>
                </div>
              </Html>
              <Html center position={[1.8, 1.0, 2.6]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <div className="text-center">
                  <p className="text-[11px] text-emerald-500 tracking-[0.15em] uppercase whitespace-nowrap font-bold">After 8141</p>
                  <p className="text-[8px] text-emerald-400 whitespace-nowrap mt-0.5">1 primitive</p>
                </div>
              </Html>

              {/* Divider line */}
              <mesh position={[0, 0.005, -0.3]}>
                <boxGeometry args={[0.008, 0.005, 7]} />
                <meshBasicMaterial color="#d4d4d8" />
              </mesh>

              {/* BEFORE side */}
              {BEFORE.map((b, i) => (
                <Entity key={`b-${i}`} position={b.pos} label={b.label} sub={b.sub} color={b.color} accentColor={b.accent} delay={i * 0.5} />
              ))}
              {beforeConns.map((c, i) => (
                <group key={`bc-${i}`}>
                  <Arrow start={c.start} end={c.end} color="#ef4444" />
                  <Particles start={c.start} end={c.end} color="#ef4444" count={4} />
                </group>
              ))}

              {/* AFTER side */}
              {AFTER.map((a, i) => (
                <Entity key={`a-${i}`} position={a.pos} label={a.label} sub={a.sub} color={a.color} accentColor={a.accent} delay={i * 0.5 + 0.3} />
              ))}
              {afterConns.map((c, i) => (
                <group key={`ac-${i}`}>
                  <Arrow start={c.start} end={c.end} color="#22c55e" />
                  <Particles start={c.start} end={c.end} color="#22c55e" count={6} />
                </group>
              ))}

              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2.3} autoRotate autoRotateSpeed={0.3} dampingFactor={0.05} target={[0, 0, -0.3]} />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-red-100 border border-red-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Before (fragmented)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-[10px] text-text-muted tracking-wide">After (unified)</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
