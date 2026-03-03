'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CYCLE = 10

const RED = '#ef4444'
const AMBER = '#f59e0b'
const GREEN = '#22c55e'
const BLUE = '#3b82f6'

interface Milestone {
  x: number
  year: string
  label: string
  status: string
  color: string
}

const MILESTONES: Milestone[] = [
  { x: -4.5, year: '2016', label: 'EIP-86', status: 'Failed', color: RED },
  { x: -2.5, year: '2020', label: 'EIP-2938', status: 'Failed', color: RED },
  { x: -0.5, year: '2021', label: 'ERC-4337', status: 'Shipped (bundlers)', color: AMBER },
  { x: 1.5, year: '2023', label: 'EIP-3074', status: 'Revoked', color: RED },
  { x: 3.0, year: '2024', label: 'EIP-7702', status: 'Stopgap', color: AMBER },
  { x: 4.8, year: '2026', label: 'EIP-8141', status: 'The Answer', color: GREEN },
]

/** Timing windows (normalized 0-1 within CYCLE) for each milestone activation */
const TIMING: Array<[number, number]> = [
  [0.0, 0.1],     // 0-1s: EIP-86
  [0.1, 0.25],    // 1-2.5s: EIP-2938
  [0.25, 0.4],    // 2.5-4s: ERC-4337
  [0.4, 0.55],    // 4-5.5s: EIP-3074
  [0.55, 0.7],    // 5.5-7s: EIP-7702
  [0.7, 0.9],     // 7-9s: EIP-8141
]

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
/*  Timeline Path (CatmullRomCurve3 tube)                              */
/* ------------------------------------------------------------------ */

function TimelinePath() {
  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-5.5, 0.1, 0),
      new THREE.Vector3(-3.5, 0.15, 0),
      new THREE.Vector3(-1.5, 0.25, 0),
      new THREE.Vector3(0, 0.3, 0),
      new THREE.Vector3(1.5, 0.25, 0),
      new THREE.Vector3(3.5, 0.15, 0),
      new THREE.Vector3(5.5, 0.1, 0),
    ]
    return new THREE.CatmullRomCurve3(points)
  }, [])

  const geometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 0.03, 8, false)
  }, [curve])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={BLUE} roughness={0.4} metalness={0.1} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Colored Segments between milestones                                */
/*  Each segment takes the color of the milestone it leads FROM        */
/* ------------------------------------------------------------------ */

function TimelineSegments() {
  const segmentColors = [RED, RED, AMBER, RED, AMBER]

  const segments = useMemo(() => {
    return segmentColors.map((color, i) => {
      const startX = MILESTONES[i].x
      const endX = MILESTONES[i + 1].x
      const midX = (startX + endX) / 2
      const width = endX - startX
      return { color, midX, width }
    })
  }, [])

  return (
    <>
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.midX, 0.1, 0]}>
          <boxGeometry args={[seg.width, 0.025, 0.025]} />
          <meshStandardMaterial
            color={seg.color}
            transparent
            opacity={0.5}
            roughness={0.5}
          />
        </mesh>
      ))}
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Single Milestone Sphere with emissive glow animation               */
/* ------------------------------------------------------------------ */

