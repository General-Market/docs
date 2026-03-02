'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ── Constants ── */

const L1_Y = 0.2
const L2_Y = 0.8
const L3_Y = 1.4

const FLOOR_W = 4.0
const FLOOR_H = 0.03
const FLOOR_D = 2.5

const BLUE = '#3b82f6'
const INDIGO = '#6366f1'
const VIOLET = '#8b5cf6'
const GREEN = '#22c55e'
const AMBER = '#f59e0b'
const ZINC = '#a1a1aa'

/* ── Helper: create a vertical tube path ── */

function makeVerticalPath(x: number, z: number, yBottom: number, yTop: number) {
  return new THREE.LineCurve3(
    new THREE.Vector3(x, yBottom, z),
    new THREE.Vector3(x, yTop, z),
  )
}

/* ── Helper: create an arc path between two points on a layer ── */

function makeArcPath(
  from: THREE.Vector3,
  to: THREE.Vector3,
  liftY: number,
) {
  const mid = from.clone().lerp(to, 0.5)
  mid.y += liftY
  return new THREE.QuadraticBezierCurve3(from, mid, to)
}

/* ── Layer 1: Execution Floor ── */

function ExecutionLayer() {
  return (
    <group position={[0, L1_Y, 0]}>
      {/* Floor slab */}
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#dbeafe" roughness={0.75} />
      </RoundedBox>

      {/* Funnel (parallel verification) — inverted cone */}
      <group position={[-1.2, 0.2, 0]}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.25, 0.35, 16, 1, false]} />
          <meshStandardMaterial color={BLUE} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
        {/* Bottom cap */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.175, 0]}>
          <circleGeometry args={[0.12, 16]} />
          <meshStandardMaterial color={BLUE} roughness={0.5} />
        </mesh>
      </group>

      {/* Clock ring (ePBS) — torus */}
      <group position={[0, 0.12, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.015, 12, 32]} />
          <meshStandardMaterial color={BLUE} roughness={0.4} />
        </mesh>
        {/* Clock hand */}
        <mesh>
          <cylinderGeometry args={[0.006, 0.006, 0.18, 6]} />
          <meshStandardMaterial color={BLUE} />
        </mesh>
      </group>

      {/* Gas tank */}
      <RoundedBox
        args={[0.25, 0.35, 0.25]}
        radius={0.025}
        smoothness={4}
        position={[1.2, 0.2, 0]}
      >
        <meshStandardMaterial color={AMBER} roughness={0.5} />
      </RoundedBox>

      {/* Layer label plaque */}
      <Html
        center
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: BLUE }}
        >
          Execution
        </p>
      </Html>
    </group>
  )
}

/* ── Layer 2: Data Floor ── */

function DataLayer() {
  return (
    <group position={[0, L2_Y, 0]}>
      {/* Floor slab */}
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#e0e7ff" roughness={0.75} />
      </RoundedBox>

      {/* 3 blob wireframe grids */}
      {[-1.0, 0, 1.0].map((xOff, idx) => (
        <group key={`blob-${idx}`} position={[xOff, 0.06, 0]}>
          {/* Wireframe outer shell */}
          <RoundedBox args={[0.45, 0.08, 0.45]} radius={0.015} smoothness={4}>
            <meshStandardMaterial
              color={INDIGO}
              transparent
              opacity={0.3}
              roughness={0.6}
            />
          </RoundedBox>
        </group>
      ))}

      {/* Layer label plaque */}
      <Html
        center
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: INDIGO }}
        >
          Data
        </p>
      </Html>
    </group>
  )
}

/* ── Blob grid cells — 3 blobs x 16 cells = 48 instanced cubes ── */

