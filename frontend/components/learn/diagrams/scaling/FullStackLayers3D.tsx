'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ── Constants ── */

const L1_Y = 0.2
const L2_Y = 0.8
const L3_Y = 1.4

const FLOOR_W = 4.0
const FLOOR_H = 0.03
const FLOOR_D = 2.5

const BLUE = '#3b82f6'
const INDIGO = '#6366f1'
const VIOLET = '#8b5cf6'
const GREEN = '#22c55e'
const ZINC = '#a1a1aa'

/** Full cycle duration in seconds */
const CYCLE = 8

/* ── Deterministic random ── */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/* ── Helper: vertical tube path ── */

function makeVerticalPath(x: number, z: number, yBottom: number, yTop: number) {
  return new THREE.LineCurve3(
    new THREE.Vector3(x, yBottom, z),
    new THREE.Vector3(x, yTop, z),
  )
}

/* ── Phase boundaries (fractions of CYCLE) ── */
// 0.00–0.10  Entry: cube rises from below to Execution floor
// 0.10–0.30  Execution: split into 4 lanes, travel across, merge
// 0.30–0.40  Rise: Execution → Data floor
// 0.40–0.60  Data: fragments spread outward, consolidate
// 0.60–0.70  Rise: Data → Proof floor
// 0.70–0.90  Proof: cube compresses, proof token emits checkmarks
// 0.90–1.00  Output: proof rises, VALID label, burst, reset

const P_ENTRY_END = 0.10
const P_EXEC_END = 0.30
const P_RISE1_END = 0.40
const P_DATA_END = 0.60
const P_RISE2_END = 0.70
const P_PROOF_END = 0.90
// P_OUTPUT_END = 1.0

/* ── Layer 1: Execution Floor ── */

