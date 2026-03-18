'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { SceneContainer } from './SceneContainer'
import { ContextDisposer } from './shared/ContextDisposer'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const CELL_SIZE = 0.35
const GAP = 0.05
const ROWS = 4
const DATA_COLS = 4
const PARITY_COLS = 4
const TOTAL_COLS = 8

const CYCLE = 12 // total animation cycle in seconds
const PHASE_DUR = 3 // seconds per phase

const VALIDATOR_COUNT = 8
const VALIDATOR_RADIUS = 3.0

// Column colors
const COL_BLUE = '#3b82f6'
const COL_GREEN = '#22c55e'
const COL_AMBER = '#f59e0b'
const COL_PURPLE = '#8b5cf6'
const COL_RED = '#ef4444'

const DATA_COLORS = [COL_BLUE, COL_GREEN, COL_AMBER, COL_PURPLE]
// Offline validators (indices 1, 3, 5, 7 — every other one)
const OFFLINE_VALIDATORS = new Set([1, 3, 5, 7])

// Validator column assignments: each validator samples 2 columns
const VALIDATOR_SAMPLES: [number, number][] = [
  [0, 4], // V1
  [1, 5], // V2
  [2, 6], // V3
  [3, 7], // V4
  [4, 0], // V5
  [5, 1], // V6
  [6, 2], // V7
  [7, 3], // V8
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Get world position for a grid cell (row, col) centered at origin */
function cellPos(row: number, col: number, totalCols: number): [number, number, number] {
  const gridW = totalCols * CELL_SIZE + (totalCols - 1) * GAP
  const gridH = ROWS * CELL_SIZE + (ROWS - 1) * GAP
  const x = col * (CELL_SIZE + GAP) - gridW / 2 + CELL_SIZE / 2
  const z = row * (CELL_SIZE + GAP) - gridH / 2 + CELL_SIZE / 2
  return [x, 0, z]
}

/** Column center X for a given column index within a grid of totalCols */
function colCenterX(col: number, totalCols: number): number {
  const gridW = totalCols * CELL_SIZE + (totalCols - 1) * GAP
  return col * (CELL_SIZE + GAP) - gridW / 2 + CELL_SIZE / 2
}

/** Smooth step easing */
function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * (3 - 2 * c)
}

/** Validator position on ring */
function validatorPos(index: number): [number, number, number] {
  const angle = (index / VALIDATOR_COUNT) * Math.PI * 2 - Math.PI / 2
  return [
    Math.cos(angle) * VALIDATOR_RADIUS,
    0,
    Math.sin(angle) * VALIDATOR_RADIUS,
  ]
}

/* ------------------------------------------------------------------ */
/*  Data Grid (InstancedMesh for cells)                                */
/* ------------------------------------------------------------------ */

