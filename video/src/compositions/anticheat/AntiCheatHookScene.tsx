// Single ThreeCanvas that holds BOTH the laptop and the phone — used by
// AntiCheatHook so the split-screen layout doesn't have to host two
// canvases. Two clones of the cached GLB scene, one with phone hidden
// (laptop instance) and one with laptop hidden (phone instance), plus
// per-mesh broll textures. The screen mesh fingerprint trick is shared
// with DeviceBroll.

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Video,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
} from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// ── Laptop / phone constants pulled from DeviceBroll so this component
//    is self-contained.
const PHONE_BASE_SCALE = 22.486;
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

const PHONE_SCREEN_ASPECT = 9 / 19.5;
const LAPTOP_SCREEN_ASPECT = 16 / 10;

// World layout. Laptop sits at GLB origin (its native pose). Phone
// stays at its native floating pose (-3, 2.5, 0). Counter-intuitive
// but correct: with the camera looking down +z, three.js's lookAt
// produces camera_right = -world_x, so a point at world -x projects
// to the RIGHT of the canvas. Phone (world x=-3) → canvas right;
// laptop (world x=0) → canvas left.
const PHONE_POS = new THREE.Vector3(-3, 2.5, 0);

// Camera between the two devices, looking forward into +z. Slightly
// above the device plane so we read the laptop's lid face and the
// phone's screen face without lying flat on the deck.
const CAMERA_POS: [number, number, number] = [-1.5, 3.2, -7];
const CAMERA_TARGET: [number, number, number] = [-1.5, 2.2, 0];

// ── Mesh identification (lifted from DeviceBroll). ───────────────────────────

function findPhoneScreenMesh(root: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.emissiveMap && !mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

function findLaptopScreenMesh(lidRoot: THREE.Object3D): THREE.Mesh | null {
  let found: THREE.Mesh | null = null;
  lidRoot.traverse((child) => {
    if (found) return;
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (Array.isArray(mesh.material)) return;
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
    if (mat && mat.map) {
      mesh.material = mat.clone();
      found = mesh;
    }
  });
  return found;
}

// ── Texture binding helpers. ─────────────────────────────────────────────────

function applyCoverFitUV(
  texture: THREE.Texture,
  videoAspect: number,
  screenAspect: number,
) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (videoAspect > screenAspect) {
    const r = screenAspect / videoAspect;
    texture.repeat.set(r, 1);
    texture.offset.set((1 - r) / 2, 0);
  } else {
    const r = videoAspect / screenAspect;
    texture.repeat.set(1, r);
    texture.offset.set(0, (1 - r) / 2);
  }
}

function bindTexture(
  mesh: THREE.Mesh,
  texture: THREE.Texture,
  emissiveIntensity: number,
) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat.map === texture && mat.emissiveMap === texture) return;
  mat.map = texture;
  mat.color = new THREE.Color(0xffffff);
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveMap = texture;
  mat.emissiveIntensity = emissiveIntensity;
  mat.needsUpdate = true;
}

function coverDrawToCanvas(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
) {
  const srcA = srcW / srcH;
  const dstA = dstW / dstH;
  let sx = 0,
    sy = 0,
    sw = srcW,
    sh = srcH;
  if (srcA > dstA) {
    const cropW = srcH * dstA;
    sx = (srcW - cropW) / 2;
    sw = cropW;
  } else {
    const cropH = srcW / dstA;
    sy = (srcH - cropH) / 2;
    sh = cropH;
  }
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dstW, dstH);
}

// ── Screen binding components. ───────────────────────────────────────────────

const RenderedScreen: React.FC<{
  mesh: THREE.Mesh | null;
  broll: string;
  brollAspect: number;
  screenAspect: number;
  emissiveIntensity: number;
}> = ({ mesh, broll, brollAspect, screenAspect, emissiveIntensity }) => {
  const texture = useOffthreadVideoTexture({ src: broll });
  if (mesh && texture) {
    applyCoverFitUV(texture, brollAspect, screenAspect);
    bindTexture(mesh, texture, emissiveIntensity);
  }
  return null;
};