function MilestoneSphere({
  milestone,
  index,
  reducedMotion,
}: {
  milestone: Milestone
  index: number
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const [start] = TIMING[index]
    const mat = meshRef.current.material as THREE.MeshStandardMaterial

    if (reducedMotion) {
      mat.emissiveIntensity = 0.4
      return
    }

    // Milestone is "activated" once cycleT passes its start time
    const activated = cycleT >= start
    // Glow-in intensity
    const glowIn = activated ? clamp01(rangeT(cycleT, start, start + 0.08)) : 0
    // During hold phase (0.9-1.0), fade everything for reset
    const fadeOut = cycleT > 0.9 ? 1 - rangeT(cycleT, 0.9, 1.0) : 1

    const intensity = glowIn * fadeOut
    mat.emissiveIntensity = 0.1 + intensity * 0.7

    // Gentle float
    if (activated && fadeOut > 0.01) {
      meshRef.current.position.y = 0.32 + Math.sin(elapsedRef.current * 2 + index) * 0.02
    } else {
      meshRef.current.position.y = 0.32
    }
  })

  // Y offset: spheres sit on the arc (approximate the curve)
  const arcY = 0.1 + 0.2 * (1 - Math.pow((milestone.x / 5.5), 2))

  return (
    <mesh ref={meshRef} position={[milestone.x, arcY + 0.22, 0]}>
      <sphereGeometry args={[0.22, 24, 24]} />
      <meshStandardMaterial
        color={milestone.color}
        emissive={milestone.color}
        emissiveIntensity={0.1}
        roughness={0.35}
        metalness={0.1}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Milestone Label (Html overlay)                                     */
/*  Manages visibility to stay within the 5-label budget               */
/* ------------------------------------------------------------------ */

function MilestoneLabel({
  milestone,
  index,
  reducedMotion,
}: {
  milestone: Milestone
  index: number
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const arcY = 0.1 + 0.2 * (1 - Math.pow((milestone.x / 5.5), 2))
  const isFinal = index === MILESTONES.length - 1

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    if (reducedMotion) {
      groupRef.current.visible = true
      return
    }

    const [start] = TIMING[index]
    const activated = cycleT >= start
    const fadeOut = cycleT > 0.9 ? 1 - rangeT(cycleT, 0.9, 1.0) : 1

    // Label budget: show the current milestone + up to 2 before it + always show EIP-8141
    // Find which milestone is currently "active" (most recently started)
    let currentActive = -1
    for (let j = MILESTONES.length - 1; j >= 0; j--) {
      if (cycleT >= TIMING[j][0]) {
        currentActive = j
        break
      }
    }

    // Visibility logic: show if this milestone is activated AND
    // it's within the last 4 activated milestones, or it's the final one
    const distFromCurrent = currentActive - index
    const withinBudget = isFinal || (distFromCurrent >= 0 && distFromCurrent < 4)

    groupRef.current.visible = activated && withinBudget && fadeOut > 0.01
  })

  return (
    <group ref={groupRef}>
      {/* Year label below sphere */}
      <Html
        center
        position={[milestone.x, arcY - 0.12, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[9px] font-mono font-bold whitespace-nowrap"
          style={{ color: milestone.color, opacity: 0.7 }}
        >
          {milestone.year}
        </p>
      </Html>
      {/* EIP name + status above sphere */}
      <Html
        center
        position={[milestone.x, arcY + 0.65, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center gap-0">
          <p
            className="text-[10px] font-bold font-mono whitespace-nowrap"
            style={{ color: milestone.color }}
          >
            {milestone.label}
          </p>
          <p
            className="text-[8px] font-medium whitespace-nowrap"
            style={{ color: milestone.color, opacity: 0.8 }}
          >
            {milestone.status}
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Ring on final milestone (EIP-8141)                          */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const finalMs = MILESTONES[MILESTONES.length - 1]
  const arcY = 0.1 + 0.2 * (1 - Math.pow((finalMs.x / 5.5), 2))

  useFrame((_, delta) => {
    if (!ringRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    if (reducedMotion) {
      ringRef.current.visible = true
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.3
      ringRef.current.scale.setScalar(1)
      return
    }

    // ACCEPT ring flashes when EIP-8141 activates (0.7-0.9)
    const [start, end] = TIMING[5]
    const inRange = cycleT >= start && cycleT < end
    const fadeOut = cycleT > 0.9 ? 1 - rangeT(cycleT, 0.9, 1.0) : 1

    if (inRange) {
      const progress = (cycleT - start) / (end - start)
      const ringScale = 0.6 + Math.sin(progress * Math.PI) * 0.8
      ringRef.current.scale.setScalar(ringScale)
      ringRef.current.visible = true
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.5 * Math.sin(progress * Math.PI) * fadeOut
      mat.emissiveIntensity = 0.6 + Math.sin(progress * Math.PI * 2) * 0.4
    } else if (cycleT >= end && fadeOut > 0.01) {
      // Hold phase: gentle pulse
      ringRef.current.visible = true
      ringRef.current.scale.setScalar(1.0 + Math.sin(elapsedRef.current * 3) * 0.05)
      const mat = ringRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.25 * fadeOut
      mat.emissiveIntensity = 0.4
    } else {
      ringRef.current.visible = false
    }
  })

  return (
    <mesh
      ref={ringRef}
      position={[finalMs.x, arcY + 0.22, 0]}
      rotation={[Math.PI / 2, 0, 0]}
      visible={false}
    >
      <torusGeometry args={[0.38, 0.03, 12, 32]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0}
        emissive={GREEN}
        emissiveIntensity={0.6}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Traveling Pulse -- a small sphere traveling along the path         */
/* ------------------------------------------------------------------ */

function TravelingPulse({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Pulse travels from first to last milestone during 0-0.9
    if (cycleT > 0.9) {
      meshRef.current.visible = false
      return
    }

    // Find which milestone we're heading toward
    let currentIdx = 0
    for (let i = MILESTONES.length - 1; i >= 0; i--) {
      if (cycleT >= TIMING[i][0]) {
        currentIdx = i
        break
      }
    }

    // Interpolate between current milestone and next
    const nextIdx = Math.min(currentIdx + 1, MILESTONES.length - 1)
    const [start] = TIMING[currentIdx]
    const [nextStart] = TIMING[nextIdx]

    let t: number
    if (currentIdx === nextIdx) {
      t = 1
    } else {
      t = clamp01((cycleT - start) / (nextStart - start))
    }

    const currentMs = MILESTONES[currentIdx]
    const nextMs = MILESTONES[nextIdx]
    const x = currentMs.x + (nextMs.x - currentMs.x) * easeInOut(t)
    const arcYCurrent = 0.1 + 0.2 * (1 - Math.pow((currentMs.x / 5.5), 2))
    const arcYNext = 0.1 + 0.2 * (1 - Math.pow((nextMs.x / 5.5), 2))
    const y = arcYCurrent + (arcYNext - arcYCurrent) * easeInOut(t)

    meshRef.current.position.set(x, y + 0.02, 0)
    meshRef.current.visible = true

    // Color changes based on current milestone
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const c = new THREE.Color(currentMs.color)
    mat.color.copy(c)
    mat.emissive.copy(c)
    mat.emissiveIntensity = 0.6 + Math.sin(elapsedRef.current * 8) * 0.3
  })

  return (
    <mesh ref={meshRef} visible={false}>
      <sphereGeometry args={[0.06, 12, 12]} />
      <meshStandardMaterial
        color={BLUE}
        emissive={BLUE}
        emissiveIntensity={0.6}
        transparent
        opacity={0.9}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Ground plane with subtle grid                                      */
/* ------------------------------------------------------------------ */

function GroundPlane() {
  return (
    <group>
      {/* Main ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[14, 5]} />
        <meshStandardMaterial color="#fafafa" roughness={0.9} />
      </mesh>
      {/* Subtle shadow under the timeline */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[12, 1.5]} />
        <meshStandardMaterial color="#f0f0f0" roughness={0.9} transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Failed</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Partial</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Success</span>
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

      {/* Ground */}
      <GroundPlane />

      {/* Timeline path */}
      <TimelinePath />
      <TimelineSegments />

      {/* Milestone spheres and labels */}
      {MILESTONES.map((ms, i) => (
        <MilestoneSphere
          key={ms.label}
          milestone={ms}
          index={i}
          reducedMotion={reducedMotion}
        />
      ))}
      {MILESTONES.map((ms, i) => (
        <MilestoneLabel
          key={`label-${ms.label}`}
          milestone={ms}
          index={i}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* ACCEPT ring on final milestone */}
      <AcceptRing reducedMotion={reducedMotion} />

      {/* Traveling pulse along the path */}
      <TravelingPulse reducedMotion={reducedMotion} />

      {/* Controls */}
      <OrbitControls
        enableZoom
        minDistance={4}
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

export function HistoryTimeline3D() {
  return (
    <SceneContainer
      height="h-[280px] md:h-[340px]"
      ariaLabel="Timeline of Ethereum account abstraction proposals from 2016 to 2026"
      srDescription="A 3D timeline showing the decade-long journey of Ethereum account abstraction. Six milestones are positioned along a horizontal path: EIP-86 (2016, failed, red), EIP-2938 (2020, failed, red), ERC-4337 (2021, shipped bundlers, amber), EIP-3074 (2023, revoked, red), EIP-7702 (2024, stopgap, amber), and EIP-8141 (2026, the answer, green). A traveling pulse moves along the path, lighting up each milestone sequentially. The final milestone glows green with an ACCEPT ring, representing the successful resolution."
      legend={<Legend />}
      fallbackText="Timeline: EIP-86 (2016, failed) → EIP-2938 (2020, failed) → ERC-4337 (2021, partial) → EIP-3074 (2023, revoked) → EIP-7702 (2024, stopgap) → EIP-8141 (2026, success)"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 3, 7], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