function BlobGridCells() {
  const meshRef = useRef<THREE.InstancedMesh>(null!)

  // 3 blob positions and 4x4 grid per blob
  const { matrices, colors } = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mats: THREE.Matrix4[] = []
    const cols = new Float32Array(48 * 3)
    const baseColor = new THREE.Color(INDIGO)
    const highlightColor = new THREE.Color(GREEN)

    const blobXPositions = [-1.0, 0, 1.0]
    const cellSize = 0.03
    const gap = cellSize * 1.8
    const gridSide = 4
    const totalW = gridSide * cellSize + (gridSide - 1) * gap
    const offset = totalW / 2 - cellSize / 2

    let idx = 0
    for (let b = 0; b < 3; b++) {
      const bx = blobXPositions[b]
      for (let i = 0; i < 16; i++) {
        const row = Math.floor(i / gridSide)
        const col = i % gridSide
        const x = bx + col * (cellSize + gap) - offset
        const y = L2_Y + 0.06
        const z = row * (cellSize + gap) - offset

        dummy.position.set(x, y, z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mats.push(dummy.matrix.clone())

        // Highlight a few cells on the second blob (index 1) to show sampling
        const isHighlighted = b === 1 && (i === 2 || i === 7 || i === 10 || i === 13)
        const c = isHighlighted ? highlightColor : baseColor
        cols[idx * 3] = c.r
        cols[idx * 3 + 1] = c.g
        cols[idx * 3 + 2] = c.b
        idx++
      }
    }

    return { matrices: mats, colors: cols }
  }, [])

  // Set matrices and colors once
  useFrame(() => {
    const mesh = meshRef.current
    if (!mesh || mesh.userData.initialized) return

    for (let i = 0; i < 48; i++) {
      mesh.setMatrixAt(i, matrices[i])
    }
    mesh.instanceMatrix.needsUpdate = true

    const colorAttr = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor = colorAttr
    mesh.userData.initialized = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 48]}>
      <boxGeometry args={[0.03, 0.03, 0.03]} />
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/* ── Layer 3: Proofs Floor ── */

function ProofsLayer() {
  return (
    <group position={[0, L3_Y, 0]}>
      {/* Floor slab */}
      <RoundedBox
        args={[FLOOR_W, FLOOR_H, FLOOR_D]}
        radius={0.02}
        smoothness={4}
      >
        <meshStandardMaterial color="#f5f3ff" roughness={0.75} />
      </RoundedBox>

      {/* 3 prover towers */}
      {[-1.0, 0, 1.0].map((xOff, idx) => (
        <RoundedBox
          key={`prover-${idx}`}
          args={[0.25, 0.4, 0.25]}
          radius={0.025}
          smoothness={4}
          position={[xOff, 0.22, 0]}
        >
          <meshStandardMaterial color={VIOLET} roughness={0.5} />
        </RoundedBox>
      ))}

      {/* Layer label plaque */}
      <Html
        center
        position={[0, FLOOR_H / 2 + 0.02, -FLOOR_D / 2 + 0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: VIOLET }}
        >
          Proofs
        </p>
      </Html>
    </group>
  )
}

/* ── Consensus Arcs (connecting 3 provers on L3) ── */

function ConsensusArcs() {
  const proverPositions = useMemo(() => [
    new THREE.Vector3(-1.0, L3_Y + 0.42, 0),
    new THREE.Vector3(0, L3_Y + 0.42, 0),
    new THREE.Vector3(1.0, L3_Y + 0.42, 0),
  ], [])

  const arcs = useMemo(() => [
    // Arc from prover 0 to prover 1
    {
      curve: makeArcPath(proverPositions[0], proverPositions[1], 0.2),
      geo: new THREE.TubeGeometry(
        makeArcPath(proverPositions[0], proverPositions[1], 0.2),
        24, 0.006, 6, false,
      ),
    },
    // Arc from prover 1 to prover 2
    {
      curve: makeArcPath(proverPositions[1], proverPositions[2], 0.2),
      geo: new THREE.TubeGeometry(
        makeArcPath(proverPositions[1], proverPositions[2], 0.2),
        24, 0.006, 6, false,
      ),
    },
  ], [proverPositions])

  return (
    <>
      {arcs.map((arc, i) => (
        <mesh key={`arc-${i}`} geometry={arc.geo}>
          <meshStandardMaterial color={GREEN} roughness={0.3} />
        </mesh>
      ))}
    </>
  )
}

/* ── Consensus Particles (flowing along arcs on L3) ── */

