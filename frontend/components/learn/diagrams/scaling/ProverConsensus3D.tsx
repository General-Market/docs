'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PROVER_COUNT = 5
const PROVER_ANGLES = [-Math.PI * 0.4, -Math.PI * 0.2, 0, Math.PI * 0.2, Math.PI * 0.4]
const PROVER_RADIUS = 2.5
const BUGGY_PROVER = 3                // Prover D
const CYCLE = 10.0                    // full animation cycle in seconds
const BLOCK_SIZE = 0.35
const PROVER_BOX = [0.45, 0.35, 0.35] as const
const GEAR_SIZE = 0.1

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#ef4444'
const AMBER = '#f59e0b'
const GREY = '#a1a1aa'

const PROVER_LABELS = ['Prover A', 'Prover B', 'Prover C', 'Prover D', 'Prover E']

/* ------------------------------------------------------------------ */
/*  Prover positions (semicircle)                                      */
/* ------------------------------------------------------------------ */

function getProverPosition(index: number): [number, number, number] {
  const angle = PROVER_ANGLES[index]
  const x = Math.sin(angle) * PROVER_RADIUS
  const z = -Math.cos(angle) * PROVER_RADIUS * 0.6
  return [x, 0.08, z]
}

/* ------------------------------------------------------------------ */
/*  Phase helpers                                                      */
/* ------------------------------------------------------------------ */

function getPhase(t: number): number {
  if (t < 2) return 1
  if (t < 5) return 2
  if (t < 7) return 3
  return 4
}

/* ------------------------------------------------------------------ */
/*  Platform base                                                      */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group>
      <RoundedBox args={[9.0, 0.02, 5.0]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[8.6, 0.06, 4.6]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Block cube entering from left                                      */
/* ------------------------------------------------------------------ */

function BlockCube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) {
      ref.current.position.set(-0.5, 0.4, 0.3)
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Phase 1 (0-2s): enter from left, stop at center-left
    const enterProgress = Math.min(1, t / 1.8)
    const eased = enterProgress < 0.5
      ? 2 * enterProgress * enterProgress
      : 1 - Math.pow(-2 * enterProgress + 2, 2) / 2
    const x = -4.5 + eased * 4.0
    ref.current.position.set(x, 0.4, 0.3)

    // Gentle rotation
    ref.current.rotation.y = t * 0.3

    // Fade out at end of cycle
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.opacity = t > 9.5 ? Math.max(0.1, 1 - (t - 9.5) / 0.5) : 1
  })

  return (
    <group>
      <mesh ref={ref} position={[-4.5, 0.4, 0.3]}>
        <boxGeometry args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} transparent />
      </mesh>
      {/* Block label */}
      {!reducedMotion && (
        <Html center position={[-4.2, 1.0, 0.3]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: BLUE }}>
            Block #N
          </p>
        </Html>
      )}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Rays from block to provers (instancedMesh)                         */
/* ------------------------------------------------------------------ */

