/**
 * MacbookWithScreen — 3D MacBook with screen texture replaced.
 *
 * Finds the textured screen mesh in the lid, replaces its material.map
 * with a CanvasTexture drawn by a user-provided render function.
 * No CSS overlay. The UV mapping handles positioning perfectly.
 *
 * Usage:
 *   <MacbookWithScreen
 *     camera="zoom-in"
 *     renderScreen={(ctx, frame, w, h) => {
 *       ctx.fillStyle = "#000";
 *       ctx.fillRect(0, 0, w, h);
 *       ctx.fillStyle = "#0f0";
 *       ctx.font = "24px monospace";
 *       ctx.fillText("Hello", 20, 40);
 *     }}
 *   />
 */
import React, { useMemo, useRef } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  interpolate,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

// ── Camera views ──

export interface CameraView {
  pos: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
}

export const CAM = {
  wide: {
    pos: new THREE.Vector3(7.859, 2.544, -9.431),
    target: new THREE.Vector3(2.056, 1.385, 0.641),
    zoom: 1.0,
  },
  macbook: {
    pos: new THREE.Vector3(3.031, 4.096, -6.179),
    target: new THREE.Vector3(3.001, 2.780, 0.829),
    zoom: 1.2,
  },
  screen: {
    pos: new THREE.Vector3(3.02, 3.6, -4.0),
    target: new THREE.Vector3(3.0, 3.0, 0.8),
    zoom: 1.6,
  },
} as const;

// ── Model constants ──

const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);
const IPHONE_POS = new THREE.Vector3(-3, 0, 0);
const IPHONE_QUAT = new THREE.Quaternion(0.00056, 0.70739, 0.70682, 0.00056);
const IPHONE_SCALE = new THREE.Vector3(22.486, 22.486, 22.486);

// Screen canvas resolution
const SCREEN_W = 1280;
const SCREEN_H = 800;

// ── Helpers ──

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

const _p = new THREE.Vector3();
const _t = new THREE.Vector3();
const _q = new THREE.Quaternion();

// ── Camera presets ──

export type CameraPreset =
  | "static-wide"
  | "static-macbook"
  | "static-screen"
  | "zoom-in"
  | "zoom-to-screen";

function getCameraView(
  preset: CameraPreset,
  frame: number,
  total: number,
): CameraView {
  switch (preset) {
    case "static-wide":
      return CAM.wide;
    case "static-macbook":
      return CAM.macbook;
    case "static-screen":
      return CAM.screen;
    case "zoom-in": {
      const t1 = easeInOutSine(
        interpolate(frame, [0, total * 0.35], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const t2 = easeInOutSine(
        interpolate(frame, [total * 0.35, total * 0.85], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const midPos = _p.copy(CAM.wide.pos).lerp(CAM.macbook.pos, t1);
      const pos = midPos.clone().lerp(CAM.screen.pos, t2);
      const midTarget = _t
        .copy(CAM.wide.target)
        .lerp(CAM.macbook.target, t1);
      const target = midTarget.clone().lerp(CAM.screen.target, t2);
      const zoom =
        CAM.wide.zoom +
        (CAM.macbook.zoom - CAM.wide.zoom) * t1 +
        (CAM.screen.zoom - CAM.macbook.zoom) * t2;
      return { pos, target, zoom };
    }
    case "zoom-to-screen": {
      const t = easeInOutSine(
        interpolate(frame, [0, total * 0.6], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      );
      const pos = _p.copy(CAM.macbook.pos).lerp(CAM.screen.pos, t).clone();
      const target = _t
        .copy(CAM.macbook.target)
        .lerp(CAM.screen.target, t)
        .clone();
      const zoom =
        CAM.macbook.zoom + (CAM.screen.zoom - CAM.macbook.zoom) * t;
      return { pos, target, zoom };
    }
  }
}

// ── 3D Scene ──

export type ScreenRenderer = (
  ctx: CanvasRenderingContext2D,
  frame: number,
  width: number,
  height: number,
) => void;

const MacbookModel: React.FC<{
  view: CameraView;
  lidT: number;
  renderScreen: ScreenRenderer;
  frame: number;
}> = ({ view, lidT, renderScreen, frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const { iphone, bevels } = useMemo(
    () => ({
      iphone: gltf.scene.getObjectByName("iphone") ?? null,
      bevels: gltf.scene.getObjectByName("Bevels_2") ?? null,
    }),
    [gltf],
  );

  // All mutable state in refs — no re-render triggers
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const didInit = useRef(false);

  // Create canvas once
  if (!canvasRef.current) {
    const c = document.createElement("canvas");
    c.width = SCREEN_W;
    c.height = SCREEN_H;
    canvasRef.current = c;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    textureRef.current = tex;
  }

  // Replace screen texture once (after model loads)
  if (!didInit.current && gltf.scene) {
    didInit.current = true;
    const lidNode = gltf.scene.getObjectByName("Bevels_2");
    if (lidNode) {
      lidNode.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if (mat?.map && textureRef.current) {
            mat.map = textureRef.current;
            mat.emissive = new THREE.Color(0xffffff);
            mat.emissiveMap = textureRef.current;
            mat.emissiveIntensity = 0.6;
            mat.needsUpdate = true;
          }
        }
      });
    }
  }

  // Draw screen content every frame
  const ctx = canvasRef.current?.getContext("2d");
  if (ctx && textureRef.current) {
    renderScreen(ctx, frame, SCREEN_W, SCREEN_H);
    textureRef.current.needsUpdate = true;
  }

  // Camera
  const cam = camera as THREE.PerspectiveCamera;
  cam.position.copy(view.pos);
  cam.lookAt(view.target);
  cam.zoom = view.zoom;
  cam.updateProjectionMatrix();

  // Lid
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(_q.copy(LID_CLOSED).slerp(LID_OPEN, lidT));
    bevels.scale.copy(BEVELS_SCALE);
  }

  // iPhone hidden
  if (iphone) {
    iphone.position.copy(IPHONE_POS);
    iphone.quaternion.copy(IPHONE_QUAT);
    iphone.scale.copy(IPHONE_SCALE);
  }

  return (
    <>
      <primitive object={gltf.scene} />
      <Environment preset="studio" environmentIntensity={1.8} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 8, -5]} intensity={2.5} castShadow />
      <directionalLight
        position={[-4, 4, 3]}
        intensity={0.6}
        color="#c0d0e8"
      />
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

// ── Wrapper ──

export interface MacbookWithScreenProps {
  /** Draw function called every frame to render screen content */
  renderScreen: ScreenRenderer;
  camera?: CameraPreset;
  lidOpen?: boolean;
  lidDur?: number;
  bg?: string;
}

export const MacbookWithScreen: React.FC<MacbookWithScreenProps> = ({
  renderScreen,
  camera = "zoom-in",
  lidOpen = true,
  lidDur = 30,
  bg = "#f5f5f5",
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  const view = getCameraView(camera, frame, durationInFrames);

  const lidT = easeInOutSine(
    interpolate(frame, [3, lidDur], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  return (
    <AbsoluteFill style={{ backgroundColor: bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM.wide.pos.x, CAM.wide.pos.y, CAM.wide.pos.z],
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <React.Suspense fallback={null}>
          <MacbookModel
            view={view}
            lidT={lidOpen ? lidT : 0}
            renderScreen={renderScreen}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