function DataGrid({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  // Pre-compute colors for all 32 cells (4 rows x 8 cols)
  const cellColors = useMemo(() => {
    const arr = new Float32Array(ROWS * TOTAL_COLS * 3)
    const c = new THREE.Color()
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < TOTAL_COLS; col++) {
        const idx = row * TOTAL_COLS + col
        const colorIdx = col < DATA_COLS ? col : col - DATA_COLS
        c.set(DATA_COLORS[colorIdx])
        arr[idx * 3] = c.r
        arr[idx * 3 + 1] = c.g
        arr[idx * 3 + 2] = c.b
      }
    }
    return arr
  }, [])

  const colorsSetRef = useRef(false)

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    // Set instance colors once
    if (!colorsSetRef.current) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(cellColors, 3)
      colorsSetRef.current = true
    }

    if (reducedMotion) {
      // Show final state: full 8-col grid, reconstructed, bright
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < TOTAL_COLS; col++) {
          const idx = row * TOTAL_COLS + col
          const [x, , z] = cellPos(row, col, TOTAL_COLS)
          dummy.position.set(x, 0, z)
          dummy.scale.set(1, 1, 1)
          dummy.updateMatrix()
          mesh.setMatrixAt(idx, dummy.matrix)
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < TOTAL_COLS; col++) {
        const idx = row * TOTAL_COLS + col
        const isParity = col >= DATA_COLS

        let x: number, z: number, scaleY: number, opacity: number

        if (phase === 0) {
          // Phase 1: Only show data columns (0-3), parity hidden
          if (isParity) {
            dummy.position.set(0, -10, 0)
            dummy.scale.set(0, 0, 0)
            dummy.updateMatrix()
            mesh.setMatrixAt(idx, dummy.matrix)
            continue
          }
          const [cx, , cz] = cellPos(row, col, DATA_COLS)
          x = cx
          z = cz
          scaleY = 1
          opacity = 1
        } else if (phase === 1) {
          // Phase 2: Grid expands to 8 cols. Data cols shift left, parity slides in from right.
          if (isParity) {
            // Parity columns slide in from the right
            const slideProgress = smoothstep(phaseT)
            const [targetX, , targetZ] = cellPos(row, col, TOTAL_COLS)
            const startX = targetX + 3 // start off-screen to the right
            x = startX + (targetX - startX) * slideProgress
            z = targetZ
            scaleY = slideProgress
            opacity = 0.3 + 0.7 * slideProgress
          } else {
            // Data columns shift to their new positions in 8-col grid
            const [oldX, , oldZ] = cellPos(row, col, DATA_COLS)
            const [newX, , newZ] = cellPos(row, col, TOTAL_COLS)
            const moveProgress = smoothstep(phaseT)
            x = oldX + (newX - oldX) * moveProgress
            z = oldZ + (newZ - oldZ) * moveProgress
            scaleY = 1
            opacity = 1
          }
        } else if (phase === 2) {
          // Phase 3: Validators sample, some cols darken (offline validators' cols)
          const [cx, , cz] = cellPos(row, col, TOTAL_COLS)
          x = cx
          z = cz
          scaleY = 1

          // Check if this column belongs to an offline validator's sample
          const isOfflineCol = isColumnOffline(col)
          const darkenProgress = smoothstep(phaseT)
          opacity = isOfflineCol ? 1.0 - darkenProgress * 0.7 : 1.0
        } else {
          // Phase 4: Reconstruction - offline cols regenerate
          const [cx, , cz] = cellPos(row, col, TOTAL_COLS)
          x = cx
          z = cz

          const isOfflineCol = isColumnOffline(col)
          if (isOfflineCol) {
            const regenProgress = smoothstep(phaseT)
            scaleY = 0.3 + 0.7 * regenProgress
            opacity = 0.3 + 0.7 * regenProgress
            // Slight upward bounce during reconstruction
            dummy.position.set(x, Math.sin(regenProgress * Math.PI) * 0.1, z)
          } else {
            scaleY = 1
            opacity = 1
            // Bright glow effect on online cols
            const pulse = 1.0 + 0.05 * Math.sin(phaseT * Math.PI * 4)
            scaleY = pulse
            dummy.position.set(x, 0, z)
          }

          if (!isOfflineCol) {
            dummy.position.set(x, 0, z)
          }
          dummy.scale.set(1, scaleY, 1)
          dummy.updateMatrix()
          mesh.setMatrixAt(idx, dummy.matrix)

          // Update color brightness for reconstruction
          const c = new THREE.Color()
          const colorIdx = col < DATA_COLS ? col : col - DATA_COLS
          c.set(DATA_COLORS[colorIdx])
          if (isParity) {
            c.multiplyScalar(0.5 + 0.5 * opacity)
          }
          cellColors[idx * 3] = c.r
          cellColors[idx * 3 + 1] = c.g
          cellColors[idx * 3 + 2] = c.b
          if (mesh.instanceColor) {
            mesh.instanceColor.needsUpdate = true
          }
          continue
        }

        dummy.position.set(x, 0, z)
        dummy.scale.set(1, scaleY, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(idx, dummy.matrix)

        // Update color: parity cols are dimmer
        const c = new THREE.Color()
        const colorIdx = col < DATA_COLS ? col : col - DATA_COLS
        c.set(DATA_COLORS[colorIdx])
        if (isParity) {
          c.multiplyScalar(0.4 + 0.6 * opacity)
        } else if (phase === 2) {
          c.multiplyScalar(opacity)
        }
        cellColors[idx * 3] = c.r
        cellColors[idx * 3 + 1] = c.g
        cellColors[idx * 3 + 2] = c.b
      }
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ROWS * TOTAL_COLS]}>
      <boxGeometry args={[CELL_SIZE, CELL_SIZE * 0.6, CELL_SIZE]} />
      <meshStandardMaterial vertexColors roughness={0.5} />
    </instancedMesh>
  )
}

