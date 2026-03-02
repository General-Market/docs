'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* -- Seeded PRNG -- */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/* -- Constants -- */

const STAGES = [
  { label: '5%', y: 0.0, x: -3.6, zkCount: 1, tradCount: 9, zkScale: 0.4, tradScale: 0.18 },
  { label: '20%', y: 0.12, x: -1.2, zkCount: 4, tradCount: 6, zkScale: 0.4, tradScale: 0.18 },
  { label: '3-of-5', y: 0.24, x: 1.2, zkCount: 6, tradCount: 4, zkScale: 0.35, tradScale: 0.18, voting: true },
  { label: 'Verified', y: 0.36, x: 3.6, zkCount: 10, tradCount: 0, zkScale: 0.35, tradScale: 0 },
] as const

const PLATFORM_SIZE = 2.5
const PLATFORM_HEIGHT = 0.06

const VIOLET = '#8b5cf6'
const GREY = '#d4d4d8'
const GREEN = '#22c55e'
const ZINC_DARK = '#71717a'

const YEAR_LABELS = ['2026', '2027', '2028', '2030+']

/* -- Geometry factories (cached via useMemo) -- */

function createValidatorGeometry(): THREE.BufferGeometry {
  const headGeo = new THREE.SphereGeometry(0.045, 10, 8)
  headGeo.translate(0, 0.14, 0)

  const bodyGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.14, 8)
  bodyGeo.translate(0, 0.04, 0)

  const baseGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10)
  baseGeo.translate(0, -0.035, 0)

  const merged = mergeGeometries([headGeo, bodyGeo, baseGeo], false)
  headGeo.dispose()
  bodyGeo.dispose()
  baseGeo.dispose()

  return merged || new THREE.BoxGeometry(0.08, 0.22, 0.08)
}

function createRaisedArmGeometry(): THREE.BufferGeometry {
  const headGeo = new THREE.SphereGeometry(0.045, 10, 8)
  headGeo.translate(0, 0.14, 0)

  const bodyGeo = new THREE.CylinderGeometry(0.025, 0.04, 0.14, 8)
  bodyGeo.translate(0, 0.04, 0)

  const baseGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.015, 10)
  baseGeo.translate(0, -0.035, 0)

  const armGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6)
  armGeo.rotateZ(-Math.PI / 6)
  armGeo.translate(0.035, 0.19, 0)

  const handGeo = new THREE.SphereGeometry(0.018, 6, 6)
  handGeo.translate(0.06, 0.235, 0)

  const merged = mergeGeometries([headGeo, bodyGeo, baseGeo, armGeo, handGeo], false)
  headGeo.dispose()
  bodyGeo.dispose()
  baseGeo.dispose()
  armGeo.dispose()
  handGeo.dispose()

  return merged || new THREE.BoxGeometry(0.08, 0.22, 0.08)
}

/* -- Figure grid layout helper -- */

function getFigurePositions(count: number, platformHalfSize: number): [number, number][] {
  const positions: [number, number][] = []
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const spacing = (platformHalfSize * 1.4) / Math.max(cols, 1)

  for (let i = 0; i < count; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = (col - (cols - 1) / 2) * spacing
    const z = (row - (rows - 1) / 2) * spacing
    positions.push([x, z])
  }
  return positions
}

/* -- Instanced validator population per stage -- */