function ExecutionLayer() {
  return (
    <group position={[0, L1_Y, 0]}>
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#dbeafe" roughness={0.75} />
      </RoundedBox>

      {/* Layer label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[18px] font-bold uppercase tracking-wider"
          style={{ color: BLUE }}
        >
          Execution
        </p>
      </Html>

      {/* Throughput label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[1.4, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[11px] font-mono whitespace-nowrap" style={{ color: BLUE, opacity: 0.7 }}>
          15M gas →
        </p>
      </Html>
    </group>
  )
}

/* ── Layer 2: Data Floor ── */

function DataLayer() {
  return (
    <group position={[0, L2_Y, 0]}>
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#e0e7ff" roughness={0.75} />
      </RoundedBox>

      {/* Layer label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[18px] font-bold uppercase tracking-wider"
          style={{ color: INDIGO }}
        >
          Data
        </p>
      </Html>

      {/* Throughput label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[1.4, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[11px] font-mono whitespace-nowrap" style={{ color: INDIGO, opacity: 0.7 }}>
          8 MB/sec
        </p>
      </Html>
    </group>
  )
}

/* ── Layer 3: Proofs Floor ── */

function ProofsLayer() {
  return (
    <group position={[0, L3_Y, 0]}>
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#f5f3ff" roughness={0.75} />
      </RoundedBox>

      {/* Layer label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[18px] font-bold uppercase tracking-wider"
          style={{ color: VIOLET }}
        >
          Proofs
        </p>
      </Html>

      {/* Throughput label */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[1.4, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[11px] font-mono whitespace-nowrap" style={{ color: VIOLET, opacity: 0.7 }}>
          1 proof per block
        </p>
      </Html>
    </group>
  )
}

/* ── Elevator Shafts (4 vertical tubes) ── */

function ElevatorShafts() {
  const shafts = useMemo(() => {
    const configs = [
      { x: -0.8, z: -0.6, yBottom: L1_Y + FLOOR_H / 2, yTop: L2_Y - FLOOR_H / 2 },
      { x: 0.8, z: 0.6, yBottom: L1_Y + FLOOR_H / 2, yTop: L2_Y - FLOOR_H / 2 },
      { x: -0.8, z: 0.6, yBottom: L2_Y + FLOOR_H / 2, yTop: L3_Y - FLOOR_H / 2 },
      { x: 0.8, z: -0.6, yBottom: L2_Y + FLOOR_H / 2, yTop: L3_Y - FLOOR_H / 2 },
    ]

    return configs.map((c) => {
      const path = makeVerticalPath(c.x, c.z, c.yBottom, c.yTop)
      return {
        ...c,
        geo: new THREE.TubeGeometry(path, 8, 0.012, 6, false),
      }
    })
  }, [])

  return (
    <>
      {shafts.map((shaft, i) => (
        <mesh key={`shaft-${i}`} geometry={shaft.geo}>
          <meshStandardMaterial color={ZINC} roughness={0.4} />
        </mesh>
      ))}
    </>
  )
}

/* ── Transaction Cube — the main animated element ── */

function TransactionCube({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  const cubeColor = useMemo(() => new THREE.Color(BLUE), [])
  const indigoColor = useMemo(() => new THREE.Color(INDIGO), [])
  const violetColor = useMemo(() => new THREE.Color(VIOLET), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])

  useFrame((_, delta) => {
    if (!groupRef.current || !matRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE

    const group = groupRef.current
    const mat = matRef.current

    // Default state
    group.visible = true
    group.scale.set(1, 1, 1)
    mat.emissiveIntensity = 0

    if (phase < P_ENTRY_END) {
      // Entry: rise from below to Execution floor
      const p = phase / P_ENTRY_END
      const startY = L1_Y - 0.4
      const endY = L1_Y + FLOOR_H / 2 + 0.07
      group.position.set(0, startY + (endY - startY) * easeOutCubic(p), 0)
      mat.color.copy(cubeColor)
      mat.emissiveIntensity = 0.1

    } else if (phase < P_EXEC_END) {
      // Execution: cube is on the execution floor, pulsing
      const p = (phase - P_ENTRY_END) / (P_EXEC_END - P_ENTRY_END)
      const yPos = L1_Y + FLOOR_H / 2 + 0.07
      // Move across the floor left to right
      const xPos = -1.4 + p * 2.8
      group.position.set(xPos, yPos, 0)
      mat.color.copy(cubeColor)
      mat.emissiveIntensity = 0.15 + Math.sin(p * Math.PI * 4) * 0.1

    } else if (phase < P_RISE1_END) {
      // Rise from Execution to Data floor
      const p = (phase - P_EXEC_END) / (P_RISE1_END - P_EXEC_END)
      const startY = L1_Y + FLOOR_H / 2 + 0.07
      const endY = L2_Y + FLOOR_H / 2 + 0.07
      group.position.set(0, startY + (endY - startY) * easeInOutCubic(p), 0)
      mat.color.copy(cubeColor).lerp(indigoColor, p)
      mat.emissiveIntensity = 0.2

    } else if (phase < P_DATA_END) {
      // Data: cube is on the data floor
      const p = (phase - P_RISE1_END) / (P_DATA_END - P_RISE1_END)
      const yPos = L2_Y + FLOOR_H / 2 + 0.07
      const xPos = -1.4 + p * 2.8
      group.position.set(xPos, yPos, 0)
      mat.color.copy(indigoColor)
      mat.emissiveIntensity = 0.15 + Math.sin(p * Math.PI * 3) * 0.1

    } else if (phase < P_RISE2_END) {
      // Rise from Data to Proofs floor
      const p = (phase - P_DATA_END) / (P_RISE2_END - P_DATA_END)
      const startY = L2_Y + FLOOR_H / 2 + 0.07
      const endY = L3_Y + FLOOR_H / 2 + 0.07
      group.position.set(0, startY + (endY - startY) * easeInOutCubic(p), 0)
      mat.color.copy(indigoColor).lerp(violetColor, p)
      mat.emissiveIntensity = 0.2

    } else if (phase < P_PROOF_END) {
      // Proof: compression animation
      const p = (phase - P_RISE2_END) / (P_PROOF_END - P_RISE2_END)
      const yPos = L3_Y + FLOOR_H / 2 + 0.07
      group.position.set(0, yPos, 0)
      // Shrink the cube to simulate compression
      const s = 1.0 - p * 0.6
      group.scale.set(s, s, s)
      mat.color.copy(violetColor).lerp(greenColor, p)
      mat.emissiveIntensity = 0.15 + p * 0.5

    } else {
      // Output: proof rises above the top floor
      const p = (phase - P_PROOF_END) / (1.0 - P_PROOF_END)
      const startY = L3_Y + FLOOR_H / 2 + 0.07
      const endY = L3_Y + 0.65
      group.position.set(0, startY + (endY - startY) * easeOutCubic(p), 0)
      group.scale.setScalar(0.4 + p * 0.2)
      mat.color.copy(greenColor)
      mat.emissiveIntensity = 0.4 + p * 0.3
      // Fade out at the very end
      if (p > 0.8) {
        group.scale.setScalar((1 - (p - 0.8) / 0.2) * 0.6)
      }
    }
  })

  return (
    <group ref={groupRef}>
      <RoundedBox args={[0.12, 0.12, 0.12]} radius={0.015} smoothness={4}>
        <meshStandardMaterial
          ref={matRef}
          color={BLUE}
          roughness={0.3}
          emissive={BLUE}
          emissiveIntensity={0.1}
        />
      </RoundedBox>
    </group>
  )
}

/* ── Parallel Lanes (4 lane cubes on Execution floor) ── */

function ParallelLanes({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const laneZPositions = useMemo(() => [-0.4, -0.13, 0.13, 0.4], [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE

    for (let i = 0; i < 4; i++) {
      if (phase >= P_ENTRY_END && phase < P_EXEC_END) {
        const p = (phase - P_ENTRY_END) / (P_EXEC_END - P_ENTRY_END)
        const yPos = L1_Y + FLOOR_H / 2 + 0.07

        // Spread: first 30% of exec phase, cubes separate from center
        // Travel: 30%-70%, cubes move left to right in separate lanes
        // Merge: 70%-100%, cubes converge back to center

        let xPos: number
        let zOff: number

        if (p < 0.2) {
          // Spread from center
          const sp = p / 0.2
          xPos = -1.4 + sp * 0.3
          zOff = laneZPositions[i] * easeOutCubic(sp)
        } else if (p < 0.8) {
          // Travel across
          const tp = (p - 0.2) / 0.6
          xPos = -1.1 + tp * 2.2
          zOff = laneZPositions[i]
        } else {
          // Merge back
          const mp = (p - 0.8) / 0.2
          xPos = 1.1 + mp * 0.3
          zOff = laneZPositions[i] * (1 - easeInCubic(mp))
        }

        dummy.position.set(xPos, yPos, zOff)
        dummy.scale.setScalar(0.6)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        // Hide by scaling to zero
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 4]}>
      <boxGeometry args={[0.08, 0.08, 0.08]} />
      <meshStandardMaterial
        color={BLUE}
        roughness={0.3}
        emissive={BLUE}
        emissiveIntensity={0.15}
        transparent
        opacity={0.6}
      />
    </instancedMesh>
  )
}

/* ── Data Fragments (spread on Data floor) ── */

function DataFragments({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const fragmentDirs = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return {
        dx: Math.cos(angle) * 0.8,
        dz: Math.sin(angle) * 0.5,
      }
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE

    for (let i = 0; i < 8; i++) {
      if (phase >= P_RISE1_END && phase < P_DATA_END) {
        const p = (phase - P_RISE1_END) / (P_DATA_END - P_RISE1_END)
        const yPos = L2_Y + FLOOR_H / 2 + 0.07

        // Progress of main cube across the floor
        const mainX = -1.4 + p * 2.8

        let spread: number
        if (p < 0.2) {
          spread = easeOutCubic(p / 0.2)
        } else if (p < 0.8) {
          spread = 1.0
        } else {
          spread = 1.0 - easeInCubic((p - 0.8) / 0.2)
        }

        const d = fragmentDirs[i]
        dummy.position.set(
          mainX + d.dx * spread,
          yPos,
          d.dz * spread,
        )
        dummy.scale.setScalar(0.4 * spread)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 8]}>
      <boxGeometry args={[0.06, 0.06, 0.06]} />
      <meshStandardMaterial
        color={INDIGO}
        roughness={0.3}
        emissive={INDIGO}
        emissiveIntensity={0.15}
        transparent
        opacity={0.5}
      />
    </instancedMesh>
  )
}

/* ── Proof Checkmarks (emitted during proof phase) ── */

function ProofCheckmarks({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const checkDirs = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2
      return {
        dx: Math.cos(angle) * 0.5,
        dy: 0.2 + seededRandom(i * 13 + 7) * 0.3,
        dz: Math.sin(angle) * 0.5,
      }
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE

    for (let i = 0; i < 6; i++) {
      if (phase >= P_RISE2_END + 0.1 && phase < P_PROOF_END) {
        const localP = (phase - (P_RISE2_END + 0.1)) / (P_PROOF_END - P_RISE2_END - 0.1)
        const yPos = L3_Y + FLOOR_H / 2 + 0.07
        const d = checkDirs[i]

        const spread = easeOutCubic(localP)
        dummy.position.set(
          d.dx * spread,
          yPos + d.dy * spread,
          d.dz * spread,
        )
        const fadeIn = Math.min(1, localP * 4)
        const fadeOut = localP > 0.7 ? 1 - (localP - 0.7) / 0.3 : 1
        dummy.scale.setScalar(0.03 * fadeIn * fadeOut)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 6]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshStandardMaterial
        color={GREEN}
        roughness={0.2}
        emissive={GREEN}
        emissiveIntensity={0.4}
      />
    </instancedMesh>
  )
}

/* ── Valid Block (appears at output phase) ── */

function ValidBlock({ reducedMotion }: { reducedMotion: boolean }) {
  const blockRef = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!blockRef.current || !matRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE

    if (phase >= P_PROOF_END) {
      const p = (phase - P_PROOF_END) / (1.0 - P_PROOF_END)
      blockRef.current.visible = true
      blockRef.current.rotation.y = t * 0.5
      // Scale in then out
      const s = p < 0.3 ? easeOutCubic(p / 0.3) : (p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1)
      blockRef.current.scale.setScalar(Math.max(0.01, s))
      matRef.current.emissiveIntensity = 0.2 + p * 0.3
    } else {
      blockRef.current.visible = false
    }
  })

  return (
    <group position={[0, L3_Y + 0.55, 0]}>
      <group ref={blockRef}>
        <RoundedBox args={[0.3, 0.18, 0.3]} radius={0.03} smoothness={4}>
          <meshStandardMaterial
            ref={matRef}
            color={GREEN}
            roughness={0.4}
            emissive={GREEN}
            emissiveIntensity={0.15}
          />
        </RoundedBox>
      </group>

      {/* "VALID" label — shown via useFrame visibility */}
      <ValidLabel reducedMotion={reducedMotion} />
    </group>
  )
}

/* ── VALID label (Html, shown only during output phase) ── */

function ValidLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const phase = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.style.opacity = phase >= P_PROOF_END ? '1' : '0'
  })

  return (
    <Html
      center
      transform
      distanceFactor={5}
      position={[0, 0.22, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p ref={ref} className="text-[22px] font-bold transition-none" style={{ color: GREEN, opacity: 0 }}>
        VALID
      </p>
    </Html>
  )
}

/* ── Output Beam (pulsing cylinder above top floor) ── */

function OutputBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const phase = (t % CYCLE) / CYCLE
    if (phase >= P_PROOF_END) {
      const p = (phase - P_PROOF_END) / (1.0 - P_PROOF_END)
      matRef.current.opacity = 0.05 + p * 0.2
    } else {
      matRef.current.opacity = 0.03
    }
  })

  return (
    <mesh position={[0, L3_Y + 0.95, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
      <meshBasicMaterial
        ref={matRef}
        color={GREEN}
        transparent
        opacity={0.03}
      />
    </mesh>
  )
}

/* ── Output Burst Particles (16 spheres emitting at output phase) ── */

function OutputBurst({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const directions = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2
      return {
        dx: Math.cos(angle) * 0.3,
        dz: Math.sin(angle) * 0.3,
        speed: 0.8 + seededRandom(i * 17 + 3) * 0.4,
        phase: seededRandom(i * 23 + 7),
      }
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const cyclePhase = (t % CYCLE) / CYCLE

    for (let i = 0; i < 16; i++) {
      if (cyclePhase >= P_PROOF_END) {
        const p = (cyclePhase - P_PROOF_END) / (1.0 - P_PROOF_END)
        const d = directions[i]
        const progress = Math.min(1, p * d.speed + d.phase * 0.3)

        const x = d.dx * progress
        const y = L3_Y + 0.55 + progress * 0.5
        const z = d.dz * progress

        const alpha = progress < 0.3
          ? progress / 0.3
          : Math.max(0, 1 - (progress - 0.3) / 0.7)

        dummy.position.set(x, y, z)
        dummy.scale.setScalar(0.01 * alpha)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(i, dummy.matrix)
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 16]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ── Easing functions ── */

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

function easeInCubic(t: number) {
  return t * t * t
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/* ── Main Scene ── */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* Layer floors */}
      <ExecutionLayer />
      <DataLayer />
      <ProofsLayer />

      {/* Elevator shafts */}
      <ElevatorShafts />

      {/* Transaction flow animation */}
      <TransactionCube reducedMotion={reducedMotion} />
      <ParallelLanes reducedMotion={reducedMotion} />
      <DataFragments reducedMotion={reducedMotion} />
      <ProofCheckmarks reducedMotion={reducedMotion} />

      {/* Output: valid block + beam + burst */}
      <ValidBlock reducedMotion={reducedMotion} />
      <OutputBeam reducedMotion={reducedMotion} />
      <OutputBurst reducedMotion={reducedMotion} />
    </>
  )
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-blue-400 border border-blue-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Execution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-indigo-400 border border-indigo-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-violet-400 border border-violet-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Proofs</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
        <span className="text-[10px] text-text-muted tracking-wide">Valid</span>
      </div>
    </div>
  )
}

/* ── Exported Component ── */

export function FullStackLayers3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Three-layer vertical stack showing a transaction flowing through Ethereum's full scaling architecture. A glowing cube enters at the bottom, splits into parallel lanes on the Execution floor, fragments across the Data floor, gets compressed into a proof on the Proofs floor, then emits a VALID block at the top."
      srDescription="A 3D animation showing a transaction flowing through all three Ethereum scaling layers. The glowing blue cube enters at the bottom and rises to the Execution floor (blue), where it splits into 4 parallel lanes representing parallel verification, then merges back. It rises to the Data floor (indigo), where copies fragment outward representing blob data spreading, then consolidate. It rises to the Proofs floor (violet), where it shrinks with a glow representing compression into a proof, emitting green checkmark particles. Finally a green VALID block appears at the top with a beam and burst particles. The cycle repeats every 8 seconds."
      legend={<Legend />}
      fallbackText="Full-stack Ethereum scaling — transaction flows through execution, data, and proof layers"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [5, 5, 5], fov: 36 }}
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
            enableZoom minDistance={3} maxDistance={18}
            enablePan={false}
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.4}
            enableDamping
            dampingFactor={0.05}
            target={[0, 0.7, 0]}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
