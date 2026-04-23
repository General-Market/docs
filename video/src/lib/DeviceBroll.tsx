// DeviceBroll — single React component that renders either a 3D iPhone
// or 3D MacBook with a broll video playing on its screen. Same GLB,
// same proven material-fingerprint trick, one API.
//
// Minimal usage:
//   <DeviceBroll device="phone"  broll={staticFile("broll/glacier-drone.mp4")} />
//   <DeviceBroll device="laptop" broll={staticFile("broll/mountains-aerial.mp4")} />
//
// Controllable:
//   <DeviceBroll
//     device="laptop"
//     broll={staticFile("broll/glacier-drone.mp4")}
//     position={[3, 0, 0]}
//     rotation={[0, 0.3, 0]}
//     scale={1}
//     camera={{ position: [3, 4, -6], target: [3, 2.8, 0.8], zoom: 1.2 }}
//     lidOpen={1}
//     emissiveIntensity={1.0}
//     background="#f0f0f0"
//   />
//
// The screen is identified by material fingerprint, NOT by node name:
//   phone  — the only material with emissiveMap and no baseColorMap
//   laptop — the only mesh inside Bevels_2 with a baseColorMap
// Material is cloned per mount so it never leaks into other scenes.

import React, { useMemo, useRef, useEffect } from "react";
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
// ── Model ──
// `.opt.glb` — WebP-compressed textures. 8.3 MB (down from 12.4 MB,
// −33%). Node graph and materials identical to the original; WebP
// textures are decoded natively by three.js via EXT_texture_webp — no
// custom loader setup, no WASM decoder, no `/basis/` folder.
//
// A further-compressed `tabletop_macbook_iphone.ktx2.glb` (5.6 MB,
// −55%, meshopt + KTX2/BasisU) also ships in public/models/ along
// with the Basis transcoder in public/basis/. Everything needed to
// wire KTX2Loader is present, all decoders verify ready in Remotion's
// render context, yet GLTFLoader silently hangs on parse — a deeper
// issue than a one-afternoon fix. Keep it for a future pass.
//
// Fallback order if the WebP variant ever misbehaves:
//   `tabletop_macbook_iphone.glb` — 12.4 MB original, Draco + PNG.
const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// ── Defaults ──

const DEFAULT_PHONE_CAMERA = {
  position: [-2.8, 2.375, -4.44] as [number, number, number],
  target: [-2.921, 2.475, -1.564] as [number, number, number],
  fov: 50,
  zoom: 1,
};

const DEFAULT_LAPTOP_CAMERA = {
  position: [3.031, 4.096, -6.179] as [number, number, number],
  target: [3.001, 2.780, 0.829] as [number, number, number],
  fov: 50,
  zoom: 1.2,
};

// Phone floating pose from DeviceShowcase — this is where the iphone
// node naturally lives in the GLB after the "floating" animation.
const PHONE_FLOATING_POS = new THREE.Vector3(-3, 2.5, 0);
const PHONE_FLOATING_QUAT = new THREE.Quaternion(0, 0, 0, 1);
const PHONE_BASE_SCALE = 22.486;

// Laptop lid-open quaternion and bevels offsets from DeviceShowcase.
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// Screen UV aspects — iPhone is portrait 19.5:9, MacBook is 16:10.
const PHONE_SCREEN_ASPECT = 9 / 19.5;
const LAPTOP_SCREEN_ASPECT = 16 / 10;

// Preview canvas resolutions — chosen to match screen aspect cleanly.
const PHONE_CANVAS_W = 720;
const PHONE_CANVAS_H = 1560;
const LAPTOP_CANVAS_W = 1280;
const LAPTOP_CANVAS_H = 800;

// ── Props ──

export type DeviceType = "phone" | "laptop";

