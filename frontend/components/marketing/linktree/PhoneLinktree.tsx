'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { LinkMenu } from './LinkMenu'
import type { LinktreeIcon } from './links'
import { GeneralLoader } from '@/components/ui/GeneralLoader'

const MODEL_URL = '/models/tabletop_macbook_iphone.opt.glb'
useGLTF.preload(MODEL_URL)

// How long the phone spins-and-flies before navigation fires.
const LEAVE_DURATION_MS = 720
// How long after the leave animation we wait before letting the phone
// drift home for external links (so the user has time to register the
// animation; total round-trip ≈ 1.5s).
const RETURN_AFTER_LEAVE_MS = 800

// One transform recipe per button, so each link feels distinct on click.
type LeaveTransform = {
  posX: number
  posY: number
  posZ: number
  rotY: number
  rotX: number
  rotZ: number
}

function leaveTransformFor(style: LinktreeIcon, eased: number, t: number): LeaveTransform {
  switch (style) {
    case 'waitlist':
      // Forward spin, top-right exit, dive toward the camera.
      return {
        posX: eased * 7,
        posY: eased * 4,
        posZ: eased * -1.2,
        rotY: eased * Math.PI * 2.4,
        rotX: eased * -0.35,
        rotZ: eased * -Math.PI * 0.28,
      }
    case 'x':
      // X marks the spot — Z-axis spin like the logo, slingshot right.
      return {
        posX: eased * 9,
        posY: eased * -1.5,
        posZ: eased * -0.6,
        rotY: eased * Math.PI * 1.4,
        rotX: 0,
        rotZ: eased * Math.PI * 3.2,
      }
    case 'discord':
      // Drop in like a chat bubble — wobble + bottom-left dive.
      return {
        posX: eased * -6,
        posY: eased * -5,
        posZ: 0,
        rotY: Math.sin(t * Math.PI * 4) * 0.55 + eased * 0.4,
        rotX: eased * 0.55,
        rotZ: eased * Math.PI * 0.5,
      }
    case 'docs':
      // Open like a book — page-flip on X, recede away.
      return {
        posX: 0,
        posY: eased * -1.4,
        posZ: eased * 3.2,
        rotY: eased * Math.PI * 0.45,
        rotX: eased * Math.PI * 1.4,
        rotZ: 0,
      }
  }
}

type Responsive = {
  distance: number
  topOffset: number
  scrollTravel: number
  /** True when the device has no fine pointer — drives ambient idle tilt. */
  ambient: boolean
}

// LinkMenu CSS width in px — must stay in sync with .lt-menu width.
const LINK_MENU_CSS_WIDTH = 360
// drei Html with `transform` divides matrix scale by 40 internally.
const HTML_TRANSFORM_DIVISOR = 40

function readResponsive(): Responsive {
  // The phone fills the page like a real linktree page does — generously
  // sized on every device, with just a faint scroll-driven slide.
  if (typeof window === 'undefined') {
    return { distance: 7.6, topOffset: 0, scrollTravel: 0.5, ambient: false }
  }
  const aspect = window.innerWidth / Math.max(1, window.innerHeight)
  // Touch devices have no mouse parallax — gyroscope (or sine) takes over.
  const ambient = window.matchMedia('(hover: none), (pointer: coarse)').matches
  if (aspect >= 1.2) {
    return { distance: 7.6, topOffset: 0, scrollTravel: 0.5, ambient }
  }
  if (aspect >= 0.7) {
    return { distance: 7.8, topOffset: 0, scrollTravel: 0.45, ambient }
  }
  return { distance: 8.0, topOffset: 0, scrollTravel: 0.4, ambient }
}

type LeaveRef = React.MutableRefObject<{
  startMs: number
  href: string
  external: boolean
  style: LinktreeIcon
} | null>

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

