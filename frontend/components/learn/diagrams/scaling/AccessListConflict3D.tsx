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

const TX_COUNT = 8
const LANE_COUNT = 4
const CUBE_SIZE = 0.32
const CYCLE = 10 // total animation cycle in seconds

// Phase boundaries (seconds)
const PHASE1_END = 3   // cubes appear
const PHASE2_END = 6   // conflict wires animate
const PHASE3_END = 10  // cubes slide into lanes

// Zone X positions
const LEFT_X = -3.5
const CENTER_X = 0
const RIGHT_X = 3.5

// Slot names mapped to unique IDs for coloring
const SLOTS = {
  A: 0, B: 1, C: 2, D: 3, E: 4, F: 5, G: 6, H: 7, I: 8, J: 9, K: 10, L: 11, M: 12,
} as const

// Transaction definitions
const TX_DEFS: { reads: number[]; writes: number[]; lane: number }[] = [
  { reads: [SLOTS.A, SLOTS.B], writes: [SLOTS.C], lane: 0 },       // TX 0
  { reads: [SLOTS.D],          writes: [SLOTS.E], lane: 1 },       // TX 1
  { reads: [SLOTS.A],          writes: [SLOTS.F], lane: 2 },       // TX 2
  { reads: [SLOTS.G],          writes: [SLOTS.C], lane: 0 },       // TX 3 conflicts TX0 on write C
  { reads: [SLOTS.H],          writes: [SLOTS.I], lane: 3 },       // TX 4
  { reads: [SLOTS.D],          writes: [SLOTS.J], lane: 1 },       // TX 5 conflicts TX1 on D
  { reads: [SLOTS.K],          writes: [SLOTS.L], lane: 2 },       // TX 6
  { reads: [SLOTS.G],          writes: [SLOTS.M], lane: 3 },       // TX 7
]

// Conflict pairs: pairs of TX indices that conflict
const CONFLICT_PAIRS: [number, number][] = [
  [0, 3], // both write C
  [1, 5], // both access D
]

// Colors
const COL_READ = '#3b82f6'
const COL_WRITE = '#ef4444'
const COL_CONFLICT = '#f59e0b'
const COL_LANE = '#22c55e'
const COL_TX_IDLE = '#94a3b8'   // slate-400 for cubes before sorting
const COL_TX_SORTED = '#22c55e' // green when in lanes

// Vertical stack positions for left zone (bottom to top)
function txStackY(i: number): number {
  return -1.2 + i * 0.38
}

// Lane Z positions (4 lanes spread on Z)
function laneZ(i: number): number {
  return (i - (LANE_COUNT - 1) / 2) * 0.7
}

// Within each lane, order cubes by their position in the lane
function laneOrder(txIdx: number): number {
  const lane = TX_DEFS[txIdx].lane
  let order = 0
  for (let i = 0; i < txIdx; i++) {
    if (TX_DEFS[i].lane === lane) order++
  }
  return order
}

/* ------------------------------------------------------------------ */
/*  Easing                                                             */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/* ------------------------------------------------------------------ */
/*  Left Zone Platform                                                 */
/* ------------------------------------------------------------------ */

function LeftPlatform() {
  return (
    <group position={[LEFT_X, -1.6, 0]}>
      <RoundedBox args={[2.0, 0.04, 4.0]} radius={0.015} smoothness={4}>
        <meshStandardMaterial color="#f8fafc" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 0.2, -2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: '#64748b' }}>
          Transactions
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Center Zone Platform                                               */
/* ------------------------------------------------------------------ */

function CenterPlatform() {
  return (
    <group position={[CENTER_X, -1.6, 0]}>
      <RoundedBox args={[2.8, 0.04, 4.0]} radius={0.015} smoothness={4}>
        <meshStandardMaterial color="#fffbeb" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 0.2, -2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: COL_CONFLICT }}>
          Conflict Detection
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Zone Platform                                                */
/* ------------------------------------------------------------------ */