function ConsensusParticles({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const proverPositions = useMemo(() => [
    new THREE.Vector3(-1.0, L3_Y + 0.42, 0),
    new THREE.Vector3(0, L3_Y + 0.42, 0),
    new THREE.Vector3(1.0, L3_Y + 0.42, 0),
  ], [])

  const curves = useMemo(() => [
    makeArcPath(proverPositions[0], proverPositions[1], 0.2),
    makeArcPath(proverPositions[1], proverPositions[2], 0.2),
  ], [proverPositions])

  // 12 particles total: 6 per arc
  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current

    for (let i = 0; i < 12; i++) {
      const curveIdx = i < 6 ? 0 : 1
      const localIdx = i < 6 ? i : i - 6
      const progress = ((t * 0.2 + localIdx / 6) % 1)

      const point = curves[curveIdx].getPoint(progress)
      dummy.position.copy(point)
      const scale = 0.008 * Math.sin(progress * Math.PI)
      dummy.scale.setScalar(Math.max(0.001, scale))
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 12]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ── Elevator Shafts (4 vertical tubes: 2 per gap) ── */

function ElevatorShafts() {
  const shafts = useMemo(() => {
    const configs = [
      // L1 -> L2 shafts (2)
      { x: -0.8, z: -0.6, yBottom: L1_Y + FLOOR_H / 2, yTop: L2_Y - FLOOR_H / 2 },
      { x: 0.8, z: 0.6, yBottom: L1_Y + FLOOR_H / 2, yTop: L2_Y - FLOOR_H / 2 },
      // L2 -> L3 shafts (2)
      { x: -0.8, z: 0.6, yBottom: L2_Y + FLOOR_H / 2, yTop: L3_Y - FLOOR_H / 2 },
      { x: 0.8, z: -0.6, yBottom: L2_Y + FLOOR_H / 2, yTop: L3_Y - FLOOR_H / 2 },
    ]

    return configs.map((c) => {
      const path = makeVerticalPath(c.x, c.z, c.yBottom, c.yTop)
      return {
        ...c,
        geo: new THREE.TubeGeometry(path, 8, 0.012, 6, false),
      }
    })
  }, [])

  return (
    <>
      {shafts.map((shaft, i) => (
        <mesh key={`shaft-${i}`} geometry={shaft.geo}>
          <meshStandardMaterial color={ZINC} roughness={0.4} />
        </mesh>
      ))}
    </>
  )
}

/* ── Elevator Particles (rising through shafts, color lerps between layers) ── */

function ElevatorParticles({
  fromY,
  toY,
  positions,
  colorFrom,
  colorTo,
  reducedMotion,
}: {
  fromY: number
  toY: number
  positions: [number, number][] // [x, z] pairs
  colorFrom: string
  colorTo: string
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const count = positions.length * 6 // 6 per shaft = 12 total

  const colorA = useMemo(() => new THREE.Color(colorFrom), [colorFrom])
  const colorB = useMemo(() => new THREE.Color(colorTo), [colorTo])
  const tempColor = useMemo(() => new THREE.Color(), [])
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current
    const yRange = toY - fromY

    for (let i = 0; i < count; i++) {
      const shaftIdx = Math.floor(i / 6)
      const localIdx = i % 6
      const progress = ((t * 0.12 + localIdx / 6) % 1)

      const [sx, sz] = positions[shaftIdx]
      const y = fromY + progress * yRange

      dummy.position.set(sx, y, sz)
      const scale = 0.01 * Math.sin(progress * Math.PI)
      dummy.scale.setScalar(Math.max(0.001, scale))
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)

      // Lerp color based on progress
      tempColor.copy(colorA).lerp(colorB, progress)
      meshRef.current.setColorAt(i, tempColor)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial vertexColors transparent opacity={0.7} />
    </instancedMesh>
  )
}

/* ── Valid Block (output, gentle Y rotation) ── */

function ValidBlock({ reducedMotion }: { reducedMotion: boolean }) {
  const blockRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!blockRef.current || reducedMotion) return
    elapsedRef.current += delta
    blockRef.current.rotation.y = elapsedRef.current * 0.3
  })

  return (
    <group position={[0, L3_Y + 0.55, 0]}>
      <group ref={blockRef}>
        <RoundedBox args={[0.35, 0.2, 0.35]} radius={0.03} smoothness={4}>
          <meshStandardMaterial
            color={GREEN}
            roughness={0.4}
            emissive={GREEN}
            emissiveIntensity={0.15}
          />
        </RoundedBox>
      </group>

      {/* "VALID" label */}
      <Html
        center
        position={[0, 0.22, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[12px] font-bold" style={{ color: GREEN }}>
          VALID
        </p>
      </Html>
    </group>
  )
}

/* ── Output Beam (cylinder, pulsing opacity) ── */

function OutputBeam({ reducedMotion }: { reducedMotion: boolean }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!matRef.current || reducedMotion) return
    elapsedRef.current += delta
    const t = elapsedRef.current
    // Pulse between 0.08 and 0.25
    matRef.current.opacity = 0.08 + (Math.sin(t * 1.5) + 1) / 2 * 0.17
  })

  return (
    <mesh position={[0, L3_Y + 0.95, 0]}>
      <cylinderGeometry args={[0.03, 0.03, 0.5, 12]} />
      <meshBasicMaterial
        ref={matRef}
        color={GREEN}
        transparent
        opacity={0.15}
      />
    </mesh>
  )
}