const PreviewScreen: React.FC<{
  mesh: THREE.Mesh | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasW: number;
  canvasH: number;
  emissiveIntensity: number;
  frame: number;
}> = ({ mesh, videoRef, canvasW, canvasH, emissiveIntensity, frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = canvasW;
    c.height = canvasH;
    const ctx0 = c.getContext("2d");
    if (ctx0) {
      ctx0.fillStyle = "#000";
      ctx0.fillRect(0, 0, canvasW, canvasH);
    }
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  useEffect(() => {
    if (!mesh || !textureRef.current) return;
    bindTexture(mesh, textureRef.current, emissiveIntensity);
  }, [mesh, emissiveIntensity]);

  const ctx = canvasRef.current.getContext("2d");
  const video = videoRef.current;
  if (ctx && video && video.readyState >= 2 && video.videoWidth > 0) {
    coverDrawToCanvas(
      ctx,
      video,
      video.videoWidth,
      video.videoHeight,
      canvasW,
      canvasH,
    );
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }
  void frame;
  return null;
};

// ── Main scene ───────────────────────────────────────────────────────────────

const Scene: React.FC<{
  laptopBroll: string;
  phoneBroll: string;
  laptopBrollAspect: number;
  phoneBrollAspect: number;
  laptopVideoRef: React.RefObject<HTMLVideoElement | null>;
  phoneVideoRef: React.RefObject<HTMLVideoElement | null>;
  emissiveIntensity: number;
  lightingIntensity: number;
  frame: number;
}> = ({
  laptopBroll,
  phoneBroll,
  laptopBrollAspect,
  phoneBrollAspect,
  laptopVideoRef,
  phoneVideoRef,
  emissiveIntensity,
  lightingIntensity,
  frame,
}) => {
  const { camera: threeCam } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  // One clone for the whole scene — the GLB already contains both the
  // laptop and the iphone. We don't hide either; we just position them
  // and bind separate broll textures to each screen.
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf]);

  const laptopScreen = useMemo(() => {
    const bevels = sceneClone.getObjectByName("Bevels_2");
    return bevels ? findLaptopScreenMesh(bevels) : null;
  }, [sceneClone]);

  const phoneScreen = useMemo(() => {
    const iphone = sceneClone.getObjectByName("iphone");
    return iphone ? findPhoneScreenMesh(iphone) : null;
  }, [sceneClone]);

  // Pose: lid open on the laptop, phone translated right.
  const bevels = sceneClone.getObjectByName("Bevels_2");
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(LID_OPEN);
    bevels.scale.copy(BEVELS_SCALE);
  }
  const iphone = sceneClone.getObjectByName("iphone");
  if (iphone) {
    iphone.position.copy(PHONE_POS);
    iphone.quaternion.set(0, 0, 0, 1);
    iphone.scale.setScalar(PHONE_BASE_SCALE);
  }

  // Camera
  const perspCam = threeCam as THREE.PerspectiveCamera;
  perspCam.position.set(...CAMERA_POS);
  perspCam.lookAt(...CAMERA_TARGET);
  perspCam.fov = 50;
  perspCam.zoom = 1;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={sceneClone} />
      <React.Suspense fallback={null}>
        {env.isRendering ? (
          <>
            <RenderedScreen
              mesh={laptopScreen}
              broll={laptopBroll}
              brollAspect={laptopBrollAspect}
              screenAspect={LAPTOP_SCREEN_ASPECT}
              emissiveIntensity={emissiveIntensity}
            />
            <RenderedScreen
              mesh={phoneScreen}
              broll={phoneBroll}
              brollAspect={phoneBrollAspect}
              screenAspect={PHONE_SCREEN_ASPECT}
              emissiveIntensity={emissiveIntensity}
            />
          </>
        ) : (
          <>
            <PreviewScreen
              mesh={laptopScreen}
              videoRef={laptopVideoRef}
              canvasW={1280}
              canvasH={800}
              emissiveIntensity={emissiveIntensity}
              frame={frame}
            />
            <PreviewScreen
              mesh={phoneScreen}
              videoRef={phoneVideoRef}
              canvasW={720}
              canvasH={1560}
              emissiveIntensity={emissiveIntensity}
              frame={frame}
            />
          </>
        )}
      </React.Suspense>
      <Environment preset="studio" environmentIntensity={1.8 * lightingIntensity} />
      <ambientLight intensity={0.3 * lightingIntensity} />
      <directionalLight
        position={[5, 8, -5]}
        intensity={2.5 * lightingIntensity}
        castShadow
      />
      {/* Cool fill removed — it painted a blue cast on the screens. The
          studio environment + the warm key alone keep the bodies
          legible without tinting the broll. */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.4}
        scale={14}
        blur={1.5}
        far={5}
      />
    </>
  );
};

// ── Wrapper ──────────────────────────────────────────────────────────────────

export type AntiCheatSceneProps = {
  laptopBroll: string;
  phoneBroll: string;
  laptopBrollAspect?: number;
  phoneBrollAspect?: number;
  width?: number;
  height?: number;
  emissiveIntensity?: number;
  lightingIntensity?: number;
};

export const AntiCheatHookScene: React.FC<AntiCheatSceneProps> = ({
  laptopBroll,
  phoneBroll,
  laptopBrollAspect = 16 / 9,
  phoneBrollAspect = 720 / 1560,
  width = 1920,
  height = 1080,
  emissiveIntensity = 1.6,
  lightingIntensity = 0.85,
}) => {
  const frame = useCurrentFrame();
  const laptopVideoRef = useRef<HTMLVideoElement | null>(null);
  const phoneVideoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width, height, background: "#0a0a0a" }}>
      {!env.isRendering && (
        <>
          <Video
            ref={laptopVideoRef}
            src={laptopBroll}
            muted
            loop
            playsInline
            preload="auto"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
          <Video
            ref={phoneVideoRef}
            src={phoneBroll}
            muted
            loop
            playsInline
            preload="auto"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              opacity: 0,
              pointerEvents: "none",
            }}
          />
        </>
      )}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: CAMERA_POS,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        style={{ background: "transparent" }}
      >
        <React.Suspense fallback={null}>
          <Scene
            laptopBroll={laptopBroll}
            phoneBroll={phoneBroll}
            laptopBrollAspect={laptopBrollAspect}
            phoneBrollAspect={phoneBrollAspect}
            laptopVideoRef={laptopVideoRef}
            phoneVideoRef={phoneVideoRef}
            emissiveIntensity={emissiveIntensity}
            lightingIntensity={lightingIntensity}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