type TiltRef = React.MutableRefObject<{
  scrollProgress: number
  yaw: number
  pitch: number
  gyroActive: boolean
  gyroYaw: number
  gyroPitch: number
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
  leaving,
  onReady,
  onLinkClick,
}: {
  tilt: TiltRef
  responsive: Responsive
  leaving: LeaveRef
  onReady: () => void
  onLinkClick: (e: React.MouseEvent, href: string, external: boolean, style: LinktreeIcon) => void
}) {
  const gltf = useGLTF(MODEL_URL)
  const groupRef = useRef<THREE.Group>(null)
  const [screenFit, setScreenFit] = useState<{
    position: [number, number, number]
    scale: number
  } | null>(null)

  useEffect(() => {
    const iphone = gltf.scene.getObjectByName('iphone')
    if (!iphone) return
    // Pin the group to identity before measuring so useFrame's lerp
    // doesn't poison the world matrix we're about to read.
    const g = groupRef.current
    if (g) {
      g.position.set(0, 0, 0)
      g.rotation.set(0, 0, 0)
      g.scale.set(1, 1, 1)
      g.updateMatrixWorld(true)
    }
    const ours = new Set<THREE.Object3D>()
    iphone.traverse((c) => ours.add(c))
    gltf.scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) child.visible = ours.has(child)
    })
    iphone.position.set(0, 0, 0)
    iphone.quaternion.identity()
    iphone.scale.setScalar(22.486)
    gltf.scene.updateMatrixWorld(true)

    // Detect iOS Safari — the screen mesh's world position lands a
    // measurable offset to the right vs every other browser, so we
    // nudge the menu back leftward by a fixed world-unit value
    // estimated from a real-device screenshot.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream

    const screenMesh = findPhoneScreenMesh(iphone)
    let fit: { position: [number, number, number]; scale: number }
    if (screenMesh) {
      if (!screenMesh.geometry.boundingBox) screenMesh.geometry.computeBoundingBox()
      const box = screenMesh.geometry.boundingBox!
        .clone()
        .applyMatrix4(screenMesh.matrixWorld)
      const center = new THREE.Vector3()
      const size = new THREE.Vector3()
      box.getCenter(center)
      box.getSize(size)
      const htmlScale = (size.x * HTML_TRANSFORM_DIVISOR) / LINK_MENU_CSS_WIDTH
      // Three.js camera's local +X is world −X here (lookAt(0,0,0) from
      // −Z), so adding to world X moves the menu LEFT on screen. The
      // last try went the wrong way; flipping the sign and dialling
      // back the magnitude based on the user's screenshot of the
      // residual offset.
      const xOffset = isIOS ? 0.45 : 0
      fit = {
        position: [center.x + xOffset, center.y, center.z - 0.001],
        scale: htmlScale,
      }
    } else {
      fit = { position: [0, 0, -0.001], scale: 0.178 }
    }
    setScreenFit(fit)

    onReady()
  }, [gltf, onReady])

  useFrame(({ clock }) => {
    const g = groupRef.current
    if (!g) return

    // Leave animation: each button has its own recipe. Cubic ease-in
    // (slow → fast) mapped through leaveTransformFor.
    const lv = leaving.current
    if (lv) {
      const t = Math.min(1, (performance.now() - lv.startMs) / LEAVE_DURATION_MS)
      const eased = t * t * t
      const f = leaveTransformFor(lv.style, eased, t)
      const baseY = responsive.topOffset + tilt.current.scrollProgress * responsive.scrollTravel
      g.position.x = f.posX
      g.position.y = baseY + f.posY
      g.position.z = f.posZ
      g.rotation.y = f.rotY
      g.rotation.x = f.rotX
      g.rotation.z = f.rotZ
      return
    }

    // Tilt source: gyroscope when granted on touch devices, sine wave
    // as ambient fallback for touch-without-gyro, mouse parallax on desktop.
    const tNow = clock.getElapsedTime()
    let tiltYaw = tilt.current.yaw
    let tiltPitch = tilt.current.pitch
    if (tilt.current.gyroActive) {
      tiltYaw = tilt.current.gyroYaw
      tiltPitch = tilt.current.gyroPitch
    } else if (responsive.ambient) {
      tiltYaw = Math.sin(tNow * 0.45) * 0.09
      tiltPitch = Math.sin(tNow * 0.32 + 1.1) * 0.05
    }

    const targetY = responsive.topOffset + tilt.current.scrollProgress * responsive.scrollTravel
    g.position.y = THREE.MathUtils.lerp(g.position.y, targetY, 0.12)
    g.position.x = THREE.MathUtils.lerp(g.position.x, 0, 0.18)
    g.position.z = THREE.MathUtils.lerp(g.position.z, 0, 0.18)
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, tiltYaw, 0.12)
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, tiltPitch, 0.12)
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, 0, 0.18)
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
          <LinkMenu onLinkClick={onLinkClick} />
        </Html>
      )}
    </group>
  )
}

