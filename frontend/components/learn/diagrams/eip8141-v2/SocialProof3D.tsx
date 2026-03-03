'use client'

import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from '../scaling/SceneContainer'
import { ContextDisposer } from '../scaling/shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CYCLE = 10

const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const BLUE = '#3b82f6'

const AUTHORITY_RADIUS = 2.0
const ADOPTION_RADIUS = 3.2

const AUTHORITY_ITEMS = ['Vitalik', 'EF Core', '10 years']
const ADOPTION_ITEMS = ['Safe', 'ZeroDev', 'Biconomy', 'Ambire', 'L2s']

/* ------------------------------------------------------------------ */
/*  Utility                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function rangeT(cycleT: number, start: number, end: number): number {
  if (cycleT < start) return 0
  if (cycleT >= end) return 1
  return easeInOut((cycleT - start) / (end - start))
}

/* ------------------------------------------------------------------ */
/*  Platform                                                           */
/* ------------------------------------------------------------------ */

function Platform() {
  return (
    <group position={[0, -0.05, 0]}>
      {/* Shadow */}
      <RoundedBox args={[8.4, 0.02, 8.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      {/* Platform disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[4.0, 64]} />
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </mesh>
      {/* Subtle ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[3.9, 4.0, 64]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Central Ethereum Diamond (Octahedron)                              */
/* ------------------------------------------------------------------ */

function EthDiamond({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0-0.2
    const fadeIn = rangeT(cycleT, 0, 0.2)
    meshRef.current.scale.setScalar(0.01 + fadeIn * 0.99)
    meshRef.current.visible = fadeIn > 0.01

    // Gentle rotation
    if (!reducedMotion) {
      meshRef.current.rotation.y += delta * 0.3
    }

    // Green pulse 0.9-1.0
    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    const pulse = cycleT > 0.9 ? Math.sin((cycleT - 0.9) / 0.1 * Math.PI) * 0.3 : 0
    mat.emissiveIntensity = 0.1 + pulse
  })

  return (
    <mesh ref={meshRef} position={[0, 0.6, 0]}>
      <octahedronGeometry args={[0.4, 0]} />
      <meshStandardMaterial
        color={BLUE}
        roughness={0.3}
        metalness={0.2}
        emissive={BLUE}
        emissiveIntensity={0.1}
        transparent
        opacity={0.85}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Authority Ring (inner orbit) — 3 Purple spheres                    */
/* ------------------------------------------------------------------ */

function AuthorityRing({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const sphereRefs = useRef<THREE.Mesh[]>([])
  const labelRefs = useRef<THREE.Group[]>([])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0.2-0.4
    const fadeIn = rangeT(cycleT, 0.2, 0.4)
    groupRef.current.visible = fadeIn > 0.01

    // Orbit
    const orbitAngle = reducedMotion ? 0 : elapsedRef.current * 0.25

    // Count visible labels for budget tracking
    let visibleLabelCount = 0

    for (let i = 0; i < 3; i++) {
      const angle = orbitAngle + (i * Math.PI * 2) / 3
      const x = Math.cos(angle) * AUTHORITY_RADIUS
      const z = Math.sin(angle) * ADOPTION_RADIUS * 0.4 // squish z for perspective

      const sphere = sphereRefs.current[i]
      if (sphere) {
        sphere.position.set(x, 0.5, z)
        sphere.scale.setScalar(fadeIn)

        // Green pulse 0.9-1.0
        const mat = sphere.material as THREE.MeshStandardMaterial
        const pulse = cycleT > 0.9 ? Math.sin((cycleT - 0.9) / 0.1 * Math.PI) * 0.25 : 0
        mat.emissiveIntensity = 0.05 + pulse
      }

      // Show label when sphere is nearest camera (positive z) and within label budget
      const label = labelRefs.current[i]
      if (label) {
        const isNearest = z > ADOPTION_RADIUS * 0.25
        const shouldShow = fadeIn > 0.5 && isNearest && visibleLabelCount < 2
        label.visible = reducedMotion ? (fadeIn > 0.5 && i === 0) : shouldShow
        if (label.visible) visibleLabelCount++
        label.position.set(x, 0.9, z)
      }
    }
  })

  return (
    <group ref={groupRef}>
      {AUTHORITY_ITEMS.map((name, i) => (
        <group key={name}>
          <mesh
            ref={(el) => { if (el) sphereRefs.current[i] = el }}
          >
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshStandardMaterial
              color={PURPLE}
              roughness={0.4}
              emissive={GREEN}
              emissiveIntensity={0.05}
            />
          </mesh>
          <group
            ref={(el) => { if (el) labelRefs.current[i] = el }}
          >
            <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className="bg-white/90 border border-purple-200 rounded px-2 py-0.5">
                <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: PURPLE }}>
                  {name}
                </p>
              </div>
            </Html>
          </group>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Adoption Ring (outer orbit) — 5 Green spheres, opposite direction  */
/* ------------------------------------------------------------------ */

function AdoptionRing({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const sphereRefs = useRef<THREE.Mesh[]>([])
  const labelRefs = useRef<THREE.Group[]>([])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0.4-0.6
    const fadeIn = rangeT(cycleT, 0.4, 0.6)
    groupRef.current.visible = fadeIn > 0.01

    // Orbit (opposite direction)
    const orbitAngle = reducedMotion ? 0 : -elapsedRef.current * 0.18

    let visibleLabelCount = 0

    for (let i = 0; i < 5; i++) {
      const angle = orbitAngle + (i * Math.PI * 2) / 5
      const x = Math.cos(angle) * ADOPTION_RADIUS
      const z = Math.sin(angle) * ADOPTION_RADIUS * 0.35

      const sphere = sphereRefs.current[i]
      if (sphere) {
        sphere.position.set(x, 0.4, z)
        sphere.scale.setScalar(fadeIn)

        const mat = sphere.material as THREE.MeshStandardMaterial
        const pulse = cycleT > 0.9 ? Math.sin((cycleT - 0.9) / 0.1 * Math.PI) * 0.3 : 0
        mat.emissiveIntensity = 0.05 + pulse
      }

      const label = labelRefs.current[i]
      if (label) {
        const isNearest = z > ADOPTION_RADIUS * 0.2
        const shouldShow = fadeIn > 0.5 && isNearest && visibleLabelCount < 2
        label.visible = reducedMotion ? (fadeIn > 0.5 && i === 0) : shouldShow
        if (label.visible) visibleLabelCount++
        label.position.set(x, 0.75, z)
      }
    }
  })

  return (
    <group ref={groupRef}>
      {ADOPTION_ITEMS.map((name, i) => (
        <group key={name}>
          <mesh
            ref={(el) => { if (el) sphereRefs.current[i] = el }}
          >
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial
              color={GREEN}
              roughness={0.4}
              emissive={GREEN}
              emissiveIntensity={0.05}
            />
          </mesh>
          <group
            ref={(el) => { if (el) labelRefs.current[i] = el }}
          >
            <Html center style={{ pointerEvents: 'none', userSelect: 'none' }}>
              <div className="bg-white/90 border border-green-200 rounded px-1.5 py-0.5">
                <p className="text-[8px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
                  {name}
                </p>
              </div>
            </Html>
          </group>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Scale Bars (right side)                                            */
/* ------------------------------------------------------------------ */

const SCALE_BARS = [
  { label: '500M+ wallets', color: BLUE, height: 1.0, y: 0.5 },
  { label: '~$200B TVL', color: AMBER, height: 0.7, y: 1.35 },
  { label: 'Every dApp', color: GREEN, height: 0.4, y: 1.9 },
] as const

function ScaleBars({ reducedMotion }: { reducedMotion: boolean }) {
  const barRefs = useRef<THREE.Group[]>([])
  const labelRefs = useRef<THREE.Group[]>([])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    for (let i = 0; i < SCALE_BARS.length; i++) {
      const bar = barRefs.current[i]
      const label = labelRefs.current[i]
      if (!bar) continue

      // Stagger growth: each bar starts 0.05 after the previous
      const barStart = 0.6 + i * 0.05
      const barEnd = barStart + 0.15
      const grow = reducedMotion ? (cycleT > barStart ? 1 : 0) : rangeT(cycleT, barStart, barEnd)

      bar.scale.y = Math.max(grow, 0.001)
      bar.visible = grow > 0.01

      if (label) {
        label.visible = grow > 0.7
      }
    }
  })

  return (
    <group position={[5.0, 0, -0.5]}>
      {SCALE_BARS.map((item, i) => (
        <group key={item.label}>
          <group
            ref={(el) => { if (el) barRefs.current[i] = el }}
            position={[0, item.y, 0]}
          >
            <RoundedBox args={[0.6, item.height, 0.6]} radius={0.04} smoothness={4}>
              <meshStandardMaterial
                color={item.color}
                roughness={0.5}
                emissive={item.color}
                emissiveIntensity={0.1}
                transparent
                opacity={0.7}
              />
            </RoundedBox>
          </group>
          <group
            ref={(el) => { if (el) labelRefs.current[i] = el }}
            visible={false}
          >
            <Html
              center
              position={[0, item.y + item.height / 2 + 0.25, 0]}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              <div className="bg-white/90 border rounded px-1.5 py-0.5" style={{ borderColor: item.color + '40' }}>
                <p className="text-[8px] font-bold font-mono whitespace-nowrap" style={{ color: item.color }}>
                  {item.label}
                </p>
              </div>
            </Html>
          </group>
        </group>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Connection Tube (single cylinder stretched between two points)     */
/* ------------------------------------------------------------------ */

const _center = new THREE.Vector3(0, 0.6, 0)
const _from = new THREE.Vector3()
const _mid = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _quat = new THREE.Quaternion()

function positionTube(
  mesh: THREE.Mesh,
  fromX: number,
  fromY: number,
  fromZ: number,
) {
  _from.set(fromX, fromY, fromZ)
  _mid.addVectors(_from, _center).multiplyScalar(0.5)
  _dir.subVectors(_center, _from)
  const len = _dir.length()
  _dir.normalize()

  mesh.position.copy(_mid)
  mesh.scale.set(1, len, 1)
  _quat.setFromUnitVectors(_up, _dir)
  mesh.quaternion.copy(_quat)
}

function ConnectionTubes({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const tubeRefs = useRef<THREE.Mesh[]>([])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Fade in 0.8-0.9
    const fadeIn = rangeT(cycleT, 0.8, 0.9)
    groupRef.current.visible = fadeIn > 0.01

    // Green pulse 0.9-1.0
    const pulse = cycleT > 0.9 ? Math.sin((cycleT - 0.9) / 0.1 * Math.PI) * 0.3 : 0

    const orbitAngle = reducedMotion ? 0 : elapsedRef.current * 0.25
    const reverseOrbitAngle = reducedMotion ? 0 : -elapsedRef.current * 0.18

    let idx = 0

    // Authority connections (3 tubes)
    for (let i = 0; i < 3; i++) {
      const angle = orbitAngle + (i * Math.PI * 2) / 3
      const x = Math.cos(angle) * AUTHORITY_RADIUS
      const z = Math.sin(angle) * ADOPTION_RADIUS * 0.4

      const tube = tubeRefs.current[idx]
      if (tube) {
        positionTube(tube, x, 0.5, z)
        const mat = tube.material as THREE.MeshStandardMaterial
        mat.opacity = fadeIn * 0.35
        mat.emissiveIntensity = 0.1 + pulse * 0.4
      }
      idx++
    }

    // Adoption connections (5 tubes)
    for (let i = 0; i < 5; i++) {
      const angle = reverseOrbitAngle + (i * Math.PI * 2) / 5
      const x = Math.cos(angle) * ADOPTION_RADIUS
      const z = Math.sin(angle) * ADOPTION_RADIUS * 0.35

      const tube = tubeRefs.current[idx]
      if (tube) {
        positionTube(tube, x, 0.4, z)
        const mat = tube.material as THREE.MeshStandardMaterial
        mat.opacity = fadeIn * 0.25
        mat.emissiveIntensity = 0.1 + pulse * 0.4
      }
      idx++
    }
  })

  const totalTubes = 3 + 5

  return (
    <group ref={groupRef}>
      {Array.from({ length: totalTubes }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => { if (el) tubeRefs.current[i] = el }}
        >
          <cylinderGeometry args={[0.012, 0.012, 1, 6]} />
          <meshStandardMaterial
            color={i < 3 ? PURPLE : GREEN}
            emissive={GREEN}
            emissiveIntensity={0.1}
            transparent
            opacity={0}
            roughness={0.4}
          />
        </mesh>
      ))}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Final Glow Pulse (0.9-1.0)                                        */
/* ------------------------------------------------------------------ */

function FinalGlow({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    const inRange = cycleT > 0.9
    const glowProgress = inRange ? (cycleT - 0.9) / 0.1 : 0
    const opacity = inRange ? 0.08 * Math.sin(glowProgress * Math.PI) : 0

    const mat = meshRef.current.material as THREE.MeshStandardMaterial
    mat.opacity = opacity
    meshRef.current.visible = opacity > 0.005
  })

  return (
    <mesh ref={meshRef} position={[0, 0.5, 0]} visible={false}>
      <sphereGeometry args={[3.8, 32, 32]} />
      <meshStandardMaterial
        color={GREEN}
        transparent
        opacity={0}
        emissive={GREEN}
        emissiveIntensity={0.5}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Authority</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Adoption</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Ethereum</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Scale</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Scene Content (inside Canvas)                                 */
/* ------------------------------------------------------------------ */

function SceneContent({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <ContextDisposer />
      <color attach="background" args={['#ffffff']} />
      <ambientLight intensity={1.2} />
      <directionalLight position={[5, 10, 5]} intensity={1} />
      <directionalLight position={[-3, 6, -2]} intensity={0.3} />

      <Platform />
      <EthDiamond reducedMotion={reducedMotion} />
      <AuthorityRing reducedMotion={reducedMotion} />
      <AdoptionRing reducedMotion={reducedMotion} />
      <ScaleBars reducedMotion={reducedMotion} />
      <ConnectionTubes reducedMotion={reducedMotion} />
      <FinalGlow reducedMotion={reducedMotion} />

      <OrbitControls
        enableZoom
        minDistance={4}
        maxDistance={16}
        enablePan={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
        enableDamping
        dampingFactor={0.05}
      />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function SocialProof3D() {
  return (
    <SceneContainer
      height="h-[280px] md:h-[340px]"
      ariaLabel="Social proof for EIP-8141: authority, adoption, and ecosystem scale"
      srDescription="A 3D scene showing social proof for EIP-8141. A central blue Ethereum octahedron is orbited by three purple authority spheres (Vitalik, EF Core, 10 years of development) and five green adoption spheres (Safe, ZeroDev, Biconomy, Ambire, L2s). Scale bars on the right grow to show 500M+ wallets affected, ~$200B TVL, and every dApp. Connection lines converge on the center, visualizing how authority, adoption, and scale all point to EIP-8141."
      legend={<Legend />}
      fallbackText="EIP-8141 authored by Vitalik Buterin, backed by EF Core, adopted by Safe, ZeroDev, Biconomy, Ambire. Affects 500M+ wallets, ~$200B TVL, every dApp."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 4, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <SceneContent reducedMotion={reducedMotion} />
        </Canvas>
      )}
    </SceneContainer>
  )
}
