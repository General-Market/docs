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
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#7c3aed'
const AMBER = '#f59e0b'
const INDIGO = '#4f46e5'
const GRAY = '#9ca3af'

// Layout positions
const DEPOSIT_X = -4
const WITHDRAW_X = 4
const ADDR_Z = 1.2

// Frame TX envelope
const ENVELOPE_X = 0
const ENVELOPE_Y = 0.7

// Two frames inside the envelope
const FRAME0_X = -1.5 // ZK-paymaster validation frame
const FRAME1_X = 1.8   // Execution frame (withdrawal)

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
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group>
      <RoundedBox args={[11, 0.02, 5]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[10.5, 0.04, 4.5]} radius={0.015} smoothness={4} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase 1 (0-3s): Deposit + Withdrawal addresses with NO LINK       */
/* ------------------------------------------------------------------ */

function DepositAddress({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    ref.current.position.y = 0.5 + Math.sin(elapsedRef.current * 1.2) * 0.02
  })

  return (
    <group>
      <mesh ref={ref} position={[DEPOSIT_X, 0.5, ADDR_Z]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={BLUE} roughness={0.4} emissive={BLUE} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[DEPOSIT_X, 1.1, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: BLUE }}>0xDeposit</p>
      </Html>
    </group>
  )
}

function WithdrawalAddress({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    if (!reducedMotion) {
      ref.current.position.y = 0.5 + Math.sin(elapsedRef.current * 1.2 + 1) * 0.02
    }
    // Pulse green when withdrawal arrives (6-8s => 0.6-0.8)
    const pulse = cycleT > 0.6 && cycleT < 0.8
    matRef.current.emissiveIntensity = pulse
      ? 0.15 + Math.sin((cycleT - 0.6) / 0.2 * Math.PI * 4) * 0.15
      : 0.1
  })

  return (
    <group>
      <mesh ref={ref} position={[WITHDRAW_X, 0.5, ADDR_Z]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial ref={matRef} color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.1} />
      </mesh>
      <Html center position={[WITHDRAW_X, 1.1, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GREEN }}>0xFresh</p>
      </Html>
    </group>
  )
}

/* Dashed line with RED X between addresses -- ALWAYS visible */
function BrokenLink({ reducedMotion }: { reducedMotion: boolean }) {
  const xRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  const segments = useMemo(() => {
    const segs: { pos: [number, number, number]; width: number }[] = []
    const startX = DEPOSIT_X + 0.4
    const endX = WITHDRAW_X - 0.4
    const y = 0.65
    const z = ADDR_Z
    const totalLen = endX - startX
    const dashCount = 8
    const dashLen = totalLen / (dashCount * 2 - 1)

    for (let i = 0; i < dashCount; i++) {
      const cx = startX + (i * 2 + 0.5) * dashLen
      if (Math.abs(cx - (startX + endX) / 2) < dashLen * 1.5) continue
      segs.push({ pos: [cx, y, z], width: dashLen * 0.85 })
    }
    return segs
  }, [])

  const centerX = (DEPOSIT_X + WITHDRAW_X) / 2
  const centerY = 0.65

  useFrame((_, delta) => {
    if (reducedMotion || !xRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Pulse during punchline moments (0-0.3, 0.85-1.0)
    const isPunchline = cycleT < 0.3 || cycleT > 0.85
    const scale = isPunchline ? 1.0 + Math.sin(elapsedRef.current * 3) * 0.08 : 1.0
    xRef.current.scale.setScalar(scale)
  })

  return (
    <group>
      {segments.map((seg, i) => (
        <RoundedBox key={i} args={[seg.width, 0.025, 0.025]} radius={0.005} smoothness={4} position={seg.pos}>
          <meshStandardMaterial color={RED} roughness={0.4} transparent opacity={0.6} />
        </RoundedBox>
      ))}
      <group ref={xRef} position={[centerX, centerY, ADDR_Z]}>
        <RoundedBox args={[0.4, 0.06, 0.06]} radius={0.01} smoothness={4} rotation={[0, 0, Math.PI / 4]}>
          <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.3} />
        </RoundedBox>
        <RoundedBox args={[0.4, 0.06, 0.06]} radius={0.01} smoothness={4} rotation={[0, 0, -Math.PI / 4]}>
          <meshStandardMaterial color={RED} roughness={0.3} emissive={RED} emissiveIntensity={0.3} />
        </RoundedBox>
      </group>
    </group>
  )
}