function RightPlatform() {
  return (
    <group position={[RIGHT_X, -1.6, 0]}>
      <RoundedBox args={[2.4, 0.04, 4.0]} radius={0.015} smoothness={4}>
        <meshStandardMaterial color="#f0fdf4" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 0.2, -2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: COL_LANE }}>
          Parallel Lanes
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Lane Rails (right zone)                                            */
/* ------------------------------------------------------------------ */

function LaneRails() {
  const tubes = useMemo(() => {
    return Array.from({ length: LANE_COUNT }).map((_, i) => {
      const z = laneZ(i)
      const curve = new THREE.LineCurve3(
        new THREE.Vector3(RIGHT_X - 1.0, -1.58, z),
        new THREE.Vector3(RIGHT_X + 1.0, -1.58, z),
      )
      return new THREE.TubeGeometry(curve, 16, 0.012, 6, false)
    })
  }, [])

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh key={i} geometry={geo}>
          <meshStandardMaterial color={COL_LANE} transparent opacity={0.35} roughness={0.3} />
        </mesh>
      ))}
      {/* Lane number labels */}
      {Array.from({ length: LANE_COUNT }).map((_, i) => (
        <Html
          key={`label-${i}`}
          center
          position={[RIGHT_X + 1.2, -1.55, laneZ(i)]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: COL_LANE }}>
            L{i}
          </p>
        </Html>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Lane Dividers (right zone)                                         */
/* ------------------------------------------------------------------ */

function LaneDividers() {
  return (
    <group position={[RIGHT_X, -1.58, 0]}>
      {Array.from({ length: LANE_COUNT - 1 }).map((_, i) => {
        const z = (laneZ(i) + laneZ(i + 1)) / 2
        return (
          <mesh key={i} position={[0, 0, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.0, 0.002]} />
            <meshBasicMaterial color="#d4d4d8" transparent opacity={0.5} />
          </mesh>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Timing Labels                                                      */
/* ------------------------------------------------------------------ */

function TimingLabels() {
  return (
    <group>
      {/* Single lane timing */}
      <Html
        center
        position={[RIGHT_X, -1.8, laneZ(0)]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: '#ef4444' }}>
            1 lane = 800ms
          </p>
        </div>
      </Html>
      {/* Four lanes timing */}
      <Html
        center
        position={[RIGHT_X, -1.8, (laneZ(0) + laneZ(3)) / 2]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center mt-3.5">
          <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: COL_LANE }}>
            4 lanes = 200ms
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Transaction Cubes (animated through all 3 phases)                  */
/* ------------------------------------------------------------------ */

function TransactionCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const cubeRefs = useRef<THREE.Group[]>([])
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const elapsedRef = useRef(0)

  // Pre-compute final positions for each TX in the right zone
  const finalPositions = useMemo(() => {
    return TX_DEFS.map((def, i) => {
      const order = laneOrder(i)
      return new THREE.Vector3(
        RIGHT_X - 0.5 + order * 0.55,
        -1.55 + CUBE_SIZE / 2 + 0.02,
        laneZ(def.lane),
      )
    })
  }, [])

  // Start positions in left zone
  const startPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(LEFT_X, txStackY(i), 0)
    })
  }, [])

  // Center positions (during conflict detection)
  const centerPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(CENTER_X - 0.6 + (i % 4) * 0.45, txStackY(Math.floor(i / 4) * 4 + (i % 4)) * 0.6, (i < 4 ? -0.3 : 0.3))
    })
  }, [])

  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = reducedMotion ? CYCLE : (elapsedRef.current % CYCLE)

    for (let i = 0; i < TX_COUNT; i++) {
      const cube = cubeRefs.current[i]
      const mat = matRefs.current[i]
      if (!cube || !mat) continue

      if (t <= PHASE1_END) {
        // Phase 1: appear one by one on the left
        const txAppearTime = (i / TX_COUNT) * PHASE1_END
        const visible = t >= txAppearTime
        cube.visible = visible
        if (visible) {
          const localT = Math.min((t - txAppearTime) / 0.3, 1)
          const scale = easeInOut(localT)
          cube.scale.setScalar(scale)
          cube.position.copy(startPositions[i])
        }
        tmpColor.set(COL_TX_IDLE)
        mat.color.copy(tmpColor)
      } else if (t <= PHASE2_END) {
        // Phase 2: cubes move to center zone
        cube.visible = true
        cube.scale.setScalar(1)
        const phaseProgress = easeInOut(Math.min((t - PHASE1_END) / 1.5, 1))
        cube.position.lerpVectors(startPositions[i], centerPositions[i], phaseProgress)
        tmpColor.set(COL_TX_IDLE)
        mat.color.copy(tmpColor)
      } else {
        // Phase 3: cubes slide to assigned lanes
        cube.visible = true
        cube.scale.setScalar(1)
        const phaseProgress = easeInOut(Math.min((t - PHASE2_END) / 2.5, 1))
        cube.position.lerpVectors(centerPositions[i], finalPositions[i], phaseProgress)

        // Color transition: idle -> lane green
        tmpColor.set(COL_TX_IDLE)
        const targetColor = new THREE.Color(COL_TX_SORTED)
        tmpColor.lerp(targetColor, phaseProgress)
        mat.color.copy(tmpColor)
      }
    }
  })

  return (
    <group>
      {Array.from({ length: TX_COUNT }).map((_, i) => (
        <group
          key={i}
          ref={(el) => { if (el) cubeRefs.current[i] = el }}
          position={[LEFT_X, txStackY(i), 0]}
          visible={reducedMotion}
        >
          <RoundedBox args={[CUBE_SIZE, CUBE_SIZE, CUBE_SIZE]} radius={0.03} smoothness={4}>
            <meshStandardMaterial
              ref={(el) => { if (el) matRefs.current[i] = el }}
              color={reducedMotion ? COL_TX_SORTED : COL_TX_IDLE}
              roughness={0.5}
            />
          </RoundedBox>
          {/* TX label on cube */}
          <Html
            center
            position={[0, 0, CUBE_SIZE / 2 + 0.01]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <p className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: '#ffffff' }}>
              T{i}
            </p>
          </Html>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Slot Dots (instanced mesh — read=blue, write=red on cube faces)    */
/* ------------------------------------------------------------------ */

function SlotDots({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const colorsSetRef = useRef(false)

  // Build dot definitions: for each TX, list read dots then write dots
  const dotDefs = useMemo(() => {
    const defs: { txIdx: number; isWrite: boolean; localOffset: number; total: number }[] = []
    for (let i = 0; i < TX_COUNT; i++) {
      const tx = TX_DEFS[i]
      const total = tx.reads.length + tx.writes.length
      let offset = 0
      for (let r = 0; r < tx.reads.length; r++) {
        defs.push({ txIdx: i, isWrite: false, localOffset: offset, total })
        offset++
      }
      for (let w = 0; w < tx.writes.length; w++) {
        defs.push({ txIdx: i, isWrite: true, localOffset: offset, total })
        offset++
      }
    }
    return defs
  }, [])

  const count = dotDefs.length // should be 19

  // Pre-build color buffer
  const colorArray = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      c.set(dotDefs[i].isWrite ? COL_WRITE : COL_READ)
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [count, dotDefs])

  // Start positions in left zone
  const startPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => new THREE.Vector3(LEFT_X, txStackY(i), 0))
  }, [])

  const centerPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(CENTER_X - 0.6 + (i % 4) * 0.45, txStackY(Math.floor(i / 4) * 4 + (i % 4)) * 0.6, (i < 4 ? -0.3 : 0.3))
    })
  }, [])

  const finalPositions = useMemo(() => {
    return TX_DEFS.map((def, i) => {
      const order = laneOrder(i)
      return new THREE.Vector3(
        RIGHT_X - 0.5 + order * 0.55,
        -1.55 + CUBE_SIZE / 2 + 0.02,
        laneZ(def.lane),
      )
    })
  }, [])

  useEffect(() => {
    colorsSetRef.current = false
  }, [colorArray])

  useFrame((_, delta) => {
    if (!ref.current) return

    if (!colorsSetRef.current) {
      ref.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorArray, 3))
      colorsSetRef.current = true
    }

    elapsedRef.current += delta
    const t = reducedMotion ? CYCLE : (elapsedRef.current % CYCLE)

    for (let d = 0; d < count; d++) {
      const { txIdx, localOffset, total } = dotDefs[d]

      // Compute cube position based on phase
      let cubePos: THREE.Vector3
      if (t <= PHASE1_END) {
        const txAppearTime = (txIdx / TX_COUNT) * PHASE1_END
        const visible = t >= txAppearTime
        if (!visible) {
          dummy.position.set(0, -100, 0) // hide
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          ref.current.setMatrixAt(d, dummy.matrix)
          continue
        }
        cubePos = startPositions[txIdx]
      } else if (t <= PHASE2_END) {
        const phaseProgress = easeInOut(Math.min((t - PHASE1_END) / 1.5, 1))
        cubePos = new THREE.Vector3().lerpVectors(startPositions[txIdx], centerPositions[txIdx], phaseProgress)
      } else {
        const phaseProgress = easeInOut(Math.min((t - PHASE2_END) / 2.5, 1))
        cubePos = new THREE.Vector3().lerpVectors(centerPositions[txIdx], finalPositions[txIdx], phaseProgress)
      }

      // Position dots on the front face (+Z) of the cube, arranged horizontally
      const spacing = 0.09
      const startOffset = -(total - 1) * spacing / 2
      const dotX = cubePos.x + startOffset + localOffset * spacing
      const dotY = cubePos.y + CUBE_SIZE / 2 + 0.03
      const dotZ = cubePos.z

      dummy.position.set(dotX, dotY, dotZ)
      dummy.scale.setScalar(0.035)
      dummy.updateMatrix()
      ref.current.setMatrixAt(d, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial vertexColors />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Conflict Wires (amber bezier curves between conflicting TX pairs)  */
/* ------------------------------------------------------------------ */

function ConflictWires({ reducedMotion }: { reducedMotion: boolean }) {
  const wiresRef = useRef<THREE.Mesh[]>([])
  const matRefs = useRef<THREE.MeshStandardMaterial[]>([])
  const elapsedRef = useRef(0)

  // Center positions for conflict lines
  const centerPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(CENTER_X - 0.6 + (i % 4) * 0.45, txStackY(Math.floor(i / 4) * 4 + (i % 4)) * 0.6, (i < 4 ? -0.3 : 0.3))
    })
  }, [])

  const tubes = useMemo(() => {
    return CONFLICT_PAIRS.map(([a, b]) => {
      const posA = centerPositions[a]
      const posB = centerPositions[b]
      const mid = new THREE.Vector3(
        (posA.x + posB.x) / 2,
        Math.max(posA.y, posB.y) + 0.3,
        (posA.z + posB.z) / 2,
      )
      const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB)
      return new THREE.TubeGeometry(curve, 24, 0.012, 6, false)
    })
  }, [centerPositions])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = reducedMotion ? PHASE2_END : (elapsedRef.current % CYCLE)

    for (let i = 0; i < CONFLICT_PAIRS.length; i++) {
      const mat = matRefs.current[i]
      if (!mat) continue

      if (t > PHASE1_END && t <= PHASE3_END) {
        // Visible during phases 2 and early phase 3
        const fadeIn = Math.min((t - PHASE1_END) / 0.8, 1)
        const fadeOut = t > PHASE2_END ? Math.max(1 - (t - PHASE2_END) / 2, 0) : 1
        // Pulsing effect
        const pulse = 0.6 + 0.4 * Math.sin(t * 4 + i * 1.5)
        mat.opacity = fadeIn * fadeOut * pulse
      } else if (reducedMotion) {
        mat.opacity = 0.7
      } else {
        mat.opacity = 0
      }
    }
  })

  return (
    <group>
      {tubes.map((geo, i) => (
        <mesh
          key={i}
          geometry={geo}
          ref={(el) => { if (el) wiresRef.current[i] = el }}
        >
          <meshStandardMaterial
            ref={(el) => { if (el) matRefs.current[i] = el }}
            color={COL_CONFLICT}
            transparent
            opacity={0}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Conflict Wire Spark Particles (instanced)                          */
/* ------------------------------------------------------------------ */

function ConflictSparks({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const perWire = 10
  const count = CONFLICT_PAIRS.length * perWire // 20

  const centerPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(CENTER_X - 0.6 + (i % 4) * 0.45, txStackY(Math.floor(i / 4) * 4 + (i % 4)) * 0.6, (i < 4 ? -0.3 : 0.3))
    })
  }, [])

  const curves = useMemo(() => {
    return CONFLICT_PAIRS.map(([a, b]) => {
      const posA = centerPositions[a]
      const posB = centerPositions[b]
      const mid = new THREE.Vector3(
        (posA.x + posB.x) / 2,
        Math.max(posA.y, posB.y) + 0.3,
        (posA.z + posB.z) / 2,
      )
      return new THREE.QuadraticBezierCurve3(posA, mid, posB)
    })
  }, [centerPositions])

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? PHASE2_END : (elapsedRef.current % CYCLE)

    const active = t > PHASE1_END && t <= PHASE3_END

    for (let w = 0; w < CONFLICT_PAIRS.length; w++) {
      for (let j = 0; j < perWire; j++) {
        const idx = w * perWire + j
        if (!active) {
          dummy.position.set(0, -100, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          ref.current.setMatrixAt(idx, dummy.matrix)
          continue
        }
        const p = ((t * 0.3 + j / perWire) % 1)
        dummy.position.copy(curves[w].getPoint(p))
        dummy.scale.setScalar(0.015 * (Math.sin(p * Math.PI) * 0.8 + 0.2))
        dummy.updateMatrix()
        ref.current.setMatrixAt(idx, dummy.matrix)
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={COL_CONFLICT} transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Conflict Labels ("write C", "access D")                            */
/* ------------------------------------------------------------------ */

function ConflictLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const group0Ref = useRef<THREE.Group>(null!)
  const group1Ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const centerPositions = useMemo(() => {
    return TX_DEFS.map((_, i) => {
      return new THREE.Vector3(CENTER_X - 0.6 + (i % 4) * 0.45, txStackY(Math.floor(i / 4) * 4 + (i % 4)) * 0.6, (i < 4 ? -0.3 : 0.3))
    })
  }, [])

  // Label positions: midpoint of each conflict pair, raised
  const labelPositions = useMemo(() => {
    return CONFLICT_PAIRS.map(([a, b]) => {
      const posA = centerPositions[a]
      const posB = centerPositions[b]
      return new THREE.Vector3(
        (posA.x + posB.x) / 2,
        Math.max(posA.y, posB.y) + 0.45,
        (posA.z + posB.z) / 2,
      )
    })
  }, [centerPositions])

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = reducedMotion ? PHASE2_END : (elapsedRef.current % CYCLE)
    const visible = t > PHASE1_END + 0.5 && t <= PHASE2_END + 1.5

    if (group0Ref.current) group0Ref.current.visible = visible || reducedMotion
    if (group1Ref.current) group1Ref.current.visible = visible || reducedMotion
  })

  return (
    <group>
      <group ref={group0Ref} position={[labelPositions[0].x, labelPositions[0].y, labelPositions[0].z]} visible={reducedMotion}>
        <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300">
            <p className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: COL_CONFLICT }}>
              write C
            </p>
          </div>
        </Html>
      </group>
      <group ref={group1Ref} position={[labelPositions[1].x, labelPositions[1].y, labelPositions[1].z]} visible={reducedMotion}>
        <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-300">
            <p className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: COL_CONFLICT }}>
              access D
            </p>
          </div>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Arrow Indicators (left -> center -> right)                         */
