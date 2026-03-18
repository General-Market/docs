'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const LEFT_X = -3.2           // center of re-execution side
const RIGHT_X = 3.2           // center of proof verification side
const VALIDATOR_COUNT = 8
const CYCLE = 6.0             // full animation cycle in seconds
const BLOCK_SIZE = 0.4
const VALIDATOR_SIZE = 0.22
const PROVER_SIZE = [0.5, 0.4, 0.4] as const
const PROOF_SIZE = 0.15

const RED = '#ef4444'
const GREEN = '#22c55e'
const GREY = '#a1a1aa'
const VIOLET = '#8b5cf6'
const LIGHT_RED = '#fef2f2'
const LIGHT_GREEN = '#f0fdf4'

/* ------------------------------------------------------------------ */
/*  Validator cube geometry (merged box + small antenna)               */
/* ------------------------------------------------------------------ */

function createValidatorGeo(): THREE.BufferGeometry {
  const body = new THREE.BoxGeometry(1, 1, 1)
  const antenna = new THREE.CylinderGeometry(0.06, 0.06, 0.35, 6)
  antenna.translate(0, 0.65, 0)
  const tip = new THREE.SphereGeometry(0.09, 8, 8)
  tip.translate(0, 0.85, 0)
  const merged = mergeGeometries([body, antenna, tip], false)
  body.dispose()
  antenna.dispose()
  tip.dispose()
  return merged || new THREE.BoxGeometry(1, 1, 1)
}

/* ------------------------------------------------------------------ */
/*  Grid positions for 8 validators (2 rows x 4 cols)                  */
/* ------------------------------------------------------------------ */

function getValidatorPositions(): [number, number][] {
  const positions: [number, number][] = []
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const x = (col - 1.5) * 0.5
      const z = (row - 0.5) * 0.55
      positions.push([x, z])
    }
  }
  return positions
}

/* ------------------------------------------------------------------ */
/*  Left Platform: "Re-execution" (Today)                              */
/* ------------------------------------------------------------------ */

