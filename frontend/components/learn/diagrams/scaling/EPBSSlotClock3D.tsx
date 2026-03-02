'use client'

import { useRef, useMemo, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Arc Shape Helper                                                   */
/* ------------------------------------------------------------------ */

function createArcShape(startAngle: number, endAngle: number, innerR: number, outerR: number) {
  const shape = new THREE.Shape()
  const segments = 32
  // outer arc
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (endAngle - startAngle) * (i / segments)
    const x = Math.cos(angle) * outerR
    const y = Math.sin(angle) * outerR
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  // inner arc (reverse)
  for (let i = segments; i >= 0; i--) {
    const angle = startAngle + (endAngle - startAngle) * (i / segments)
    shape.lineTo(Math.cos(angle) * innerR, Math.sin(angle) * innerR)
  }
  shape.closePath()
  return shape
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEFT_X = -2.0       // center of "Today" clock
const RIGHT_X = 2.0       // center of "With ePBS" clock
const CLOCK_Y = 0.04      // base height
const CLOCK_R = 1.2       // ring major radius
const FACE_R = 1.15       // face disk radius
const ARC_OUTER = 1.1     // arc segments outer radius
const ARC_INNER = 0.35    // arc segments inner radius (donut-style for readability)
const SWEEP_PERIOD = 12   // seconds for one full revolution (real 12s slot)

// Degree-to-radian helpers
const DEG = Math.PI / 180

// "Today" clock: 9-degree verification sliver at top (12 o'clock = PI/2)
const TODAY_VERIFY_START = 81 * DEG   // 90 - 9 = 81 degrees
const TODAY_VERIFY_END = 90 * DEG
// Dead zone: the rest (351 degrees)
const TODAY_DEAD_START = 90 * DEG
const TODAY_DEAD_END = (90 + 351) * DEG

// "ePBS" clock: Builder 100deg, Proposer 50deg, Verify 150deg, Network overhead 60deg
// Start from 12 o'clock (90 degrees in standard math coords) going counterclockwise
const EPBS_BUILD_START = 90 * DEG
const EPBS_BUILD_END = (90 + 100) * DEG
const EPBS_PROPOSE_START = EPBS_BUILD_END
const EPBS_PROPOSE_END = EPBS_PROPOSE_START + 50 * DEG
const EPBS_VERIFY_START = EPBS_PROPOSE_END
const EPBS_VERIFY_END = EPBS_VERIFY_START + 150 * DEG
const EPBS_OVERHEAD_START = EPBS_VERIFY_END
const EPBS_OVERHEAD_END = EPBS_OVERHEAD_START + 60 * DEG

/* ------------------------------------------------------------------ */
/*  Arc Segment Component                                              */
/* ------------------------------------------------------------------ */

function ArcSegment({ startAngle, endAngle, color, opacity = 1, position, glowRef }: {
  startAngle: number
  endAngle: number
  color: string
  opacity?: number
  position: [number, number, number]
  glowRef?: React.RefObject<THREE.Mesh>
}) {
  const geo = useMemo(() => {
    const shape = createArcShape(startAngle, endAngle, ARC_INNER, ARC_OUTER)
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.03,
      bevelEnabled: false,
    })
  }, [startAngle, endAngle])

  return (
    <mesh
      ref={glowRef as React.RefObject<THREE.Mesh>}
      geometry={geo}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.5} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Clock Ring                                                         */
/* ------------------------------------------------------------------ */

function ClockRing({ position }: { position: [number, number, number] }) {
  const geo = useMemo(() => new THREE.TorusGeometry(CLOCK_R, 0.04, 16, 64), [])
  return (
    <mesh geometry={geo} position={[position[0], position[1] + 0.04, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Clock Face Disk                                                    */
/* ------------------------------------------------------------------ */

function ClockFace({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={[position[0], position[1] + 0.01, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[FACE_R, FACE_R, 0.02, 64]} />
      <meshStandardMaterial color="#fafafa" roughness={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Sweep Hand                                                         */
/* ------------------------------------------------------------------ */

function SweepHand({ center, color, reducedMotion }: {
  center: [number, number, number]
  color: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const angle = -(t / SWEEP_PERIOD) * Math.PI * 2
    ref.current.rotation.y = angle
  })

  return (
    <group ref={ref} position={[center[0], center[1] + 0.06, center[2]]}>
      {/* Hand extends from center outward in +Z direction */}
      <RoundedBox args={[0.03, 0.015, 1.0]} radius={0.006} smoothness={4} position={[0, 0, 0.45]}>
        <meshStandardMaterial color={color} roughness={0.3} />
      </RoundedBox>
      {/* Center pivot dot */}
      <mesh>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Hour Tick Marks (instancedMesh -- 12 per clock, 24 total)          */
/* ------------------------------------------------------------------ */

function HourTicks({ count = 24 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const initializedRef = useRef(false)

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mats: THREE.Matrix4[] = []
    const centers = [
      [LEFT_X, CLOCK_Y],
      [RIGHT_X, CLOCK_Y],
    ] as [number, number][]

    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2
        const x = centers[c][0] + Math.cos(angle) * (CLOCK_R - 0.08)
        const z = centers[c][1] + Math.sin(angle) * (CLOCK_R - 0.08)
        dummy.position.set(x, 0.065, z)
        dummy.scale.set(1, 1, 1)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        mats.push(dummy.matrix.clone())
      }
    }
    return mats
  }, [])

  // Set matrices once when mesh is available
  useEffect(() => {
    initializedRef.current = false
  }, [matrices])

  useFrame(() => {
    if (initializedRef.current || !ref.current) return
    for (let i = 0; i < count; i++) {
      ref.current.setMatrixAt(i, matrices[i])
    }
    ref.current.instanceMatrix.needsUpdate = true
    initializedRef.current = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <cylinderGeometry args={[0.006, 0.006, 0.05, 6]} />
      <meshStandardMaterial color="#71717a" roughness={0.4} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Today Clock (left side)                                            */
/* ------------------------------------------------------------------ */

function TodayClock({ reducedMotion }: { reducedMotion: boolean }) {
  const veriRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  // Pre-create colors
  const redColor = useMemo(() => new THREE.Color('#ef4444'), [])
  const blackColor = useMemo(() => new THREE.Color('#000000'), [])

  useFrame((_, delta) => {
    if (!veriRef.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const handAngle = ((t / SWEEP_PERIOD) * 360) % 360
    const slitStart = 81
    const slitEnd = 90
    const mat = veriRef.current.material as THREE.MeshStandardMaterial
    if (handAngle >= slitStart && handAngle <= slitEnd) {
      mat.emissiveIntensity = 0.8
      mat.emissive.copy(redColor)
    } else {
      mat.emissiveIntensity = 0
      mat.emissive.copy(blackColor)
    }
  })

  return (
    <group>
      {/* Step riser */}
      <RoundedBox args={[2.8, 0.02, 2.8]} radius={0.008} smoothness={4} position={[LEFT_X, 0.01, CLOCK_Y]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>

      {/* Clock face */}
      <ClockFace position={[LEFT_X, 0, CLOCK_Y]} />
      {/* Clock ring */}
      <ClockRing position={[LEFT_X, 0, CLOCK_Y]} />

      {/* Dead zone (351 degrees) */}
      <ArcSegment
        startAngle={TODAY_DEAD_START}
        endAngle={TODAY_DEAD_END}
        color="#f4f4f5"
        position={[LEFT_X, 0.025, CLOCK_Y]}
      />

      {/* Verification sliver (9 degrees) */}
      <ArcSegment
        startAngle={TODAY_VERIFY_START}
        endAngle={TODAY_VERIFY_END}
        color="#ef4444"
        position={[LEFT_X, 0.025, CLOCK_Y]}
        glowRef={veriRef}
      />

      {/* Sweep hand */}
      <SweepHand center={[LEFT_X, 0, CLOCK_Y]} color="#ef4444" reducedMotion={reducedMotion} />

      {/* Label: "Today" */}
      <Html center position={[LEFT_X, 0.8, CLOCK_Y - 1.6]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#ef4444' }}>Today</p>
      </Html>

      {/* Utilization percentage */}
      <Html center position={[LEFT_X, 0, CLOCK_Y + 1.7]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[12px] font-bold font-mono whitespace-nowrap" style={{ color: '#ef4444' }}>2.5%</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ePBS Clock (right side)                                            */
/* ------------------------------------------------------------------ */

function EPBSClock({ reducedMotion }: { reducedMotion: boolean }) {
  const buildRef = useRef<THREE.Mesh>(null!)
  const proposeRef = useRef<THREE.Mesh>(null!)
  const verifyRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  // Pre-create colors
  const segmentColors = useMemo(() => ({
    blue: new THREE.Color('#3b82f6'),
    amber: new THREE.Color('#f59e0b'),
    green: new THREE.Color('#22c55e'),
    black: new THREE.Color('#000000'),
  }), [])

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const handAngle = ((t / SWEEP_PERIOD) * 360) % 360

    const segments = [
      { ref: buildRef, start: 90, end: 190, color: segmentColors.blue },
      { ref: proposeRef, start: 190, end: 240, color: segmentColors.amber },
      { ref: verifyRef, start: 240, end: 390, color: segmentColors.green },
    ]

    for (const seg of segments) {
      if (!seg.ref.current) continue
      const mat = seg.ref.current.material as THREE.MeshStandardMaterial

      let inRange: boolean
      if (seg.end > 360) {
        // Handle wrap-around: in range if angle >= start OR angle < (end % 360)
        inRange = handAngle >= (seg.start % 360) || handAngle < (seg.end % 360)
      } else {
        inRange = handAngle >= seg.start && handAngle < seg.end
      }

      if (inRange) {
        mat.emissiveIntensity = 0.4
        mat.emissive.copy(seg.color)
      } else {
        mat.emissiveIntensity = 0
        mat.emissive.copy(segmentColors.black)
      }
    }
  })

  // Midpoint angles for label positioning
  const labelR = 0.7
  const buildMid = (EPBS_BUILD_START + EPBS_BUILD_END) / 2
  const proposeMid = (EPBS_PROPOSE_START + EPBS_PROPOSE_END) / 2
  const verifyMid = (EPBS_VERIFY_START + EPBS_VERIFY_END) / 2

  return (
    <group>
      {/* Step riser */}
      <RoundedBox args={[2.8, 0.02, 2.8]} radius={0.008} smoothness={4} position={[RIGHT_X, 0.01, CLOCK_Y]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>

      {/* Clock face */}
      <ClockFace position={[RIGHT_X, 0, CLOCK_Y]} />
      {/* Clock ring */}
      <ClockRing position={[RIGHT_X, 0, CLOCK_Y]} />

      {/* Builder segment (100 degrees) */}
      <ArcSegment
        startAngle={EPBS_BUILD_START}
        endAngle={EPBS_BUILD_END}
        color="#3b82f6"
        position={[RIGHT_X, 0.025, CLOCK_Y]}
        glowRef={buildRef}
      />

      {/* Proposer segment (50 degrees) */}
      <ArcSegment
        startAngle={EPBS_PROPOSE_START}
        endAngle={EPBS_PROPOSE_END}
        color="#f59e0b"
        position={[RIGHT_X, 0.025, CLOCK_Y]}
        glowRef={proposeRef}
      />

      {/* Verification segment (150 degrees) */}
      <ArcSegment
        startAngle={EPBS_VERIFY_START}
        endAngle={EPBS_VERIFY_END}
        color="#22c55e"
        position={[RIGHT_X, 0.025, CLOCK_Y]}
        glowRef={verifyRef}
      />

      {/* Network overhead gap (60 degrees) */}
      <ArcSegment
        startAngle={EPBS_OVERHEAD_START}
        endAngle={EPBS_OVERHEAD_END}
        color="#f4f4f5"
        position={[RIGHT_X, 0.025, CLOCK_Y]}
      />

      {/* Sweep hand */}
      <SweepHand center={[RIGHT_X, 0, CLOCK_Y]} color="#22c55e" reducedMotion={reducedMotion} />

      {/* Segment labels inside arcs */}
      <Html center position={[RIGHT_X + Math.cos(buildMid) * labelR, 0.12, CLOCK_Y + Math.sin(buildMid) * labelR]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-semibold whitespace-nowrap" style={{ color: '#3b82f6' }}>Build</p>
      </Html>
      <Html center position={[RIGHT_X + Math.cos(proposeMid) * labelR, 0.12, CLOCK_Y + Math.sin(proposeMid) * labelR]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-semibold whitespace-nowrap" style={{ color: '#f59e0b' }}>Propose</p>
      </Html>
      <Html center position={[RIGHT_X + Math.cos(verifyMid) * labelR, 0.12, CLOCK_Y + Math.sin(verifyMid) * labelR]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-semibold whitespace-nowrap" style={{ color: '#22c55e' }}>Verify</p>
      </Html>

      {/* Label: "With ePBS" */}
      <Html center position={[RIGHT_X, 0.8, CLOCK_Y - 1.6]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#22c55e' }}>With ePBS</p>
      </Html>

      {/* Utilization percentage: 100+50+150 = 300 out of 360 = ~83% */}
      <Html center position={[RIGHT_X, 0, CLOCK_Y + 1.7]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[12px] font-bold font-mono whitespace-nowrap" style={{ color: '#22c55e' }}>~83%</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider between clocks                                             */
/* ------------------------------------------------------------------ */

function ClockDivider() {
  return (
    <RoundedBox args={[0.01, 0.3, 3.5]} radius={0.004} smoothness={4} position={[0, 0.15, CLOCK_Y]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
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
        <span className="text-[10px] text-text-muted tracking-wide">Verification (Today)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Build</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Propose</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Verify</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function EPBSSlotClock3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Two clock faces comparing Ethereum slot time utilization. Today's clock shows 97.5% grey wasted time with a tiny red verification sliver. The ePBS clock shows three colored segments for builder, proposer, and verifier roles using about 83% of the slot."
      srDescription="A 3D diorama with two clock faces. The left clock represents today's Ethereum slot: 97.5% is a grey dead zone with only a tiny 9-degree red sliver for verification. The right clock shows ePBS: a 100-degree blue builder segment, a 50-degree amber proposer segment, a 150-degree green verification segment, and a 60-degree grey overhead gap, using approximately 83% of the slot productively."
      legend={<Legend />}
      fallbackText="ePBS slot utilization -- from 2.5% verification-only to ~83% productive use"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 6, 5], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Clocks */}
          <TodayClock reducedMotion={reducedMotion} />
          <EPBSClock reducedMotion={reducedMotion} />
          <ClockDivider />

          {/* Hour tick marks (24 total -- 12 per clock) */}
          <HourTicks count={24} />

          <OrbitControls
            enableZoom={false}
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
