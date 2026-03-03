'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CYCLE = 8

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const PURPLE = '#8b5cf6'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const INDIGO = '#6366f1'

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function rangeT(cycleT: number, start: number, end: number): number {
  if (cycleT < start) return 0
  if (cycleT >= end) return 1
  return easeInOut((cycleT - start) / (end - start))
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, 0, 0]}>
      {/* Base shadow */}
      <RoundedBox args={[7.0, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Platform */}
      <RoundedBox args={[6.6, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      {/* Title label */}
      <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>
          Before EIP-8141
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Padlock Shape (reused from reference)                              */
/* ------------------------------------------------------------------ */

function Padlock({
  color,
  scale = 1,
}: {
  color: string
  scale?: number
}) {
  return (
    <group scale={scale}>
      {/* Lock body */}
      <RoundedBox args={[0.20, 0.16, 0.08]} radius={0.02} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {/* Lock shackle */}
      <mesh position={[0, 0.10, 0]}>
        <torusGeometry args={[0.07, 0.018, 8, 16, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.15} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Envelope (TX box)                                                  */
/* ------------------------------------------------------------------ */

function Envelope({
  position,
  label,
  delay,
  reducedMotion,
}: {
  position: [number, number, number]
  label: string
  delay: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Staggered fade-in during 0-0.125 (0-1s)
    const fadeStart = delay
    const fadeEnd = delay + 0.08
    const fadeIn = clamp01(rangeT(cycleT, fadeStart, fadeEnd))
    // Reset during 0.875-1.0 (7-8s)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    // Chaotic drift during 6-7s (0.75-0.875)
    let driftX = 0
    let driftY = 0
    if (cycleT > 0.75 && cycleT < 0.875) {
      const driftT = (cycleT - 0.75) / 0.125
      driftX = Math.sin(elapsedRef.current * 3 + delay * 20) * 0.08 * driftT
      driftY = Math.cos(elapsedRef.current * 2.5 + delay * 15) * 0.05 * driftT
    }

    const opacity = fadeIn * fadeOut
    groupRef.current.scale.setScalar(0.3 + opacity * 0.7)
    groupRef.current.visible = opacity > 0.01
    groupRef.current.position.x = position[0] + driftX
    groupRef.current.position.y = position[1] + driftY
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Envelope body */}
      <RoundedBox args={[1.4, 0.45, 0.9]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={BLUE} transparent opacity={0.18} roughness={0.6} />
      </RoundedBox>
      {/* Wireframe edges */}
      <mesh>
        <boxGeometry args={[1.42, 0.47, 0.92]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.3} />
      </mesh>
      {/* Content cube inside */}
      <RoundedBox args={[0.28, 0.22, 0.28]} radius={0.02} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      {/* Label */}
      <Html center position={[0, -0.42, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>{label}</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Padlocks -- drop onto envelopes from above                        */
/* ------------------------------------------------------------------ */

function EnvelopePadlock({
  xPos,
  delay,
  reducedMotion,
}: {
  xPos: number
  delay: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Appear during 0.125-0.25 (1-2s) with stagger
    const appearStart = 0.125 + delay * 0.3
    const appearEnd = appearStart + 0.08
    const appear = rangeT(cycleT, appearStart, appearEnd)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const scale = appear * fadeOut
    groupRef.current.scale.setScalar(Math.max(scale, 0.001))
    groupRef.current.visible = scale > 0.01

    // Drop-in animation
    const dropY = 0.72 - (1 - appear) * 0.5
    groupRef.current.position.y = dropY
    groupRef.current.position.x = xPos

    // Gentle hover after landing
    if (appear >= 1) {
      groupRef.current.position.y = 0.72 + Math.sin(elapsedRef.current * 1.5 + delay * 5) * 0.01
    }

    // Chaotic drift during 6-7s
    if (cycleT > 0.75 && cycleT < 0.875) {
      const driftT = (cycleT - 0.75) / 0.125
      groupRef.current.position.x = xPos + Math.sin(elapsedRef.current * 3.5 + delay * 20) * 0.06 * driftT
    }
  })

  return (
    <group ref={groupRef} position={[xPos, 0.72, 0]}>
      <Padlock color={PURPLE} scale={0.85} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Red Attack Gap (between TX1 and TX2)                               */
/* ------------------------------------------------------------------ */

function AttackGap({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible after envelopes appear
    const fadeIn = rangeT(cycleT, 0.125, 0.2)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    // Pulse during 2-4s (0.25-0.5)
    const inPulse = cycleT > 0.25 && cycleT < 0.5
    const pulseIntensity = inPulse
      ? 0.25 + Math.sin(((cycleT - 0.25) / 0.25) * Math.PI * 3) * 0.2
      : 0.12

    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = pulseIntensity * fadeIn * fadeOut
    mat.emissiveIntensity = inPulse ? 0.6 + Math.sin(((cycleT - 0.25) / 0.25) * Math.PI * 3) * 0.4 : 0.2
    meshRef.current.visible = fadeIn * fadeOut > 0.01
  })

  // Position between TX1 (-1.8) and TX2 (0)
  return (
    <group position={[-0.9, 0.35, 0]}>
      <RoundedBox
        ref={meshRef}
        args={[0.35, 0.55, 1.0]}
        radius={0.03}
        smoothness={4}
      >
        <meshStandardMaterial
          color={RED}
          transparent
          opacity={0.15}
          emissive={RED}
          emissiveIntensity={0.3}
          roughness={0.5}
        />
      </RoundedBox>
      {/* Label */}
      <Html center position={[0, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-red-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
            ATTACK SURFACE
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ETH Diamond (octahedron, Amber)                                    */
/* ------------------------------------------------------------------ */

function EthDiamond({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in during 4-5s (0.5-0.625)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const opacity = fadeIn * fadeOut
    groupRef.current.scale.setScalar(Math.max(opacity * 0.7, 0.001))
    groupRef.current.visible = opacity > 0.01

    // Slow rotation
    groupRef.current.rotation.y = elapsedRef.current * 0.5

    // Chaotic drift
    if (cycleT > 0.75 && cycleT < 0.875) {
      const driftT = (cycleT - 0.75) / 0.125
      groupRef.current.position.y = 0.5 + Math.sin(elapsedRef.current * 2) * 0.06 * driftT
    } else {
      groupRef.current.position.y = 0.5
    }
  })

  return (
    <group ref={groupRef} position={[2.6, 0.5, 0.5]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial color={AMBER} roughness={0.3} metalness={0.2} transparent opacity={0.85} />
      </mesh>
      <Html center position={[0, -0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>ETH only</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Relayer Box (Indigo, floating above)                               */
/* ------------------------------------------------------------------ */

function RelayerBox({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in during 4-5s (0.5-0.625)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const opacity = fadeIn * fadeOut
    groupRef.current.scale.setScalar(Math.max(opacity, 0.001))
    groupRef.current.visible = opacity > 0.01

    // Gentle float
    groupRef.current.position.y = 1.6 + Math.sin(elapsedRef.current * 0.8) * 0.04

    // Chaotic drift
    if (cycleT > 0.75 && cycleT < 0.875) {
      const driftT = (cycleT - 0.75) / 0.125
      groupRef.current.position.x = 0 + Math.sin(elapsedRef.current * 2.2) * 0.1 * driftT
    } else {
      groupRef.current.position.x = 0
    }
  })

  return (
    <group ref={groupRef} position={[0, 1.6, -0.3]}>
      {/* Hexagonal cylinder for relayer (vault/validator shape) */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 6]} />
        <meshStandardMaterial color={INDIGO} transparent opacity={0.6} roughness={0.4} />
      </mesh>
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.31, 6]} />
        <meshBasicMaterial color={INDIGO} wireframe transparent opacity={0.3} />
      </mesh>
      {/* Dashed line down to envelopes */}
      <Html center position={[0, 0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: INDIGO }}>Relayer</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Single Key (small purple sphere)                                   */
/* ------------------------------------------------------------------ */

function SingleKey({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in during 4-5s (0.5-0.625)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const opacity = fadeIn * fadeOut
    groupRef.current.scale.setScalar(Math.max(opacity, 0.001))
    groupRef.current.visible = opacity > 0.01

    // Chaotic drift
    if (cycleT > 0.75 && cycleT < 0.875) {
      const driftT = (cycleT - 0.75) / 0.125
      groupRef.current.position.y = 0.35 + Math.sin(elapsedRef.current * 3) * 0.05 * driftT
    } else {
      groupRef.current.position.y = 0.35
    }
  })

  return (
    <group ref={groupRef} position={[-2.6, 0.35, 0.6]}>
      {/* Key sphere (actor/signer shape) */}
      <mesh>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={PURPLE} roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Small ring around it to suggest a key */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 16]} />
        <meshStandardMaterial color={PURPLE} transparent opacity={0.4} />
      </mesh>
      <Html center position={[0, -0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>1 key, 1 call</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Attack surface</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Separate TXs</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Auth (outside)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">ETH gas</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Scene Content (inside Canvas)                                 */
/* ------------------------------------------------------------------ */

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <ContextDisposer />
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-3, 6, -2]} intensity={0.3} />

      {/* Platform */}
      <Platform />

      {/* Three separate envelopes -- staggered appearance */}
      <Envelope
        position={[-1.8, 0.35, 0]}
        label="TX 1: approve"
        delay={0}
        reducedMotion={reducedMotion}
      />
      <Envelope
        position={[0, 0.35, 0]}
        label="TX 2: swap"
        delay={0.04}
        reducedMotion={reducedMotion}
      />
      <Envelope
        position={[1.8, 0.35, 0]}
        label="TX 3: deploy"
        delay={0.08}
        reducedMotion={reducedMotion}
      />

      {/* Padlocks dropping onto envelopes */}
      <EnvelopePadlock xPos={-1.8} delay={0} reducedMotion={reducedMotion} />
      <EnvelopePadlock xPos={0} delay={0.12} reducedMotion={reducedMotion} />
      <EnvelopePadlock xPos={1.8} delay={0.24} reducedMotion={reducedMotion} />

      {/* Red attack gap between TX1 and TX2 */}
      <AttackGap reducedMotion={reducedMotion} />

      {/* ETH diamond */}
      <EthDiamond reducedMotion={reducedMotion} />

      {/* Relayer box */}
      <RelayerBox reducedMotion={reducedMotion} />

      {/* Single key */}
      <SingleKey reducedMotion={reducedMotion} />

      {/* Controls */}
      <OrbitControls
        enableZoom
        minDistance={3}
        maxDistance={18}
        enablePan={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function PromiseScene3D() {
  return (
    <SceneContainer
      height="h-[280px] md:h-[320px]"
      ariaLabel="Before EIP-8141: chaotic Ethereum transactions"
      srDescription="A 3D scene showing the chaotic state of Ethereum UX before EIP-8141. Three separate transaction envelopes (approve, swap, deploy) each have their own purple padlock sitting on top, meaning authentication is outside the transaction. A pulsing red zone between TX 1 and TX 2 represents the attack surface where front-running can occur. An amber ETH diamond shows that only ETH can pay for gas. An indigo relayer hexagon floats above, representing the middleman needed for privacy. A single purple key sphere shows that one key can only make one call."
      legend={<Legend />}
      fallbackText="Before EIP-8141: three separate transactions (approve, swap, deploy) each with their own padlock on top, a red attack gap between them, ETH-only gas, a relayer middleman, and a single key limited to one call."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