/* ------------------------------------------------------------------ */

function FlowArrows() {
  const arrowGeo = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(0, 0.06)
    shape.lineTo(0.15, 0)
    shape.lineTo(0, -0.06)
    shape.closePath()
    const extrudeSettings = { depth: 0.02, bevelEnabled: false }
    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [])

  return (
    <group>
      {/* Left -> Center arrow */}
      <mesh geometry={arrowGeo} position={[-1.8, -0.3, 0]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
      </mesh>
      {/* Center -> Right arrow */}
      <mesh geometry={arrowGeo} position={[1.6, -0.3, 0]} rotation={[0, 0, 0]}>
        <meshStandardMaterial color="#cbd5e1" roughness={0.5} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Lane Glow Particles (instanced, flowing along lane rails)          */
/* ------------------------------------------------------------------ */

function LaneParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const perLane = 6
  const count = LANE_COUNT * perLane // 24

  const curves = useMemo(() =>
    Array.from({ length: LANE_COUNT }).map((_, i) => {
      const z = laneZ(i)
      return new THREE.LineCurve3(
        new THREE.Vector3(RIGHT_X - 1.0, -1.56, z),
        new THREE.Vector3(RIGHT_X + 1.0, -1.56, z),
      )
    }),
  [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (elapsedRef.current % CYCLE)
    // Only show particles during phase 3
    const active = cycleT > PHASE2_END

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      for (let j = 0; j < perLane; j++) {
        const idx = lane * perLane + j
        if (!active) {
          dummy.position.set(0, -100, 0)
          dummy.scale.setScalar(0)
          dummy.updateMatrix()
          ref.current.setMatrixAt(idx, dummy.matrix)
          continue
        }
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
      <meshBasicMaterial color={COL_LANE} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COL_READ }} />
        <span className="text-[10px] text-text-muted tracking-wide">Read slot</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COL_WRITE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Write slot</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_CONFLICT }} />
        <span className="text-[10px] text-text-muted tracking-wide">Conflict</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_LANE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Parallel Lane</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function AccessListConflict3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="3D visualization showing how transactions declare storage slots, detect conflicts, and get sorted into parallel execution lanes"
      srDescription="A 3D scene with three zones flowing left to right. On the left, 8 transaction cubes appear in a vertical stack, each decorated with colored dots representing read (blue) and write (red) storage slots. In the center, amber conflict wires pulse between transactions that share write slots: TX0 and TX3 both write slot C, TX1 and TX5 both access slot D. On the right, 4 parallel lanes receive the sorted transactions: conflicting transactions share a lane for serial execution while non-conflicting ones spread across lanes for parallel execution. Labels show 1 lane takes 800ms versus 4 lanes taking 200ms."
      legend={<Legend />}
      fallbackText="Access list conflict detection -- transactions declare storage slots and get sorted into parallel lanes based on conflicts"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 3, 9], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platforms */}
          <LeftPlatform />
          <CenterPlatform />
          <RightPlatform />

          {/* Flow arrows */}
          <FlowArrows />

          {/* Lane infrastructure */}
          <LaneRails />
          <LaneDividers />

          {/* Transaction cubes (animated through all phases) */}
          <TransactionCubes reducedMotion={reducedMotion} />

          {/* Slot dots on cubes */}
          <SlotDots reducedMotion={reducedMotion} />

          {/* Conflict wires and sparks */}
          <ConflictWires reducedMotion={reducedMotion} />
          <ConflictSparks reducedMotion={reducedMotion} />
          <ConflictLabels reducedMotion={reducedMotion} />

          {/* Lane particles */}
          <LaneParticles reducedMotion={reducedMotion} />

          {/* Timing labels */}
          <TimingLabels />

          <OrbitControls
            enableZoom minDistance={3} maxDistance={18}
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
