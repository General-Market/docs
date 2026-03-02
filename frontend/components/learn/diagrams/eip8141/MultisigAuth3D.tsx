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

const LOOP = 10          // seconds per animation cycle
const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const BLUE = '#3b82f6'
const INDIGO = '#6366f1'

const ALICE_POS = new THREE.Vector3(-4, 0.5, 1.5)
const BOB_POS = new THREE.Vector3(-4, 0.5, -1.5)
const VAULT_POS = new THREE.Vector3(0, 0.5, 0)
const USDC_POS = new THREE.Vector3(4.5, 0.5, 0)
const F1_POS = new THREE.Vector3(2, 0.3, 2)

/* ------------------------------------------------------------------ */
/*  Utility: normalized loop time                                      */
/* ------------------------------------------------------------------ */

function loopT(elapsed: number): number {
  return (elapsed % LOOP) / LOOP
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <RoundedBox args={[12, 0.04, 5]} radius={0.015} smoothness={4} position={[0, 0, 0]}>
      <meshStandardMaterial color="#fafafa" roughness={0.7} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Signer Spheres (Alice + Bob)                                       */
/* ------------------------------------------------------------------ */

function SignerSphere({ position, label, reducedMotion }: {
  position: THREE.Vector3
  label: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)
    // Breathe pulse 0-1s
    const breathe = t < 0.1 ? 1 + Math.sin(t * 10 * Math.PI * 2) * 0.08 : 1.0
    ref.current.scale.setScalar(breathe)
  })

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial color={PURPLE} roughness={0.4} emissive={PURPLE} emissiveIntensity={0.15} />
      </mesh>
      <Html center position={[0, 0.65, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: PURPLE }}>{label}</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Signature Cubes (animated from signers to vault)                   */
/* ------------------------------------------------------------------ */