export function PhoneLinktree() {
  const tilt = useRef({
    scrollProgress: 0,
    yaw: 0,
    pitch: 0,
    gyroActive: false,
    gyroYaw: 0,
    gyroPitch: 0,
  })
  const leaving: LeaveRef = useRef(null)
  const [responsive, setResponsive] = useState<Responsive>(() => readResponsive())
  const [ready, setReady] = useState(false)

  const handleLinkClick = useCallback(
    (e: React.MouseEvent, href: string, external: boolean, style: LinktreeIcon) => {
      e.preventDefault()
      if (leaving.current) return
      leaving.current = { startMs: performance.now(), href, external, style }

      // At t = LEAVE_DURATION_MS the phone is at its off-screen extreme —
      // navigate exactly here. Internal: replace the page. External: open
      // the new tab and let the phone come back so the user isn't staring
      // at an empty page when they return.
      window.setTimeout(() => {
        if (external) {
          window.open(href, '_blank', 'noopener,noreferrer')
        } else {
          window.location.href = href
        }
      }, LEAVE_DURATION_MS)

      if (external) {
        window.setTimeout(() => {
          leaving.current = null
        }, LEAVE_DURATION_MS + RETURN_AFTER_LEAVE_MS)
      }
    },
    [],
  )

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

  // DeviceOrientation — let the user's physical phone steer the 3D phone.
  // iOS 13+ requires explicit permission tied to a user gesture; we ask on
  // the first touch. When the gyro feeds events, useFrame uses these values
  // verbatim and bypasses the sine-wave fallback (gyroActive flag).
  useEffect(() => {
    if (!responsive.ambient) return

    let active = false

    const onOrientation = (e: DeviceOrientationEvent) => {
      // gamma: -90..90 (left-right tilt), beta: -180..180 (front-back).
      // Phone landscape vs portrait swaps which axis is which; for a
      // marketing page we only care about portrait-ish clamping.
      const gamma = (e.gamma ?? 0) / 45 // -1..1ish
      const beta = ((e.beta ?? 0) - 30) / 60 // small dead-zone around ~30° hold
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      tilt.current.gyroActive = true
      tilt.current.gyroYaw = clamp(gamma) * 0.22
      tilt.current.gyroPitch = clamp(beta) * 0.14
      active = true
    }

    const start = () => {
      window.addEventListener('deviceorientation', onOrientation, { passive: true })
    }

    type IOSPermissionConstructor = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    const ctor = DeviceOrientationEvent as IOSPermissionConstructor
    const needsIOSPermission = typeof ctor.requestPermission === 'function'

    const requestOnce = () => {
      if (active) return
      if (needsIOSPermission && ctor.requestPermission) {
        ctor.requestPermission().then((result) => {
          if (result === 'granted') start()
        }).catch(() => {})
      } else {
        start()
      }
    }

    if (needsIOSPermission) {
      // iOS — request on first touch
      window.addEventListener('touchend', requestOnce, { once: true })
      window.addEventListener('click', requestOnce, { once: true })
    } else {
      start()
    }

    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('touchend', requestOnce)
      window.removeEventListener('click', requestOnce)
    }
  }, [responsive.ambient])

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
          /* svh = the *small* viewport, fixed regardless of URL bar — keeps
             the canvas + drei CSS3D math from drifting when iOS Safari
             collapses or expands its chrome mid-gesture. */
          height: 100svh;
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
          height: 100dvh;
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
            <PhoneScene
              tilt={tilt}
              responsive={responsive}
              leaving={leaving}
              onReady={() => setReady(true)}
              onLinkClick={handleLinkClick}
            />
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