function ReExecutionPlatform() {
  return (
    <group position={[LEFT_X, 0, 0]}>
      <RoundedBox args={[5.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={LIGHT_RED} roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 1.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>Re-execution</p>
      </Html>
      <Html center position={[0, 1.22, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] tracking-wide whitespace-nowrap" style={{ color: '#71717a' }}>Today</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Platform: "Proof Verification" (ZK-EVM)                      */
/* ------------------------------------------------------------------ */

function ProofVerificationPlatform() {
  return (
    <group position={[RIGHT_X, 0, 0]}>
      <RoundedBox args={[5.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={LIGHT_GREEN} roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 1.5, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>Proof Verification</p>
      </Html>
      <Html center position={[0, 1.22, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] tracking-wide whitespace-nowrap" style={{ color: '#71717a' }}>ZK-EVM</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[0.01, 0.3, 3.4]} radius={0.004} smoothness={4} position={[0, 0.15, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: Block cube that enters from the left                         */
/* ------------------------------------------------------------------ */

function LeftBlock({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) {
      ref.current.position.set(LEFT_X - 1.2, 0.35, -0.9)
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const enterPhase = Math.min(1, t / 0.8) // enter in 0.8s
    const x = LEFT_X - 2.8 + enterPhase * 1.6
    ref.current.position.set(x, 0.35, -0.9)
    // Fade out after cycle
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = t > 5.5 ? Math.max(0.2, 1 - (t - 5.5) / 0.5) : 1
  })

  return (
    <mesh ref={ref} position={[LEFT_X - 2.8, 0.35, -0.9]}>
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.4} transparent />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: 8 Validator cubes processing sequentially                    */
/* ------------------------------------------------------------------ */

function LeftValidators({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const elapsedRef = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => createValidatorGeo(), [])
  const positions = useMemo(() => getValidatorPositions(), [])

  const colorArray = useMemo(() => {
    const arr = new Float32Array(VALIDATOR_COUNT * 3)
    const c = new THREE.Color(GREY)
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  const colorsSet = useRef(false)

  useFrame((_, delta) => {
    if (!meshRef.current) return

    if (!colorsSet.current) {
      meshRef.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSet.current = true
    }

    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current % CYCLE

    // Sequential processing: each validator gets ~0.5s window
    // Block enters in 0.8s, processing starts at 1.0s, each takes 0.55s
    const processStart = 1.0
    const perValidator = 0.55
    const activeIdx = Math.floor((t - processStart) / perValidator)

    const greyC = new THREE.Color(GREY)
    const redC = new THREE.Color(RED)
    const greenC = new THREE.Color('#4ade80')

    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const [px, pz] = positions[i]
      dummy.position.set(LEFT_X + px, 0.08 + VALIDATOR_SIZE / 2, pz)
      dummy.scale.setScalar(VALIDATOR_SIZE)

      // Bounce when active
      let bounce = 0
      if (!reducedMotion && i === activeIdx && t >= processStart) {
        const localT = (t - processStart - i * perValidator) / perValidator
        bounce = Math.sin(localT * Math.PI) * 0.08
      }
      dummy.position.y += bounce

      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      // Color: grey by default, red when active, muted green when done
      let color: THREE.Color
      if (reducedMotion) {
        color = greyC
      } else if (t < processStart) {
        color = greyC
      } else if (i < activeIdx) {
        color = greenC // processed
      } else if (i === activeIdx) {
        color = redC // active
      } else {
        color = greyC // waiting
      }

      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    const attr = meshRef.current.geometry.getAttribute('color')
    if (attr) (attr as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geo, undefined, VALIDATOR_COUNT]}>
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: Timer label (Html ref + useFrame DOM manipulation)            */
/* ------------------------------------------------------------------ */

function LeftTimer({ reducedMotion }: { reducedMotion: boolean }) {
  const labelRef = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!labelRef.current) return
    if (reducedMotion) {
      labelRef.current.textContent = '12.0s'
      labelRef.current.style.color = RED
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Timer ramps from 0 to 12 over the processing window (1.0s to 5.4s)
    const processStart = 1.0
    const processEnd = 5.4
    const progress = Math.max(0, Math.min(1, (t - processStart) / (processEnd - processStart)))
    const displayTime = (progress * 12).toFixed(1)
    const text = `${displayTime}s`
    const isFinished = progress >= 1

    if (labelRef.current.textContent !== text) {
      labelRef.current.textContent = text
      labelRef.current.style.color = isFinished ? RED : '#71717a'
    }
  })

  return (
    <Html
      center
      position={[LEFT_X, 0.08, 1.4]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p
        ref={labelRef}
        className="text-[16px] font-bold font-mono tracking-tight whitespace-nowrap"
        style={{ color: '#71717a' }}
      >
        0.0s
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: Hardware label                                               */
/* ------------------------------------------------------------------ */

function LeftHardwareLabel() {
  return (
    <Html
      center
      position={[LEFT_X, 0.08, 1.8]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: '#71717a' }}>
        32-core server
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: Slow label (red bar)                                         */
/* ------------------------------------------------------------------ */

function LeftSlowLabel() {
  return (
    <group position={[LEFT_X, 0, 1.1]}>
      <RoundedBox args={[4.0, 0.01, 0.06]} radius={0.004} smoothness={4} position={[0, 0.01, 0]}>
        <meshStandardMaterial color={RED} roughness={0.4} />
      </RoundedBox>
      <Html center position={[2.3, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: RED }}>Slow</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Block cube that enters, then shrinks into prover            */
/* ------------------------------------------------------------------ */

function RightBlock({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) {
      ref.current.position.set(RIGHT_X - 0.6, 0.35, -0.9)
      ref.current.scale.setScalar(1)
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Enter from left: 0 to 0.8s
    const enterPhase = Math.min(1, t / 0.8)
    const x = RIGHT_X - 2.8 + enterPhase * 1.6
    // Shrink into prover: 1.0s to 2.0s
    const shrinkStart = 1.0
    const shrinkEnd = 2.0
    let scale = 1
    if (t > shrinkStart) {
      const shrinkProgress = Math.min(1, (t - shrinkStart) / (shrinkEnd - shrinkStart))
      scale = 1 - shrinkProgress * 0.85
      // Move toward prover
      const moveToProver = shrinkProgress * 0.8
      ref.current.position.set(x + moveToProver, 0.35, -0.9 + shrinkProgress * 0.5)
    } else {
      ref.current.position.set(x, 0.35, -0.9)
    }

    ref.current.scale.setScalar(scale)

    // Hide after shrink
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = t > shrinkEnd ? 0 : 1
  })

  return (
    <mesh ref={ref} position={[RIGHT_X - 2.8, 0.35, -0.9]}>
      <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.4} transparent />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Prover box (large violet)                                   */
/* ------------------------------------------------------------------ */

function ProverBox({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Pulse when processing (1.0s to 2.5s)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    if (t >= 1.0 && t <= 2.5) {
      const pulse = Math.sin((t - 1.0) * Math.PI * 4) * 0.15
      mat.emissiveIntensity = 0.3 + pulse
      ref.current.scale.set(
        1 + Math.sin((t - 1.0) * Math.PI * 2) * 0.04,
        1 + Math.sin((t - 1.0) * Math.PI * 2) * 0.04,
        1 + Math.sin((t - 1.0) * Math.PI * 2) * 0.04,
      )
    } else {
      mat.emissiveIntensity = 0.1
      ref.current.scale.set(1, 1, 1)
    }
  })

  return (
    <group position={[RIGHT_X - 0.4, 0.3, -0.4]}>
      <mesh ref={ref}>
        <boxGeometry args={[PROVER_SIZE[0], PROVER_SIZE[1], PROVER_SIZE[2]]} />
        <meshStandardMaterial color={VIOLET} roughness={0.4} emissive={VIOLET} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[0, -0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: VIOLET }}>PROVER</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Proof token (small green cube emitted from prover)          */
/* ------------------------------------------------------------------ */

function ProofToken({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    const mat = ref.current.material as THREE.MeshStandardMaterial

    if (reducedMotion) {
      ref.current.position.set(RIGHT_X + 0.4, 0.3, 0)
      ref.current.scale.setScalar(1)
      mat.opacity = 1
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Proof appears at 2.5s, moves to center of validators by 3.2s
    const emitStart = 2.3
    const emitEnd = 3.2
    const broadcastStart = 3.2
    const broadcastEnd = 3.5

    if (t < emitStart) {
      mat.opacity = 0
      ref.current.scale.setScalar(0.01)
    } else if (t < emitEnd) {
      const p = (t - emitStart) / (emitEnd - emitStart)
      const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
      mat.opacity = eased
      ref.current.scale.setScalar(0.3 + eased * 0.7)
      // Move from prover toward validators
      const startX = RIGHT_X - 0.4
      const endX = RIGHT_X + 0.5
      ref.current.position.set(
        startX + eased * (endX - startX),
        0.3,
        -0.4 + eased * 0.4,
      )
    } else if (t < broadcastEnd) {
      mat.opacity = 1
      ref.current.scale.setScalar(1)
      ref.current.position.set(RIGHT_X + 0.5, 0.3, 0)
      // Pulse during broadcast
      const pulse = Math.sin((t - broadcastStart) * Math.PI * 6) * 0.15
      ref.current.scale.setScalar(1 + pulse)
    } else if (t < 5.5) {
      mat.opacity = 1
      ref.current.scale.setScalar(1)
      ref.current.position.set(RIGHT_X + 0.5, 0.3, 0)
    } else {
      // Fade
      mat.opacity = Math.max(0, 1 - (t - 5.5) / 0.5)
    }
  })

  return (
    <mesh ref={ref}>
      <boxGeometry args={[PROOF_SIZE, PROOF_SIZE, PROOF_SIZE]} />
      <meshStandardMaterial
        color={GREEN}
        roughness={0.3}
        emissive={GREEN}
        emissiveIntensity={0.4}
        transparent
        opacity={0}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: 8 Validator cubes (all flash green at once on verify)       */
/* ------------------------------------------------------------------ */

function RightValidators({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const elapsedRef = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const geo = useMemo(() => createValidatorGeo(), [])
  const positions = useMemo(() => getValidatorPositions(), [])

  const colorArray = useMemo(() => {
    const arr = new Float32Array(VALIDATOR_COUNT * 3)
    const c = new THREE.Color(GREY)
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  const colorsSet = useRef(false)

  useFrame((_, delta) => {
    if (!meshRef.current) return

    if (!colorsSet.current) {
      meshRef.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSet.current = true
    }

    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current % CYCLE

    // All validators verify simultaneously at 3.2s
    const verifyTime = 3.2
    const allVerified = t >= verifyTime && t < 5.8

    const greyC = new THREE.Color(GREY)
    const greenC = new THREE.Color(GREEN)

    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const [px, pz] = positions[i]
      const baseX = RIGHT_X + 0.5 + px
      dummy.position.set(baseX, 0.08 + VALIDATOR_SIZE / 2, pz)
      dummy.scale.setScalar(VALIDATOR_SIZE)

      // All bounce together when verifying
      let bounce = 0
      if (!reducedMotion && allVerified && t < verifyTime + 0.5) {
        const localT = (t - verifyTime) / 0.5
        bounce = Math.sin(localT * Math.PI) * 0.1
      }
      dummy.position.y += bounce

      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      const color = (reducedMotion || !allVerified) ? greyC : greenC
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    const attr = meshRef.current.geometry.getAttribute('color')
    if (attr) (attr as THREE.BufferAttribute).needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[geo, undefined, VALIDATOR_COUNT]}>
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Timer label                                                 */
/* ------------------------------------------------------------------ */

function RightTimer({ reducedMotion }: { reducedMotion: boolean }) {
  const labelRef = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!labelRef.current) return
    if (reducedMotion) {
      labelRef.current.textContent = '0.5s'
      labelRef.current.style.color = GREEN
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Timer: prover works 1.0-2.5s = proof generation
    // Verification instant at 3.2s
    // Show total from block entry to verification done
    const timerStart = 0.8  // block has arrived
    const timerEnd = 3.5    // all verified
    const progress = Math.max(0, Math.min(1, (t - timerStart) / (timerEnd - timerStart)))
    const displayTime = (progress * 0.5).toFixed(1)
    const text = `${displayTime}s`
    const isFinished = progress >= 1

    if (labelRef.current.textContent !== text) {
      labelRef.current.textContent = text
      labelRef.current.style.color = isFinished ? GREEN : '#71717a'
    }
  })

  return (
    <Html
      center
      position={[RIGHT_X + 0.5, 0.08, 1.4]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p
        ref={labelRef}
        className="text-[16px] font-bold font-mono tracking-tight whitespace-nowrap"
        style={{ color: '#71717a' }}
      >
        0.0s
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Hardware label                                              */
/* ------------------------------------------------------------------ */

function RightHardwareLabel() {
  return (
    <Html
      center
      position={[RIGHT_X + 0.5, 0.08, 1.8]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: GREEN }}>
        Raspberry Pi
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Fast label (green bar)                                      */
/* ------------------------------------------------------------------ */

function RightFastLabel() {
  return (
    <group position={[RIGHT_X + 0.5, 0, 1.1]}>
      <RoundedBox args={[1.2, 0.01, 0.06]} radius={0.004} smoothness={4} position={[0, 0.01, 0]}>
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </RoundedBox>
      <Html center position={[0.9, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GREEN }}>Fast</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right: Broadcast ring pulse from proof to validators               */
/* ------------------------------------------------------------------ */

function BroadcastRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    const broadcastStart = 3.2
    const broadcastDuration = 0.8
    if (t >= broadcastStart && t < broadcastStart + broadcastDuration) {
      const p = (t - broadcastStart) / broadcastDuration
      const scale = 0.1 + p * 1.8
      ref.current.scale.set(scale, scale, 1)
      matRef.current.opacity = 0.4 * (1 - p)
      ref.current.visible = true
    } else {
      ref.current.visible = false
    }
  })

  return (
    <mesh ref={ref} position={[RIGHT_X + 0.5, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Left: Processing beam (connects block to active validator)         */
/* ------------------------------------------------------------------ */

function ProcessingBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const positions = useMemo(() => getValidatorPositions(), [])
  const count = 8

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    const processStart = 1.0
    const perValidator = 0.55
    const activeIdx = Math.floor((t - processStart) / perValidator)

    for (let i = 0; i < count; i++) {
      if (i === 0 && t >= processStart && activeIdx >= 0 && activeIdx < VALIDATOR_COUNT) {
        const [vx, vz] = positions[activeIdx]
        const bx = LEFT_X - 1.2
        const bz = -0.9
        const tx = LEFT_X + vx
        const tz = vz
        // Position beam between block and active validator
        dummy.position.set((bx + tx) / 2, 0.35, (bz + tz) / 2)
        const dist = Math.sqrt((tx - bx) ** 2 + (tz - bz) ** 2)
        dummy.scale.set(dist, 0.015, 0.015)
        dummy.lookAt(tx, 0.35, tz)
        dummy.updateMatrix()
        ref.current.setMatrixAt(i, dummy.matrix)
      } else {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0.001)
        dummy.updateMatrix()
        ref.current.setMatrixAt(i, dummy.matrix)
      }
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={RED} transparent opacity={0.25} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Prover spark particles                                             */
/* ------------------------------------------------------------------ */

function ProverSparks({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const count = 12

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    for (let i = 0; i < count; i++) {
      if (t >= 1.0 && t <= 2.5) {
        const phase = (i / count) * Math.PI * 2
        const localT = t - 1.0
        const angle = localT * 3 + phase
        const r = 0.35 + Math.sin(localT * 4 + phase) * 0.1
        const x = RIGHT_X - 0.4 + Math.cos(angle) * r
        const y = 0.3 + Math.sin(angle * 0.7) * 0.15
        const z = -0.4 + Math.sin(angle) * r
        dummy.position.set(x, y, z)
        dummy.scale.setScalar(0.015)
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
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={VIOLET} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Scene                                                         */
/* ------------------------------------------------------------------ */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* White floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* Platforms and divider */}
      <ReExecutionPlatform />
      <ProofVerificationPlatform />
      <Divider />

      {/* Left side: Re-execution */}
      <LeftBlock reducedMotion={reducedMotion} />
      <LeftValidators reducedMotion={reducedMotion} />
      <ProcessingBeam reducedMotion={reducedMotion} />
      <LeftTimer reducedMotion={reducedMotion} />
      <LeftHardwareLabel />
      <LeftSlowLabel />

      {/* Right side: Proof verification */}
      <RightBlock reducedMotion={reducedMotion} />
      <ProverBox reducedMotion={reducedMotion} />
      <ProofToken reducedMotion={reducedMotion} />
      <RightValidators reducedMotion={reducedMotion} />
      <BroadcastRing reducedMotion={reducedMotion} />
      <ProverSparks reducedMotion={reducedMotion} />
      <RightTimer reducedMotion={reducedMotion} />
      <RightHardwareLabel />
      <RightFastLabel />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Block</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Re-execute</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: VIOLET }} />
        <span className="text-[10px] text-text-muted tracking-wide">Prover</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Verified</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function ZKEVMPopulation3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Side-by-side comparison: re-execution verification where 8 validators process a block one at a time (12 seconds) versus ZK proof verification where a prover compresses the block into a proof that all 8 validators verify instantly (0.5 seconds)"
      srDescription="A 3D scene split in two. Left side shows a block entering and 8 grey validator cubes lighting up red one at a time sequentially, with a timer counting to 12 seconds. Right side shows the same block entering a violet prover box that compresses it into a small green proof token, which then broadcasts to all 8 validators simultaneously turning them green, with a timer reaching only 0.5 seconds."
      legend={<Legend />}
      fallbackText="ZK-EVM verification -- proof verification (0.5s) vs re-execution (12s)"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 5, 7], fov: 36 }}
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
