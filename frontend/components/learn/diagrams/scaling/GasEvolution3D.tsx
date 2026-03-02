'use client'

import { useRef, useMemo, useState, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { PlatformStage } from './shared/PlatformStage'
import { TankModel } from './shared/TankModel'
import { ContextDisposer } from './shared/ContextDisposer'

/* ── Constants ── */

const STAGE1_X = -3.2
const STAGE2_X = 0
const STAGE3_X = 3.8

const STAGE1_Y = 0.0
const STAGE2_Y = 0.2
const STAGE3_Y = 0.4

/* ── Overflow pipe (TubeGeometry on horizontal bezier) ── */

function OverflowPipe({
  start,
  end,
  radius = 0.02,
  color = '#a1a1aa',
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  radius?: number
  color?: string
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    // Horizontal bezier with slight downward sag
    mid.y -= 0.08
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return new THREE.TubeGeometry(curve, 20, radius, 6, false)
  }, [start, end, radius])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color={color} roughness={0.4} />
    </mesh>
  )
}

/* ── Overflow particles (flow along pipe bezier) ── */

function OverflowParticles({
  start,
  end,
  count,
  color,
  speed = 0.15,
  active = true,
  reducedMotion = false,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  count: number
  color: string
  speed?: number
  active?: boolean
  reducedMotion?: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const curve = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y -= 0.08
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end])

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      if (!active || reducedMotion) {
        dummy.scale.setScalar(0)
      } else {
        const p = ((t * speed + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.scale.setScalar(0.015 * Math.sin(p * Math.PI))
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.55} />
    </instancedMesh>
  )
}

/* ── Progression arrows (instancedMesh chevron planes on floor between stages) ── */

function ProgressionArrows({ reducedMotion }: { reducedMotion: boolean }) {
  const count = 6
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const chevronShape = useMemo(() => {
    const shape = new THREE.Shape()
    const w = 0.075
    const h = 0.04
    shape.moveTo(-w, -h)
    shape.lineTo(0, 0)
    shape.lineTo(w, -h)
    shape.lineTo(w - 0.015, -h - 0.01)
    shape.lineTo(0, -0.01)
    shape.lineTo(-w + 0.015, -h - 0.01)
    shape.closePath()
    return shape
  }, [])

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current

    // 3 arrows between stage 1->2, 3 arrows between stage 2->3
    const gaps = [
      { from: STAGE1_X, to: STAGE2_X, y: STAGE1_Y },
      { from: STAGE2_X, to: STAGE3_X, y: STAGE2_Y },
    ]

    for (let i = 0; i < count; i++) {
      const gapIdx = i < 3 ? 0 : 1
      const localIdx = i % 3
      const gap = gaps[gapIdx]
      const progress = (localIdx + 1) / 4
      const x = gap.from + (gap.to - gap.from) * progress
      const y = gap.y + 0.01
      const z = 0

      // Pulse opacity by animating scale
      const phase = (t * 1.5 + i * 0.5) % (Math.PI * 2)
      const pulse = reducedMotion ? 0.8 : 0.5 + Math.sin(phase) * 0.3

      dummy.position.set(x, y, z)
      dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 2) // Flat on floor, pointing right
      dummy.scale.setScalar(pulse)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <shapeGeometry args={[chevronShape]} />
      <meshBasicMaterial
        color="#22c55e"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  )
}

/* ── Seeded deterministic PRNG (same pattern as ZKEVMPopulation3D) ── */

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000
  return x - Math.floor(x)
}

/* ── Price ticker board ── */

