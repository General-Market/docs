'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { PlatformStage } from './shared/PlatformStage'
import { ContextDisposer } from './shared/ContextDisposer'

/* ── Constants ── */

const EXEC_Y = 0.0
const DATA_Y = 0.25
const PROOF_Y = 0.5

const EXEC_X = -3.5
const DATA_X = 0.0
const PROOF_X = 3.5

/* ── Throughput counter (large animated label on each platform) ── */

function ThroughputCounter({
  position,
  label,
  color,
}: {
  position: [number, number, number]
  label: string
  color: string
}) {
  return (
    <Html
      center
      position={position}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p
        className="text-[22px] font-bold font-mono whitespace-nowrap"
        style={{ color }}
      >
        {label}
      </p>
    </Html>
  )
}

/* ── Multiplier label between platforms ── */

function MultiplierLabel({
  position,
}: {
  position: [number, number, number]
}) {
  return (
    <Html
      center
      position={position}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p className="text-[18px] font-bold font-mono whitespace-nowrap text-green-500">
        ×10
      </p>
    </Html>
  )
}

/* ── Capacity bar gauge on each platform floor ── */

function CapacityBar({
  position,
  fillRatio,
  color,
  reducedMotion,
}: {
  position: [number, number, number]
  fillRatio: number
  color: string
  reducedMotion: boolean
}) {
  const fillRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  const barWidth = 2.0
  const barHeight = 0.06
  const barDepth = 0.3

  useFrame((_, delta) => {
    if (!reducedMotion) elapsedRef.current += delta
    if (fillRef.current) {
      const pulse = 1 + Math.sin(elapsedRef.current * 1.2) * 0.03
      fillRef.current.scale.x = reducedMotion ? 1 : pulse
    }
  })

  const fillWidth = barWidth * fillRatio

  return (
    <group position={position}>
      {/* Background bar */}
      <RoundedBox args={[barWidth, barHeight, barDepth]} radius={0.02} smoothness={4}>
        <meshStandardMaterial color="#e4e4e7" roughness={0.8} />
      </RoundedBox>

      {/* Fill bar */}
      <group ref={fillRef}>
        <RoundedBox
          args={[fillWidth, barHeight + 0.005, barDepth - 0.02]}
          radius={0.02}
          smoothness={4}
          position={[-(barWidth - fillWidth) / 2, 0.002, 0]}
        >
          <meshStandardMaterial color={color} roughness={0.5} />
        </RoundedBox>
      </group>
    </group>
  )
}

/* ── Throughput cubes (instancedMesh flowing L-to-R across platform) ── */

function ThroughputCubes({
  count,
  color,
  platformX,
  platformY,
  platformWidth,
  platformDepth,
  reducedMotion,
}: {
  count: number
  color: string
  platformX: number
  platformY: number
  platformWidth: number
  platformDepth: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const halfW = platformWidth / 2
    const halfD = platformDepth / 2
    for (let i = 0; i < count; i++) {
      const phase = i / count
      const row = i % 3
      const zOff = (row - 1) * (halfD * 0.5)
      const progress = ((t * 0.15 + phase) % 1)
      const x = platformX - halfW + progress * platformWidth
      const y = platformY + 0.08
      const z = zOff
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.08)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </instancedMesh>
  )
}

/* ── Dependency arrow (TubeGeometry on bezier) ── */

function DependencyArrow({
  start,
  end,
  color = '#a1a1aa',
  radius = 0.012,
  opacity = 1.0,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  color?: string
  radius?: number
  opacity?: number
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += 0.15
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return new THREE.TubeGeometry(curve, 24, radius, 6, false)
  }, [start, end, radius])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  )
}

/* ── Flow particles on dependency arrows ── */