function NoLinkLabel() {
  const centerX = (DEPOSIT_X + WITHDRAW_X) / 2
  return (
    <Html center position={[centerX, 1.15, ADDR_Z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div className="bg-white/90 border border-red-300 rounded px-2 py-1">
        <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: RED }}>NO LINK</p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase 2 (3-6s): Frame TX Envelope with 2 frames                   */
/* ------------------------------------------------------------------ */

/* Outer wireframe envelope */
function FrameTXEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Fade in 0.28-0.35, hold until 0.85, fade out 0.85-0.92
    let opacity = 0
    if (cycleT >= 0.28 && cycleT < 0.35) {
      opacity = easeInOut((cycleT - 0.28) / 0.07) * 0.15
    } else if (cycleT >= 0.35 && cycleT < 0.85) {
      opacity = 0.15
    } else if (cycleT >= 0.85 && cycleT < 0.92) {
      opacity = 0.15 * (1 - easeInOut((cycleT - 0.85) / 0.07))
    }
    matRef.current.opacity = opacity
    ref.current.visible = opacity > 0.005
  })

  return (
    <mesh ref={ref} position={[ENVELOPE_X, ENVELOPE_Y, 0]} visible={false}>
      <boxGeometry args={[7, 1.6, 2.4]} />
      <meshBasicMaterial ref={matRef} color={BLUE} wireframe transparent opacity={0} />
    </mesh>
  )
}

/* Envelope label */
function EnvelopeLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.32 && cycleT < 0.85
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[ENVELOPE_X, ENVELOPE_Y + 1.1, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-blue-200 rounded px-2 py-0.5">
          <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
            Frame Transaction
          </p>
        </div>
      </Html>
    </group>
  )
}

/* Frame 0: ZK-paymaster validation frame (purple box) */
function Frame0ZKPaymaster({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0.3-0.38
    let opacity = 0
    if (cycleT >= 0.3 && cycleT < 0.38) {
      opacity = easeInOut((cycleT - 0.3) / 0.08) * 0.35
    } else if (cycleT >= 0.38 && cycleT < 0.85) {
      opacity = 0.35
    } else if (cycleT >= 0.85 && cycleT < 0.92) {
      opacity = 0.35 * (1 - easeInOut((cycleT - 0.85) / 0.07))
    }
    matRef.current.opacity = opacity
    meshRef.current.visible = opacity > 0.01

    // Glow during verification (0.4-0.55)
    if (cycleT > 0.4 && cycleT < 0.55) {
      matRef.current.emissiveIntensity = 0.1 + Math.sin((cycleT - 0.4) / 0.15 * Math.PI * 3) * 0.08
    } else {
      matRef.current.emissiveIntensity = 0.04
    }
  })

  return (
    <group>
      <RoundedBox ref={meshRef} args={[2.4, 1.1, 1.8]} radius={0.05} smoothness={4} position={[FRAME0_X, ENVELOPE_Y, 0]} visible={false}>
        <meshStandardMaterial ref={matRef} color={PURPLE} transparent opacity={0} roughness={0.5} emissive={PURPLE} emissiveIntensity={0.04} />
      </RoundedBox>
    </group>
  )
}

