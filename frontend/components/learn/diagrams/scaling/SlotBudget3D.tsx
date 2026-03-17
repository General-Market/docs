'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const BAR_LENGTH = 6          // 6 units = 12 seconds
const BAR_HEIGHT = 0.35
const BAR_DEPTH = 0.8
const TODAY_Z = -1.5
const EPBS_Z = 1.5

// Today segments (12s total = 6 units)
const TODAY_VERIFY_LEN = 0.15    // 300ms
const TODAY_GOSSIP_LEN = 5.85    // 11.7s

// ePBS segments (12s total = 6 units)
const EPBS_PROPOSE_LEN = 0.5    // 1s
const EPBS_BUILD_LEN = 2.0      // 4s
const EPBS_ATTEST_LEN = 3.5     // 7s

// Colors
const GREEN = '#22c55e'
const GREY = '#d4d4d8'
const AMBER = '#f59e0b'
const RED = '#ef4444'

// Particle counts
const TODAY_PARTICLE_COUNT = 32
const EPBS_PARTICLE_COUNT = 32

/* ------------------------------------------------------------------ */
/*  Bar Segment                                                        */
/* ------------------------------------------------------------------ */

function BarSegment({
  position,
  width,
  height,
  depth,
  color,
  emissiveColor,
  emissiveIntensity = 0,
}: {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  color: string
  emissiveColor?: string
  emissiveIntensity?: number
}) {
  return (
    <RoundedBox
      args={[width, height, depth]}
      radius={0.04}
      smoothness={4}
      position={position}
    >
      <meshStandardMaterial
        color={color}
        roughness={0.5}
        emissive={emissiveColor || color}
        emissiveIntensity={emissiveIntensity}
      />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Verification Particles (instancedMesh)                             */
/* ------------------------------------------------------------------ */

function VerificationParticles({
  count,
  boundMin,
  boundMax,
  color,
  overflow = false,
  reducedMotion,
}: {
  count: number
  boundMin: [number, number, number]
  boundMax: [number, number, number]
  color: string
  overflow?: boolean
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Generate stable random offsets per particle
  const seeds = useMemo(() => {
    const s: { rx: number; ry: number; rz: number; speed: number; phase: number }[] = []
    for (let i = 0; i < count; i++) {
      // Deterministic pseudo-random from index
      const hash = (i * 2654435761) >>> 0
      s.push({
        rx: (hash % 1000) / 1000,
        ry: ((hash >> 10) % 1000) / 1000,
        rz: ((hash >> 20) % 1000) / 1000,
        speed: 0.3 + ((hash >> 5) % 1000) / 1000 * 0.7,
        phase: ((hash >> 15) % 1000) / 1000 * Math.PI * 2,
      })
    }
    return s
  }, [count])

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current

    const xRange = boundMax[0] - boundMin[0]
    const yRange = boundMax[1] - boundMin[1]
    const zRange = boundMax[2] - boundMin[2]

    for (let i = 0; i < count; i++) {
      const seed = seeds[i]
      const phase = seed.phase + t * seed.speed

      // Base position within bounds
      let x = boundMin[0] + seed.rx * xRange
      let y = boundMin[1] + seed.ry * yRange + Math.sin(phase) * yRange * 0.3
      let z = boundMin[2] + seed.rz * zRange + Math.cos(phase * 0.7) * zRange * 0.15

      // Overflow effect: some particles escape upward and sideways
      if (overflow) {
        const escapeT = (Math.sin(phase * 1.3 + seed.rx * 5) + 1) * 0.5
        if (escapeT > 0.6) {
          const escapeFactor = (escapeT - 0.6) / 0.4
          y = boundMax[1] + escapeFactor * 0.8
          x += (seed.rx - 0.5) * escapeFactor * 0.6
          z += (seed.rz - 0.5) * escapeFactor * 0.4
        }
      }

      const scale = reducedMotion ? 0.025 : 0.02 + Math.sin(phase * 2) * 0.01

      dummy.position.set(x, y, z)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.7}
        emissive={color}
        emissiveIntensity={0.4}
      />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Block Cube (animated size pulse)                                   */
/* ------------------------------------------------------------------ */

function BlockCube({
  position,
  baseSize,
  color,
  reducedMotion,
}: {
  position: [number, number, number]
  baseSize: number
  color: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current
    const pulse = 1 + Math.sin(t * 2) * 0.08
    const s = baseSize * pulse
    ref.current.scale.set(s, s, s)
    ref.current.rotation.y = reducedMotion ? 0 : t * 0.5
  })

  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        emissive={color}
        emissiveIntensity={0.2}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Pulsing "13x" Label                                                */
/* ------------------------------------------------------------------ */

function PulsingMultiplierLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const pulse = 1 + Math.sin(t * 3) * 0.06
    ref.current.scale.set(pulse, pulse, pulse)
  })

  return (
    <group ref={ref} position={[0, 0.5, 0]}>
      <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col items-center">
          <span
            className="text-[18px] font-black font-mono whitespace-nowrap"
            style={{ color: GREEN }}
          >
            13x more time
          </span>
          <span
            className="text-[10px] font-mono whitespace-nowrap mt-0.5"
            style={{ color: '#86efac' }}
          >
            to verify
          </span>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Connector Arrow (from today green to ePBS green)                   */
/* ------------------------------------------------------------------ */

function ConnectorArrow({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = 0.3 + Math.sin(t * 2) * 0.2
  })

  // Vertical dashed line from today verify to ePBS verify
  const todayVerifyX = -BAR_LENGTH / 2 + TODAY_VERIFY_LEN / 2
  const epbsVerifyX = -BAR_LENGTH / 2 + EPBS_PROPOSE_LEN + EPBS_BUILD_LEN / 2

  const midX = (todayVerifyX + epbsVerifyX) / 2
  const midZ = (TODAY_Z + EPBS_Z) / 2
  const lineLen = Math.sqrt(
    (epbsVerifyX - todayVerifyX) ** 2 + (EPBS_Z - TODAY_Z) ** 2
  )
  const angle = Math.atan2(EPBS_Z - TODAY_Z, epbsVerifyX - todayVerifyX)

  return (
    <mesh
      ref={ref}
      position={[midX, BAR_HEIGHT / 2, midZ]}
      rotation={[0, -angle, 0]}
    >
      <boxGeometry args={[lineLen, 0.02, 0.02]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0.4}
        emissive={GREEN}
        emissiveIntensity={0.3}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Today Bar                                                          */
/* ------------------------------------------------------------------ */

function TodayBar({ reducedMotion }: { reducedMotion: boolean }) {
  const barStartX = -BAR_LENGTH / 2

  // Verify segment: starts at left edge
  const verifyX = barStartX + TODAY_VERIFY_LEN / 2
  // Gossip segment: after verify
  const gossipX = barStartX + TODAY_VERIFY_LEN + TODAY_GOSSIP_LEN / 2

  // Particle bounds for today's verify section
  const todayParticleBoundMin: [number, number, number] = [
    barStartX - 0.02,
    BAR_HEIGHT * 0.1,
    TODAY_Z - BAR_DEPTH / 2 + 0.05,
  ]
  const todayParticleBoundMax: [number, number, number] = [
    barStartX + TODAY_VERIFY_LEN + 0.02,
    BAR_HEIGHT + 0.1,
    TODAY_Z + BAR_DEPTH / 2 - 0.05,
  ]

  // Block cube sits on top of the verify sliver
  const blockCubePos: [number, number, number] = [
    verifyX,
    BAR_HEIGHT + 0.2,
    TODAY_Z,
  ]

  return (
    <group>
      {/* Verify segment (tiny green sliver) */}
      <BarSegment
        position={[verifyX, BAR_HEIGHT / 2, TODAY_Z]}
        width={TODAY_VERIFY_LEN}
        height={BAR_HEIGHT}
        depth={BAR_DEPTH}
        color={GREEN}
        emissiveColor={GREEN}
        emissiveIntensity={0.15}
      />

      {/* Gossip + Attest (large grey block) */}
      <BarSegment
        position={[gossipX, BAR_HEIGHT / 2, TODAY_Z]}
        width={TODAY_GOSSIP_LEN}
        height={BAR_HEIGHT}
        depth={BAR_DEPTH}
        color={GREY}
      />

      {/* Verification particles -- overflow since the space is too small */}
      <VerificationParticles
        count={TODAY_PARTICLE_COUNT}
        boundMin={todayParticleBoundMin}
        boundMax={todayParticleBoundMax}
        color={RED}
        overflow
        reducedMotion={reducedMotion}
      />

      {/* Tiny block cube on top of verify sliver */}
      <BlockCube
        position={blockCubePos}
        baseSize={0.18}
        color={RED}
        reducedMotion={reducedMotion}
      />

      {/* "Today" label */}
      <Html
        center
        position={[0, BAR_HEIGHT + 0.7, TODAY_Z]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap"
          style={{ color: '#a1a1aa' }}
        >
          Today
        </p>
      </Html>

      {/* "300ms" label on verify sliver */}
      <Html
        center
        position={[verifyX, -0.15, TODAY_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono font-bold whitespace-nowrap"
          style={{ color: RED }}
        >
          300ms
        </p>
      </Html>

      {/* "Verify" label */}
      <Html
        center
        position={[verifyX, BAR_HEIGHT + 0.15, TODAY_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[8px] font-mono whitespace-nowrap"
          style={{ color: GREEN }}
        >
          Verify
        </p>
      </Html>

      {/* "Gossip + Attest" label */}
      <Html
        center
        position={[gossipX, BAR_HEIGHT + 0.15, TODAY_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[8px] font-mono whitespace-nowrap"
          style={{ color: '#a1a1aa' }}
        >
          Gossip + Attest
        </p>
      </Html>

      {/* "11.7s" label on gossip section */}
      <Html
        center
        position={[gossipX, -0.15, TODAY_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono whitespace-nowrap"
          style={{ color: '#a1a1aa' }}
        >
          11.7s
        </p>
      </Html>

      {/* "2.5% used" percentage label */}
      <Html
        center
        position={[barStartX + 0.6, BAR_HEIGHT + 0.4, TODAY_Z]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[11px] font-bold font-mono whitespace-nowrap"
          style={{ color: RED }}
        >
          2.5% used
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ePBS Bar                                                           */
/* ------------------------------------------------------------------ */

function EPBSBar({ reducedMotion }: { reducedMotion: boolean }) {
  const barStartX = -BAR_LENGTH / 2

  // Propose segment
  const proposeX = barStartX + EPBS_PROPOSE_LEN / 2
  // Build + Verify segment
  const buildX = barStartX + EPBS_PROPOSE_LEN + EPBS_BUILD_LEN / 2
  // Attest segment
  const attestX = barStartX + EPBS_PROPOSE_LEN + EPBS_BUILD_LEN + EPBS_ATTEST_LEN / 2

  // Particle bounds for ePBS build+verify section
  const epbsParticleBoundMin: [number, number, number] = [
    barStartX + EPBS_PROPOSE_LEN + 0.05,
    BAR_HEIGHT * 0.1,
    EPBS_Z - BAR_DEPTH / 2 + 0.05,
  ]
  const epbsParticleBoundMax: [number, number, number] = [
    barStartX + EPBS_PROPOSE_LEN + EPBS_BUILD_LEN - 0.05,
    BAR_HEIGHT + 0.1,
    EPBS_Z + BAR_DEPTH / 2 - 0.05,
  ]

  // Large block cube on top of build+verify section
  const blockCubePos: [number, number, number] = [
    buildX,
    BAR_HEIGHT + 0.35,
    EPBS_Z,
  ]

  return (
    <group>
      {/* Propose segment (amber) */}
      <BarSegment
        position={[proposeX, BAR_HEIGHT / 2, EPBS_Z]}
        width={EPBS_PROPOSE_LEN}
        height={BAR_HEIGHT}
        depth={BAR_DEPTH}
        color={AMBER}
        emissiveColor={AMBER}
        emissiveIntensity={0.1}
      />

      {/* Build + Verify segment (green) */}
      <BarSegment
        position={[buildX, BAR_HEIGHT / 2, EPBS_Z]}
        width={EPBS_BUILD_LEN}
        height={BAR_HEIGHT}
        depth={BAR_DEPTH}
        color={GREEN}
        emissiveColor={GREEN}
        emissiveIntensity={0.15}
      />

      {/* Attest segment (grey) */}
      <BarSegment
        position={[attestX, BAR_HEIGHT / 2, EPBS_Z]}
        width={EPBS_ATTEST_LEN}
        height={BAR_HEIGHT}
        depth={BAR_DEPTH}
        color={GREY}
      />

      {/* Verification particles -- comfortably contained */}
      <VerificationParticles
        count={EPBS_PARTICLE_COUNT}
        boundMin={epbsParticleBoundMin}
        boundMax={epbsParticleBoundMax}
        color={GREEN}
        overflow={false}
        reducedMotion={reducedMotion}
      />

      {/* Large block cube on top of build+verify */}
      <BlockCube
        position={blockCubePos}
        baseSize={0.5}
        color={GREEN}
        reducedMotion={reducedMotion}
      />

      {/* "ePBS" label */}
      <Html
        center
        position={[0, BAR_HEIGHT + 0.7, EPBS_Z]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap"
          style={{ color: GREEN }}
        >
          ePBS
        </p>
      </Html>

      {/* "4,000ms" label on build+verify section */}
      <Html
        center
        position={[buildX, -0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono font-bold whitespace-nowrap"
          style={{ color: GREEN }}
        >
          4,000ms
        </p>
      </Html>

      {/* "Build + Verify" label */}
      <Html
        center
        position={[buildX, BAR_HEIGHT + 0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[8px] font-mono whitespace-nowrap"
          style={{ color: GREEN }}
        >
          Build + Verify
        </p>
      </Html>

      {/* "Propose" label */}
      <Html
        center
        position={[proposeX, BAR_HEIGHT + 0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[8px] font-mono whitespace-nowrap"
          style={{ color: AMBER }}
        >
          Propose
        </p>
      </Html>

      {/* "1s" label under propose */}
      <Html
        center
        position={[proposeX, -0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono whitespace-nowrap"
          style={{ color: AMBER }}
        >
          1s
        </p>
      </Html>

      {/* "Attest" label */}
      <Html
        center
        position={[attestX, BAR_HEIGHT + 0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[8px] font-mono whitespace-nowrap"
          style={{ color: '#a1a1aa' }}
        >
          Attest
        </p>
      </Html>

      {/* "7s" label under attest */}
      <Html
        center
        position={[attestX, -0.15, EPBS_Z + BAR_DEPTH / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono whitespace-nowrap"
          style={{ color: '#a1a1aa' }}
        >
          7s
        </p>
      </Html>

      {/* "33% productive" label */}
      <Html
        center
        position={[barStartX + 1.5, BAR_HEIGHT + 0.4, EPBS_Z]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[11px] font-bold font-mono whitespace-nowrap"
          style={{ color: GREEN }}
        >
          33% used
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Scene Content                                                      */
/* ------------------------------------------------------------------ */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* White floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[14, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Today bar */}
      <TodayBar reducedMotion={reducedMotion} />

      {/* ePBS bar */}
      <EPBSBar reducedMotion={reducedMotion} />

      {/* Connector arrow between the two green sections */}
      <ConnectorArrow reducedMotion={reducedMotion} />

      {/* Pulsing "13x more time" label between bars */}
      <PulsingMultiplierLabel reducedMotion={reducedMotion} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Verify</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Propose</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREY }} />
        <span className="text-[10px] text-text-muted tracking-wide">Gossip / Attest</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Overflow</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function SlotBudget3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Comparison of 12-second slot allocation: today's 300ms verification window versus ePBS's 4-second window"
      srDescription="Two horizontal timeline bars comparing slot usage. Today: tiny 300ms verification window in a 12-second slot, with particles overflowing because the space is too small. ePBS: 4-second build and verify window, enabling 13x larger blocks with particles comfortably contained."
      legend={<Legend />}
      fallbackText="Slot budget comparison — today 300ms verify vs ePBS 4,000ms verify (13x)"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 6, 8], fov: 36 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          <Scene reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.4}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