function ArrowParticles({
  start,
  end,
  count,
  color = '#22c55e',
  speed = 0.12,
  reducedMotion = false,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  count: number
  color?: string
  speed?: number
  reducedMotion?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const curve = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += 0.15
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end])

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      if (reducedMotion) {
        dummy.scale.setScalar(0)
      } else {
        const p = ((t * speed + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.scale.setScalar(0.02 * Math.sin(p * Math.PI))
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ── Timeline bar with year labels ── */

function TimelineBar() {
  const years = ['2024', '2025', '2026', '2027+']
  const barWidth = 11.0
  const startX = -(barWidth / 2)

  return (
    <group position={[0, -0.1, 1.8]}>
      {/* Bar */}
      <RoundedBox args={[barWidth, 0.01, 0.1]} radius={0.005} smoothness={4}>
        <meshStandardMaterial color="#d4d4d8" roughness={0.6} />
      </RoundedBox>

      {/* Tick marks and year labels */}
      {years.map((year, i) => {
        const x = startX + (i / (years.length - 1)) * barWidth
        return (
          <group key={year} position={[x, 0, 0]}>
            {/* Tick */}
            <mesh position={[0, 0.035, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
              <meshStandardMaterial color="#a1a1aa" />
            </mesh>
            {/* Label */}
            <Html
              center
              position={[0, -0.12, 0]}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <p className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">{year}</p>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/* ── Main scene content ── */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  /* ── Platform positions ── */
  const execPos: [number, number, number] = [EXEC_X, EXEC_Y, 0]
  const dataPos: [number, number, number] = [DATA_X, DATA_Y, 0]
  const proofPos: [number, number, number] = [PROOF_X, PROOF_Y, 0]

  /* ── Dependency arrow endpoints ── */
  const depArrows = useMemo(() => [
    // Execution -> Data
    { start: new THREE.Vector3(EXEC_X + 1.75, EXEC_Y + 0.1, 0), end: new THREE.Vector3(DATA_X - 1.5, DATA_Y + 0.1, 0) },
    // Data -> Proofs
    { start: new THREE.Vector3(DATA_X + 1.5, DATA_Y + 0.1, 0), end: new THREE.Vector3(PROOF_X - 1.5, PROOF_Y + 0.1, 0) },
  ], [])

  /* ── Multiplier label positions (midpoints of dep arrows) ── */
  const multiplierPositions = useMemo(() => [
    // Between Execution -> Data arrow midpoint
    [
      (EXEC_X + 1.75 + DATA_X - 1.5) / 2,
      ((EXEC_Y + 0.1 + DATA_Y + 0.1) / 2) + 0.35,
      0,
    ] as [number, number, number],
    // Between Data -> Proofs arrow midpoint
    [
      (DATA_X + 1.5 + PROOF_X - 1.5) / 2,
      ((DATA_Y + 0.1 + PROOF_Y + 0.1) / 2) + 0.35,
      0,
    ] as [number, number, number],
  ], [])

  /* ── Cross-platform arrows ── */
  const crossArrows = useMemo(() => [
    // ePBS influences blobs (execution -> data cross)
    { start: new THREE.Vector3(EXEC_X + 0.1, EXEC_Y + 0.3, -0.3), end: new THREE.Vector3(DATA_X - 0.5, DATA_Y + 0.2, -0.3) },
    // Gas influences proofs (execution -> proofs cross)
    { start: new THREE.Vector3(EXEC_X + 0.8, EXEC_Y + 0.35, 0.3), end: new THREE.Vector3(PROOF_X - 1.0, PROOF_Y + 0.2, 0.3) },
    // Blobs feed ZK-EVM (data -> proofs cross)
    { start: new THREE.Vector3(DATA_X + 0.5, DATA_Y + 0.2, -0.3), end: new THREE.Vector3(PROOF_X - 0.8, PROOF_Y + 0.25, -0.3) },
  ], [])

  return (
    <>
      {/* Solid white floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* ── Platforms ── */}
      <PlatformStage
        position={execPos}
        width={3.5}
        depth={2.5}
        color="#dbeafe"
        label="Execution"
        labelColor="#3b82f6"
        labelSub="10-30x gas limits"
      />
      <PlatformStage
        position={dataPos}
        width={3.0}
        depth={2.5}
        color="#e0e7ff"
        label="Data"
        labelColor="#6366f1"
        stairFrom={execPos}
        stairRiserHeight={DATA_Y - EXEC_Y}
        labelSub="8 MB/sec blobs"
      />
      <PlatformStage
        position={proofPos}
        width={3.0}
        depth={2.5}
        color="#f5f3ff"
        label="Proofs"
        labelColor="#8b5cf6"
        stairFrom={dataPos}
        stairRiserHeight={PROOF_Y - DATA_Y}
        labelSub="Verify, don't re-execute"
      />

      {/* ── Throughput counters (large animated labels) ── */}
      <ThroughputCounter
        position={[EXEC_X, EXEC_Y + 0.45, 0]}
        label="15M gas"
        color="#3b82f6"
      />
      <ThroughputCounter
        position={[DATA_X, DATA_Y + 0.45, 0]}
        label="150M gas"
        color="#6366f1"
      />
      <ThroughputCounter
        position={[PROOF_X, PROOF_Y + 0.45, 0]}
        label="1.5B gas"
        color="#8b5cf6"
      />

      {/* ── Multiplier labels between platforms ── */}
      <MultiplierLabel position={multiplierPositions[0]} />
      <MultiplierLabel position={multiplierPositions[1]} />

      {/* ── Capacity bar gauges on each platform floor ── */}
      <CapacityBar
        position={[EXEC_X, EXEC_Y + 0.06, 0.6]}
        fillRatio={0.15}
        color="#3b82f6"
        reducedMotion={reducedMotion}
      />
      <CapacityBar
        position={[DATA_X, DATA_Y + 0.06, 0.6]}
        fillRatio={0.50}
        color="#6366f1"
        reducedMotion={reducedMotion}
      />
      <CapacityBar
        position={[PROOF_X, PROOF_Y + 0.06, 0.6]}
        fillRatio={1.0}
        color="#8b5cf6"
        reducedMotion={reducedMotion}
      />

      {/* ── Throughput cubes (6, 12, 24 flowing L-to-R) ── */}
      <ThroughputCubes
        count={6}
        color="#3b82f6"
        platformX={EXEC_X}
        platformY={EXEC_Y}
        platformWidth={3.5}
        platformDepth={2.5}
        reducedMotion={reducedMotion}
      />
      <ThroughputCubes
        count={12}
        color="#6366f1"
        platformX={DATA_X}
        platformY={DATA_Y}
        platformWidth={3.0}
        platformDepth={2.5}
        reducedMotion={reducedMotion}
      />
      <ThroughputCubes
        count={24}
        color="#8b5cf6"
        platformX={PROOF_X}
        platformY={PROOF_Y}
        platformWidth={3.0}
        platformDepth={2.5}
        reducedMotion={reducedMotion}
      />

      {/* ── Dependency arrows between platforms ── */}
      {depArrows.map((a, i) => (
        <group key={`dep-${i}`}>
          <DependencyArrow start={a.start} end={a.end} color="#a1a1aa" radius={0.012} />
          <ArrowParticles start={a.start} end={a.end} count={20} color="#22c55e" speed={0.12} reducedMotion={reducedMotion} />
        </group>
      ))}

      {/* ── Cross-platform arrows ── */}
      {crossArrows.map((a, i) => (
        <group key={`cross-${i}`}>
          <DependencyArrow start={a.start} end={a.end} color="#22c55e" radius={0.008} opacity={0.5} />
          <ArrowParticles start={a.start} end={a.end} count={8} color="#22c55e" speed={0.1} reducedMotion={reducedMotion} />
        </group>
      ))}

      {/* ── Timeline bar ── */}
      <TimelineBar />
    </>
  )
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-blue-400 border border-blue-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Execution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-indigo-400 border border-indigo-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-violet-400 border border-violet-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Proofs</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
        <span className="text-[10px] text-text-muted tracking-wide">×10 multiplier</span>
      </div>
    </div>
  )
}

/* ── Exported component ── */

export function RoadmapStaircase3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Three ascending platforms representing Ethereum's execution, data, and proof scaling layers, with throughput counters and capacity bars showing 10x gains at each layer"
      srDescription="A 3D diorama showing Ethereum's scaling roadmap as three ascending platforms. The execution platform shows 15M gas capacity (15% filled), the data platform shows 150M gas (50% filled), and the proofs platform shows 1.5B gas (100% filled). Each layer gains a 10x throughput multiplier, shown by green labels between platforms. Throughput cubes flow left-to-right across each platform."
      legend={<Legend />}
      fallbackText="Ethereum scaling roadmap — three ascending platforms for execution, data, and proofs"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [2, 5, 8], fov: 36 }}
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
            enableZoom minDistance={3} maxDistance={18}
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
