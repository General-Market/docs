'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { LinkMenu } from './LinkMenu'

const MODEL_URL = '/models/tabletop_macbook_iphone.opt.glb'
useGLTF.preload(MODEL_URL)

// Phone is roughly 3.4 units tall after the GLB scale of 22.486.
// Top 40% spans ~1.36 units; we move the phone up by ±1.36 so scrolling
// drives the camera through the menu instead of past empty page.
const SCROLL_TRAVEL = 1.36
const PHONE_TOP_OFFSET = -SCROLL_TRAVEL

type TiltRef = React.MutableRefObject<{
  scrollProgress: number
  yaw: number
  pitch: number
}>

function PhoneScene({ tilt }: { tilt: TiltRef }) {
  const gltf = useGLTF(MODEL_URL)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    const iphone = gltf.scene.getObjectByName('iphone')
    if (!iphone) return
    const ours = new Set<THREE.Object3D>()
    iphone.traverse((c) => ours.add(c))
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.visible = ours.has(child)
    })
    iphone.position.set(0, 0, 0)
    iphone.quaternion.identity()
    iphone.scale.setScalar(22.486)
  }, [gltf])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const targetY = PHONE_TOP_OFFSET + tilt.current.scrollProgress * SCROLL_TRAVEL * 2
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, 0.12)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, tilt.current.yaw, 0.1)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tilt.current.pitch, 0.1)
  })

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
      <ContactShadows
        position={[0, -1.78, 0]}
        opacity={0.3}
        scale={6}
        blur={2.2}
        far={4}
      />
      <Html
        transform
        position={[0, 0, -0.085]}
        rotation={[0, Math.PI, 0]}
        scale={0.0042}
        occlude={false}
        zIndexRange={[1, 0]}
        wrapperClass="lt-html-wrapper"
      >
        <LinkMenu />
      </Html>
    </group>
  )
}

export function PhoneLinktree() {
  const tilt = useRef({ scrollProgress: 0, yaw: 0, pitch: 0 })

  useEffect(() => {
    const onScroll = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      tilt.current.scrollProgress = max > 1
        ? Math.min(1, Math.max(0, window.scrollY / max))
        : 0
    }
    const onMove = (e: PointerEvent) => {
      const mx = (e.clientX / window.innerWidth - 0.5) * 2
      const my = (e.clientY / window.innerHeight - 0.5) * 2
      tilt.current.yaw = mx * 0.10
      tilt.current.pitch = my * 0.05
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return (
    <main className="lt-page">
      <style>{`
        .lt-page {
          min-height: 240vh;
          background:
            radial-gradient(70% 60% at 50% 38%, #ffffff 0%, #f4f4f6 65%, #ececef 100%);
          color: #1d1d1f;
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          letter-spacing: -0.01em;
          position: relative;
        }
        .lt-page::before {
          content: '';
          position: fixed; inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(40% 30% at 50% 78%, rgba(0,113,227,0.05) 0%, transparent 70%),
            radial-gradient(28% 22% at 82% 30%, rgba(255,180,80,0.05) 0%, transparent 70%);
        }
        .lt-stage {
          position: sticky;
          top: 0;
          width: 100%;
          height: 100vh;
          z-index: 1;
        }
        .lt-stage canvas { touch-action: none; }
        .lt-html-wrapper { pointer-events: none; }
        .lt-html-wrapper > div { pointer-events: auto; }
      `}</style>

      <div className="lt-stage">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, -2.55], fov: 30 }}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <PhoneScene tilt={tilt} />
            <hemisphereLight args={['#ffffff', '#dde3ec', 0.9]} />
            <ambientLight intensity={0.55} />
            <directionalLight position={[3, 6, -4]} intensity={2.2} />
            <directionalLight position={[-4, 3, 4]} intensity={0.8} color="#c8d4ea" />
            <directionalLight position={[0, -2, -3]} intensity={0.35} color="#fff1d6" />
          </Suspense>
        </Canvas>
      </div>
    </main>
  )
}
