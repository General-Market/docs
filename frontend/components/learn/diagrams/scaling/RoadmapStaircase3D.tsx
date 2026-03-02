'use client'

import { useRef, useMemo, useState } from 'react'
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

/* ── Initiative object: Access Lists funnel ── */

function ALFunnel({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Step riser */}
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.25, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Inverted cone (funnel) */}
      <mesh
        rotation={[Math.PI, 0, 0]}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <coneGeometry args={[0.35, 0.5, 16, 1, true]} />
        <meshStandardMaterial
          color={hovered ? '#ffffff' : '#3b82f6'}
          roughness={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Bottom cap */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, (hovered ? 0.04 : 0) + 0.25, 0]}
      >
        <circleGeometry args={[0.35, 16]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : '#3b82f6'} roughness={0.5} />
      </mesh>
      <Html
        center
        position={[0, 0.55, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">Access Lists</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">Parallel lanes</p>
        </div>
      </Html>
    </group>
  )
}

/* ── Initiative object: ePBS clock ── */

function EPBSClock({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.18, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <torusGeometry args={[0.25, 0.02, 12, 32]} />
        <meshStandardMaterial color={hovered ? '#ffffff' : '#3b82f6'} roughness={0.4} />
      </mesh>
      {/* Clock hand */}
      <mesh position={[0, hovered ? 0.04 : 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 6]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      <Html
        center
        position={[0, 0.45, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">ePBS</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">Full slot usage</p>
        </div>
      </Html>
    </group>
  )
}

/* ── Initiative object: Gas tank ── */

function GasTank({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.3, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox
        args={[0.35, 0.6, 0.35]}
        radius={0.03}
        smoothness={4}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <meshStandardMaterial color={hovered ? '#ffffff' : '#f59e0b'} roughness={0.5} />
      </RoundedBox>
      {/* Top accent */}
      <mesh position={[0, (hovered ? 0.04 : 0) + 0.301, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.33, 0.33]} />
        <meshBasicMaterial color="#f59e0b" transparent opacity={0.15} />
      </mesh>
      <Html
        center
        position={[0, 0.6, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">Gas Split</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">Multi-dim metering</p>
        </div>
      </Html>
    </group>
  )
}

/* ── Initiative object: Blob grid slab ── */

function BlobGrid({
  position,
  label,
  sub,
}: {
  position: [number, number, number]
  label: string
  sub: string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.06, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox
        args={[0.7, 0.08, 0.7]}
        radius={0.02}
        smoothness={4}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <meshStandardMaterial color={hovered ? '#ffffff' : '#6366f1'} roughness={0.6} />
      </RoundedBox>
      {/* Grid cell lines (4x4) */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`h-${i}`}
          position={[0, (hovered ? 0.04 : 0) + 0.041, -0.175 + (i + 1) * 0.117]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.66, 0.005]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      ))}
      {[0, 1, 2].map((i) => (
        <mesh
          key={`v-${i}`}
          position={[-0.175 + (i + 1) * 0.117, (hovered ? 0.04 : 0) + 0.041, 0]}
          rotation={[-Math.PI / 2, 0, Math.PI / 2]}
        >
          <planeGeometry args={[0.66, 0.005]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      ))}
      <Html
        center
        position={[0, 0.35, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>
        </div>
      </Html>
    </group>
  )
}

/* ── Initiative object: Prover tower ── */

function ProverTower({
  position,
  label,
  sub,
  greenAccent = false,
}: {
  position: [number, number, number]
  label: string
  sub: string
  greenAccent?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.35, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox
        args={[0.3, 0.7, 0.3]}
        radius={0.03}
        smoothness={4}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <meshStandardMaterial color={hovered ? '#ffffff' : '#8b5cf6'} roughness={0.5} />
      </RoundedBox>
      {greenAccent && (
        <mesh position={[0, (hovered ? 0.04 : 0) + 0.351, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.28, 0.28]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
        </mesh>
      )}
      <Html
        center
        position={[0, 0.65, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">{label}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">{sub}</p>
        </div>
      </Html>
    </group>
  )
}

/* ── Initiative object: Full Stack pillar ── */

function FullStackPillar({ position }: { position: [number, number, number] }) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.6, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox
        args={[0.7, 1.2, 0.7]}
        radius={0.04}
        smoothness={4}
        position={[0, hovered ? 0.04 : 0, 0]}
      >
        <meshStandardMaterial
          color={hovered ? '#ffffff' : '#22c55e'}
          roughness={0.4}
          emissive="#22c55e"
          emissiveIntensity={0.15}
        />
      </RoundedBox>
      {/* Top accent */}
      <mesh position={[0, (hovered ? 0.04 : 0) + 0.601, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.68, 0.68]} />
        <meshBasicMaterial color="#22c55e" transparent opacity={0.15} />
      </mesh>
      <Html
        center
        position={[0, 1.0, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">Full Stack</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">100x throughput</p>
        </div>
      </Html>
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
      // Each cube gets a unique phase from its index
      const phase = i / count
      // Stagger rows across depth
      const row = i % 3
      const zOff = (row - 1) * (halfD * 0.5)
      // Progress along platform L-to-R, wrapping
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

      {/* ── Initiative objects: Execution platform ── */}
      <ALFunnel position={[EXEC_X - 0.9, EXEC_Y + 0.3, 0]} />
      <EPBSClock position={[EXEC_X + 0.1, EXEC_Y + 0.22, 0]} />
      <GasTank position={[EXEC_X + 1.0, EXEC_Y + 0.35, 0]} />

      {/* ── Initiative objects: Data platform ── */}
      <BlobGrid position={[DATA_X - 0.5, DATA_Y + 0.1, 0]} label="Blobs" sub="Data cells" />
      <BlobGrid position={[DATA_X + 0.5, DATA_Y + 0.1, 0]} label="PeerDAS" sub="Sample & verify" />

      {/* ── Initiative objects: Proofs platform ── */}
      <ProverTower position={[PROOF_X - 0.9, PROOF_Y + 0.4, 0]} label="ZK-EVM" sub="Prove execution" />
      <ProverTower position={[PROOF_X - 0.2, PROOF_Y + 0.4, 0]} label="Formal Verif" sub="Prover correctness" greenAccent />
      <FullStackPillar position={[PROOF_X + 0.8, PROOF_Y + 0.65, 0]} />

      {/* ── Throughput cubes (12, 24, 48 = 2x multiplier per layer) ── */}
      <ThroughputCubes
        count={12}
        color="#3b82f6"
        platformX={EXEC_X}
        platformY={EXEC_Y}
        platformWidth={3.5}
        platformDepth={2.5}
        reducedMotion={reducedMotion}
      />
      <ThroughputCubes
        count={24}
        color="#6366f1"
        platformX={DATA_X}
        platformY={DATA_Y}
        platformWidth={3.0}
        platformDepth={2.5}
        reducedMotion={reducedMotion}
      />
      <ThroughputCubes
        count={48}
        color="#22c55e"
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
        <span className="text-[10px] text-text-muted tracking-wide">Full Stack</span>
      </div>
    </div>
  )
}

/* ── Exported component ── */

export function RoadmapStaircase3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Three ascending platforms representing Ethereum's execution, data, and proof scaling layers, with arrows showing dependencies between them"
      srDescription="A 3D diorama showing Ethereum's scaling roadmap as three ascending platforms. The execution platform contains access lists, ePBS, and gas split. The data platform contains blobs and PeerDAS. The proofs platform contains ZK-EVM, formal verification, and a tall green Full Stack pillar. Throughput cubes double at each layer (12, 24, 48) to show the compounding effect."
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
