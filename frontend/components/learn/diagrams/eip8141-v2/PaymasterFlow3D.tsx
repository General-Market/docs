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
const INDIGO = '#6366f1'
const BLUE = '#3b82f6'

// Positions
const USER_X = -3
const USER_Y = 0.5
const PAY_X = 0
const PAY_Y = 2
const RECIP_X = 3
const RECIP_Y = 0.5

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
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, -0.05, 0]}>
      <RoundedBox args={[9, 0.02, 4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[8.5, 0.06, 3.5]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  User Node (purple sphere -- validation/pre-ACCEPT)                 */
/* ------------------------------------------------------------------ */

function UserNode({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    groupRef.current.position.y = USER_Y + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group ref={groupRef} position={[USER_X, USER_Y, 0]}>
      <mesh>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color={PURPLE} roughness={0.4} />
      </mesh>
      {/* Persistent label: "User (RAI)" */}
      <Html center position={[0, 0.75, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: PURPLE }}>
          User (RAI)
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  RAI Discs (amber, stacked near user) -- visible 0-0.5s then       */
/*  consumed during fee exchange (0.5-0.7)                             */
/* ------------------------------------------------------------------ */

function RAIDiscs({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  const count = 5

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Full display 0-0.5, then top discs disappear during fee (0.5-0.7)
    const feeProgress = cycleT > 0.5 && cycleT < 0.7
      ? clamp01((cycleT - 0.5) / 0.2)
      : cycleT >= 0.7 ? 1 : 0
    const showCount = cycleT < 0.5 ? count : Math.max(2, Math.round(count * (1 - feeProgress * 0.5)))

    for (let i = 0; i < count; i++) {
      const child = groupRef.current.children[i] as THREE.Mesh
      if (child) child.visible = i < showCount
    }

    // Hover sync with user node
    groupRef.current.position.y = USER_Y + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group ref={groupRef} position={[USER_X, USER_Y, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0.3, -0.15 + i * 0.065, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
          <meshStandardMaterial color={AMBER} roughness={0.4} emissive={AMBER} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Paymaster Node (indigo hexagonal prism at top-center)              */
/* ------------------------------------------------------------------ */

function PaymasterNode({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Glow when inspecting intent (0.2-0.4)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const inInspect = cycleT > 0.2 && cycleT < 0.4
    const glow = inInspect
      ? 0.12 + Math.sin(clamp01((cycleT - 0.2) / 0.2) * Math.PI * 3) * 0.1
      : 0.04
    mat.emissiveIntensity = glow

    meshRef.current.position.y = PAY_Y + Math.sin(elapsedRef.current * 0.9) * 0.015
  })

  return (
    <group position={[PAY_X, 0, 0]}>
      <mesh ref={meshRef} position={[0, PAY_Y, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 1.0, 6]} />
        <meshStandardMaterial color={INDIGO} roughness={0.4} emissive={INDIGO} emissiveIntensity={0.04} />
      </mesh>
      {/* Persistent label: "Paymaster (ETH)" */}
      <Html center position={[0, PAY_Y + 0.85, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: INDIGO }}>
          Paymaster (ETH)
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ETH Reserve (green spheres inside/near paymaster) -- beat 1        */
/* ------------------------------------------------------------------ */

function ETHReserve({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const positions: [number, number, number][] = useMemo(() => [
    [0.15, PAY_Y - 0.2, 0.12],
    [-0.18, PAY_Y - 0.05, -0.1],
    [0.05, PAY_Y + 0.15, 0.18],
    [-0.12, PAY_Y + 0.3, -0.08],
  ], [])

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // One sphere disappears during gas payment (0.5-0.7)
    const gasProgress = cycleT > 0.5 && cycleT < 0.7
      ? clamp01((cycleT - 0.5) / 0.15)
      : cycleT >= 0.65 ? 1 : 0

    for (let i = 0; i < positions.length; i++) {
      const child = groupRef.current.children[i] as THREE.Mesh
      if (!child) continue
      if (i === 0 && gasProgress > 0) {
        const s = 1 - gasProgress
        child.scale.setScalar(Math.max(s, 0.01))
        child.visible = s > 0.01
      } else {
        child.visible = true
        child.scale.setScalar(1)
      }
    }

    groupRef.current.position.y = Math.sin(elapsedRef.current * 0.9) * 0.015
  })

  return (
    <group ref={groupRef} position={[PAY_X, 0, 0]}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshStandardMaterial color={GREEN} roughness={0.3} emissive={GREEN} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Recipient Node (blue RoundedBox at right)                          */
/* ------------------------------------------------------------------ */

function RecipientNode({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Pulse when execution arrives (0.7-0.9)
    const inExec = cycleT > 0.7 && cycleT < 0.9
    const pulse = inExec
      ? 1 + Math.sin(clamp01((cycleT - 0.7) / 0.2) * Math.PI * 4) * 0.07
      : 1
    meshRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={[RECIP_X, RECIP_Y, 0]}>
      <RoundedBox ref={meshRef} args={[0.7, 0.7, 0.7]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} emissive={BLUE} emissiveIntensity={0.06} />
      </RoundedBox>
      <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Recipient
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber, Paymaster -> User intent) -- beat 2       */
/*  2-4s (cycleT 0.2-0.4)                                             */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(PAY_X, PAY_Y - 0.3, 0),
      new THREE.Vector3((PAY_X + USER_X) / 2, PAY_Y + 0.5, 0.5),
      new THREE.Vector3(USER_X + 0.45, USER_Y + 0.2, 0),
    )
    return new THREE.TubeGeometry(curve, 32, 0.014, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible 0.2-0.4
    const visible = cycleT > 0.18 && cycleT < 0.42
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = rangeT(cycleT, 0.18, 0.22)
      const fadeOut = cycleT > 0.38 ? 1 - rangeT(cycleT, 0.38, 0.42) : 1
      mat.opacity = 0.55 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0.55} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Sparks (amber, flow FROM User TOWARD Paymaster)       */
/*  Sparks represent the user's intent being read upward               */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Sparks flow FROM User TOWARD Paymaster
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(USER_X + 0.45, USER_Y + 0.2, 0),
    new THREE.Vector3((PAY_X + USER_X) / 2, PAY_Y + 0.5, 0.5),
    new THREE.Vector3(PAY_X, PAY_Y - 0.3, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    const active = cycleT > 0.2 && cycleT < 0.4

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.35 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        const sparkSize = 0.025 * (Math.sin(p * Math.PI) * 0.6 + 0.4)
        dummy.scale.setScalar(sparkSize)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={AMBER} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Ring (green torus at paymaster) -- beat 3                   */
/*  4-5s (cycleT 0.4-0.5)                                             */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fire at 0.4-0.5 (4-5s)
    const active = cycleT > 0.4 && cycleT < 0.5
    meshRef.current.visible = active
    if (active) {
      const t = clamp01((cycleT - 0.4) / 0.1)
      const expand = 1 + t * 0.7
      meshRef.current.scale.setScalar(expand)
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.85 * (1 - t * 0.6)
    }
  })

  return (
    <mesh ref={meshRef} position={[PAY_X, PAY_Y, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.8, 0.04, 8, 32]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.85} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ETH Gas Beam (green tube from Paymaster downward) -- beat 4        */
/*  5-7s (cycleT 0.5-0.7)                                             */
/* ------------------------------------------------------------------ */

function ETHGasBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(PAY_X, PAY_Y - 0.5, 0),
      new THREE.Vector3(PAY_X - 1.0, (PAY_Y + USER_Y) / 2 - 0.3, 0.6),
      new THREE.Vector3(USER_X + 1.5, USER_Y - 0.3, 0.2),
    )
    return new THREE.TubeGeometry(curve, 24, 0.012, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const visible = cycleT > 0.48 && cycleT < 0.72
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = rangeT(cycleT, 0.48, 0.52)
      const fadeOut = cycleT > 0.68 ? 1 - rangeT(cycleT, 0.68, 0.72) : 1
      mat.opacity = 0.4 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={GREEN} transparent opacity={0.4} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ETH Gas Flow (green spheres, Paymaster -> downward) -- beat 4      */
/*  Crosses mid-screen with RAI fee flow                               */
/* ------------------------------------------------------------------ */

function ETHGasFlow({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // ETH flows from paymaster downward-left (crosses mid-screen)
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(PAY_X, PAY_Y - 0.5, 0),
    new THREE.Vector3(PAY_X - 1.0, (PAY_Y + USER_Y) / 2 - 0.3, 0.6),
    new THREE.Vector3(USER_X + 1.5, USER_Y - 0.3, 0.2),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active 0.5-0.7 (5-7s)
    const active = cycleT > 0.5 && cycleT < 0.7

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.4 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        const size = 0.035 * (Math.sin(p * Math.PI) * 0.5 + 0.5)
        dummy.scale.setScalar(size)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 10, 10]} />
      <meshStandardMaterial color={GREEN} roughness={0.3} emissive={GREEN} emissiveIntensity={0.2} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  RAI Fee Beam (amber tube from User to Paymaster) -- beat 4         */
/* ------------------------------------------------------------------ */

function RAIFeeBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(USER_X + 0.45, USER_Y + 0.1, 0),
      new THREE.Vector3(PAY_X - 0.5, (PAY_Y + USER_Y) / 2 + 0.2, -0.6),
      new THREE.Vector3(PAY_X, PAY_Y - 0.5, 0),
    )
    return new THREE.TubeGeometry(curve, 24, 0.012, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const visible = cycleT > 0.48 && cycleT < 0.72
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = rangeT(cycleT, 0.48, 0.52)
      const fadeOut = cycleT > 0.68 ? 1 - rangeT(cycleT, 0.68, 0.72) : 1
      mat.opacity = 0.4 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0.4} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  RAI Fee Flow (amber discs, User -> Paymaster) -- beat 4            */
/*  Crosses mid-screen with ETH gas flow (opposite direction)          */
/* ------------------------------------------------------------------ */

function RAIFeeFlow({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // RAI flows from user upward-right to paymaster
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(USER_X + 0.45, USER_Y + 0.1, 0),
    new THREE.Vector3(PAY_X - 0.5, (PAY_Y + USER_Y) / 2 + 0.2, -0.6),
    new THREE.Vector3(PAY_X, PAY_Y - 0.5, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active 0.5-0.7 (5-7s), same window as ETH to create the crossing
    const active = cycleT > 0.5 && cycleT < 0.7

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.4 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        // Flatten into disc shape
        dummy.scale.set(0.03, 0.01, 0.03)
        dummy.rotation.set(Math.PI / 2 + p * 0.3, 0, 0)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial color={AMBER} roughness={0.4} emissive={AMBER} emissiveIntensity={0.15} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Execution Beam (green, User -> Recipient) -- beat 5                */
/*  7-9s (cycleT 0.7-0.9)                                             */
/* ------------------------------------------------------------------ */

function ExecuteBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(USER_X + 0.5, USER_Y, 0),
      new THREE.Vector3(RECIP_X - 0.4, RECIP_Y, 0),
    )
    return new THREE.TubeGeometry(curve, 16, 0.025, 8, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible 0.7-0.9 (7-9s)
    const visible = cycleT > 0.68 && cycleT < 0.92
    meshRef.current.visible = visible
    if (visible) {
      const growT = easeInOut(clamp01((cycleT - 0.68) / 0.06))
      meshRef.current.scale.set(growT, 1, 1)
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.5 * growT
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={GREEN} transparent opacity={0.5} roughness={0.3} emissive={GREEN} emissiveIntensity={0.1} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Execution Sparks (green, along beam User -> Recipient) -- beat 5   */
/* ------------------------------------------------------------------ */

function ExecuteSparks({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(USER_X + 0.5, USER_Y, 0),
    new THREE.Vector3(RECIP_X - 0.4, RECIP_Y, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active 0.72-0.9 (7.2-9s)
    const active = cycleT > 0.72 && cycleT < 0.9

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.4 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI * 2) * 0.06
        const size = 0.02 * (Math.sin(p * Math.PI) * 0.5 + 0.5)
        dummy.scale.setScalar(size)
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
/*  Animated Labels (max 5 simultaneous, timed to beats)               */
/*  Persistent: "User (RAI)", "Paymaster (ETH)" are on the nodes      */
/*  Transient: CALLDATAREAD (2-4s), ACCEPT (4-5s), exchange (5-7s)    */
/* ------------------------------------------------------------------ */

function AnimatedLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const calldataRef = useRef<THREE.Group>(null!)
  const acceptRef = useRef<THREE.Group>(null!)
  const feeRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "CALLDATAREAD" -- 0.2-0.4 (2-4s)
    if (calldataRef.current) {
      calldataRef.current.visible = reducedMotion || (cycleT > 0.2 && cycleT < 0.4)
    }
    // "ACCEPT" -- 0.4-0.5 (4-5s)
    if (acceptRef.current) {
      acceptRef.current.visible = reducedMotion || (cycleT > 0.4 && cycleT < 0.52)
    }
    // "Gas paid in ETH / Fee in RAI" -- 0.5-0.7 (5-7s)
    if (feeRef.current) {
      feeRef.current.visible = reducedMotion || (cycleT > 0.5 && cycleT < 0.72)
    }
  })

  return (
    <>
      {/* CALLDATAREAD label */}
      <group ref={calldataRef}>
        <Html center position={[(USER_X + PAY_X) / 2, PAY_Y + 0.6, 0.3]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>
              CALLDATAREAD
            </p>
          </div>
        </Html>
      </group>

      {/* ACCEPT label */}
      <group ref={acceptRef}>
        <Html center position={[PAY_X, PAY_Y - 1.0, -0.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              ACCEPT
            </p>
          </div>
        </Html>
      </group>

      {/* Fee exchange label */}
      <group ref={feeRef}>
        <Html center position={[(USER_X + PAY_X) / 2, USER_Y - 0.3, -0.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: '#71717a' }}>
              <span style={{ color: GREEN }}>Gas paid in ETH</span>
              {' '}
              <span className="opacity-40">/</span>
              {' '}
              <span style={{ color: AMBER }}>Fee in RAI</span>
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Ambient Floating Particles                                         */
/* ------------------------------------------------------------------ */

function AmbientParticles({ count = 6, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () => Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 7,
      y: Math.random() * 2 + 0.3,
      z: (Math.random() - 0.5) * 3,
      speed: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const o = offsets[i]
      dummy.position.set(
        o.x + Math.sin(t * o.speed + o.phase) * 0.12,
        o.y + Math.sin(t * o.speed * 0.7 + o.phase) * 0.08,
        o.z + Math.cos(t * o.speed * 0.5 + o.phase) * 0.08,
      )
      dummy.scale.setScalar(0.007 + Math.sin(t * 2 + o.phase) * 0.003)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={INDIGO} transparent opacity={0.2} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function PaymasterFlow3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Paymaster bidirectional token exchange: a user pays RAI to a paymaster that covers gas in ETH, with the two flows crossing mid-screen"
      srDescription="A 3D scene with three entities. On the left, a purple sphere represents the user holding amber RAI token discs. At top-center, an indigo hexagonal prism represents the paymaster holding green ETH spheres. On the right, a blue rounded box is the recipient. The paymaster sends an amber CALLDATAREAD arc to inspect the user's intent, with sparks flowing from user toward paymaster. A green ACCEPT ring fires at the paymaster. Then two crossing flows appear: green ETH spheres flow downward from paymaster (gas payment) while amber RAI discs flow upward from user to paymaster (fee). Finally a green execution beam extends from user to recipient."
      legend={<SceneLegend items={[{ color: AMBER, label: 'RAI / fees' }, { color: GREEN, label: 'ETH / gas' }, { color: INDIGO, label: 'Paymaster' }]} />}
      fallbackText="Paymaster Flow: User has RAI, paymaster has ETH. Paymaster reads intent via CALLDATAREAD, accepts, then RAI fee and ETH gas cross mid-screen in opposite directions. User executes to recipient."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 7], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* ------ USER (purple sphere, left) ------ */}
          <UserNode reducedMotion={reducedMotion} />
          <RAIDiscs reducedMotion={reducedMotion} />

          {/* ------ PAYMASTER (indigo hex prism, top-center) ------ */}
          <PaymasterNode reducedMotion={reducedMotion} />
          <ETHReserve reducedMotion={reducedMotion} />

          {/* ------ RECIPIENT (blue box, right) ------ */}
          <RecipientNode reducedMotion={reducedMotion} />

          {/* ------ CALLDATAREAD (beat 2: 2-4s) ------ */}
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={8} reducedMotion={reducedMotion} />

          {/* ------ ACCEPT RING (beat 3: 4-5s) ------ */}
          <AcceptRing reducedMotion={reducedMotion} />

          {/* ------ CROSSING FLOWS (beat 4: 5-7s) ------ */}
          <ETHGasBeam reducedMotion={reducedMotion} />
          <ETHGasFlow count={10} reducedMotion={reducedMotion} />
          <RAIFeeBeam reducedMotion={reducedMotion} />
          <RAIFeeFlow count={10} reducedMotion={reducedMotion} />

          {/* ------ EXECUTION BEAM (beat 5: 7-9s) ------ */}
          <ExecuteBeam reducedMotion={reducedMotion} />
          <ExecuteSparks count={10} reducedMotion={reducedMotion} />

          {/* ------ TRANSIENT LABELS ------ */}
          <AnimatedLabels reducedMotion={reducedMotion} />

          {/* ------ AMBIENT ------ */}
          <AmbientParticles count={6} reducedMotion={reducedMotion} />

          <AutoFitCamera points={[[-4, 3, 1.5], [4, 3, 1.5], [-4, -0.5, -1.5], [4, -0.5, -1.5]]} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            autoRotate={false}
            minPolarAngle={Math.PI / 5}
            maxPolarAngle={Math.PI / 2.8}
            minAzimuthAngle={-Math.PI / 6}
            maxAzimuthAngle={Math.PI / 6}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
