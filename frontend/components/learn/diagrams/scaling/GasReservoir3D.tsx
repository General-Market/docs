'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ── Constants ── */

const CYCLE_DURATION = 10 // seconds

// Tank positions
const EXEC_X = -2.5
const STATE_X = -0.5
const RESERVOIR_X = 2.5

// Tank dimensions
const EXEC_RADIUS = 0.5
const EXEC_HEIGHT = 2.5

const STATE_RADIUS = 0.4
const STATE_HEIGHT = 1.5

const RESERVOIR_RADIUS = 0.8
const RESERVOIR_HEIGHT = 2.0

// Colors
const COL_BLUE = '#3b82f6'
const COL_PURPLE = '#8b5cf6'
const COL_AMBER = '#f59e0b'
const COL_RED = '#ef4444'
const COL_GREEN = '#22c55e'
const COL_PIPE = '#a1a1aa'

/* ── Cycle phase helper ── */

function getPhase(t: number): { phase: number; phaseT: number } {
  const cycleT = t % CYCLE_DURATION
  if (cycleT < 4) return { phase: 0, phaseT: cycleT / 4 }
  if (cycleT < 8) return { phase: 1, phaseT: (cycleT - 4) / 4 }
  return { phase: 2, phaseT: (cycleT - 8) / 2 }
}

/* ── Cylinder Tank (glass shell + animated fill) ── */

function CylinderTank({
  position,
  radius,
  height,
  color,
  fillTarget,
  reducedMotion,
}: {
  position: [number, number, number]
  radius: number
  height: number
  color: string
  fillTarget: React.MutableRefObject<number>
  reducedMotion: boolean
}) {
  const fillRef = useRef<THREE.Mesh>(null!)
  const currentFill = useRef(fillTarget.current)

  useFrame((_, delta) => {
    if (!fillRef.current) return
    // Smooth interpolation toward target
    const speed = reducedMotion ? 1 : 4
    currentFill.current += (fillTarget.current - currentFill.current) * Math.min(1, delta * speed)
    const f = Math.max(0.001, Math.min(1, currentFill.current))
    const fillH = height * f
    fillRef.current.scale.set(1, f, 1)
    fillRef.current.position.y = -height / 2 + fillH / 2
  })

  const innerRadius = radius - 0.03

  return (
    <group position={position}>
      {/* Glass shell */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 24, 1, true]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          roughness={0.3}
        />
      </mesh>
      {/* Top rim */}
      <mesh position={[0, height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.02, 8, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Bottom rim */}
      <mesh position={[0, -height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.02, 8, 24]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      {/* Bottom cap */}
      <mesh position={[0, -height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius, 24]} />
        <meshStandardMaterial color={color} transparent opacity={0.12} />
      </mesh>
      {/* Fill level */}
      <mesh ref={fillRef} position={[0, -height / 2 + (height * fillTarget.current) / 2, 0]}>
        <cylinderGeometry args={[innerRadius, innerRadius, height, 24]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.55}
          roughness={0.4}
        />
      </mesh>
    </group>
  )
}

/* ── Overflow Pipe (TubeGeometry on bezier curve) ── */

function OverflowPipe({
  start,
  end,
  sagY = -0.3,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  sagY?: number
}) {
  const tubeGeo = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += sagY
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return new THREE.TubeGeometry(curve, 24, 0.04, 8, false)
  }, [start, end, sagY])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color={COL_PIPE} roughness={0.5} metalness={0.2} />
    </mesh>
  )
}

/* ── Overflow Particles (instancedMesh flowing along pipe bezier) ── */

