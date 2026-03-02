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

const LEFT_X = -3.5 // center of Normal TX side
const RIGHT_X = 3.5 // center of Frame TX side
const CYCLE = 8 // 8-second animation loop

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#ef4444'
const PURPLE = '#8b5cf6'

/* ------------------------------------------------------------------ */
/*  Utility: smooth ease in-out                                        */
/* ------------------------------------------------------------------ */

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
}

/* ------------------------------------------------------------------ */
/*  Left Platform (Normal TX)                                          */
/* ------------------------------------------------------------------ */

function LeftPlatform() {
  return (
    <group position={[LEFT_X, 0, 0]}>
      <RoundedBox args={[4.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[4.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Normal TX
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Right Platform (Frame TX)                                          */
/* ------------------------------------------------------------------ */

function RightPlatform() {
  return (
    <group position={[RIGHT_X, 0, 0]}>
      <RoundedBox args={[5.4, 0.02, 3.4]} radius={0.008} smoothness={4} position={[0, 0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[5.0, 0.06, 3.0]} radius={0.02} smoothness={4} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#fafafa" roughness={0.7} />
      </RoundedBox>
      <Html center position={[0, 1.8, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[11px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: BLUE }}>
          Frame TX
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Divider                                                            */
/* ------------------------------------------------------------------ */

function Divider() {
  return (
    <RoundedBox args={[0.02, 0.2, 3.0]} radius={0.004} smoothness={4} position={[0, 0.1, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  ECDSA Padlock (left side)                                          */
/* ------------------------------------------------------------------ */

function ECDSAPadlock({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !groupRef.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    // Gentle hover
    groupRef.current.position.y = 0.2 + Math.sin(t * 1.5) * 0.02
  })

  return (
    <group ref={groupRef} position={[LEFT_X, 0.2, 0.8]}>
      {/* Lock body */}
      <RoundedBox args={[0.22, 0.18, 0.08]} radius={0.02} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={PURPLE} roughness={0.4} />
      </RoundedBox>
      {/* Lock shackle (torus arc) */}
      <mesh position={[0, 0.12, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial color={PURPLE} roughness={0.3} />
      </mesh>
      <Html center position={[0, -0.2, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: PURPLE }}>ECDSA</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Data Cube + Slide Animation                              */
/* ------------------------------------------------------------------ */

function NormalTXCube({ reducedMotion }: { reducedMotion: boolean }) {
  const cubeRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  // Path: start at [0, 0.5, 0.2] relative to LEFT_X, slide to [0, 0.3, -1.5]
  const startZ = 0.2
  const endZ = -1.5

  useFrame((_, delta) => {
    if (reducedMotion || !cubeRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE // 0-1

    // 0-0.25 (0-2s): cube at start, glowing
    // 0.25-0.5 (2-4s): cube slides down to execute endpoint
    // 0.5-1.0 (4-8s): cube at endpoint, then resets
    let progress: number
    if (cycleT < 0.15) {
      progress = 0
    } else if (cycleT < 0.4) {
      progress = easeInOut((cycleT - 0.15) / 0.25)
    } else if (cycleT < 0.9) {
      progress = 1
    } else {
      // Quick reset
      progress = 1 - easeInOut((cycleT - 0.9) / 0.1)
    }

    const z = startZ + (endZ - startZ) * progress
    const y = 0.45 + Math.sin(progress * Math.PI) * 0.12
    cubeRef.current.position.set(LEFT_X, y, z)
    // Gentle rotation
    cubeRef.current.rotation.y = progress * Math.PI * 0.5
  })

  return (
    <group ref={cubeRef} position={[LEFT_X, 0.45, startZ]}>
      <RoundedBox args={[0.4, 0.4, 0.4]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={BLUE} roughness={0.5} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Arrow Rail                                               */
/* ------------------------------------------------------------------ */

function NormalTXRail() {
  const tubeGeo = useMemo(() => {
    const curve = new THREE.LineCurve3(
      new THREE.Vector3(LEFT_X, 0.12, 0.5),
      new THREE.Vector3(LEFT_X, 0.12, -1.5),
    )
    return new THREE.TubeGeometry(curve, 16, 0.015, 6, false)
  }, [])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Execute Endpoint                                         */
/* ------------------------------------------------------------------ */

function ExecuteEndpoint({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Pulse when cube arrives (0.35-0.5)
    const pulse = cycleT > 0.35 && cycleT < 0.6
      ? 1.0 + Math.sin((cycleT - 0.35) / 0.25 * Math.PI * 4) * 0.08
      : 1.0
    ref.current.scale.setScalar(pulse)
  })

  return (
    <group position={[LEFT_X, 0.2, -1.7]}>
      <RoundedBox ref={ref} args={[0.3, 0.3, 0.3]} radius={0.04} smoothness={4}>
        <meshStandardMaterial color={GREEN} roughness={0.5} emissive={GREEN} emissiveIntensity={0.15} />
      </RoundedBox>
      <Html center position={[0, -0.3, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono font-bold whitespace-nowrap" style={{ color: GREEN }}>execute</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Flow Particles (along the rail)                          */
/* ------------------------------------------------------------------ */

function NormalFlowParticles({ count = 8, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const curve = useMemo(() => new THREE.LineCurve3(
    new THREE.Vector3(LEFT_X, 0.14, 0.5),
    new THREE.Vector3(LEFT_X, 0.14, -1.5),
  ), [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.15 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += 0.02
      dummy.scale.setScalar(0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={BLUE} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Normal TX Labels (animated)                                        */
/* ------------------------------------------------------------------ */

function NormalTXLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Show label 0-0.5 (0-4s)
    const visible = cycleT < 0.55
    ref.current.visible = reducedMotion || visible
  })

  return (
    <group ref={ref}>
      <Html center position={[LEFT_X, -0.1, 1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: '#71717a' }}>
          1 sender<br />1 signature<br />1 action
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Envelope (wireframe)                                      */
/* ------------------------------------------------------------------ */

function FrameEnvelope({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !meshRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Subtle pulse
    const opacity = 0.12 + Math.sin(cycleT * Math.PI * 2) * 0.04
    const mat = meshRef.current.material as THREE.MeshBasicMaterial
    mat.opacity = opacity
  })

  return (
    <mesh ref={meshRef} position={[RIGHT_X, 0.7, 0]}>
      <boxGeometry args={[4.8, 1.5, 2.5]} />
      <meshBasicMaterial color={BLUE} wireframe transparent opacity={0.12} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame Containers (F0, F1, F2)                                      */
/* ------------------------------------------------------------------ */

function FrameContainer({
  position,
  color,
  label,
  sublabel,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  label: string
  sublabel: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Scale in during 0.25-0.35 (2-2.8s)
    let scale: number
    if (cycleT < 0.2) {
      scale = 0.3
    } else if (cycleT < 0.35) {
      scale = 0.3 + 0.7 * easeInOut((cycleT - 0.2) / 0.15)
    } else if (cycleT < 0.9) {
      scale = 1
    } else {
      scale = 1 - 0.7 * easeInOut((cycleT - 0.9) / 0.1)
    }
    ref.current.scale.setScalar(scale)
  })

  return (
    <group ref={ref} position={position}>
      <RoundedBox args={[1.0, 0.8, 1.0]} radius={0.06} smoothness={4}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.22}
          roughness={0.7}
        />
      </RoundedBox>
      {/* Edges for visibility */}
      <mesh>
        <boxGeometry args={[1.02, 0.82, 1.02]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
      </mesh>
      <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color }}>{label}</p>
      </Html>
      <Html center position={[0, -0.6, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono whitespace-nowrap" style={{ color: '#71717a' }}>{sublabel}</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  ACCEPT Gate (between F0 and F1)                                    */
/* ------------------------------------------------------------------ */

function AcceptGate({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const leftPillarRef = useRef<THREE.Mesh>(null!)
  const rightPillarRef = useRef<THREE.Mesh>(null!)
  const archRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  const gateX = RIGHT_X - 0.85 // between F0 at RIGHT_X-1.7 and F1 at RIGHT_X

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Gate flashes green at 0.5-0.625 (4-5s) when data cube passes through
    const flash = cycleT > 0.5 && cycleT < 0.625
    const emissiveIntensity = flash
      ? 0.4 + Math.sin((cycleT - 0.5) / 0.125 * Math.PI * 3) * 0.3
      : 0.08

    const updateMat = (mesh: THREE.Mesh | null) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = emissiveIntensity
    }

    updateMat(leftPillarRef.current)
    updateMat(rightPillarRef.current)
    updateMat(archRef.current)
  })

  return (
    <group ref={groupRef} position={[gateX, 0.08, 0]}>
      {/* Left pillar */}
      <RoundedBox
        ref={leftPillarRef}
        args={[0.06, 0.7, 0.06]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.35, -0.55]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.08} />
      </RoundedBox>
      {/* Right pillar */}
      <RoundedBox
        ref={rightPillarRef}
        args={[0.06, 0.7, 0.06]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.35, 0.55]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.08} />
      </RoundedBox>
      {/* Arch */}
      <RoundedBox
        ref={archRef}
        args={[0.06, 0.06, 1.16]}
        radius={0.01}
        smoothness={4}
        position={[0, 0.73, 0]}
      >
        <meshStandardMaterial color={GREEN} roughness={0.4} emissive={GREEN} emissiveIntensity={0.08} />
      </RoundedBox>
      {/* ACCEPT label */}
      <Html center position={[0, 0.95, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>ACCEPT</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  "No Sig" X mark at envelope bottom                                 */
/* ------------------------------------------------------------------ */

function NoSigMark() {
  return (
    <group position={[RIGHT_X, 0.12, 1.3]}>
      {/* Two crossed bars */}
      <RoundedBox args={[0.2, 0.03, 0.03]} radius={0.005} smoothness={4} rotation={[0, 0, Math.PI / 4]}>
        <meshStandardMaterial color={RED} roughness={0.4} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.03, 0.03]} radius={0.005} smoothness={4} rotation={[0, 0, -Math.PI / 4]}>
        <meshStandardMaterial color={RED} roughness={0.4} />
      </RoundedBox>
      <Html center position={[0.25, 0, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] font-mono font-bold whitespace-nowrap" style={{ color: RED }}>No sig</p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Data Cube (travels F0 -> ACCEPT gate -> F1 -> F2)         */
/* ------------------------------------------------------------------ */

function FrameDataCube({ reducedMotion }: { reducedMotion: boolean }) {
  const cubeRef = useRef<THREE.Group>(null!)
  const matRef = useRef<THREE.MeshStandardMaterial>(null!)
  const elapsedRef = useRef(0)

  // Waypoints relative to world coords:
  // F0 center = RIGHT_X - 1.7
  // ACCEPT gate = RIGHT_X - 0.85
  // F1 center = RIGHT_X
  // F2 center = RIGHT_X + 1.7
  const waypoints: [number, number, number][] = [
    [RIGHT_X - 1.7, 0.5, 0],   // Start inside F0
    [RIGHT_X - 0.85, 0.5, 0],  // At ACCEPT gate
    [RIGHT_X, 0.5, 0],          // Inside F1
    [RIGHT_X + 1.7, 0.5, 0],   // Inside F2
  ]

  useFrame((_, delta) => {
    if (reducedMotion || !cubeRef.current || !matRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE

    // Animation timeline:
    // 0.0-0.3: cube resting in F0 (visible, pulsing purple)
    // 0.3-0.5: cube moves from F0 to ACCEPT gate
    // 0.5-0.55: at gate, color transition red->green
    // 0.55-0.7: cube moves from gate to F1
    // 0.7-0.8: cube moves from F1 to F2
    // 0.8-0.9: resting in F2
    // 0.9-1.0: fade out & reset

    let pos: THREE.Vector3
    let colorLerp: number // 0 = red/purple, 1 = green
    let scale: number
    let visible = true

    if (cycleT < 0.3) {
      // Resting in F0
      pos = new THREE.Vector3(...waypoints[0])
      pos.y += Math.sin(cycleT * 20) * 0.02
      colorLerp = 0
      scale = 1
    } else if (cycleT < 0.5) {
      // F0 -> gate
      const t = easeInOut((cycleT - 0.3) / 0.2)
      pos = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(...waypoints[0]),
        new THREE.Vector3(...waypoints[1]),
        t,
      )
      pos.y += Math.sin(t * Math.PI) * 0.1
      colorLerp = 0
      scale = 1
    } else if (cycleT < 0.55) {
      // At gate - color transition
      const t = (cycleT - 0.5) / 0.05
      pos = new THREE.Vector3(...waypoints[1])
      colorLerp = t
      scale = 1.0 + Math.sin(t * Math.PI) * 0.15
    } else if (cycleT < 0.7) {
      // Gate -> F1
      const t = easeInOut((cycleT - 0.55) / 0.15)
      pos = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(...waypoints[1]),
        new THREE.Vector3(...waypoints[2]),
        t,
      )
      pos.y += Math.sin(t * Math.PI) * 0.08
      colorLerp = 1
      scale = 1
    } else if (cycleT < 0.8) {
      // F1 -> F2
      const t = easeInOut((cycleT - 0.7) / 0.1)
      pos = new THREE.Vector3().lerpVectors(
        new THREE.Vector3(...waypoints[2]),
        new THREE.Vector3(...waypoints[3]),
        t,
      )
      pos.y += Math.sin(t * Math.PI) * 0.06
      colorLerp = 1
      scale = 1
    } else if (cycleT < 0.9) {
      // Resting in F2
      pos = new THREE.Vector3(...waypoints[3])
      colorLerp = 1
      scale = 1
    } else {
      // Fade out
      const t = (cycleT - 0.9) / 0.1
      pos = new THREE.Vector3(...waypoints[3])
      colorLerp = 1
      scale = 1 - t
      if (t > 0.95) visible = false
    }

    cubeRef.current.position.copy(pos)
    cubeRef.current.scale.setScalar(Math.max(scale, 0.01))
    cubeRef.current.visible = visible
    cubeRef.current.rotation.y = cycleT * Math.PI * 2

    // Color: lerp from PURPLE (pre-ACCEPT) to GREEN (post-ACCEPT)
    const preColor = new THREE.Color(PURPLE)
    const postColor = new THREE.Color(GREEN)
    const currentColor = preColor.lerp(postColor, colorLerp)
    matRef.current.color.copy(currentColor)
    matRef.current.emissive.copy(currentColor)
    matRef.current.emissiveIntensity = 0.15 + colorLerp * 0.1
  })

  return (
    <group ref={cubeRef} position={[RIGHT_X - 1.7, 0.5, 0]}>
      <RoundedBox args={[0.28, 0.28, 0.28]} radius={0.04} smoothness={4}>
        <meshStandardMaterial ref={matRef} color={PURPLE} roughness={0.5} emissive={PURPLE} emissiveIntensity={0.15} />
      </RoundedBox>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Flow Particles (along F0 -> gate -> F1 -> F2 path)        */
/* ------------------------------------------------------------------ */

function FrameFlowParticles({ count = 12, reducedMotion }: { count?: number; reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const colorArray = useMemo(() => {
    const arr = new Float32Array(count * 3)
    return arr
  }, [count])
  const colorsSetRef = useRef(false)

  const curve = useMemo(() => {
    const points = [
      new THREE.Vector3(RIGHT_X - 1.7, 0.14, 0),
      new THREE.Vector3(RIGHT_X - 0.85, 0.14, 0),
      new THREE.Vector3(RIGHT_X, 0.14, 0),
      new THREE.Vector3(RIGHT_X + 1.7, 0.14, 0),
    ]
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2)
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion || !ref.current) return
    elapsedRef.current += delta
    const t = elapsedRef.current

    const preColor = new THREE.Color(PURPLE)
    const postColor = new THREE.Color(GREEN)
    const gateProgress = 0.33 // gate is at ~1/3 along the path

    for (let i = 0; i < count; i++) {
      const p = ((t * 0.12 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += 0.02
      dummy.scale.setScalar(0.012 * (Math.sin(p * Math.PI) * 0.6 + 0.4))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)

      // Color transitions at gate position
      const cl = p < gateProgress ? preColor : postColor
      colorArray[i * 3] = cl.r
      colorArray[i * 3 + 1] = cl.g
      colorArray[i * 3 + 2] = cl.b
    }

    ref.current.instanceMatrix.needsUpdate = true

    // Update instance colors
    if (!colorsSetRef.current) {
      ref.current.geometry.setAttribute(
        'color',
        new THREE.InstancedBufferAttribute(colorArray, 3),
      )
      colorsSetRef.current = true
    } else {
      const attr = ref.current.geometry.getAttribute('color') as THREE.InstancedBufferAttribute
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
/*  Frame TX Rail (tube along the frame path)                          */
/* ------------------------------------------------------------------ */

function FrameRail() {
  const tubeGeo = useMemo(() => {
    const points = [
      new THREE.Vector3(RIGHT_X - 1.9, 0.12, 0),
      new THREE.Vector3(RIGHT_X - 0.85, 0.12, 0),
      new THREE.Vector3(RIGHT_X, 0.12, 0),
      new THREE.Vector3(RIGHT_X + 1.9, 0.12, 0),
    ]
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.2)
    return new THREE.TubeGeometry(curve, 32, 0.012, 6, false)
  }, [])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color="#d4d4d8" roughness={0.4} />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Frame TX Labels (animated timing)                                  */
/* ------------------------------------------------------------------ */

function FrameTXLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const insideLabelRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!insideLabelRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // "Auth is INSIDE the TX" visible 0.5-0.9 (4-7.2s)
    insideLabelRef.current.visible = reducedMotion || (cycleT > 0.45 && cycleT < 0.9)
  })

  return (
    <>
      <group>
        <Html center position={[RIGHT_X, -0.1, 1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <p className="text-[9px] font-mono whitespace-nowrap text-center leading-tight" style={{ color: '#71717a' }}>
            N frames<br />0 sigs in envelope<br />auth via ACCEPT
          </p>
        </Html>
      </group>
      <group ref={insideLabelRef}>
        <Html center position={[RIGHT_X, -0.15, -1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[10px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              Auth is INSIDE the TX
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Path Labels (ECDSA -> execute vs validate -> ACCEPT -> execute)     */
/* ------------------------------------------------------------------ */

function PathLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const leftRef = useRef<THREE.Group>(null!)
  const rightRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!leftRef.current || !rightRef.current) return
    elapsedRef.current += delta
    const cycleT = (elapsedRef.current % CYCLE) / CYCLE
    // Show path labels 0.75-0.95 (6-7.6s)
    const visible = reducedMotion || (cycleT > 0.7 && cycleT < 0.95)
    leftRef.current.visible = visible
    rightRef.current.visible = visible
  })

  return (
    <>
      <group ref={leftRef}>
        <Html center position={[LEFT_X, -0.15, -1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-blue-200 rounded px-2 py-1">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: BLUE }}>
              ECDSA &rarr; execute
            </p>
          </div>
        </Html>
      </group>
      <group ref={rightRef}>
        <Html center position={[RIGHT_X, -0.35, -1.5]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div className="bg-white/90 border border-green-200 rounded px-2 py-1">
            <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: GREEN }}>
              validate &rarr; ACCEPT &rarr; execute
            </p>
          </div>
        </Html>
      </group>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Ambient Floating Particles (per side, for visual density)           */
/* ------------------------------------------------------------------ */

function AmbientParticles({
  centerX,
  count = 10,
  color,
  reducedMotion,
}: {
  centerX: number
  count?: number
  color: string
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Random offsets for each particle
  const offsets = useMemo(
    () =>
      Array.from({ length: count }, () => ({
        x: (Math.random() - 0.5) * 3,
        y: Math.random() * 1.2 + 0.2,
        z: (Math.random() - 0.5) * 2,
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
        centerX + o.x + Math.sin(t * o.speed + o.phase) * 0.15,
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
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: BLUE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Transaction data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Auth (sig / frame)</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">ACCEPT gate</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Exported Component                                            */
/* ------------------------------------------------------------------ */

export function NormalVsFrame3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Side-by-side comparison showing a normal Ethereum transaction on the left versus a Frame transaction on the right, demonstrating how EIP-8141 moves authentication inside the transaction via the ACCEPT opcode"
      srDescription="A 3D diorama comparing normal and Frame transactions. The left side shows a single data cube with an ECDSA padlock sliding along a rail to an execute endpoint. The right side shows a wireframe envelope containing three frame containers: F0 (purple, auth), F1 (blue, data), and F2 (blue, data). A data cube emerges from F0, passes through an ACCEPT gate that flashes green, then continues to F1 and F2. The key insight: normal transactions authenticate outside with a signature, while Frame transactions authenticate inside via the ACCEPT opcode."
      legend={<Legend />}
      fallbackText="Normal TX vs Frame TX -- authentication moves from outside the transaction to inside one of its frames via ACCEPT"
    >
      {({ reducedMotion }) => (
        <Canvas flat camera={{ position: [0, 5, 8], fov: 34 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <ContextDisposer />
          <color attach="background" args={['#ffffff']} />
          <ambientLight intensity={1.2} />
          <directionalLight position={[5, 10, 5]} intensity={1} />
          <directionalLight position={[-3, 6, -2]} intensity={0.3} />

          {/* Platforms */}
          <LeftPlatform />
          <RightPlatform />
          <Divider />

          {/* ------ LEFT: Normal TX ------ */}
          <NormalTXRail />
          <ECDSAPadlock reducedMotion={reducedMotion} />
          <NormalTXCube reducedMotion={reducedMotion} />
          <ExecuteEndpoint reducedMotion={reducedMotion} />
          <NormalFlowParticles count={8} reducedMotion={reducedMotion} />
          <NormalTXLabels reducedMotion={reducedMotion} />

          {/* ------ RIGHT: Frame TX ------ */}
          <FrameEnvelope reducedMotion={reducedMotion} />
          <FrameRail />
          <FrameContainer
            position={[RIGHT_X - 1.7, 0.5, 0]}
            color={PURPLE}
            label="F0"
            sublabel="auth"
            reducedMotion={reducedMotion}
          />
          <FrameContainer
            position={[RIGHT_X, 0.5, 0]}
            color={BLUE}
            label="F1"
            sublabel="data"
            reducedMotion={reducedMotion}
          />
          <FrameContainer
            position={[RIGHT_X + 1.7, 0.5, 0]}
            color={BLUE}
            label="F2"
            sublabel="data"
            reducedMotion={reducedMotion}
          />
          <AcceptGate reducedMotion={reducedMotion} />
          <NoSigMark />
          <FrameDataCube reducedMotion={reducedMotion} />
          <FrameFlowParticles count={12} reducedMotion={reducedMotion} />
          <FrameTXLabels reducedMotion={reducedMotion} />

          {/* ------ Path comparison labels ------ */}
          <PathLabels reducedMotion={reducedMotion} />

          {/* ------ Ambient particles for density ------ */}
          <AmbientParticles centerX={LEFT_X} count={6} color={BLUE} reducedMotion={reducedMotion} />
          <AmbientParticles centerX={RIGHT_X} count={8} color={BLUE} reducedMotion={reducedMotion} />

          <OrbitControls
            enableZoom
            minDistance={3}
            maxDistance={18}
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
