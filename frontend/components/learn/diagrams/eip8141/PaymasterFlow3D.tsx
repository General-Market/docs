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

const BLUE = '#3b82f6'
const AMBER = '#f59e0b'
const INDIGO = '#6366f1'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'

const USER_X = -3.5
const PAYMASTER_X = 0
const TARGET_X = 3.5

/* ------------------------------------------------------------------ */
/*  Utility: smooth ease in-out                                        */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[10, 0.02, 4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[9.5, 0.06, 3.5]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  User Node (blue sphere + RAI stack + "No ETH" X mark)              */
/* ------------------------------------------------------------------ */

function UserNode({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    groupRef.current.position.y = 0.6 + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group ref={groupRef} position={[USER_X, 0.6, 0]}>
      {/* Main sphere */}
      <mesh>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} />
      </mesh>
      {/* User label */}
      <Html center position={[0, 0.85, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          User
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  RAI Token Stack (amber discs on user)                              */
/* ------------------------------------------------------------------ */

function RAIStack({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  const discCount = 6

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // At 7-9s (0.7-0.9), RAI stack decreases -- scale down top discs
    const feeProgress = cycleT > 0.7 && cycleT < 0.9
      ? clamp01((cycleT - 0.7) / 0.2)
      : cycleT >= 0.9 ? 1 : 0

    // Reset at cycle boundary
    const showCount = cycleT < 0.7 ? discCount : Math.max(2, Math.round(discCount * (1 - feeProgress * 0.6)))

    for (let i = 0; i < discCount; i++) {
      const child = groupRef.current.children[i] as THREE.Mesh
      if (child) {
        child.visible = i < showCount
      }
    }

    // Hover sync with user node
    groupRef.current.position.y = 0.6 + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group ref={groupRef} position={[USER_X, 0.6, 0]}>
      {Array.from({ length: discCount }).map((_, i) => (
        <mesh key={i} position={[0.25, -0.2 + i * 0.06, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 12]} />
          <meshStandardMaterial color={AMBER} roughness={0.4} emissive={AMBER} emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "No ETH" X Mark                                                    */
/* ------------------------------------------------------------------ */

function NoEthMark({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible in beat 1 (0-2.5s) and pulse
    const visible = cycleT < 0.25
    groupRef.current.visible = visible
    if (visible) {
      const pulse = 1 + Math.sin(elapsedRef.current * 4) * 0.1
      groupRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <group ref={groupRef} position={[USER_X - 0.3, 0.15, 0.6]}>
      {/* Two crossed bars forming X */}
      <RoundedBox args={[0.2, 0.03, 0.03]} radius={0.005} smoothness={4} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial color={RED} roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.03, 0.03]} radius={0.005} smoothness={4} rotation={[0, 0, -Math.PI / 4]}>
        <meshStandardMaterial color={RED} roughness={0.4} />
      </RoundedBox>
      <Html center position={[0.22, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: RED }}>0 ETH</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Paymaster Node (indigo hexagonal prism)                            */
/* ------------------------------------------------------------------ */

function PaymasterNode({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Glow when checking tx (2.5-5s)
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const glow = cycleT > 0.25 && cycleT < 0.5
      ? 0.15 + Math.sin((cycleT - 0.25) / 0.25 * Math.PI * 3) * 0.12
      : 0.05
    mat.emissiveIntensity = glow
    // Gentle hover
    meshRef.current.position.y = 0.65 + Math.sin(elapsedRef.current * 1.0) * 0.015
  })

  return (
    <group position={[PAYMASTER_X, 0, 0]}>
      <mesh ref={meshRef} position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 1.2, 6]} />
        <meshStandardMaterial color={INDIGO} roughness={0.4} emissive={INDIGO} emissiveIntensity={0.05} />
      </mesh>
      <Html center position={[0, 1.55, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: INDIGO }}>
          Paymaster
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ETH Reserve (green spheres inside paymaster)                       */
/* ------------------------------------------------------------------ */

function ETHReserve({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const positions: [number, number, number][] = useMemo(() => [
    [0.15, 0.45, 0.1],
    [-0.2, 0.55, -0.15],
    [0.05, 0.7, 0.2],
    [-0.1, 0.85, -0.05],
    [0.2, 0.95, 0.0],
  ], [])

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // One ETH sphere disappears during gas burn (2.5-5s)
    const burnProgress = cycleT > 0.3 && cycleT < 0.5
      ? clamp01((cycleT - 0.3) / 0.15)
      : cycleT >= 0.5 ? 1 : 0

    for (let i = 0; i < positions.length; i++) {
      const child = groupRef.current.children[i] as THREE.Mesh
      if (!child) continue
      if (i === 0 && burnProgress > 0) {
        // First sphere shrinks as gas is burned
        const s = 1 - burnProgress
        child.scale.setScalar(Math.max(s, 0.01))
        child.visible = s > 0.01
      } else {
        child.visible = true
        child.scale.setScalar(1)
      }
    }

    // Hover sync
    groupRef.current.position.y = Math.sin(elapsedRef.current * 1.0) * 0.015
  })

  return (
    <group ref={groupRef} position={[PAYMASTER_X, 0, 0]}>
      {positions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color={GREEN} roughness={0.3} emissive={GREEN} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Target Node (blue RoundedBox at right)                             */
/* ------------------------------------------------------------------ */

function TargetNode({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Pulse when operation arrives (5-7s)
    const pulse = cycleT > 0.5 && cycleT < 0.7
      ? 1 + Math.sin((cycleT - 0.5) / 0.2 * Math.PI * 4) * 0.08
      : 1
    meshRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={[TARGET_X, 0.5, 0]}>
      <RoundedBox ref={meshRef} args={[0.8, 0.8, 0.8]} radius={0.08} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} emissive={BLUE} emissiveIntensity={0.08} />
      </RoundedBox>
      <Html center position={[0, 0.65, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Target
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber QuadBezier from user to paymaster)         */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(USER_X + 0.5, 0.8, 0),
      new THREE.Vector3((USER_X + PAYMASTER_X) / 2, 2.2, 0),
      new THREE.Vector3(PAYMASTER_X - 0.5, 0.8, 0),
    )
    return new THREE.TubeGeometry(curve, 32, 0.015, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible during beat 2 (2.5-5s) -> cycleT 0.25-0.5
    const visible = cycleT > 0.2 && cycleT < 0.55
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = clamp01((cycleT - 0.2) / 0.05)
      const fadeOut = cycleT > 0.5 ? clamp01((0.55 - cycleT) / 0.05) : 1
      mat.opacity = 0.6 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0.6} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Sparks (8 instancedMesh on the arc)                   */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(USER_X + 0.5, 0.8, 0),
    new THREE.Vector3((USER_X + PAYMASTER_X) / 2, 2.2, 0),
    new THREE.Vector3(PAYMASTER_X - 0.5, 0.8, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Visible during beat 2 (0.2-0.55 of cycle)
    const active = cycleT > 0.2 && cycleT < 0.55

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.3 + i / count) % 1)
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
/*  Gas Burn Particles (ETH flame rising from paymaster)               */
/* ------------------------------------------------------------------ */

function GasBurnParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () => Array.from({ length: count }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 0.1 + Math.random() * 0.3,
      speed: 0.5 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active during beat 2: gas burn (0.25-0.5)
    const active = cycleT > 0.25 && cycleT < 0.5

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const o = offsets[i]
        const life = ((t * o.speed + o.phase) % 1)
        const x = PAYMASTER_X + Math.cos(o.angle) * o.radius * 0.5
        const z = Math.sin(o.angle) * o.radius * 0.5
        const y = 1.3 + life * 1.2 // rise upward
        dummy.position.set(x, y, z)
        // Fade out as they rise
        const fade = 1 - life
        dummy.scale.setScalar(0.02 * fade)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={AMBER} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Ring (green torus at paymaster)                             */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fire at 0.35-0.45 (3.5-4.5s), then fade
    const active = cycleT > 0.35 && cycleT < 0.5
    meshRef.current.visible = active
    if (active) {
      const t = (cycleT - 0.35) / 0.15
      const expand = 1 + t * 0.6
      meshRef.current.scale.setScalar(expand)
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1 - t * 0.5)
    }
  })

  return (
    <mesh ref={meshRef} position={[PAYMASTER_X, 0.65, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.9, 0.04, 8, 32]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Execute Beam (green tube from paymaster to target)                 */
/* ------------------------------------------------------------------ */

function ExecuteBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(PAYMASTER_X + 0.7, 0.5, 0),
      new THREE.Vector3(TARGET_X - 0.5, 0.5, 0),
    )
    return new THREE.TubeGeometry(curve, 16, 0.025, 8, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Grow during beat 3: 0.4-0.7 (4-7s)
    const visible = cycleT > 0.4 && cycleT < 0.8
    meshRef.current.visible = visible
    if (visible) {
      const growT = clamp01((cycleT - 0.4) / 0.1)
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
/*  Token Stream (16 instancedMesh green spheres along execute beam)    */
/* ------------------------------------------------------------------ */

function TokenStream({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(PAYMASTER_X + 0.7, 0.5, 0),
    new THREE.Vector3(TARGET_X - 0.5, 0.5, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active during 0.45-0.75 (4.5-7.5s)
    const active = cycleT > 0.45 && cycleT < 0.75

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.35 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI * 2) * 0.08
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
/*  RAI Fee Flow (12 instancedMesh amber spheres user <- paymaster)    */
/* ------------------------------------------------------------------ */

function RAIFeeFlow({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Reverse direction: user -> paymaster (RAI flows as payment)
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(USER_X + 0.5, 0.4, 0),
    new THREE.Vector3((USER_X + PAYMASTER_X) / 2, 0.15, 0.8),
    new THREE.Vector3(PAYMASTER_X - 0.5, 0.4, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    // Active during beat 4: 0.7-0.9 (7-9s)
    const active = cycleT > 0.7 && cycleT < 0.9

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.4 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI) * 0.1
        const size = 0.022 * (Math.sin(p * Math.PI) * 0.5 + 0.5)
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
      <meshBasicMaterial color={AMBER} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  RAI Fee Beam (tube from user to paymaster, visible during fee)     */
/* ------------------------------------------------------------------ */

function RAIFeeBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(USER_X + 0.5, 0.4, 0),
      new THREE.Vector3((USER_X + PAYMASTER_X) / 2, 0.15, 0.8),
      new THREE.Vector3(PAYMASTER_X - 0.5, 0.4, 0),
    )
    return new THREE.TubeGeometry(curve, 24, 0.012, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible during 0.68-0.92
    const visible = cycleT > 0.68 && cycleT < 0.92
    meshRef.current.visible = visible
    if (visible) {
      const fadeIn = clamp01((cycleT - 0.68) / 0.04)
      const fadeOut = cycleT > 0.88 ? clamp01((0.92 - cycleT) / 0.04) : 1
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.4 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={PURPLE} transparent opacity={0.4} roughness={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Operation Checkmark (green torus at user, appears after execution)  */
/* ------------------------------------------------------------------ */

function OperationCheckmark({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible 0.6-0.9 (6-9s)
    const visible = cycleT > 0.6 && cycleT < 0.92
    meshRef.current.visible = visible
    if (visible) {
      const scaleIn = clamp01((cycleT - 0.6) / 0.05)
      meshRef.current.scale.setScalar(easeInOut(scaleIn))
      meshRef.current.rotation.z = elapsedRef.current * 2
    }
  })

  return (
    <mesh ref={meshRef} position={[USER_X, 1.35, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.15, 0.03, 8, 16]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.9} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated Labels                                                    */
/* ------------------------------------------------------------------ */

function AnimatedLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const userLabelRef = useRef<THREE.Group>(null!)
  const paymasterLabelRef = useRef<THREE.Group>(null!)
  const paysGasRef = useRef<THREE.Group>(null!)
  const acceptRef = useRef<THREE.Group>(null!)
  const feeRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "User: RAI, no ETH" -- visible 0-0.5 (0-5s)
    if (userLabelRef.current) {
      userLabelRef.current.visible = reducedMotion || cycleT < 0.5
    }
    // "Paymaster: has ETH" -- visible 0-0.5 (0-5s)
    if (paymasterLabelRef.current) {
      paymasterLabelRef.current.visible = reducedMotion || cycleT < 0.5
    }
    // "Pays gas" -- visible 0.25-0.5 (2.5-5s)
    if (paysGasRef.current) {
      paysGasRef.current.visible = reducedMotion || (cycleT > 0.25 && cycleT < 0.5)
    }
    // "ACCEPT" -- visible 0.3-0.5 (3-5s)
    if (acceptRef.current) {
      acceptRef.current.visible = reducedMotion || (cycleT > 0.3 && cycleT < 0.5)
    }
    // "Fee: RAI" -- visible 0.7-0.9 (7-9s)
    if (feeRef.current) {
      feeRef.current.visible = reducedMotion || (cycleT > 0.7 && cycleT < 0.92)
    }
  })

  return (
    <>
      <group ref={userLabelRef}>
        <Html center position={[USER_X, -0.15, 1.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: '#71717a' }}>
            RAI tokens<br />no ETH for gas
          </p>
        </Html>
      </group>
      <group ref={paymasterLabelRef}>
        <Html center position={[PAYMASTER_X, -0.15, 1.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: '#71717a' }}>
            has ETH<br />wants RAI
          </p>
        </Html>
      </group>
      <group ref={paysGasRef}>
        <Html center position={[PAYMASTER_X, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-indigo-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: INDIGO }}>
              Pays gas in ETH
            </p>
          </div>
        </Html>
      </group>
      <group ref={acceptRef}>
        <Html center position={[PAYMASTER_X, -0.15, -1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              ACCEPT
            </p>
          </div>
        </Html>
      </group>
      <group ref={feeRef}>
        <Html center position={[(USER_X + PAYMASTER_X) / 2, -0.1, 1.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>
              Fee collected: RAI
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

function AmbientParticles({
  count = 8,
  reducedMotion,
}: {
  count?: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 8,
        y: Math.random() * 1.5 + 0.2,
        z: (Math.random() - 0.5) * 3,
        speed: 0.3 + Math.random() * 0.5,
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
        o.x + Math.sin(t * o.speed + o.phase) * 0.15,
        o.y + Math.sin(t * o.speed * 0.7 + o.phase) * 0.1,
        o.z + Math.cos(t * o.speed * 0.5 + o.phase) * 0.1,
      )
      dummy.scale.setScalar(0.008 + Math.sin(t * 2 + o.phase) * 0.003)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={INDIGO} transparent opacity={0.25} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">RAI tokens</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">ETH (gas)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: INDIGO }} />
        <span className="text-[10px] text-text-muted tracking-wide">Paymaster</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }}>
          <div className="w-full h-full rounded-sm opacity-50" />
        </div>
        <span className="text-[10px] text-text-muted tracking-wide">CALLDATAREAD</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function PaymasterFlow3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Paymaster gas flow showing how a user with RAI tokens but no ETH can still transact, with the paymaster covering gas in ETH and collecting a RAI fee"
      srDescription="A 3D scene with three nodes. On the left, a blue sphere represents the user holding amber RAI token discs but no ETH, shown by a red X mark. In the center, an indigo hexagonal prism represents the paymaster holding green ETH spheres. On the right, a blue cube is the target. An amber CALLDATAREAD arc connects user to paymaster as the paymaster reads the transaction intent. The paymaster burns ETH for gas (particles rise upward), an ACCEPT ring fires green, then a green beam extends to the target. Finally, amber RAI tokens flow back from user to paymaster as the fee payment."
      legend={<Legend />}
      fallbackText="Paymaster Flow -- User has RAI but no ETH. Paymaster pays gas in ETH, takes fee in RAI."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 6, 10], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* ------ USER ------ */}
          <UserNode reducedMotion={reducedMotion} />
          <RAIStack reducedMotion={reducedMotion} />
          <NoEthMark reducedMotion={reducedMotion} />

          {/* ------ PAYMASTER ------ */}
          <PaymasterNode reducedMotion={reducedMotion} />
          <ETHReserve reducedMotion={reducedMotion} />

          {/* ------ TARGET ------ */}
          <TargetNode reducedMotion={reducedMotion} />

          {/* ------ CALLDATAREAD ARC (beat 2) ------ */}
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={8} reducedMotion={reducedMotion} />

          {/* ------ GAS BURN (beat 2) ------ */}
          <GasBurnParticles count={12} reducedMotion={reducedMotion} />
          <AcceptRing reducedMotion={reducedMotion} />

          {/* ------ EXECUTE BEAM (beat 3) ------ */}
          <ExecuteBeam reducedMotion={reducedMotion} />
          <TokenStream count={16} reducedMotion={reducedMotion} />

          {/* ------ RAI FEE FLOW (beat 4) ------ */}
          <RAIFeeBeam reducedMotion={reducedMotion} />
          <RAIFeeFlow count={12} reducedMotion={reducedMotion} />

          {/* ------ OPERATION CHECKMARK ------ */}
          <OperationCheckmark reducedMotion={reducedMotion} />

          {/* ------ LABELS ------ */}
          <AnimatedLabels reducedMotion={reducedMotion} />

          {/* ------ AMBIENT ------ */}
          <AmbientParticles count={8} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={4}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 3.2}
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
