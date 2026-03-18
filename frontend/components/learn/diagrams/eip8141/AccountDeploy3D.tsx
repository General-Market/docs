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

const INDIGO = '#6366f1'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const PURPLE = '#8b5cf6'
const BLUE = '#3b82f6'

const FACTORY_POS: [number, number, number] = [-4.5, 0.5, 0]
const PLOT_POS: [number, number, number] = [-1, 0.5, 0]
const USDC_POS: [number, number, number] = [3.5, 0.5, 0]

/* ------------------------------------------------------------------ */
/*  Utility: smooth ease in-out                                        */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[11.4, 0.02, 4.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[11, 0.04, 4]} radius={0.02} smoothness={4} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Factory Node (indigo hexagonal prism)                              */
/* ------------------------------------------------------------------ */

function FactoryNode({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    ref.current.position.y = FACTORY_POS[1] + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group>
      <mesh ref={ref} position={FACTORY_POS} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.8, 6]} />
        <meshStandardMaterial color={INDIGO} roughness={0.4} emissive={INDIGO} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[FACTORY_POS[0], 1.15, FACTORY_POS[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: INDIGO }}>Factory</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty Plot (dashed wireframe box)                                  */
/* ------------------------------------------------------------------ */

function EmptyPlot({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible 0-0.4 (0-4s), then fades as wallet builds
    const visible = cycleT < 0.35
    matRef.current.opacity = visible ? 0.4 + Math.sin(elapsedRef.current * 3) * 0.1 : 0
  })

  return (
    <mesh position={PLOT_POS}>
      <boxGeometry args={[1.5, 1, 1.5]} />
      <meshBasicMaterial ref={matRef} color="#d4d4d8" wireframe transparent opacity={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Address Beacon (pulsing amber pad at plot)                         */
/* ------------------------------------------------------------------ */

function AddressBeacon({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const pulse = cycleT < 0.15 ? 1.0 + Math.sin(elapsedRef.current * 6) * 0.2 : 1.0
    ref.current.scale.set(pulse, 1, pulse)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = cycleT < 0.15 ? 0.3 + Math.sin(elapsedRef.current * 6) * 0.2 : 0.1
  })

  return (
    <mesh ref={ref} position={[PLOT_POS[0], 0.08, PLOT_POS[2]]}>
      <boxGeometry args={[0.3, 0.08, 0.3]} />
      <meshStandardMaterial color={AMBER} roughness={0.3} emissive={AMBER} emissiveIntensity={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Pre-funded Coins (6 stacked amber discs)                           */
/* ------------------------------------------------------------------ */

function PreFundedCoins({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Coins visible 0-0.35 (while plot is empty), then absorbed into wallet
    if (cycleT < 0.25) {
      groupRef.current.visible = true
      groupRef.current.scale.setScalar(1)
    } else if (cycleT < 0.4) {
      groupRef.current.visible = true
      const t = clamp01((cycleT - 0.25) / 0.15)
      groupRef.current.scale.setScalar(1 - easeInOut(t))
    } else {
      groupRef.current.visible = false
    }
  })

  const coins = useMemo(() => {
    const items: [number, number, number][] = []
    for (let i = 0; i < 6; i++) {
      items.push([PLOT_POS[0], 0.15 + i * 0.055, PLOT_POS[2]])
    }
    return items
  }, [])

  return (
    <group ref={groupRef}>
      {coins.map((pos, i) => (
        <mesh key={i} position={pos}>
          <cylinderGeometry args={[0.15, 0.15, 0.05, 16]} />
          <meshStandardMaterial color={AMBER} roughness={0.3} emissive={AMBER} emissiveIntensity={0.15} />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Built Wallet (green RoundedBox, materializes scale 0->1)           */
/* ------------------------------------------------------------------ */

function BuiltWallet({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Scale in 0.15-0.4 (1.5-4s), hold, then scale back on reset
    let scale: number
    let emissive = 0.08

    if (cycleT < 0.15) {
      scale = 0
    } else if (cycleT < 0.4) {
      // Build animation
      scale = easeInOut(clamp01((cycleT - 0.15) / 0.25))
    } else if (cycleT < 0.6) {
      scale = 1
      // Purple glow during validate phase (0.4-0.6)
      const validateT = (cycleT - 0.4) / 0.2
      if (validateT < 0.5) {
        const purpleColor = new THREE.Color(PURPLE)
        matRef.current.emissive.copy(purpleColor)
        emissive = 0.2 + Math.sin(validateT * Math.PI * 4) * 0.1
      } else {
        matRef.current.emissive.set(GREEN)
        emissive = 0.15
      }
    } else if (cycleT < 0.8) {
      scale = 1
      matRef.current.emissive.set(GREEN)
      emissive = 0.08
    } else if (cycleT < 0.95) {
      scale = 1
    } else {
      // Reset
      scale = 1 - easeInOut((cycleT - 0.95) / 0.05)
    }

    ref.current.scale.setScalar(Math.max(scale, 0.001))
    ref.current.visible = scale > 0.001
    matRef.current.emissiveIntensity = emissive
  })

  return (
    <group ref={ref} position={PLOT_POS}>
      <RoundedBox args={[1.5, 1, 1.5]} radius={0.08} smoothness={4}>
        <meshStandardMaterial ref={matRef} color={GREEN} roughness={0.5} emissive={GREEN} emissiveIntensity={0.08} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Deploy Beam (animated tube from factory to plot)                   */
/* ------------------------------------------------------------------ */

function DeployBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(FACTORY_POS[0] + 0.6, FACTORY_POS[1], FACTORY_POS[2]),
      new THREE.Vector3(PLOT_POS[0] - 0.8, PLOT_POS[1], PLOT_POS[2]),
    )
    return new THREE.TubeGeometry(curve, 16, 0.02, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible during 0.15-0.4 (1.5-4s) -- Frame 0 Deploy
    const visible = cycleT >= 0.15 && cycleT < 0.4
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.15) / 0.25)
      matRef.current.opacity = 0.5 + Math.sin(progress * Math.PI) * 0.4
    }
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshBasicMaterial ref={matRef} color={INDIGO} transparent opacity={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Construction Particles (24 instancedMesh spheres spiraling up)     */
/* ------------------------------------------------------------------ */

function ConstructionParticles({ count = 24, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.5,
        radius: 0.4 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
      })),
    [count],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Active during 0.15-0.4 (1.5-4s)
    const active = cycleT >= 0.15 && cycleT < 0.4
    const buildProgress = active ? clamp01((cycleT - 0.15) / 0.25) : 0

    for (let i = 0; i < count; i++) {
      const o = offsets[i]
      if (active) {
        const t = elapsedRef.current * o.speed + o.phase
        const spiralY = buildProgress * 1.2 * ((i % 6) / 6) + Math.sin(t * 2) * 0.05
        const r = o.radius * (1 - buildProgress * 0.5)
        dummy.position.set(
          PLOT_POS[0] + Math.cos(t + o.angle) * r,
          0.1 + spiralY,
          PLOT_POS[2] + Math.sin(t + o.angle) * r,
        )
        const s = 0.025 * (1 - buildProgress * 0.5) * (Math.sin(t * 3) * 0.3 + 0.7)
        dummy.scale.setScalar(s)
      } else {
        dummy.position.set(0, -10, 0) // hide offscreen
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
      <meshBasicMaterial color={INDIGO} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Validate Beam (purple arc into wallet)                             */
/* ------------------------------------------------------------------ */

function ValidateBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(PLOT_POS[0], 2.0, PLOT_POS[2] - 1.2),
      new THREE.Vector3(PLOT_POS[0], 1.8, PLOT_POS[2]),
      new THREE.Vector3(PLOT_POS[0], 1.0, PLOT_POS[2]),
    )
    return new THREE.TubeGeometry(curve, 24, 0.015, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible during 0.4-0.6 (4-6s) -- Frame 1 Validate
    const visible = cycleT >= 0.4 && cycleT < 0.6
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.4) / 0.2)
      matRef.current.opacity = 0.4 + Math.sin(progress * Math.PI) * 0.5
      matRef.current.emissiveIntensity = 0.2 + Math.sin(progress * Math.PI * 3) * 0.15
    }
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial ref={matRef} color={PURPLE} roughness={0.3} emissive={PURPLE} emissiveIntensity={0.2} transparent opacity={0.6} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Ring (green torus expanding)                                */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Appears at 0.5-0.6 (5-6s) -- ACCEPT confirmation
    const visible = cycleT >= 0.5 && cycleT < 0.65
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.5) / 0.15)
      const scale = easeInOut(progress) * 1.2
      ref.current.scale.setScalar(scale)
      matRef.current.opacity = 0.7 * (1 - progress * 0.5)
    }
  })

  return (
    <mesh ref={ref} position={[PLOT_POS[0], PLOT_POS[1], PLOT_POS[2]]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.9, 0.04, 8, 32]} />
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0.7} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Execute Beam (animated tube wallet -> USDC)                        */
/* ------------------------------------------------------------------ */

function ExecuteBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(PLOT_POS[0] + 0.8, PLOT_POS[1], PLOT_POS[2]),
      new THREE.Vector3(USDC_POS[0] - 0.65, USDC_POS[1], USDC_POS[2]),
    )
    return new THREE.TubeGeometry(curve, 16, 0.02, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Visible during 0.6-0.8 (6-8s) -- Frame 2 Execute
    const visible = cycleT >= 0.6 && cycleT < 0.8
    ref.current.visible = visible
    if (visible) {
      const progress = clamp01((cycleT - 0.6) / 0.2)
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
/*  Token Stream Particles (16 along execute beam)                     */
/* ------------------------------------------------------------------ */

function TokenStreamParticles({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(
    () =>
      new THREE.LineCurve3(
        new THREE.Vector3(PLOT_POS[0] + 0.8, PLOT_POS[1], PLOT_POS[2]),
        new THREE.Vector3(USDC_POS[0] - 0.65, USDC_POS[1], USDC_POS[2]),
      ),
    [],
  )

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Active during 0.6-0.8 (6-8s) -- Frame 2 Execute
    const active = cycleT >= 0.6 && cycleT < 0.8

    for (let i = 0; i < count; i++) {
      if (active) {
        const beamProgress = clamp01((cycleT - 0.6) / 0.2)
        const p = ((beamProgress * 2 + i / count) % 1)
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
/*  USDC Target (blue RoundedBox)                                      */
/* ------------------------------------------------------------------ */

function USDCTarget({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Pulse when receiving tokens (0.7-0.8)
    const mat = ref.current.material as THREE.MeshStandardMaterial
    if (cycleT >= 0.7 && cycleT < 0.8) {
      mat.emissiveIntensity = 0.15 + Math.sin((cycleT - 0.7) / 0.1 * Math.PI * 4) * 0.1
    } else {
      mat.emissiveIntensity = 0.05
    }
    ref.current.position.y = USDC_POS[1] + Math.sin(elapsedRef.current * 1.0) * 0.015
  })

  return (
    <group>
      <RoundedBox ref={ref} args={[1.2, 0.8, 1.2]} radius={0.06} smoothness={4} position={USDC_POS}>
        <meshStandardMaterial color={BLUE} roughness={0.5} emissive={BLUE} emissiveIntensity={0.05} />
      </RoundedBox>
      <Html center position={[USDC_POS[0], 1.1, USDC_POS[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>USDC</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Address Label (always visible above plot/wallet)                   */
/* ------------------------------------------------------------------ */

function AddressLabel() {
  return (
    <Html center position={[PLOT_POS[0], 1.25, PLOT_POS[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: AMBER }}>0x1a2b...</p>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated Labels (phase-dependent)                                  */
/* ------------------------------------------------------------------ */

function AnimatedLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const fundsRef = useRef<THREE.Group>(null!)
  const deployRef = useRef<THREE.Group>(null!)
  const validateRef = useRef<THREE.Group>(null!)
  const executeRef = useRef<THREE.Group>(null!)
  const firstTxRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!fundsRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "Funds waiting" -- 0-0.4 (0-4s)
    fundsRef.current.visible = reducedMotion || cycleT < 0.4
    // "Frame 0: Deploy" -- 0.15-0.4 (1.5-4s)
    deployRef.current!.visible = reducedMotion || (cycleT >= 0.15 && cycleT < 0.4)
    // "Frame 1: ACCEPT" -- 0.4-0.6 (4-6s)
    validateRef.current!.visible = reducedMotion || (cycleT >= 0.4 && cycleT < 0.6)
    // "Frame 2: Execute" -- 0.6-0.8 (6-8s)
    executeRef.current!.visible = reducedMotion || (cycleT >= 0.6 && cycleT < 0.8)
    // "First-ever TX" -- 0.8-1.0 (8-10s)
    firstTxRef.current!.visible = reducedMotion || cycleT >= 0.8
  })

  return (
    <>
      <group ref={fundsRef}>
        <Html center position={[PLOT_POS[0] + 1.3, 0.3, PLOT_POS[2]]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: AMBER }}>
            Funds waiting
          </p>
        </Html>
      </group>

      <group ref={deployRef}>
        <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-indigo-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: INDIGO }}>
              Frame 0: Deploy
            </p>
          </div>
        </Html>
      </group>

      <group ref={validateRef}>
        <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Frame 1: ACCEPT
            </p>
          </div>
        </Html>
      </group>

      <group ref={executeRef}>
        <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Frame 2: Execute
            </p>
          </div>
        </Html>
      </group>

      <group ref={firstTxRef}>
        <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-300 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              First-ever TX
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

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: INDIGO }} />
        <span className="text-[10px] text-text-muted tracking-wide">Factory / Deploy</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Wallet (committed)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Pre-funded balance</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function AccountDeploy3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="3D animation showing a new account deployment in 3 frames: the address exists before the code does (CREATE2 deterministic), funds arrive first, then the wallet deploys and executes its first transaction"
      srDescription="A 3D scene showing account deployment. On the left, an indigo hexagonal factory node. In the center, an empty plot with a pulsing amber address beacon and pre-funded coins. A deploy beam shoots from the factory, construction particles spiral upward, and the plot fills into a solid green wallet. A purple validation arc curves in, an ACCEPT ring expands green, then an execute beam sends token particles to a blue USDC target on the right. The key insight: the address is deterministic -- funds can arrive before the wallet even exists."
      legend={<Legend />}
      fallbackText="Account deployment in 3 frames -- address exists before code does (CREATE2). Funds arrive first, then deploy + validate + execute atomically."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [-1, 6, 9], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* Factory */}
          <FactoryNode reducedMotion={reducedMotion} />

          {/* Empty Plot + Beacon + Coins */}
          <EmptyPlot reducedMotion={reducedMotion} />
          <AddressBeacon reducedMotion={reducedMotion} />
          <PreFundedCoins reducedMotion={reducedMotion} />

          {/* Built Wallet (materializes) */}
          <BuiltWallet reducedMotion={reducedMotion} />

          {/* Deploy Phase */}
          <DeployBeam reducedMotion={reducedMotion} />
          <ConstructionParticles count={24} reducedMotion={reducedMotion} />

          {/* Validate Phase */}
          <ValidateBeam reducedMotion={reducedMotion} />
          <AcceptRing reducedMotion={reducedMotion} />

          {/* Execute Phase */}
          <ExecuteBeam reducedMotion={reducedMotion} />
          <TokenStreamParticles count={16} reducedMotion={reducedMotion} />
          <USDCTarget reducedMotion={reducedMotion} />

          {/* Labels */}
          <AddressLabel />
          <AnimatedLabels reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 5}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 5}
            maxAzimuthAngle={Math.PI / 5}
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
