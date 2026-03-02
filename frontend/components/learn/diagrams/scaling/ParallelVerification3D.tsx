'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SEQ_X = -3.2                // center of sequential side
const PAR_X = 3.2                 // center of parallel side
const CUBE_SIZE = 0.3
const LANE_COUNT = 5
const TX_COUNT = 8
const CYCLE_DURATION = 1.5        // seconds per cube step
const TOTAL_SEQ_CYCLE = TX_COUNT * CYCLE_DURATION  // 12s full sequential loop

// Lane assignments for parallel side: which lane each of the 8 tx occupies
const LANE_ASSIGN = [0, 1, 2, 3, 4, 0, 1, 2]
// Within-lane ordering (position along lane)
const LANE_ORDER = [0, 0, 0, 0, 0, 1, 1, 1]

/* ------------------------------------------------------------------ */
/*  Sequential Platform                                                */
/* ------------------------------------------------------------------ */

function SequentialPlatform() {
  return (
    <group position={[SEQ_X, 0, 0]}>
      {/* Step riser */}
      <RoundedBox args={[5.4, 0.02, 2.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Platform */}
      <RoundedBox args={[5.0, 0.06, 2.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fef2f2" roughness={0.7} />
      </RoundedBox>
      {/* Label */}
      <Html center position={[0, 1.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#ef4444' }}>Sequential</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Parallel Platform                                                  */
/* ------------------------------------------------------------------ */

function ParallelPlatform() {
  return (
    <group position={[PAR_X, 0, 0]}>
      {/* Step riser */}
      <RoundedBox args={[5.4, 0.02, 3.9]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Platform */}
      <RoundedBox args={[5.0, 0.06, 3.5]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#f0fdf4" roughness={0.7} />
      </RoundedBox>
      {/* Label */}
      <Html center position={[0, 1.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#22c55e' }}>Parallel</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[0.01, 0.3, 3.5]} radius={0.004} smoothness={4} position={[0, 0.15, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Sequential Conveyor Rail                                           */
/* ------------------------------------------------------------------ */

function SequentialRail() {
  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(SEQ_X - 2.1, 0.09, 0),
      new THREE.Vector3(SEQ_X + 2.1, 0.09, 0),
    )
    return new THREE.TubeGeometry(curve, 16, 0.015, 6, false)
  }, [])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Bottleneck Funnel                                                  */
/* ------------------------------------------------------------------ */

function BottleneckFunnel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const sx = 1.0 + Math.sin(t * 2) * 0.08
    ref.current.scale.set(sx, 1, sx)
  })

  return (
    <mesh ref={ref} position={[SEQ_X - 2.0, 0.24, 0]} rotation={[0, 0, 0]}>
      <coneGeometry args={[0.5, 0.3, 16, 1, true]} />
      <meshStandardMaterial color="#ef4444" transparent opacity={0.3} side={THREE.DoubleSide} roughness={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Sequential Transaction Cubes (animated L-to-R one at a time)       */
/* ------------------------------------------------------------------ */

function SequentialCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const cubeRefs = useRef<THREE.Group[]>([])
  const elapsedRef = useRef(0)

  const startX = -2.0
  const endX = 2.0
  const railLength = endX - startX

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % TOTAL_SEQ_CYCLE) / TOTAL_SEQ_CYCLE  // 0-1 over full cycle

    for (let i = 0; i < TX_COUNT; i++) {
      const cube = cubeRefs.current[i]
      if (!cube) continue

      // Each cube starts at its fraction of the total cycle
      const cubeStart = i / TX_COUNT
      const cubeEnd = (i + 1) / TX_COUNT
      let progress: number

      if (cycleT < cubeStart) {
        progress = 0  // waiting
      } else if (cycleT > cubeEnd) {
        progress = 1  // done
      } else {
        progress = (cycleT - cubeStart) / (cubeEnd - cubeStart)
      }

      // Ease in-out
      progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      cube.position.x = startX + progress * railLength
      cube.position.y = 0.24 + Math.sin(progress * Math.PI) * 0.05
    }
  })

  return (
    <group ref={groupRef} position={[SEQ_X, 0, 0]}>
      {Array.from({ length: TX_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={(el) => { if (el) cubeRefs.current[i] = el }}
          position={[startX, 0.24, 0]}
        >
          <RoundedBox args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} radius={0.03} smoothness={4}>
            <meshStandardMaterial color="#ef4444" roughness={0.5} />
          </RoundedBox>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Parallel Lane Rails                                                */
/* ------------------------------------------------------------------ */

function ParallelLaneRails() {
  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55

  const tubes = useMemo(() => {
    return Array.from({ length: LANE_COUNT }).map((_, i) => {
      const z = laneZ(i)
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(PAR_X - 2.1, 0.09, z),
        new THREE.Vector3(PAR_X + 2.1, 0.09, z),
      )
      return new THREE.TubeGeometry(curve, 16, 0.012, 6, false)
    })
  }, [])

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color="#22c55e" transparent opacity={0.4} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Lane Divider Markings                                              */
/* ------------------------------------------------------------------ */

function LaneDividers() {
  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55
  // Dividers between lanes
  return (
    <group position={[PAR_X, 0.082, 0]}>
      {Array.from({ length: LANE_COUNT - 1 }).map((_, i) => {
        const z = (laneZ(i) + laneZ(i + 1)) / 2
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.5, 0.002]} />
            <meshBasicMaterial color="#d4d4d8" transparent opacity={0.6} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Parallel Transaction Cubes (all lanes advance simultaneously)      */
/* ------------------------------------------------------------------ */

function ParallelCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const cubeRefs = useRef<THREE.Group[]>([])
  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55
  const elapsedRef = useRef(0)

  const startX = -2.0
  const endX = 2.0
  const railLength = endX - startX

  // How many steps each lane needs (max cubes in any lane)
  const maxLaneSteps = 2  // max 2 cubes per lane in our assignment

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const parallelCycleDuration = maxLaneSteps * CYCLE_DURATION  // 3s for parallel
    const cycleT = (t % parallelCycleDuration) / parallelCycleDuration

    for (let i = 0; i < TX_COUNT; i++) {
      const cube = cubeRefs.current[i]
      if (!cube) continue

      const lane = LANE_ASSIGN[i]
      const order = LANE_ORDER[i]

      // Each cube within its lane progresses based on its order
      const cubeStart = order / maxLaneSteps
      const cubeEnd = (order + 1) / maxLaneSteps
      let progress: number

      if (cycleT < cubeStart) {
        progress = 0
      } else if (cycleT > cubeEnd) {
        progress = 1
      } else {
        progress = (cycleT - cubeStart) / (cubeEnd - cubeStart)
      }

      progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      cube.position.x = startX + progress * railLength
      cube.position.y = 0.24 + Math.sin(progress * Math.PI) * 0.04
      cube.position.z = laneZ(lane)
    }
  })

  return (
    <group position={[PAR_X, 0, 0]}>
      {Array.from({ length: TX_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={(el) => { if (el) cubeRefs.current[i] = el }}
          position={[startX, 0.24, laneZ(LANE_ASSIGN[i])]}
        >
          <RoundedBox args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} radius={0.03} smoothness={4}>
            <meshStandardMaterial color="#22c55e" roughness={0.5} />
          </RoundedBox>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Time Rulers                                                        */
/* ------------------------------------------------------------------ */

function TimeRulers() {
  return (
    <group>
      {/* Sequential ruler (long) */}
      <group position={[SEQ_X, 0, 1.3]}>
        <RoundedBox args={[4.5, 0.01, 0.06]} radius={0.004} smoothness={4} position={[0, 0.01, 0]}>
          <meshStandardMaterial color="#ef4444" roughness={0.4} />
        </RoundedBox>
        <Html center position={[0, -0.08, 0.15]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: '#ef4444' }}>Slow</p>
        </Html>
      </group>

      {/* Parallel ruler (short) */}
      <group position={[PAR_X, 0, 2.0]}>
        <RoundedBox args={[1.8, 0.01, 0.06]} radius={0.004} smoothness={4} position={[0, 0.01, 0]}>
          <meshStandardMaterial color="#22c55e" roughness={0.4} />
        </RoundedBox>
        <Html center position={[0, -0.08, 0.15]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: '#22c55e' }}>Fast</p>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Conveyor Particles (sequential rail -- slow)                       */
/* ------------------------------------------------------------------ */

function ConveyorParticles({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(SEQ_X - 2.1, 0.09, 0),
    new THREE.Vector3(SEQ_X + 2.1, 0.09, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.1 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += 0.015
      dummy.scale.setScalar(0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Lane Particles (parallel rails -- fast, 8 per lane)                */
/* ------------------------------------------------------------------ */

function LaneParticles({ count = 40, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const perLane = count / LANE_COUNT
  const elapsedRef = useRef(0)

  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55

  const curves = useMemo(() =>
    Array.from({ length: LANE_COUNT }).map((_, i) => {
      const z = laneZ(i)
      return new THREE.LineCurve3(
        new THREE.Vector3(PAR_X - 2.1, 0.09, z),
        new THREE.Vector3(PAR_X + 2.1, 0.09, z),
      )
    }),
  [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let j = 0; j < perLane; j++) {
        const idx = lane * perLane + j
        const p = ((t * 0.2 + j / perLane) % 1)
        dummy.position.copy(curves[lane].getPoint(p))
        dummy.position.y += 0.015
        dummy.scale.setScalar(0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
        dummy.updateMatrix()
        ref.current.setMatrixAt(idx, dummy.matrix)
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Dependency Wires (amber, connecting tx that share storage slots)    */
/* ------------------------------------------------------------------ */

function DependencyWires() {
  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55

  // Connect pairs: lane 0 to lane 1, lane 2 to lane 3, lane 1 to lane 4, lane 3 to lane 0
  const pairs = useMemo(() => [
    { from: 0, to: 1 },
    { from: 2, to: 3 },
    { from: 1, to: 4 },
    { from: 3, to: 0 },
  ], [])

  const tubes = useMemo(() =>
    pairs.map(({ from, to }) => {
      const z1 = laneZ(from)
      const z2 = laneZ(to)
      const mid = new THREE.Vector3(PAR_X + 0.5, 0.35, (z1 + z2) / 2)
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(PAR_X - 0.3, 0.14, z1),
        mid,
        new THREE.Vector3(PAR_X + 1.3, 0.14, z2),
      )
      return new THREE.TubeGeometry(curve, 16, 0.005, 4, false)
    }),
  [pairs])

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color="#f59e0b" transparent opacity={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Dependency Spark Particles                                         */
/* ------------------------------------------------------------------ */

function DependencySparks({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const laneZ = (i: number) => (i - (LANE_COUNT - 1) / 2) * 0.55
  const elapsedRef = useRef(0)

  const pairs = useMemo(() => [
    { from: 0, to: 1 },
    { from: 2, to: 3 },
    { from: 1, to: 4 },
    { from: 3, to: 0 },
  ], [])

  const curves = useMemo(() =>
    pairs.map(({ from, to }) => {
      const z1 = laneZ(from)
      const z2 = laneZ(to)
      const mid = new THREE.Vector3(PAR_X + 0.5, 0.35, (z1 + z2) / 2)
      return new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(PAR_X - 0.3, 0.14, z1),
        mid,
        new THREE.Vector3(PAR_X + 1.3, 0.14, z2),
      )
    }),
  [pairs])

  const perWire = count / pairs.length

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let w = 0; w < pairs.length; w++) {
      for (let j = 0; j < perWire; j++) {
        const idx = w * perWire + j
        // Pulse: opacity modulated by traveling wave
        const p = ((t * 0.25 + j / perWire) % 1)
        dummy.position.copy(curves[w].getPoint(p))
        dummy.scale.setScalar(0.006 * (Math.sin(p * Math.PI) * 0.8 + 0.2))
        dummy.updateMatrix()
        ref.current.setMatrixAt(idx, dummy.matrix)
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Slot Color Badges (on cube faces)                                  */
/* ------------------------------------------------------------------ */

function SlotBadges({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const colorsSetRef = useRef(false)

  const slotColors = useMemo(() => {
    const colors = [
      '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e',
      '#ef4444', '#6366f1', '#ec4899', '#14b8a6',
      '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e',
      '#ef4444', '#6366f1', '#ec4899', '#14b8a6',
    ]
    const arr = new Float32Array(count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.set(colors[i % colors.length])
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [count])

  // Set color attribute once
  useEffect(() => {
    colorsSetRef.current = false
  }, [slotColors])

  useFrame((_, delta) => {
    if (!ref.current) return

    // Set colors once
    if (!colorsSetRef.current) {
      ref.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(slotColors, 3))
      colorsSetRef.current = true
    }

    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % TOTAL_SEQ_CYCLE) / TOTAL_SEQ_CYCLE

    for (let i = 0; i < count; i++) {
      const txIdx = Math.floor(i / 2)
      const badgeSide = i % 2

      const cubeStart = txIdx / TX_COUNT
      const cubeEnd = (txIdx + 1) / TX_COUNT
      let progress: number
      if (cycleT < cubeStart) progress = 0
      else if (cycleT > cubeEnd) progress = 1
      else progress = (cycleT - cubeStart) / (cubeEnd - cubeStart)
      progress = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2

      const cx = SEQ_X - 2.0 + progress * 4.0
      const cy = 0.24 + Math.sin(progress * Math.PI) * 0.05

      if (badgeSide === 0) {
        dummy.position.set(cx, cy, -CUBE_SIZE / 2 - 0.002)
      } else {
        dummy.position.set(cx + 0.06, cy + CUBE_SIZE / 2 + 0.002, 0)
      }
      dummy.scale.setScalar(0.06)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial vertexColors transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#ef4444' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Sequential</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Parallel</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Shared Slots</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function ParallelVerification3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Side-by-side comparison showing transactions processed one at a time on the left versus five parallel lanes on the right, demonstrating how access lists enable parallel execution"
      srDescription="A 3D diorama comparing sequential and parallel transaction verification. The left side shows 8 transaction cubes moving one at a time along a single conveyor rail through a bottleneck funnel. The right side shows the same 8 cubes distributed across 5 parallel lanes, all advancing simultaneously. Amber dependency wires connect lanes that share storage slots."
      legend={<Legend />}
      fallbackText="Parallel verification -- access lists enable 5 transaction lanes instead of one sequential queue"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5, 7], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platforms */}
          <SequentialPlatform />
          <ParallelPlatform />
          <Divider />

          {/* Rails */}
          <SequentialRail />
          <ParallelLaneRails />
          <LaneDividers />

          {/* Bottleneck */}
          <BottleneckFunnel reducedMotion={reducedMotion} />

          {/* Transaction cubes */}
          <SequentialCubes reducedMotion={reducedMotion} />
          <ParallelCubes reducedMotion={reducedMotion} />

          {/* Time rulers */}
          <TimeRulers />

          {/* Particles */}
          <ConveyorParticles count={16} reducedMotion={reducedMotion} />
          <LaneParticles count={40} reducedMotion={reducedMotion} />
          <DependencyWires />
          <DependencySparks count={16} reducedMotion={reducedMotion} />
          <SlotBadges count={16} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
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
