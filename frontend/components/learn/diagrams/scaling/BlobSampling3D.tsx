'use client'

import { useRef, useMemo, useCallback, RefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { createValidatorGeometry } from './shared/ValidatorFigure'
import { ContextDisposer } from './shared/ContextDisposer'

/* -- Constants -- */

const BLOB_COUNT = 4
const CELLS_PER_BLOB = 16
const VALIDATOR_COUNT = 8
const BEAMS_PER_VALIDATOR = 2
const TOTAL_BEAMS = VALIDATOR_COUNT * BEAMS_PER_VALIDATOR // 16

const BLOB_RING_RADIUS = 1.8
const VALIDATOR_RING_RADIUS = 3.5

const COL_INDIGO = '#6366f1'
const COL_GREEN = '#22c55e'
const COL_VIOLET = '#8b5cf6'
const COL_TOWER = '#1e1e1e'
const COL_ZINC = '#71717a'
const COL_WIRE = '#d4d4d8'

/* -- Blob positions (4 blobs equally spaced on inner ring) -- */

const BLOB_POSITIONS: [number, number, number][] = Array.from({ length: BLOB_COUNT }, (_, i) => {
  const angle = (i / BLOB_COUNT) * Math.PI * 2 - Math.PI / 2
  return [
    Math.cos(angle) * BLOB_RING_RADIUS,
    0.06,
    Math.sin(angle) * BLOB_RING_RADIUS,
  ]
})

/* -- Validator positions (8 equally spaced on outer ring) -- */

const VALIDATOR_ANGLES = Array.from({ length: VALIDATOR_COUNT }, (_, i) =>
  (i / VALIDATOR_COUNT) * Math.PI * 2
)

const VALIDATOR_POSITIONS: [number, number, number][] = VALIDATOR_ANGLES.map((angle) => [
  Math.cos(angle) * VALIDATOR_RING_RADIUS,
  0.0,
  Math.sin(angle) * VALIDATOR_RING_RADIUS,
])

/* -- Deterministic sample targets -- */

interface SampleTarget {
  blobIndex: number
  cellIndex: number
}

const SAMPLE_TARGETS: SampleTarget[][] = (() => {
  const targets: SampleTarget[][] = []
  for (let v = 0; v < VALIDATOR_COUNT; v++) {
    const t1: SampleTarget = {
      blobIndex: v % BLOB_COUNT,
      cellIndex: (v * 3) % CELLS_PER_BLOB,
    }
    const t2: SampleTarget = {
      blobIndex: (v + 1) % BLOB_COUNT,
      cellIndex: (v * 5 + 7) % CELLS_PER_BLOB,
    }
    targets.push([t1, t2])
  }
  return targets
})()

/* -- Utility: get world position of a cell within a blob -- */

function getCellWorldPos(blobIndex: number, cellIndex: number): THREE.Vector3 {
  const [bx, by, bz] = BLOB_POSITIONS[blobIndex]
  const gridSide = 4
  const cellSize = 0.06
  const gap = cellSize * 0.3
  const totalWidth = gridSide * cellSize + (gridSide - 1) * gap
  const offset = totalWidth / 2 - cellSize / 2

  const row = Math.floor(cellIndex / gridSide)
  const col = cellIndex % gridSide
  const x = bx + col * (cellSize + gap) - offset
  const z = bz + row * (cellSize + gap) - offset

  return new THREE.Vector3(x, by, z)
}

/* -- Block Producer Tower -- */

function BlockProducer() {
  return (
    <group position={[0, 0, 0]}>
      <RoundedBox args={[0.7, 0.02, 0.7]} radius={0.008} smoothness={4} position={[0, -0.01, 0]}>
        <meshBasicMaterial color="#ffffff" />
      </RoundedBox>
      <RoundedBox args={[0.5, 1.0, 0.5]} radius={0.04} smoothness={4} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={COL_TOWER} roughness={0.4} />
      </RoundedBox>
      <mesh position={[0, 1.15, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.3, 8]} />
        <meshStandardMaterial color={COL_ZINC} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <coneGeometry args={[0.04, 0.08, 8]} />
        <meshStandardMaterial color={COL_ZINC} roughness={0.5} />
      </mesh>
      <Html
        center
        position={[0, 1.55, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[10px] font-bold text-black tracking-tight whitespace-nowrap">
          Block Producer
        </p>
      </Html>
    </group>
  )
}

/* -- Broadcast Rings -- */

function BroadcastRings({ reducedMotion }: { reducedMotion: boolean }) {
  const ringsRef = useRef<THREE.Group>(null!)
  const RING_COUNT = 3
  const CYCLE = 3.0
  const MAX_R = 3.8
  const MIN_R = 0.4
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    const group = ringsRef.current
    if (!group) return

    for (let i = 0; i < RING_COUNT; i++) {
      const ring = group.children[i] as THREE.Mesh
      if (!ring) continue

      const phase = (t / CYCLE + i / RING_COUNT) % 1.0
      const r = MIN_R + phase * (MAX_R - MIN_R)
      const opacity = 0.25 * (1.0 - phase)

      ring.scale.set(r, 1, r)
      const mat = ring.material as THREE.MeshBasicMaterial
      mat.opacity = opacity
    }
  })

  return (
    <group ref={ringsRef} position={[0, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <mesh key={i} scale={[MIN_R, 1, MIN_R]}>
          <torusGeometry args={[1, 0.006, 8, 48]} />
          <meshBasicMaterial color={COL_INDIGO} transparent opacity={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}

/* -- Blob Container Wireframes + KZG Markers -- */

function BlobContainers({ reducedMotion }: { reducedMotion: boolean }) {
  const kzgRefs = useRef<(THREE.Mesh | null)[]>([])
  const elapsedRef = useRef(0)

  const setKzgRef = useCallback((index: number) => (el: THREE.Mesh | null) => {
    kzgRefs.current[index] = el
  }, [])

  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    for (let i = 0; i < BLOB_COUNT; i++) {
      const mesh = kzgRefs.current[i]
      if (!mesh) continue
      const s = 1.0 + 0.2 * Math.sin(t * 2 + i * 1.5)
      mesh.scale.setScalar(s)
    }
  })

  return (
    <>
      {BLOB_POSITIONS.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]}>
          <RoundedBox
            args={[0.8, 0.02, 0.8]}
            radius={0.008}
            smoothness={4}
            position={[0, -0.07, 0]}
          >
            <meshBasicMaterial color="#ffffff" />
          </RoundedBox>
          <RoundedBox args={[0.7, 0.12, 0.7]} radius={0.02} smoothness={4} position={[0, 0, 0]}>
            <meshStandardMaterial color={COL_WIRE} wireframe roughness={0.6} />
          </RoundedBox>
          <mesh ref={setKzgRef(i)} position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshStandardMaterial
              color={COL_VIOLET}
              emissive={COL_VIOLET}
              emissiveIntensity={0.4}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}
    </>
  )
}

/* -- Single blob cell grid that reads highlight data from a ref in useFrame -- */

function BlobCellGrid({
  position,
  blobIndex,
  highlightedCellsRef,
}: {
  position: [number, number, number]
  blobIndex: number
  highlightedCellsRef: RefObject<Set<number>[]>
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const gridSide = 4
  const cellSize = 0.06
  const gap = cellSize * 0.3
  const totalWidth = gridSide * cellSize + (gridSide - 1) * gap
  const offset = totalWidth / 2 - cellSize / 2

  const cellPositions = useMemo(() => {
    const positions: [number, number][] = []
    for (let i = 0; i < CELLS_PER_BLOB; i++) {
      const row = Math.floor(i / gridSide)
      const col = i % gridSide
      const x = col * (cellSize + gap) - offset
      const z = row * (cellSize + gap) - offset
      positions.push([x, z])
    }
    return positions
  }, [offset, gap, cellSize])

  const baseColor = useMemo(() => new THREE.Color(COL_INDIGO), [])
  const highlightColor = useMemo(() => new THREE.Color(COL_GREEN), [])

  // Initialize matrices and color buffer once
  const colorBuffer = useMemo(() => new Float32Array(CELLS_PER_BLOB * 3), [])
  const prevHighlightKey = useRef('')

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    elapsedRef.current += delta
    const t = elapsedRef.current

    const highlighted = highlightedCellsRef.current?.[blobIndex] ?? new Set<number>()
    const key = [...highlighted].sort().join(',')

    // Always set all matrices on first frame, and update colors when highlights change
    const needsColorUpdate = key !== prevHighlightKey.current
    if (needsColorUpdate) {
      prevHighlightKey.current = key
    }

    for (let i = 0; i < CELLS_PER_BLOB; i++) {
      const [x, z] = cellPositions[i]
      const isHighlighted = highlighted.has(i)
      const lift = isHighlighted ? Math.sin(t * 2 + i * 0.5) * 0.008 + 0.01 : 0
      dummy.position.set(x, lift, z)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      if (needsColorUpdate) {
        const c = isHighlighted ? highlightColor : baseColor
        colorBuffer[i * 3] = c.r
        colorBuffer[i * 3 + 1] = c.g
        colorBuffer[i * 3 + 2] = c.b
      }
    }
    mesh.instanceMatrix.needsUpdate = true

    if (needsColorUpdate) {
      if (!mesh.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuffer, 3)
      } else {
        mesh.instanceColor.array = colorBuffer
        mesh.instanceColor.needsUpdate = true
      }
    }
  })

  return (
    <group position={position}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, CELLS_PER_BLOB]}>
        <boxGeometry args={[cellSize, cellSize * 0.5, cellSize]} />
        <meshStandardMaterial vertexColors roughness={0.5} />
      </instancedMesh>
    </group>
  )
}

