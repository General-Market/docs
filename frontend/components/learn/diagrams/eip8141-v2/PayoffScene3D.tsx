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
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>
          After EIP-8141
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
/*  Frame TX Outer Box (wireframe container)                           */
/* ------------------------------------------------------------------ */

function FrameBox({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Scale in during 0-0.125 (0-1s)
    const scaleIn = rangeT(cycleT, 0, 0.125)
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.12 * scaleIn
    meshRef.current.scale.setScalar(0.3 + scaleIn * 0.7)
    meshRef.current.visible = scaleIn > 0.01
  })

  return (
    <mesh ref={meshRef} position={[0, 0.6, 0]}>
      <boxGeometry args={[5.6, 1.3, 1.8]} />
      <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.12} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Compartment (F0, F1, F2)                                     */
/* ------------------------------------------------------------------ */

function FrameCompartment({
  position,
  color,
  label,
  delay,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  label: string
  delay: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fill in during 0.125-0.375 (1-3s) with stagger
    const fillStart = 0.125 + delay * 0.08
    const fillEnd = fillStart + 0.12
    const scaleIn = rangeT(cycleT, fillStart, fillEnd)

    const s = 0.15 + 0.85 * scaleIn
    ref.current.scale.setScalar(Math.max(s, 0.01))
    ref.current.visible = scaleIn > 0.01
  })

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[1.3, 0.9, 1.2]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={color} transparent opacity={0.18} roughness={0.7} />
      </RoundedBox>
      {/* Wireframe edges */}
      <mesh>
        <boxGeometry args={[1.32, 0.92, 1.22]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
      </mesh>
      <Html center position={[0, 0.65, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color }}>{label}</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Padlock -- appears INSIDE F0 compartment                     */
/* ------------------------------------------------------------------ */

function FramePadlock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Appear during 0.125-0.25 (1-2s): materialize inside the compartment
    const appear = rangeT(cycleT, 0.2, 0.35)

    const scale = appear
    groupRef.current.scale.setScalar(Math.max(scale, 0.001))
    groupRef.current.visible = scale > 0.01

    // Gentle hover after appearing
    if (appear >= 1) {
      groupRef.current.position.y = 0.5 + Math.sin(elapsedRef.current * 1.5) * 0.012
    }
  })

  return (
    <group ref={groupRef} position={[-1.8, 0.5, 0]}>
      <Padlock color={PURPLE} scale={0.85} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Inside Auth Label                                                  */
/* ------------------------------------------------------------------ */

function InsideAuthLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible after padlock appears through end
    ref.current.visible = reducedMotion || (cycleT > 0.33 && cycleT < 0.85)
  })

  return (
    <group ref={ref}>
      <Html center position={[-1.8, 1.25, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-green-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            auth INSIDE
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Gate (between F0 and F1)                                    */
/* ------------------------------------------------------------------ */

function AcceptGate({ reducedMotion }: { reducedMotion: boolean }) {
  const leftPillarRef = useRef<THREE.Mesh>(null!)
  const rightPillarRef = useRef<THREE.Mesh>(null!)
  const archRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  // Gate position: between F0 (-1.8) and F1 (0)
  const gateX = -0.9

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // ACCEPT flash during 0.375-0.5 (3-4s)
    const inFlashRange = cycleT > 0.375 && cycleT < 0.5
    const flashProgress = inFlashRange ? (cycleT - 0.375) / 0.125 : 0
    const emissiveIntensity = inFlashRange
      ? 0.3 + Math.sin(flashProgress * Math.PI * 2) * 0.5
      : 0.05

    const updateMat = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = emissiveIntensity
    }

    updateMat(leftPillarRef.current)
    updateMat(rightPillarRef.current)
    updateMat(archRef.current)

    // ACCEPT ring: scale pulse during flash
    if (ringRef.current) {
      if (inFlashRange) {
        const ringScale = 0.8 + Math.sin(flashProgress * Math.PI) * 0.6
        ringRef.current.scale.setScalar(ringScale)
        ringRef.current.visible = true
        const rMat = ringRef.current.material as THREE.MeshStandardMaterial
        rMat.opacity = 0.5 * Math.sin(flashProgress * Math.PI)
      } else {
        ringRef.current.visible = false
      }
    }
  })

  return (
    <group position={[gateX, 0.08, 0]}>
      {/* Left pillar */}
      <RoundedBox
        ref={leftPillarRef}
        args={[0.06, 0.8, 0.06]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.4, -0.65]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.05} />
      </RoundedBox>
      {/* Right pillar */}
      <RoundedBox
        ref={rightPillarRef}
        args={[0.06, 0.8, 0.06]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.4, 0.65]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.05} />
      </RoundedBox>
      {/* Arch */}
      <RoundedBox
        ref={archRef}
        args={[0.06, 0.06, 1.36]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.83, 0]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.05} />
      </RoundedBox>
      {/* ACCEPT flash ring (torus) */}
      <mesh ref={ringRef} position={[0, 0.45, 0]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.5, 0.03, 12, 32]} />
        <meshStandardMaterial color={GREEN} transparent opacity={0} emissive={GREEN} emissiveIntensity={0.6} />
      </mesh>
      {/* ACCEPT label */}
      <Html center position={[0, 1.05, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>ACCEPT</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Multiple Token Spheres (any token for gas)                         */
/* ------------------------------------------------------------------ */

function TokenSpheres({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const sphere1Ref = useRef<THREE.Mesh>(null!)
  const sphere2Ref = useRef<THREE.Mesh>(null!)
  const sphere3Ref = useRef<THREE.Mesh>(null!)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in during 0.5-0.625 (4-5s)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)

    groupRef.current.scale.setScalar(Math.max(fadeIn * 0.8, 0.001))
    groupRef.current.visible = fadeIn > 0.01

    // Gentle orbit after appearing
    const t = elapsedRef.current
    if (sphere1Ref.current) {
      sphere1Ref.current.position.x = Math.cos(t * 0.6) * 0.3
      sphere1Ref.current.position.z = Math.sin(t * 0.6) * 0.3
    }
    if (sphere2Ref.current) {
      sphere2Ref.current.position.x = Math.cos(t * 0.6 + (Math.PI * 2) / 3) * 0.35
      sphere2Ref.current.position.z = Math.sin(t * 0.6 + (Math.PI * 2) / 3) * 0.35
    }
    if (sphere3Ref.current) {
      sphere3Ref.current.position.x = Math.cos(t * 0.6 + (Math.PI * 4) / 3) * 0.32
      sphere3Ref.current.position.z = Math.sin(t * 0.6 + (Math.PI * 4) / 3) * 0.32
    }
  })

  return (
    <group ref={groupRef} position={[2.6, 0.5, 0.5]}>
      {/* Amber token */}
      <mesh ref={sphere1Ref}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={AMBER} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Indigo token */}
      <mesh ref={sphere2Ref}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={INDIGO} roughness={0.3} metalness={0.2} />
      </mesh>
      {/* Blue token */}
      <mesh ref={sphere3Ref}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color={BLUE} roughness={0.3} metalness={0.2} />
      </mesh>
      <Html center position={[0, -0.45, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>Any token</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Ghost Relayer (faded outline where relayer was)                    */
/* ------------------------------------------------------------------ */

function GhostRelayer({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in as ghost during 0.5-0.625 (4-5s)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)
    groupRef.current.visible = fadeIn > 0.01
  })

  return (
    <group ref={groupRef} position={[0, 1.6, -0.3]}>
      {/* Ghost hexagonal cylinder -- very faint wireframe */}
      <mesh rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.3, 6]} />
        <meshBasicMaterial color="#d1d5db" wireframe transparent opacity={0.12} />
      </mesh>
      {/* Strikethrough label */}
      <Html center position={[0, 0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono whitespace-nowrap line-through" style={{ color: '#d1d5db' }}>Relayer</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Multiple Keys (converging toward F0)                               */
/* ------------------------------------------------------------------ */

function MultipleKeys({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const key1Ref = useRef<THREE.Group>(null!)
  const key2Ref = useRef<THREE.Group>(null!)
  const key3Ref = useRef<THREE.Group>(null!)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in during 0.5-0.625 (4-5s)
    const fadeIn = rangeT(cycleT, 0.5, 0.625)

    groupRef.current.scale.setScalar(Math.max(fadeIn, 0.001))
    groupRef.current.visible = fadeIn > 0.01

    // Keys converge toward F0 center (-1.8)
    const t = elapsedRef.current
    const convergeAmount = 0.15 + Math.sin(t * 0.8) * 0.08

    if (key1Ref.current) {
      key1Ref.current.position.x = -convergeAmount * 1.5
      key1Ref.current.position.z = -0.4 + Math.sin(t * 0.7) * 0.05
    }
    if (key2Ref.current) {
      key2Ref.current.position.x = 0
      key2Ref.current.position.z = 0.4 + Math.cos(t * 0.9) * 0.05
    }
    if (key3Ref.current) {
      key3Ref.current.position.x = convergeAmount * 1.5
      key3Ref.current.position.z = 0 + Math.sin(t * 1.1) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={[-2.8, 0.35, 0]}>
      {/* Key 1 */}
      <group ref={key1Ref}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={PURPLE} roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.015, 8, 16]} />
          <meshStandardMaterial color={PURPLE} transparent opacity={0.4} />
        </mesh>
      </group>
      {/* Key 2 */}
      <group ref={key2Ref}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={PURPLE} roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.015, 8, 16]} />
          <meshStandardMaterial color={PURPLE} transparent opacity={0.4} />
        </mesh>
      </group>
      {/* Key 3 */}
      <group ref={key3Ref}>
        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={PURPLE} roughness={0.35} metalness={0.1} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.015, 8, 16]} />
          <meshStandardMaterial color={PURPLE} transparent opacity={0.4} />
        </mesh>
      </group>
      <Html center position={[0, -0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>N signers</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Execution Glow -- green emissive wash over everything              */
/* ------------------------------------------------------------------ */

function ExecutionGlow({ reducedMotion }: { reducedMotion: boolean }) {
  const glowRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Green glow during 0.625-0.875 (5-7s)
    const inRange = cycleT > 0.625 && cycleT < 0.875
    const glowProgress = inRange ? (cycleT - 0.625) / 0.25 : 0
    // After 7s (0.875), hold a gentle pulse instead of resetting
    const holdPulse = cycleT >= 0.875 ? 0.06 + Math.sin(elapsedRef.current * 2) * 0.02 : 0
    const opacity = inRange ? 0.14 * Math.sin(glowProgress * Math.PI) : holdPulse

    if (!glowRef.current) return
    const mat = glowRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = opacity
    glowRef.current.visible = opacity > 0.005
  })

  return (
    <mesh ref={glowRef} position={[0, 0.5, 0]} visible={false}>
      <boxGeometry args={[5.4, 1.2, 1.6]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0}
        emissive={GREEN}
        emissiveIntensity={0.5}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Payload cubes inside F1 and F2                                     */
/* ------------------------------------------------------------------ */

function FramePayloads({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const fadeIn = rangeT(cycleT, 0.2, 0.375)
    groupRef.current.scale.setScalar(Math.max(fadeIn, 0.001))
    groupRef.current.visible = fadeIn > 0.01
  })

  return (
    <group ref={groupRef}>
      {/* F1 payload cube */}
      <RoundedBox args={[0.3, 0.25, 0.3]} radius={0.03} smoothness={4} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      {/* F2 payload cube */}
      <RoundedBox args={[0.3, 0.25, 0.3]} radius={0.03} smoothness={4} position={[1.8, 0.5, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
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
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">ACCEPT / Execution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Frame TX</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Auth (inside)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex gap-0.5">
          <div className="w-1.5 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
          <div className="w-1.5 h-2 rounded-sm" style={{ backgroundColor: INDIGO }} />
          <div className="w-1.5 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        </div>
        <span className="text-[10px] text-text-muted tracking-wide">Any token gas</span>
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

      {/* Unified Frame TX outer box */}
      <FrameBox reducedMotion={reducedMotion} />

      {/* Three compartments: F0 (Purple/auth), F1 (Blue), F2 (Blue) */}
      <FrameCompartment
        position={[-1.8, 0.5, 0]}
        color={PURPLE}
        label="F0"
        delay={0}
        reducedMotion={reducedMotion}
      />
      <FrameCompartment
        position={[0, 0.5, 0]}
        color={BLUE}
        label="F1"
        delay={1}
        reducedMotion={reducedMotion}
      />
      <FrameCompartment
        position={[1.8, 0.5, 0]}
        color={BLUE}
        label="F2"
        delay={2}
        reducedMotion={reducedMotion}
      />

      {/* Payload cubes inside F1 and F2 */}
      <FramePayloads reducedMotion={reducedMotion} />

      {/* Padlock INSIDE F0 */}
      <FramePadlock reducedMotion={reducedMotion} />

      {/* Auth inside label */}
      <InsideAuthLabel reducedMotion={reducedMotion} />

      {/* ACCEPT gate between F0 and F1 */}
      <AcceptGate reducedMotion={reducedMotion} />

      {/* Multiple token spheres (any token for gas) */}
      <TokenSpheres reducedMotion={reducedMotion} />

      {/* Ghost relayer (faded outline) */}
      <GhostRelayer reducedMotion={reducedMotion} />

      {/* Multiple keys converging toward F0 */}
      <MultipleKeys reducedMotion={reducedMotion} />

      {/* Execution glow */}
      <ExecutionGlow reducedMotion={reducedMotion} />

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

export function PayoffScene3D() {
  return (
    <SceneContainer
      height="h-[280px] md:h-[320px]"
      ariaLabel="After EIP-8141: unified Frame Transaction"
      srDescription="A 3D scene showing the unified state of Ethereum UX after EIP-8141. One large Frame TX container holds three contiguous compartments: F0 (purple, for authentication), F1 (blue, execution), and F2 (blue, execution). The purple padlock appears inside F0 rather than on top. An ACCEPT gate with green pillars and an arch sits between F0 and F1, flashing green to signal validation passed. Three colored token spheres (amber, indigo, blue) orbit gently near the container, showing any token can pay for gas. A faded ghost outline replaces the relayer, showing it is no longer needed. Three purple key spheres converge toward F0, representing N programmable signers. A green execution glow washes over the entire container."
      legend={<Legend />}
      fallbackText="After EIP-8141: one unified Frame TX with three compartments (F0=auth inside, F1, F2). ACCEPT gate between F0 and F1. Any token for gas. No relayer needed. N programmable signers."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
