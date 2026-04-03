// Source: https://tympanus.net/Tutorials/DeviceShowcase/
// GLB: https://github.com/repalash/threepipe-device-mockup-codrops
//
// Camera views and transform animations extracted from the WEBGI_viewer
// extension baked into the GLB. Quaternion slerp matches the original
// threepipe CameraViewPlugin with interpolateMode: "spherical".
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");
useGLTF.preload(MODEL_URL);

// ── Camera views extracted from GLB WEBGI_viewer.CameraViews ──

const CAM = {
  start: {
    pos: new THREE.Vector3(7.859, 2.544, -9.431),
    target: new THREE.Vector3(2.056, 1.385, 0.641),
    zoom: 1.0,
  },
  front: {
    pos: new THREE.Vector3(2.053, 3.712, -11.446),
    target: new THREE.Vector3(1.869, 1.087, 0.518),
    zoom: 1.0,
  },
  macbook: {
    pos: new THREE.Vector3(3.031, 4.096, -6.179),
    target: new THREE.Vector3(3.001, 2.780, 0.829),
    zoom: 1.2,
  },
  iphone: {
    pos: new THREE.Vector3(-2.800, 2.375, -4.440),
    target: new THREE.Vector3(-2.921, 2.475, -1.564),
    zoom: 1.0,
  },
};

// ── Transform animations extracted from GLB node extras ──
// Bevels_2 (macbook lid) — quaternion around X axis only
const LID_CLOSED = new THREE.Quaternion(0, 0, 0, 1);
const LID_HOVER = new THREE.Quaternion(-0.03499, 0, 0, 0.99939);
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);

// iPhone — full quaternion + position
const IPHONE_FACEDOWN = {
  pos: new THREE.Vector3(-3, 0, 0),
  quat: new THREE.Quaternion(0.00056, 0.70739, 0.70682, 0.00056),
};
const IPHONE_TILTED = {
  pos: new THREE.Vector3(-3, 0.13, 0),
  quat: new THREE.Quaternion(-0.05300, 0.70484, 0.70540, -0.05296),
};
const IPHONE_FLOATING = {
  pos: new THREE.Vector3(-3, 2.5, 0),
  quat: new THREE.Quaternion(0, 0, 0, 1),
};

// iPhone scale is constant across all transforms
const IPHONE_SCALE = new THREE.Vector3(22.486, 22.486, 22.486);

// Bevels_2 position/scale are constant across all transforms
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);

// ── Timeline (600 frames @ 60fps = 10s) ──
// Matches the original interaction flow:
//   start → front (hover) → macbook (click) → front (unhover) → iphone (click) → start

const PHASES = {
  establish: [0, 60],     // Hold at start view
  toFront: [60, 120],     // Drift to front view (simulates initial hover)
  hoverMac: [120, 180],   // Macbook lid cracks open (hover state)
  toMacbook: [180, 300],  // Camera moves to macbook, lid opens fully
  toFront2: [300, 360],   // Back to front, lid closes
  hoverPhone: [360, 420], // iPhone tilts (hover state)
  toIphone: [420, 540],   // Camera to iphone, phone floats up
  toStart: [540, 600],    // Return to start, phone goes back down
} as const;

function progress(frame: number, phase: readonly [number, number]): number {
  if (frame <= phase[0]) return 0;
  if (frame >= phase[1]) return 1;
  return (frame - phase[0]) / (phase[1] - phase[0]);
}