/* Frame 0 label */
function Frame0Label({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.35 && cycleT < 0.85
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[FRAME0_X, ENVELOPE_Y + 0.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap leading-tight text-center" style={{ color: PURPLE }}>
          Frame 0<br />ZK Paymaster
        </p>
      </Html>
    </group>
  )
}

/* Frame 1: Execution frame (green box) */
function Frame1Execution({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0.32-0.4
    let opacity = 0
    if (cycleT >= 0.32 && cycleT < 0.4) {
      opacity = easeInOut((cycleT - 0.32) / 0.08) * 0.3
    } else if (cycleT >= 0.4 && cycleT < 0.85) {
      opacity = 0.3
    } else if (cycleT >= 0.85 && cycleT < 0.92) {
      opacity = 0.3 * (1 - easeInOut((cycleT - 0.85) / 0.07))
    }
    matRef.current.opacity = opacity
    meshRef.current.visible = opacity > 0.01

    // Glow when executing withdrawal (0.6-0.75)
    if (cycleT > 0.6 && cycleT < 0.75) {
      matRef.current.emissiveIntensity = 0.1 + Math.sin((cycleT - 0.6) / 0.15 * Math.PI * 3) * 0.08
    } else {
      matRef.current.emissiveIntensity = 0.04
    }
  })

  return (
    <group>
      <RoundedBox ref={meshRef} args={[2.0, 1.1, 1.8]} radius={0.05} smoothness={4} position={[FRAME1_X, ENVELOPE_Y, 0]} visible={false}>
        <meshStandardMaterial ref={matRef} color={GREEN} transparent opacity={0} roughness={0.5} emissive={GREEN} emissiveIntensity={0.04} />
      </RoundedBox>
    </group>
  )
}

/* Frame 1 label */
function Frame1Label({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.37 && cycleT < 0.85
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[FRAME1_X, ENVELOPE_Y + 0.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap leading-tight text-center" style={{ color: GREEN }}>
          Frame 1<br />Withdrawal
        </p>
      </Html>
    </group>
  )
}

/* ZK Proof cube entering Frame 0 */
function ZKProofCube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  const startPos = useMemo(() => new THREE.Vector3(FRAME0_X - 1.5, ENVELOPE_Y + 0.8, 0), [])
  const endPos = useMemo(() => new THREE.Vector3(FRAME0_X, ENVELOPE_Y, 0), [])

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 0.38-0.42: travel into Frame 0
    // 0.42-0.48: absorbed (shrink)
    let visible = false
    let scale = 0.001

    if (cycleT >= 0.38 && cycleT < 0.42) {
      visible = true
      const t = easeInOut((cycleT - 0.38) / 0.04)
      scale = 1
      ref.current.position.lerpVectors(startPos, endPos, t)
      ref.current.position.y += Math.sin(t * Math.PI) * 0.25
      if (!reducedMotion) ref.current.rotation.y = t * Math.PI * 2
    } else if (cycleT >= 0.42 && cycleT < 0.48) {
      visible = true
      const t = (cycleT - 0.42) / 0.06
      scale = 1 - easeInOut(t)
      ref.current.position.copy(endPos)
    }

    ref.current.visible = visible
    ref.current.scale.setScalar(Math.max(scale, 0.001))
    matRef.current.emissiveIntensity = visible ? 0.3 + Math.sin(elapsedRef.current * 6) * 0.15 : 0
  })

  return (
    <group ref={ref} position={startPos.toArray()} visible={false}>
      <RoundedBox args={[0.2, 0.2, 0.2]} radius={0.03} smoothness={4}>
        <meshStandardMaterial ref={matRef} color={PURPLE} roughness={0.3} emissive={PURPLE} emissiveIntensity={0.3} />
      </RoundedBox>
      <Html center position={[0, -0.22, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[7px] font-mono font-bold whitespace-nowrap" style={{ color: PURPLE }}>ZK proof</p>
      </Html>
    </group>
  )
}

/* ACCEPT ring fires green around Frame 0 */
function AcceptRing({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fire at 0.48-0.56
    const active = cycleT > 0.48 && cycleT < 0.56
    meshRef.current.visible = active
    if (active) {
      const t = (cycleT - 0.48) / 0.08
      const expand = 1 + t * 0.6
      meshRef.current.scale.setScalar(expand)
      const mat = meshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.8 * (1 - t * 0.6)
    }
  })

  return (
    <mesh ref={meshRef} position={[FRAME0_X, ENVELOPE_Y, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.9, 0.04, 8, 32]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.8} />
    </mesh>
  )
}

