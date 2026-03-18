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

const LOOP = 10 // seconds

// Frame positions (X)
const F0_X = -2.5
const F1_X = 2.0
const F2_X = 4.2
const GATE_X = 0

// Zone boundaries
const UNTRUSTED_X = -2.5
const TRUSTED_X = 2.5

// Cube travel path keyframes (x positions)
const CUBE_START_X = F0_X
const CUBE_END_X = F2_X + 0.3

// Colors
const RED = '#ef4444'
const GREEN = '#22c55e'
const BLUE = '#3b82f6'
const AMBER = '#f59e0b'
const PURPLE = '#8b5cf6'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Smooth ease in-out */
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/** Map [a,b] to [0,1] clamped */
function remap(t: number, a: number, b: number): number {
  return Math.max(0, Math.min(1, (t - a) / (b - a)))
}

/** Lerp THREE.Color */
function lerpColor(out: THREE.Color, from: THREE.Color, to: THREE.Color, t: number) {
  out.r = from.r + (to.r - from.r) * t
  out.g = from.g + (to.g - from.g) * t
  out.b = from.b + (to.b - from.b) * t
}

/* ------------------------------------------------------------------ */
/*  Envelope Wireframe                                                 */
/* ------------------------------------------------------------------ */

function Envelope() {
  return (
    <mesh position={[0, 0.8, 0]}>
      <boxGeometry args={[9, 2, 3]} />
      <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.12} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Floor + Zone Tints                                                 */
/* ------------------------------------------------------------------ */

function Floor() {
  return (
    <group>
      {/* Base floor */}
      <RoundedBox args={[9, 0.04, 3]} radius={0.015} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>

      {/* Untrusted zone tint (red) */}
      <mesh position={[UNTRUSTED_X, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.5, 2.5]} />
        <meshBasicMaterial color="#fef2f2" transparent opacity={0.4} />
      </mesh>

      {/* Trusted zone tint (green) */}
      <mesh position={[TRUSTED_X, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.5, 2.5]} />
        <meshBasicMaterial color="#f0fdf4" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Containers                                                   */
/* ------------------------------------------------------------------ */

function FrameContainers() {
  return (
    <group>
      {/* Frame 0 -- auth frame (purple) */}
      <RoundedBox args={[1.5, 0.8, 1.2]} radius={0.05} smoothness={4} position={[F0_X, 0.5, 0]}>
        <meshStandardMaterial color={PURPLE} transparent opacity={0.2} roughness={0.5} />
      </RoundedBox>

      {/* Frame 1 (blue) */}
      <RoundedBox args={[1.5, 0.8, 1.2]} radius={0.05} smoothness={4} position={[F1_X, 0.5, 0]}>
        <meshStandardMaterial color={BLUE} transparent opacity={0.2} roughness={0.5} />
      </RoundedBox>

      {/* Frame 2 (blue) */}
      <RoundedBox args={[1.5, 0.8, 1.2]} radius={0.05} smoothness={4} position={[F2_X, 0.5, 0]}>
        <meshStandardMaterial color={BLUE} transparent opacity={0.2} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Gate (2 Pillars + Arch)                                     */
/* ------------------------------------------------------------------ */

function AcceptGate({ reducedMotion }: { reducedMotion: boolean }) {
  const leftPillarRef = useRef<THREE.Mesh>(null!)
  const rightPillarRef = useRef<THREE.Mesh>(null!)
  const archRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const greenColor = useMemo(() => new THREE.Color(GREEN), [])

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Gate pulses green between 3-4.5s
    const gatePulse = remap(t, 3, 4.5)
    const emissiveIntensity = gatePulse > 0 && gatePulse < 1
      ? Math.sin(gatePulse * Math.PI) * 0.8
      : 0.1

    const applyPulse = (mesh: THREE.Mesh) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissive.copy(greenColor)
      mat.emissiveIntensity = emissiveIntensity
    }

    applyPulse(leftPillarRef.current)
    applyPulse(rightPillarRef.current)
    applyPulse(archRef.current)
  })

  return (
    <group position={[GATE_X, 0, 0]}>
      {/* Left pillar */}
      <mesh ref={leftPillarRef} position={[0, 0.35, -0.8]}>
        <boxGeometry args={[0.07, 0.7, 0.07]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
      {/* Right pillar */}
      <mesh ref={rightPillarRef} position={[0, 0.35, 0.8]}>
        <boxGeometry args={[0.07, 0.7, 0.07]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
      {/* Arch */}
      <mesh ref={archRef} position={[0, 0.7, 0]}>
        <boxGeometry args={[0.07, 0.07, 1.7]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Flash Ring (TorusGeometry that expands at gate moment)      */
/* ------------------------------------------------------------------ */

function AcceptFlashRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Flash between 3s and 4.5s
    const flash = remap(t, 3, 4.5)

    if (flash > 0 && flash < 1) {
      ref.current.visible = true
      const scale = 0.3 + easeInOut(flash) * 1.5
      ref.current.scale.set(scale, scale, scale)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - flash) * 0.8
    } else {
      ref.current.visible = false
    }
  })

  return (
    <mesh ref={ref} position={[GATE_X, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
      <torusGeometry args={[0.5, 0.04, 8, 32]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Animated Cube (red -> green transition at gate)                    */
/* ------------------------------------------------------------------ */

function AnimatedCube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const redColor = useMemo(() => new THREE.Color(RED), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    const mat = ref.current.material as THREE.MeshStandardMaterial

    // Phase 1: 0-1.5s -- cube sits at F0
    // Phase 2: 1.5-3s -- cube slides from F0 toward gate
    // Phase 3: 3-4.5s -- cube at gate, color transitions red->green
    // Phase 4: 4.5-6.5s -- green cube slides through F1 to F2
    // Phase 5: 6.5-8s -- hold at end
    // Phase 6: 8-10s -- gentle bob, then reset

    let x: number
    let y = 0.5
    let colorLerp = 0

    if (t < 1.5) {
      // Sitting at F0
      x = CUBE_START_X
      const bob = Math.sin(t * 2.5) * 0.02
      y += bob
      colorLerp = 0
    } else if (t < 3) {
      // Slide from F0 to gate
      const p = easeInOut(remap(t, 1.5, 3))
      x = CUBE_START_X + p * (GATE_X - CUBE_START_X)
      y += Math.sin(p * Math.PI) * 0.08
      colorLerp = 0
    } else if (t < 4.5) {
      // At gate -- color transition
      const p = remap(t, 3, 4.5)
      x = GATE_X
      // Dramatic shaking effect during transition
      const shake = Math.sin(p * Math.PI * 8) * 0.02 * (1 - p)
      x += shake
      y += Math.sin(p * Math.PI) * 0.06
      // Dramatic color transition with overshoot
      colorLerp = easeInOut(p)
      // Scale pulse during transition
      const scalePulse = 1 + Math.sin(p * Math.PI) * 0.25
      ref.current.scale.set(scalePulse, scalePulse, scalePulse)
    } else if (t < 6.5) {
      // Green cube slides through F1 to F2
      const p = easeInOut(remap(t, 4.5, 6.5))
      x = GATE_X + p * (CUBE_END_X - GATE_X)
      y += Math.sin(p * Math.PI) * 0.06
      colorLerp = 1
      ref.current.scale.set(1, 1, 1)
    } else if (t < 8) {
      // Hold at end
      x = CUBE_END_X
      const bob = Math.sin((t - 6.5) * 2) * 0.015
      y += bob
      colorLerp = 1
      ref.current.scale.set(1, 1, 1)
    } else {
      // Gentle bob and fade, then reset
      const p = remap(t, 8, 10)
      x = CUBE_END_X
      const bob = Math.sin(p * Math.PI * 2) * 0.02
      y += bob
      colorLerp = 1 - easeInOut(p)

      // Slide back at end of loop
      if (p > 0.7) {
        const resetP = remap(p, 0.7, 1)
        x = CUBE_END_X + easeInOut(resetP) * (CUBE_START_X - CUBE_END_X)
      }

      ref.current.scale.set(1, 1, 1)
    }

    ref.current.position.set(x, y, 0)

    // Color lerp
    lerpColor(tempColor, redColor, greenColor, colorLerp)
    mat.color.copy(tempColor)

    // Emissive glow during transition (3-4.5s)
    if (t >= 3 && t < 4.5) {
      const p = remap(t, 3, 4.5)
      mat.emissive.copy(tempColor)
      mat.emissiveIntensity = Math.sin(p * Math.PI) * 0.6
    } else {
      mat.emissiveIntensity = 0.05
      mat.emissive.copy(tempColor)
    }
  })

  return (
    <RoundedBox ref={ref} args={[0.35, 0.35, 0.35]} radius={0.04} smoothness={4} position={[CUBE_START_X, 0.5, 0]}>
      <meshStandardMaterial color={RED} roughness={0.4} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber bezier from F0 to F1)                      */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(F0_X, 0.95, 0),
      new THREE.Vector3((F0_X + F1_X) / 2, 1.6, 0),
      new THREE.Vector3(F1_X, 0.95, 0),
    )
    return new THREE.TubeGeometry(curve, 32, 0.006, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    const mat = ref.current.material as THREE.MeshStandardMaterial

    // Visible 1.5-4.5s, then fade
    if (t >= 1.5 && t < 4.5) {
      ref.current.visible = true
      const fadeIn = Math.min(1, remap(t, 1.5, 2.0))
      mat.opacity = fadeIn * 0.5
    } else if (t >= 4.5 && t < 5.5) {
      ref.current.visible = true
      const fadeOut = 1 - remap(t, 4.5, 5.5)
      mat.opacity = fadeOut * 0.5
    } else {
      ref.current.visible = false
    }
  })

  return (
    <mesh ref={ref} geometry={tubeGeo} visible={false}>
      <meshStandardMaterial color={AMBER} transparent opacity={0} roughness={0.3} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Spark Particles (8 instanced on arc)                  */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(F0_X, 0.95, 0),
    new THREE.Vector3((F0_X + F1_X) / 2, 1.6, 0),
    new THREE.Vector3(F1_X, 0.95, 0),
  ), [])

  // Hide position for when sparks aren't active
  const hidePos = useMemo(() => new THREE.Vector3(0, -10, 0), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    const active = t >= 1.5 && t < 5.0

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.position.copy(hidePos)
        dummy.scale.setScalar(0.001)
      } else {
        const sparkT = (t * 0.35 + i / count) % 1
        dummy.position.copy(curve.getPoint(sparkT))
        // Add some z-axis wobble for sparkle effect
        dummy.position.z += Math.sin(t * 12 + i * 2.5) * 0.04
        const scaleBase = Math.sin(sparkT * Math.PI) * 0.6 + 0.4
        dummy.scale.setScalar(0.008 * scaleBase)
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
/*  Flow Particles (16 instanced along cube travel path)               */
/* ------------------------------------------------------------------ */

function FlowParticles({ count = 16, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const redColor = useMemo(() => new THREE.Color(RED), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const colorsArray = useMemo(() => new Float32Array(count * 3), [count])
  const colorsInitialized = useRef(false)

  const hidePos = useMemo(() => new THREE.Vector3(0, -10, 0), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Particles active from 1.5s to 6.5s (trailing behind cube)
    const active = t >= 1.5 && t < 7.0

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.position.copy(hidePos)
        dummy.scale.setScalar(0.001)
      } else {
        // Each particle is offset along the path, trailing the cube
        const delay = (i / count) * 0.5
        const particleT = remap(t - delay, 1.5, 6.5)
        const p = easeInOut(Math.max(0, Math.min(1, particleT)))

        const x = CUBE_START_X + p * (CUBE_END_X - CUBE_START_X)
        const y = 0.5 + Math.sin(p * Math.PI) * 0.06
        // Spread particles slightly in z
        const z = Math.sin(i * 1.7 + t * 3) * 0.12

        dummy.position.set(x, y, z)
        const scaleBase = Math.sin(p * Math.PI) * 0.5 + 0.5
        dummy.scale.setScalar(0.012 * scaleBase)

        // Color: red in untrusted zone, green in trusted zone
        const isGreen = x > GATE_X
        lerpColor(tempColor, redColor, greenColor, isGreen ? 1 : 0)
        colorsArray[i * 3] = tempColor.r
        colorsArray[i * 3 + 1] = tempColor.g
        colorsArray[i * 3 + 2] = tempColor.b
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true

    // Update vertex colors
    if (!colorsInitialized.current) {
      ref.current.geometry.setAttribute('color', new THREE.InstancedBufferAttribute(colorsArray, 3))
      colorsInitialized.current = true
    } else {
      const attr = ref.current.geometry.getAttribute('color') as THREE.InstancedBufferAttribute
      attr.array.set(colorsArray)
      attr.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial vertexColors transparent opacity={0.6} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Html Labels (max 5 on screen, time-gated)                          */
/* ------------------------------------------------------------------ */

function Labels({ reducedMotion }: { reducedMotion: boolean }) {
  const untrustedRef = useRef<HTMLDivElement>(null!)
  const trustedRef = useRef<HTMLDivElement>(null!)
  const acceptRef = useRef<HTMLDivElement>(null!)
  const frame0Ref = useRef<HTMLDivElement>(null!)
  const calldataRef = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // "UNTRUSTED" and "TRUSTED" always visible
    if (untrustedRef.current) untrustedRef.current.style.opacity = '1'
    if (trustedRef.current) trustedRef.current.style.opacity = '1'

    // "ACCEPT" always visible but pulses at 3-4.5s
    if (acceptRef.current) {
      const pulse = (t >= 3 && t < 4.5) ? (1 + Math.sin(remap(t, 3, 4.5) * Math.PI * 3)) / 2 : 1
      acceptRef.current.style.opacity = String(pulse)
      acceptRef.current.style.transform = (t >= 3 && t < 4.5)
        ? `scale(${1 + Math.sin(remap(t, 3, 4.5) * Math.PI) * 0.2})`
        : 'scale(1)'
    }

    // "Frame 0: validate" visible 1.5-3s
    if (frame0Ref.current) {
      const vis = (t >= 1.5 && t < 3.5) ? 1 : 0
      frame0Ref.current.style.opacity = String(vis)
    }

    // "CALLDATAREAD" visible 1.5-3.5s
    if (calldataRef.current) {
      const vis = (t >= 1.5 && t < 3.5) ? 1 : 0
      calldataRef.current.style.opacity = String(vis)
    }
  })

  const labelStyle = { pointerEvents: 'none' as const, userSelect: 'none' as const }

  return (
    <group>
      {/* UNTRUSTED */}
      <Html center position={[UNTRUSTED_X, 1.5, 0]} style={labelStyle}>
        <div ref={untrustedRef}>
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: RED }}>
            Untrusted
          </p>
        </div>
      </Html>

      {/* TRUSTED */}
      <Html center position={[TRUSTED_X, 1.5, 0]} style={labelStyle}>
        <div ref={trustedRef}>
          <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: GREEN }}>
            Trusted
          </p>
        </div>
      </Html>

      {/* ACCEPT */}
      <Html center position={[GATE_X, 1.0, 0]} style={labelStyle}>
        <div ref={acceptRef}>
          <p className="text-[13px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            ACCEPT
          </p>
        </div>
      </Html>

      {/* Frame 0: validate */}
      <Html center position={[F0_X, -0.2, 1.5]} style={labelStyle}>
        <div ref={frame0Ref} style={{ opacity: 0 }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: PURPLE }}>
            Frame 0: validate
          </p>
        </div>
      </Html>

      {/* CALLDATAREAD */}
      <Html center position={[(F0_X + F1_X) / 2, 1.7, 0]} style={labelStyle}>
        <div ref={calldataRef} style={{ opacity: 0 }}>
          <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: AMBER }}>
            CALLDATAREAD
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Untrusted (before ACCEPT)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Trusted (after ACCEPT)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: AMBER }} />
        <span className="text-[10px] text-text-muted tracking-wide">CALLDATAREAD</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function FrameOverview3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="An envelope wireframe containing 3 frame containers with an ACCEPT gate in the middle. A cube transitions from red (untrusted) to green (trusted) as it passes through the gate."
      srDescription="A 3D scene showing a Frame Transaction envelope containing three frames. The left side is the untrusted zone tinted red, the right side is the trusted zone tinted green. An ACCEPT gate stands in the middle with two green pillars and an arch. A data cube starts red at Frame 0, slides toward the ACCEPT gate, transitions dramatically from red to green at the gate with a flash ring effect, then continues through Frame 1 and Frame 2. An amber CALLDATAREAD arc connects Frame 0 to Frame 1 with traveling spark particles."
      legend={<Legend />}
      fallbackText="Frame overview -- envelope with 3 frames, ACCEPT gate transitions untrusted (red) to trusted (green)"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Static structure */}
          <Envelope />
          <Floor />
          <FrameContainers />
          <AcceptGate reducedMotion={reducedMotion} />

          {/* Animated elements */}
          <AcceptFlashRing reducedMotion={reducedMotion} />
          <AnimatedCube reducedMotion={reducedMotion} />
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={8} reducedMotion={reducedMotion} />
          <FlowParticles count={16} reducedMotion={reducedMotion} />

          {/* Labels */}
          <Labels reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom minDistance={3} maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
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