export type DeviceBrollProps = {
  /** Which device to render. */
  device: DeviceType;
  /** Broll video path (use staticFile(…)). */
  broll: string;
  /** Aspect ratio of the source video (w/h). Default 16/9. */
  brollAspect?: number;
  /** World-space position of the device. Defaults to each device's natural pose. */
  position?: [number, number, number];
  /** Euler rotation (YXZ order) applied after the device's natural orientation. */
  rotation?: [number, number, number];
  /** Uniform scale multiplier on top of the device's natural scale. Default 1. */
  scale?: number;
  /** Camera override. Any missing field falls back to the device default. */
  camera?: Partial<{
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    zoom: number;
  }>;
  /** Laptop only: 0 = closed, 1 = fully open. Default 1. Ignored for phones. */
  lidOpen?: number;
  /** Emissive blend strength for the screen. Higher = glossier glow. Default 1. */
  emissiveIntensity?: number;
  /** Canvas width in px. Default 1920. */
  width?: number;
  /** Canvas height in px. Default 1080. */
  height?: number;
  /** Anything you want behind the 3D canvas — a gradient, a color string, a component. */
  background?: React.ReactNode | string;
  /** Contact shadow under the device. Default true for laptop, false for phone. */
  showShadow?: boolean;
};

// ── Screen mesh identification ──

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

// ── Texture binding ──

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
  let sx = 0, sy = 0, sw = srcW, sh = srcH;
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

// ── Screen components (render vs preview) ──

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
    coverDrawToCanvas(ctx, video, video.videoWidth, video.videoHeight, canvasW, canvasH);
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }
  void frame;
  return null;
};

// ── Scene ──

type ResolvedScene = {
  screenMesh: THREE.Mesh | null;
  canvasW: number;
  canvasH: number;
  screenAspect: number;
};

