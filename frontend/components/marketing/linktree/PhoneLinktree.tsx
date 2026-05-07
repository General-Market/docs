'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { LinkMenu } from './LinkMenu'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

const MODEL_URL = '/models/tabletop_macbook_iphone.opt.glb'
useGLTF.preload(MODEL_URL)

type Responsive = {
  distance: number
  topOffset: number
  scrollTravel: number
}

// LinkMenu CSS width in px — must stay in sync with .lt-menu width.
const LINK_MENU_CSS_WIDTH = 360
// drei Html with `transform` divides matrix scale by 40 internally.
const HTML_TRANSFORM_DIVISOR = 40

function readResponsive(): Responsive {
  // The phone should sit in the page like a normal centered linktree column —
  // fully visible, comfortably sized, with a faint scroll-driven slide.
  if (typeof window === 'undefined') {
    return { distance: 8.5, topOffset: 0, scrollTravel: 0.5 }
  }
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  if (aspect >= 1.2) {
    return { distance: 8.5, topOffset: 0, scrollTravel: 0.5 }
  }
  if (aspect >= 0.7) {
    return { distance: 9.6, topOffset: 0, scrollTravel: 0.45 }
  }
  return { distance: 10.2, topOffset: 0, scrollTravel: 0.4 }
}

// Find the iPhone screen mesh by the same fingerprint DeviceBroll uses:
// the only material with an emissiveMap and no baseColor `map`. Skips
// array materials. Returns the first match.
function findPhoneScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null
  root.traverse((child) => {
    if (found) return
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    if (Array.isArray(mesh.material)) return
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined
    if (mat && mat.emissiveMap && !mat.map) {
      found = mesh
    }
  })
  return found
}

type ScreenFit = {
  position: [number, number, number]
  scale: number
}

type TiltRef = React.MutableRefObject<{
  scrollProgress: number
  yaw: number
  pitch: number
}>

function CameraRig({ distance }: { distance: number }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 0, -distance)
    camera.lookAt(0, 0, 0)
    if (camera instanceof THREE.PerspectiveCamera) camera.updateProjectionMatrix()
  }, [camera, distance])
  return null
}

function PhoneScene({
  tilt,
  responsive,
  onReady,
}: {
  tilt: TiltRef
  responsive: Responsive
  onReady: () => void
}) {
  const gltf = useGLTF(MODEL_URL)
  const groupRef = useRef<THREE.Group>(null)
  const [screenFit, setScreenFit] = useState<ScreenFit | null>(null)

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
    iphone.updateMatrixWorld(true)

    // Measure the actual screen face from the GLB so the Html overlay
    // is bezel-perfect, not eyeballed.
    const screenMesh = findPhoneScreenMesh(iphone)
    if (screenMesh) {
      if (!screenMesh.geometry.boundingBox) screenMesh.geometry.computeBoundingBox()
      const box = screenMesh.geometry.boundingBox!
        .clone()
        .applyMatrix4(screenMesh.matrixWorld)
      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)
      // Screen normal points toward -Z (camera sits at -distance). Lift
      // the html a hair in front of the glass to avoid z-fighting.
      const htmlScale = (size.x * HTML_TRANSFORM_DIVISOR) / LINK_MENU_CSS_WIDTH
      setScreenFit({
        position: [center.x, center.y, center.z - 0.001],
        scale: htmlScale,
      })
    }

    onReady()
  }, [gltf, onReady])

  useFrame(() => {
    const g = groupRef.current
    if (!g) return
    const targetY = responsive.topOffset + tilt.current.scrollProgress * responsive.scrollTravel
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, 0.12)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, tilt.current.yaw, 0.1)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tilt.current.pitch, 0.1)
  })

  return (
    <group ref={groupRef}>
      <primitive object={gltf.scene} />
      <ContactShadows
        position={[0, -1.78, 0]}
        opacity={0.28}
        scale={6}
        blur={2.2}
        far={4}
      />
      {screenFit && (
        <Html
          transform
          position={screenFit.position}
          rotation={[0, Math.PI, 0]}
          scale={screenFit.scale}
          occlude={false}
          zIndexRange={[1, 0]}
          wrapperClass="lt-html-wrapper"
        >
          <LinkMenu />
        </Html>
      )}
    </group>
  )
}

export function PhoneLinktree() {
  const tilt = useRef({ scrollProgress: 0, yaw: 0, pitch: 0 })
  const [responsive, setResponsive] = useState<Responsive>(() => readResponsive())
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const update = () => setResponsive(readResponsive())
    update()
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])

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

  // Page tall enough to give scroll room without trapping the user
  // on tiny mobile viewports where most of the phone is already visible.
  // Phone is fully in frame — keep page modest so the slide is gentle.
  const pageHeight = '140vh'

  return (
    <main className="lt-page" style={{ minHeight: pageHeight }}>
      <div
        className="lt-loader"
        aria-hidden={ready}
        style={{ opacity: ready ? 0 : 1, pointerEvents: ready ? 'none' : 'auto' }}
      >
        <GeneralLoader height="100vh" />
      </div>
      <style>{`
        .lt-page {
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
        .lt-stage canvas { touch-action: pan-y; }
        .lt-html-wrapper { pointer-events: none; }
        .lt-html-wrapper > div { pointer-events: auto; }
        .lt-loader {
          position: fixed; inset: 0;
          background: radial-gradient(70% 60% at 50% 38%, #ffffff 0%, #f4f4f6 65%, #ececef 100%);
          z-index: 50;
          display: grid; place-items: center;
          transition: opacity 380ms cubic-bezier(0.4, 0, 0.6, 1);
        }
      `}</style>

      <div className="lt-stage">
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 0, -responsive.distance], fov: 30 }}
          gl={{
            antialias: true,
            alpha: true,
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          style={{ background: 'transparent' }}
        >
          <CameraRig distance={responsive.distance} />
          <Suspense fallback={null}>
            <PhoneScene tilt={tilt} responsive={responsive} onReady={() => setReady(true)} />
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