// easeInOutSine — matches the original animEase
function ease(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// Helpers for slerp-based camera interpolation
const _tmpPos = new THREE.Vector3();
const _tmpTarget = new THREE.Vector3();

function lerpCam(
  from: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number },
  to: { pos: THREE.Vector3; target: THREE.Vector3; zoom: number },
  t: number,
) {
  return {
    pos: _tmpPos.copy(from.pos).lerp(to.pos, t).clone(),
    target: _tmpTarget.copy(from.target).lerp(to.target, t).clone(),
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

const _tmpQuat = new THREE.Quaternion();

function slerpQuat(a: THREE.Quaternion, b: THREE.Quaternion, t: number): THREE.Quaternion {
  return _tmpQuat.copy(a).slerp(b, t).clone();
}

function lerpVec3(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  return a.clone().lerp(b, t);
}

// ── Scene ──

const DeviceScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  const { iphone, bevels } = useMemo(() => {
    const scene = gltf.scene;
    return {
      iphone: scene.getObjectByName("iphone") ?? null,
      bevels: scene.getObjectByName("Bevels_2") ?? null,
    };
  }, [gltf]);

  // ── Camera state ──
  const camState = useMemo(() => {
    const t1 = ease(progress(frame, PHASES.toFront));
    const t3 = ease(progress(frame, PHASES.toMacbook));
    const t4 = ease(progress(frame, PHASES.toFront2));
    const t6 = ease(progress(frame, PHASES.toIphone));
    const t7 = ease(progress(frame, PHASES.toStart));

    if (frame < PHASES.toFront[0]) return CAM.start;
    if (frame < PHASES.hoverMac[0]) return lerpCam(CAM.start, CAM.front, t1);
    if (frame < PHASES.toMacbook[0]) return CAM.front; // Hold at front during lid hover
    if (frame < PHASES.toFront2[0]) return lerpCam(CAM.front, CAM.macbook, t3);
    if (frame < PHASES.hoverPhone[0]) return lerpCam(CAM.macbook, CAM.front, t4);
    if (frame < PHASES.toIphone[0]) return CAM.front; // Hold at front during phone hover
    if (frame < PHASES.toStart[0]) return lerpCam(CAM.front, CAM.iphone, t6);
    return lerpCam(CAM.iphone, CAM.start, t7);
  }, [frame]);

  // ── MacBook lid quaternion ──
  const lidQuat = useMemo(() => {
    const tHover = ease(progress(frame, PHASES.hoverMac));
    const tOpen = ease(progress(frame, PHASES.toMacbook));
    const tClose = ease(progress(frame, PHASES.toFront2));

    if (frame < PHASES.hoverMac[0]) return LID_CLOSED;
    if (frame < PHASES.toMacbook[0]) return slerpQuat(LID_CLOSED, LID_HOVER, tHover);
    if (frame < PHASES.toFront2[0]) return slerpQuat(LID_HOVER, LID_OPEN, tOpen);
    if (frame < PHASES.hoverPhone[0]) return slerpQuat(LID_OPEN, LID_CLOSED, tClose);
    return LID_CLOSED;
  }, [frame]);

  // ── iPhone transform ──
  const iphoneTransform = useMemo(() => {
    const tTilt = ease(progress(frame, PHASES.hoverPhone));
    const tFloat = ease(progress(frame, PHASES.toIphone));
    const tReturn = ease(progress(frame, PHASES.toStart));

    if (frame < PHASES.hoverPhone[0]) return IPHONE_FACEDOWN;
    if (frame < PHASES.toIphone[0]) return {
      pos: lerpVec3(IPHONE_FACEDOWN.pos, IPHONE_TILTED.pos, tTilt),
      quat: slerpQuat(IPHONE_FACEDOWN.quat, IPHONE_TILTED.quat, tTilt),
    };
    if (frame < PHASES.toStart[0]) return {
      pos: lerpVec3(IPHONE_TILTED.pos, IPHONE_FLOATING.pos, tFloat),
      quat: slerpQuat(IPHONE_TILTED.quat, IPHONE_FLOATING.quat, tFloat),
    };
    return {
      pos: lerpVec3(IPHONE_FLOATING.pos, IPHONE_FACEDOWN.pos, tReturn),
      quat: slerpQuat(IPHONE_FLOATING.quat, IPHONE_FACEDOWN.quat, tReturn),
    };
  }, [frame]);

  // Apply camera
  const perspCam = camera as THREE.PerspectiveCamera;
  perspCam.position.copy(camState.pos);
  perspCam.lookAt(camState.target);
  if ("zoom" in camState) {
    perspCam.zoom = camState.zoom;
    perspCam.updateProjectionMatrix();
  }

  // Apply lid rotation (Bevels_2 is a child deep in the macbook hierarchy)
  if (bevels) {
    bevels.position.copy(BEVELS_POS);
    bevels.quaternion.copy(lidQuat);
    bevels.scale.copy(BEVELS_SCALE);
  }

  // Apply iPhone transform
  if (iphone) {
    iphone.position.copy(iphoneTransform.pos);
    iphone.quaternion.copy(iphoneTransform.quat);
    iphone.scale.copy(IPHONE_SCALE);
  }

  return (
    <>
      <primitive object={gltf.scene} />
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

// ── Export ──

export const DeviceShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{
          fov: 50,
          near: 0.5,
          far: 1000,
          position: [CAM.start.pos.x, CAM.start.pos.y, CAM.start.pos.z],
        }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
      >
        <React.Suspense fallback={null}>
          <DeviceScene frame={frame} />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
