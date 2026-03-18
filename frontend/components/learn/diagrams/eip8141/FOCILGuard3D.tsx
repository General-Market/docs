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

const LEFT_X = -3.8    // center of "Without FOCIL" side
const RIGHT_X = 3.8    // center of "With FOCIL" side
const CYCLE = 10       // 10-second animation loop

const BLUE = '#3b82f6'
const PURPLE = '#8b5cf6'
const INDIGO = '#6366f1'
const PINK = '#ec4899'
const GREEN = '#22c55e'
const RED = '#ef4444'
const GRAY = '#9ca3af'

/* ------------------------------------------------------------------ */
/*  TX type definitions                                                */
/* ------------------------------------------------------------------ */

interface TxDef {
  color: string
  label: string
  isAA: boolean
}

const TX_DEFS: TxDef[] = [
  { color: BLUE, label: 'simple', isAA: false },
  { color: PURPLE, label: 'multisig', isAA: true },
  { color: BLUE, label: 'simple', isAA: false },
  { color: INDIGO, label: 'paymaster', isAA: true },
  { color: PINK, label: 'privacy', isAA: true },
  { color: BLUE, label: 'simple', isAA: false },
  { color: PURPLE, label: 'multisig', isAA: true },
  { color: INDIGO, label: 'paymaster', isAA: true },
]

// Indices of simple (non-AA) txs
const SIMPLE_INDICES = TX_DEFS.map((d, i) => (!d.isAA ? i : -1)).filter(i => i >= 0)
const AA_INDICES = TX_DEFS.map((d, i) => (d.isAA ? i : -1)).filter(i => i >= 0)

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
/*  Left Platform -- "Without FOCIL"                                   */
/* ------------------------------------------------------------------ */