function SignatureCube({ start, reducedMotion }: {
  start: THREE.Vector3
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  // Curved path from signer to vault
  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + VAULT_POS.x) / 2,
      Math.max(start.y, VAULT_POS.y) + 1.2,
      (start.z + VAULT_POS.z) / 2,
    )
    return new THREE.QuadraticBezierCurve3(start, mid, VAULT_POS)
  }, [start])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Visible 1-4.5s (0.1 - 0.45 in loop fraction)
    if (t < 0.1 || t > 0.45) {
      ref.current.scale.setScalar(0)
      return
    }

    // Emerge 0.1-0.15, travel 0.15-0.35, sink 0.35-0.45
    if (t < 0.15) {
      // Emerge from signer
      const emerge = (t - 0.1) / 0.05
      ref.current.position.copy(curve.getPoint(0))
      ref.current.scale.setScalar(emerge)
    } else if (t < 0.35) {
      // Travel along curve
      const travel = (t - 0.15) / 0.2
      const eased = travel < 0.5 ? 2 * travel * travel : 1 - Math.pow(-2 * travel + 2, 2) / 2
      ref.current.position.copy(curve.getPoint(eased))
      ref.current.scale.setScalar(1)
      ref.current.rotation.y += delta * 3
      ref.current.rotation.x += delta * 2
    } else {
      // Sink into vault
      const sink = 1 - (t - 0.35) / 0.1
      ref.current.position.copy(VAULT_POS)
      ref.current.scale.setScalar(Math.max(0, sink))
    }
  })

  return (
    <group ref={ref} scale={0}>
      <RoundedBox args={[0.2, 0.2, 0.2]} radius={0.03} smoothness={4}>
        <meshStandardMaterial color={PURPLE} emissive={PURPLE} emissiveIntensity={0.4} roughness={0.3} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Signature Trail Particles (instanced)                              */
/* ------------------------------------------------------------------ */

function SignatureTrail({ start, count = 16, reducedMotion }: {
  start: THREE.Vector3
  count?: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + VAULT_POS.x) / 2,
      Math.max(start.y, VAULT_POS.y) + 1.2,
      (start.z + VAULT_POS.z) / 2,
    )
    return new THREE.QuadraticBezierCurve3(start, mid, VAULT_POS)
  }, [start])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    for (let i = 0; i < count; i++) {
      // Trail visible when sig cubes are traveling: 0.1-0.45
      if (t < 0.1 || t > 0.45) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
      } else {
        const travel = (t - 0.1) / 0.35
        // Each particle trails behind the head
        const offset = (i / count) * 0.3
        const p = Math.max(0, Math.min(1, travel - offset))
        const eased = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
        dummy.position.copy(curve.getPoint(eased))
        const fade = Math.sin(p * Math.PI)
        dummy.scale.setScalar(0.008 * (fade * 0.8 + 0.2))
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={PURPLE} transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Validator Vault                                                    */
/* ------------------------------------------------------------------ */

function ValidatorVault({ reducedMotion }: { reducedMotion: boolean }) {
  const wireRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const colorRef = useRef(new THREE.Color('#e2e8f0'))

  useFrame((_, delta) => {
    if (!wireRef.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // After ACCEPT (0.45-0.6), flash green
    const mat = wireRef.current.material as THREE.MeshBasicMaterial
    if (t >= 0.45 && t < 0.8) {
      const g = Math.min(1, (t - 0.45) / 0.1)
      colorRef.current.set('#e2e8f0').lerp(new THREE.Color(GREEN), g)
      mat.color.copy(colorRef.current)
      mat.opacity = 0.25 + g * 0.15
    } else {
      mat.color.set('#e2e8f0')
      mat.opacity = 0.2
    }
  })

  return (
    <group position={[VAULT_POS.x, VAULT_POS.y, VAULT_POS.z]}>
      {/* Solid inner */}
      <RoundedBox args={[2, 1.5, 2]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color="#f8fafc" roughness={0.8} transparent opacity={0.3} />
      </RoundedBox>
      {/* Wireframe outline */}
      <mesh ref={wireRef}>
        <boxGeometry args={[2.05, 1.55, 2.05]} />
        <meshBasicMaterial color="#e2e8f0" wireframe transparent opacity={0.2} />
      </mesh>
      {/* Label */}
      <Html center position={[0, 1.1, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col items-center gap-0">
          <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>Frame 0</p>
          <p className="text-[8px] tracking-[0.05em] uppercase whitespace-nowrap" style={{ color: BLUE, opacity: 0.7 }}>Validate</p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Vault Lock (large, flips on ACCEPT)                                */
/* ------------------------------------------------------------------ */

function VaultLock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const bodyColor = useRef(new THREE.Color(INDIGO))
  const ringColor = useRef(new THREE.Color(INDIGO))

  useFrame((_, delta) => {
    if (!groupRef.current || !bodyRef.current || !ringRef.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Lock sits on front face of vault
    groupRef.current.position.set(VAULT_POS.x, VAULT_POS.y + 0.2, VAULT_POS.z + 1.05)

    // ACCEPT moment: 0.45-0.6 -- dramatic 180 degree flip
    if (t >= 0.45 && t < 0.6) {
      const flip = (t - 0.45) / 0.15
      const eased = flip < 0.5 ? 2 * flip * flip : 1 - Math.pow(-2 * flip + 2, 2) / 2
      groupRef.current.rotation.y = eased * Math.PI

      // Color transition: indigo -> green
      bodyColor.current.set(INDIGO).lerp(new THREE.Color(GREEN), eased)
      ringColor.current.set(INDIGO).lerp(new THREE.Color(GREEN), eased)

      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.copy(bodyColor.current)
      bodyMat.emissive.copy(bodyColor.current)
      bodyMat.emissiveIntensity = 0.3 + eased * 0.4

      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.copy(ringColor.current)
      ringMat.emissive.copy(ringColor.current)
      ringMat.emissiveIntensity = 0.3 + eased * 0.4
    } else if (t >= 0.6 && t < 0.8) {
      // Hold green
      groupRef.current.rotation.y = Math.PI
      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.set(GREEN)
      bodyMat.emissive.set(GREEN)
      bodyMat.emissiveIntensity = 0.5 + Math.sin((t - 0.6) * 20 * Math.PI) * 0.15
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.set(GREEN)
      ringMat.emissive.set(GREEN)
      ringMat.emissiveIntensity = 0.5 + Math.sin((t - 0.6) * 20 * Math.PI) * 0.15
    } else {
      // Reset to indigo
      groupRef.current.rotation.y = 0
      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.set(INDIGO)
      bodyMat.emissive.set(INDIGO)
      bodyMat.emissiveIntensity = 0.15
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.set(INDIGO)
      ringMat.emissive.set(INDIGO)
      ringMat.emissiveIntensity = 0.15
    }
  })

  return (
    <group ref={groupRef}>
      {/* Lock body (cylinder) */}
      <mesh ref={bodyRef} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.25, 16]} />
        <meshStandardMaterial color={INDIGO} emissive={INDIGO} emissiveIntensity={0.15} roughness={0.3} />
      </mesh>
      {/* Lock ring (torus) */}
      <mesh ref={ringRef} position={[0, 0.08, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.18, 0.04, 12, 24]} />
        <meshStandardMaterial color={INDIGO} emissive={INDIGO} emissiveIntensity={0.15} roughness={0.3} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Verification Checkmarks (Html labels that appear on sig verify)     */
/* ------------------------------------------------------------------ */

function VerificationLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const aliceRef = useRef<HTMLDivElement>(null!)
  const bobRef = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Alice checkmark at 0.35, Bob at 0.38
    if (aliceRef.current) {
      aliceRef.current.style.opacity = (t >= 0.35 && t < 0.8) ? '1' : '0'
    }
    if (bobRef.current) {
      bobRef.current.style.opacity = (t >= 0.38 && t < 0.8) ? '1' : '0'
    }
  })

  return (
    <group position={[VAULT_POS.x, VAULT_POS.y, VAULT_POS.z]}>
      <Html center position={[-0.3, 0.15, 1.06]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div ref={aliceRef} style={{ opacity: 0, transition: 'opacity 0.2s' }}>
          <p className="text-[9px] font-mono whitespace-nowrap font-bold" style={{ color: GREEN }}>Alice &#10003;</p>
        </div>
      </Html>
      <Html center position={[0.3, -0.1, 1.06]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div ref={bobRef} style={{ opacity: 0, transition: 'opacity 0.2s' }}>
          <p className="text-[9px] font-mono whitespace-nowrap font-bold" style={{ color: GREEN }}>Bob &#10003;</p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Flash Ring (dramatic torus expansion)                       */
/* ------------------------------------------------------------------ */

function AcceptFlashRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Flash at 0.45-0.6
    if (t >= 0.45 && t < 0.6) {
      const progress = (t - 0.45) / 0.15
      const scale = 0.3 + progress * 3.5
      ref.current.scale.set(scale, scale, scale)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - progress) * 0.9
      ref.current.visible = true
    } else {
      ref.current.visible = false
      ref.current.scale.setScalar(0.3)
    }
  })

  return (
    <mesh ref={ref} position={[VAULT_POS.x, VAULT_POS.y, VAULT_POS.z]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.5, 0.06, 12, 48]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0} side={THREE.DoubleSide} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Label                                                       */
/* ------------------------------------------------------------------ */

function AcceptLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)
    if (ref.current) {
      if (t >= 0.45 && t < 0.8) {
        const pulse = t < 0.6 ? 1.0 : 0.8 + Math.sin((t - 0.6) * 30) * 0.2
        ref.current.style.opacity = String(pulse)
        ref.current.style.transform = t < 0.55 ? 'scale(1.15)' : 'scale(1)'
      } else {
        ref.current.style.opacity = '0'
      }
    }
  })

  return (
    <Html center position={[VAULT_POS.x, VAULT_POS.y + 1.35, VAULT_POS.z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div ref={ref} style={{ opacity: 0, transition: 'opacity 0.15s' }}>
        <p className="text-[14px] font-bold font-mono whitespace-nowrap tracking-wide" style={{ color: GREEN }}>ACCEPT</p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame 1 Calldata Cube                                              */
/* ------------------------------------------------------------------ */

function CalldataCube() {
  return (
    <group position={[F1_POS.x, F1_POS.y, F1_POS.z]}>
      <RoundedBox args={[0.5, 0.3, 0.5]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      <Html center position={[0, 0.35, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: AMBER }}>calldata</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber tube from vault to F1 — Frame 0 reads F1)  */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const tubeRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (VAULT_POS.x + F1_POS.x) / 2 + 0.5,
      Math.max(VAULT_POS.y, F1_POS.y) + 1.0,
      (VAULT_POS.z + F1_POS.z) / 2,
    )
    return new THREE.QuadraticBezierCurve3(VAULT_POS, mid, F1_POS)
  }, [])

  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 32, 0.006, 6, false), [curve])

  useFrame((_, delta) => {
    if (!tubeRef.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Visible 0.25-0.45
    const mat = tubeRef.current.material as THREE.MeshStandardMaterial
    if (t >= 0.25 && t < 0.45) {
      const fade = t < 0.3 ? (t - 0.25) / 0.05 : t > 0.4 ? 1 - (t - 0.4) / 0.05 : 1
      mat.opacity = fade * 0.6
      tubeRef.current.visible = true
    } else {
      tubeRef.current.visible = false
    }
  })

  return (
    <mesh ref={tubeRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Label                                                 */
/* ------------------------------------------------------------------ */

function CalldatareadLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)
    if (ref.current) {
      ref.current.style.opacity = (t >= 0.25 && t < 0.45) ? '1' : '0'
    }
  })

  const midPos = useMemo(() => {
    return new THREE.Vector3(
      (F1_POS.x + VAULT_POS.x) / 2 + 0.5,
      Math.max(F1_POS.y, VAULT_POS.y) + 1.3,
      (F1_POS.z + VAULT_POS.z) / 2,
    )
  }, [])

  return (
    <Html center position={[midPos.x, midPos.y, midPos.z]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
      <div ref={ref} style={{ opacity: 0, transition: 'opacity 0.15s' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap tracking-wide" style={{ color: AMBER }}>CALLDATAREAD</p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Particles (instanced, flowing vault -> F1)            */
/* ------------------------------------------------------------------ */

function CalldatareadParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (VAULT_POS.x + F1_POS.x) / 2 + 0.5,
      Math.max(VAULT_POS.y, F1_POS.y) + 1.0,
      (VAULT_POS.z + F1_POS.z) / 2,
    )
    return new THREE.QuadraticBezierCurve3(VAULT_POS, mid, F1_POS)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    for (let i = 0; i < count; i++) {
      // Visible 0.25-0.45
      if (t < 0.25 || t > 0.45) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
      } else {
        const progress = (t - 0.25) / 0.2
        const p = ((progress * 1.5 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        const fade = Math.sin(p * Math.PI)
        dummy.scale.setScalar(0.006 * (fade * 0.8 + 0.2))
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
/*  USDC Target Node                                                   */
/* ------------------------------------------------------------------ */

function UsdcTarget({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Pulse when receiving tokens: 0.7-0.8
    if (t >= 0.7 && t < 0.8) {
      const pulse = 1 + Math.sin((t - 0.7) * 80) * 0.06
      ref.current.scale.setScalar(pulse)
    } else {
      ref.current.scale.setScalar(1)
    }
  })

  return (
    <group ref={ref} position={[USDC_POS.x, USDC_POS.y, USDC_POS.z]}>
      <RoundedBox args={[1.5, 1, 1.5]} radius={0.06} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
      <Html center position={[0, 0.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="flex flex-col items-center gap-0">
          <p className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>Frame 1</p>
          <p className="text-[8px] tracking-[0.05em] uppercase whitespace-nowrap" style={{ color: BLUE, opacity: 0.7 }}>Execute</p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Command Beam (vault -> USDC, green cylinder that grows)            */
/* ------------------------------------------------------------------ */

function CommandBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    // Beam grows 0.6-0.8
    if (t >= 0.6 && t < 0.8) {
      const grow = (t - 0.6) / 0.2
      const eased = grow < 0.5 ? 2 * grow * grow : 1 - Math.pow(-2 * grow + 2, 2) / 2

      const startX = VAULT_POS.x + 1.05
      const endX = USDC_POS.x - 0.8
      const totalLen = endX - startX
      const currentLen = eased * totalLen

      ref.current.position.set(startX + currentLen / 2, VAULT_POS.y, 0)
      ref.current.scale.set(1, 1, currentLen > 0.01 ? currentLen : 0.01)
      ref.current.visible = true

      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.7 + Math.sin(t * 40) * 0.2
    } else if (t >= 0.8 && t < 1.0) {
      // Hold then fade
      const fade = 1 - (t - 0.8) / 0.2
      const startX = VAULT_POS.x + 1.05
      const endX = USDC_POS.x - 0.8
      const totalLen = endX - startX
      ref.current.position.set(startX + totalLen / 2, VAULT_POS.y, 0)
      ref.current.scale.set(1, 1, totalLen)
      ref.current.visible = fade > 0.05
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = fade * 0.8
    } else {
      ref.current.visible = false
    }
  })

  return (
    <mesh ref={ref} rotation={[0, Math.PI / 2, 0]} visible={false}>
      <cylinderGeometry args={[0.03, 0.03, 1, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  USDC Token Stream Particles (instanced, vault -> USDC)             */
/* ------------------------------------------------------------------ */

function TokenStream({ count = 20, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const start = new THREE.Vector3(VAULT_POS.x + 1.05, VAULT_POS.y, 0)
    const end = new THREE.Vector3(USDC_POS.x - 0.8, USDC_POS.y, 0)
    const mid = new THREE.Vector3(
      (start.x + end.x) / 2,
      start.y + 0.4,
      0,
    )
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = loopT(elapsedRef.current)

    for (let i = 0; i < count; i++) {
      // Visible 0.6-0.85
      if (t < 0.6 || t > 0.85) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
      } else {
        const stream = (t - 0.6) / 0.25
        const p = ((stream * 2 + i / count) % 1)
        dummy.position.copy(curve.getPoint(p))
        // Small vertical scatter
        dummy.position.y += Math.sin(i * 2.7) * 0.08
        dummy.position.z += Math.cos(i * 3.1) * 0.08
        const fade = Math.sin(p * Math.PI)
        dummy.scale.setScalar(0.015 * (fade * 0.7 + 0.3))
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.8} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Signatures</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">CALLDATAREAD</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">ACCEPT + Execution</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function MultisigAuth3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Multisig authentication flow showing Alice and Bob sending signatures to Frame 0 (Validate), which uses CALLDATAREAD to inspect Frame 1's calldata before firing ACCEPT and executing the transfer"
      srDescription="A 3D scene showing multisig authentication with Frame TXs. Alice and Bob (purple spheres) each emit signature cubes that travel along curved paths to Frame 0 (the validator vault). An amber CALLDATAREAD arc flows from Frame 0 toward Frame 1's calldata, showing the validation frame reading the execution frame's data. When both signatures verify, an ACCEPT flash ring expands outward, the vault lock flips from indigo to green, and a command beam with token particles streams to Frame 1 (Execute)."
      legend={<Legend />}
      fallbackText="Multisig authentication -- two signers verify independently, ACCEPT fires once both signatures check out"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5.5, 9], fov: 35 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* Signers */}
          <SignerSphere position={ALICE_POS} label="Alice" reducedMotion={reducedMotion} />
          <SignerSphere position={BOB_POS} label="Bob" reducedMotion={reducedMotion} />

          {/* Signature cubes */}
          <SignatureCube start={ALICE_POS} reducedMotion={reducedMotion} />
          <SignatureCube start={BOB_POS} reducedMotion={reducedMotion} />

          {/* Signature trail particles (Alice 16 + Bob 16) */}
          <SignatureTrail start={ALICE_POS} count={16} reducedMotion={reducedMotion} />
          <SignatureTrail start={BOB_POS} count={16} reducedMotion={reducedMotion} />

          {/* Validator vault + lock */}
          <ValidatorVault reducedMotion={reducedMotion} />
          <VaultLock reducedMotion={reducedMotion} />
          <VerificationLabels reducedMotion={reducedMotion} />

          {/* ACCEPT flash */}
          <AcceptFlashRing reducedMotion={reducedMotion} />
          <AcceptLabel reducedMotion={reducedMotion} />

          {/* Frame 1 calldata cube + CALLDATAREAD arc */}
          <CalldataCube />
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadLabel reducedMotion={reducedMotion} />
          <CalldatareadParticles count={12} reducedMotion={reducedMotion} />

          {/* USDC target */}
          <UsdcTarget reducedMotion={reducedMotion} />

          {/* Command beam + token stream */}
          <CommandBeam reducedMotion={reducedMotion} />
          <TokenStream count={20} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom minDistance={3} maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI * 0.22}
            maxPolarAngle={Math.PI * 0.305}
            minAzimuthAngle={-Math.PI / 5}
            maxAzimuthAngle={Math.PI / 5}
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