function OverflowParticles({
  start,
  end,
  sagY = -0.3,
  count,
  color,
  activeRef,
  reducedMotion,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  sagY?: number
  count: number
  color: string
  activeRef: React.MutableRefObject<number> // 0..1 intensity
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const curve = useMemo(() => {
    const mid = start.clone().lerp(end, 0.5)
    mid.y += sagY
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end, sagY])

  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) {
      // Hide all particles
      for (let i = 0; i < count; i++) {
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        ref.current.setMatrixAt(i, dummy.matrix)
      }
      ref.current.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current
    const intensity = activeRef.current

    for (let i = 0; i < count; i++) {
      if (intensity < 0.05) {
        dummy.scale.setScalar(0)
      } else {
        const speed = 0.3 + intensity * 0.5
        const p = ((t * speed + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        // Particles larger when more active, bulge in middle of pipe
        const sizeMod = Math.sin(p * Math.PI) * intensity
        dummy.scale.setScalar(0.025 * sizeMod + 0.005)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ── Legacy Contract Cube (enters from right during Phase 1) ── */

function LegacyCube({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (reducedMotion) {
      meshRef.current.position.set(RESERVOIR_X + 1.2, 0.8, 0.8)
      meshRef.current.rotation.y = 0.3
      return
    }

    elapsedRef.current += delta
    const { phase, phaseT } = getPhase(elapsedRef.current)

    // Cube is visible in all phases, hovering near reservoir
    // In phase 0: arrives from the right
    // In phase 1-2: stays near reservoir, looking at it
    let targetX: number
    let targetY: number

    if (phase === 0) {
      // Slide in from the right
      targetX = RESERVOIR_X + 2.5 - phaseT * 1.3
      targetY = 0.8
    } else {
      // Stay near reservoir
      targetX = RESERVOIR_X + 1.2
      targetY = 0.8 + Math.sin(elapsedRef.current * 1.5) * 0.08
    }

    meshRef.current.position.lerp(new THREE.Vector3(targetX, targetY, 0.8), 0.06)
    meshRef.current.rotation.y += delta * 0.8
    meshRef.current.rotation.x += delta * 0.4
  })

  return (
    <mesh ref={meshRef} position={[RESERVOIR_X + 2.5, 0.8, 0.8]}>
      <boxGeometry args={[0.28, 0.28, 0.28]} />
      <meshStandardMaterial
        color="#71717a"
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  )
}

/* ── Price Labels (animated gwei text above tanks) ── */

function PriceLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const execLabelRef = useRef<HTMLSpanElement>(null!)
  const stateLabelRef = useRef<HTMLSpanElement>(null!)
  const stormLabelRef = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const { phase, phaseT } = getPhase(elapsedRef.current)

    // Execution price: always stable
    if (execLabelRef.current) {
      execLabelRef.current.textContent = '8 gwei'
      execLabelRef.current.style.color = COL_GREEN
    }

    // State creation price: spikes during phase 1
    if (stateLabelRef.current) {
      if (phase === 1) {
        // Ramp up then hold
        const gweiVal = Math.round(50 + phaseT * 450)
        stateLabelRef.current.textContent = `${gweiVal} gwei`
        stateLabelRef.current.style.color = COL_RED
      } else if (phase === 2) {
        // Ramp down
        const gweiVal = Math.round(500 - phaseT * 450)
        stateLabelRef.current.textContent = `${gweiVal} gwei`
        stateLabelRef.current.style.color = phaseT > 0.5 ? COL_GREEN : COL_RED
      } else {
        stateLabelRef.current.textContent = '50 gwei'
        stateLabelRef.current.style.color = COL_GREEN
      }
    }

    // Storm label
    if (stormLabelRef.current) {
      if (phase === 1) {
        stormLabelRef.current.style.opacity = String(Math.min(1, phaseT * 3))
      } else {
        stormLabelRef.current.style.opacity = '0'
      }
    }
  })

  return (
    <>
      {/* Execution price */}
      <Html
        position={[EXEC_X, EXEC_HEIGHT / 2 + 0.9, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <span
          ref={execLabelRef}
          className="text-[13px] font-bold font-mono whitespace-nowrap"
          style={{ color: COL_GREEN }}
        >
          8 gwei
        </span>
      </Html>

      {/* State creation price */}
      <Html
        position={[STATE_X, STATE_HEIGHT / 2 + 0.9, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <span
          ref={stateLabelRef}
          className="text-[13px] font-bold font-mono whitespace-nowrap"
          style={{ color: COL_GREEN }}
        >
          50 gwei
        </span>
      </Html>

      {/* Storm label */}
      <Html
        position={[STATE_X, STATE_HEIGHT / 2 + 1.4, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          ref={stormLabelRef}
          className="text-[12px] font-semibold whitespace-nowrap px-2 py-0.5 rounded-full"
          style={{
            color: '#fff',
            background: COL_RED,
            opacity: 0,
            transition: 'opacity 0.3s',
          }}
        >
          NFT mint storm
        </div>
      </Html>
    </>
  )
}

/* ── Tank Labels (static Html labels below each tank) ── */

function TankLabels() {
  return (
    <>
      {/* Execution */}
      <Html
        position={[EXEC_X, -EXEC_HEIGHT / 2 - 0.45, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <div className="text-[12px] font-bold" style={{ color: COL_BLUE }}>
            Execution
          </div>
          <div className="text-[10px] font-mono" style={{ color: '#71717a' }}>
            300M gas
          </div>
        </div>
      </Html>

      {/* State creation */}
      <Html
        position={[STATE_X, -STATE_HEIGHT / 2 - 0.45, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <div className="text-[12px] font-bold" style={{ color: COL_PURPLE }}>
            State Creation
          </div>
          <div className="text-[10px] font-mono" style={{ color: '#71717a' }}>
            1M gas
          </div>
        </div>
      </Html>

      {/* Reservoir */}
      <Html
        position={[RESERVOIR_X, -RESERVOIR_HEIGHT / 2 - 0.45, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="text-center">
          <div className="text-[12px] font-bold" style={{ color: COL_AMBER }}>
            Reservoir
          </div>
          <div className="text-[10px]" style={{ color: '#71717a' }}>
            backward compat
          </div>
        </div>
      </Html>

      {/* Legacy sees this */}
      <Html
        position={[RESERVOIR_X, RESERVOIR_HEIGHT / 2 + 0.6, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="text-[11px] font-medium whitespace-nowrap px-2 py-0.5 rounded border"
          style={{ color: '#71717a', borderColor: '#d4d4d8', background: '#fafafa' }}
        >
          Legacy contracts see this
        </div>
      </Html>
    </>
  )
}

/* ── Animated Cap Bar for state creation tank ── */

function StateCapBar({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current || reducedMotion) return
    elapsedRef.current += delta
    const { phase } = getPhase(elapsedRef.current)
    // Pulse faster during spike
    const speed = phase === 1 ? 6 : 2
    matRef.current.emissiveIntensity = phase === 1
      ? 0.6 + Math.sin(elapsedRef.current * speed) * 0.4
      : 0.15 + Math.sin(elapsedRef.current * speed) * 0.15
  })

  return (
    <mesh position={[STATE_X, STATE_HEIGHT / 2 + 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[STATE_RADIUS + 0.01, 0.03, 8, 24]} />
      <meshStandardMaterial
        ref={matRef}
        color={COL_RED}
        emissive={COL_RED}
        emissiveIntensity={0.15}
        roughness={0.3}
      />
    </mesh>
  )
}

/* ── Scene Orchestrator (controls fill targets + overflow intensity per cycle) ── */

function SceneOrchestrator({ reducedMotion }: { reducedMotion: boolean }) {
  // Fill targets as refs (driven by useFrame, read by CylinderTank)
  const execFillRef = useRef(0.6)
  const stateFillRef = useRef(0.35)
  const reservoirFillRef = useRef(0.3)

  // Overflow intensities
  const execOverflowRef = useRef(0)
  const stateOverflowRef = useRef(0)

  const elapsedRef = useRef(0)

  // Pipe endpoints
  const execPipeStart = useMemo(
    () => new THREE.Vector3(EXEC_X + EXEC_RADIUS + 0.05, EXEC_HEIGHT * 0.15, 0),
    []
  )
  const execPipeEnd = useMemo(
    () => new THREE.Vector3(RESERVOIR_X - RESERVOIR_RADIUS - 0.05, RESERVOIR_HEIGHT * 0.2, 0),
    []
  )
  const statePipeStart = useMemo(
    () => new THREE.Vector3(STATE_X + STATE_RADIUS + 0.05, STATE_HEIGHT * 0.15, 0),
    []
  )
  const statePipeEnd = useMemo(
    () => new THREE.Vector3(RESERVOIR_X - RESERVOIR_RADIUS - 0.05, -RESERVOIR_HEIGHT * 0.1, 0),
    []
  )

  useFrame((_, delta) => {
    if (reducedMotion) {
      execFillRef.current = 0.6
      stateFillRef.current = 0.35
      reservoirFillRef.current = 0.3
      execOverflowRef.current = 0
      stateOverflowRef.current = 0
      return
    }

    elapsedRef.current += delta
    const { phase, phaseT } = getPhase(elapsedRef.current)

    if (phase === 0) {
      // Normal state: moderate fill, slight idle overflow
      execFillRef.current = 0.6 + Math.sin(elapsedRef.current * 1.2) * 0.05
      stateFillRef.current = 0.35 + Math.sin(elapsedRef.current * 1.5) * 0.05
      reservoirFillRef.current = 0.3 + Math.sin(elapsedRef.current * 0.8) * 0.03
      execOverflowRef.current = 0.1
      stateOverflowRef.current = 0.08
    } else if (phase === 1) {
      // NFT mint storm: state creation tank fills rapidly
      execFillRef.current = 0.6 + Math.sin(elapsedRef.current * 1.2) * 0.05
      // State fills to near max
      const stateTarget = 0.35 + phaseT * 0.6
      stateFillRef.current = Math.min(0.98, stateTarget)
      // Reservoir fills from overflow
      reservoirFillRef.current = 0.3 + phaseT * 0.35
      // Overflow intensity ramps up dramatically
      execOverflowRef.current = 0.1
      stateOverflowRef.current = Math.min(1, phaseT * 2.5)
    } else {
      // Recovery: drain back to normal
      const easeOut = 1 - phaseT
      execFillRef.current = 0.6 + Math.sin(elapsedRef.current * 1.2) * 0.05
      stateFillRef.current = 0.95 - phaseT * 0.6
      reservoirFillRef.current = 0.65 - phaseT * 0.35
      execOverflowRef.current = 0.1
      stateOverflowRef.current = Math.max(0.08, easeOut * 0.8)
    }
  })

  return (
    <>
      {/* Execution tank */}
      <CylinderTank
        position={[EXEC_X, 0, 0]}
        radius={EXEC_RADIUS}
        height={EXEC_HEIGHT}
        color={COL_BLUE}
        fillTarget={execFillRef}
        reducedMotion={reducedMotion}
      />

      {/* State creation tank */}
      <CylinderTank
        position={[STATE_X, 0, 0]}
        radius={STATE_RADIUS}
        height={STATE_HEIGHT}
        color={COL_PURPLE}
        fillTarget={stateFillRef}
        reducedMotion={reducedMotion}
      />

      {/* Reservoir tank */}
      <CylinderTank
        position={[RESERVOIR_X, 0, 0]}
        radius={RESERVOIR_RADIUS}
        height={RESERVOIR_HEIGHT}
        color={COL_AMBER}
        fillTarget={reservoirFillRef}
        reducedMotion={reducedMotion}
      />

      {/* Cap bar on state creation tank */}
      <StateCapBar reducedMotion={reducedMotion} />

      {/* Overflow pipe: execution -> reservoir */}
      <OverflowPipe start={execPipeStart} end={execPipeEnd} sagY={-0.5} />
      <OverflowParticles
        start={execPipeStart}
        end={execPipeEnd}
        sagY={-0.5}
        count={16}
        color={COL_BLUE}
        activeRef={execOverflowRef}
        reducedMotion={reducedMotion}
      />

      {/* Overflow pipe: state creation -> reservoir */}
      <OverflowPipe start={statePipeStart} end={statePipeEnd} sagY={-0.4} />
      <OverflowParticles
        start={statePipeStart}
        end={statePipeEnd}
        sagY={-0.4}
        count={24}
        color={COL_PURPLE}
        activeRef={stateOverflowRef}
        reducedMotion={reducedMotion}
      />

      {/* Labels */}
      <TankLabels />
      <PriceLabels reducedMotion={reducedMotion} />

      {/* Legacy contract cube */}
      <LegacyCube reducedMotion={reducedMotion} />
    </>
  )
}

/* ── Ground plane ── */

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -EXEC_HEIGHT / 2 - 0.3, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ background: COL_BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Execution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ background: COL_PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">State creation</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ background: COL_AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Reservoir</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ background: COL_RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Overflow / spike</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-zinc-400 border border-zinc-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Legacy contract</span>
      </div>
    </div>
  )
}

/* ── Exported component ── */

export function GasReservoir3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Glamsterdam gas reservoir: specialized tanks overflow into a shared reservoir for backward compatibility"
      srDescription="Three gas tanks connected by overflow pipes. Execution and state creation have independent budgets. Legacy contracts see a single reservoir number. During an NFT mint storm, state creation fills up and overflows into the reservoir while execution stays stable."
      legend={<Legend />}
      fallbackText="Gas reservoir — specialized dimensions overflow into shared reservoir for backward compatibility"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 5, 8], fov: 36 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          <Ground />
          <SceneOrchestrator reducedMotion={reducedMotion} />

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
