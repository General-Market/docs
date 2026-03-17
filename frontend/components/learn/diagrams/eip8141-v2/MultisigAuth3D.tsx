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

const CYCLE = 10 // seconds per animation loop

const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const BLUE = '#3b82f6'

const ALICE_POS = new THREE.Vector3(-4, 0.5, 1.5)
const BOB_POS = new THREE.Vector3(-4, 0.5, -1.5)
const VAULT_POS = new THREE.Vector3(0, 0.5, 0)
const USDC_POS = new THREE.Vector3(4.5, 0.5, 0)

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function cycleT(elapsed: number): number {
  return (elapsed % CYCLE) / CYCLE
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
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
/*  Signer Sphere (Alice / Bob)                                        */
/* ------------------------------------------------------------------ */

function SignerSphere({
  position,
  label,
  reducedMotion,
}: {
  position: THREE.Vector3
  label: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)
    // Breathe pulse 0-1s (t: 0-0.1)
    const breathe = t < 0.1 ? 1 + Math.sin(t * 10 * Math.PI * 2) * 0.08 : 1.0
    ref.current.scale.setScalar(breathe)
  })

  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={PURPLE}
          roughness={0.4}
          emissive={PURPLE}
          emissiveIntensity={0.15}
        />
      </mesh>
      <Html
        center
        position={[0, 0.65, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap"
          style={{ color: PURPLE }}
        >
          {label}
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Signature Beam (tube from signer to vault, animated draw-on)       */
/* ------------------------------------------------------------------ */

function SignatureBeam({
  start,
  reducedMotion,
}: {
  start: THREE.Vector3
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  // Full curve from signer to vault
  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (start.x + VAULT_POS.x) / 2,
      Math.max(start.y, VAULT_POS.y) + 1.2,
      (start.z + VAULT_POS.z) / 2,
    )
    return new THREE.QuadraticBezierCurve3(start, mid, VAULT_POS)
  }, [start])

  // Pre-compute 64 sample points for partial draw
  const samplePoints = useMemo(() => curve.getPoints(64), [curve])

  // Refs for the tube mesh and its geometry (we rebuild geometry each frame slice)
  const tubeRef = useRef<THREE.Mesh>(null!)
  const geoRef = useRef<THREE.TubeGeometry | null>(null)

  useFrame((_, delta) => {
    if (reducedMotion || !tubeRef.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Beam visible 1-3s (t: 0.1-0.3)
    if (t < 0.1 || t > 0.35) {
      tubeRef.current.visible = false
      return
    }

    tubeRef.current.visible = true

    // Draw-on: 0.1-0.3, hold: 0.3-0.35 (slight linger before CALLDATAREAD)
    let drawProgress: number
    if (t < 0.3) {
      drawProgress = easeInOut((t - 0.1) / 0.2)
    } else {
      drawProgress = 1
      // Fade out 0.3-0.35
      const mat = tubeRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 1 - (t - 0.3) / 0.05
    }

    // Build partial curve from sample points
    const endIndex = Math.max(2, Math.floor(drawProgress * 64))
    const partialPoints = samplePoints.slice(0, endIndex + 1)
    const partialCurve = new THREE.CatmullRomCurve3(partialPoints)

    // Dispose old geometry
    if (geoRef.current) geoRef.current.dispose()
    geoRef.current = new THREE.TubeGeometry(partialCurve, Math.max(4, endIndex), 0.035, 8, false)
    tubeRef.current.geometry = geoRef.current

    if (t < 0.3) {
      const mat = tubeRef.current.material as THREE.MeshStandardMaterial
      mat.opacity = 0.85
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={tubeRef} visible={false}>
        <tubeGeometry args={[curve, 32, 0.035, 8, false]} />
        <meshStandardMaterial
          color={PURPLE}
          emissive={PURPLE}
          emissiveIntensity={0.3}
          transparent
          opacity={0.85}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Hexagonal Vault (cylinder with 6 sides)                            */
/* ------------------------------------------------------------------ */

function HexVault({ reducedMotion }: { reducedMotion: boolean }) {
  const wireRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const colorRef = useRef(new THREE.Color('#e2e8f0'))

  useFrame((_, delta) => {
    if (!wireRef.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    const mat = wireRef.current.material as THREE.MeshBasicMaterial
    // After ACCEPT (4.5-5.5s -> t: 0.45-0.55), flash green, hold until 7s (0.7)
    if (t >= 0.45 && t < 0.7) {
      const g = Math.min(1, (t - 0.45) / 0.08)
      colorRef.current.set('#e2e8f0').lerp(new THREE.Color(GREEN), g)
      mat.color.copy(colorRef.current)
      mat.opacity = 0.2 + g * 0.15
    } else {
      mat.color.set('#e2e8f0')
      mat.opacity = 0.2
    }
  })

  return (
    <group position={[VAULT_POS.x, VAULT_POS.y, VAULT_POS.z]}>
      {/* Solid hexagonal cylinder */}
      <mesh rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 1.5, 6]} />
        <meshStandardMaterial
          color="#f8fafc"
          roughness={0.8}
          transparent
          opacity={0.3}
        />
      </mesh>
      {/* Wireframe hexagonal outline */}
      <mesh ref={wireRef} rotation={[0, Math.PI / 6, 0]}>
        <cylinderGeometry args={[1.15, 1.15, 1.55, 6]} />
        <meshBasicMaterial color="#e2e8f0" wireframe transparent opacity={0.2} />
      </mesh>
      {/* Label */}
      <Html
        center
        position={[0, 1.15, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center gap-0">
          <p
            className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap"
            style={{ color: BLUE }}
          >
            Frame 0
          </p>
          <p
            className="text-[8px] tracking-[0.05em] uppercase whitespace-nowrap"
            style={{ color: BLUE, opacity: 0.7 }}
          >
            Validate
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Vault Lock (cylinder + torus, rotates 180 deg on ACCEPT)           */
/* ------------------------------------------------------------------ */

function VaultLock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const bodyRef = useRef<THREE.Mesh>(null!)
  const ringRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const bodyColor = useRef(new THREE.Color(PURPLE))
  const ringColor = useRef(new THREE.Color(PURPLE))

  useFrame((_, delta) => {
    if (!groupRef.current || !bodyRef.current || !ringRef.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Lock position: front face of vault
    groupRef.current.position.set(VAULT_POS.x, VAULT_POS.y + 0.2, VAULT_POS.z + 1.18)

    // 4.5-5.5s (t: 0.45-0.55): 180 degree flip, purple -> green
    if (t >= 0.45 && t < 0.55) {
      const flip = (t - 0.45) / 0.1
      const eased = easeInOut(flip)
      groupRef.current.rotation.y = eased * Math.PI

      bodyColor.current.set(PURPLE).lerp(new THREE.Color(GREEN), eased)
      ringColor.current.set(PURPLE).lerp(new THREE.Color(GREEN), eased)

      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.copy(bodyColor.current)
      bodyMat.emissive.copy(bodyColor.current)
      bodyMat.emissiveIntensity = 0.2 + eased * 0.4

      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.copy(ringColor.current)
      ringMat.emissive.copy(ringColor.current)
      ringMat.emissiveIntensity = 0.2 + eased * 0.4
    } else if (t >= 0.55 && t < 0.8) {
      // Hold green
      groupRef.current.rotation.y = Math.PI
      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.set(GREEN)
      bodyMat.emissive.set(GREEN)
      bodyMat.emissiveIntensity = 0.5 + Math.sin((t - 0.55) * 20 * Math.PI) * 0.1
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.set(GREEN)
      ringMat.emissive.set(GREEN)
      ringMat.emissiveIntensity = 0.5 + Math.sin((t - 0.55) * 20 * Math.PI) * 0.1
    } else {
      // Reset to purple
      groupRef.current.rotation.y = 0
      const bodyMat = bodyRef.current.material as THREE.MeshStandardMaterial
      bodyMat.color.set(PURPLE)
      bodyMat.emissive.set(PURPLE)
      bodyMat.emissiveIntensity = 0.15
      const ringMat = ringRef.current.material as THREE.MeshStandardMaterial
      ringMat.color.set(PURPLE)
      ringMat.emissive.set(PURPLE)
      ringMat.emissiveIntensity = 0.15
    }
  })

  return (
    <group ref={groupRef}>
      {/* Lock body */}
      <mesh ref={bodyRef} position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.25, 16]} />
        <meshStandardMaterial
          color={PURPLE}
          emissive={PURPLE}
          emissiveIntensity={0.15}
          roughness={0.3}
        />
      </mesh>
      {/* Lock ring */}
      <mesh ref={ringRef} position={[0, 0.08, 0]}>
        <torusGeometry args={[0.18, 0.04, 12, 24]} />
        <meshStandardMaterial
          color={PURPLE}
          emissive={PURPLE}
          emissiveIntensity={0.15}
          roughness={0.3}
        />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Flash Ring (torus expansion at vault)                       */
/* ------------------------------------------------------------------ */

function AcceptFlashRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Flash at 4.5-5.5s (t: 0.45-0.55)
    if (t >= 0.45 && t < 0.55) {
      const progress = (t - 0.45) / 0.1
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
    <mesh
      ref={ref}
      position={[VAULT_POS.x, VAULT_POS.y, VAULT_POS.z]}
      rotation={[Math.PI / 2, 0, 0]}
      visible={false}
    >
      <torusGeometry args={[0.5, 0.06, 12, 48]} />
      <meshBasicMaterial
        color={GREEN}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Label (transient)                                           */
/* ------------------------------------------------------------------ */

function AcceptLabel() {
  const ref = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)
    if (ref.current) {
      // Show at 4.5-5.5s (t: 0.45-0.55), then fade
      if (t >= 0.45 && t < 0.7) {
        const pulse = t < 0.55 ? 1.0 : 0.8 + Math.sin((t - 0.55) * 30) * 0.2
        ref.current.style.opacity = String(pulse)
        ref.current.style.transform = t < 0.5 ? 'scale(1.15)' : 'scale(1)'
      } else {
        ref.current.style.opacity = '0'
      }
    }
  })

  return (
    <Html
      center
      position={[VAULT_POS.x, VAULT_POS.y + 1.4, VAULT_POS.z]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div ref={ref} style={{ opacity: 0, transition: 'opacity 0.15s' }}>
        <p
          className="text-[14px] font-bold font-mono whitespace-nowrap tracking-wide"
          style={{ color: GREEN }}
        >
          ACCEPT
        </p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber tube from Vault toward USDC)               */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const tubeRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (VAULT_POS.x + USDC_POS.x) / 2,
      Math.max(VAULT_POS.y, USDC_POS.y) + 1.4,
      0,
    )
    return new THREE.QuadraticBezierCurve3(VAULT_POS, mid, USDC_POS)
  }, [])

  const tubeGeo = useMemo(
    () => new THREE.TubeGeometry(curve, 32, 0.008, 6, false),
    [curve],
  )

  useFrame((_, delta) => {
    if (!tubeRef.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Visible 3-4.5s (t: 0.3-0.45)
    const mat = tubeRef.current.material as THREE.MeshStandardMaterial
    if (t >= 0.3 && t < 0.45) {
      const fadeIn = t < 0.33 ? (t - 0.3) / 0.03 : 1
      const fadeOut = t > 0.42 ? 1 - (t - 0.42) / 0.03 : 1
      mat.opacity = fadeIn * fadeOut * 0.6
      tubeRef.current.visible = true
    } else {
      tubeRef.current.visible = false
    }
  })

  return (
    <mesh ref={tubeRef} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial
        color={AMBER}
        transparent
        opacity={0}
        roughness={0.3}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Sparks (instanced, flow FROM USDC TOWARD Vault)       */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({
  count = 14,
  reducedMotion,
}: {
  count?: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Curve from USDC toward Vault (sparks travel back)
  const curve = useMemo(() => {
    const mid = new THREE.Vector3(
      (USDC_POS.x + VAULT_POS.x) / 2,
      Math.max(USDC_POS.y, VAULT_POS.y) + 1.4,
      0,
    )
    return new THREE.QuadraticBezierCurve3(USDC_POS, mid, VAULT_POS)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    for (let i = 0; i < count; i++) {
      // Visible 3-4.5s (t: 0.3-0.45)
      if (t < 0.3 || t > 0.45) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
      } else {
        const progress = (t - 0.3) / 0.15
        const p = (progress * 1.5 + i / count) % 1
        dummy.position.copy(curve.getPoint(p))
        // Slight scatter for visual interest
        dummy.position.y += Math.sin(i * 2.7) * 0.06
        dummy.position.z += Math.cos(i * 3.1) * 0.06
        const fade = Math.sin(p * Math.PI)
        dummy.scale.setScalar(0.012 * (fade * 0.8 + 0.2))
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
/*  USDC Target (Frame 1 / Execute)                                    */
/* ------------------------------------------------------------------ */

function UsdcTarget({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Pulse when receiving execution beam: 5.5-7s (t: 0.55-0.7)
    if (t >= 0.6 && t < 0.7) {
      const pulse = 1 + Math.sin((t - 0.6) * 60) * 0.05
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
      <Html
        center
        position={[0, 0.8, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div className="flex flex-col items-center gap-0">
          <p
            className="text-[10px] tracking-[0.1em] uppercase font-bold whitespace-nowrap"
            style={{ color: BLUE }}
          >
            Frame 1
          </p>
          <p
            className="text-[8px] tracking-[0.05em] uppercase whitespace-nowrap"
            style={{ color: BLUE, opacity: 0.7 }}
          >
            Execute
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Execution Beam (green tube from Vault to USDC, grows on ACCEPT)    */
/* ------------------------------------------------------------------ */

function ExecutionBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)

    // Beam grows 5.5-7s (t: 0.55-0.7)
    if (t >= 0.55 && t < 0.7) {
      const grow = (t - 0.55) / 0.15
      const eased = easeInOut(grow)

      const startX = VAULT_POS.x + 1.2
      const endX = USDC_POS.x - 0.8
      const totalLen = endX - startX
      const currentLen = eased * totalLen

      ref.current.position.set(startX + currentLen / 2, VAULT_POS.y, 0)
      ref.current.scale.set(1, 1, currentLen > 0.01 ? currentLen : 0.01)
      ref.current.visible = true

      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.7 + Math.sin(t * 40) * 0.15
    } else if (t >= 0.7 && t < 0.8) {
      // Hold then fade
      const fade = 1 - (t - 0.7) / 0.1
      const startX = VAULT_POS.x + 1.2
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
    <mesh
      ref={ref}
      rotation={[0, Math.PI / 2, 0]}
      visible={false}
    >
      <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Token Particles (instanced, flow Vault -> USDC during execution)   */
/* ------------------------------------------------------------------ */

function TokenParticles({
  count = 18,
  reducedMotion,
}: {
  count?: number
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => {
    const start = new THREE.Vector3(VAULT_POS.x + 1.2, VAULT_POS.y, 0)
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
    const t = cycleT(elapsedRef.current)

    for (let i = 0; i < count; i++) {
      // Visible 5.5-7s (t: 0.55-0.7)
      if (t < 0.55 || t > 0.75) {
        dummy.position.set(0, -100, 0)
        dummy.scale.setScalar(0)
      } else {
        const stream = (t - 0.55) / 0.2
        const p = (stream * 2 + i / count) % 1
        dummy.position.copy(curve.getPoint(p))
        dummy.position.y += Math.sin(i * 2.7) * 0.07
        dummy.position.z += Math.cos(i * 3.1) * 0.07
        const fade = Math.sin(p * Math.PI)
        dummy.scale.setScalar(0.014 * (fade * 0.7 + 0.3))
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
/*  Verified Label (transient, appears at vault 7-8s)                  */
/* ------------------------------------------------------------------ */

function VerifiedLabel() {
  const ref = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const t = cycleT(elapsedRef.current)
    if (ref.current) {
      // Show 7-8s (t: 0.7-0.8)
      if (t >= 0.7 && t < 0.8) {
        const fadeIn = t < 0.72 ? (t - 0.7) / 0.02 : 1
        const fadeOut = t > 0.77 ? 1 - (t - 0.77) / 0.03 : 1
        ref.current.style.opacity = String(fadeIn * fadeOut)
      } else {
        ref.current.style.opacity = '0'
      }
    }
  })

  return (
    <Html
      center
      position={[VAULT_POS.x, VAULT_POS.y + 1.4, VAULT_POS.z]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div ref={ref} style={{ opacity: 0, transition: 'opacity 0.1s' }}>
        <p
          className="text-[11px] font-bold font-mono whitespace-nowrap tracking-wide"
          style={{ color: GREEN }}
        >
          Verified
        </p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function MultisigAuth3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Multisig authentication: two signers converge on a validator vault, which inspects calldata via CALLDATAREAD before authorizing execution with ACCEPT"
      srDescription="A 3D scene showing multisig authentication with EIP-8141 Frame TXs. Alice and Bob (purple spheres on the left) each emit purple signature beams that converge on a central hexagonal vault (Frame 0 / Validate). An amber arc reaches from the vault toward a blue box (Frame 1 / Execute) representing CALLDATAREAD inspection, with amber sparks flowing back from Frame 1 to the vault. The vault lock rotates 180 degrees and turns green as ACCEPT fires. A green execution beam and token particles then stream from the vault to Frame 1."
      legend={<SceneLegend items={[{ color: PURPLE, label: 'Signatures' }, { color: AMBER, label: 'CALLDATAREAD' }, { color: GREEN, label: 'ACCEPT / Execution' }]} />}
      fallbackText="Multisig authentication: two signers verify independently, vault inspects calldata, ACCEPT fires, execution proceeds"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 3, 8], fov: 34 }}
          dpr={[1, 2]}
          gl={{ antialias: true }}
        >
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platform */}
          <Platform />

          {/* Signers */}
          <SignerSphere
            position={ALICE_POS}
            label="Alice"
            reducedMotion={reducedMotion}
          />
          <SignerSphere
            position={BOB_POS}
            label="Bob"
            reducedMotion={reducedMotion}
          />

          {/* Signature beams (tubes from signers to vault) */}
          <SignatureBeam start={ALICE_POS} reducedMotion={reducedMotion} />
          <SignatureBeam start={BOB_POS} reducedMotion={reducedMotion} />

          {/* Hexagonal vault + lock */}
          <HexVault reducedMotion={reducedMotion} />
          <VaultLock reducedMotion={reducedMotion} />

          {/* ACCEPT flash ring + label */}
          <AcceptFlashRing reducedMotion={reducedMotion} />
          <AcceptLabel />

          {/* CALLDATAREAD arc + sparks (amber, from vault toward USDC) */}
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={14} reducedMotion={reducedMotion} />

          {/* Frame 1 / Execute target */}
          <UsdcTarget reducedMotion={reducedMotion} />

          {/* Execution beam + token particles (green, vault -> USDC) */}
          <ExecutionBeam reducedMotion={reducedMotion} />
          <TokenParticles count={18} reducedMotion={reducedMotion} />

          {/* Verified label (transient, 7-8s) */}
          <VerifiedLabel />

          <AutoFitCamera points={[[-5, 2, 2], [5.5, 2, 2], [-5, -0.5, -2], [5.5, -0.5, -2]]} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            autoRotate={false}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
