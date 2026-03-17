'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { SceneLegend } from '../scaling/shared/SceneLegend'
import { AutoFitCamera } from '../scaling/shared/AutoFitCamera'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEFT_X = -3.5
const RIGHT_X = 3.5
const CYCLE = 8

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const PURPLE = '#8b5cf6'

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Clamp 0-1 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Map a cycle range to 0-1 with easing */
function rangeT(cycleT: number, start: number, end: number): number {
  if (cycleT < start) return 0
  if (cycleT >= end) return 1
  return easeInOut((cycleT - start) / (end - start))
}

/* ------------------------------------------------------------------ */
/*  Left Platform (Normal TX -- "sealed letter")                       */
/* ------------------------------------------------------------------ */

function LeftPlatform() {
  return (
    <group position={[LEFT_X, 0, 0]}>
      {/* Base shadow */}
      <RoundedBox args={[4.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Platform */}
      <RoundedBox args={[4.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      {/* Title label */}
      <Html center position={[0, 1.9, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Normal TX
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Platform (Frame TX -- "shipping box")                        */
/* ------------------------------------------------------------------ */

function RightPlatform() {
  return (
    <group position={[RIGHT_X, 0, 0]}>
      <RoundedBox args={[5.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 1.9, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Frame TX
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[0.02, 0.2, 3.0]} radius={0.004} smoothness={4} position={[0, 0.1, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Padlock Shape (reusable)                                           */
/*  A small padlock: rectangular body + torus-arc shackle              */
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
      <RoundedBox args={[0.24, 0.20, 0.10]} radius={0.025} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {/* Lock shackle */}
      <mesh position={[0, 0.13, 0]}>
        <torusGeometry args={[0.085, 0.022, 8, 16, Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.15} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Envelope (the "sealed letter")                           */
/*  A flat rectangular box representing a single-content envelope      */
/* ------------------------------------------------------------------ */

function NormalEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Fade in during 0-0.125 (0-1s)
    const fadeIn = clamp01(rangeT(cycleT, 0, 0.125))
    // Reset during 0.875-1.0 (7-8s)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1
    const opacity = fadeIn * fadeOut
    groupRef.current.scale.setScalar(0.5 + opacity * 0.5)
    groupRef.current.visible = opacity > 0.01
  })

  return (
    <group ref={groupRef} position={[LEFT_X, 0.35, 0]}>
      {/* Envelope body */}
      <RoundedBox args={[1.6, 0.5, 1.0]} radius={0.05} smoothness={4}>
        <meshStandardMaterial color={BLUE} transparent opacity={0.18} roughness={0.6} />
      </RoundedBox>
      {/* Wireframe edges */}
      <mesh>
        <boxGeometry args={[1.62, 0.52, 1.02]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.3} />
      </mesh>
      {/* Content cube inside */}
      <RoundedBox args={[0.35, 0.28, 0.35]} radius={0.03} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Padlock -- appears ON TOP of the envelope (outside)      */
/*  Key visual: padlock sits outside, on top of the envelope           */
/* ------------------------------------------------------------------ */

function NormalPadlock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Appear during 0.125-0.25 (1-2s): drop from above
    const appear = rangeT(cycleT, 0.125, 0.25)
    // Hold until 0.875
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const scale = appear * fadeOut
    groupRef.current.scale.setScalar(Math.max(scale, 0.001))
    groupRef.current.visible = scale > 0.01

    // Drop-in: start above, settle on top
    const dropY = 0.85 - (1 - appear) * 0.4
    groupRef.current.position.y = dropY

    // Gentle hover after landing
    if (appear >= 1) {
      groupRef.current.position.y = 0.85 + Math.sin(elapsedRef.current * 1.5) * 0.015
    }
  })

  return (
    <group ref={groupRef} position={[LEFT_X, 0.85, 0]}>
      <Padlock color={PURPLE} scale={1.1} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX "outside" label (appears with padlock)                   */
/* ------------------------------------------------------------------ */

function NormalOutsideLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible after padlock lands (0.25) until frame padlock appears (0.375)
    // Mutually exclusive with "auth INSIDE" to stay within 5-label budget
    ref.current.visible = reducedMotion || (cycleT > 0.22 && cycleT < 0.375)
  })

  return (
    <group ref={ref}>
      <Html center position={[LEFT_X, 1.25, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-purple-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>
            auth OUTSIDE
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Outer Box (the "shipping box")                            */
/* ------------------------------------------------------------------ */

function FrameBox({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const fadeIn = clamp01(rangeT(cycleT, 0, 0.125))
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = 0.1 * fadeIn * fadeOut
  })

  return (
    <mesh ref={meshRef} position={[RIGHT_X, 0.6, 0]}>
      <boxGeometry args={[4.8, 1.3, 1.8]} />
      <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.1} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Compartment (F0, F1, F2) -- compartments inside shipping box */
/* ------------------------------------------------------------------ */

function FrameCompartment({
  position,
  color,
  label,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  label?: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Scale in during 0-0.125 (0-1s)
    const scaleIn = rangeT(cycleT, 0, 0.125)
    // Fade out during 0.875-1.0
    const scaleOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1
    const s = 0.2 + 0.8 * scaleIn * scaleOut
    ref.current.scale.setScalar(Math.max(s, 0.01))
  })

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[1.2, 0.9, 1.2]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={color} transparent opacity={0.18} roughness={0.7} />
      </RoundedBox>
      {/* Wireframe edges */}
      <mesh>
        <boxGeometry args={[1.22, 0.92, 1.22]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
      </mesh>
      {label && (
        <Html center position={[0, 0.65, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color }}>{label}</p>
        </Html>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Padlock -- appears INSIDE F0 compartment                  */
/*  Key visual: padlock is inside the compartment, not on the outside  */
/* ------------------------------------------------------------------ */

function FramePadlock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  // F0 center is at RIGHT_X - 1.7
  const f0X = RIGHT_X - 1.7

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Appear during 0.25-0.375 (2-3s): materialize inside the compartment
    const appear = rangeT(cycleT, 0.25, 0.375)
    // Hold until 0.875
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1

    const scale = appear * fadeOut
    groupRef.current.scale.setScalar(Math.max(scale, 0.001))
    groupRef.current.visible = scale > 0.01

    // Gentle hover after appearing
    if (appear >= 1) {
      groupRef.current.position.y = 0.45 + Math.sin(elapsedRef.current * 1.5) * 0.015
    }
  })

  return (
    <group ref={groupRef} position={[f0X, 0.45, 0]}>
      <Padlock color={PURPLE} scale={0.9} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX "inside" label (appears with padlock)                     */
/* ------------------------------------------------------------------ */

function FrameInsideLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible after frame padlock appears (0.375) through execution (0.875)
    ref.current.visible = reducedMotion || (cycleT > 0.35 && cycleT < 0.875)
  })

  return (
    <group ref={ref}>
      <Html center position={[RIGHT_X - 1.7, 1.25, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
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

  // Gate position: between F0 (RIGHT_X-1.7) and F1 (RIGHT_X)
  const gateX = RIGHT_X - 0.85

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // ACCEPT flash during 0.375-0.625 (3-5s)
    const inFlashRange = cycleT > 0.375 && cycleT < 0.625
    const flashProgress = inFlashRange ? (cycleT - 0.375) / 0.25 : 0
    const emissiveIntensity = inFlashRange
      ? 0.3 + Math.sin(flashProgress * Math.PI * 2) * 0.4
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
/*  Execution Glow -- green emissive wash over both sides              */
/* ------------------------------------------------------------------ */

function ExecutionGlow({ reducedMotion }: { reducedMotion: boolean }) {
  const leftRef = useRef<THREE.Mesh>(null!)
  const rightRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Execution glow during 0.625-0.875 (5-7s)
    const inRange = cycleT > 0.625 && cycleT < 0.875
    const glowProgress = inRange ? (cycleT - 0.625) / 0.25 : 0
    const opacity = inRange ? 0.12 * Math.sin(glowProgress * Math.PI) : 0

    const update = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.opacity = opacity
      mesh.visible = opacity > 0.005
    }

    update(leftRef.current)
    update(rightRef.current)
  })

  return (
    <>
      {/* Left side execution glow */}
      <mesh ref={leftRef} position={[LEFT_X, 0.3, 0]} visible={false}>
        <boxGeometry args={[3.8, 0.6, 2.8]} />
        <meshStandardMaterial
          color={GREEN}
          transparent
          opacity={0}
          emissive={GREEN}
          emissiveIntensity={0.5}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Right side execution glow */}
      <mesh ref={rightRef} position={[RIGHT_X, 0.5, 0]} visible={false}>
        <boxGeometry args={[4.6, 1.0, 1.6]} />
        <meshStandardMaterial
          color={GREEN}
          transparent
          opacity={0}
          emissive={GREEN}
          emissiveIntensity={0.5}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Content blocks inside Frame TX compartments (F1 and F2)            */
/*  Small cubes representing payload data                              */
/* ------------------------------------------------------------------ */

function FramePayloads({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const fadeIn = rangeT(cycleT, 0, 0.125)
    const fadeOut = cycleT > 0.875 ? 1 - rangeT(cycleT, 0.875, 1.0) : 1
    const s = fadeIn * fadeOut
    groupRef.current.scale.setScalar(Math.max(s, 0.001))
    groupRef.current.visible = s > 0.01
  })

  return (
    <group ref={groupRef}>
      {/* F1 payload cube */}
      <RoundedBox args={[0.3, 0.25, 0.3]} radius={0.03} smoothness={4} position={[RIGHT_X, 0.45, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      {/* F2 payload cube */}
      <RoundedBox args={[0.3, 0.25, 0.3]} radius={0.03} smoothness={4} position={[RIGHT_X + 1.7, 0.45, 0]}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
    </group>
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

      {/* Platforms + divider */}
      <LeftPlatform />
      <RightPlatform />
      <Divider />

      {/* ------ LEFT: Normal TX ("sealed letter") ------ */}
      <NormalEnvelope reducedMotion={reducedMotion} />
      <NormalPadlock reducedMotion={reducedMotion} />
      <NormalOutsideLabel reducedMotion={reducedMotion} />

      {/* ------ RIGHT: Frame TX ("shipping box with compartments") ------ */}
      <FrameBox reducedMotion={reducedMotion} />
      <FrameCompartment
        position={[RIGHT_X - 1.7, 0.5, 0]}
        color={PURPLE}
        label="F0"
        reducedMotion={reducedMotion}
      />
      <FrameCompartment
        position={[RIGHT_X, 0.5, 0]}
        color={BLUE}
        reducedMotion={reducedMotion}
      />
      <FrameCompartment
        position={[RIGHT_X + 1.7, 0.5, 0]}
        color={BLUE}
        reducedMotion={reducedMotion}
      />
      <FramePayloads reducedMotion={reducedMotion} />
      <FramePadlock reducedMotion={reducedMotion} />
      <FrameInsideLabel reducedMotion={reducedMotion} />
      <AcceptGate reducedMotion={reducedMotion} />

      {/* ------ Execution glow (both sides, 5-7s) ------ */}
      <ExecutionGlow reducedMotion={reducedMotion} />

      {/* ------ Camera ------ */}
      <AutoFitCamera points={[[-5, 2.5, 1.5], [5.5, 2.5, 1.5], [-5, -0.5, -1.5], [5.5, -0.5, -1.5]]} />

      {/* ------ Controls ------ */}
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

export function NormalVsFrame3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Side-by-side comparison of Normal TX versus Frame TX, showing how EIP-8141 moves authentication from outside the envelope to inside a frame compartment"
      srDescription="A 3D scene with two platforms. Left: a Normal TX shown as a sealed letter with a purple ECDSA padlock sitting on top (outside the envelope). Right: a Frame TX shown as a shipping box with three compartments (F0, F1, F2). The purple padlock appears inside F0 (the auth compartment). An ACCEPT gate between F0 and F1 flashes green. The key insight: the padlock position changes from outside (Normal TX) to inside (Frame TX)."
      legend={<SceneLegend items={[{ color: BLUE, label: 'Transaction data' }, { color: PURPLE, label: 'Validation (auth)' }, { color: GREEN, label: 'ACCEPT / Execution' }]} />}
      fallbackText="Normal TX: padlock sits OUTSIDE the envelope. Frame TX: padlock sits INSIDE compartment F0, with an ACCEPT gate before execution frames F1 and F2."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
