'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

/* ── Wallet model (Smart Wallet) ── */
function WalletModel({ position, color = '#3b82f6', scale = 0.8 }: {
  position: [number, number, number]; color?: string; scale?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8 + position[0]) * 0.015
  })

  const shieldShape = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.06)
    shape.lineTo(0.05, 0.03)
    shape.lineTo(0.05, -0.03)
    shape.lineTo(0, -0.06)
    shape.lineTo(-0.05, -0.03)
    shape.lineTo(-0.05, 0.03)
    shape.closePath()
    return shape
  }, [])

  return (
    <group ref={ref} position={position} scale={scale}>
      <RoundedBox args={[0.5, 0.35, 0.15]} radius={0.04} smoothness={4} castShadow>
        <meshStandardMaterial color={color} roughness={0.5} />
      </RoundedBox>
      {/* Shield on front face */}
      <mesh position={[0, 0, 0.076]} rotation={[0, 0, 0]}>
        <shapeGeometry args={[shieldShape]} />
        <meshStandardMaterial color="#93c5fd" roughness={0.4} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

/* ── Screen model (dApp) ── */
function ScreenModel({ position, color = '#6366f1', scale = 0.8 }: {
  position: [number, number, number]; color?: string; scale?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8 + position[0] * 1.3) * 0.015
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* Screen body */}
      <RoundedBox args={[0.35, 0.5, 0.04]} radius={0.02} smoothness={4} castShadow position={[0, 0.12, 0]}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
      {/* Screen face glow */}
      <mesh position={[0, 0.12, 0.021]}>
        <planeGeometry args={[0.28, 0.4]} />
        <meshStandardMaterial color="#a5b4fc" emissive="#818cf8" emissiveIntensity={0.5} roughness={0.3} />
      </mesh>
      {/* Base stand */}
      <mesh position={[0, -0.15, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.03, 12]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
    </group>
  )
}

