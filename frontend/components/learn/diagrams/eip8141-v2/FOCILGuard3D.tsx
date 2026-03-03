'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { SceneLegend } from '../scaling/shared/SceneLegend'
import { AutoFitCamera } from '../scaling/shared/AutoFitCamera'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEFT_X = -3
const RIGHT_X = 3
const CYCLE = 8

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#ef4444'
const GRAY = '#9ca3af'

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
/*  Left Platform ("Without FOCIL")                                    */
/* ------------------------------------------------------------------ */

function LeftPlatform() {
  return (
    <group position={[LEFT_X, 0, 0]}>
      <RoundedBox args={[4.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[4.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 2.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>
          Without FOCIL
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Platform ("With FOCIL")                                      */
/* ------------------------------------------------------------------ */

function RightPlatform() {
  return (
    <group position={[RIGHT_X, 0, 0]}>
      <RoundedBox args={[4.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[4.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 2.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>
          With FOCIL
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[0.02, 0.2, 3.0]} radius={0.004} smoothness={4} position={[0, 0.1, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Gate (arch with two pillars)                                       */
/* ------------------------------------------------------------------ */

function Gate({
  position,
  color,
}: {
  position: [number, number, number]
  color: string
}) {
  return (
    <group position={position}>
      {/* Left pillar */}
      <RoundedBox args={[0.1, 1.4, 0.1]} radius={0.02} smoothness={4} position={[0, 0.7, -0.7]}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
      {/* Right pillar */}
      <RoundedBox args={[0.1, 1.4, 0.1]} radius={0.02} smoothness={4} position={[0, 0.7, 0.7]}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
      {/* Arch */}
      <RoundedBox args={[0.1, 0.1, 1.5]} radius={0.02} smoothness={4} position={[0, 1.42, 0]}>
        <meshStandardMaterial color={color} roughness={0.4} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Red X Mark (two crossed bars)                                      */
/* ------------------------------------------------------------------ */

function RedX({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 2-6s (0.25-0.75)
    const appear = rangeT(cycleT, 0.25, 0.35)
    const fadeOut = cycleT > 0.75 ? 1 - rangeT(cycleT, 0.75, 0.85) : 1
    const s = appear * fadeOut
    groupRef.current.scale.setScalar(Math.max(s, 0.001))
    groupRef.current.visible = reducedMotion || s > 0.01
  })

  return (
    <group ref={groupRef} position={[LEFT_X + 0.6, 0.7, 0]}>
      {/* Bar 1 (diagonal \) */}
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.06, 0.55, 0.06]} />
        <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.3} />
      </mesh>
      {/* Bar 2 (diagonal /) */}
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.06, 0.55, 0.06]} />
        <meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Green Shield (semi-transparent plane behind right gate)            */
/* ------------------------------------------------------------------ */

function GreenShield({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible from 0.25 through 0.85
    const appear = rangeT(cycleT, 0.2, 0.3)
    const fadeOut = cycleT > 0.75 ? 1 - rangeT(cycleT, 0.75, 0.85) : 1
    const opacity = 0.25 * appear * fadeOut
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = opacity
    meshRef.current.visible = reducedMotion || opacity > 0.005
    // Gentle pulse
    if (appear >= 1 && !reducedMotion) {
      mat.emissiveIntensity = 0.3 + Math.sin(elapsedRef.current * 2) * 0.15
    }
  })

  return (
    <mesh ref={meshRef} position={[RIGHT_X + 0.3, 0.7, 0]} visible={false}>
      <planeGeometry args={[0.8, 1.3]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0}
        emissive={GREEN}
        emissiveIntensity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Transaction Cube (animated, moves from left to right through gate) */
/* ------------------------------------------------------------------ */

function TxCube({
  side,
  color,
  startZ,
  startDelay,
  rejected,
  reducedMotion,
}: {
  side: 'left' | 'right'
  color: string
  startZ: number
  startDelay: number
  rejected: boolean
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const baseX = side === 'left' ? LEFT_X : RIGHT_X
  // Cubes approach from -1.5 to +0.3 (gate is at ~+0.2)
  const xStart = baseX - 1.5
  const xGate = baseX + 0.2
  const xEnd = baseX + 1.5

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Phase 1: approach (0-2s = 0.0-0.25)
    const approachStart = startDelay
    const approachEnd = 0.25
    const approach = rangeT(cycleT, approachStart, approachEnd)

    // Phase 2: pass or reject (2-4s = 0.25-0.5)
    const passStart = 0.25
    const passEnd = 0.5

    // Reset visibility during hold/reset phase
    const resetFade = cycleT > 0.85 ? 1 - rangeT(cycleT, 0.85, 1.0) : 1

    let x: number
    let y = 0.35
    let visible = true

    if (cycleT < approachStart) {
      // Not yet visible
      visible = false
      x = xStart
    } else if (cycleT < approachEnd) {
      // Approaching gate
      x = THREE.MathUtils.lerp(xStart, xGate, approach)
    } else if (cycleT < passEnd) {
      const passT = rangeT(cycleT, passStart, passEnd)
      if (rejected) {
        // Bounce back: move from gate backwards
        x = THREE.MathUtils.lerp(xGate, xStart - 0.5, passT)
        // Bounce arc
        y = 0.35 + Math.sin(passT * Math.PI) * 0.4
      } else {
        // Pass through gate
        x = THREE.MathUtils.lerp(xGate, xEnd, passT)
      }
    } else if (cycleT < 0.85) {
      // Hold at final position
      if (rejected) {
        visible = false
        x = xStart - 0.5
      } else {
        x = xEnd
      }
    } else {
      // Fade out
      x = rejected ? xStart - 0.5 : xEnd
      visible = resetFade > 0.01
    }

    groupRef.current.position.set(x, y, startZ)
    groupRef.current.visible = visible
    const s = clamp01(resetFade)
    groupRef.current.scale.setScalar(Math.max(s, 0.001))
  })

  return (
    <group ref={groupRef} position={[xStart, 0.35, startZ]}>
      <RoundedBox args={[0.28, 0.28, 0.28]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={color} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "Builder censors" transient label (left side, 2-4s)                */
/* ------------------------------------------------------------------ */

function BuilderCensorsLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 2-4s (0.25-0.5) — fades before "Censored" appears to stay within 5 labels
    ref.current.visible = reducedMotion || (cycleT > 0.3 && cycleT < 0.5)
  })

  return (
    <group ref={ref}>
      <Html center position={[LEFT_X + 0.6, 1.3, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-red-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
            Builder censors
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "Committee forces inclusion" transient label (right side, 2-4s)    */
/* ------------------------------------------------------------------ */

function CommitteeLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 2-4s (0.25-0.5) — fades before "Protected" appears to stay within 5 labels
    ref.current.visible = reducedMotion || (cycleT > 0.3 && cycleT < 0.5)
  })

  return (
    <group ref={ref}>
      <Html center position={[RIGHT_X + 0.3, 1.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-green-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            Committee forces inclusion
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "Censored" label (left side, appears 4-6s)                         */
/* ------------------------------------------------------------------ */

function CensoredLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 4-6s (0.5-0.8) — replaces "Builder censors" label
    ref.current.visible = reducedMotion || (cycleT > 0.5 && cycleT < 0.8)
  })

  return (
    <group ref={ref}>
      <Html center position={[LEFT_X, -0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-red-50 border border-red-300 rounded px-3 py-1">
          <p className="text-[11px] font-bold whitespace-nowrap" style={{ color: RED }}>
            Censored
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "Protected" label (right side, appears 4-6s)                       */
/* ------------------------------------------------------------------ */

function ProtectedLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 4-6s (0.5-0.8) — replaces "Committee forces" label
    ref.current.visible = reducedMotion || (cycleT > 0.5 && cycleT < 0.8)
  })

  return (
    <group ref={ref}>
      <Html center position={[RIGHT_X, -0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-green-50 border border-green-300 rounded px-3 py-1">
          <p className="text-[11px] font-bold whitespace-nowrap" style={{ color: GREEN }}>
            Protected
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

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

      {/* Platforms + divider */}
      <LeftPlatform />
      <RightPlatform />
      <Divider />

      {/* ------ LEFT SIDE: Without FOCIL ------ */}
      {/* Gate structure */}
      <Gate position={[LEFT_X + 0.2, 0.08, 0]} color="#6b7280" />

      {/* Gray cubes (EOA TXs) -- pass through on left */}
      <TxCube
        side="left"
        color={GRAY}
        startZ={-0.4}
        startDelay={0.0}
        rejected={false}
        reducedMotion={reducedMotion}
      />
      <TxCube
        side="left"
        color={GRAY}
        startZ={0.4}
        startDelay={0.03}
        rejected={false}
        reducedMotion={reducedMotion}
      />

      {/* Blue cubes (Frame TXs) -- REJECTED on left */}
      <TxCube
        side="left"
        color={BLUE}
        startZ={0.0}
        startDelay={0.02}
        rejected={true}
        reducedMotion={reducedMotion}
      />

      {/* Red X mark */}
      <RedX reducedMotion={reducedMotion} />

      {/* ------ RIGHT SIDE: With FOCIL ------ */}
      {/* Gate structure */}
      <Gate position={[RIGHT_X + 0.2, 0.08, 0]} color="#6b7280" />

      {/* Green shield behind gate */}
      <GreenShield reducedMotion={reducedMotion} />

      {/* Gray cubes (EOA TXs) -- pass through on right */}
      <TxCube
        side="right"
        color={GRAY}
        startZ={-0.4}
        startDelay={0.0}
        rejected={false}
        reducedMotion={reducedMotion}
      />
      <TxCube
        side="right"
        color={GRAY}
        startZ={0.4}
        startDelay={0.03}
        rejected={false}
        reducedMotion={reducedMotion}
      />

      {/* Blue cubes (Frame TXs) -- PASS on right */}
      <TxCube
        side="right"
        color={BLUE}
        startZ={0.0}
        startDelay={0.02}
        rejected={false}
        reducedMotion={reducedMotion}
      />

      {/* ------ Transient labels ------ */}
      <BuilderCensorsLabel reducedMotion={reducedMotion} />
      <CommitteeLabel reducedMotion={reducedMotion} />
      <CensoredLabel reducedMotion={reducedMotion} />
      <ProtectedLabel reducedMotion={reducedMotion} />

      {/* ------ Camera ------ */}
      <AutoFitCamera points={[[-5, 2.5, 1.5], [5, 2.5, 1.5], [-5, -0.5, -1.5], [5, -0.5, -1.5]]} />

      {/* ------ Controls ------ */}
      <OrbitControls
        enableZoom
        minDistance={3}
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

export function FOCILGuard3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Side-by-side comparison showing how FOCIL prevents builder censorship of Frame transactions"
      srDescription="A 3D scene with two halves separated by a divider. Left (Without FOCIL): blue Frame TX cubes and gray EOA TX cubes approach a gate. The gray cubes pass through but the blue cubes hit a red X and bounce back, showing censorship. Right (With FOCIL): all cubes pass through the gate, protected by a green semi-transparent shield representing the FOCIL inclusion committee."
      legend={<SceneLegend items={[{ color: BLUE, label: 'Frame TX' }, { color: GRAY, label: 'EOA TX' }, { color: GREEN, label: 'FOCIL shield' }, { color: RED, label: 'Censorship' }]} />}
      fallbackText="Without FOCIL: a builder can censor Frame TXs while allowing EOA TXs through. With FOCIL: a committee forces inclusion of all transactions, preventing censorship."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 3, 7], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