/* ── Output Burst Particles (16 spheres emitting upward radially) ── */

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

function OutputBurst({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Pre-compute radial directions for each particle (deterministic)
  const directions = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2
      return {
        dx: Math.cos(angle) * 0.3,
        dz: Math.sin(angle) * 0.3,
        speed: 0.8 + seededRandom(i * 17 + 3) * 0.4,
        phase: seededRandom(i * 23 + 7),
      }
    })
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (!reducedMotion) elapsedRef.current += delta
    const t = elapsedRef.current

    for (let i = 0; i < 16; i++) {
      const d = directions[i]
      const progress = ((t * 0.15 * d.speed + d.phase) % 1)

      const x = d.dx * progress
      const y = L3_Y + 0.55 + progress * 0.6
      const z = d.dz * progress

      // Fade out as they rise: peak at 30%, fade by 100%
      const alpha = progress < 0.3
        ? progress / 0.3
        : Math.max(0, 1 - (progress - 0.3) / 0.7)

      dummy.position.set(x, y, z)
      dummy.scale.setScalar(0.01 * alpha)
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, 16]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={GREEN} transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ── Main Scene ── */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      {/* Layer floors with miniature hero objects */}
      <ExecutionLayer />
      <DataLayer />
      <BlobGridCells />
      <ProofsLayer />

      {/* Consensus arcs and particles on L3 */}
      <ConsensusArcs />
      <ConsensusParticles reducedMotion={reducedMotion} />

      {/* Elevator shafts */}
      <ElevatorShafts />

      {/* Elevator particles: L1 -> L2 */}
      <ElevatorParticles
        fromY={L1_Y + FLOOR_H / 2}
        toY={L2_Y - FLOOR_H / 2}
        positions={[[-0.8, -0.6], [0.8, 0.6]]}
        colorFrom={BLUE}
        colorTo={INDIGO}
        reducedMotion={reducedMotion}
      />

      {/* Elevator particles: L2 -> L3 */}
      <ElevatorParticles
        fromY={L2_Y + FLOOR_H / 2}
        toY={L3_Y - FLOOR_H / 2}
        positions={[[-0.8, 0.6], [0.8, -0.6]]}
        colorFrom={INDIGO}
        colorTo={VIOLET}
        reducedMotion={reducedMotion}
      />

      {/* Output: valid block + beam + burst */}
      <ValidBlock reducedMotion={reducedMotion} />
      <OutputBeam reducedMotion={reducedMotion} />
      <OutputBurst reducedMotion={reducedMotion} />
    </>
  )
}

/* ── Legend ── */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-blue-400 border border-blue-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Execution</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-indigo-400 border border-indigo-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-violet-400 border border-violet-500" />
        <span className="text-[10px] text-text-muted tracking-wide">Proofs</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
        <span className="text-[10px] text-text-muted tracking-wide">Valid</span>
      </div>
    </div>
  )
}

/* ── Exported Component ── */

export function FullStackLayers3D() {
  return (
    <SceneContainer
      height="h-[360px] md:h-[420px]"
      ariaLabel="Three-layer vertical stack showing Ethereum's full scaling architecture. Bottom blue floor has execution components, middle indigo floor has data blobs, top violet floor has proof validators connected by consensus arcs. A green validated block rises from the top."
      srDescription="A 3D diorama showing all three Ethereum scaling layers stacked vertically. The bottom blue floor contains a funnel for parallel verification, a clock ring for ePBS, and an amber gas tank. The middle indigo floor contains three blob grids with data availability cells, one highlighted to show sampling. The top violet floor contains three prover towers connected by green consensus arcs. Elevator shafts with rising particles connect the floors. A green VALID block rotates above the top floor on a pulsing beam, with particles bursting outward."
      legend={<Legend />}
      fallbackText="Full-stack Ethereum scaling — three layers (execution, data, proofs) producing a validated block"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [5, 5, 5], fov: 36 }}
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
            autoRotate={!reducedMotion}
            autoRotateSpeed={0.4}
            enableDamping
            dampingFactor={0.05}
            target={[0, 0.7, 0]}
          />
        </Canvas>
      )}
    </SceneContainer>
  )
}
