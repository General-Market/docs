'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CYCLE = 10 // 10-second animation loop
const BEFORE_Z = 1.5 // top row: separate TXs
const AFTER_Z = -1.5 // bottom row: Frame TX

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

/* ------------------------------------------------------------------ */
/*  Platform (full scene base)                                         */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[9.4, 0.02, 5.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[9.0, 0.04, 5.0]} radius={0.02} smoothness={4} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Horizontal Divider between BEFORE and AFTER                        */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[7, 0.01, 0.02]} radius={0.004} smoothness={4} position={[0, 0.06, 0]}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE: TX1 cube ("approve")                                       */
/* ------------------------------------------------------------------ */

function TX1Cube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Shake when compromised (3-5s = 0.3-0.5)
    const shaking = cycleT > 0.3 && cycleT < 0.5
    const shakeX = shaking ? Math.sin(elapsedRef.current * 40) * 0.03 : 0
    const shakeZ = shaking ? Math.cos(elapsedRef.current * 35) * 0.02 : 0
    ref.current.position.set(-2.5 + shakeX, 0.5, BEFORE_Z + shakeZ)
  })

  return (
    <group ref={ref} position={[-2.5, 0.5, BEFORE_Z]}>
      <RoundedBox args={[1.5, 0.8, 1]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      <Html center position={[0, 0, 0.55]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-mono font-bold whitespace-nowrap" style={{ color: '#fff' }}>
          TX 1: approve
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE: TX2 cube ("swap")                                          */
/* ------------------------------------------------------------------ */

function TX2Cube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Shake when compromised (3-5s = 0.3-0.5)
    const shaking = cycleT > 0.3 && cycleT < 0.5
    const shakeX = shaking ? Math.sin(elapsedRef.current * 38) * 0.03 : 0
    const shakeZ = shaking ? Math.cos(elapsedRef.current * 42) * 0.02 : 0
    ref.current.position.set(2.5 + shakeX, 0.5, BEFORE_Z + shakeZ)
  })

  return (
    <group ref={ref} position={[2.5, 0.5, BEFORE_Z]}>
      <RoundedBox args={[1.5, 0.8, 1]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      <Html center position={[0, 0, 0.55]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-mono font-bold whitespace-nowrap" style={{ color: '#fff' }}>
          TX 2: swap
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE: Vulnerability gap (pulsing red zone between TX1 and TX2)   */
/* ------------------------------------------------------------------ */

function VulnerabilityGap({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const mat = meshRef.current.material as THREE.MeshBasicMaterial

    // Pulse during 0-3s (gap visible), flash at attacker arrival 2-3s
    if (cycleT < 0.3) {
      // Gap pulsing red
      const pulse = 0.2 + Math.sin(elapsedRef.current * 4) * 0.15
      mat.opacity = pulse
      // Flash brighter when attacker arrives (2-3s = 0.2-0.3)
      if (cycleT > 0.2) {
        mat.opacity = pulse + 0.2
      }
    } else if (cycleT < 0.5) {
      // Hold bright
      mat.opacity = 0.5
    } else {
      // Dim during AFTER section focus
      mat.opacity = 0.15
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0.5, BEFORE_Z]}>
      <boxGeometry args={[1.5, 0.8, 1]} />
      <meshBasicMaterial color={RED} transparent opacity={0.2} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE: Danger particles (chaotic jitter inside gap)               */
/* ------------------------------------------------------------------ */

function DangerParticles({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Random offsets per particle
  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 1.2,
        y: (Math.random() - 0.5) * 0.6,
        z: (Math.random() - 0.5) * 0.8,
        speed: 2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % CYCLE) / CYCLE

    // Particles active during 0-5s (0-0.5 cycle)
    const active = cycleT < 0.5
    const opacity = active ? 0.7 : 0.1

    for (let i = 0; i < count; i++) {
      const o = offsets[i]
      if (active) {
        // Chaotic jitter
        dummy.position.set(
          o.x + Math.sin(t * o.speed + o.phase) * 0.15,
          0.5 + o.y + Math.cos(t * o.speed * 1.3 + o.phase) * 0.1,
          BEFORE_Z + o.z + Math.sin(t * o.speed * 0.8 + o.phase + 1) * 0.1,
        )
        dummy.scale.setScalar(0.015)
      } else {
        dummy.scale.setScalar(0.003)
        dummy.position.set(o.x, 0.5 + o.y, BEFORE_Z + o.z)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true

    // Update material opacity
    const mat = ref.current.material as THREE.MeshBasicMaterial
    mat.opacity = opacity
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={RED} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  BEFORE: Attacker arrow (cone that descends into the gap)           */
/* ------------------------------------------------------------------ */

function AttackerArrowBefore({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Arrow descends during 2-3s (0.2-0.3 cycle)
    // Then stays lodged 3-5s (0.3-0.5)
    // Resets during hold (0.8-1.0)
    let y: number
    let visible = true

    if (cycleT < 0.2) {
      // Waiting above
      y = 2.0
      visible = false
    } else if (cycleT < 0.3) {
      // Descending into gap
      const t = easeInOut((cycleT - 0.2) / 0.1)
      y = 2.0 + (0.7 - 2.0) * t
    } else if (cycleT < 0.5) {
      // Lodged in gap
      y = 0.7
    } else if (cycleT < 0.8) {
      // Still visible but faded
      y = 0.7
    } else {
      // Reset
      y = 2.0
      visible = false
    }

    ref.current.position.set(0, y, BEFORE_Z)
    ref.current.visible = visible
  })

  return (
    <group ref={ref} position={[0, 2.0, BEFORE_Z]}>
      {/* Arrow pointing down */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.15, 0.4, 8]} />
        <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.3} />
      </mesh>
      {/* Arrow shaft */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
        <meshStandardMaterial color={RED} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Frame TX Envelope (wireframe + solid floor)                 */
/* ------------------------------------------------------------------ */

function FrameEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const floorRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Subtle pulse, brighter during AFTER focus (5-8s = 0.5-0.8)
    const inFocus = cycleT > 0.5 && cycleT < 0.8
    const base = inFocus ? 0.18 : 0.12
    const opacity = base + Math.sin(elapsedRef.current * 2) * 0.04
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = opacity
  })

  return (
    <group position={[0, 0.5, AFTER_Z]}>
      {/* Wireframe envelope */}
      <mesh ref={meshRef}>
        <boxGeometry args={[6, 1.2, 1.5]} />
        <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.15} />
      </mesh>
      {/* Solid floor */}
      <mesh ref={floorRef} position={[0, -0.58, 0]}>
        <boxGeometry args={[6, 0.04, 1.5]} />
        <meshStandardMaterial color={BLUE} transparent opacity={0.08} roughness={0.8} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Frame Container (F0, F1, F2)                                */
/* ------------------------------------------------------------------ */

function FrameContainer({
  position,
  color,
  label,
  sublabel,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  label: string
  sublabel: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Glow during AFTER focus (5-8s = 0.5-0.8)
    const inFocus = cycleT > 0.5 && cycleT < 0.8
    const scale = inFocus ? 1.0 + Math.sin(elapsedRef.current * 3) * 0.02 : 1.0
    ref.current.scale.setScalar(scale)
  })

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[1.2, 0.6, 0.8]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={color} transparent opacity={0.25} roughness={0.7} />
      </RoundedBox>
      <mesh>
        <boxGeometry args={[1.22, 0.62, 0.82]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.3} />
      </mesh>
      <Html center position={[0, 0.45, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color }}>{label}</p>
      </Html>
      <Html center position={[0, -0.45, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: '#71717a' }}>{sublabel}</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Shield icon on envelope face                                */
/* ------------------------------------------------------------------ */

function ShieldIcon({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  // Shield shape: a 2D polygon extruded
  const shieldShape = useMemo(() => {
    const shape = new THREE.Shape()
    // Shield silhouette
    shape.moveTo(0, 0.18)
    shape.quadraticCurveTo(0.15, 0.18, 0.18, 0.08)
    shape.lineTo(0.18, -0.02)
    shape.quadraticCurveTo(0.18, -0.15, 0, -0.2)
    shape.quadraticCurveTo(-0.18, -0.15, -0.18, -0.02)
    shape.lineTo(-0.18, 0.08)
    shape.quadraticCurveTo(-0.15, 0.18, 0, 0.18)
    return shape
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const mat = ref.current.material as THREE.MeshStandardMaterial
    // Glow during AFTER focus (5-8s), flash when attacker bounces
    if (cycleT > 0.5 && cycleT < 0.8) {
      mat.emissiveIntensity = 0.4 + Math.sin(elapsedRef.current * 5) * 0.2
      mat.opacity = 0.7
    } else {
      mat.emissiveIntensity = 0.1
      mat.opacity = 0.4
    }
  })

  return (
    <mesh ref={ref} position={[0, 0.9, AFTER_Z + 0.78]} rotation={[0, 0, 0]}>
      <shapeGeometry args={[shieldShape]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0.4}
        roughness={0.3}
        emissive={GREEN}
        emissiveIntensity={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Attacker arrow that bounces off shield                      */
/* ------------------------------------------------------------------ */

function AttackerArrowAfter({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Arrow approaches during 5.5-6.5s (0.55-0.65), bounces 6.5-7.5s (0.65-0.75)
    let y: number
    let rotZ: number
    let visible = true

    if (cycleT < 0.55) {
      visible = false
      y = 2.2
      rotZ = 0
    } else if (cycleT < 0.65) {
      // Descending toward shield
      const t = easeInOut((cycleT - 0.55) / 0.1)
      y = 2.2 + (1.1 - 2.2) * t
      rotZ = 0
    } else if (cycleT < 0.75) {
      // Bounce off -- fly back up and to the side
      const t = easeInOut((cycleT - 0.65) / 0.1)
      y = 1.1 + t * 1.5
      rotZ = t * Math.PI * 0.4 // tumble
      ref.current.position.x = t * 1.5 // fly to the right
    } else {
      visible = false
      y = 2.2
      rotZ = 0
    }

    if (cycleT < 0.65 || cycleT >= 0.75) {
      ref.current.position.x = 0
    }
    ref.current.position.y = y
    ref.current.position.z = AFTER_Z + 0.78
    ref.current.rotation.z = rotZ
    ref.current.visible = visible
  })

  return (
    <group ref={ref} position={[0, 2.2, AFTER_Z + 0.78]}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.12, 0.35, 8]} />
        <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.25, 8]} />
        <meshStandardMaterial color={RED} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Shield spark particles (burst when attacker bounces)        */
/* ------------------------------------------------------------------ */

function ShieldSparks({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Pre-computed random directions for spark burst
  const directions = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 1.5 + 0.5,
        z: (Math.random() - 0.5) * 1,
      })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Sparks burst at 0.65-0.75 (when attacker bounces)
    const active = cycleT > 0.64 && cycleT < 0.76
    const burstT = active ? clamp01((cycleT - 0.64) / 0.12) : 0

    for (let i = 0; i < count; i++) {
      const d = directions[i]
      if (active) {
        // Expand outward from shield center
        const expansion = easeInOut(burstT)
        dummy.position.set(
          d.x * expansion * 0.8,
          0.9 + d.y * expansion * 0.6,
          AFTER_Z + 0.78 + d.z * expansion * 0.5,
        )
        // Fade and shrink over time
        dummy.scale.setScalar(0.025 * (1 - burstT * 0.7))
      } else {
        dummy.scale.setScalar(0)
        dummy.position.set(0, 0.9, AFTER_Z + 0.78)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  AFTER: Green connection particles (flowing through all frames)     */
/* ------------------------------------------------------------------ */

function GreenFlowParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(-2, 0.5, AFTER_Z),
      new THREE.Vector3(-0.7, 0.5, AFTER_Z),
      new THREE.Vector3(0.7, 0.5, AFTER_Z),
      new THREE.Vector3(2, 0.5, AFTER_Z),
    ]
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % CYCLE) / CYCLE

    // Particles flow during AFTER focus (5-10s = 0.5-1.0), dim otherwise
    const active = cycleT > 0.45
    const scaleMultiplier = active ? 1 : 0.3

    for (let i = 0; i < count; i++) {
      const p = ((t * 0.15 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += Math.sin(p * Math.PI) * 0.05
      dummy.scale.setScalar(0.012 * scaleMultiplier * (Math.sin(p * Math.PI) * 0.6 + 0.4))
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
/*  AFTER: Green rail (tube through frames)                            */
/* ------------------------------------------------------------------ */

function GreenRail() {
  const tubeGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(-2.8, 0.15, AFTER_Z),
      new THREE.Vector3(-1, 0.15, AFTER_Z),
      new THREE.Vector3(1, 0.15, AFTER_Z),
      new THREE.Vector3(2.8, 0.15, AFTER_Z),
    ]
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2)
    return new THREE.TubeGeometry(curve, 32, 0.012, 6, false)
  }, [])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color={GREEN} roughness={0.4} transparent opacity={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Labels: "BEFORE" and "AFTER" section headers                       */
/* ------------------------------------------------------------------ */

function SectionLabels() {
  return (
    <>
      <Html center position={[0, 1.3, BEFORE_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>
          Before: 2 Separate TXs
        </p>
      </Html>
      <Html center position={[0, 1.3, AFTER_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>
          After: 1 Frame TX
        </p>
      </Html>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated labels (vulnerability, front-run, atomic)                 */
/* ------------------------------------------------------------------ */

function AnimatedLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const vulnRef = useRef<THREE.Group>(null!)
  const frontrunRef = useRef<THREE.Group>(null!)
  const atomicRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!vulnRef.current || !frontrunRef.current || !atomicRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "Vulnerability gap" visible 0-5s (0-0.5)
    vulnRef.current.visible = reducedMotion || cycleT < 0.5

    // "Front-run!" visible 2-5s (0.2-0.5)
    frontrunRef.current.visible = reducedMotion || (cycleT > 0.2 && cycleT < 0.5)

    // "Atomic: no gap" visible 5-10s (0.5-1.0)
    atomicRef.current.visible = reducedMotion || cycleT > 0.5
  })

  return (
    <>
      <group ref={vulnRef}>
        <Html center position={[0, 1.05, BEFORE_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-red-200 rounded px-2 py-0.5">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
              Vulnerability gap
            </p>
          </div>
        </Html>
      </group>
      <group ref={frontrunRef}>
        <Html center position={[0, 1.6, BEFORE_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-red-50 border border-red-300 rounded px-2 py-0.5">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
              Front-run!
            </p>
          </div>
        </Html>
      </group>
      <group ref={atomicRef}>
        <Html center position={[0, -0.25, AFTER_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-green-50 border border-green-200 rounded px-2 py-0.5">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Atomic: no gap
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Comparison verdict labels (8-10s)                                  */
/* ------------------------------------------------------------------ */

function VerdictLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Show verdict 8-10s (0.8-1.0)
    ref.current.visible = reducedMotion || cycleT > 0.8
  })

  return (
    <group ref={ref}>
      <Html center position={[-2.5, -0.15, BEFORE_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-red-50 border border-red-300 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
            Vulnerable
          </p>
        </div>
      </Html>
      <Html center position={[2.5, -0.15, AFTER_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-green-50 border border-green-200 rounded px-2 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
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

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Vulnerability gap</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Transaction / Frame</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Atomic (safe)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Validation frame</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function AtomicBatch3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Comparison showing how separate transactions create a vulnerability gap that attackers exploit, versus a single Frame TX that executes atomically with no gap"
      srDescription="A 3D diorama split into two rows. The top row (BEFORE) shows two separate transaction cubes -- TX 1 approve and TX 2 swap -- with a pulsing red vulnerability gap between them. An attacker arrow descends into the gap, representing a front-running or sandwich attack. The bottom row (AFTER) shows a single Frame TX envelope containing three frames: F0 validate, F1 approve, and F2 swap, connected by green particles flowing continuously with no gaps. A shield icon on the envelope deflects an attacker arrow, demonstrating atomic execution prevents front-running."
      legend={<Legend />}
      fallbackText="Separate TXs have a vulnerability gap exploitable by attackers -- Frame TXs execute atomically with no gap"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5, 9], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Base */}
          <Platform />
          <Divider />

          {/* ------ BEFORE: Separate TXs (top, z=1.5) ------ */}
          <TX1Cube reducedMotion={reducedMotion} />
          <TX2Cube reducedMotion={reducedMotion} />
          <VulnerabilityGap reducedMotion={reducedMotion} />
          <DangerParticles count={16} reducedMotion={reducedMotion} />
          <AttackerArrowBefore reducedMotion={reducedMotion} />

          {/* ------ AFTER: Frame TX (bottom, z=-1.5) ------ */}
          <FrameEnvelope reducedMotion={reducedMotion} />
          <GreenRail />
          <FrameContainer
            position={[-2, 0.5, AFTER_Z]}
            color={PURPLE}
            label="F0"
            sublabel="validate"
            reducedMotion={reducedMotion}
          />
          <FrameContainer
            position={[0, 0.5, AFTER_Z]}
            color={BLUE}
            label="F1"
            sublabel="approve"
            reducedMotion={reducedMotion}
          />
          <FrameContainer
            position={[2, 0.5, AFTER_Z]}
            color={BLUE}
            label="F2"
            sublabel="swap"
            reducedMotion={reducedMotion}
          />
          <ShieldIcon reducedMotion={reducedMotion} />
          <AttackerArrowAfter reducedMotion={reducedMotion} />
          <ShieldSparks count={8} reducedMotion={reducedMotion} />
          <GreenFlowParticles count={12} reducedMotion={reducedMotion} />

          {/* ------ Labels ------ */}
          <SectionLabels />
          <AnimatedLabels reducedMotion={reducedMotion} />
          <VerdictLabels reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.3}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