/* ACCEPT label */
function AcceptLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.48 && cycleT < 0.62
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[FRAME0_X, ENVELOPE_Y - 0.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
          <p className="text-[11px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            ACCEPT
          </p>
        </div>
      </Html>
    </group>
  )
}

/* Pays gas label on Frame 0 */
function PaysGasLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.5 && cycleT < 0.65
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[FRAME0_X, ENVELOPE_Y - 1.1, -0.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: INDIGO }}>
          Paymaster pays gas
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase 3 (6-8s): CALLDATAREAD arc from Frame 0 to Frame 1          */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(FRAME0_X + 0.6, ENVELOPE_Y + 0.6, 0),
      new THREE.Vector3((FRAME0_X + FRAME1_X) / 2, ENVELOPE_Y + 1.6, 0),
      new THREE.Vector3(FRAME1_X - 0.5, ENVELOPE_Y + 0.6, 0),
    )
    return new THREE.TubeGeometry(curve, 32, 0.018, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Visible 0.6-0.8
    const visible = cycleT > 0.58 && cycleT < 0.82
    meshRef.current.visible = visible
    if (visible) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      const fadeIn = clamp01((cycleT - 0.58) / 0.04)
      const fadeOut = cycleT > 0.78 ? clamp01((0.82 - cycleT) / 0.04) : 1
      mat.opacity = 0.6 * fadeIn * fadeOut
    }
  })

  return (
    <mesh ref={meshRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0.6} roughness={0.3} />
    </mesh>
  )
}