/* ── Lock model (Privacy TX) ── */
function LockModel({ position, color = '#8b5cf6', scale = 0.8 }: {
  position: [number, number, number]; color?: string; scale?: number
}) {
  const ref = useRef<THREE.Group>(null!)
  useFrame(({ clock }) => {
    ref.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * 0.8 + position[0] * 0.7) * 0.015
  })
  return (
    <group ref={ref} position={position} scale={scale}>
      {/* Shackle (torus on top) */}
      <mesh position={[0, 0.18, 0]} rotation={[0, 0, 0]} castShadow>
        <torusGeometry args={[0.08, 0.02, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Lock body */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.15, 0.18, 0.08]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      {/* Keyhole */}
      <mesh position={[0, 0.06, 0.041]}>
        <circleGeometry args={[0.02, 8]} />
        <meshStandardMaterial color="#c4b5fd" roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ── Pool model (mempool) ── */
function PoolModel({ position, color = '#f59e0b', label, sub }: {
  position: [number, number, number]; color?: string; label: string; sub?: string
}) {
  const ref = useRef<THREE.Group>(null!)
  const cubesRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = 8

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + t * 0.4
      const r = 0.2 + Math.sin(t * 0.5 + i) * 0.06
      dummy.position.set(
        position[0] + Math.cos(angle) * r,
        position[1] + 0.1 + Math.sin(t * 0.7 + i * 1.2) * 0.05,
        position[2] + Math.sin(angle) * r
      )
      dummy.rotation.set(t * 0.5 + i, t * 0.3 + i, 0)
      dummy.scale.setScalar(0.025)
      dummy.updateMatrix()
      cubesRef.current.setMatrixAt(i, dummy.matrix)
    }
    cubesRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={ref}>
      {/* Pool rim */}
      <mesh position={[position[0], position[1] + 0.03, position[2]]}>
        <torusGeometry args={[0.35, 0.015, 8, 28]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Pool base */}
      <mesh position={position} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 0.04, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} roughness={0.5} />
      </mesh>
      {/* Floating cubes */}
      <instancedMesh ref={cubesRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </instancedMesh>
      <Html center position={[position[0], position[1] + 0.38, position[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          {sub && <p className="text-[7px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>}
        </div>
      </Html>
    </group>
  )
}

/* ── Looping blockchain model (8 blocks, conveyor) ── */
function ChainModel({ position, color = '#22c55e' }: {
  position: [number, number, number]; color?: string
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
    <group>
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
        <p className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">ACCEPT</p>
        <p className="text-[7px] text-zinc-500 whitespace-nowrap text-center">gas flag</p>
      </Html>
    </group>
  )
}

/* ── Crowd of users in background ── */
function CrowdUsers({ targetPosition }: { targetPosition: [number, number, number] }) {
  const crowdCount = 15
  const maxParticles = 10

  // Generate crowd positions in a semicircle arc
  const crowdPositions = useMemo(() => {
    const positions: [number, number, number][] = []
    for (let i = 0; i < crowdCount; i++) {
      const angle = (i / (crowdCount - 1)) * Math.PI - Math.PI / 2 // -90 to +90 deg
      const radius = 2.8 + (Math.random() - 0.5) * 0.6
      const x = Math.sin(angle) * radius
      const z = 1.0 + Math.cos(angle) * 1.2 // z range ~2.5 to 3.5
      positions.push([x, 0.68, z])
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
      nextFireTime: Math.random() * 5, // stagger initial fire times
    }))
  )

  // Track next fire time per crowd member
  const crowdTimers = useRef(
    Array.from({ length: crowdCount }, () => Math.random() * 5 + 1)
  )

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const dt = 1 / 60 // approximate

    // Update crowd body positions (static, just set once-ish)
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
        // Find an inactive particle
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
          // Hide particle off-screen
          dummy.position.set(0, -10, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          particlesRef.current.setMatrixAt(i, dummy.matrix)
        } else {
          const src = crowdPositions[p.sourceIdx]
          const tgt = targetPosition
          const prog = p.progress
          // Lerp x,z + ballistic arc for y
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
        <meshStandardMaterial color="#fbbf24" transparent opacity={0.6} roughness={0.3} />
      </instancedMesh>
    </group>
  )
}

/* ── Colored platform ── */
function Platform({ position, width, depth, label, color = '#e8e8e8', accentColor = '#888' }: {
  position: [number, number, number]; width: number; depth: number
  label: string; color?: string; accentColor?: string
}) {
  return (
    <group position={position}>
      <RoundedBox args={[width, 0.04, depth]} radius={0.015} smoothness={4} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.75} />
      </RoundedBox>
      <mesh position={[0, 0.021, -depth / 2 + 0.01]}>
        <planeGeometry args={[width - 0.04, 0.018]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
      <Html position={[-width / 2 + 0.1, 0.06, -depth / 2 + 0.05]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <span className="text-[9px] tracking-[0.15em] uppercase whitespace-nowrap font-bold" style={{ color: accentColor }}>{label}</span>
      </Html>
    </group>
  )
}

/* ── Step platform (raised base under terraces) ── */
function StepPlatform({ position, width, depth }: {
  position: [number, number, number]; width: number; depth: number
}) {
  return (
    <group position={position}>
      <RoundedBox args={[width + 0.3, 0.02, depth + 0.2]} radius={0.01} smoothness={4} receiveShadow>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
    </group>
  )
}

/* ── Vertical flow ── */
function VFlow({ from, to, count = 10, color = '#888' }: {
  from: [number, number, number]; to: [number, number, number]; count?: number; color?: string
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const s = useMemo(() => new THREE.Vector3(...from), [from])
  const e = useMemo(() => new THREE.Vector3(...to), [to])
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(new THREE.LineCurve3(s, e), 1, 0.008, 6, false), [s, e])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.2 + i / count) % 1)
      dummy.position.lerpVectors(s, e, p)
      dummy.scale.setScalar(0.018 * Math.sin(p * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <mesh geometry={tubeGeo}><meshStandardMaterial color={color} transparent opacity={0.3} roughness={0.4} /></mesh>
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </instancedMesh>
    </group>
  )
}

export function MempoolLayers() {
  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[400px] md:h-[500px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [4, 5.5, 5.5], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.21, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Step platforms (raised bases under terraces) */}
              <StepPlatform position={[0, 0.63, 1.0]} width={5} depth={1.8} />
              <StepPlatform position={[0, 0.28, -0.5]} width={5} depth={1.6} />
              <StepPlatform position={[0, -0.02, -2.0]} width={5} depth={1.4} />

              {/* USERS terrace (top) — blue */}
              <Platform position={[0, 0.65, 1.0]} width={5} depth={1.8} label="USERS" color="#dbeafe" accentColor="#3b82f6" />
              <WalletModel position={[-1.5, 0.68, 1.0]} color="#3b82f6" />
              <Html center position={[-1.5, 1.18, 1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[9px] font-bold text-blue-600 whitespace-nowrap">Smart Wallet</p>
              </Html>
              <ScreenModel position={[0, 0.68, 1.0]} color="#6366f1" />
              <Html center position={[0, 1.22, 1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[9px] font-bold text-indigo-600 whitespace-nowrap">dApp</p>
              </Html>
              <LockModel position={[1.5, 0.68, 1.0]} color="#8b5cf6" />
              <Html center position={[1.5, 1.12, 1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
                <p className="text-[9px] font-bold text-violet-600 whitespace-nowrap">Privacy TX</p>
              </Html>

              {/* Crowd of users in background */}
              <CrowdUsers targetPosition={[0, 0.33, -0.5]} />

              {/* Flow: Users → Mempool */}
              <VFlow from={[-0.6, 0.6, 0.5]} to={[-0.6, 0.38, -0.3]} count={8} color="#f59e0b" />
              <VFlow from={[0.6, 0.6, 0.5]} to={[0.6, 0.38, -0.3]} count={8} color="#f59e0b" />

              {/* MEMPOOL terrace (middle) — amber */}
              <Platform position={[0, 0.3, -0.5]} width={5} depth={1.6} label="MEMPOOL" color="#fef3c7" accentColor="#f59e0b" />
              <PoolModel position={[-1, 0.33, -0.5]} color="#f59e0b" label="Conservative" sub="strict rules" />
              <PoolModel position={[1, 0.33, -0.5]} color="#ef4444" label="Aggressive" sub="staking" />

              {/* Flow: Mempool → Chain */}
              <VFlow from={[0, 0.25, -0.9]} to={[0, 0.05, -1.8]} count={10} color="#22c55e" />

              {/* CHAIN terrace (bottom) — green */}
              <Platform position={[0, 0, -2.0]} width={5} depth={1.4} label="CHAIN" color="#dcfce7" accentColor="#22c55e" />
              <ChainModel position={[0, 0.03, -2.0]} color="#22c55e" />

              <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 8} maxPolarAngle={Math.PI / 2.3} autoRotate autoRotateSpeed={0.3} dampingFactor={0.05} target={[0, 0.2, -0.3]} />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-blue-100 border border-blue-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Users</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-amber-100 border border-amber-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Mempool</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-100 border border-green-300" />
              <span className="text-[10px] text-text-muted tracking-wide">Chain</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
