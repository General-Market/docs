// Worldcoin2 — MacBook companion to the iPhone scene.
//
// Broll playback on the laptop display. The screen mesh lives inside
// the Bevels_2 lid subtree; it is the only mesh there whose material
// carries a baseColorMap — that fingerprint is what MacbookWithScreen
// already relies on and what we reuse here.
//
// Preview uses a CanvasTexture fed by drawImage(videoElement, …) each
// frame — robust against useVideoTexture's readiness race, which is
// what was leaving the screen stuck on the GLB's baked wallpaper.
// Render uses useOffthreadVideoTexture, same as the phone.

import React, { useMemo, useRef, useEffect } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  staticFile,
  Video,
  useRemotionEnvironment,
} from "remotion";
import {
  ThreeCanvas,
  useOffthreadVideoTexture,
} from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

const BROLL_SRC = staticFile("broll/glacier-drone.mp4");
const BROLL_ASPECT = 1920 / 1080;
const SCREEN_ASPECT = 16 / 10;

// Internal canvas resolution used in preview. 1280×800 keeps the
// MacBook 16:10 ratio without resampling loss from the 1280×720 source.
const CANVAS_W = 1280;
const CANVAS_H = 800;

const FPS = 60;
const DURATION_SEC = 10;
const DURATION = FPS * DURATION_SEC;

// ── Camera — DeviceShowcase "macbook" view (the 1:15 pose) ──
const CAM_POS = new THREE.Vector3(3.031, 4.096, -6.179);
const CAM_TARGET = new THREE.Vector3(3.001, 2.780, 0.829);
const CAM_ZOOM = 1.2;

const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// ── Screen mesh identification ──