const Scene: React.FC<{
  device: DeviceType;
  broll: string;
  brollAspect: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale: number;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
    fov: number;
    zoom: number;
  };
  lidOpen: number;
  emissiveIntensity: number;
  showShadow: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  frame: number;
}> = ({
  device,
  broll,
  brollAspect,
  position,
  rotation,
  scale,
  camera,
  lidOpen,
  emissiveIntensity,
  showShadow,
  videoRef,
  frame,
}) => {
  const { camera: threeCam } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  const resolved: ResolvedScene = useMemo(() => {
    if (device === "phone") {
      const iphone = gltf.scene.getObjectByName("iphone");
      return {
        screenMesh: iphone ? findPhoneScreenMesh(iphone) : null,
        canvasW: PHONE_CANVAS_W,
        canvasH: PHONE_CANVAS_H,
        screenAspect: PHONE_SCREEN_ASPECT,
      };
    }
    const bevels = gltf.scene.getObjectByName("Bevels_2");
    return {
      screenMesh: bevels ? findLaptopScreenMesh(bevels) : null,
      canvasW: LAPTOP_CANVAS_W,
      canvasH: LAPTOP_CANVAS_H,
      screenAspect: LAPTOP_SCREEN_ASPECT,
    };
  }, [gltf, device]);

  // Hide the device we are NOT showing.
  useMemo(() => {
    const iphoneNode = gltf.scene.getObjectByName("iphone");
    const iphoneSet = new Set<THREE.Object3D>();
    if (iphoneNode) iphoneNode.traverse((c) => iphoneSet.add(c));
    gltf.scene.traverse((child) => {
      if (!(child as THREE.Mesh).isMesh) return;
      const inIphone = iphoneSet.has(child);
      child.visible = device === "phone" ? inIphone : !inIphone;
    });
  }, [gltf, device]);

  // Device-specific transforms.
  if (device === "phone") {
    const iphone = gltf.scene.getObjectByName("iphone");
    if (iphone) {
      const pos = position
        ? new THREE.Vector3(...position)
        : PHONE_FLOATING_POS;
      iphone.position.copy(pos);
      const animQuat = rotation
        ? new THREE.Quaternion().setFromEuler(
            new THREE.Euler(rotation[0], rotation[1], rotation[2], "YXZ"),
          )
        : new THREE.Quaternion();
      iphone.quaternion.copy(PHONE_FLOATING_QUAT).multiply(animQuat);
      iphone.scale.setScalar(PHONE_BASE_SCALE * scale);
    }
  } else {
    // Laptop: lid angle interpolates between closed and open.
    const bevels = gltf.scene.getObjectByName("Bevels_2");
    if (bevels) {
      const lidQ = new THREE.Quaternion().copy(LID_CLOSED).slerp(LID_OPEN, lidOpen);
      bevels.position.copy(BEVELS_POS);
      bevels.quaternion.copy(lidQ);
      bevels.scale.copy(BEVELS_SCALE);
    }
    // Laptop world-space transform via the scene root — the macbook is
    // anchored at origin in the GLB, so moving the root moves everything.
    if (position || rotation || scale !== 1) {
      gltf.scene.position.set(...(position ?? [0, 0, 0]));
      if (rotation) {
        gltf.scene.rotation.set(rotation[0], rotation[1], rotation[2], "YXZ");
      } else {
        gltf.scene.rotation.set(0, 0, 0);
      }
      gltf.scene.scale.setScalar(scale);
    }
  }

  // Camera
  const perspCam = threeCam as THREE.PerspectiveCamera;
  perspCam.position.set(...camera.position);
  perspCam.lookAt(...camera.target);
  perspCam.fov = camera.fov;
  perspCam.zoom = camera.zoom;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={gltf.scene} />
      <React.Suspense fallback={null}>
        {env.isRendering ? (
          <RenderedScreen
            mesh={resolved.screenMesh}
            broll={broll}
            brollAspect={brollAspect}
            screenAspect={resolved.screenAspect}
            emissiveIntensity={emissiveIntensity}
          />
        ) : (
          <PreviewScreen
            mesh={resolved.screenMesh}
            videoRef={videoRef}
            canvasW={resolved.canvasW}
            canvasH={resolved.canvasH}
            emissiveIntensity={emissiveIntensity}
            frame={frame}
          />
        )}
      </React.Suspense>
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
      {showShadow && (
        <ContactShadows
          position={[0, -0.01, 0]}
          opacity={0.4}
          scale={14}
          blur={1.5}
          far={5}
        />
      )}
    </>
  );
};

// ── Exported wrapper ──

export const DeviceBroll: React.FC<DeviceBrollProps> = ({
  device,
  broll,
  brollAspect = 16 / 9,
  position,
  rotation,
  scale = 1,
  camera,
  lidOpen = 1,
  emissiveIntensity = 1,
  width = 1920,
  height = 1080,
  background,
  showShadow,
}) => {
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  const resolvedCamera = useMemo(() => {
    const base = device === "phone" ? DEFAULT_PHONE_CAMERA : DEFAULT_LAPTOP_CAMERA;
    return {
      position: (camera?.position ?? base.position) as [number, number, number],
      target: (camera?.target ?? base.target) as [number, number, number],
      fov: camera?.fov ?? base.fov,
      zoom: camera?.zoom ?? base.zoom,
    };
  }, [device, camera]);

  const resolvedShadow = showShadow ?? (device === "laptop");

  const bg =
    typeof background === "string"
      ? <AbsoluteFill style={{ background }} />
      : background;

  return (
    <AbsoluteFill style={{ width, height }}>
      {bg}
      {!env.isRendering && (
        <Video
          ref={videoRef}
          src={broll}
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
      )}
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: resolvedCamera.fov,
          near: 0.5,
          far: 1000,
          position: resolvedCamera.position,
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
            device={device}
            broll={broll}
            brollAspect={brollAspect}
            position={position}
            rotation={rotation}
            scale={scale}
            camera={resolvedCamera}
            lidOpen={lidOpen}
            emissiveIntensity={emissiveIntensity}
            showShadow={resolvedShadow}
            videoRef={videoRef}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
