'use client'

import { useRef, useMemo } from 'react'
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

const CYCLE = 10 // 10-second animation loop

const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const BLUE = '#3b82f6'
const INDIGO = '#6366f1'

const PLOT_POS: [number, number, number] = [0, 0, 0]
const FACTORY_POS: [number, number, number] = [-2, 2.5, 0]
const SIGN_POS: [number, number, number] = [0, 1.5, 0]

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Map a cycle range [start, end] to eased 0-1 */
function rangeT(cycleT: number, start: number, end: number): number {
  if (cycleT < start) return 0
  if (cycleT >= end) return 1
  return easeInOut((cycleT - start) / (end - start))
}

/* ------------------------------------------------------------------ */
/*  Platform (ground plane)                                            */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, -0.02, 0]}>
      <RoundedBox args={[5.4, 0.02, 4.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.0, 0.04, 4.0]} radius={0.02} smoothness={4} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty Plot (gray flat RoundedBox -- the "lot")                     */
/* ------------------------------------------------------------------ */

function EmptyPlot({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const wireRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !matRef.current || !wireRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible throughout, but wireframe pulses 0-0.2, fades as house builds
    if (cycleT < 0.2) {
      wireRef.current.opacity = 0.3 + Math.sin(elapsedRef.current * 3) * 0.1
      matRef.current.opacity = 0.6
    } else if (cycleT < 0.4) {
      const fadeOut = 1 - rangeT(cycleT, 0.2, 0.4)
      wireRef.current.opacity = 0.3 * fadeOut
      matRef.current.opacity = 0.6 * fadeOut
    } else {
      wireRef.current.opacity = 0.05
      matRef.current.opacity = 0.15
    }
  })

  return (
    <group position={[PLOT_POS[0], 0.02, PLOT_POS[2]]}>
      {/* Flat gray plot */}
      <RoundedBox args={[2.0, 0.06, 2.0]} radius={0.02} smoothness={4}>
        <meshStandardMaterial ref={matRef} color="#a1a1aa" transparent opacity={0.6} roughness={0.8} />
      </RoundedBox>
      {/* Wireframe outline */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[1.8, 1.0, 1.8]} />
        <meshBasicMaterial ref={wireRef} color="#a1a1aa" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Address Sign (thin box with text -- glows blue, persistent)        */
/* ------------------------------------------------------------------ */

function AddressSign({ reducedMotion }: { reducedMotion: boolean }) {
  const signRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !signRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const mat = signRef.current.material as THREE.MeshStandardMaterial
    // Pulse blue during 0-0.2, then steady
    if (cycleT < 0.2) {
      mat.emissiveIntensity = 0.35 + Math.sin(elapsedRef.current * 5) * 0.2
    } else {
      mat.emissiveIntensity = 0.15
    }
  })

  return (
    <group position={[SIGN_POS[0] + 1.3, 0, SIGN_POS[2] + 0.9]}>
      {/* Post */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.04, 1.1, 0.04]} />
        <meshStandardMaterial color="#71717a" roughness={0.5} />
      </mesh>
      {/* Sign board */}
      <mesh ref={signRef} position={[0, 1.0, 0]}>
        <boxGeometry args={[0.6, 0.28, 0.04]} />
        <meshStandardMaterial color={BLUE} roughness={0.3} emissive={BLUE} emissiveIntensity={0.35} />
      </mesh>
      {/* Persistent address label */}
      <Html center position={[0, 1.45, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
          0x1a2b...3c4d
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Pre-funded Coins (amber small spheres sitting on the empty plot)   */
/* ------------------------------------------------------------------ */

function PreFundedCoins({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const positions = useMemo(
    () => [
      [-0.3, 0.18, -0.2],
      [0.25, 0.18, 0.15],
      [-0.1, 0.18, 0.35],
      [0.35, 0.18, -0.3],
      [0.0, 0.35, 0.0],
    ] as [number, number, number][],
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    if (cycleT < 0.2) {
      // Coins sitting on empty plot, gentle bob
      groupRef.current.visible = true
      groupRef.current.scale.setScalar(1)
      groupRef.current.position.y = Math.sin(elapsedRef.current * 1.5) * 0.02
    } else if (cycleT < 0.4) {
      // Coins shrink as house builds around them
      groupRef.current.visible = true
      const t = rangeT(cycleT, 0.2, 0.35)
      groupRef.current.scale.setScalar(1 - t * 0.6)
      groupRef.current.position.y = -t * 0.1
    } else if (cycleT < 0.6) {
      // Hidden during validate
      groupRef.current.visible = false
    } else if (cycleT < 0.8) {
      // Reappear inside house (coins absorbed during execute)
      groupRef.current.visible = true
      const t = rangeT(cycleT, 0.6, 0.65)
      groupRef.current.scale.setScalar(t * 0.65)
      groupRef.current.position.y = 0.15
    } else if (cycleT < 0.95) {
      groupRef.current.visible = true
      groupRef.current.scale.setScalar(0.65)
      groupRef.current.position.y = 0.15
    } else {
      // Reset
      groupRef.current.visible = false
      groupRef.current.position.y = 0
    }
  })

  return (
    <group ref={groupRef}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color={AMBER} roughness={0.3} emissive={AMBER} emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Factory Node (indigo hexagonal prism -- hovers above-left)         */
/* ------------------------------------------------------------------ */

function FactoryNode({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    ref.current.position.y = FACTORY_POS[1] + Math.sin(elapsedRef.current * 1.0) * 0.03
  })

  return (
    <group>
      <mesh ref={ref} position={FACTORY_POS}>
        <cylinderGeometry args={[0.45, 0.45, 0.6, 6]} />
        <meshStandardMaterial color={INDIGO} roughness={0.4} emissive={INDIGO} emissiveIntensity={0.12} />
      </mesh>
      <Html center position={[FACTORY_POS[0], FACTORY_POS[1] + 0.55, FACTORY_POS[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: INDIGO }}>Factory</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Deploy Beam (blue tube from Factory down to plot)                  */
/* ------------------------------------------------------------------ */

function DeployBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(FACTORY_POS[0] + 0.4, FACTORY_POS[1] - 0.3, FACTORY_POS[2]),
      new THREE.Vector3(FACTORY_POS[0] + 1.0, 1.5, FACTORY_POS[2]),
      new THREE.Vector3(PLOT_POS[0], 1.0, PLOT_POS[2]),
    )
    return new THREE.TubeGeometry(curve, 24, 0.025, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible 0.2-0.4 (2-4s) -- Deploy phase
    const visible = cycleT >= 0.2 && cycleT < 0.4
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.2) / 0.2)
      matRef.current.opacity = 0.5 + Math.sin(progress * Math.PI) * 0.4
    }
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshBasicMaterial ref={matRef} color={BLUE} transparent opacity={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Construction Particles (InstancedMesh -- spiral during deploy)     */
/* ------------------------------------------------------------------ */

function ConstructionParticles({ count = 20, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        speed: 0.7 + Math.random() * 0.5,
        radius: 0.3 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Active 0.2-0.4 (2-4s)
    const active = cycleT >= 0.2 && cycleT < 0.4
    const buildProgress = active ? clamp01((cycleT - 0.2) / 0.2) : 0

    for (let i = 0; i < count; i++) {
      const o = offsets[i]
      if (active) {
        const t = elapsedRef.current * o.speed + o.phase
        const spiralY = buildProgress * 1.0 * ((i % 5) / 5) + Math.sin(t * 2) * 0.04
        const r = o.radius * (1 - buildProgress * 0.6)
        dummy.position.set(
          PLOT_POS[0] + Math.cos(t + o.angle) * r,
          0.1 + spiralY,
          PLOT_POS[2] + Math.sin(t + o.angle) * r,
        )
        const s = 0.022 * (1 - buildProgress * 0.4) * (Math.sin(t * 3) * 0.3 + 0.7)
        dummy.scale.setScalar(s)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={BLUE} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  House / Wallet (RoundedBox -- materializes scale 0->1, purple)     */
/*  Purple during deploy, glows purple during validate, green execute  */
/* ------------------------------------------------------------------ */

function House({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const wallRef = useRef<THREE.MeshStandardMaterial>(null!)
  const roofRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !wallRef.current || !roofRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    let scale: number
    let wallEmissive = 0.06

    if (cycleT < 0.2) {
      // Not yet deployed
      scale = 0
    } else if (cycleT < 0.4) {
      // Build animation (2-4s) -- materializes purple
      scale = easeInOut(clamp01((cycleT - 0.2) / 0.2))
      wallRef.current.color.set(PURPLE)
      roofRef.current.color.set(PURPLE)
      wallRef.current.emissive.set(PURPLE)
      roofRef.current.emissive.set(PURPLE)
      wallEmissive = 0.1
    } else if (cycleT < 0.6) {
      // Validate phase (4-6s) -- purple glow intensifies
      scale = 1
      wallRef.current.color.set(PURPLE)
      roofRef.current.color.set(PURPLE)
      wallRef.current.emissive.set(PURPLE)
      roofRef.current.emissive.set(PURPLE)
      const vt = (cycleT - 0.4) / 0.2
      wallEmissive = 0.15 + Math.sin(vt * Math.PI * 3) * 0.1
    } else if (cycleT < 0.8) {
      // Execute phase (6-8s) -- transitions to green
      scale = 1
      const t = rangeT(cycleT, 0.6, 0.65)
      const purpleC = new THREE.Color(PURPLE)
      const greenC = new THREE.Color(GREEN)
      const blended = purpleC.lerp(greenC, t)
      wallRef.current.color.copy(blended)
      roofRef.current.color.copy(blended)
      wallRef.current.emissive.set(GREEN)
      roofRef.current.emissive.set(GREEN)
      wallEmissive = 0.12
    } else if (cycleT < 0.95) {
      // Hold
      scale = 1
      wallRef.current.color.set(GREEN)
      roofRef.current.color.set(GREEN)
      wallRef.current.emissive.set(GREEN)
      roofRef.current.emissive.set(GREEN)
      wallEmissive = 0.06
    } else {
      // Reset
      scale = 1 - easeInOut((cycleT - 0.95) / 0.05)
      wallRef.current.color.set(GREEN)
      roofRef.current.color.set(GREEN)
      wallRef.current.emissive.set(GREEN)
      roofRef.current.emissive.set(GREEN)
      wallEmissive = 0.06
    }

    ref.current.scale.setScalar(Math.max(scale, 0.001))
    ref.current.visible = scale > 0.001
    wallRef.current.emissiveIntensity = wallEmissive
    roofRef.current.emissiveIntensity = wallEmissive
  })

  return (
    <group ref={ref} position={[PLOT_POS[0], 0, PLOT_POS[2]]}>
      {/* Walls */}
      <RoundedBox args={[1.4, 0.8, 1.4]} radius={0.06} smoothness={4} position={[0, 0.45, 0]}>
        <meshStandardMaterial ref={wallRef} color={PURPLE} roughness={0.5} emissive={PURPLE} emissiveIntensity={0.06} />
      </RoundedBox>
      {/* Roof (slightly wider, tapered) */}
      <mesh position={[0, 1.05, 0]}>
        <coneGeometry args={[1.0, 0.5, 4]} />
        <meshStandardMaterial ref={roofRef} color={PURPLE} roughness={0.4} emissive={PURPLE} emissiveIntensity={0.06} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Lock on House Face (appears during validate, rotates)              */
/* ------------------------------------------------------------------ */

function ValidateLock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible 0.4-0.6 (4-6s)
    const visible = cycleT >= 0.4 && cycleT < 0.6
    groupRef.current.visible = visible

    if (visible) {
      const progress = (cycleT - 0.4) / 0.2
      // Rotate lock
      groupRef.current.rotation.y = progress * Math.PI * 2
      // Scale in then settle
      const scaleIn = rangeT(cycleT, 0.4, 0.45)
      groupRef.current.scale.setScalar(0.2 + scaleIn * 0.8)
    }
  })

  return (
    <group ref={groupRef} position={[PLOT_POS[0], 0.55, PLOT_POS[2] + 0.72]} visible={false}>
      {/* Lock body */}
      <RoundedBox args={[0.3, 0.24, 0.12]} radius={0.03} smoothness={4}>
        <meshStandardMaterial color={PURPLE} roughness={0.35} emissive={PURPLE} emissiveIntensity={0.25} />
      </RoundedBox>
      {/* Shackle */}
      <mesh position={[0, 0.16, 0]}>
        <torusGeometry args={[0.1, 0.025, 8, 16, Math.PI]} />
        <meshStandardMaterial color={PURPLE} roughness={0.3} emissive={PURPLE} emissiveIntensity={0.2} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Ring (green torus -- fires at end of validate)              */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Flash at 0.55-0.65 (5.5-6.5s) -- ACCEPT confirmation
    const visible = cycleT >= 0.55 && cycleT < 0.65
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.55) / 0.1)
      const scale = easeInOut(progress) * 1.3
      ref.current.scale.setScalar(scale)
      matRef.current.opacity = 0.7 * (1 - progress * 0.6)
    }
  })

  return (
    <mesh ref={ref} position={[PLOT_POS[0], 0.8, PLOT_POS[2]]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[1.0, 0.04, 8, 32]} />
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0.7} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Door (opens during execute phase)                                  */
/* ------------------------------------------------------------------ */

function Door({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Door appears with house (0.35+), opens during 0.6-0.65
    const houseBuilt = cycleT >= 0.35 && cycleT < 0.95
    ref.current.visible = houseBuilt

    if (houseBuilt) {
      if (cycleT >= 0.6 && cycleT < 0.65) {
        const openT = rangeT(cycleT, 0.6, 0.65)
        ref.current.rotation.y = -openT * Math.PI * 0.45
      } else if (cycleT >= 0.65) {
        ref.current.rotation.y = -Math.PI * 0.45
      } else {
        ref.current.rotation.y = 0
      }
    }
  })

  return (
    <group ref={ref} position={[PLOT_POS[0] + 0.7, 0.3, PLOT_POS[2]]} visible={false}>
      {/* Door panel -- pivot on the right edge */}
      <mesh position={[0, 0, -0.12]}>
        <boxGeometry args={[0.04, 0.45, 0.24]} />
        <meshStandardMaterial color="#16a34a" roughness={0.4} emissive={GREEN} emissiveIntensity={0.1} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Execute Beam (green tube exiting house rightward)                  */
/* ------------------------------------------------------------------ */

function ExecuteBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(PLOT_POS[0] + 0.8, 0.5, PLOT_POS[2]),
      new THREE.Vector3(PLOT_POS[0] + 2.5, 0.5, PLOT_POS[2]),
    )
    return new THREE.TubeGeometry(curve, 16, 0.02, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible 0.65-0.8 (6.5-8s) -- Execute
    const visible = cycleT >= 0.65 && cycleT < 0.8
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.65) / 0.15)
      matRef.current.opacity = 0.5 + Math.sin(progress * Math.PI) * 0.4
    }
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Execute Particles (InstancedMesh -- stream along execute beam)     */
/* ------------------------------------------------------------------ */

function ExecuteParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(
    () =>
      new THREE.LineCurve3(
        new THREE.Vector3(PLOT_POS[0] + 0.8, 0.5, PLOT_POS[2]),
        new THREE.Vector3(PLOT_POS[0] + 2.5, 0.5, PLOT_POS[2]),
      ),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Active 0.65-0.8 (6.5-8s)
    const active = cycleT >= 0.65 && cycleT < 0.8

    for (let i = 0; i < count; i++) {
      if (active) {
        const beamProgress = clamp01((cycleT - 0.65) / 0.15)
        const p = (beamProgress * 2 + i / count) % 1
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI * 2 + elapsedRef.current * 4) * 0.04
        dummy.scale.setScalar(0.02 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated Labels (phase-dependent, max 5 simultaneous)              */
/*  1. "0x1a2b...3c4d" -- persistent on address sign (handled above)   */
/*  2. "Funds waiting" -- transient, 0-2s                              */
/*  3. "Frame 0 / Deploy" -- transient, 2-4s                          */
/*  4. "Frame 1 / Validate" -- transient, 4-6s                        */
/*  5. "Frame 2 / Execute" -- transient, 6-8s                         */
/* ------------------------------------------------------------------ */

function AnimatedLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const fundsRef = useRef<THREE.Group>(null!)
  const deployRef = useRef<THREE.Group>(null!)
  const validateRef = useRef<THREE.Group>(null!)
  const executeRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!fundsRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "Funds waiting" -- 0-0.2 (0-2s)
    fundsRef.current.visible = reducedMotion || cycleT < 0.2
    // "Frame 0 / Deploy" -- 0.2-0.4 (2-4s)
    deployRef.current!.visible = reducedMotion || (cycleT >= 0.2 && cycleT < 0.4)
    // "Frame 1 / Validate" -- 0.4-0.6 (4-6s)
    validateRef.current!.visible = reducedMotion || (cycleT >= 0.4 && cycleT < 0.6)
    // "Frame 2 / Execute" -- 0.6-0.8 (6-8s)
    executeRef.current!.visible = reducedMotion || (cycleT >= 0.6 && cycleT < 0.8)
  })

  return (
    <>
      <group ref={fundsRef}>
        <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>
              Funds waiting
            </p>
          </div>
        </Html>
      </group>

      <group ref={deployRef}>
        <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-blue-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
              Frame 0 / Deploy
            </p>
          </div>
        </Html>
      </group>

      <group ref={validateRef}>
        <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-purple-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>
              Frame 1 / Validate
            </p>
          </div>
        </Html>
      </group>

      <group ref={executeRef}>
        <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Frame 2 / Execute
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Scene Content (inside Canvas)                                      */
/* ------------------------------------------------------------------ */

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <ContextDisposer />
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-3, 6, -2]} intensity={0.3} />

      {/* Ground */}
      <Platform />

      {/* Empty plot (gray flat RoundedBox) */}
      <EmptyPlot reducedMotion={reducedMotion} />

      {/* Address sign (persistent, glows blue) */}
      <AddressSign reducedMotion={reducedMotion} />

      {/* Pre-funded coins (amber spheres) */}
      <PreFundedCoins reducedMotion={reducedMotion} />

      {/* Factory node (indigo hexagonal prism) */}
      <FactoryNode reducedMotion={reducedMotion} />

      {/* Deploy phase */}
      <DeployBeam reducedMotion={reducedMotion} />
      <ConstructionParticles count={20} reducedMotion={reducedMotion} />

      {/* House / Wallet (materializes purple, transitions to green) */}
      <House reducedMotion={reducedMotion} />
      <Door reducedMotion={reducedMotion} />

      {/* Validate phase */}
      <ValidateLock reducedMotion={reducedMotion} />
      <AcceptRing reducedMotion={reducedMotion} />

      {/* Execute phase */}
      <ExecuteBeam reducedMotion={reducedMotion} />
      <ExecuteParticles count={12} reducedMotion={reducedMotion} />

      {/* Transient labels */}
      <AnimatedLabels reducedMotion={reducedMotion} />

      {/* Camera */}
      <AutoFitCamera points={[[-3, 3.5, 1.5], [3, 3.5, 1.5], [-3, -0.5, -1.5], [3, -0.5, -1.5]]} />

      {/* Controls */}
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

export function AccountDeploy3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="3D animation showing account deployment: the wallet address exists before the code does. Funds arrive at the empty address, then the wallet deploys, validates, and executes its first transaction."
      srDescription="A 3D scene showing a building lot metaphor for account deployment. An empty gray plot with a blue address sign has amber coins sitting on it (funds arrive before the wallet exists). An indigo factory node hovers above. A blue deploy beam shoots down, construction particles spiral, and a purple house materializes on the plot. A purple lock appears on the house face and rotates (validation). An ACCEPT ring flashes green. The house transitions to green, the door opens and a green execute beam exits rightward. Coins reappear inside the house. The key insight: the address is deterministic -- funds can be sent before the wallet contract is deployed."
      legend={<SceneLegend items={[{ color: BLUE, label: 'Deploy' }, { color: PURPLE, label: 'Validation' }, { color: GREEN, label: 'Execution' }, { color: AMBER, label: 'Pre-funded assets' }]} />}
      fallbackText="Account deployment in 3 frames: address exists before wallet code. Funds arrive first (amber coins on empty lot), then Deploy (house materializes purple), Validate (lock rotates on house face, ACCEPT fires green), Execute (house turns green, door opens, beam exits rightward)."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 6], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
