'use client'

import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { ClientOnly } from './ClientOnly'

const EIPS = [
  { year: '2016', name: 'EIP-86', sub: 'Let contracts pay gas', status: 'too radical', height: 0.35, color: '#d4d4d8' },
  { year: '2020', name: 'EIP-2938', sub: 'AA at protocol layer', status: 'never shipped', height: 0.45, color: '#d4d4d8' },
  { year: '2021', name: 'ERC-4337', sub: 'Off-chain bundler', status: 'works but complex', height: 0.6, color: '#a1a1aa' },
  { year: '2023', name: 'EIP-3074', sub: 'AUTH + AUTHCALL', status: 'superseded', height: 0.5, color: '#a1a1aa' },
  { year: '2024', name: 'EIP-7702', sub: 'Set EOA code', status: 'stepping stone', height: 0.7, color: '#71717a' },
  { year: '2026', name: 'EIP-8141', sub: 'Frame Transactions', status: 'THE OMNIBUS', height: 1.2, color: '#22c55e' },
]

const PILLAR_COUNT = EIPS.length
const X_MIN = -2.5
const X_MAX = 2.5

function pillarX(i: number) {
  return X_MIN + (i / (PILLAR_COUNT - 1)) * (X_MAX - X_MIN)
}

function Pillar({ eip, index }: { eip: typeof EIPS[number]; index: number }) {
  const ref = useRef<THREE.Group>(null!)
  const x = pillarX(index)
  const isLast = index === PILLAR_COUNT - 1
  const w = 0.4, d = 0.4, h = eip.height

  useFrame(({ clock }) => {
    if (isLast) {
      const t = clock.getElapsedTime()
      const s = 1.0 + 0.03 * Math.sin(t * 1.5)
      ref.current.scale.set(s, s, s)
    }
  })

  return (
    <group ref={ref} position={[x, h / 2, 0]}>
      {/* Main pillar */}
      <RoundedBox args={[w, h, d]} radius={0.03} smoothness={4} castShadow>
        <meshStandardMaterial color={eip.color} roughness={0.6} />
      </RoundedBox>

      {/* Top accent plane for EIP-8141 */}
      {isLast && (
        <mesh position={[0, h / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w - 0.02, d - 0.02]} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Label above pillar */}
      <Html center position={[0, h / 2 + 0.28, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div className="text-center">
          <p className="text-[10px] text-zinc-400 font-mono">{eip.year}</p>
          <p className="text-[12px] font-bold text-black tracking-tight whitespace-nowrap">{eip.name}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5 whitespace-nowrap">{eip.sub}</p>
          <p className={`text-[8px] mt-0.5 font-semibold tracking-wide uppercase whitespace-nowrap ${isLast ? 'text-green-600' : 'text-zinc-400'}`}>
            {eip.status}
          </p>
        </div>
      </Html>
    </group>
  )
}

function GroundCurve() {
  const points = useMemo(() =>
    EIPS.map((_, i) => new THREE.Vector3(pillarX(i), 0.01, 0)),
  [])

  const curve = useMemo(() =>
    new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5),
  [points])

  const tubeGeo = useMemo(() =>
    new THREE.TubeGeometry(curve, 64, 0.02, 8, false),
  [curve])

  return (
    <mesh geometry={tubeGeo}>
      <meshStandardMaterial color="#a1a1aa" roughness={0.4} />
    </mesh>
  )
}

function CurveParticles({ count = 16 }: { count?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const points = useMemo(() =>
    EIPS.map((_, i) => new THREE.Vector3(pillarX(i), 0.01, 0)),
  [])

  const curve = useMemo(() =>
    new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5),
  [points])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    for (let i = 0; i < count; i++) {
      const p = ((t * 0.08 + i / count) % 1)
      dummy.position.copy(curve.getPoint(p))
      dummy.position.y += 0.02
      dummy.scale.setScalar(0.02 * Math.sin(p * Math.PI))
      dummy.updateMatrix()
      ref.current.setMatrixAt(i, dummy.matrix)
    }
    ref.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color="#22c55e" transparent opacity={0.6} />
    </instancedMesh>
  )
}

export function EIPTimeline3D() {
  return (
    <div className="my-12 -mx-4 md:-mx-8">
      <div className="bg-white border-t-[3px] border-b border-black border-b-border-light">
        <div className="h-[340px] md:h-[400px] cursor-grab active:cursor-grabbing">
          <ClientOnly fallback={<div className="h-full animate-pulse bg-zinc-50" />}>
            <Canvas flat camera={{ position: [0, 4, 7], fov: 36 }} dpr={[1, 2]} gl={{ antialias: true }}>
              <color attach="background" args={['#ffffff']} />
              <ambientLight intensity={1.2} />
              <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
              <directionalLight position={[-3, 6, -2]} intensity={0.3} />

              {/* Solid white floor */}
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>

              {/* Pillars */}
              {EIPS.map((eip, i) => (
                <Pillar key={eip.name} eip={eip} index={i} />
              ))}

              {/* Ground curve connecting bases */}
              <GroundCurve />
              <CurveParticles count={16} />

              <OrbitControls
                enableZoom={false}
                enablePan={false}
                minPolarAngle={Math.PI / 8}
                maxPolarAngle={Math.PI / 2.3}
                autoRotate
                autoRotateSpeed={0.4}
                dampingFactor={0.05}
              />
            </Canvas>
          </ClientOnly>
        </div>
        <div className="px-6 pb-3 pt-1 flex items-center justify-between border-t border-zinc-200">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-zinc-300 border border-zinc-400" />
              <span className="text-[10px] text-text-muted tracking-wide">Attempted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 rounded-sm bg-green-500 border border-green-600" />
              <span className="text-[10px] text-text-muted tracking-wide">THE OMNIBUS</span>
            </div>
          </div>
          <span className="text-[10px] text-text-muted font-mono">drag to orbit</span>
        </div>
      </div>
    </div>
  )
}