function findMacbookScreenMesh(lidRoot: THREE.Object3D): THREE.Mesh | null {
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

// ── Cover-fit: draw a source (video/img) onto a target canvas with
//    cover behaviour — fills the whole canvas, crops the overflow axis.
function coverDraw(
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
    // Source wider — crop width
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

// ── Render-mode screen: useOffthreadVideoTexture, proven path ──

function applyCoverFitTextureUV(
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

// Match the iPhone treatment: route the video through both diffuse
// and emissive channels so the screen glows gently without the double
// exposure that pure diffuse + environment reflection was producing.
// Tone mapping is left on — ACES gives the slight warmth the phone has.
function bindVideoTextureToScreen(
  mesh: THREE.Mesh,
  texture: THREE.Texture,
  intensity: number,
) {
  const mat = mesh.material as THREE.MeshStandardMaterial;
  if (mat.map === texture && mat.emissiveMap === texture) return;
  mat.map = texture;
  mat.color = new THREE.Color(0xffffff);
  mat.emissive = new THREE.Color(0xffffff);
  mat.emissiveMap = texture;
  mat.emissiveIntensity = intensity;
  mat.needsUpdate = true;
}

const RenderedScreen: React.FC<{ mesh: THREE.Mesh | null }> = ({ mesh }) => {
  const texture = useOffthreadVideoTexture({ src: BROLL_SRC });
  if (mesh && texture) {
    applyCoverFitTextureUV(texture, BROLL_ASPECT, SCREEN_ASPECT);
    bindVideoTextureToScreen(mesh, texture, 1.0);
  }
  return null;
};

// ── Preview-mode screen: Canvas + drawImage per frame ──
// Works regardless of useVideoTexture's internal readiness state.
// If the video hasn't buffered yet, the canvas just shows black (initial
// fill), never the baked GLB wallpaper — so the bug is invisible to the
// viewer even during the first few frames.

const PreviewScreen: React.FC<{
  mesh: THREE.Mesh | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  frame: number;
}> = ({ mesh, videoRef, frame }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);

  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = CANVAS_W;
    c.height = CANVAS_H;
    // Paint black immediately so first frames never leak the baked wallpaper.
    const ctx0 = c.getContext("2d");
    if (ctx0) {
      ctx0.fillStyle = "#000";
      ctx0.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  // Bind the canvas texture to the screen material — once, stable.
  useEffect(() => {
    if (!mesh || !textureRef.current) return;
    bindVideoTextureToScreen(mesh, textureRef.current, 1.0);
  }, [mesh]);

  // Per-frame: draw the video element into the canvas.
  const ctx = canvasRef.current.getContext("2d");
  const video = videoRef.current;
  if (ctx && video && video.readyState >= 2 && video.videoWidth > 0) {
    coverDraw(ctx, video, video.videoWidth, video.videoHeight, CANVAS_W, CANVAS_H);
    if (textureRef.current) textureRef.current.needsUpdate = true;
  }
  // Touch frame so React re-invokes this component every tick.
  void frame;

  return null;
};

// ── Scene ──

const MacbookScene: React.FC<{
  frame: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}> = ({ frame, videoRef }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  const bevels = useMemo(
    () => gltf.scene.getObjectByName("Bevels_2") ?? null,
    [gltf],
  );

  const screenMesh = useMemo(
    () => (bevels ? findMacbookScreenMesh(bevels) : null),
    [bevels],
  );

  // Hide iPhone — only the MacBook in this scene.
  useMemo(() => {
    const iphoneNode = gltf.scene.getObjectByName("iphone");
    if (iphoneNode) {
      iphoneNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.visible = false;
        }
      });
    }
  }, [gltf]);

  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(LID_OPEN);
    bevels.scale.copy(BEVELS_SCALE);
  }

  // Camera: macbook view with slow idle drift.
  const driftX = Math.sin(frame * 0.008) * 0.05;
  const driftY = Math.cos(frame * 0.011) * 0.03;
  const perspCam = camera as THREE.PerspectiveCamera;
  perspCam.position.set(CAM_POS.x + driftX, CAM_POS.y + driftY, CAM_POS.z);
  perspCam.lookAt(CAM_TARGET);
  perspCam.zoom = CAM_ZOOM;
  perspCam.fov = 50;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={gltf.scene} />
      <React.Suspense fallback={null}>
        {env.isRendering ? (
          <RenderedScreen mesh={screenMesh} />
        ) : (
          <PreviewScreen mesh={screenMesh} videoRef={videoRef} frame={frame} />
        )}
      </React.Suspense>
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} castShadow />
      <directionalLight position={[-4, 4, 3]} intensity={0.6} color="#c0d0e8" />
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

// ── Background ──

const GradientBackground: React.FC<{ frame: number }> = ({ frame }) => {
  const drift = frame * 0.003;
  const cx1 = 30 + Math.sin(drift) * 15;
  const cy1 = 40 + Math.cos(drift * 0.7) * 10;
  const cx2 = 70 + Math.cos(drift * 1.2) * 12;
  const cy2 = 60 + Math.sin(drift * 0.9) * 8;
  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(ellipse 80% 70% at ${cx1}% ${cy1}%, rgba(200,225,240,0.5) 0%, transparent 70%)`,
          `radial-gradient(ellipse 60% 80% at ${cx2}% ${cy2}%, rgba(200,240,215,0.4) 0%, transparent 65%)`,
          `linear-gradient(135deg, #f0f4f8 0%, #fafbfd 40%, #f2f8f4 70%, #edf2f8 100%)`,
        ].join(", "),
      }}
    />
  );
};

// ── Composition ──

const W = 1920;
const H = 1080;

export const Worldcoin2Composition: React.FC<{
  transparent?: boolean;
}> = ({ transparent = false }) => {
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width: W, height: H }}>
      {!transparent && <GradientBackground frame={frame} />}
      {!env.isRendering && (
        <Video
          ref={videoRef}
          src={BROLL_SRC}
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
        width={W}
        height={H}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM_POS.x, CAM_POS.y, CAM_POS.z],
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
          <MacbookScene frame={frame} videoRef={videoRef} />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

export const worldcoin2Meta = {
  id: "Worldcoin2",
  component: Worldcoin2Composition,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: DURATION,
};
