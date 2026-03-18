'use client'

import { useRef, useMemo, useState } from 'react'
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

const CYCLE = 9 // 9-second animation loop

const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const RED = '#ef4444'
const BLUE = '#3b82f6'

// Layout positions
const DEPOSIT_X = -4
const FRESH_X = 4
const ADDR_Y = 0.5
const ADDR_Z = 0

// Frame TX envelope center
const FRAME_TX_X = 0
const FRAME_TX_Y = 0.5

// Two frames inside Frame TX
const FRAME0_X = -1.2 // ZK Paymaster
const FRAME1_X = 1.2  // Withdrawal

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

function remap(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a))
}

/* ------------------------------------------------------------------ */
/*  Phase label bridge: useFrame inside Canvas writes to external state */
/* ------------------------------------------------------------------ */

type Phase = 0 | 1 | 2 | 3

function PhaseTracker({
  reducedMotion,
  onPhase,
}: {
  reducedMotion: boolean
  onPhase: (p: Phase) => void
}) {
  const elapsedRef = useRef(0)
  const lastPhaseRef = useRef<Phase>(0)

  useFrame((_, delta) => {
    if (reducedMotion) {
      if (lastPhaseRef.current !== 1) {
        lastPhaseRef.current = 1
        onPhase(1)
      }
      return
    }
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    let phase: Phase = 0
    // 0-3s => 0-0.33: Phase 1
    // 4-6s => 0.44-0.67: Phase 2
    // 7-8s => 0.78-0.89: Phase 3
    if (cycleT < 0.33) phase = 1
    else if (cycleT >= 0.44 && cycleT < 0.67) phase = 2
    else if (cycleT >= 0.78 && cycleT < 0.89) phase = 3
    else phase = 0

    if (phase !== lastPhaseRef.current) {
      lastPhaseRef.current = phase
      onPhase(phase)
    }
  })

  return null
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <RoundedBox args={[10.5, 0.04, 4]} radius={0.015} smoothness={4} position={[0, 0.02, 0]}>
      <meshStandardMaterial color="#fafafa" roughness={0.7} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  0xDeposit address (far-left sphere, blue)                          */
/* ------------------------------------------------------------------ */

function DepositAddress({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    ref.current.position.y = ADDR_Y + Math.sin(elapsedRef.current * 1.1) * 0.02
  })

  return (
    <group>
      <mesh ref={ref} position={[DEPOSIT_X, ADDR_Y, ADDR_Z]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} emissive={BLUE} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[DEPOSIT_X, ADDR_Y + 0.55, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: BLUE }}>0xDeposit</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  0xFresh address (far-right sphere, green)                          */
/* ------------------------------------------------------------------ */

function FreshAddress({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    if (!reducedMotion) {
      ref.current.position.y = ADDR_Y + Math.sin(elapsedRef.current * 1.1 + 1) * 0.02
    }

    // Pulse green when withdrawal beam arrives (6.5-8s => ~0.72-0.89)
    const pulse = cycleT > 0.72 && cycleT < 0.89
    matRef.current.emissiveIntensity = pulse
      ? 0.15 + Math.sin((cycleT - 0.72) / 0.17 * Math.PI * 3) * 0.12
      : 0.1
  })

  return (
    <group>
      <mesh ref={ref} position={[FRESH_X, ADDR_Y, ADDR_Z]}>
        <sphereGeometry args={[0.28, 16, 16]} />
        <meshStandardMaterial ref={matRef} color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[FRESH_X, ADDR_Y + 0.55, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GREEN }}>0xFresh</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Broken red line + "NO LINK" -- ALWAYS visible, permanent punchline */
/* ------------------------------------------------------------------ */

function BrokenLink({ reducedMotion }: { reducedMotion: boolean }) {
  const xRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const segments = useMemo(() => {
    const segs: { pos: [number, number, number]; width: number }[] = []
    const startX = DEPOSIT_X + 0.4
    const endX = FRESH_X - 0.4
    const y = ADDR_Y + 0.15
    const totalLen = endX - startX
    const dashCount = 9
    const dashLen = totalLen / (dashCount * 2 - 1)

    for (let i = 0; i < dashCount; i++) {
      const cx = startX + (i * 2 + 0.5) * dashLen
      // Skip dashes near center (where the X mark sits)
      if (Math.abs(cx - (startX + endX) / 2) < dashLen * 1.3) continue
      segs.push({ pos: [cx, y, ADDR_Z], width: dashLen * 0.85 })
    }
    return segs
  }, [])

  const centerX = (DEPOSIT_X + FRESH_X) / 2

  useFrame((_, delta) => {
    if (reducedMotion || !xRef.current) return
    elapsedRef.current += delta
    // Subtle pulse on the X mark
    const scale = 1.0 + Math.sin(elapsedRef.current * 2.5) * 0.05
    xRef.current.scale.setScalar(scale)
  })

  return (
    <group>
      {/* Dashed red line segments */}
      {segments.map((seg, i) => (
        <RoundedBox key={i} args={[seg.width, 0.02, 0.02]} radius={0.004} smoothness={4} position={seg.pos}>
          <meshStandardMaterial color={RED} roughness={0.4} transparent opacity={0.55} />
        </RoundedBox>
      ))}
      {/* X mark at center */}
      <group ref={xRef} position={[centerX, ADDR_Y + 0.15, ADDR_Z]}>
        <RoundedBox args={[0.35, 0.05, 0.05]} radius={0.01} smoothness={4} rotation={[0, 0, Math.PI / 4]}>
          <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.25} />
        </RoundedBox>
        <RoundedBox args={[0.35, 0.05, 0.05]} radius={0.01} smoothness={4} rotation={[0, 0, -Math.PI / 4]}>
          <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.25} />
        </RoundedBox>
      </group>
    </group>
  )
}

function NoLinkLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  const centerX = (DEPOSIT_X + FRESH_X) / 2

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Hide when transient labels are active (0.22-0.72) to stay within 5-label limit
    // The red X mark still conveys "no link" visually
    ref.current.visible = reducedMotion || cycleT < 0.22 || cycleT >= 0.72
  })

  return (
    <group ref={ref}>
      <Html center position={[centerX, ADDR_Y + 0.75, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-red-300 rounded px-2 py-0.5">
          <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>NO LINK</p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX envelope (blue wireframe, center)                         */
/* ------------------------------------------------------------------ */

function FrameTXEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Subtle base, slightly brighter during active phases
    let opacity = 0.08
    if (cycleT >= 0.22 && cycleT < 0.89) {
      opacity = 0.14
    }
    matRef.current.opacity = opacity
  })

  return (
    <mesh position={[FRAME_TX_X, FRAME_TX_Y, ADDR_Z]}>
      <boxGeometry args={[5.5, 1.5, 2]} />
      <meshBasicMaterial ref={matRef} color={BLUE} wireframe transparent opacity={0.08} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame 0: ZK Paymaster (purple RoundedBox)                          */
/* ------------------------------------------------------------------ */

function Frame0({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Glow during ZK proof absorption (2-4s => 0.22-0.44)
    let emissive = 0.03
    if (cycleT > 0.22 && cycleT < 0.44) {
      emissive = 0.08 + Math.sin((cycleT - 0.22) / 0.22 * Math.PI * 2) * 0.06
    }
    // Glow on ACCEPT (5.5-6.5s => 0.61-0.72)
    if (cycleT > 0.61 && cycleT < 0.72) {
      emissive = 0.12 + Math.sin((cycleT - 0.61) / 0.11 * Math.PI * 3) * 0.08
    }
    matRef.current.emissiveIntensity = emissive
  })

  return (
    <group>
      <RoundedBox args={[2, 1.0, 1.5]} radius={0.05} smoothness={4} position={[FRAME0_X, FRAME_TX_Y, ADDR_Z]}>
        <meshStandardMaterial ref={matRef} color={PURPLE} transparent opacity={0.3} roughness={0.5} emissive={PURPLE} emissiveIntensity={0.03} />
      </RoundedBox>
      <Html center position={[FRAME0_X, FRAME_TX_Y + 0.72, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap leading-tight text-center" style={{ color: PURPLE }}>
          Frame 0<br />ZK Paymaster
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame 1: Withdrawal (green RoundedBox)                             */
/* ------------------------------------------------------------------ */

function Frame1({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Glow when withdrawal beam fires (6.5-8s => 0.72-0.89)
    let emissive = 0.03
    if (cycleT > 0.72 && cycleT < 0.89) {
      emissive = 0.1 + Math.sin((cycleT - 0.72) / 0.17 * Math.PI * 3) * 0.08
    }
    matRef.current.emissiveIntensity = emissive
  })

  return (
    <group>
      <RoundedBox args={[2, 1.0, 1.5]} radius={0.05} smoothness={4} position={[FRAME1_X, FRAME_TX_Y, ADDR_Z]}>
        <meshStandardMaterial ref={matRef} color={GREEN} transparent opacity={0.25} roughness={0.5} emissive={GREEN} emissiveIntensity={0.03} />
      </RoundedBox>
      <Html center position={[FRAME1_X, FRAME_TX_Y + 0.72, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap leading-tight text-center" style={{ color: GREEN }}>
          Frame 1<br />Withdrawal
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ZK Proof cube -- enters Frame 0 from above (2-4s)                  */
/* ------------------------------------------------------------------ */

function ZKProofCube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  const startPos = useMemo(() => new THREE.Vector3(FRAME0_X, FRAME_TX_Y + 1.8, ADDR_Z), [])
  const endPos = useMemo(() => new THREE.Vector3(FRAME0_X, FRAME_TX_Y, ADDR_Z), [])

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 2-3.2s (0.22-0.36): descend into Frame 0
    // 3.2-4s (0.36-0.44): absorbed (shrink + glow)
    let visible = false
    let scale = 0.001

    if (cycleT >= 0.22 && cycleT < 0.36) {
      visible = true
      const t = easeInOut(remap(cycleT, 0.22, 0.36))
      scale = 1
      ref.current.position.lerpVectors(startPos, endPos, t)
      // Arc upward slightly on descent
      ref.current.position.y += Math.sin(t * Math.PI) * 0.15
      if (!reducedMotion) ref.current.rotation.y = t * Math.PI * 2
    } else if (cycleT >= 0.36 && cycleT < 0.44) {
      visible = true
      const t = remap(cycleT, 0.36, 0.44)
      scale = 1 - easeInOut(t)
      ref.current.position.copy(endPos)
    }

    ref.current.visible = visible
    ref.current.scale.setScalar(Math.max(scale, 0.001))
    matRef.current.emissiveIntensity = visible ? 0.3 + Math.sin(elapsedRef.current * 6) * 0.15 : 0
  })

  return (
    <group ref={ref} position={startPos.toArray()} visible={false}>
      <RoundedBox args={[0.22, 0.22, 0.22]} radius={0.03} smoothness={4}>
        <meshStandardMaterial ref={matRef} color={PURPLE} roughness={0.3} emissive={PURPLE} emissiveIntensity={0.3} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD arc -- amber tube from Frame 0 to Frame 1 (4-5.5s)    */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(FRAME0_X + 0.5, FRAME_TX_Y + 0.6, ADDR_Z),
      new THREE.Vector3(FRAME_TX_X, FRAME_TX_Y + 1.5, ADDR_Z),
      new THREE.Vector3(FRAME1_X - 0.5, FRAME_TX_Y + 0.6, ADDR_Z),
    )
    return new THREE.TubeGeometry(curve, 32, 0.018, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 4-5.5s => 0.44-0.61
    const visible = cycleT > 0.42 && cycleT < 0.63
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = clamp01(remap(cycleT, 0.42, 0.46))
      const fadeOut = cycleT > 0.58 ? clamp01(remap(cycleT, 0.63, 0.58)) : 1
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
/*  CALLDATAREAD sparks -- instanced spheres along the arc             */
/*  Sparks flow FROM Frame 1 TOWARD Frame 0 per spec                  */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Sparks flow FROM Frame 1 TOWARD Frame 0 (reversed direction)
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(FRAME1_X - 0.5, FRAME_TX_Y + 0.6, ADDR_Z),
    new THREE.Vector3(FRAME_TX_X, FRAME_TX_Y + 1.5, ADDR_Z),
    new THREE.Vector3(FRAME0_X + 0.5, FRAME_TX_Y + 0.6, ADDR_Z),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % CYCLE) / CYCLE

    // Active during 4-5.5s => 0.44-0.61
    const active = cycleT > 0.44 && cycleT < 0.61

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.4 + i / count) % 1)
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
/*  ACCEPT ring -- fires green torus around Frame 0 (5.5-6.5s)        */
/* ------------------------------------------------------------------ */

function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 5.5-6.5s => 0.61-0.72
    const active = cycleT > 0.61 && cycleT < 0.72
    meshRef.current.visible = active
    if (active) {
      const t = remap(cycleT, 0.61, 0.72)
      const expand = 1 + t * 0.5
      meshRef.current.scale.setScalar(expand)
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1 - t * 0.7)
    }
  })

  return (
    <mesh ref={meshRef} position={[FRAME0_X, FRAME_TX_Y, ADDR_Z]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.8, 0.04, 8, 32]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.8} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Withdrawal beam -- green tube from Frame 1 to 0xFresh (6.5-8s)    */
/* ------------------------------------------------------------------ */

function WithdrawalBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(FRAME1_X + 0.6, FRAME_TX_Y, ADDR_Z),
      new THREE.Vector3((FRAME1_X + FRESH_X) / 2, FRAME_TX_Y + 0.4, ADDR_Z),
      new THREE.Vector3(FRESH_X - 0.35, ADDR_Y, ADDR_Z),
    )
    return new THREE.TubeGeometry(curve, 24, 0.02, 8, false)
  }, [])

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 6.5-8s => 0.72-0.89
    let opacity = 0
    if (cycleT >= 0.72 && cycleT < 0.78) {
      opacity = easeInOut(remap(cycleT, 0.72, 0.78)) * 0.6
    } else if (cycleT >= 0.78 && cycleT < 0.85) {
      opacity = 0.6
    } else if (cycleT >= 0.85 && cycleT < 0.89) {
      opacity = 0.6 * (1 - easeInOut(remap(cycleT, 0.85, 0.89)))
    }
    matRef.current.opacity = opacity
    ref.current.visible = opacity > 0.01
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshBasicMaterial ref={matRef} color={GREEN} transparent opacity={0} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Withdrawal particles -- instanced spheres along the beam           */
/* ------------------------------------------------------------------ */

function WithdrawalParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(FRAME1_X + 0.6, FRAME_TX_Y, ADDR_Z),
    new THREE.Vector3((FRAME1_X + FRESH_X) / 2, FRAME_TX_Y + 0.4, ADDR_Z),
    new THREE.Vector3(FRESH_X - 0.35, ADDR_Y, ADDR_Z),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % CYCLE) / CYCLE
    const active = cycleT >= 0.72 && cycleT < 0.89

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0.001)
        dummy.position.set(0, -10, 0)
      } else {
        const p = ((t * 0.35 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI) * 0.03
        dummy.scale.setScalar(0.015 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
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
/*  Transient 3D labels -- one at a time, timed to animation phases    */
/* ------------------------------------------------------------------ */

function TransientLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const zkProofRef = useRef<THREE.Group>(null!)
  const calldataRef = useRef<THREE.Group>(null!)
  const acceptRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!zkProofRef.current || !calldataRef.current || !acceptRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "ZK proof" label during cube descent (2-4s => 0.22-0.44)
    zkProofRef.current.visible = cycleT > 0.22 && cycleT < 0.44

    // "CALLDATAREAD" label during arc (4-5.5s => 0.44-0.61)
    calldataRef.current.visible = cycleT > 0.46 && cycleT < 0.61

    // "Paymaster pays gas" during ACCEPT (5.5-6.5s => 0.61-0.72)
    acceptRef.current.visible = cycleT > 0.61 && cycleT < 0.72
  })

  return (
    <>
      {/* ZK proof label -- follows cube */}
      <group ref={zkProofRef} visible={false}>
        <Html center position={[FRAME0_X, FRAME_TX_Y + 2.2, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-purple-200 rounded px-2 py-0.5">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>ZK proof</p>
          </div>
        </Html>
      </group>

      {/* CALLDATAREAD label -- above the arc */}
      <group ref={calldataRef} visible={false}>
        <Html center position={[FRAME_TX_X, FRAME_TX_Y + 1.85, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-0.5">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>CALLDATAREAD</p>
          </div>
        </Html>
      </group>

      {/* Paymaster pays gas -- below Frame 0 */}
      <group ref={acceptRef} visible={false}>
        <Html center position={[FRAME0_X, FRAME_TX_Y - 0.8, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-0.5">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>Paymaster pays gas</p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Ambient floating particles (background texture)                    */
/* ------------------------------------------------------------------ */

function AmbientParticles({ count = 6, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () => Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8,
      y: Math.random() * 1.5 + 0.3,
      z: (Math.random() - 0.5) * 2.5,
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
      dummy.scale.setScalar(0.007 + Math.sin(t * 2 + o.phase) * 0.002)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={0.2} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase label text (below the scene, HTML, not 3D)                   */
/* ------------------------------------------------------------------ */

const PHASE_TEXTS: Record<Phase, string> = {
  0: '',
  1: 'No link between deposit and withdrawal',
  2: 'ZK proof verified \u2192 ACCEPT \u2192 paymaster pays gas',
  3: 'No relayer needed',
}

const PHASE_COLORS: Record<Phase, string> = {
  0: '#71717a',
  1: RED,
  2: PURPLE,
  3: GREEN,
}

function PhaseLabel({ phase }: { phase: Phase }) {
  const text = PHASE_TEXTS[phase]
  const color = PHASE_COLORS[phase]

  return (
    <div className="h-6 flex items-center justify-center overflow-hidden">
      {text ? (
        <p
          className="text-[11px] font-mono font-bold whitespace-nowrap transition-opacity duration-300"
          style={{ color }}
        >
          {text}
        </p>
      ) : (
        <div className="h-4" />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function ZKPrivacy3D() {
  const [phase, setPhase] = useState<Phase>(1)

  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="ZK privacy via Frame Transactions: no link between deposit and withdrawal because the ZK paymaster is a frame inside the transaction, not an external relayer"
      srDescription="A 3D scene showing two addresses: 0xDeposit on the far left (blue sphere) and 0xFresh on the far right (green sphere). A permanent broken red dashed line with an X mark between them is always visible, labeled NO LINK. In the center, a Frame Transaction envelope contains two boxes: Frame 0 (purple, ZK Paymaster) and Frame 1 (green, Withdrawal). A purple ZK proof cube descends into Frame 0 and is absorbed. An amber CALLDATAREAD arc with sparks flows from Frame 1 toward Frame 0. A green ACCEPT torus ring fires around Frame 0. A green withdrawal beam extends from Frame 1 to the 0xFresh address. Phase labels below the scene cycle through: No link between deposit and withdrawal, ZK proof verified ACCEPT paymaster pays gas, No relayer needed."
      legend={
        <div className="flex items-center gap-5 flex-wrap">
          <SceneLegend items={[{ color: RED, label: 'No link (privacy)' }, { color: PURPLE, label: 'ZK Paymaster' }, { color: GREEN, label: 'Withdrawal' }, { color: AMBER, label: 'CALLDATAREAD' }]} />
          <div className="ml-auto">
            <PhaseLabel phase={phase} />
          </div>
        </div>
      }
      fallbackText="ZK Privacy via Frame TX -- ZK paymaster is Frame 0, withdrawal is Frame 1. CALLDATAREAD verifies proof matches withdrawal. No relayer needed. No link between deposit and withdrawal."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 3, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Phase tracker: bridges useFrame to external state */}
          <PhaseTracker reducedMotion={reducedMotion} onPhase={setPhase} />

          {/* Platform */}
          <Platform />

          {/* PERMANENT: Addresses + broken red line + NO LINK label */}
          <DepositAddress reducedMotion={reducedMotion} />
          <FreshAddress reducedMotion={reducedMotion} />
          <BrokenLink reducedMotion={reducedMotion} />
          <NoLinkLabel reducedMotion={reducedMotion} />

          {/* Frame TX structure (always visible) */}
          <FrameTXEnvelope reducedMotion={reducedMotion} />
          <Frame0 reducedMotion={reducedMotion} />
          <Frame1 reducedMotion={reducedMotion} />

          {/* Animation: ZK proof cube enters Frame 0 (2-4s) */}
          <ZKProofCube reducedMotion={reducedMotion} />

          {/* Animation: CALLDATAREAD arc Frame 0 -> Frame 1 (4-5.5s) */}
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={10} reducedMotion={reducedMotion} />

          {/* Animation: ACCEPT ring on Frame 0 (5.5-6.5s) */}
          <AcceptRing reducedMotion={reducedMotion} />

          {/* Animation: Withdrawal beam Frame 1 -> 0xFresh (6.5-8s) */}
          <WithdrawalBeam reducedMotion={reducedMotion} />
          <WithdrawalParticles count={12} reducedMotion={reducedMotion} />

          {/* Transient 3D labels (one at a time, inside canvas) */}
          <TransientLabels reducedMotion={reducedMotion} />

          {/* Ambient particles */}
          <AmbientParticles count={6} reducedMotion={reducedMotion} />

          <AutoFitCamera points={[[-5, 2.5, 1.5], [5, 2.5, 1.5], [-5, -0.5, -1.5], [5, -0.5, -1.5]]} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            autoRotate={false}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