function StagePopulation({
  stageX,
  stageY,
  zkCount,
  tradCount,
  zkScale,
  tradScale,
  voting,
}: {
  stageX: number
  stageY: number
  zkCount: number
  tradCount: number
  zkScale: number
  tradScale: number
  voting?: boolean
}) {
  const zkRef = useRef<THREE.InstancedMesh>(null!)
  const tradRef = useRef<THREE.InstancedMesh>(null!)

  const zkGeometry = useMemo(() => voting ? createRaisedArmGeometry() : createValidatorGeometry(), [voting])
  const tradGeometry = useMemo(() => createValidatorGeometry(), [])

  const zkPositions = useMemo(() => {
    const allPositions = getFigurePositions(zkCount + tradCount, PLATFORM_SIZE / 2)
    return allPositions.slice(0, zkCount)
  }, [zkCount, tradCount])

  const tradPositions = useMemo(() => {
    const allPositions = getFigurePositions(zkCount + tradCount, PLATFORM_SIZE / 2)
    return allPositions.slice(zkCount, zkCount + tradCount)
  }, [zkCount, tradCount])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  // useFrame to set matrices on first frame (refs may not be ready in useMemo)
  const initialized = useRef(false)
  useFrame(() => {
    if (initialized.current) return
    if (!zkRef.current) return
    if (tradCount > 0 && !tradRef.current) return

    for (let i = 0; i < zkCount; i++) {
      const [px, pz] = zkPositions[i]
      dummy.position.set(stageX + px, stageY + PLATFORM_HEIGHT / 2, pz)
      dummy.scale.setScalar(zkScale)
      dummy.updateMatrix()
      zkRef.current.setMatrixAt(i, dummy.matrix)
    }
    zkRef.current.instanceMatrix.needsUpdate = true

    if (tradCount > 0 && tradRef.current) {
      for (let i = 0; i < tradCount; i++) {
        const [px, pz] = tradPositions[i]
        dummy.position.set(stageX + px, stageY + PLATFORM_HEIGHT / 2, pz)
        dummy.scale.setScalar(tradScale)
        dummy.updateMatrix()
        tradRef.current.setMatrixAt(i, dummy.matrix)
      }
      tradRef.current.instanceMatrix.needsUpdate = true
    }

    initialized.current = true
  })

  return (
    <>
      {/* ZK validators (purple) */}
      <instancedMesh ref={zkRef} args={[zkGeometry, undefined, zkCount]}>
        <meshStandardMaterial color={VIOLET} roughness={0.6} />
      </instancedMesh>

      {/* Traditional validators (grey) */}
      {tradCount > 0 && (
        <instancedMesh ref={tradRef} args={[tradGeometry, undefined, tradCount]}>
          <meshStandardMaterial color={GREY} roughness={0.7} />
        </instancedMesh>
      )}
    </>
  )
}

/* -- ZK proof sparkle particles -- */

