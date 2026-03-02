'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* -- Seeded PRNG -- */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/* -- Constants -- */

const LEFT_X = -1.6
const RIGHT_X = 1.6

// Grey tones for mixed cubes (NOT red -- unstructured, not broken)
const GREY_TONES = ['#a1a1aa', '#d4d4d8', '#71717a']

// EOF section layout (local Y offsets inside the EOF container)
const HEADER_Y = 0.55
const CODE1_Y = 0.25
const CODE2_Y = -0.1
const DATA_Y = -0.4

// Section divider Y positions (between sections)
const DIVIDER_YS = [0.4, 0.075, -0.25]

/* -- Mixed Content Cubes (left side -- chaotic tumble) -- */

const MIXED_CUBE_COUNT = 60

function MixedCubes({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Pre-compute per-cube random state with seeded PRNG
  const cubeData = useMemo(() => {
    const data = []
    for (let i = 0; i < MIXED_CUBE_COUNT; i++) {
      data.push({
        px: (seededRandom(i * 13 + 1) - 0.5) * 1.1,
        py: (seededRandom(i * 17 + 2) - 0.5) * 0.85,
        pz: (seededRandom(i * 19 + 3) - 0.5) * 0.65,
        rx: (seededRandom(i * 23 + 4) - 0.5) * 2.0,
        ry: (seededRandom(i * 29 + 5) - 0.5) * 2.0,
        rz: (seededRandom(i * 31 + 6) - 0.5) * 2.0,
        dx: (seededRandom(i * 37 + 7) - 0.5) * 0.15,
        dy: (seededRandom(i * 41 + 8) - 0.5) * 0.15,
        dz: (seededRandom(i * 43 + 9) - 0.5) * 0.1,
        phase: seededRandom(i * 47 + 10) * Math.PI * 2,
      })
    }
    return data
  }, [])

  // Pre-compute instance colors (random grey tones)
  const colors = useMemo(() => {
    const arr = new Float32Array(MIXED_CUBE_COUNT * 3)
    const c = new THREE.Color()
    for (let i = 0; i < MIXED_CUBE_COUNT; i++) {
      c.set(GREY_TONES[i % GREY_TONES.length])
      arr[i * 3] = c.r
      arr[i * 3 + 1] = c.g
      arr[i * 3 + 2] = c.b
    }
    return arr
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current

    for (let i = 0; i < MIXED_CUBE_COUNT; i++) {
      const d = cubeData[i]

      const px = d.px + Math.sin(t * 0.5 + d.phase) * d.dx
      const py = d.py + Math.cos(t * 0.4 + d.phase) * d.dy
      const pz = d.pz + Math.sin(t * 0.3 + d.phase + 1) * d.dz

      dummy.position.set(
        Math.max(-0.6, Math.min(0.6, px)),
        Math.max(-0.45, Math.min(0.45, py)),
        Math.max(-0.35, Math.min(0.35, pz)),
      )
      dummy.rotation.set(
        t * d.rx,
        t * d.ry,
        t * d.rz,
      )
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true

    // Set instance colors once
    if (!ref.current.userData.colorsSet) {
      ref.current.instanceColor = new THREE.InstancedBufferAttribute(colors, 3)
      ref.current.userData.colorsSet = true
    }
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, MIXED_CUBE_COUNT]}>
      <boxGeometry args={[0.12, 0.12, 0.12]} />
      <meshStandardMaterial vertexColors roughness={0.6} />
    </instancedMesh>
  )
}

/* -- Entropy Particles (left side -- analysis failures) -- */

const ENTROPY_COUNT = 20

function EntropyParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const particleData = useMemo(() => {
    const data = []
    for (let i = 0; i < ENTROPY_COUNT; i++) {
      data.push({
        px: (seededRandom(i * 53 + 11) - 0.5) * 1.2,
        py: (seededRandom(i * 59 + 12) - 0.5) * 0.9,
        pz: (seededRandom(i * 61 + 13) - 0.5) * 0.7,
        speed: 0.3 + seededRandom(i * 67 + 14) * 0.5,
        phase: seededRandom(i * 71 + 15) * Math.PI * 2,
        axis: seededRandom(i * 73 + 16) * Math.PI * 2,
      })
    }
    return data
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current

    for (let i = 0; i < ENTROPY_COUNT; i++) {
      const d = particleData[i]
      dummy.position.set(
        d.px + Math.sin(t * d.speed + d.phase) * 0.2,
        d.py + Math.cos(t * d.speed * 0.8 + d.phase) * 0.15,
        d.pz + Math.sin(t * d.speed * 0.6 + d.axis) * 0.1,
      )
      dummy.scale.setScalar(0.008)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, ENTROPY_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#ef4444" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* -- Organized Code Cubes (right side -- static grid in code sections) -- */

const CODE_CUBE_COUNT = 35

function CodeCubes() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const positions = useMemo(() => {
    const pos: [number, number, number][] = []
    const sectionYs = [CODE1_Y, CODE2_Y]
    const cubesPerSection = [18, 17]

    for (let s = 0; s < 2; s++) {
      const baseY = sectionYs[s]
      const count = cubesPerSection[s]
      const cols = 6
      const rows = Math.ceil(count / cols)

      for (let i = 0; i < count; i++) {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = (col - (cols - 1) / 2) * 0.18
        const y = baseY + (row - (rows - 1) / 2) * 0.12
        const z = 0
        pos.push([x, y, z])
      }
    }
    return pos
  }, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh || mesh.userData.initialized) return
    for (let i = 0; i < CODE_CUBE_COUNT; i++) {
      const [x, y, z] = positions[i]
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.userData.initialized = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, CODE_CUBE_COUNT]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color="#3b82f6" roughness={0.5} />
    </instancedMesh>
  )
}

/* -- Organized Data Cubes (right side -- static grid in data section) -- */

const DATA_CUBE_COUNT = 18

function DataCubes() {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const positions = useMemo(() => {
    const pos: [number, number, number][] = []
    const cols = 6
    const rows = Math.ceil(DATA_CUBE_COUNT / cols)

    for (let i = 0; i < DATA_CUBE_COUNT; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = (col - (cols - 1) / 2) * 0.18
      const y = DATA_Y + (row - (rows - 1) / 2) * 0.12
      pos.push([x, y, 0])
    }
    return pos
  }, [])

  useFrame(() => {
    const mesh = ref.current
    if (!mesh || mesh.userData.initialized) return
    for (let i = 0; i < DATA_CUBE_COUNT; i++) {
      const [x, y, z] = positions[i]
      dummy.position.set(x, y, z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.userData.initialized = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DATA_CUBE_COUNT]}>
      <boxGeometry args={[0.1, 0.1, 0.1]} />
      <meshStandardMaterial color="#6366f1" roughness={0.5} />
    </instancedMesh>
  )
}

/* -- Order Particles (right side -- successful analysis, calm orbit) -- */

const ORDER_COUNT = 20

function OrderParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const particleData = useMemo(() => {
    const data = []
    for (let i = 0; i < ORDER_COUNT; i++) {
      data.push({
        radius: 0.6 + seededRandom(i * 79 + 17) * 0.3,
        yBase: (seededRandom(i * 83 + 18) - 0.5) * 1.4,
        phase: (i / ORDER_COUNT) * Math.PI * 2,
        speed: 0.2 + seededRandom(i * 89 + 19) * 0.15,
      })
    }
    return data
  }, [])

  useFrame((_, delta) => {
    if (!ref.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current

    for (let i = 0; i < ORDER_COUNT; i++) {
      const d = particleData[i]
      const angle = t * d.speed + d.phase
      dummy.position.set(
        Math.cos(angle) * d.radius,
        d.yBase + Math.sin(t * 0.3 + d.phase) * 0.05,
        Math.sin(angle) * d.radius,
      )
      dummy.scale.setScalar(0.008)
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, ORDER_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* -- Analysis Beam + Section Flash + Gas Meter -- */

const SWEEP_DURATION = 3.0
const PAUSE_DURATION = 1.0

const BEAM_TOP_Y = 0.7
const BEAM_BOT_Y = -0.6

const SECTIONS = [
  { y: HEADER_Y, height: 0.15, color: new THREE.Color('#22c55e'), name: 'header' },
  { y: CODE1_Y, height: 0.3, color: new THREE.Color('#3b82f6'), name: 'code1' },
  { y: CODE2_Y, height: 0.3, color: new THREE.Color('#3b82f6'), name: 'code2' },
  { y: DATA_Y, height: 0.25, color: new THREE.Color('#6366f1'), name: 'data' },
] as const

function AnalysisBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const beamRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!beamRef.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current
    const cycle = SWEEP_DURATION + PAUSE_DURATION
    const phase = t % cycle

    if (phase < SWEEP_DURATION) {
      const progress = phase / SWEEP_DURATION
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
      const y = BEAM_TOP_Y + (BEAM_BOT_Y - BEAM_TOP_Y) * eased
      beamRef.current.position.y = y
      beamRef.current.visible = true
    } else {
      beamRef.current.visible = false
    }
  })

  return (
    <RoundedBox
      ref={beamRef}
      args={[1.4, 0.015, 0.9]}
      radius={0.005}
      smoothness={4}
      position={[0, BEAM_TOP_Y, 0]}
    >
      <meshBasicMaterial color="#22c55e" transparent opacity={0.3} />
    </RoundedBox>
  )
}

function SectionFlash({
  sectionY,
  sectionHeight,
  sectionWidth,
  sectionDepth,
  flashColor,
  reducedMotion,
}: {
  sectionY: number
  sectionHeight: number
  sectionWidth: number
  sectionDepth: number
  flashColor: THREE.Color
  reducedMotion: boolean
}) {
  const ref = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!ref.current) return
    if (reducedMotion) {
      ref.current.visible = false
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current
    const cycle = SWEEP_DURATION + PAUSE_DURATION
    const phase = t % cycle

    if (phase < SWEEP_DURATION) {
      const progress = phase / SWEEP_DURATION
      const eased = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2
      const beamY = BEAM_TOP_Y + (BEAM_BOT_Y - BEAM_TOP_Y) * eased

      const dist = Math.abs(beamY - sectionY)
      if (dist < sectionHeight / 2 + 0.05) {
        const intensity = Math.max(0, 1 - dist / (sectionHeight / 2 + 0.05))
        ref.current.visible = true
        const mat = ref.current.material as THREE.MeshBasicMaterial
        mat.opacity = intensity * 0.4
      } else {
        ref.current.visible = false
      }
    } else {
      ref.current.visible = false
    }
  })

  return (
    <RoundedBox
      ref={ref}
      args={[sectionWidth + 0.02, sectionHeight + 0.02, sectionDepth + 0.02]}
      radius={0.01}
      smoothness={4}
      position={[0, sectionY, 0]}
    >
      <meshBasicMaterial color={flashColor} transparent opacity={0} />
    </RoundedBox>
  )
}

function GasMeter({ reducedMotion }: { reducedMotion: boolean }) {
  const fillRef = useRef<THREE.Mesh>(null!)
  const maxFillHeight = 0.52
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!fillRef.current) return
    elapsedRef.current += delta
    const t = reducedMotion ? 0 : elapsedRef.current
    const cycle = SWEEP_DURATION + PAUSE_DURATION
    const phase = t % cycle

    let fillPercent = 0
    if (phase < SWEEP_DURATION) {
      const progress = phase / SWEEP_DURATION
      fillPercent = progress
    } else {
      const pauseProgress = (phase - SWEEP_DURATION) / PAUSE_DURATION
      fillPercent = Math.max(0, 1 - pauseProgress * 3)
    }

    const h = fillPercent * maxFillHeight
    fillRef.current.scale.y = Math.max(0.001, h / maxFillHeight)
    fillRef.current.position.y = -maxFillHeight / 2 + h / 2
  })

  return (
    <group position={[1.0, 0, 0]}>
      <RoundedBox args={[0.15, 0.6, 0.08]} radius={0.02} smoothness={4}>
        <meshStandardMaterial color="#f59e0b" transparent opacity={0.2} roughness={0.5} />
      </RoundedBox>
      <RoundedBox
        ref={fillRef}
        args={[0.12, maxFillHeight, 0.06]}
        radius={0.015}
        smoothness={4}
        position={[0, 0, 0]}
      >
        <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      </RoundedBox>
      <Html center position={[0, 0.42, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[8px] tracking-[0.08em] uppercase font-bold whitespace-nowrap" style={{ color: '#f59e0b' }}>
          Metering
        </p>
      </Html>
    </group>
  )
}

/* -- Left Side: Today's Mixed Bytecode -- */

function TodaySide({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group position={[LEFT_X, 0.7, 0]}>
      <RoundedBox args={[2.0, 0.02, 1.4]} radius={0.008} smoothness={4} position={[0, -0.62, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[1.5, 1.2, 1.0]} radius={0.04} smoothness={4}>
        <meshStandardMaterial
          color="#fef2f2"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          roughness={0.7}
          depthWrite={false}
        />
      </RoundedBox>
      <MixedCubes reducedMotion={reducedMotion} />
      <EntropyParticles reducedMotion={reducedMotion} />
      <Html center position={[0, 0.85, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#ef4444' }}>
          Today: Mixed Bytecode
        </p>
      </Html>
    </group>
  )
}

/* -- Right Side: EOF Structured -- */

function EOFSide({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <group position={[RIGHT_X, 0.7, 0]}>
      <RoundedBox args={[2.0, 0.02, 1.4]} radius={0.008} smoothness={4} position={[0, -0.92, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[1.5, 1.8, 1.0]} radius={0.04} smoothness={4}>
        <meshStandardMaterial
          color="#f0fdf4"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          roughness={0.7}
          depthWrite={false}
        />
      </RoundedBox>
      <RoundedBox args={[1.3, 0.15, 0.8]} radius={0.02} smoothness={4} position={[0, HEADER_Y, 0]}>
        <meshStandardMaterial color="#22c55e" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.3, 0.3, 0.8]} radius={0.02} smoothness={4} position={[0, CODE1_Y, 0]}>
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.15} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.3, 0.3, 0.8]} radius={0.02} smoothness={4} position={[0, CODE2_Y, 0]}>
        <meshStandardMaterial color="#3b82f6" transparent opacity={0.15} roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[1.3, 0.25, 0.8]} radius={0.02} smoothness={4} position={[0, DATA_Y, 0]}>
        <meshStandardMaterial color="#6366f1" transparent opacity={0.15} roughness={0.5} />
      </RoundedBox>
      {DIVIDER_YS.map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.3, 0.8]} />
          <meshBasicMaterial color="#d4d4d8" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <CodeCubes />
      <DataCubes />
      <OrderParticles reducedMotion={reducedMotion} />
      <AnalysisBeam reducedMotion={reducedMotion} />
      {SECTIONS.map((s, i) => (
        <SectionFlash
          key={i}
          sectionY={s.y}
          sectionHeight={s.height}
          sectionWidth={1.3}
          sectionDepth={0.8}
          flashColor={s.color}
          reducedMotion={reducedMotion}
        />
      ))}
      <GasMeter reducedMotion={reducedMotion} />
      <Html center position={[0.85, HEADER_Y, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#22c55e' }}>Header</p>
      </Html>
      <Html center position={[0.85, CODE1_Y, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#3b82f6' }}>Code 1</p>
      </Html>
      <Html center position={[0.85, CODE2_Y, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#3b82f6' }}>Code 2</p>
      </Html>
      <Html center position={[0.85, DATA_Y, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[9px] font-bold whitespace-nowrap" style={{ color: '#6366f1' }}>Data</p>
      </Html>
      <Html center position={[0, 1.15, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <p className="text-[10px] tracking-[0.12em] uppercase font-bold whitespace-nowrap" style={{ color: '#22c55e' }}>
          With EOF: Structured
        </p>
      </Html>
    </group>
  )
}

/* -- Divider -- */

function Divider() {
  return (
    <RoundedBox args={[0.01, 0.4, 3.0]} radius={0.004} smoothness={4} position={[0, 0.5, 0]}>
      <meshStandardMaterial color="#e5e7eb" roughness={0.5} />
    </RoundedBox>
  )
}

/* -- Main Scene -- */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <TodaySide reducedMotion={reducedMotion} />
      <EOFSide reducedMotion={reducedMotion} />
      <Divider />
    </>
  )
}

/* -- Legend -- */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#a1a1aa' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Mixed bytecode</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Code</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#6366f1' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#22c55e' }} />
        <span className="text-[10px] text-text-muted tracking-wide">Analysis</span>
      </div>
    </div>
  )
}

/* -- Exported Component -- */

export function EOFContainerization3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Comparison of smart contract bytecode formats. Left shows today's mixed code and data as chaotically tumbling grey cubes. Right shows EOF format with neatly organized colored sections being scanned by an analysis beam."
      srDescription="A 3D diorama comparing contract bytecode formats. The left side shows a translucent pink container filled with 60 small grey cubes tumbling chaotically, representing today's mixed code-and-data bytecode that is difficult to analyze. Red spheres drift among them, representing analysis failures. The right side shows a taller translucent green container with four neatly stacked colored sections: a green header, two blue code sections with organized cube grids, and an indigo data section. A green analysis beam sweeps top-to-bottom through the structured container while a yellow gas meter beside it fills as each section is scanned."
      legend={<Legend />}
      fallbackText="EOF bytecode format -- from mixed blobs to structured, analyzable sections"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 5, 7], fov: 36 }}
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
            enableZoom={false}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
            minAzimuthAngle={-Math.PI / 8}
            maxAzimuthAngle={Math.PI / 8}
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