/* -- Blob Cell Grids -- */

function BlobCellGrids({ highlightedCellsRef }: { highlightedCellsRef: RefObject<Set<number>[]> }) {
  return (
    <>
      {BLOB_POSITIONS.map(([x, y, z], blobIdx) => (
        <BlobCellGrid
          key={blobIdx}
          position={[x, y, z]}
          blobIndex={blobIdx}
          highlightedCellsRef={highlightedCellsRef}
        />
      ))}
    </>
  )
}

/* -- Validators (instancedMesh, 8 static figures) -- */

function Validators() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  const geometry = useMemo(() => createValidatorGeometry(), [])

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    return VALIDATOR_POSITIONS.map(([x, , z]) => {
      dummy.position.set(x, 0.0, z)
      dummy.scale.setScalar(1.4)
      dummy.updateMatrix()
      return dummy.matrix.clone()
    })
  }, [])

  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh) return
    if (!(mesh.userData as { initialized?: boolean }).initialized) {
      for (let i = 0; i < VALIDATOR_COUNT; i++) {
        mesh.setMatrixAt(i, matrices[i])
      }
      mesh.instanceMatrix.needsUpdate = true
      ;(mesh.userData as { initialized?: boolean }).initialized = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, VALIDATOR_COUNT]}>
      <meshStandardMaterial color={COL_GREEN} roughness={0.6} />
    </instancedMesh>
  )
}