/** Check if a column is primarily sampled by offline validators */
function isColumnOffline(col: number): boolean {
  // A column is "offline" if it's only sampled by offline validators
  for (let v = 0; v < VALIDATOR_COUNT; v++) {
    if (OFFLINE_VALIDATORS.has(v)) continue
    const [s1, s2] = VALIDATOR_SAMPLES[v]
    if (s1 === col || s2 === col) return false
  }
  return true
}

/* ------------------------------------------------------------------ */
/*  Parity Stripe Overlay (translucent striped effect on parity cols)  */
/* ------------------------------------------------------------------ */

function ParityStripes({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const STRIPE_COUNT = PARITY_COLS * ROWS

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (reducedMotion) {
      // Show stripes on parity cols in final state
      for (let row = 0; row < ROWS; row++) {
        for (let pc = 0; pc < PARITY_COLS; pc++) {
          const idx = row * PARITY_COLS + pc
          const col = DATA_COLS + pc
          const [x, , z] = cellPos(row, col, TOTAL_COLS)
          dummy.position.set(x, CELL_SIZE * 0.31, z)
          dummy.scale.set(1, 1, 1)
          dummy.updateMatrix()
          mesh.setMatrixAt(idx, dummy.matrix)
        }
      }
      mesh.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    for (let row = 0; row < ROWS; row++) {
      for (let pc = 0; pc < PARITY_COLS; pc++) {
        const idx = row * PARITY_COLS + pc
        const col = DATA_COLS + pc

        if (phase === 0) {
          // Hidden in phase 1
          dummy.position.set(0, -10, 0)
          dummy.scale.set(0, 0, 0)
        } else if (phase === 1) {
          // Slide in with grid expansion
          const slideProgress = smoothstep(phaseT)
          const [targetX, , targetZ] = cellPos(row, col, TOTAL_COLS)
          const startX = targetX + 3
          const x = startX + (targetX - startX) * slideProgress
          dummy.position.set(x, CELL_SIZE * 0.31, targetZ)
          dummy.scale.set(slideProgress, slideProgress, slideProgress)
        } else {
          const [x, , z] = cellPos(row, col, TOTAL_COLS)
          dummy.position.set(x, CELL_SIZE * 0.31, z)
          dummy.scale.set(1, 1, 1)
        }

        dummy.updateMatrix()
        mesh.setMatrixAt(idx, dummy.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, STRIPE_COUNT]}>
      <boxGeometry args={[CELL_SIZE * 0.8, 0.02, CELL_SIZE * 0.15]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Validator Nodes (spheres in a ring)                                */
/* ------------------------------------------------------------------ */

function ValidatorNodes({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const colorBuffer = useMemo(() => new Float32Array(VALIDATOR_COUNT * 3), [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (reducedMotion) {
      // Show all validators, offline ones red, online ones green
      const c = new THREE.Color()
      for (let v = 0; v < VALIDATOR_COUNT; v++) {
        const [x, , z] = validatorPos(v)
        dummy.position.set(x, 0.15, z)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        mesh.setMatrixAt(v, dummy.matrix)

        const isOffline = OFFLINE_VALIDATORS.has(v)
        c.set(isOffline ? COL_RED : COL_GREEN)
        colorBuffer[v * 3] = c.r
        colorBuffer[v * 3 + 1] = c.g
        colorBuffer[v * 3 + 2] = c.b
      }
      mesh.instanceMatrix.needsUpdate = true
      if (!mesh.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuffer, 3)
      } else {
        mesh.instanceColor.needsUpdate = true
      }
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR
    const c = new THREE.Color()

    for (let v = 0; v < VALIDATOR_COUNT; v++) {
      const [x, , z] = validatorPos(v)
      const isOffline = OFFLINE_VALIDATORS.has(v)

      if (phase < 2) {
        // Phases 1-2: validators not yet visible, hide offscreen
        dummy.position.set(x, -10, z)
        dummy.scale.set(0, 0, 0)
        c.set(COL_GREEN)
      } else if (phase === 2) {
        // Phase 3: validators appear, then some go offline
        const appearT = smoothstep(Math.min(1, phaseT * 3)) // appear in first third
        dummy.position.set(x, 0.15, z)
        dummy.scale.setScalar(appearT)

        if (isOffline && phaseT > 0.5) {
          const offlineT = smoothstep((phaseT - 0.5) * 2)
          c.set(COL_GREEN).lerp(new THREE.Color(COL_RED), offlineT)
          // Shrink slightly
          dummy.scale.setScalar(appearT * (1.0 - offlineT * 0.3))
        } else {
          c.set(COL_GREEN)
        }
      } else {
        // Phase 4: online validators glow, offline stay red
        dummy.position.set(x, 0.15, z)
        if (isOffline) {
          c.set(COL_RED)
          dummy.scale.setScalar(0.7)
        } else {
          c.set(COL_GREEN)
          const pulse = 1.0 + 0.08 * Math.sin(phaseT * Math.PI * 6 + v)
          dummy.scale.setScalar(pulse)
        }
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(v, dummy.matrix)
      colorBuffer[v * 3] = c.r
      colorBuffer[v * 3 + 1] = c.g
      colorBuffer[v * 3 + 2] = c.b
    }

    mesh.instanceMatrix.needsUpdate = true
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuffer, 3)
    } else {
      mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, VALIDATOR_COUNT]}>
      <sphereGeometry args={[0.15, 16, 12]} />
      <meshStandardMaterial vertexColors roughness={0.4} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Validator Labels (V1-V8)                                           */
/* ------------------------------------------------------------------ */

function ValidatorLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (reducedMotion) {
      groupRef.current.visible = true
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    // Only visible from phase 3 onwards
    groupRef.current.visible = phase >= 2 && (phase > 2 || phaseT > 0.15)
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: VALIDATOR_COUNT }, (_, v) => {
        const [x, , z] = validatorPos(v)
        const isOffline = OFFLINE_VALIDATORS.has(v)
        return (
          <Html
            key={v}
            center
            position={[x, 0.45, z]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <p
              className="text-[9px] font-bold font-mono whitespace-nowrap"
              style={{ color: isOffline ? COL_RED : COL_GREEN }}
            >
              V{v + 1}{isOffline ? ' ✕' : ''}
            </p>
          </Html>
        )
      })}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Sample Lines (connecting validators to their sampled columns)      */
/* ------------------------------------------------------------------ */

function SampleLines({ reducedMotion }: { reducedMotion: boolean }) {
  // Each validator has 2 lines → 16 total
  const LINE_COUNT = VALIDATOR_COUNT * 2
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])

  const lineData = useMemo(() => {
    return Array.from({ length: LINE_COUNT }, (_, i) => {
      const v = Math.floor(i / 2)
      const sampleIdx = i % 2
      const col = VALIDATOR_SAMPLES[v][sampleIdx]
      const [vx, , vz] = validatorPos(v)
      const start = new THREE.Vector3(vx, 0.15, vz)
      // Target is column center at row midpoint
      const cx = colCenterX(col, TOTAL_COLS)
      const end = new THREE.Vector3(cx, 0, 0) // center of grid
      const mid = start.clone().lerp(end, 0.5)
      const dir = end.clone().sub(start)
      const len = dir.length()
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir.normalize())
      return { mid, len, quat, validatorIdx: v }
    })
  }, [up])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (reducedMotion) {
      // Show lines for online validators only
      for (let i = 0; i < LINE_COUNT; i++) {
        const { mid, len, quat, validatorIdx } = lineData[i]
        if (OFFLINE_VALIDATORS.has(validatorIdx)) {
          dummy.position.set(0, -10, 0)
          dummy.scale.set(0, 0, 0)
        } else {
          dummy.position.copy(mid)
          dummy.quaternion.copy(quat)
          dummy.scale.set(0.01, len, 0.01)
        }
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    for (let i = 0; i < LINE_COUNT; i++) {
      const { mid, len, quat, validatorIdx } = lineData[i]
      const isOffline = OFFLINE_VALIDATORS.has(validatorIdx)

      if (phase < 2) {
        dummy.position.set(0, -10, 0)
        dummy.scale.set(0, 0, 0)
      } else if (phase === 2) {
        // Lines appear after validators (after first third)
        const lineAppearT = smoothstep(Math.max(0, (phaseT - 0.2) * 2))
        if (isOffline && phaseT > 0.5) {
          // Fade out for offline validators
          const fadeT = smoothstep((phaseT - 0.5) * 2)
          const s = lineAppearT * (1.0 - fadeT)
          dummy.position.copy(mid)
          dummy.quaternion.copy(quat)
          dummy.scale.set(0.01 * s, len * Math.max(0.01, s), 0.01 * s)
        } else {
          dummy.position.copy(mid)
          dummy.quaternion.copy(quat)
          dummy.scale.set(0.01 * lineAppearT, len * Math.max(0.01, lineAppearT), 0.01 * lineAppearT)
        }
      } else {
        // Phase 4: only online validator lines visible
        if (isOffline) {
          dummy.position.set(0, -10, 0)
          dummy.scale.set(0, 0, 0)
        } else {
          dummy.position.copy(mid)
          dummy.quaternion.copy(quat)
          dummy.scale.set(0.01, len, 0.01)
        }
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, LINE_COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={COL_GREEN} transparent opacity={0.3} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Column Highlight Glow (glowing columns for online validators)      */
/* ------------------------------------------------------------------ */

function ColumnGlows({ reducedMotion }: { reducedMotion: boolean }) {
  // One glow plane per column (8 total)
  const meshRef = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const elapsedRef = useRef(0)

  const colorBuffer = useMemo(() => new Float32Array(TOTAL_COLS * 3), [])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (reducedMotion) {
      const c = new THREE.Color()
      for (let col = 0; col < TOTAL_COLS; col++) {
        const cx = colCenterX(col, TOTAL_COLS)
        const gridH = ROWS * CELL_SIZE + (ROWS - 1) * GAP
        dummy.position.set(cx, -0.01, 0)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.set(1, 1, 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(col, dummy.matrix)
        c.set(COL_GREEN)
        colorBuffer[col * 3] = c.r
        colorBuffer[col * 3 + 1] = c.g
        colorBuffer[col * 3 + 2] = c.b
      }
      mesh.instanceMatrix.needsUpdate = true
      if (!mesh.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuffer, 3)
      } else {
        mesh.instanceColor.needsUpdate = true
      }
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR
    const c = new THREE.Color()

    for (let col = 0; col < TOTAL_COLS; col++) {
      const isOfflineCol = isColumnOffline(col)

      if (phase < 3) {
        // No glow before phase 4
        dummy.position.set(0, -10, 0)
        dummy.scale.set(0, 0, 0)
      } else {
        // Phase 4: online columns glow green, offline reconstruct
        const cx = colCenterX(col, TOTAL_COLS)
        dummy.position.set(cx, -0.01, 0)
        dummy.rotation.set(-Math.PI / 2, 0, 0)

        if (isOfflineCol) {
          const regenT = smoothstep(phaseT)
          dummy.scale.set(regenT, 1, 1)
          c.set(COL_GREEN).multiplyScalar(0.3 + 0.7 * regenT)
        } else {
          const pulse = 1.0 + 0.1 * Math.sin(phaseT * Math.PI * 4 + col)
          dummy.scale.set(pulse, 1, 1)
          c.set(COL_GREEN)
        }
      }

      dummy.updateMatrix()
      mesh.setMatrixAt(col, dummy.matrix)
      colorBuffer[col * 3] = c.r
      colorBuffer[col * 3 + 1] = c.g
      colorBuffer[col * 3 + 2] = c.b
    }

    mesh.instanceMatrix.needsUpdate = true
    if (!mesh.instanceColor) {
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colorBuffer, 3)
    } else {
      mesh.instanceColor.needsUpdate = true
    }
  })

  const gridH = ROWS * CELL_SIZE + (ROWS - 1) * GAP

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_COLS]}>
      <planeGeometry args={[CELL_SIZE + GAP * 0.5, gridH + 0.1]} />
      <meshBasicMaterial vertexColors transparent opacity={0.12} />
    </instancedMesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Progress Bar (Phase 4 reconstruction progress)                     */
/* ------------------------------------------------------------------ */

function ProgressBar({ reducedMotion }: { reducedMotion: boolean }) {
  const barRef = useRef<THREE.Mesh>(null!)
  const bgRef = useRef<THREE.Mesh>(null!)
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)
  const BAR_WIDTH = 2.5
  const BAR_HEIGHT = 0.08

  useFrame((_, delta) => {
    if (!barRef.current || !bgRef.current || !groupRef.current) return

    if (reducedMotion) {
      groupRef.current.visible = true
      barRef.current.scale.x = 1
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    if (phase === 3) {
      groupRef.current.visible = true
      barRef.current.scale.x = smoothstep(phaseT)
      // Shift bar origin to left edge
      barRef.current.position.x = -BAR_WIDTH / 2 + (BAR_WIDTH / 2) * smoothstep(phaseT)
    } else {
      groupRef.current.visible = false
      barRef.current.scale.x = 0
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.01, -1.5]}>
      {/* Background */}
      <mesh ref={bgRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color="#e5e7eb" />
      </mesh>
      {/* Fill */}
      <mesh ref={barRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial color={COL_GREEN} />
      </mesh>
      {/* Label */}
      <Html
        center
        position={[0, 0.05, -0.15]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: COL_GREEN }}>
          Reconstruction
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Checkmark (appears at end of Phase 4)                              */
/* ------------------------------------------------------------------ */

function Checkmark({ reducedMotion }: { reducedMotion: boolean }) {
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (reducedMotion) {
      groupRef.current.visible = true
      groupRef.current.scale.setScalar(1)
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    if (phase === 3 && phaseT > 0.7) {
      groupRef.current.visible = true
      const popT = smoothstep((phaseT - 0.7) / 0.3)
      // Overshoot spring
      const spring = popT < 0.5
        ? popT * 2 * 1.2
        : 1.2 - (popT - 0.5) * 2 * 0.2
      groupRef.current.scale.setScalar(spring)
    } else {
      groupRef.current.visible = false
      groupRef.current.scale.setScalar(0)
    }
  })

  // Build checkmark from two boxes (the two strokes of a check)
  return (
    <group ref={groupRef} position={[0, 1.2, 0]}>
      {/* Circle background */}
      <mesh>
        <circleGeometry args={[0.25, 24]} />
        <meshBasicMaterial color={COL_GREEN} />
      </mesh>
      {/* Short stroke */}
      <mesh position={[-0.06, -0.02, 0.01]} rotation={[0, 0, Math.PI / 4]}>
        <planeGeometry args={[0.1, 0.04]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Long stroke */}
      <mesh position={[0.06, 0.03, 0.01]} rotation={[0, 0, -Math.PI / 4]}>
        <planeGeometry args={[0.2, 0.04]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Phase Label (changes text with each phase)                         */
/* ------------------------------------------------------------------ */

function PhaseLabel({ reducedMotion }: { reducedMotion: boolean }) {
  const labelRef = useRef<HTMLParagraphElement>(null)
  const sublabelRef = useRef<HTMLParagraphElement>(null)
  const elapsedRef = useRef(0)

  const phases = useMemo(() => [
    { text: 'Original: 4 columns', sub: 'Raw data', color: COL_BLUE },
    { text: 'Encoded: 4 data + 4 parity', sub: 'Reed-Solomon expansion', color: COL_PURPLE },
    { text: 'Validators sample columns', sub: '4 of 8 go offline', color: COL_AMBER },
    { text: '50% online → 100% reconstruction', sub: 'Full recovery from half the data', color: COL_GREEN },
  ], [])

  useFrame((_, delta) => {
    if (!labelRef.current || !sublabelRef.current) return
    if (reducedMotion) {
      labelRef.current.textContent = phases[3].text
      labelRef.current.style.color = phases[3].color
      sublabelRef.current.textContent = phases[3].sub
      sublabelRef.current.style.color = '#71717a'
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const idx = Math.min(Math.floor(t / PHASE_DUR), 3)
    const phase = phases[idx]

    if (labelRef.current.textContent !== phase.text) {
      labelRef.current.textContent = phase.text
      labelRef.current.style.color = phase.color
    }
    if (sublabelRef.current.textContent !== phase.sub) {
      sublabelRef.current.textContent = phase.sub
      sublabelRef.current.style.color = '#71717a'
    }
  })

  return (
    <Html
      center
      position={[0, 2.0, 0]}
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div className="text-center">
        <p
          ref={labelRef}
          className="text-[13px] font-bold font-mono whitespace-nowrap"
          style={{ color: COL_BLUE }}
        >
          Original: 4 columns
        </p>
        <p
          ref={sublabelRef}
          className="text-[10px] mt-0.5 whitespace-nowrap"
          style={{ color: '#71717a' }}
        >
          Raw data
        </p>
      </div>
    </Html>
  )
}

/* ------------------------------------------------------------------ */
/*  Column Count Labels (below grid)                                   */
/* ------------------------------------------------------------------ */

function ColumnCountLabels({ reducedMotion }: { reducedMotion: boolean }) {
  const dataRef = useRef<HTMLParagraphElement>(null)
  const parityRef = useRef<HTMLParagraphElement>(null)
  const groupRef = useRef<THREE.Group>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return
    if (reducedMotion) {
      groupRef.current.visible = true
      return
    }
    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    // Show from phase 2 onwards
    groupRef.current.visible = phase >= 1
  })

  // Position labels below the data and parity halves of the 8-col grid
  const gridW = TOTAL_COLS * CELL_SIZE + (TOTAL_COLS - 1) * GAP
  const halfW = gridW / 2
  const dataCenter = -halfW / 2
  const parityCenter = halfW / 2

  return (
    <group ref={groupRef}>
      <Html
        center
        position={[dataCenter, -0.02, 1.2]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p ref={dataRef} className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: COL_BLUE }}>
          Data
        </p>
      </Html>
      <Html
        center
        position={[parityCenter, -0.02, 1.2]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <p ref={parityRef} className="text-[9px] font-bold font-mono whitespace-nowrap" style={{ color: COL_PURPLE }}>
          Parity
        </p>
      </Html>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/*  Ground Plane                                                       */
/* ------------------------------------------------------------------ */

function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.15, 0]}>
      <planeGeometry args={[14, 14]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  )
}

/* ------------------------------------------------------------------ */
/*  Grid Platform (subtle raised surface under the grid)               */
/* ------------------------------------------------------------------ */

function GridPlatform({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const elapsedRef = useRef(0)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    if (reducedMotion) {
      const gridW = TOTAL_COLS * CELL_SIZE + (TOTAL_COLS - 1) * GAP + 0.3
      const gridH = ROWS * CELL_SIZE + (ROWS - 1) * GAP + 0.3
      meshRef.current.scale.set(gridW / 4, 1, gridH / 4)
      return
    }

    elapsedRef.current += delta
    const t = elapsedRef.current % CYCLE
    const phase = Math.floor(t / PHASE_DUR)
    const phaseT = (t % PHASE_DUR) / PHASE_DUR

    const dataW = DATA_COLS * CELL_SIZE + (DATA_COLS - 1) * GAP + 0.3
    const fullW = TOTAL_COLS * CELL_SIZE + (TOTAL_COLS - 1) * GAP + 0.3
    const gridH = ROWS * CELL_SIZE + (ROWS - 1) * GAP + 0.3

    let w: number
    if (phase === 0) {
      w = dataW
    } else if (phase === 1) {
      w = dataW + (fullW - dataW) * smoothstep(phaseT)
    } else {
      w = fullW
    }

    meshRef.current.scale.set(w / 4, 1, gridH / 4)
  })

  return (
    <RoundedBox ref={meshRef} args={[4, 0.04, 4]} radius={0.015} smoothness={4} position={[0, -0.12, 0]}>
      <meshStandardMaterial color="#f8fafc" roughness={0.8} />
    </RoundedBox>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Scene                                                         */
/* ------------------------------------------------------------------ */

function Scene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <GroundPlane />
      <GridPlatform reducedMotion={reducedMotion} />
      <DataGrid reducedMotion={reducedMotion} />
      <ParityStripes reducedMotion={reducedMotion} />
      <ValidatorNodes reducedMotion={reducedMotion} />
      <ValidatorLabels reducedMotion={reducedMotion} />
      <SampleLines reducedMotion={reducedMotion} />
      <ColumnGlows reducedMotion={reducedMotion} />
      <ProgressBar reducedMotion={reducedMotion} />
      <Checkmark reducedMotion={reducedMotion} />
      <PhaseLabel reducedMotion={reducedMotion} />
      <ColumnCountLabels reducedMotion={reducedMotion} />
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Legend                                                              */
/* ------------------------------------------------------------------ */

function Legend() {
  return (
    <div className="flex items-center gap-5">
      <div className="flex items-center gap-1.5">
        <div className="flex gap-px">
          <div className="w-1.5 h-2 rounded-sm" style={{ backgroundColor: COL_BLUE }} />
          <div className="w-1.5 h-2 rounded-sm" style={{ backgroundColor: COL_GREEN }} />
        </div>
        <span className="text-[10px] text-text-muted tracking-wide">Data</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-2 rounded-sm opacity-40" style={{ backgroundColor: COL_PURPLE }} />
        <span className="text-[10px] text-text-muted tracking-wide">Parity</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COL_GREEN }} />
        <span className="text-[10px] text-text-muted tracking-wide">Online</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COL_RED }} />
        <span className="text-[10px] text-text-muted tracking-wide">Offline</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Exported Component                                                 */
/* ------------------------------------------------------------------ */

export function ErasureCoding3D() {
  return (
    <SceneContainer
      height="h-[340px] md:h-[400px]"
      ariaLabel="Reed-Solomon erasure coding: data expands with parity, validators sample columns, 50% can reconstruct full data"
      srDescription="A 4-phase animation showing erasure coding. Phase 1: 4x4 data grid. Phase 2: grid expands to 4x8 with parity columns. Phase 3: 8 validators sample columns, 4 go offline. Phase 4: remaining 4 validators reconstruct the full dataset."
      legend={<Legend />}
      fallbackText="Erasure coding — 4 data columns + 4 parity columns, any 50% reconstructs the full dataset"
    >
      {({ reducedMotion }) => (
        <Canvas
          flat
          camera={{ position: [0, 6, 8], fov: 36 }}
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
            enableZoom
            minDistance={3}
            maxDistance={18}
            enablePan={false}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={Math.PI / 3}
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
