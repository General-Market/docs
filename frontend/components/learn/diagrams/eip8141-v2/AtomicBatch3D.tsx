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

const CYCLE = 10 // seconds

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#ef4444'

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Clamp 0-1 */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Map a cycle range to 0-1 with easing */
function rangeT(cycleT: number, start: number, end: number): number {
  if (cycleT < start) return 0
  if (cycleT >= end) return 1
  return easeInOut((cycleT - start) / (end - start))
}

/* ------------------------------------------------------------------ */
/*  TX Box -- reusable rounded box for a transaction                   */
/* ------------------------------------------------------------------ */

function TxBox({
  position,
  size,
  color,
  opacity = 0.22,
}: {
  position: [number, number, number]
  size: [number, number, number]
  color: string
  opacity?: number
}) {
  return (
    <group position={position}>
      <RoundedBox args={size} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.5} />
      </RoundedBox>
      <mesh>
        <boxGeometry args={[size[0] + 0.02, size[1] + 0.02, size[2] + 0.02]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE section: TX 1 and TX 2 with a gap between them              */
/* ------------------------------------------------------------------ */

function BeforeSection({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const tx1Ref = useRef<THREE.Group>(null!)
  const tx2Ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 0-0.4: visible at original positions
    // 0.4-0.6: TX 1 and TX 2 slide toward center and down, merging
    // 0.6-0.8: faded out (the unified block is now showing)
    // 0.8-1.0: reset

    const mergeT = rangeT(cycleT, 0.4, 0.6)
    const resetFade = cycleT > 0.8 ? rangeT(cycleT, 0.8, 0.85) : 0

    // TX positions: slide toward center
    const tx1X = -2 + mergeT * 2 // -2 -> 0
    const tx2X = 2 - mergeT * 2 //  2 -> 0
    const slideY = 1.5 - mergeT * 2.5 // 1.5 -> -1

    if (tx1Ref.current) {
      tx1Ref.current.position.x = tx1X
      tx1Ref.current.position.y = slideY
    }
    if (tx2Ref.current) {
      tx2Ref.current.position.x = tx2X
      tx2Ref.current.position.y = slideY
    }

    // Fade out once merged
    const fadeOut = mergeT > 0.9 ? 1 - clamp01((mergeT - 0.9) / 0.1) : 1
    // Fade back in on reset
    const fadeIn = cycleT > 0.8 ? resetFade : 1

    groupRef.current.visible = true
    if (mergeT >= 1) {
      groupRef.current.visible = false
    }
    if (cycleT > 0.8) {
      groupRef.current.visible = true
      // Reset positions
      if (tx1Ref.current) {
        tx1Ref.current.position.set(-2, 1.5, 0)
      }
      if (tx2Ref.current) {
        tx2Ref.current.position.set(2, 1.5, 0)
      }
    }

    // Opacity on children
    groupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial
        if ('opacity' in mat && mat.transparent) {
          // Don't override gap pulse materials — handled separately
        }
      }
    })

    void fadeOut
    void fadeIn
  })

  return (
    <group ref={groupRef}>
      {/* TX 1: Approve */}
      <group ref={tx1Ref} position={[-2, 1.5, 0]}>
        <TxBox position={[0, 0, 0]} size={[1.6, 0.7, 1.0]} color={BLUE} />
        <Html center position={[0, 0.55, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
            TX 1: Approve
          </p>
        </Html>
      </group>

      {/* TX 2: Swap */}
      <group ref={tx2Ref} position={[2, 1.5, 0]}>
        <TxBox position={[0, 0, 0]} size={[1.6, 0.7, 1.0]} color={BLUE} />
        <Html center position={[0, 0.55, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
            TX 2: Swap
          </p>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Vulnerability gap: red pulsing zone between TX 1 and TX 2          */
/* ------------------------------------------------------------------ */

function VulnerabilityGap({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const borderRef = useRef<THREE.Mesh>(null!)
  const labelRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Gap visible 0-0.4, fades during merge 0.4-0.6, gone 0.6+, reappears 0.8+
    const visible = cycleT < 0.4 || cycleT > 0.85
    const fadeForMerge = cycleT < 0.4 ? 1 : cycleT > 0.85 ? rangeT(cycleT, 0.85, 0.95) : 0

    if (meshRef.current) {
      meshRef.current.visible = visible
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      // Pulse red
      const pulse = 0.08 + Math.sin(elapsedRef.current * 3) * 0.04
      mat.opacity = pulse * fadeForMerge
    }

    if (borderRef.current) {
      borderRef.current.visible = visible
      const mat = borderRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 * fadeForMerge
    }

    if (labelRef.current) {
      labelRef.current.visible = visible
    }
  })

  return (
    <group position={[0, 1.5, 0]}>
      {/* Red translucent gap fill */}
      <mesh ref={meshRef}>
        <boxGeometry args={[1.8, 0.74, 1.04]} />
        <meshStandardMaterial
          color={RED}
          transparent
          opacity={0.08}
          emissive={RED}
          emissiveIntensity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Dashed border wireframe */}
      <mesh ref={borderRef}>
        <boxGeometry args={[1.82, 0.76, 1.06]} />
        <meshBasicMaterial color={RED} wireframe transparent opacity={0.4} />
      </mesh>

      {/* VULNERABILITY WINDOW label */}
      <group ref={labelRef}>
        <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-red-300 rounded px-2 py-0.5">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
              VULNERABILITY WINDOW
            </p>
          </div>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Attacker arrow: red cone that drops into the gap                   */
/* ------------------------------------------------------------------ */

function AttackerArrow({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const coneRef = useRef<THREE.Mesh>(null!)
  const lineRef = useRef<THREE.Mesh>(null!)
  const flashRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Attacker drops during 0.2-0.4 (2-4s)
    const dropT = rangeT(cycleT, 0.2, 0.35)
    // Bounce off during 0.4-0.6
    const bounceT = rangeT(cycleT, 0.4, 0.55)
    // Reset fade
    const resetShow = cycleT > 0.85 ? 0 : 1

    const visible = cycleT > 0.2 && cycleT < 0.55
    groupRef.current.visible = visible

    if (visible) {
      // Drop from y=4 to y=1.5
      const dropY = 4 - dropT * 2.5 // 4 -> 1.5
      // Bounce away: go up and to the side
      const bounceY = 1.5 + bounceT * 2
      const bounceX = bounceT * 2.5

      const finalY = dropT < 1 ? dropY : bounceY
      const finalX = dropT < 1 ? 0 : bounceX

      groupRef.current.position.set(finalX, finalY, 0)

      // Scale during bounce
      const scale = dropT < 1 ? dropT : 1 - bounceT * 0.8
      groupRef.current.scale.setScalar(Math.max(scale, 0.01))
    }

    // Flash on impact
    if (flashRef.current) {
      const impactFlash = cycleT > 0.34 && cycleT < 0.42
      flashRef.current.visible = impactFlash
      if (impactFlash) {
        const flashProgress = (cycleT - 0.34) / 0.08
        const mat = flashRef.current.material as THREE.MeshStandardMaterial
        mat.opacity = 0.4 * Math.sin(flashProgress * Math.PI)
      }
    }

    void resetShow
  })

  return (
    <>
      <group ref={groupRef} position={[0, 4, 0]}>
        {/* Arrow shaft */}
        <mesh ref={lineRef} position={[0, 0.6, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.8, 8]} />
          <meshStandardMaterial color={RED} roughness={0.4} />
        </mesh>
        {/* Arrow head (cone pointing down) */}
        <mesh ref={coneRef} position={[0, 0.1, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.15, 0.35, 8]} />
          <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.3} />
        </mesh>
      </group>

      {/* Impact flash sphere at gap center */}
      <mesh ref={flashRef} position={[0, 1.5, 0]} visible={false}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial
          color={RED}
          transparent
          opacity={0}
          emissive={RED}
          emissiveIntensity={0.8}
          side={THREE.BackSide}
        />
      </mesh>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER section: Unified Frame TX with inner compartments            */
/* ------------------------------------------------------------------ */

function AfterSection({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const outerRef = useRef<THREE.Mesh>(null!)
  const f0Ref = useRef<THREE.Group>(null!)
  const f1Ref = useRef<THREE.Group>(null!)
  const f2Ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Dimmer until 0.6, then prominent
    const prominenceT = rangeT(cycleT, 0.55, 0.65)
    // Reset
    const resetT = cycleT > 0.8 ? rangeT(cycleT, 0.8, 0.9) : 0

    const dimOpacity = 0.08 + prominenceT * 0.14
    const resetOpacity = 0.08 + (1 - resetT) * prominenceT * 0.14

    const finalOpacity = cycleT > 0.8 ? 0.08 + (1 - resetT) * 0.14 : dimOpacity

    // Outer wireframe
    if (outerRef.current) {
      const mat = outerRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = clamp01(finalOpacity + 0.1)
    }

    // Sequential glow on inner frames during 0.6-0.8
    const f0Glow = rangeT(cycleT, 0.6, 0.67)
    const f1Glow = rangeT(cycleT, 0.67, 0.74)
    const f2Glow = rangeT(cycleT, 0.74, 0.8)

    const applyGlow = (ref: THREE.Group | null, glow: number) => {
      if (!ref) return
      ref.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshStandardMaterial
          if (mat.emissive) {
            mat.emissiveIntensity = glow * 0.6
          }
        }
      })
    }

    applyGlow(f0Ref.current, Math.sin(f0Glow * Math.PI))
    applyGlow(f1Ref.current, Math.sin(f1Glow * Math.PI))
    applyGlow(f2Ref.current, Math.sin(f2Glow * Math.PI))

    void resetOpacity
  })

  return (
    <group ref={groupRef} position={[0, -1, 0]}>
      {/* Outer Frame TX container */}
      <mesh ref={outerRef}>
        <boxGeometry args={[5.2, 0.9, 1.4]} />
        <meshBasicMaterial color={GREEN} wireframe transparent opacity={0.2} />
      </mesh>

      {/* F0: Validate compartment */}
      <group ref={f0Ref} position={[-1.7, 0, 0]}>
        <RoundedBox args={[1.3, 0.7, 1.1]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            color={GREEN}
            transparent
            opacity={0.18}
            roughness={0.6}
            emissive={GREEN}
            emissiveIntensity={0}
          />
        </RoundedBox>
      </group>

      {/* F1: Approve compartment */}
      <group ref={f1Ref} position={[0, 0, 0]}>
        <RoundedBox args={[1.3, 0.7, 1.1]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            color={GREEN}
            transparent
            opacity={0.18}
            roughness={0.6}
            emissive={GREEN}
            emissiveIntensity={0}
          />
        </RoundedBox>
      </group>

      {/* F2: Swap compartment */}
      <group ref={f2Ref} position={[1.7, 0, 0]}>
        <RoundedBox args={[1.3, 0.7, 1.1]} radius={0.05} smoothness={4}>
          <meshStandardMaterial
            color={GREEN}
            transparent
            opacity={0.18}
            roughness={0.6}
            emissive={GREEN}
            emissiveIntensity={0}
          />
        </RoundedBox>
      </group>

      {/* Frame TX label */}
      <Html center position={[0, -0.65, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>
          Frame TX: Atomic
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame compartment labels (transient, only during 0.6-0.8)          */
/* ------------------------------------------------------------------ */

function FrameLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Only visible when after section is prominent (0.6-0.8)
    ref.current.visible = reducedMotion || (cycleT > 0.6 && cycleT < 0.8)
  })

  return (
    <group ref={ref} position={[0, -1, 0]}>
      <Html center position={[-1.7, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>F0 Validate</p>
      </Html>
      <Html center position={[0, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>F1 Approve</p>
      </Html>
      <Html center position={[1.7, 0.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>F2 Swap</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "No gap" transient label (appears 6-8s)                            */
/* ------------------------------------------------------------------ */

function NoGapLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during 0.6-0.8 (6-8s)
    ref.current.visible = reducedMotion || (cycleT > 0.6 && cycleT < 0.8)
  })

  return (
    <group ref={ref}>
      <Html center position={[0, -2.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-green-50 border border-green-300 rounded-md px-3 py-1">
          <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            No gap = no front-running
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Section divider line between BEFORE and AFTER                      */
/* ------------------------------------------------------------------ */

function SectionDivider() {
  return (
    <group position={[0, 0.25, 0]}>
      <RoundedBox args={[6.0, 0.01, 0.01]} radius={0.002} smoothness={4}>
        <meshBasicMaterial color="#d1d5db" transparent opacity={0.5} />
      </RoundedBox>
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

      {/* Section divider */}
      <SectionDivider />

      {/* ------ BEFORE: Two separate TXs with a gap ------ */}
      <BeforeSection reducedMotion={reducedMotion} />
      <VulnerabilityGap reducedMotion={reducedMotion} />
      <AttackerArrow reducedMotion={reducedMotion} />

      {/* ------ AFTER: Unified Frame TX ------ */}
      <AfterSection reducedMotion={reducedMotion} />
      <FrameLabels reducedMotion={reducedMotion} />
      <NoGapLabel reducedMotion={reducedMotion} />

      {/* ------ Camera ------ */}
      <AutoFitCamera points={[[-4, 2.5, 1.5], [4, 2.5, 1.5], [-4, -2.5, -1.5], [4, -2.5, -1.5]]} />

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

export function AtomicBatch3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Comparison of separate transactions with a vulnerability gap versus an atomic Frame TX that eliminates the gap"
      srDescription="A 3D scene with two sections. Upper: two blue boxes labeled TX 1 Approve and TX 2 Swap with a red pulsing gap between them labeled VULNERABILITY WINDOW. A red arrow drops into the gap representing an attacker exploiting the window between transactions. Lower: a single green Frame TX box with three compartments (F0 Validate, F1 Approve, F2 Swap) representing the atomic batch. The key insight: separate transactions create exploitable gaps, while a Frame TX eliminates them by bundling operations atomically."
      legend={<SceneLegend items={[{ color: BLUE, label: 'Separate TX' }, { color: RED, label: 'Attack / vulnerability' }, { color: GREEN, label: 'Atomic Frame TX' }]} />}
      fallbackText="Separate TXs have a gap between Approve and Swap that attackers can exploit. A Frame TX bundles F0 Validate, F1 Approve, and F2 Swap atomically with no gap and no front-running opportunity."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 7], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
