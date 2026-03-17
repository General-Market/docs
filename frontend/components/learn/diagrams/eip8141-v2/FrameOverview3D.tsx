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

const LOOP = 9 // seconds

// Frame positions (X)
const F0_X = -2.5
const GATE_X = 0
const F1_X = 1.5
const F2_X = 3.5

// Colors
const PURPLE = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

function remap(t: number, a: number, b: number): number {
  return Math.max(0, Math.min(1, (t - a) / (b - a)))
}

function lerpColor(out: THREE.Color, from: THREE.Color, to: THREE.Color, t: number) {
  out.r = from.r + (to.r - from.r) * t
  out.g = from.g + (to.g - from.g) * t
  out.b = from.b + (to.b - from.b) * t
}

/* ------------------------------------------------------------------ */
/*  Corridor Walls (purple -> green at ACCEPT)                         */
/* ------------------------------------------------------------------ */

function CorridorWalls({ reducedMotion }: { reducedMotion: boolean }) {
  const leftWallRef = useRef<THREE.Mesh>(null!)
  const rightWallRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const purpleColor = useMemo(() => new THREE.Color(PURPLE), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Before ACCEPT (4.5s): purple. At 4.5-5s: transition. After 5s: green.
    // Reset at 8-9s back to purple for loop.
    let colorT = 0
    if (t < 4.5) {
      colorT = 0
    } else if (t < 5) {
      colorT = easeInOut(remap(t, 4.5, 5))
    } else if (t < 7.5) {
      colorT = 1
    } else {
      colorT = 1 - easeInOut(remap(t, 7.5, 8.5))
    }

    lerpColor(tempColor, purpleColor, greenColor, colorT)

    const applyColor = (mesh: THREE.Mesh) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.color.copy(tempColor)
    }

    applyColor(leftWallRef.current)
    applyColor(rightWallRef.current)
  })

  // Walls run the full corridor length
  const wallLength = F2_X + 0.75 - (F0_X - 0.75)
  const wallCenterX = (F0_X - 0.75 + F2_X + 0.75) / 2

  return (
    <group>
      {/* Left wall (negative Z) */}
      <mesh ref={leftWallRef} position={[wallCenterX, 0.5, -1.0]}>
        <boxGeometry args={[wallLength, 1.0, 0.04]} />
        <meshStandardMaterial color={PURPLE} transparent opacity={0.15} roughness={0.6} />
      </mesh>
      {/* Right wall (positive Z) */}
      <mesh ref={rightWallRef} position={[wallCenterX, 0.5, 1.0]}>
        <boxGeometry args={[wallLength, 1.0, 0.04]} />
        <meshStandardMaterial color={PURPLE} transparent opacity={0.15} roughness={0.6} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Floor                                                              */
/* ------------------------------------------------------------------ */

function Floor() {
  const wallLength = F2_X + 0.75 - (F0_X - 0.75)
  const wallCenterX = (F0_X - 0.75 + F2_X + 0.75) / 2

  return (
    <RoundedBox args={[wallLength, 0.04, 2.0]} radius={0.015} smoothness={4} position={[wallCenterX, 0, 0]}>
      <meshStandardMaterial color="#fafafa" roughness={0.7} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Containers                                                   */
/* ------------------------------------------------------------------ */

function FrameContainers() {
  return (
    <group>
      {/* Frame 0 (purple -- validation) */}
      <RoundedBox args={[1.3, 0.7, 1.2]} radius={0.05} smoothness={4} position={[F0_X, 0.4, 0]}>
        <meshStandardMaterial color={PURPLE} transparent opacity={0.18} roughness={0.5} />
      </RoundedBox>

      {/* Frame 1 */}
      <RoundedBox args={[1.3, 0.7, 1.2]} radius={0.05} smoothness={4} position={[F1_X, 0.4, 0]}>
        <meshStandardMaterial color={PURPLE} transparent opacity={0.12} roughness={0.5} />
      </RoundedBox>

      {/* Frame 2 */}
      <RoundedBox args={[1.3, 0.7, 1.2]} radius={0.05} smoothness={4} position={[F2_X, 0.4, 0]}>
        <meshStandardMaterial color={PURPLE} transparent opacity={0.12} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Gate (tallest element -- two pillars + arch)                 */
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

    // Gate pulses green at ACCEPT moment 4.5-5.5s
    const gatePulse = remap(t, 4.5, 5.5)
    const emissiveIntensity = gatePulse > 0 && gatePulse < 1
      ? Math.sin(gatePulse * Math.PI) * 1.0
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

  // Gate is the tallest element in the scene
  const pillarHeight = 1.2
  const pillarY = pillarHeight / 2

  return (
    <group position={[GATE_X, 0, 0]}>
      {/* Left pillar */}
      <mesh ref={leftPillarRef} position={[0, pillarY, -0.8]}>
        <boxGeometry args={[0.08, pillarHeight, 0.08]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
      {/* Right pillar */}
      <mesh ref={rightPillarRef} position={[0, pillarY, 0.8]}>
        <boxGeometry args={[0.08, pillarHeight, 0.08]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
      {/* Arch */}
      <mesh ref={archRef} position={[0, pillarHeight, 0]}>
        <boxGeometry args={[0.08, 0.08, 1.68]} />
        <meshStandardMaterial color={GREEN} roughness={0.4} />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Flash Ring (torus that expands at 4.5s)                     */
/* ------------------------------------------------------------------ */

function AcceptFlashRing({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Flash between 4.5-5.5s
    const flash = remap(t, 4.5, 5.5)

    if (flash > 0 && flash < 1) {
      ref.current.visible = true
      const scale = 0.3 + easeInOut(flash) * 1.8
      ref.current.scale.set(scale, scale, scale)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - flash) * 0.85
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
/*  Animated Data Cube                                                 */
/* ------------------------------------------------------------------ */

function AnimatedCube({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)
  const purpleColor = useMemo(() => new THREE.Color(PURPLE), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    const mat = ref.current.material as THREE.MeshStandardMaterial

    let x: number
    let y = 0.45
    let colorLerp = 0

    if (t < 1.5) {
      // Phase 1: 0-1.5s -- cube sits at Frame 0, purple
      x = F0_X
      y += Math.sin(t * 2.5) * 0.02
      colorLerp = 0
      ref.current.scale.set(1, 1, 1)
    } else if (t < 3.5) {
      // Phase 2: 1.5-3.5s -- cube stays at F0 while CALLDATAREAD arc fires
      x = F0_X
      y += Math.sin(t * 2) * 0.015
      colorLerp = 0
      ref.current.scale.set(1, 1, 1)
    } else if (t < 4.5) {
      // Phase 3: 3.5-4.5s -- cube slides from F0 toward gate
      const p = easeInOut(remap(t, 3.5, 4.5))
      x = F0_X + p * (GATE_X - F0_X)
      y += Math.sin(p * Math.PI) * 0.06
      colorLerp = 0
      ref.current.scale.set(1, 1, 1)
    } else if (t < 5) {
      // Phase 4: 4.5-5s -- ACCEPT fires, color transition purple->green
      const p = remap(t, 4.5, 5)
      x = GATE_X
      // Shaking during transition
      const shake = Math.sin(p * Math.PI * 6) * 0.015 * (1 - p)
      x += shake
      y += Math.sin(p * Math.PI) * 0.04
      colorLerp = easeInOut(p)
      // Scale pulse
      const scalePulse = 1 + Math.sin(p * Math.PI) * 0.2
      ref.current.scale.set(scalePulse, scalePulse, scalePulse)
    } else if (t < 7) {
      // Phase 5: 5-7s -- green cube slides through F1 and F2
      const p = easeInOut(remap(t, 5, 7))
      x = GATE_X + p * (F2_X + 0.3 - GATE_X)
      y += Math.sin(p * Math.PI) * 0.05
      colorLerp = 1
      ref.current.scale.set(1, 1, 1)
    } else {
      // Phase 6: 7-9s -- hold, then reset
      const p = remap(t, 7, 9)
      if (p < 0.5) {
        // Hold at F2
        x = F2_X + 0.3
        y += Math.sin(p * Math.PI * 2) * 0.01
        colorLerp = 1
      } else {
        // Fade and slide back
        const resetP = remap(p, 0.5, 1)
        x = (F2_X + 0.3) + easeInOut(resetP) * (F0_X - (F2_X + 0.3))
        colorLerp = 1 - easeInOut(resetP)
      }
      ref.current.scale.set(1, 1, 1)
    }

    ref.current.position.set(x, y, 0)

    // Color lerp purple -> green
    lerpColor(tempColor, purpleColor, greenColor, colorLerp)
    mat.color.copy(tempColor)

    // Emissive glow during ACCEPT transition (4.5-5s)
    if (t >= 4.5 && t < 5) {
      const p = remap(t, 4.5, 5)
      mat.emissive.copy(tempColor)
      mat.emissiveIntensity = Math.sin(p * Math.PI) * 0.7
    } else {
      mat.emissiveIntensity = 0.05
      mat.emissive.copy(tempColor)
    }
  })

  return (
    <RoundedBox ref={ref} args={[0.3, 0.3, 0.3]} radius={0.04} smoothness={4} position={[F0_X, 0.45, 0]}>
      <meshStandardMaterial color={PURPLE} roughness={0.4} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  CALLDATAREAD Arc (amber bezier FROM Frame 1 TO Frame 0)            */
/* ------------------------------------------------------------------ */

function CalldatareadArc({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  // Arc goes FROM Frame 1 TO Frame 0 (data flows toward Frame 0)
  const tubeGeo = useMemo(() => {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(F1_X, 0.85, 0),
      new THREE.Vector3((F0_X + F1_X) / 2, 1.5, 0),
      new THREE.Vector3(F0_X, 0.85, 0),
    )
    return new THREE.TubeGeometry(curve, 32, 0.005, 6, false)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    const mat = ref.current.material as THREE.MeshStandardMaterial

    // Visible 1.5-3.5s, fade out 3.5-4.5s
    if (t >= 1.5 && t < 3.5) {
      ref.current.visible = true
      const fadeIn = Math.min(1, remap(t, 1.5, 2.0))
      mat.opacity = fadeIn * 0.55
    } else if (t >= 3.5 && t < 4.5) {
      ref.current.visible = true
      const fadeOut = 1 - remap(t, 3.5, 4.5)
      mat.opacity = fadeOut * 0.55
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
/*  CALLDATAREAD Sparks (instanced, flow FROM Frame 1 TOWARD Frame 0)  */
/* ------------------------------------------------------------------ */

function CalldatareadSparks({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Curve goes FROM Frame 1 (start) TO Frame 0 (end) -- sparks travel this direction
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(F1_X, 0.85, 0),
    new THREE.Vector3((F0_X + F1_X) / 2, 1.5, 0),
    new THREE.Vector3(F0_X, 0.85, 0),
  ), [])

  const hidePos = useMemo(() => new THREE.Vector3(0, -10, 0), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Active 1.5-3.5s
    const active = t >= 1.5 && t < 3.5

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.position.copy(hidePos)
        dummy.scale.setScalar(0.001)
      } else {
        // Sparks travel along the curve from Frame 1 toward Frame 0
        const sparkT = (((t - 1.5) * 0.5) + i / count) % 1
        dummy.position.copy(curve.getPoint(sparkT))
        // Z wobble for sparkle
        dummy.position.z += Math.sin(t * 10 + i * 2.5) * 0.04
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
      <meshBasicMaterial color={AMBER} transparent opacity={0.75} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Flow Particles (trailing the cube)                                 */
/* ------------------------------------------------------------------ */

function FlowParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const purpleColor = useMemo(() => new THREE.Color(PURPLE), [])
  const greenColor = useMemo(() => new THREE.Color(GREEN), [])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const colorsArray = useMemo(() => new Float32Array(count * 3), [count])
  const colorsInitialized = useRef(false)

  const hidePos = useMemo(() => new THREE.Vector3(0, -10, 0), [])
  const cubeEndX = F2_X + 0.3

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // Particles active 3.5-7s (trailing behind cube during movement)
    const active = t >= 3.5 && t < 7.0

    for (let i = 0; i < count; i++) {
      if (!active) {
        dummy.position.copy(hidePos)
        dummy.scale.setScalar(0.001)
      } else {
        const delay = (i / count) * 0.4
        let particleT: number

        if (t < 4.5) {
          // F0 -> gate phase
          particleT = easeInOut(remap(t - delay, 3.5, 4.5))
          const x = F0_X + particleT * (GATE_X - F0_X)
          const y = 0.45 + Math.sin(particleT * Math.PI) * 0.05
          const z = Math.sin(i * 1.7 + t * 3) * 0.1
          dummy.position.set(x, y, z)
          lerpColor(tempColor, purpleColor, purpleColor, 0)
        } else {
          // Gate -> end phase
          particleT = easeInOut(remap(t - delay, 5, 7))
          const x = GATE_X + particleT * (cubeEndX - GATE_X)
          const y = 0.45 + Math.sin(particleT * Math.PI) * 0.04
          const z = Math.sin(i * 1.7 + t * 3) * 0.1
          dummy.position.set(x, y, z)
          lerpColor(tempColor, purpleColor, greenColor, x > GATE_X ? 1 : 0)
        }

        const scaleBase = Math.sin(particleT * Math.PI) * 0.5 + 0.5
        dummy.scale.setScalar(0.01 * scaleBase)

        colorsArray[i * 3] = tempColor.r
        colorsArray[i * 3 + 1] = tempColor.g
        colorsArray[i * 3 + 2] = tempColor.b
      }
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true

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
      <meshBasicMaterial vertexColors transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Labels (max 5 simultaneous)                                        */
/* ------------------------------------------------------------------ */

function Labels({ reducedMotion }: { reducedMotion: boolean }) {
  const frame0Ref = useRef<HTMLDivElement>(null!)
  const acceptRef = useRef<HTMLDivElement>(null!)
  const calldataRef = useRef<HTMLDivElement>(null!)
  const frame1Ref = useRef<HTMLDivElement>(null!)
  const frame2Ref = useRef<HTMLDivElement>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current % LOOP

    // "Frame 0" -- visible 0-4.5s
    if (frame0Ref.current) {
      frame0Ref.current.style.opacity = t < 4.5 ? '1' : '0'
    }

    // "reads Frame 1" -- visible 1.5-3.5s (CALLDATAREAD label)
    if (calldataRef.current) {
      calldataRef.current.style.opacity = (t >= 1.5 && t < 3.5) ? '1' : '0'
    }

    // "ACCEPT" -- always visible, pulses at 4.5-5.5s
    if (acceptRef.current) {
      if (t >= 4.5 && t < 5.5) {
        const p = remap(t, 4.5, 5.5)
        const pulse = (1 + Math.sin(p * Math.PI * 3)) / 2
        acceptRef.current.style.opacity = String(0.5 + pulse * 0.5)
        acceptRef.current.style.transform = `scale(${1 + Math.sin(p * Math.PI) * 0.25})`
      } else {
        acceptRef.current.style.opacity = '1'
        acceptRef.current.style.transform = 'scale(1)'
      }
    }

    // "Frame 1" -- visible 5-7s
    if (frame1Ref.current) {
      frame1Ref.current.style.opacity = (t >= 5 && t < 7) ? '1' : '0'
    }

    // "Frame 2" -- visible 5.5-7s
    if (frame2Ref.current) {
      frame2Ref.current.style.opacity = (t >= 5.5 && t < 7) ? '1' : '0'
    }
  })

  const labelStyle = { pointerEvents: 'none' as const, userSelect: 'none' as const }

  return (
    <group>
      {/* Frame 0 */}
      <Html center position={[F0_X, -0.2, 1.2]} style={labelStyle}>
        <div ref={frame0Ref}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: PURPLE }}>
            Frame 0
          </p>
        </div>
      </Html>

      {/* CALLDATAREAD: "reads Frame 1" */}
      <Html center position={[(F0_X + F1_X) / 2, 1.65, 0]} style={labelStyle}>
        <div ref={calldataRef} style={{ opacity: 0 }}>
          <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: AMBER }}>
            reads Frame 1
          </p>
        </div>
      </Html>

      {/* ACCEPT */}
      <Html center position={[GATE_X, 1.45, 0]} style={labelStyle}>
        <div ref={acceptRef}>
          <p className="text-[13px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
            ACCEPT
          </p>
        </div>
      </Html>

      {/* Frame 1 */}
      <Html center position={[F1_X, -0.2, 1.2]} style={labelStyle}>
        <div ref={frame1Ref} style={{ opacity: 0 }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: GREEN }}>
            Frame 1
          </p>
        </div>
      </Html>

      {/* Frame 2 */}
      <Html center position={[F2_X, -0.2, 1.2]} style={labelStyle}>
        <div ref={frame2Ref} style={{ opacity: 0 }}>
          <p className="text-[9px] font-mono whitespace-nowrap" style={{ color: GREEN }}>
            Frame 2
          </p>
        </div>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function FrameOverview3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="ACCEPT is the trust boundary. A data cube in Frame 0 reads Frame 1's calldata via an amber arc, then passes through the ACCEPT gate. Corridor walls shift from purple (untrusted) to green (committed)."
      srDescription="A 3D scene showing three frames arranged left to right: Frame 0, Frame 1, and Frame 2, connected by a corridor with walls. A purple data cube starts in Frame 0. An amber arc appears from Frame 1 to Frame 0, representing CALLDATAREAD -- Frame 0 reading Frame 1's calldata before deciding. Sparks travel along the arc from Frame 1 toward Frame 0. The CALLDATAREAD fades, then the cube approaches the ACCEPT gate at the center. When ACCEPT fires, a green torus ring expands, the gate flashes, and the corridor walls shift from purple to green. The cube turns green and slides through Frame 1 and Frame 2."
      legend={<SceneLegend items={[{ color: PURPLE, label: 'Untrusted / validation' }, { color: GREEN, label: 'Committed / execution' }, { color: AMBER, label: 'CALLDATAREAD' }]} />}
      fallbackText="Frame overview -- ACCEPT gate is the trust boundary. Purple corridor turns green after ACCEPT fires. Amber CALLDATAREAD arc reads Frame 1 before ACCEPT."
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 3, 7], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Static structure */}
          <Floor />
          <FrameContainers />
          <CorridorWalls reducedMotion={reducedMotion} />
          <AcceptGate reducedMotion={reducedMotion} />

          {/* Animated elements */}
          <AcceptFlashRing reducedMotion={reducedMotion} />
          <AnimatedCube reducedMotion={reducedMotion} />
          <CalldatareadArc reducedMotion={reducedMotion} />
          <CalldatareadSparks count={8} reducedMotion={reducedMotion} />
          <FlowParticles count={12} reducedMotion={reducedMotion} />

          {/* Labels */}
          <Labels reducedMotion={reducedMotion} />

          <AutoFitCamera points={[[-3.5, 2, 1.5], [4.5, 2, 1.5], [-3.5, -0.5, -1.5], [4.5, -0.5, -1.5]]} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.5}
            autoRotate={false}
            enableDamping
            dampingFactor={0.05}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