function PriceTicker({
  position,
  color,
  reducedMotion,
  seed,
}: {
  position: [number, number, number]
  color: string
  reducedMotion: boolean
  seed: number
}) {
  const [price, setPrice] = useState(() => Math.floor(5 + seededRandom(seed) * 15))
  const counterRef = useRef(0)

  const nextPrice = useCallback(() => {
    counterRef.current += 1
    return Math.floor(5 + seededRandom(seed * 100 + counterRef.current) * 15)
  }, [seed])

  useEffect(() => {
    if (reducedMotion) return
    const intervalMs = 3000 + seededRandom(seed + 0.5) * 2000
    const interval = setInterval(
      () => {
        setPrice(nextPrice())
      },
      intervalMs
    )
    return () => clearInterval(interval)
  }, [reducedMotion, seed, nextPrice])

  // Map tank color to tailwind border class
  const borderClass =
    color === '#3b82f6'
      ? 'border-blue-500'
      : color === '#6366f1'
        ? 'border-indigo-500'
        : color === '#f59e0b'
          ? 'border-amber-500'
          : 'border-green-500'

  return (
    <group position={position}>
      {/* Ticker board */}
      <RoundedBox args={[0.28, 0.18, 0.015]} radius={0.005} smoothness={4}>
        <meshStandardMaterial color="#1e1e1e" roughness={0.3} />
      </RoundedBox>
      {/* Price label with colored top border via Html */}
      <Html
        center
        position={[0, 0, 0.02]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className={`border-t-2 ${borderClass} pt-0.5 px-1`}>
          <p className="text-[10px] font-mono text-green-400 font-bold whitespace-nowrap">
            {price}gw
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ── State access tank with green outline effect ── */

function StateAccessTank({
  position,
  reducedMotion,
}: {
  position: [number, number, number]
  reducedMotion: boolean
}) {
  return (
    <group position={position}>
      {/* Green wireframe outline */}
      <RoundedBox args={[0.27, 0.72, 0.42]} radius={0.03} smoothness={4}>
        <meshBasicMaterial
          color="#22c55e"
          wireframe
          transparent
          opacity={0.4}
        />
      </RoundedBox>
      {/* The actual tank inside */}
      <TankModel
        position={[0, 0, 0]}
        width={0.25}
        height={0.7}
        depth={0.4}
        color="#d4d4d8"
        fillColor="#d4d4d8"
        fillPercent={0.3}
        fillOscillation={0.08}
        showDrain
        drainCount={6}
        label="SA"
        labelSub="Future"
        reducedMotion={reducedMotion}
      />
    </group>
  )
}

/* ── Cap bar with emissive pulse ── */

function PulsingCapBar({
  position,
  width,
  depth,
  reducedMotion,
}: {
  position: [number, number, number]
  width: number
  depth: number
  reducedMotion: boolean
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    matRef.current.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.3
  })

  return (
    <RoundedBox
      args={[width + 0.02, 0.025, depth + 0.02]}
      radius={0.005}
      smoothness={4}
      position={position}
    >
      <meshStandardMaterial
        ref={matRef}
        color="#ef4444"
        roughness={0.3}
        emissive="#ef4444"
        emissiveIntensity={0.3}
      />
    </RoundedBox>
  )
}

/* ── Stage 1: Single grey gas tank ── */

function Stage1({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group>
      <PlatformStage
        position={[STAGE1_X, STAGE1_Y, 0]}
        width={2.5}
        depth={2.5}
        color="#f4f4f5"
        label="Today"
        labelColor="#a1a1aa"
        labelSub="One gas pool"
      />

      <TankModel
        position={[STAGE1_X, STAGE1_Y + 0.04 + 0.5, 0]}
        width={0.6}
        height={1.0}
        depth={0.6}
        color="#d4d4d8"
        fillColor="#a1a1aa"
        fillPercent={0.5}
        fillOscillation={0.15}
        showDrain
        drainCount={12}
        label="Gas"
        labelSub="30M limit"
        reducedMotion={reducedMotion}
      />
    </group>
  )
}

/* ── Stage 2: Two tanks + overflow pipe + reservoir ── */

function Stage2({ reducedMotion }: { reducedMotion: boolean }) {
  const execTankY = STAGE2_Y + 0.04 + 0.5
  const stateTankY = STAGE2_Y + 0.04 + 0.25
  const reservoirY = STAGE2_Y + 0.04 - 0.3

  // Overflow pipe: from state tank side to reservoir
  const pipeStart = useMemo(
    () => new THREE.Vector3(STAGE2_X + 0.45, stateTankY, 0),
    [stateTankY]
  )
  const pipeEnd = useMemo(
    () => new THREE.Vector3(STAGE2_X + 0.3, reservoirY + 0.25, 0),
    [reservoirY]
  )

  return (
    <group>
      <PlatformStage
        position={[STAGE2_X, STAGE2_Y, 0]}
        width={3.0}
        depth={3.0}
        color="#f0fdf4"
        label="Glamsterdam"
        labelColor="#22c55e"
        stairFrom={[STAGE1_X, STAGE1_Y, 0]}
        stairRiserHeight={STAGE2_Y - STAGE1_Y}
        labelSub="Two gas pools"
      />

      {/* Exec tank (taller, blue) */}
      <TankModel
        position={[STAGE2_X - 0.4, execTankY, 0]}
        width={0.5}
        height={1.0}
        depth={0.5}
        color="#3b82f6"
        fillColor="#3b82f6"
        fillPercent={0.6}
        fillOscillation={0.2}
        growthChevrons
        showDrain
        drainCount={12}
        label="Exec"
        labelSub="Can grow"
        reducedMotion={reducedMotion}
      />

      {/* State tank (shorter, amber, capped) */}
      <group>
        <TankModel
          position={[STAGE2_X + 0.4, stateTankY, 0]}
          width={0.5}
          height={0.5}
          depth={0.5}
          color="#f59e0b"
          fillColor="#f59e0b"
          fillPercent={0.85}
          fillOscillation={0.06}
          showDrain
          drainCount={8}
          label="State"
          labelSub="Capped"
          reducedMotion={reducedMotion}
        />
        {/* Pulsing cap bar */}
        <PulsingCapBar
          position={[STAGE2_X + 0.4, stateTankY + 0.262, 0]}
          width={0.5}
          depth={0.5}
          reducedMotion={reducedMotion}
        />
      </group>

      {/* Overflow pipe from state tank to reservoir */}
      <OverflowPipe start={pipeStart} end={pipeEnd} radius={0.02} />

      {/* Overflow particles (always active since state fill is near cap) */}
      <OverflowParticles
        start={pipeStart}
        end={pipeEnd}
        count={10}
        color="#f59e0b"
        speed={0.2}
        active={true}
        reducedMotion={reducedMotion}
      />

      {/* Reservoir tank below */}
      <TankModel
        position={[STAGE2_X, reservoirY, 0]}
        width={1.0}
        height={0.5}
        depth={0.5}
        color="#71717a"
        fillColor="#71717a"
        fillPercent={0.4}
        fillOscillation={0.05}
        label="Reservoir"
        reducedMotion={reducedMotion}
      />
    </group>
  )
}

/* ── Stage 3: Four tanks + shared reservoir + overflow pipes + price tickers ── */

function Stage3({ reducedMotion }: { reducedMotion: boolean }) {
  const tankBaseY = STAGE3_Y + 0.04

  // Tank configs: [xOffset, width, height, color, fillColor, fillPercent, label, labelSub]
  const tanks = useMemo(
    () => [
      {
        xOff: -0.65,
        w: 0.6,
        h: 0.9,
        color: '#3b82f6',
        fill: '#3b82f6',
        fp: 0.55,
        osc: 0.12,
        label: 'Exec',
        sub: '70%',
        drain: 10,
      },
      {
        xOff: -0.1,
        w: 0.35,
        h: 0.8,
        color: '#6366f1',
        fill: '#6366f1',
        fp: 0.45,
        osc: 0.1,
        label: 'Calldata',
        sub: '20%',
        drain: 8,
      },
      {
        xOff: 0.25,
        w: 0.2,
        h: 0.6,
        color: '#f59e0b',
        fill: '#f59e0b',
        fp: 0.7,
        osc: 0.08,
        label: 'State',
        sub: '5%',
        drain: 6,
      },
      // State Access handled separately for green outline
    ],
    []
  )

  const reservoirY = tankBaseY - 0.35

  // Overflow pipe endpoints: from each tank bottom to reservoir top
  const pipeEndpoints = useMemo(() => {
    const tankDefs = [
      { xOff: -0.65, h: 0.9 },
      { xOff: -0.1, h: 0.8 },
      { xOff: 0.25, h: 0.6 },
      { xOff: 0.55, h: 0.7 }, // state access
    ]
    return tankDefs.map((t) => ({
      start: new THREE.Vector3(
        STAGE3_X + t.xOff,
        tankBaseY + t.h / 2 - t.h + 0.05,
        0.2
      ),
      end: new THREE.Vector3(
        STAGE3_X + t.xOff,
        reservoirY + 0.15 + 0.05,
        0.2
      ),
    }))
  }, [tankBaseY, reservoirY])

  return (
    <group>
      <PlatformStage
        position={[STAGE3_X, STAGE3_Y, 0]}
        width={3.5}
        depth={3.5}
        color="#eff6ff"
        label="Future"
        labelColor="#3b82f6"
        stairFrom={[STAGE2_X, STAGE2_Y, 0]}
        stairRiserHeight={STAGE3_Y - STAGE2_Y}
        labelSub="N gas dimensions"
      />

      {/* Regular tanks */}
      {tanks.map((t, i) => (
        <TankModel
          key={i}
          position={[STAGE3_X + t.xOff, tankBaseY + t.h / 2, 0]}
          width={t.w}
          height={t.h}
          depth={0.4}
          color={t.color}
          fillColor={t.fill}
          fillPercent={t.fp}
          fillOscillation={t.osc}
          showDrain
          drainCount={t.drain}
          label={t.label}
          labelSub={t.sub}
          reducedMotion={reducedMotion}
        />
      ))}

      {/* State Access tank with green outline */}
      <StateAccessTank
        position={[STAGE3_X + 0.55, tankBaseY + 0.35, 0]}
        reducedMotion={reducedMotion}
      />

      {/* Shared reservoir */}
      <TankModel
        position={[STAGE3_X, reservoirY, 0]}
        width={1.8}
        height={0.3}
        depth={0.4}
        color="#71717a"
        fillColor="#71717a"
        fillPercent={0.4}
        fillOscillation={0.04}
        label="Shared Reservoir"
        reducedMotion={reducedMotion}
      />

      {/* Overflow pipes from each tank to reservoir */}
      {pipeEndpoints.map((ep, i) => (
        <group key={`pipe-${i}`}>
          <OverflowPipe
            start={ep.start}
            end={ep.end}
            radius={0.01}
          />
          <OverflowParticles
            start={ep.start}
            end={ep.end}
            count={4}
            color={['#3b82f6', '#6366f1', '#f59e0b', '#d4d4d8'][i]}
            speed={0.15}
            reducedMotion={reducedMotion}
          />
        </group>
      ))}

      {/* Price ticker boards */}
      <PriceTicker
        position={[STAGE3_X - 0.65, tankBaseY + 0.9 + 0.2, 0.25]}
        color="#3b82f6"
        reducedMotion={reducedMotion}
        seed={1}
      />
      <PriceTicker
        position={[STAGE3_X - 0.1, tankBaseY + 0.8 + 0.2, 0.25]}
        color="#6366f1"
        reducedMotion={reducedMotion}
        seed={2}
      />
      <PriceTicker
        position={[STAGE3_X + 0.25, tankBaseY + 0.6 + 0.2, 0.25]}
        color="#f59e0b"
        reducedMotion={reducedMotion}
        seed={3}
      />
      <PriceTicker
        position={[STAGE3_X + 0.55, tankBaseY + 0.7 + 0.2, 0.25]}
        color="#22c55e"
        reducedMotion={reducedMotion}
        seed={4}
      />
    </group>
  )
}

/* ── Main scene content ── */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* Solid white floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Three stages */}
      <Stage1 reducedMotion={reducedMotion} />
      <Stage2 reducedMotion={reducedMotion} />
      <Stage3 reducedMotion={reducedMotion} />

      {/* Progression arrows on floor between stages */}
      <ProgressionArrows reducedMotion={reducedMotion} />
    </>
  )
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-zinc-300 border border-zinc-400" />
        <span className="text-[10px] text-text-muted tracking-wide">
          Single pool
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-blue-400 border border-blue-500" />
        <span className="text-[10px] text-text-muted tracking-wide">
          Execution
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-amber-400 border border-amber-500" />
        <span className="text-[10px] text-text-muted tracking-wide">
          State
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-indigo-400 border border-indigo-500" />
        <span className="text-[10px] text-text-muted tracking-wide">
          Calldata
        </span>
      </div>
    </div>
  )
}

/* ── Exported component ── */

export function GasEvolution3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Three-stage evolution of Ethereum gas pricing, from a single pool today, to two separate pools with overflow at Glamsterdam, to four independently priced gas dimensions in the future"
      srDescription="A 3D diorama showing gas pricing evolution across three ascending platforms. The left platform has a single grey gas tank representing today's unified gas market. The middle platform shows two tanks — a tall blue execution tank with growth chevrons and a shorter amber state tank with a red cap bar — connected by an overflow pipe to a grey reservoir below. The right platform has four tanks of different widths proportional to their gas share (execution widest, state narrowest), each with independent price tickers, connected to a shared reservoir."
      legend={<Legend />}
      fallbackText="Gas pricing evolution — from one pool to multi-dimensional gas markets"
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
