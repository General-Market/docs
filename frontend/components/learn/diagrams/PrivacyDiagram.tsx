'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

/* ── 3D Person (user) ── */
function PersonModel({ position, color = '#3b82f6', scale = 1 }: {
  position: [number, number, number]; color?: string; scale?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8) * 0.02
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* Head */}
      <mesh position={[0, 0.32, 0]} castShadow>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.1, 0.22, 8]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 0.04, 12]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  )
}

/* ── 3D Antenna Tower (broadcaster) ── */
function BroadcasterModel({ position, color = '#ef4444' }: {
  position: [number, number, number]; color?: string
}) {
  const ref = useRef<THREE.Group>(null!)
  const ringRef1 = useRef<THREE.Mesh>(null!)
  const ringRef2 = useRef<THREE.Mesh>(null!)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.position.y = position[1] + Math.sin(t * 0.6) * 0.015
    if (ringRef1.current) {
      ringRef1.current.scale.setScalar(1 + Math.sin(t * 2) * 0.15)
      ;(ringRef1.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + Math.sin(t * 2) * 0.2
    }
    if (ringRef2.current) {
      ringRef2.current.scale.setScalar(1 + Math.sin(t * 2 + 1) * 0.15)
      ;(ringRef2.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(t * 2 + 1) * 0.15
    }
  })

  return (
    <group ref={ref} position={position}>
      {/* Tower */}
      <mesh position={[0, 0.18, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.06, 0.36, 6]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Antenna tip */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[0.04, 0.08, 6]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
      {/* Radio wave rings */}
      <mesh ref={ringRef1} position={[0, 0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.12, 0.008, 8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      <mesh ref={ringRef2} position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.006, 8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} />
      </mesh>
      {/* Base */}
      <mesh position={[0, 0.01, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 12]} />
        <meshStandardMaterial color="#666" roughness={0.7} />
      </mesh>
    </group>
  )
}

/* ── 3D Pool (mempool) ── */
function MempoolModel({ position, color = '#f59e0b', label = 'Mempool', sub }: {
  position: [number, number, number]; color?: string; label?: string; sub?: string
}) {
  const ref = useRef<THREE.Group>(null!)
  const cubesRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const cubeCount = 6

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    ref.current.position.y = position[1] + Math.sin(t * 0.4) * 0.01
    for (let i = 0; i < cubeCount; i++) {
      const angle = (i / cubeCount) * Math.PI * 2 + t * 0.3
      const r = 0.15 + Math.sin(t * 0.5 + i) * 0.05
      dummy.position.set(Math.cos(angle) * r, 0.08 + Math.sin(t * 0.8 + i * 1.5) * 0.04, Math.sin(angle) * r)
      dummy.rotation.set(t * 0.5 + i, t * 0.3 + i, 0)
      dummy.scale.setScalar(0.025)
      dummy.updateMatrix()
      cubesRef.current.setMatrixAt(i, dummy.matrix)
    }
    cubesRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={ref} position={position}>
      {/* Pool container — flat cylinder */}
      <mesh castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.06, 20]} />
        <meshStandardMaterial color={color} transparent opacity={0.25} roughness={0.4} />
      </mesh>
      {/* Pool rim */}
      <mesh position={[0, 0.03, 0]}>
        <torusGeometry args={[0.3, 0.012, 8, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Floating tx cubes inside */}
      <instancedMesh ref={cubesRef} args={[undefined, undefined, cubeCount]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </instancedMesh>
      {/* Label */}
      <Html center position={[0, 0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          {sub && <p className="text-[7px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>}
        </div>
      </Html>
    </group>
  )
}

/* ── Looping blockchain model (8 blocks, conveyor) ── */
function ChainModel({ position, color = '#22c55e', label = 'Chain' }: {
  position: [number, number, number]; color?: string; label?: string
}) {
  const blocksRef = useRef<THREE.InstancedMesh>(null!)
  const linksRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const blockCount = 8
  const chainWidth = 1.5
  const spacing = chainWidth / (blockCount - 1)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const speed = 0.15
    const offset = (t * speed) % spacing

    for (let i = 0; i < blockCount; i++) {
      const baseX = -chainWidth / 2 + i * spacing
      // Shift left by offset, wrap around
      let x = baseX - offset
      if (x < -chainWidth / 2 - spacing * 0.5) {
        x += chainWidth + spacing
      }
      dummy.position.set(
        position[0] + x,
        position[1] + 0.06 + Math.sin(t * 0.5 + i * 0.8) * 0.008,
        position[2]
      )
      dummy.rotation.set(0, t * 0.2 + i * 0.3, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      blocksRef.current.setMatrixAt(i, dummy.matrix)

      // Links between blocks (place between current and next)
      if (i < blockCount - 1) {
        const nextBaseX = -chainWidth / 2 + (i + 1) * spacing
        let nextX = nextBaseX - offset
        if (nextX < -chainWidth / 2 - spacing * 0.5) {
          nextX += chainWidth + spacing
        }
        const linkX = (x + nextX) / 2
        dummy.position.set(
          position[0] + linkX,
          position[1] + 0.06,
          position[2]
        )
        dummy.rotation.set(0, 0, Math.PI / 2)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        linksRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    blocksRef.current.instanceMatrix.needsUpdate = true
    linksRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group scale={1.2}>
      {/* Block instances */}
      <instancedMesh ref={blocksRef} args={[undefined, undefined, blockCount]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </instancedMesh>
      {/* Link instances */}
      <instancedMesh ref={linksRef} args={[undefined, undefined, blockCount - 1]}>
        <cylinderGeometry args={[0.012, 0.012, 0.06, 6]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </instancedMesh>
      <Html center position={[position[0], position[1] + 0.28, position[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
      </Html>
    </group>
  )
}

/* ── Crowd of users (semicircle arc, fires tx particles) ── */
function CrowdUsers({ targetPosition }: { targetPosition: [number, number, number] }) {
  const crowdCount = 15
  const maxParticles = 10

  // Generate crowd positions in a semicircle arc around the After column
  const crowdPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let i = 0; i < crowdCount; i++) {
      const angle = (i / (crowdCount - 1)) * Math.PI - Math.PI / 2 // -90 to +90 deg
      const radius = 1.8 + (Math.random() - 0.5) * 0.4
      const x = 1.5 + Math.sin(angle) * radius
      const z = 1.8 + Math.cos(angle) * 1.2 // z range ~1.8 to 3.5
      positions.push([x, 0, z])
    }
    return positions
  }, [])

  // Person body instances
  const headsRef = useRef<THREE.InstancedMesh>(null!)
  const bodiesRef = useRef<THREE.InstancedMesh>(null!)
  const particlesRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Particle state: each particle has source position, progress, and active flag
  const particleState = useRef(
    Array.from({ length: maxParticles }, () => ({
      active: false,
      progress: 0,
      sourceIdx: 0,
      speed: 0.3,
      nextFireTime: Math.random() * 5,
    }))
  )

  // Track next fire time per crowd member
  const crowdTimers = useRef(
    Array.from({ length: crowdCount }, () => Math.random() * 5 + 1)
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const dt = 1 / 60

    // Update crowd body positions
    for (let i = 0; i < crowdCount; i++) {
      const [x, y, z] = crowdPositions[i]
      // Head
      dummy.position.set(x, y + 0.07, z)
      dummy.scale.setScalar(1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      headsRef.current.setMatrixAt(i, dummy.matrix)
      // Body
      dummy.position.set(x, y - 0.02, z)
      dummy.updateMatrix()
      bodiesRef.current.setMatrixAt(i, dummy.matrix)
    }
    headsRef.current.instanceMatrix.needsUpdate = true
    bodiesRef.current.instanceMatrix.needsUpdate = true

    // Fire particles from crowd members
    const particles = particleState.current
    for (let ci = 0; ci < crowdCount; ci++) {
      crowdTimers.current[ci] -= dt
      if (crowdTimers.current[ci] <= 0) {
        const freeP = particles.find(p => !p.active)
        if (freeP) {
          freeP.active = true
          freeP.progress = 0
          freeP.sourceIdx = ci
          freeP.speed = 0.2 + Math.random() * 0.15
        }
        crowdTimers.current[ci] = 3 + Math.random() * 5
      }
    }

    // Update particle positions
    for (let i = 0; i < maxParticles; i++) {
      const p = particles[i]
      if (p.active) {
        p.progress += dt * p.speed
        if (p.progress >= 1) {
          p.active = false
          dummy.position.set(0, -10, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          particlesRef.current.setMatrixAt(i, dummy.matrix)
        } else {
          const src = crowdPositions[p.sourceIdx]
          const tgt = targetPosition
          const prog = p.progress
          const px = src[0] + (tgt[0] - src[0]) * prog
          const py = src[1] + (tgt[1] - src[1]) * prog + Math.sin(prog * Math.PI) * 0.35
          const pz = src[2] + (tgt[2] - src[2]) * prog
          dummy.position.set(px, py, pz)
          dummy.rotation.set(t * 2 + i, t * 1.5 + i, 0)
          dummy.scale.setScalar(1)
          dummy.updateMatrix()
          particlesRef.current.setMatrixAt(i, dummy.matrix)
        }
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        particlesRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    particlesRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* Crowd heads */}
      <instancedMesh ref={headsRef} args={[undefined, undefined, crowdCount]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </instancedMesh>
      {/* Crowd bodies */}
      <instancedMesh ref={bodiesRef} args={[undefined, undefined, crowdCount]}>
        <cylinderGeometry args={[0.025, 0.035, 0.1, 6]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.6} />
      </instancedMesh>
      {/* TX particles */}
      <instancedMesh ref={particlesRef} args={[undefined, undefined, maxParticles]}>
        <boxGeometry args={[0.025, 0.025, 0.025]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={0.6} roughness={0.3} />
      </instancedMesh>
    </group>
  )
}

/* ── X Mark (eliminated) ── */
function XMark({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.03, 0.03]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.5, 0.03, 0.03]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
    </group>
  )
}

/* ── Flow tube + particles ── */
function FlowConnection({ start, end, color = '#888', particleCount = 8 }: {
  start: THREE.Vector3; end: THREE.Vector3; color?: string; particleCount?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 1, 0.008, 6, false), [start, end])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < particleCount; i++) {
      const p = ((t * 0.25 + i / particleCount) % 1)
      dummy.position.lerpVectors(start, end, p)
      dummy.position.y += Math.sin(p * Math.PI) * 0.03
      dummy.scale.setScalar(0.02 * Math.sin(p * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={tubeGeo}><meshStandardMaterial color={color} transparent opacity={0.35} roughness={0.4} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, particleCount]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.65} />
      </instancedMesh>
    </group>
  )
}

/* ── Column base plate ── */
function ColumnBase({ position, color, width = 2.8, depth = 5.5 }: {
  position: [number, number, number]; color: string; width?: number; depth?: number
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} transparent opacity={0.25} roughness={0.95} />
    </mesh>
  )
}

/* ── Step riser (raised platform under entity groups) ── */
function StepRiser({ position, width = 1.2, depth = 0.8 }: {
  position: [number, number, number]; width?: number; depth?: number
}) {
  return (
    <RoundedBox args={[width, 0.02, depth]} radius={0.008} smoothness={4} position={position} receiveShadow>
      <meshBasicMaterial color="#ffffff" />
    </RoundedBox>
  )
}

export function PrivacyDiagram() {
  // Before path (left) — red
  const bUser = new THREE.Vector3(-1.5, 0, 1.8)
  const bBroadcaster = new THREE.Vector3(-1.5, 0, 0.2)
  const bMempool = new THREE.Vector3(-1.5, 0, -1.2)
  const bChain = new THREE.Vector3(-1.5, 0, -2.5)

  // After path (right) — green
  const aUser = new THREE.Vector3(1.5, 0, 1.8)
  const aMempool = new THREE.Vector3(1.5, 0, -1.2)
  const aChain = new THREE.Vector3(1.5, 0, -2.5)

  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[420px] md:h-[500px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [0, 6, 7], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Column zones */}
              <ColumnBase position={[-1.5, 0.002, -0.3]} color="#fca5a5" />
              <ColumnBase position={[1.5, 0.002, -0.3]} color="#86efac" />

              {/* Step risers — Before column */}
              <StepRiser position={[-1.5, 0.005, 1.8]} width={1.0} depth={0.7} />
              <StepRiser position={[-1.5, 0.005, 0.2]} width={1.0} depth={0.8} />
              <StepRiser position={[-1.5, 0.005, -1.2]} width={1.0} depth={0.8} />
              <StepRiser position={[-1.5, 0.005, -2.5]} width={2.2} depth={0.7} />

              {/* Step risers — After column */}
              <StepRiser position={[1.5, 0.005, 1.8]} width={1.0} depth={0.7} />
              <StepRiser position={[1.5, 0.005, -1.2]} width={1.0} depth={0.8} />
              <StepRiser position={[1.5, 0.005, -2.5]} width={2.2} depth={0.7} />

              {/* Column labels */}
              <Html center position={[-1.5, 1.0, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[11px] text-red-400 tracking-[0.15em] uppercase whitespace-nowrap font-bold">Before</p>
              </Html>
              <Html center position={[1.5, 1.0, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[11px] text-emerald-500 tracking-[0.15em] uppercase whitespace-nowrap font-bold">After</p>
              </Html>

              {/* ── BEFORE path (red) ── */}
              <PersonModel position={[-1.5, 0, 1.8]} color="#ef4444" />
              <Html center position={[-1.5, 0.55, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[10px] font-bold text-red-600 whitespace-nowrap">User</p>
              </Html>
              <FlowConnection start={bUser} end={bBroadcaster} color="#ef4444" />

              <BroadcasterModel position={[-1.5, 0, 0.2]} color="#ef4444" />
              <Html center position={[-1.5, 0.6, 0.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-red-600 whitespace-nowrap">Broadcaster</p>
                  <p className="text-[7px] text-red-400 whitespace-nowrap">centralized relayer</p>
                </div>
              </Html>
              <XMark position={[-0.4, 0.25, 0.2]} />
              <FlowConnection start={bBroadcaster} end={bMempool} color="#ef4444" />

              <MempoolModel position={[-1.5, 0, -1.2]} color="#f87171" sub="standard" />
              <FlowConnection start={bMempool} end={bChain} color="#ef4444" />

              <ChainModel position={[-1.5, 0, -2.5]} color="#f87171" label="Chain" />

              {/* ── AFTER path (green) ── */}
              <PersonModel position={[1.5, 0, 1.8]} color="#22c55e" />
              <Html center position={[1.5, 0.55, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[10px] font-bold text-emerald-600 whitespace-nowrap">User</p>
              </Html>

              {/* Direct — skips broadcaster */}
              <FlowConnection start={aUser} end={aMempool} color="#22c55e" particleCount={14} />
              <Html center position={[2.6, 0.2, 0.3]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[9px] text-emerald-500 tracking-[0.1em] uppercase whitespace-nowrap font-bold">Direct!</p>
              </Html>

              <MempoolModel position={[1.5, 0, -1.2]} color="#22c55e" sub="frame tx" />
              <FlowConnection start={aMempool} end={aChain} color="#22c55e" />

              <ChainModel position={[1.5, 0, -2.5]} color="#22c55e" label="Chain" />

              {/* Crowd users on After side — firing tx particles toward mempool */}
              <CrowdUsers targetPosition={[1.5, 0, -1.2]} />

              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2.3} autoRotate autoRotateSpeed={0.3} dampingFactor={0.05} target={[0, 0, -0.3]} />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-red-100 border border-red-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Before (relayer)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-[10px] text-text-muted tracking-wide">After (direct)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3 text-red-400" viewBox="0 0 12 12"><path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="2" fill="none" /></svg>
              <span className="text-[10px] text-text-muted tracking-wide">Eliminated</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
