'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Environment, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { LinkMenu } from './LinkMenu'

const MODEL_URL = '/models/tabletop_macbook_iphone.opt.glb'
useGLTF.preload(MODEL_URL)

type TiltRef = React.MutableRefObject<{ x: number; y: number }>

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
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, tilt.current.x, 0.1)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tilt.current.y, 0.1)
  })

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
      <Html
        transform
        position={[0, 0, -0.09]}
        rotation={[0, Math.PI, 0]}
        scale={0.0042}
        occlude={false}
        zIndexRange={[1, 0]}
        style={{ pointerEvents: 'auto' }}
        wrapperClass="lt-html-wrapper"
      >
        <LinkMenu />
      </Html>
    </group>
  )
}

export function PhoneLinktree() {
  const tilt = useRef({ x: 0, y: 0 })
  const mouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const apply = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const p = max > 1 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      const scrollYaw = (p - 0.5) * 0.32
      const scrollPitch = (p - 0.5) * 0.12
      tilt.current.x = scrollYaw + mouse.current.x * 0.08
      tilt.current.y = scrollPitch + mouse.current.y * 0.05
    }
    const onScroll = () => apply()
    const onMove = (e: PointerEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2
      apply()
    }
    apply()
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
          --lt-bg: #fafafa;
          --lt-text: #1d1d1f;
          --lt-muted: #6e6e73;
          min-height: 200vh;
          background:
            radial-gradient(60% 50% at 50% 38%, #ffffff 0%, #f5f5f7 60%, #eeeef1 100%);
          color: var(--lt-text);
          font-family: var(--apple-font-display, "SF Pro Display", -apple-system, system-ui, sans-serif);
          letter-spacing: -0.01em;
          position: relative;
        }
        .lt-page::before {
          content: '';
          position: fixed; inset: 0;
          pointer-events: none;
          background:
            radial-gradient(40% 30% at 50% 70%, rgba(0,113,227,0.07) 0%, transparent 70%),
            radial-gradient(30% 24% at 80% 30%, rgba(255,180,80,0.06) 0%, transparent 70%);
        }
        .lt-header {
          position: fixed; top: 0; left: 0; right: 0;
          padding: 18px 24px;
          display: flex; align-items: center; justify-content: space-between;
          z-index: 4;
          font-size: 13px;
          color: var(--lt-muted);
          mix-blend-mode: multiply;
        }
        .lt-back {
          color: var(--lt-text);
          text-decoration: none;
          font-weight: 500;
          letter-spacing: -0.01em;
          opacity: 0.8;
          transition: opacity 200ms cubic-bezier(0.25,1,0.5,1);
        }
        .lt-back:hover { opacity: 1; }
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
        .lt-credit {
          position: relative;
          z-index: 2;
          padding: 96px 24px 56px;
          text-align: center;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--lt-muted);
        }
        .lt-credit a {
          color: inherit; text-decoration: none;
        }
        .lt-credit a:hover { color: var(--lt-text); }
        @media (max-width: 720px) {
          .lt-page { min-height: 160vh; }
        }
      `}</style>

      <header className="lt-header">
        <a className="lt-back" href="/">← generalmarket.io</a>
        <span>Anti-cheat trading.</span>
      </header>

      <div className="lt-stage">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, -5], fov: 38 }}
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
            <Environment preset="studio" environmentIntensity={1.4} />
            <ambientLight intensity={0.45} />
            <directionalLight position={[3, 6, -4]} intensity={2.0} />
            <directionalLight position={[-3, 4, 3]} intensity={0.6} color="#c0d0e8" />
            <ContactShadows
              position={[0, -1.75, 0]}
              opacity={0.32}
              scale={6}
              blur={2}
              far={5}
            />
          </Suspense>
        </Canvas>
      </div>

      <footer className="lt-credit">
        © 2026 General Market · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a>
      </footer>
    </main>
  )
}