function BlockRays({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 2.0 : elapsedRef.current % CYCLE

    for (let i = 0; i < PROVER_COUNT; i++) {
      const [px, , pz] = getProverPosition(i)

      // Show rays during phase 1 transition (1.2s-2.0s) then keep them during phase 2
      const showStart = 1.2
      const showEnd = 5.0
      if (t >= showStart && t < showEnd) {
        const fadeIn = Math.min(1, (t - showStart) / 0.4)
        const blockX = -0.5
        const blockZ = 0.3

        // Midpoint
        const mx = (blockX + px) / 2
        const mz = (blockZ + pz) / 2

        // Distance and direction
        const dx = px - blockX
        const dz = pz - blockZ
        const dist = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)

        dummy.position.set(mx, 0.35, mz)
        dummy.scale.set(0.012, 0.012, dist * fadeIn)
        dummy.rotation.set(0, angle, 0)
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
    <instancedMesh ref={ref} args={[undefined, undefined, PROVER_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={BLUE} transparent opacity={0.3} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Single Prover Node                                                 */
/* ------------------------------------------------------------------ */

function ProverNode({
  index,
  reducedMotion,
}: {
  index: number
  reducedMotion: boolean
}) {
  const boxRef = useRef<THREE.Mesh>(null!)
  const gearRef = useRef<THREE.Mesh>(null!)
  const progressRef = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef(0)
  const isBuggy = index === BUGGY_PROVER
  const [px, py, pz] = getProverPosition(index)

  useFrame((_, delta) => {
    if (!boxRef.current || !gearRef.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 8.0 : elapsedRef.current % CYCLE
    const phase = getPhase(t)
    const mat = boxRef.current.material as THREE.MeshStandardMaterial

    // Gear rotation
    if (phase === 2 && !reducedMotion) {
      const speed = isBuggy ? 1.5 : 3.0
      gearRef.current.rotation.z += delta * speed
      gearRef.current.rotation.x += delta * speed * 0.5
    }

    // Progress bar (DOM manipulation via ref)
    if (progressRef.current) {
      if (phase === 2 && !reducedMotion) {
        const computeProgress = Math.min(1, (t - 2) / 3)
        const displayProgress = isBuggy ? computeProgress * 0.7 : computeProgress
        progressRef.current.style.width = `${displayProgress * 100}%`
        progressRef.current.style.backgroundColor = isBuggy ? RED : GREEN
      } else if (phase >= 3 || reducedMotion) {
        progressRef.current.style.width = '100%'
        progressRef.current.style.backgroundColor = isBuggy ? RED : GREEN
      } else {
        progressRef.current.style.width = '0%'
      }
    }

    // Box color changes
    if (phase === 2 && !reducedMotion) {
      // Computing phase: subtle tint
      if (isBuggy) {
        mat.color.set('#fecaca') // light red tinge
        mat.emissiveIntensity = 0.05 + Math.sin(t * 4) * 0.03
        mat.emissive.set(RED)
      } else {
        mat.color.set('#e5e7eb')
        mat.emissiveIntensity = 0.02 + Math.sin(t * 6) * 0.02
        mat.emissive.set(GREEN)
      }
    } else if (phase >= 3 || reducedMotion) {
      if (isBuggy) {
        mat.color.set('#fecaca')
        mat.emissive.set(RED)
        // Amber border pulse in phase 4
        if (phase === 4 || reducedMotion) {
          const pulse = reducedMotion ? 0.15 : Math.sin(t * 3) * 0.1 + 0.1
          mat.emissiveIntensity = pulse
          mat.emissive.set(AMBER)
        } else {
          mat.emissiveIntensity = 0.1
        }
      } else {
        mat.color.set('#dcfce7')
        mat.emissive.set(GREEN)
        mat.emissiveIntensity = 0.05
      }
    } else {
      mat.color.set('#e5e7eb')
      mat.emissiveIntensity = 0
    }
  })

  return (
    <group position={[px, py, pz]}>
      {/* Prover box */}
      <RoundedBox
        ref={boxRef}
        args={[PROVER_BOX[0], PROVER_BOX[1], PROVER_BOX[2]]}
        radius={0.04}
        smoothness={4}
        position={[0, PROVER_BOX[1] / 2, 0]}
      >
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </RoundedBox>

      {/* Gear (spinning box as gear proxy) */}
      <mesh ref={gearRef} position={[0, PROVER_BOX[1] + 0.06, 0]}>
        <boxGeometry args={[GEAR_SIZE, GEAR_SIZE, GEAR_SIZE]} />
        <meshStandardMaterial
          color={isBuggy ? RED : GREY}
          roughness={0.4}
          wireframe
        />
      </mesh>

      {/* Prover label */}
      <Html
        center
        position={[0, -0.12, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <p
            className="text-[9px] font-mono font-bold whitespace-nowrap"
            style={{ color: isBuggy ? RED : '#52525b' }}
          >
            {PROVER_LABELS[index]}
          </p>
          <p className="text-[7px] font-mono whitespace-nowrap" style={{ color: '#a1a1aa' }}>
            GPU cluster
          </p>
        </div>
      </Html>

      {/* Progress bar */}
      <Html
        center
        position={[0, PROVER_BOX[1] + 0.18, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className="rounded-full overflow-hidden"
          style={{
            width: 36,
            height: 4,
            backgroundColor: '#e5e7eb',
          }}
        >
          <div
            ref={progressRef}
            className="h-full rounded-full transition-none"
            style={{
              width: '0%',
              backgroundColor: isBuggy ? RED : GREEN,
            }}
          />
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Vote result display (checkmarks / X)                               */
/* ------------------------------------------------------------------ */

function VoteResult({ index, reducedMotion }: { index: number; reducedMotion: boolean }) {
  const labelRef = useRef<HTMLDivElement>(null)
  const elapsedRef = useRef(0)
  const isBuggy = index === BUGGY_PROVER

  // Position results to the right of provers, stacked vertically
  const [px, , pz] = getProverPosition(index)
  const resultX = px + (px > 0 ? 0.6 : 0.5)
  const resultZ = pz

  useFrame((_, delta) => {
    if (!labelRef.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 8.0 : elapsedRef.current % CYCLE
    const phase = getPhase(t)

    if (phase >= 3 || reducedMotion) {
      // Stagger arrival: each result arrives slightly after the previous
      const arrivalDelay = index * 0.3
      const arrivalT = t - 5.0 - arrivalDelay
      const visible = reducedMotion || arrivalT > 0

      if (visible) {
        labelRef.current.style.opacity = '1'
        labelRef.current.style.transform = 'scale(1)'
      } else {
        labelRef.current.style.opacity = '0'
        labelRef.current.style.transform = 'scale(0.3)'
      }
    } else {
      labelRef.current.style.opacity = '0'
      labelRef.current.style.transform = 'scale(0.3)'
    }
  })

  return (
    <Html
      center
      position={[resultX, 0.45, resultZ]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div
        ref={labelRef}
        className="transition-none"
        style={{
          opacity: 0,
          transform: 'scale(0.3)',
        }}
      >
        <span
          className="text-[14px] font-bold"
          style={{ color: isBuggy ? RED : GREEN }}
        >
          {isBuggy ? '\u2717' : '\u2713'}
        </span>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Vote tally and result label                                        */
/* ------------------------------------------------------------------ */

function VoteTally({ reducedMotion }: { reducedMotion: boolean }) {
  const tallyRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const costRef = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!tallyRef.current || !resultRef.current || !costRef.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 8.0 : elapsedRef.current % CYCLE
    const phase = getPhase(t)

    // Tally appears at phase 3 (5-7s)
    if (phase >= 3 || reducedMotion) {
      const tallyDelay = 6.5
      const tallyVisible = reducedMotion || t > tallyDelay
      tallyRef.current.style.opacity = tallyVisible ? '1' : '0'
    } else {
      tallyRef.current.style.opacity = '0'
    }

    // Result appears at phase 4 (7-10s)
    if (phase === 4 || reducedMotion) {
      resultRef.current.style.opacity = '1'

      // Cost label animation
      if (reducedMotion) {
        costRef.current.textContent = '$0.01/proof (2029)'
      } else {
        const costPhase = (t - 7) / 3 // 0 to 1 over phase 4
        if (costPhase < 0.5) {
          costRef.current.textContent = '$10/proof (2026)'
        } else {
          costRef.current.textContent = '$0.01/proof (2029)'
        }
      }
    } else {
      resultRef.current.style.opacity = '0'
    }
  })

  return (
    <group position={[3.5, 0, 0.3]}>
      {/* Vote tally */}
      <Html center position={[0, 0.9, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          ref={tallyRef}
          className="flex flex-col items-center gap-1"
          style={{ opacity: 0 }}
        >
          <p className="text-[11px] font-mono font-bold whitespace-nowrap" style={{ color: '#52525b' }}>
            <span style={{ color: GREEN }}>4 {'\u2713'}</span>
            {'  '}
            <span style={{ color: RED }}>1 {'\u2717'}</span>
          </p>
        </div>
      </Html>

      {/* Result */}
      <Html center position={[0, 0.55, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          ref={resultRef}
          className="flex flex-col items-center gap-1"
          style={{ opacity: 0 }}
        >
          <p className="text-[13px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            4-of-5 VALID
          </p>
          <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: GREEN }}>
            Block accepted
          </p>
        </div>
      </Html>

      {/* Validator verification label */}
      <Html center position={[0, 0.15, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: '#a1a1aa' }}>
            Raspberry Pi -- verify only
          </p>
        </div>
      </Html>

      {/* Cost label */}
      <Html center position={[0, -0.05, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p
          ref={costRef}
          className="text-[9px] font-mono font-bold whitespace-nowrap"
          style={{ color: '#71717a' }}
        >
          $10/proof (2026)
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Proof-ray particles (travel from provers to vote area)             */
/* ------------------------------------------------------------------ */

function ProofRays({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const count = PROVER_COUNT * 3 // 3 particles per ray

  const colorArray = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const greenC = new THREE.Color(GREEN)
    const redC = new THREE.Color(RED)
    for (let i = 0; i < count; i++) {
      const proverIdx = Math.floor(i / 3)
      const c = proverIdx === BUGGY_PROVER ? redC : greenC
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [count])

  const colorsSet = useRef(false)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 8.0 : elapsedRef.current % CYCLE

    if (!colorsSet.current) {
      ref.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSet.current = true
    }

    const phase = getPhase(t)
    const targetX = 3.5
    const targetZ = 0.3

    for (let i = 0; i < count; i++) {
      const proverIdx = Math.floor(i / 3)
      const particleIdx = i % 3

      if (phase === 3 && !reducedMotion) {
        const [px, , pz] = getProverPosition(proverIdx)
        const arrivalDelay = proverIdx * 0.3
        const rayT = (t - 5.0 - arrivalDelay) / 1.5

        if (rayT > 0 && rayT < 1) {
          const p = rayT + particleIdx * 0.1
          const clampedP = Math.min(1, Math.max(0, p))
          const x = px + (targetX - px) * clampedP
          const z = pz + (targetZ - pz) * clampedP
          const y = 0.35 + Math.sin(clampedP * Math.PI) * 0.15
          dummy.position.set(x, y, z)
          dummy.scale.setScalar(0.025)
        } else {
          dummy.position.set(0, -10, 0)
          dummy.scale.setScalar(0.001)
        }
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
      <meshBasicMaterial vertexColors transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Computing sparks (particles around provers during phase 2)         */
/* ------------------------------------------------------------------ */

function ComputingSparks({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const sparksPerProver = 4
  const count = PROVER_COUNT * sparksPerProver

  useFrame((_, delta) => {
    if (!ref.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = getPhase(t)

    for (let i = 0; i < count; i++) {
      const proverIdx = Math.floor(i / sparksPerProver)
      const sparkIdx = i % sparksPerProver

      if (phase === 2) {
        const [px, , pz] = getProverPosition(proverIdx)
        const sparkPhase = (sparkIdx / sparksPerProver) * Math.PI * 2
        const localT = t - 2.0
        const angle = localT * 4 + sparkPhase
        const r = 0.25 + Math.sin(localT * 3 + sparkPhase) * 0.08
        const x = px + Math.cos(angle) * r
        const y = 0.3 + Math.sin(angle * 0.7) * 0.12
        const z = pz + Math.sin(angle) * r

        dummy.position.set(x, y, z)
        dummy.scale.setScalar(0.012)
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
      <meshBasicMaterial color={AMBER} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Title label above the scene                                        */
/* ------------------------------------------------------------------ */

function TitleLabel() {
  return (
    <Html center position={[0, 1.6, -1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#52525b' }}>
        Multi-Prover Consensus
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Safety annotation                                                  */
/* ------------------------------------------------------------------ */

function SafetyLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 8.0 : elapsedRef.current % CYCLE
    const phase = getPhase(t)

    if (phase === 4 || reducedMotion) {
      ref.current.style.opacity = '1'
    } else {
      ref.current.style.opacity = '0'
    }
  })

  return (
    <Html center position={[0, -0.1, 2.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <p
        ref={ref}
        className="text-[9px] font-mono text-center whitespace-nowrap"
        style={{ color: '#71717a', opacity: 0 }}
      >
        Safe if 3-of-5 honest -- single bug cannot compromise network
      </p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Broadcast ring (vote area pulse)                                   */
/* ------------------------------------------------------------------ */

function ResultRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE

    // Pulse when result appears (phase 4)
    if (t >= 7.0 && t < 8.0) {
      const p = (t - 7.0) / 1.0
      const scale = 0.1 + p * 2.0
      ref.current.scale.set(scale, scale, 1)
      matRef.current.opacity = 0.3 * (1 - p)
      ref.current.visible = true
    } else {
      ref.current.visible = false
    }
  })

  return (
    <mesh ref={ref} position={[3.5, 0.15, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.6, 0.8, 32]} />
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0} depthWrite={false} />
    </mesh>
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

      <Platform />
      <TitleLabel />

      {/* Block entering from left */}
      <BlockCube reducedMotion={reducedMotion} />

      {/* Rays from block to provers */}
      <BlockRays reducedMotion={reducedMotion} />

      {/* 5 Prover nodes in semicircle */}
      {PROVER_ANGLES.map((_, i) => (
        <ProverNode key={i} index={i} reducedMotion={reducedMotion} />
      ))}

      {/* Vote results (checkmarks / X) */}
      {PROVER_ANGLES.map((_, i) => (
        <VoteResult key={`vote-${i}`} index={i} reducedMotion={reducedMotion} />
      ))}

      {/* Proof ray particles */}
      <ProofRays reducedMotion={reducedMotion} />

      {/* Computing sparks */}
      <ComputingSparks reducedMotion={reducedMotion} />

      {/* Vote tally and result */}
      <VoteTally reducedMotion={reducedMotion} />

      {/* Result ring pulse */}
      <ResultRing reducedMotion={reducedMotion} />

      {/* Safety annotation */}
      <SafetyLabel reducedMotion={reducedMotion} />
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
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Block</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Valid proof</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Buggy proof</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Flagged</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function ProverConsensus3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="3-of-5 independent prover consensus: four provers agree, one buggy prover is outvoted"
      srDescription="Five prover nodes in a semicircle receive a block. Four produce matching proofs (green checks). One buggy prover produces a different result (red X). The 4-of-5 consensus accepts the block and flags the buggy prover."
      legend={<Legend />}
      fallbackText="Prover consensus -- 5 independent teams, 3-of-5 must agree, single bug cannot compromise network"
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

          <Scene reducedMotion={reducedMotion} />

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