function LeftPlatform() {
  return (
    <group position={[LEFT_X, 0, 0]}>
      <RoundedBox args={[5.8, 0.02, 3.8]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.4, 0.06, 3.4]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fef2f2" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>
          Without FOCIL
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Platform -- "With FOCIL"                                     */
/* ------------------------------------------------------------------ */

function RightPlatform() {
  return (
    <group position={[RIGHT_X, 0, 0]}>
      <RoundedBox args={[5.8, 0.02, 3.8]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.4, 0.06, 3.4]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#f0fdf4" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 2.0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
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
    <RoundedBox args={[0.02, 0.25, 3.4]} radius={0.004} smoothness={4} position={[0, 0.12, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Builder Node (gray box representing the block builder)             */
/* ------------------------------------------------------------------ */

function BuilderNode({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <RoundedBox args={[0.5, 0.7, 0.5]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={GRAY} roughness={0.5} />
      </RoundedBox>
      <Html center position={[0, 0.55, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: GRAY }}>Builder</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Block Outline (wireframe box representing a block)                 */
/* ------------------------------------------------------------------ */

function BlockOutline({
  position,
  color,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Subtle pulse when block is being filled (0.2-0.7)
    const pulse = cycleT > 0.2 && cycleT < 0.7
      ? 0.15 + Math.sin(cycleT * Math.PI * 4) * 0.04
      : 0.12
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = pulse
  })

  return (
    <group position={position}>
      <RoundedBox args={[1.4, 1.6, 1.4]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={color} transparent opacity={0.12} roughness={0.7} />
      </RoundedBox>
      <mesh ref={meshRef}>
        <boxGeometry args={[1.42, 1.62, 1.42]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  FOCIL Shield (green translucent barrier on right side)             */
/* ------------------------------------------------------------------ */

function FOCILShield({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Shield glows during tx passage (0.2-0.5)
    const active = cycleT > 0.2 && cycleT < 0.5
    const emissive = active
      ? 0.3 + Math.sin((cycleT - 0.2) / 0.3 * Math.PI * 6) * 0.15
      : 0.08
    matRef.current.emissiveIntensity = emissive

    // Slight hover
    groupRef.current.position.y = 0.75 + Math.sin(elapsedRef.current * 1.2) * 0.03
  })

  return (
    <group ref={groupRef} position={[RIGHT_X - 0.3, 0.75, 0]}>
      <RoundedBox args={[0.12, 1.6, 1.8]} radius={0.04} smoothness={4}>
        <meshStandardMaterial
          ref={matRef}
          color={GREEN}
          transparent
          opacity={0.25}
          roughness={0.4}
          emissive={GREEN}
          emissiveIntensity={0.08}
        />
      </RoundedBox>
      {/* Shield edge glow */}
      <mesh>
        <boxGeometry args={[0.14, 1.62, 1.82]} />
        <meshBasicMaterial color={GREEN} wireframe transparent opacity={0.25} />
      </mesh>
      <Html center position={[0, 1.05, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-green-200 rounded px-1.5 py-0.5">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>FOCIL</p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Left TX Cubes (instanced) -- some get blocked, some pass           */
/* ------------------------------------------------------------------ */

function LeftTXCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const colorArray = useMemo(() => {
    const arr = new Float32Array(TX_DEFS.length * 3)
    TX_DEFS.forEach((tx, i) => {
      const c = new THREE.Color(tx.color)
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    })
    return arr
  }, [])

  const colorsSetRef = useRef(false)

  // Starting positions (mempool lineup)
  const startPositions = useMemo(() =>
    TX_DEFS.map((_, i) => ({
      x: LEFT_X - 1.8,
      y: 0.25 + (i % 4) * 0.35,
      z: -0.8 + Math.floor(i / 4) * 0.5,
    })),
  [])

  // Block positions for accepted txs (only simple ones enter block)
  const blockX = LEFT_X + 1.5
  const acceptedSlots = useMemo(() => {
    let slot = 0
    return TX_DEFS.map((tx) => {
      if (!tx.isAA) {
        const pos = { x: blockX - 0.2 + (slot % 2) * 0.4, y: 0.25 + Math.floor(slot / 2) * 0.35, z: -0.15 + (slot % 2) * 0.3 }
        slot++
        return pos
      }
      return null
    })
  }, [blockX])

  // Rejected positions (fallen cubes near builder)
  const rejectedPositions = useMemo(() => {
    let slot = 0
    return TX_DEFS.map((tx) => {
      if (tx.isAA) {
        const pos = {
          x: LEFT_X - 0.3 + (slot % 3) * 0.4 - 0.4,
          y: 0.15,
          z: -0.6 + Math.floor(slot / 3) * 0.5,
        }
        slot++
        return pos
      }
      return null
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (reducedMotion) {
      // Static: show end state (some in block, some rejected)
      TX_DEFS.forEach((tx, i) => {
        if (!tx.isAA && acceptedSlots[i]) {
          dummy.position.set(acceptedSlots[i]!.x, acceptedSlots[i]!.y, acceptedSlots[i]!.z)
        } else if (tx.isAA && rejectedPositions[i]) {
          dummy.position.set(rejectedPositions[i]!.x, rejectedPositions[i]!.y, rejectedPositions[i]!.z)
        }
        dummy.scale.setScalar(1)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    TX_DEFS.forEach((tx, i) => {
      const start = startPositions[i]

      if (cycleT < 0.2) {
        // 0-2s: Cubes line up in mempool
        const appear = easeInOut(clamp01(cycleT / 0.2))
        dummy.position.set(start.x, start.y, start.z)
        dummy.scale.setScalar(appear)
        dummy.rotation.set(0, 0, 0)
      } else if (cycleT < 0.5) {
        // 2-5s: Move toward builder. AA cubes get blocked, simple cubes pass through.
        const moveT = clamp01((cycleT - 0.2) / 0.3)
        const eased = easeInOut(moveT)

        if (!tx.isAA) {
          // Simple txs pass through builder into block
          const target = acceptedSlots[i]!
          dummy.position.set(
            start.x + (target.x - start.x) * eased,
            start.y + (target.y - start.y) * eased + Math.sin(eased * Math.PI) * 0.15,
            start.z + (target.z - start.z) * eased,
          )
          dummy.scale.setScalar(1)
          dummy.rotation.y = eased * Math.PI * 0.3
        } else {
          // AA txs approach builder then bounce back
          const approachT = clamp01(moveT * 2) // first half: approach
          const bounceT = clamp01((moveT - 0.5) * 2) // second half: bounce

          const builderX = LEFT_X
          if (moveT < 0.5) {
            // Approaching builder
            dummy.position.set(
              start.x + (builderX - start.x) * easeInOut(approachT),
              start.y + Math.sin(approachT * Math.PI) * 0.1,
              start.z,
            )
            dummy.scale.setScalar(1)
          } else {
            // Bouncing back and falling
            const rejected = rejectedPositions[i]!
            const eB = easeInOut(bounceT)
            dummy.position.set(
              builderX + (rejected.x - builderX) * eB,
              start.y + (rejected.y - start.y) * eB - Math.sin(bounceT * Math.PI) * 0.1,
              start.z + (rejected.z - start.z) * eB,
            )
            dummy.scale.setScalar(1 - bounceT * 0.15)
            dummy.rotation.x = bounceT * 0.4
            dummy.rotation.z = bounceT * 0.3
          }
        }
      } else if (cycleT < 0.7) {
        // 5-7s: Hold positions
        if (!tx.isAA) {
          const target = acceptedSlots[i]!
          dummy.position.set(target.x, target.y, target.z)
          dummy.scale.setScalar(1)
          dummy.rotation.y = Math.PI * 0.3
        } else {
          const rejected = rejectedPositions[i]!
          dummy.position.set(rejected.x, rejected.y, rejected.z)
          dummy.scale.setScalar(0.85)
          dummy.rotation.x = 0.4
          dummy.rotation.z = 0.3
        }
      } else if (cycleT < 1.0) {
        // 7-10s: Hold then fade
        const fadeT = clamp01((cycleT - 0.85) / 0.15)
        if (!tx.isAA) {
          const target = acceptedSlots[i]!
          dummy.position.set(target.x, target.y, target.z)
          dummy.scale.setScalar(1 - fadeT)
          dummy.rotation.y = Math.PI * 0.3
        } else {
          const rejected = rejectedPositions[i]!
          dummy.position.set(rejected.x, rejected.y, rejected.z)
          dummy.scale.setScalar(0.85 * (1 - fadeT))
          dummy.rotation.x = 0.4
          dummy.rotation.z = 0.3
        }
      }

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true

    // Set up vertex colors on first frame
    if (!colorsSetRef.current) {
      meshRef.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSetRef.current = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TX_DEFS.length]}>
      <boxGeometry args={[0.3, 0.22, 0.3]} />
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Left Rejection X Marks (red crosses for AA txs)                    */
/* ------------------------------------------------------------------ */

function LeftRejectionMarks({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  // X mark positions: between mempool and builder on left side, one per AA tx
  const markPositions = useMemo(() => {
    let slot = 0
    return AA_INDICES.map((idx) => {
      const y = 0.25 + (idx % 4) * 0.35
      const z = -0.8 + Math.floor(idx / 4) * 0.5
      slot++
      return { x: LEFT_X - 0.9, y, z }
    })
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // X marks appear during blocking phase (0.35-0.7), fade after
    if (reducedMotion) {
      groupRef.current.visible = true
      return
    }
    const visible = cycleT > 0.35 && cycleT < 0.85
    groupRef.current.visible = visible
  })

  return (
    <group ref={groupRef}>
      {markPositions.map((pos, i) => (
        <group key={i} position={[pos.x, pos.y, pos.z]}>
          <RoundedBox args={[0.22, 0.04, 0.04]} radius={0.008} smoothness={4} rotation={[0, 0, Math.PI / 4]}>
            <meshStandardMaterial color={RED} roughness={0.4} emissive={RED} emissiveIntensity={0.2} />
          </RoundedBox>
          <RoundedBox args={[0.22, 0.04, 0.04]} radius={0.008} smoothness={4} rotation={[0, 0, -Math.PI / 4]}>
            <meshStandardMaterial color={RED} roughness={0.4} emissive={RED} emissiveIntensity={0.2} />
          </RoundedBox>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right TX Cubes (instanced) -- all pass through FOCIL shield        */
/* ------------------------------------------------------------------ */

function RightTXCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const colorArray = useMemo(() => {
    const arr = new Float32Array(TX_DEFS.length * 3)
    TX_DEFS.forEach((tx, i) => {
      const c = new THREE.Color(tx.color)
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    })
    return arr
  }, [])

  const colorsSetRef = useRef(false)

  // Starting positions (mempool lineup on right side)
  const startPositions = useMemo(() =>
    TX_DEFS.map((_, i) => ({
      x: RIGHT_X - 1.8,
      y: 0.25 + (i % 4) * 0.35,
      z: -0.8 + Math.floor(i / 4) * 0.5,
    })),
  [])

  // Block positions for all txs (full block)
  const blockX = RIGHT_X + 1.5
  const blockSlots = useMemo(() =>
    TX_DEFS.map((_, i) => ({
      x: blockX - 0.3 + (i % 2) * 0.4,
      y: 0.2 + Math.floor(i / 2) * 0.32,
      z: -0.25 + (i % 2) * 0.35,
    })),
  [blockX])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (reducedMotion) {
      TX_DEFS.forEach((_, i) => {
        const target = blockSlots[i]
        dummy.position.set(target.x, target.y, target.z)
        dummy.scale.setScalar(1)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      })
      meshRef.current.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    TX_DEFS.forEach((_, i) => {
      const start = startPositions[i]
      const target = blockSlots[i]

      // Stagger each cube slightly
      const stagger = i * 0.015

      if (cycleT < 0.2) {
        // 0-2s: Cubes line up
        const appear = easeInOut(clamp01(cycleT / 0.2))
        dummy.position.set(start.x, start.y, start.z)
        dummy.scale.setScalar(appear)
        dummy.rotation.set(0, 0, 0)
      } else if (cycleT < 0.5) {
        // 2-5s: All cubes pass through FOCIL shield and enter block
        const moveT = clamp01((cycleT - 0.2 - stagger) / 0.25)
        const eased = easeInOut(clamp01(moveT))
        dummy.position.set(
          start.x + (target.x - start.x) * eased,
          start.y + (target.y - start.y) * eased + Math.sin(eased * Math.PI) * 0.15,
          start.z + (target.z - start.z) * eased,
        )
        dummy.scale.setScalar(1)
        dummy.rotation.y = eased * Math.PI * 0.3
      } else if (cycleT < 0.7) {
        // 5-7s: Hold in block
        dummy.position.set(target.x, target.y, target.z)
        dummy.scale.setScalar(1)
        dummy.rotation.y = Math.PI * 0.3
      } else if (cycleT < 1.0) {
        // 7-10s: Hold then fade
        const fadeT = clamp01((cycleT - 0.85) / 0.15)
        dummy.position.set(target.x, target.y, target.z)
        dummy.scale.setScalar(1 - fadeT)
        dummy.rotation.y = Math.PI * 0.3
      }

      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })

    meshRef.current.instanceMatrix.needsUpdate = true

    if (!colorsSetRef.current) {
      meshRef.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSetRef.current = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TX_DEFS.length]}>
      <boxGeometry args={[0.3, 0.22, 0.3]} />
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Left Flow Particles (partial -- only along accepted paths)         */
/* ------------------------------------------------------------------ */

function LeftFlowParticles({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(LEFT_X - 1.8, 0.14, 0),
    new THREE.Vector3(LEFT_X + 1.5, 0.14, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.12 + i / count) % 1)
      // Only show particles in the accepted path (roughly first 60%)
      const show = p < 0.6
      dummy.position.copy(curve.getPoint(show ? p / 0.6 : 0))
      dummy.position.y += 0.02
      dummy.scale.setScalar(show ? 0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4) : 0)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GRAY} transparent opacity={0.35} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Flow Particles (full -- along all paths through shield)      */
/* ------------------------------------------------------------------ */

function RightFlowParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(RIGHT_X - 1.8, 0.14, 0),
    new THREE.Vector3(RIGHT_X + 1.5, 0.14, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.15 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += 0.02
      dummy.scale.setScalar(0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Bounce Particles (debris from rejected cubes on left)              */
/* ------------------------------------------------------------------ */

function BounceParticles({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Random scatter offsets
  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 1.2 + LEFT_X - 0.5,
        z: (Math.random() - 0.5) * 1.5,
        speed: 0.5 + Math.random() * 1.5,
        phase: Math.random() * Math.PI * 2,
        maxY: 0.2 + Math.random() * 0.4,
      })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    for (let i = 0; i < count; i++) {
      const o = offsets[i]
      // Particles appear during bounce phase (0.35-0.55), then settle
      if (cycleT > 0.35 && cycleT < 0.65) {
        const t = (cycleT - 0.35) / 0.3
        dummy.position.set(
          o.x + Math.sin(t * o.speed * 3 + o.phase) * 0.15,
          o.maxY * Math.sin(t * Math.PI) + 0.1,
          o.z + Math.cos(t * o.speed * 2 + o.phase) * 0.1,
        )
        dummy.scale.setScalar(0.015 * (1 - t * 0.5))
      } else {
        dummy.scale.setScalar(0)
        dummy.position.set(o.x, 0, o.z)
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={RED} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Inclusion Count Labels (animated: "3/8" on left, "8/8" on right)   */
/* ------------------------------------------------------------------ */

function InclusionLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const leftRef = useRef<THREE.Group>(null!)
  const rightRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!leftRef.current || !rightRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Show count labels 0.5-0.85 (5-8.5s)
    const visible = reducedMotion || (cycleT > 0.5 && cycleT < 0.85)
    leftRef.current.visible = visible
    rightRef.current.visible = visible
  })

  return (
    <>
      <group ref={leftRef}>
        <Html center position={[LEFT_X + 1.5, 1.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-red-200 rounded px-2 py-1">
            <p className="text-[14px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
              {SIMPLE_INDICES.length}/{TX_DEFS.length}
            </p>
          </div>
        </Html>
      </group>
      <group ref={rightRef}>
        <Html center position={[RIGHT_X + 1.5, 1.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[14px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              {TX_DEFS.length}/{TX_DEFS.length}
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Verdict Labels ("Censored" vs "Censorship resistant")              */
/* ------------------------------------------------------------------ */

function VerdictLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const leftRef = useRef<THREE.Group>(null!)
  const rightRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!leftRef.current || !rightRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Verdict visible 0.7-0.95 (7-9.5s)
    const visible = reducedMotion || (cycleT > 0.7 && cycleT < 0.95)
    leftRef.current.visible = visible
    rightRef.current.visible = visible
  })

  return (
    <>
      <group ref={leftRef}>
        <Html center position={[LEFT_X, -0.15, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-red-200 rounded px-2.5 py-1">
            <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>
              Censored
            </p>
          </div>
        </Html>
      </group>
      <group ref={rightRef}>
        <Html center position={[RIGHT_X, -0.15, 1.8]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2.5 py-1">
            <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Censorship resistant
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Blocked Status Label (left side, shows during block phase)         */
/* ------------------------------------------------------------------ */

function BlockedStatusLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible 0.35-0.55 (3.5-5.5s)
    ref.current.visible = reducedMotion || (cycleT > 0.35 && cycleT < 0.55)
  })

  return (
    <group ref={ref}>
      <Html center position={[LEFT_X - 0.5, 1.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: RED }}>
          Txs blocked
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  All Included Label (right side, shows after inclusion)             */
/* ------------------------------------------------------------------ */

function AllIncludedLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible 0.5-0.7 (5-7s)
    ref.current.visible = reducedMotion || (cycleT > 0.5 && cycleT < 0.7)
  })

  return (
    <group ref={ref}>
      <Html center position={[RIGHT_X + 0.5, 1.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GREEN }}>
          All included
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Ambient Floating Particles                                         */
/* ------------------------------------------------------------------ */

function AmbientParticles({
  centerX,
  count = 8,
  color,
  reducedMotion,
}: {
  centerX: number
  count?: number
  color: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 4,
        y: Math.random() * 1.4 + 0.2,
        z: (Math.random() - 0.5) * 2.5,
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
        centerX + o.x + Math.sin(t * o.speed + o.phase) * 0.12,
        o.y + Math.sin(t * o.speed * 0.7 + o.phase) * 0.08,
        o.z + Math.cos(t * o.speed * 0.5 + o.phase) * 0.08,
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
      <meshBasicMaterial color={color} transparent opacity={0.25} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Simple TX</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Multisig</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: INDIGO }} />
        <span className="text-[10px] text-text-muted tracking-wide">Paymaster</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PINK }} />
        <span className="text-[10px] text-text-muted tracking-wide">Privacy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">FOCIL shield</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm relative" style={{ backgroundColor: RED }}>
          <span className="absolute inset-0 flex items-center justify-center text-white text-[7px] font-bold">X</span>
        </div>
        <span className="text-[10px] text-text-muted tracking-wide">Censored</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function FOCILGuard3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Side-by-side comparison showing how FOCIL prevents censorship of account abstraction transactions by block builders"
      srDescription="A 3D scene split into two halves. The left side, labeled Without FOCIL, shows a builder node blocking 5 colored AA transaction cubes (multisig, paymaster, privacy) with red X marks while allowing only 3 simple blue transactions into a sparse block. The right side, labeled With FOCIL, shows a green translucent FOCIL shield that forces the builder to include all 8 transactions into a full block. The contrast demonstrates that without FOCIL protection, builders can censor advanced transaction types, but with FOCIL, censorship resistance is guaranteed."
      legend={<Legend />}
      fallbackText="Without FOCIL: builder censors AA transactions (3/8 included). With FOCIL: all transactions included (8/8), censorship resistant."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5, 9], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platforms */}
          <LeftPlatform />
          <RightPlatform />
          <Divider />

          {/* ------ LEFT: Without FOCIL ------ */}
          <BuilderNode position={[LEFT_X, 0.4, 0]} />
          <BlockOutline position={[LEFT_X + 1.5, 0.85, 0]} color={RED} reducedMotion={reducedMotion} />
          <LeftTXCubes reducedMotion={reducedMotion} />
          <LeftRejectionMarks reducedMotion={reducedMotion} />
          <BounceParticles count={10} reducedMotion={reducedMotion} />
          <LeftFlowParticles count={8} reducedMotion={reducedMotion} />
          <BlockedStatusLabel reducedMotion={reducedMotion} />

          {/* ------ RIGHT: With FOCIL ------ */}
          <BuilderNode position={[RIGHT_X + 0.3, 0.4, 0]} />
          <FOCILShield reducedMotion={reducedMotion} />
          <BlockOutline position={[RIGHT_X + 1.5, 0.85, 0]} color={GREEN} reducedMotion={reducedMotion} />
          <RightTXCubes reducedMotion={reducedMotion} />
          <RightFlowParticles count={12} reducedMotion={reducedMotion} />
          <AllIncludedLabel reducedMotion={reducedMotion} />

          {/* ------ Labels ------ */}
          <InclusionLabels reducedMotion={reducedMotion} />
          <VerdictLabels reducedMotion={reducedMotion} />

          {/* ------ Ambient particles for visual density ------ */}
          <AmbientParticles centerX={LEFT_X} count={6} color={RED} reducedMotion={reducedMotion} />
          <AmbientParticles centerX={RIGHT_X} count={8} color={GREEN} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI * 40 / 180}
            maxPolarAngle={Math.PI * 55 / 180}
            minAzimuthAngle={-Math.PI / 12}
            maxAzimuthAngle={Math.PI / 12}
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