function ZKSparkles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const count = 20

  const sparkleData = useMemo(() => {
    const data: { stageX: number; stageY: number; figX: number; figZ: number; phase: number; radius: number; yOff: number }[] = []
    const stagesWithZK = STAGES.filter(s => s.zkCount > 0)
    for (let i = 0; i < count; i++) {
      const stage = stagesWithZK[i % stagesWithZK.length]
      const allPositions = getFigurePositions(stage.zkCount + stage.tradCount, PLATFORM_SIZE / 2)
      const figIdx = i % stage.zkCount
      const [fx, fz] = allPositions[figIdx]
      data.push({
        stageX: stage.x,
        stageY: stage.y,
        figX: fx,
        figZ: fz,
        phase: (i / count) * Math.PI * 2,
        radius: 0.06 + seededRandom(i * 17 + 3) * 0.08,
        yOff: 0.08 + seededRandom(i * 31 + 7) * 0.12,
      })
    }
    return data
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const d = sparkleData[i]
      const angle = t * 0.5 + d.phase
      const x = d.stageX + d.figX + Math.cos(angle) * d.radius
      const y = d.stageY + PLATFORM_HEIGHT / 2 + d.yOff + Math.sin(t * 1.2 + d.phase) * 0.02
      const z = d.figZ + Math.sin(angle) * d.radius
      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.006)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={VIOLET} transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* -- Network pulse rings -- */

function NetworkPulseRings({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const count = 10

  const ringData = useMemo(() => {
    const data: { stageX: number; stageY: number; figX: number; figZ: number; phase: number }[] = []
    const stagesWithZK = STAGES.filter(s => s.zkCount > 0)
    for (let i = 0; i < count; i++) {
      const stage = stagesWithZK[i % stagesWithZK.length]
      const allPositions = getFigurePositions(stage.zkCount + stage.tradCount, PLATFORM_SIZE / 2)
      const figIdx = i % stage.zkCount
      const [fx, fz] = allPositions[figIdx]
      data.push({
        stageX: stage.x,
        stageY: stage.y,
        figX: fx,
        figZ: fz,
        phase: (i / count) * 2,
      })
    }
    return data
  }, [])

  const torusGeo = useMemo(() => new THREE.TorusGeometry(1, 0.008, 6, 24), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const d = ringData[i]
      const progress = ((t * 0.5 + d.phase) % 2) / 2
      const scale = 0.04 + progress * 0.12
      const x = d.stageX + d.figX
      const y = d.stageY + PLATFORM_HEIGHT / 2 + 0.01
      const z = d.figZ
      dummy.position.set(x, y, z)
      dummy.rotation.set(-Math.PI / 2, 0, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[torusGeo, undefined, count]}>
      <meshBasicMaterial color={VIOLET} transparent opacity={0.25} />
    </instancedMesh>
  )
}

/* -- Consensus arcs (Stage 3) -- */

function ConsensusArcs({ stageX, stageY }: { stageX: number; stageY: number }) {
  const allPositions = useMemo(
    () => getFigurePositions(10, PLATFORM_SIZE / 2),
    []
  )

  const arcPairs: [number, number][] = [[0, 1], [1, 2], [2, 3]]

  const arcGeometries = useMemo(() => {
    return arcPairs.map(([a, b]) => {
      const [ax, az] = allPositions[a]
      const [bx, bz] = allPositions[b]
      const start = new THREE.Vector3(stageX + ax, stageY + PLATFORM_HEIGHT / 2 + 0.07, az)
      const end = new THREE.Vector3(stageX + bx, stageY + PLATFORM_HEIGHT / 2 + 0.07, bz)
      const mid = start.clone().lerp(end, 0.5)
      mid.y += 0.12
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
      return new THREE.TubeGeometry(curve, 16, 0.008, 6, false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageX, stageY])

  return (
    <>
      {arcGeometries.map((geo, i) => (
        <mesh key={`arc-${i}`} geometry={geo}>
          <meshStandardMaterial color={GREEN} roughness={0.3} />
        </mesh>
      ))}
    </>
  )
}

/* -- Consensus particles flowing along arcs -- */

function ConsensusParticles({
  stageX,
  stageY,
  reducedMotion,
}: {
  stageX: number
  stageY: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const count = 18

  const allPositions = useMemo(
    () => getFigurePositions(10, PLATFORM_SIZE / 2),
    []
  )

  const arcPairs: [number, number][] = [[0, 1], [1, 2], [2, 3]]

  const curves = useMemo(() => {
    return arcPairs.map(([a, b]) => {
      const [ax, az] = allPositions[a]
      const [bx, bz] = allPositions[b]
      const start = new THREE.Vector3(stageX + ax, stageY + PLATFORM_HEIGHT / 2 + 0.07, az)
      const end = new THREE.Vector3(stageX + bx, stageY + PLATFORM_HEIGHT / 2 + 0.07, bz)
      const mid = start.clone().lerp(end, 0.5)
      mid.y += 0.12
      return new THREE.QuadraticBezierCurve3(start, mid, end)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageX, stageY])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const perArc = count / curves.length
    for (let i = 0; i < count; i++) {
      const arcIdx = Math.floor(i / perArc)
      const localIdx = i % perArc
      const curve = curves[Math.min(arcIdx, curves.length - 1)]
      const progress = ((t * 0.25 + localIdx / perArc) % 1)
      const point = curve.getPoint(progress)
      dummy.position.copy(point)
      dummy.scale.setScalar(0.008 * Math.sin(progress * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* -- Stage 4: Green glow disc -- */

function GlowDisc({
  position,
  reducedMotion,
}: {
  position: [number, number, number]
  reducedMotion: boolean
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !matRef.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    matRef.current.opacity = 0.1 + Math.sin(t * 0.8) * 0.05 + 0.05
  })

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[1.0, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color={GREEN}
        transparent
        opacity={0.15}
        depthWrite={false}
      />
    </mesh>
  )
}

/* -- Timeline bar with animated progress fill -- */

function TimelineBar({ reducedMotion }: { reducedMotion: boolean }) {
  const barWidth = 10.0
  const startX = -(barWidth / 2)
  const fillRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !fillRef.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const progress = (t % 10) / 10
    const width = Math.max(0.01, progress * barWidth)
    fillRef.current.scale.x = width
    fillRef.current.position.x = startX + width / 2
  })

  return (
    <group position={[0, -0.08, 2.0]}>
      {/* Background bar */}
      <RoundedBox args={[barWidth, 0.008, 0.08]} radius={0.004} smoothness={4}>
        <meshStandardMaterial color={GREY} roughness={0.6} />
      </RoundedBox>

      {/* Animated progress fill */}
      <mesh ref={fillRef} position={[startX + 0.005, 0.002, 0]}>
        <boxGeometry args={[1, 0.012, 0.1]} />
        <meshStandardMaterial color={VIOLET} roughness={0.4} />
      </mesh>

      {/* Year labels and tick marks */}
      {YEAR_LABELS.map((year, i) => {
        const x = startX + (i / (YEAR_LABELS.length - 1)) * barWidth
        return (
          <group key={year} position={[x, 0, 0]}>
            {/* Tick mark */}
            <mesh position={[0, 0.03, 0]}>
              <cylinderGeometry args={[0.006, 0.006, 0.08, 6]} />
              <meshStandardMaterial color={ZINC_DARK} />
            </mesh>
            {/* Year label */}
            <Html
              center
              position={[0, -0.1, 0]}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <p className="text-[9px] text-zinc-400 font-mono whitespace-nowrap">{year}</p>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/* -- Stair riser between platforms -- */

function StairRiser({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number
  fromY: number
  toX: number
  toY: number
}) {
  const midX = (fromX + toX) / 2
  const midY = (fromY + toY) / 2
  const height = toY - fromY

  return (
    <RoundedBox
      args={[0.3, height, PLATFORM_SIZE]}
      radius={0.01}
      smoothness={4}
      position={[midX, midY, 0]}
    >
      <meshStandardMaterial color="#e5e7eb" roughness={0.8} transparent opacity={0.5} />
    </RoundedBox>
  )
}

/* -- Main scene content -- */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const stage3 = STAGES[2]
  const stage4 = STAGES[3]

  return (
    <>
      {/* Solid white floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* -- 4 Platforms -- */}
      {STAGES.map((stage) => (
        <group key={stage.label}>
          <RoundedBox
            args={[PLATFORM_SIZE, PLATFORM_HEIGHT, PLATFORM_SIZE]}
            radius={0.02}
            smoothness={4}
            position={[stage.x, stage.y, 0]}
          >
            <meshStandardMaterial color="#faf5ff" roughness={0.75} />
          </RoundedBox>

          {/* Accent line along front edge */}
          <mesh position={[stage.x, stage.y + PLATFORM_HEIGHT / 2 + 0.001, -PLATFORM_SIZE / 2 + 0.01]}>
            <planeGeometry args={[PLATFORM_SIZE - 0.04, 0.018]} />
            <meshBasicMaterial color={VIOLET} />
          </mesh>

          {/* Stage label above platform */}
          <Html
            center
            position={[stage.x, stage.y + PLATFORM_HEIGHT / 2 + 0.5, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <p className="text-[10px] font-bold text-black tracking-widest uppercase whitespace-nowrap">
              {stage.label}
            </p>
          </Html>
        </group>
      ))}

      {/* -- Stair risers -- */}
      <StairRiser fromX={STAGES[0].x} fromY={STAGES[0].y} toX={STAGES[1].x} toY={STAGES[1].y} />
      <StairRiser fromX={STAGES[1].x} fromY={STAGES[1].y} toX={STAGES[2].x} toY={STAGES[2].y} />
      <StairRiser fromX={STAGES[2].x} fromY={STAGES[2].y} toX={STAGES[3].x} toY={STAGES[3].y} />

      {/* -- Validator populations per stage -- */}
      {STAGES.map((stage) => (
        <StagePopulation
          key={`pop-${stage.label}`}
          stageX={stage.x}
          stageY={stage.y}
          zkCount={stage.zkCount}
          tradCount={stage.tradCount}
          zkScale={stage.zkScale}
          tradScale={stage.tradScale}
          voting={'voting' in stage ? stage.voting : undefined}
        />
      ))}

      {/* -- Stage 3: Consensus arcs between raised-arm figures -- */}
      <ConsensusArcs stageX={stage3.x} stageY={stage3.y} />
      <ConsensusParticles stageX={stage3.x} stageY={stage3.y} reducedMotion={reducedMotion} />

      {/* -- Stage 4: Green glow disc -- */}
      <GlowDisc
        position={[stage4.x, stage4.y + PLATFORM_HEIGHT / 2 + 0.003, 0]}
        reducedMotion={reducedMotion}
      />

      {/* -- ZK proof sparkle particles -- */}
      <ZKSparkles reducedMotion={reducedMotion} />

      {/* -- Network pulse rings -- */}
      <NetworkPulseRings reducedMotion={reducedMotion} />

      {/* -- Timeline bar -- */}
      <TimelineBar reducedMotion={reducedMotion} />
    </>
  )
}

/* -- Legend -- */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-violet-500 border border-violet-600" />
        <span className="text-[10px] text-text-muted tracking-wide">ZK validator</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-zinc-300 border border-zinc-400" />
        <span className="text-[10px] text-text-muted tracking-wide">Traditional</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
        <span className="text-[10px] text-text-muted tracking-wide">Consensus</span>
      </div>
    </div>
  )
}

/* -- Exported component -- */

export function ZKEVMPopulation3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Four stages of ZK-EVM adoption shown as figure populations on ascending platforms: 5% adoption, 20% adoption, 3-of-5 consensus voting, and 100% formally verified validators"
      srDescription="A 3D diorama showing ZK-EVM adoption through four ascending platforms. Stage 1 has 1 large purple validator among 9 small grey ones (5% adoption). Stage 2 has 4 large purple among 6 small grey (20%). Stage 3 has 6 purple figures with raised arms connected by green consensus arcs, and 4 grey figures (3-of-5 voting). Stage 4 has all 10 figures in purple with a green glow disc indicating full formal verification."
      legend={<Legend />}
      fallbackText="ZK-EVM adoption stages -- from 5% to 100% validator coverage"
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