/* -- Sample Beams -- */

function SampleBeams({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const beamData = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0)
    return Array.from({ length: TOTAL_BEAMS }, (_, i) => {
      const v = Math.floor(i / BEAMS_PER_VALIDATOR)
      const b = i % BEAMS_PER_VALIDATOR
      const [vx, , vz] = VALIDATOR_POSITIONS[v]
      const start = new THREE.Vector3(vx, 0.2, vz)
      const target = SAMPLE_TARGETS[v][b]
      const end = getCellWorldPos(target.blobIndex, target.cellIndex)

      const mid = start.clone().lerp(end, 0.5)
      const dir = end.clone().sub(start)
      const len = dir.length()
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())

      return { mid, len, quat }
    })
  }, [])

  const hiddenMatrix = useMemo(() => {
    const m = new THREE.Matrix4()
    m.makeScale(0, 0, 0)
    m.setPosition(0, -100, 0)
    return m
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    elapsedRef.current += delta
    const t = elapsedRef.current

    for (let i = 0; i < TOTAL_BEAMS; i++) {
      const beamIdx = i % BEAMS_PER_VALIDATOR
      const cycle = 1.5
      const beamPhase = ((t + beamIdx * 0.75) % cycle) / cycle
      const isOn = !reducedMotion && beamPhase < (1.0 / 1.5)

      if (isOn) {
        const { mid, len, quat } = beamData[i]
        dummy.position.copy(mid)
        dummy.quaternion.copy(quat)
        dummy.scale.set(0.003, len, 0.003)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      } else {
        mesh.setMatrixAt(i, hiddenMatrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_BEAMS]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={COL_GREEN} transparent opacity={0.35} />
    </instancedMesh>
  )
}

/* -- Sampled Cell Highlight Overlay -- */

function SampledHighlights({
  reducedMotion,
  onHighlightUpdate,
}: {
  reducedMotion: boolean
  onHighlightUpdate: (highlights: Set<number>[]) => void
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const hitTimes = useRef<Float32Array>(new Float32Array(TOTAL_BEAMS).fill(-10))
  const prevHighlightsRef = useRef<string>('')

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    elapsedRef.current += delta
    const t = elapsedRef.current

    const blobHighlights: Set<number>[] = Array.from({ length: BLOB_COUNT }, () => new Set())

    for (let i = 0; i < TOTAL_BEAMS; i++) {
      const target = SAMPLE_TARGETS[Math.floor(i / BEAMS_PER_VALIDATOR)][i % BEAMS_PER_VALIDATOR]
      const beamIdx = i % BEAMS_PER_VALIDATOR
      const cycle = 1.5
      const beamPhase = ((t + beamIdx * 0.75) % cycle) / cycle
      const isOn = !reducedMotion && beamPhase < (1.0 / 1.5)

      if (isOn && t - hitTimes.current[i] > 0.5) {
        hitTimes.current[i] = t
      }

      const elapsed = t - hitTimes.current[i]
      const glowIntensity = Math.max(0, 1.0 - elapsed / 2.0)

      if (glowIntensity > 0.05) {
        const cellPos = getCellWorldPos(target.blobIndex, target.cellIndex)
        dummy.position.copy(cellPos)
        dummy.position.y += 0.005
        dummy.scale.setScalar(glowIntensity * 0.8 + 0.2)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
        blobHighlights[target.blobIndex].add(target.cellIndex)
      } else {
        dummy.position.set(0, -100, 0)
        dummy.scale.set(0, 0, 0)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true

    const key = blobHighlights.map((s) => [...s].sort().join(',')).join('|')
    if (key !== prevHighlightsRef.current) {
      prevHighlightsRef.current = key
      onHighlightUpdate(blobHighlights)
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_BEAMS]}>
      <boxGeometry args={[0.07, 0.04, 0.07]} />
      <meshStandardMaterial
        color={COL_GREEN}
        emissive={COL_GREEN}
        emissiveIntensity={0.8}
        transparent
        opacity={0.6}
        roughness={0.3}
      />
    </instancedMesh>
  )
}

/* -- Coverage Ground Disc -- */

function CoverageDisc() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
      <circleGeometry args={[4.0, 48]} />
      <meshBasicMaterial color={COL_GREEN} transparent opacity={0.04} />
    </mesh>
  )
}

/* -- Blob Count Progression Label -- */

function BlobCountLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const labelRef = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  const stages = useMemo(
    () => [
      { text: '6 blobs/block', color: '#6366f1' },
      { text: '64 blobs/block', color: '#22c55e' },
      { text: '128 blobs/block', color: '#16a34a' },
    ],
    []
  )

  useFrame((_, delta) => {
    if (!labelRef.current) return
    if (reducedMotion) {
      labelRef.current.textContent = stages[2].text
      labelRef.current.style.color = stages[2].color
      return
    }
    elapsedRef.current += delta
    const DURATION = 3.0
    const total = stages.length * DURATION
    const phase = elapsedRef.current % total
    const idx = Math.min(Math.floor(phase / DURATION), stages.length - 1)
    const stage = stages[idx]

    if (labelRef.current.textContent !== stage.text) {
      labelRef.current.textContent = stage.text
      labelRef.current.style.color = stage.color
    }
  })

  return (
    <Html
      center
      position={[0, 1.8, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p
        ref={labelRef}
        className="text-[14px] font-bold font-mono whitespace-nowrap"
        style={{ color: '#6366f1' }}
      >
        6 blobs/block
      </p>
    </Html>
  )
}

/* -- Data Packets (flowing cubes from center to blobs) -- */

function DataPackets({ reducedMotion }: { reducedMotion: boolean }) {
  const PACKET_COUNT = 16
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const packetData = useMemo(() => {
    return Array.from({ length: PACKET_COUNT }, (_, i) => {
      const targetIdx = i % BLOB_COUNT
      const [tx, , tz] = BLOB_POSITIONS[targetIdx]
      const angle = Math.atan2(tz, tx)
      const phaseOffset = (i / PACKET_COUNT) * 1.0 // stagger start times
      return { angle, phaseOffset }
    })
  }, [])

  const hiddenMatrix = useMemo(() => {
    const m = new THREE.Matrix4()
    m.makeScale(0, 0, 0)
    m.setPosition(0, -100, 0)
    return m
  }, [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return
    if (reducedMotion) {
      for (let i = 0; i < PACKET_COUNT; i++) {
        mesh.setMatrixAt(i, hiddenMatrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current

    const SPEED = 0.15
    const MAX_DIST = BLOB_RING_RADIUS + 0.2

    for (let i = 0; i < PACKET_COUNT; i++) {
      const { angle, phaseOffset } = packetData[i]
      const progress = ((t * SPEED + phaseOffset) % 1.0)
      const dist = progress * MAX_DIST

      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      const y = 0.6 + Math.sin(progress * Math.PI) * 0.15 // slight arc

      dummy.position.set(x, y, z)
      dummy.rotation.set(t * 2 + i, t * 1.5 + i, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, PACKET_COUNT]}>
      <boxGeometry args={[0.04, 0.04, 0.04]} />
      <meshStandardMaterial
        color={COL_INDIGO}
        emissive={COL_INDIGO}
        emissiveIntensity={0.5}
        roughness={0.3}
      />
    </instancedMesh>
  )
}

/* -- Coverage Label (reads ref directly via useFrame + DOM manipulation) -- */

function CoverageLabel({
  reducedMotion,
  highlightedCellsRef,
}: {
  reducedMotion: boolean
  highlightedCellsRef: React.RefObject<Set<number>[]>
}) {
  const labelRef = useRef<HTMLParagraphElement>(null)

  const allTargetedCount = useMemo(() => {
    const unique = new Set<string>()
    for (const targets of SAMPLE_TARGETS) {
      for (const t of targets) {
        unique.add(`${t.blobIndex}-${t.cellIndex}`)
      }
    }
    return unique.size
  }, [])

  useFrame(() => {
    if (!labelRef.current || !highlightedCellsRef.current) return
    const totalSampled = highlightedCellsRef.current.reduce((sum, s) => sum + s.size, 0)
    const pct = reducedMotion
      ? 100
      : Math.min(100, Math.round((totalSampled / allTargetedCount) * 100))

    const text = pct >= 100 ? '100% coverage' : `${pct}% sampled`
    const color = pct >= 100 ? COL_GREEN : '#71717a'

    if (labelRef.current.textContent !== text) {
      labelRef.current.textContent = text
      labelRef.current.style.color = color
    }
  })

  return (
    <Html
      center
      position={[0, 0.01, 4.5]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <p
        ref={labelRef}
        className="text-[12px] font-bold tracking-tight whitespace-nowrap"
        style={{ color: '#71717a' }}
      >
        0% sampled
      </p>
    </Html>
  )
}

/* -- Main Scene -- */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  const highlightedCellsRef = useRef<Set<number>[]>(
    Array.from({ length: BLOB_COUNT }, () => new Set())
  )

  const handleHighlightUpdate = useCallback((highlights: Set<number>[]) => {
    highlightedCellsRef.current = highlights
  }, [])

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      <CoverageDisc />
      <BlockProducer />
      <BroadcastRings reducedMotion={reducedMotion} />
      <DataPackets reducedMotion={reducedMotion} />
      <BlobCountLabel reducedMotion={reducedMotion} />
      <BlobContainers reducedMotion={reducedMotion} />
      <BlobCellGrids highlightedCellsRef={highlightedCellsRef} />
      <Validators />
      <SampleBeams reducedMotion={reducedMotion} />
      <SampledHighlights
        reducedMotion={reducedMotion}
        onHighlightUpdate={handleHighlightUpdate}
      />
      <CoverageLabel
        reducedMotion={reducedMotion}
        highlightedCellsRef={highlightedCellsRef}
      />
    </>
  )
}

/* -- Legend -- */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_TOWER }} />
        <span className="text-[10px] text-text-muted tracking-wide">Producer</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_INDIGO }} />
        <span className="text-[10px] text-text-muted tracking-wide">Blob Cells</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Validators</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: COL_VIOLET }} />
        <span className="text-[10px] text-text-muted tracking-wide">KZG</span>
      </div>
    </div>
  )
}

/* -- Exported Component -- */

export function BlobSampling3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Central block producer tower broadcasting data blobs outward, with 8 validators around the perimeter sampling specific cells from a grid, collectively achieving 100% data availability coverage"
      srDescription="A 3D diorama showing PeerDAS blob sampling. A dark central tower represents the block producer, broadcasting data via expanding indigo rings. Four 4x4 blob grids arranged in a ring contain 64 data cells. Eight green validator figures around the perimeter shoot thin beams at specific cells, which glow green on contact. Collectively, all cells are sampled, achieving 100% data availability coverage without any single validator downloading everything."
      legend={<Legend />}
      fallbackText="PeerDAS blob sampling -- validators sample individual cells from data blobs to achieve full coverage"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 7, 3], fov: 32 }}
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
            enableZoom minDistance={3} maxDistance={18}
            enablePan={false}
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