/* Sparks traveling along the arc */
function CalldatareadSparks({ count = 10, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(FRAME0_X + 0.6, ENVELOPE_Y + 0.6, 0),
    new THREE.Vector3((FRAME0_X + FRAME1_X) / 2, ENVELOPE_Y + 1.6, 0),
    new THREE.Vector3(FRAME1_X - 0.5, ENVELOPE_Y + 0.6, 0),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    const t = elapsedRef.current

    const active = cycleT > 0.6 && cycleT < 0.8

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

/* CALLDATAREAD label */
function CalldatareadLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    ref.current.visible = cycleT > 0.62 && cycleT < 0.8
  })

  return (
    <group ref={ref} visible={false}>
      <Html center position={[(FRAME0_X + FRAME1_X) / 2, ENVELOPE_Y + 1.85, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
          <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>
            CALLDATAREAD
          </p>
          <p className="text-[7px] font-mono whitespace-nowrap text-center" style={{ color: '#71717a' }}>
            verify proof matches withdrawal
          </p>
        </div>
      </Html>
    </group>
  )
}

/* Withdrawal beam from Frame 1 to fresh address */
function WithdrawalBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(FRAME1_X + 0.5, ENVELOPE_Y, 0),
      new THREE.Vector3(FRAME1_X + 1.5, ENVELOPE_Y + 0.3, ADDR_Z * 0.5),
      new THREE.Vector3(WITHDRAW_X - 0.35, 0.5, ADDR_Z),
    )
    return new THREE.TubeGeometry(curve, 24, 0.02, 8, false)
  }, [])

  useFrame((_, delta) => {
    if (!ref.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // 0.6-0.7: grow, 0.7-0.82: hold, 0.82-0.88: fade
    let opacity = 0
    if (cycleT >= 0.6 && cycleT < 0.7) {
      opacity = easeInOut((cycleT - 0.6) / 0.1) * 0.6
    } else if (cycleT >= 0.7 && cycleT < 0.82) {
      opacity = 0.6
    } else if (cycleT >= 0.82 && cycleT < 0.88) {
      opacity = 0.6 * (1 - easeInOut((cycleT - 0.82) / 0.06))
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

/* Particles along the withdrawal beam */
function WithdrawalParticles({ count = 14, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(FRAME1_X + 0.5, ENVELOPE_Y, 0),
    new THREE.Vector3(FRAME1_X + 1.5, ENVELOPE_Y + 0.3, ADDR_Z * 0.5),
    new THREE.Vector3(WITHDRAW_X - 0.35, 0.5, ADDR_Z),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycleT = (t % CYCLE) / CYCLE
    const active = cycleT >= 0.62 && cycleT < 0.85

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.scale.setScalar(0.001)
      } else {
        const p = ((t * 0.3 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(p * Math.PI) * 0.04
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
/*  Phase 4 (8-10s): "No Relayer" comparison                          */
/* ------------------------------------------------------------------ */

function NoRelayerComparison({ reducedMotion }: { reducedMotion: boolean }) {
  const oldRef = useRef<THREE.Group>(null!)
  const newRef = useRef<THREE.Group>(null!)
  const strikeRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!oldRef.current || !newRef.current || !strikeRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Old way visible 0.8-0.95
    const oldVisible = cycleT > 0.8 && cycleT < 0.97
    oldRef.current.visible = oldVisible

    // Strike-through crosses out "Relayer" 0.84-0.97
    strikeRef.current.visible = cycleT > 0.84 && cycleT < 0.97
    if (!reducedMotion && strikeRef.current.visible) {
      const growT = clamp01((cycleT - 0.84) / 0.04)
      strikeRef.current.scale.set(easeInOut(growT), 1, 1)
    }

    // New way label 0.84-0.97
    newRef.current.visible = cycleT > 0.84 && cycleT < 0.97
  })

  return (
    <group>
      {/* Old way: User -> Relayer -> Contract */}
      <group ref={oldRef} visible={false}>
        <Html center position={[-1.5, -0.5, 2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-zinc-200 rounded px-2 py-1">
            <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: GRAY }}>
              Old: User {'->'} <span style={{ color: RED }}>Relayer</span> {'->'} Contract
            </p>
          </div>
        </Html>
      </group>

      {/* Strike-through on "Relayer" */}
      <group ref={strikeRef} visible={false}>
        <Html center position={[-1.5, -0.5, 2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="px-2 py-1" style={{ position: 'relative' }}>
            <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: 'transparent' }}>
              Old: User {'->'} <span style={{ color: 'transparent', textDecoration: 'line-through', textDecorationColor: RED }}>Relayer</span> {'->'} Contract
            </p>
            {/* The visible strikethrough layer */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '100%', height: 2, backgroundColor: RED, opacity: 0.7 }} />
            </div>
          </div>
        </Html>
      </group>

      {/* New way: Frame TX, paymaster IS a frame */}
      <group ref={newRef} visible={false}>
        <Html center position={[1.5, -0.5, 2.2]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: GREEN }}>
              Frame TX: paymaster IS a frame<br />
              <span className="font-bold">No relayer needed</span>
            </p>
          </div>
        </Html>
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Ambient Floating Particles                                         */
/* ------------------------------------------------------------------ */

function AmbientParticles({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const offsets = useMemo(
    () => Array.from({ length: count }, () => ({
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
/*  Phase Labels (switching context text)                              */
/* ------------------------------------------------------------------ */

function PhaseLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const noLinkRef = useRef<THREE.Group>(null!)
  const frameTxRef = useRef<THREE.Group>(null!)
  const verifyRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!noLinkRef.current || !frameTxRef.current || !verifyRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // "No link between addresses" — 0-0.28
    noLinkRef.current.visible = reducedMotion || cycleT < 0.28

    // "ZK paymaster verifies proof, pays gas" — 0.42-0.6
    frameTxRef.current.visible = cycleT > 0.42 && cycleT < 0.6

    // "Proof matches withdrawal calldata" — 0.64-0.78
    verifyRef.current.visible = cycleT > 0.64 && cycleT < 0.78
  })

  return (
    <>
      <group ref={noLinkRef}>
        <Html center position={[0, -0.15, 2.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[10px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: '#71717a' }}>
            No link between deposit and withdrawal
          </p>
        </Html>
      </group>
      <group ref={frameTxRef} visible={false}>
        <Html center position={[FRAME0_X, -0.4, -1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-purple-200 rounded px-2 py-1">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>
              ZK proof verified {'->'} ACCEPT {'->'} pays gas
            </p>
          </div>
        </Html>
      </group>
      <group ref={verifyRef} visible={false}>
        <Html center position={[0, -0.4, -1.0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-amber-200 rounded px-2 py-1">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: AMBER }}>
              Frame 0 reads Frame 1 calldata to verify
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
    <div className="flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">ZK Paymaster (Frame 0)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Withdrawal (Frame 1)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">CALLDATAREAD</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 flex items-center justify-center">
          <span className="text-[10px] font-bold" style={{ color: RED }}>X</span>
        </div>
        <span className="text-[10px] text-text-muted tracking-wide">No link</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function ZKPrivacy3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="ZK privacy via Frame Transactions: a ZK-SNARK paymaster frame verifies proofs and pays gas, eliminating relayers, while a withdrawal frame sends funds to a fresh address with no link to the deposit"
      srDescription="A 3D scene showing privacy via Frame Transactions. On the left, a blue deposit address sphere. On the right, a green withdrawal address sphere. A permanent dashed red line with X between them shows NO LINK. In the center, a Frame Transaction envelope appears containing two frames: Frame 0 (purple) is the ZK paymaster that receives a ZK proof cube, verifies it, and fires a green ACCEPT ring. Frame 1 (green) is the execution frame for the withdrawal. An amber CALLDATAREAD arc shows Frame 0 reading Frame 1 withdrawal calldata to verify the proof matches. A green beam extends from Frame 1 to the fresh withdrawal address. Finally, a comparison shows the old relayer-based approach crossed out versus the new Frame TX approach where the paymaster IS a frame."
      legend={<Legend />}
      fallbackText="ZK Privacy via Frame TX -- ZK paymaster is Frame 0, withdrawal is Frame 1. CALLDATAREAD verifies proof matches withdrawal. No relayer needed."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5.5, 10], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* Phase 1: Punchline -- NO LINK (always visible) */}
          <DepositAddress reducedMotion={reducedMotion} />
          <WithdrawalAddress reducedMotion={reducedMotion} />
          <BrokenLink reducedMotion={reducedMotion} />
          <NoLinkLabel />

          {/* Phase 2: Frame TX Envelope + two frames */}
          <FrameTXEnvelope reducedMotion={reducedMotion} />
          <EnvelopeLabel reducedMotion={reducedMotion} />
          <Frame0ZKPaymaster reducedMotion={reducedMotion} />
          <Frame0Label reducedMotion={reducedMotion} />
          <Frame1Execution reducedMotion={reducedMotion} />
          <Frame1Label reducedMotion={reducedMotion} />

          {/* ZK proof enters Frame 0 + ACCEPT */}
          <ZKProofCube reducedMotion={reducedMotion} />
          <AcceptRing reducedMotion={reducedMotion} />
          <AcceptLabel reducedMotion={reducedMotion} />
          <PaysGasLabel reducedMotion={reducedMotion} />

          {/* Phase 3: CALLDATAREAD arc from Frame 0 to Frame 1 */}
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={10} reducedMotion={reducedMotion} />
          <CalldatareadLabel reducedMotion={reducedMotion} />

          {/* Withdrawal beam from Frame 1 to fresh address */}
          <WithdrawalBeam reducedMotion={reducedMotion} />
          <WithdrawalParticles count={14} reducedMotion={reducedMotion} />

          {/* Phase 4: No Relayer comparison */}
          <NoRelayerComparison reducedMotion={reducedMotion} />

          {/* Phase labels */}
          <PhaseLabels reducedMotion={reducedMotion} />

          {/* Ambient */}
          <AmbientParticles count={8} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={4}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 12}
            maxAzimuthAngle={Math.PI / 12}
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.2}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
