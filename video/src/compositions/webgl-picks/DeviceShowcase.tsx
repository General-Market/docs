// Source: https://tympanus.net/Tutorials/DeviceShowcase/
// GLB: https://github.com/repalash/threepipe-device-mockup-codrops
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  staticFile,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, ContactShadows, Environment } from "@react-three/drei";
import * as THREE from "three";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.glb");

// Pre-load so Remotion doesn't timeout
useGLTF.preload(MODEL_URL);

// ── Timeline phases (600 frames at 60fps = 10s) ──

const PHASES = {
  start: [0, 60] as const, // Camera at start view, both devices closed/facedown
  hoverMac: [60, 150] as const, // Hover macbook — lid cracks open
  focusMac: [150, 300] as const, // Click macbook — lid fully open, camera orbits
  unfocus: [300, 360] as const, // Return to front
  hoverPhone: [360, 420] as const, // Hover iphone — tilts up
  focusPhone: [420, 540] as const, // Click iphone — floats up, camera orbits
  outro: [540, 600] as const, // Return to start
} as const;

function phaseProgress(
  frame: number,
  phase: readonly [number, number],
): number {
  return Math.max(
    0,
    Math.min(
      1,
      (frame - phase[0]) / (phase[1] - phase[0]),
    ),
  );
}

function easeIO(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

// ── Camera positions (approximating the threepipe CameraView presets) ──

const CAM = {
  start: { pos: [0.5, 3.5, 5.0] as const, target: [0, 0.3, 0] as const, fov: 35 },
  front: { pos: [0.3, 2.0, 4.0] as const, target: [0, 0.3, 0] as const, fov: 32 },
  macbook: { pos: [-0.8, 2.2, 2.8] as const, target: [-0.3, 0.6, 0] as const, fov: 30 },
  iphone: { pos: [1.5, 1.8, 2.5] as const, target: [1.0, 0.5, 0] as const, fov: 30 },
};

function lerpVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

// ── Scene ──

const DeviceScene: React.FC<{ frame: number }> = ({ frame }) => {
  const { camera } = useThree();
  const gltf = useGLTF(MODEL_URL);

  // Find named objects from the GLB (names from the threepipe source)
  const { iphone, macbookScreen } = useMemo(() => {
    const scene = gltf.scene;
    const _mb = scene.getObjectByName("macbook");
    const ip = scene.getObjectByName("iphone");
    // The lid/screen pivot — named 'Bevels_2' in the original source
    const mbs =
      _mb?.getObjectByName("Bevels_2") ||
      _mb?.getObjectByName("screen") ||
      _mb?.getObjectByName("lid");
    return { iphone: ip, macbookScreen: mbs };
  }, [gltf]);

  // ── Compute device transforms from frame ──

  // MacBook lid angle (rotation around X at hinge)
  // closed=0, hover=~15deg, open=~110deg
  const macLidAngle = useMemo(() => {
    const hoverP = easeIO(phaseProgress(frame, PHASES.hoverMac));
    const focusP = easeIO(phaseProgress(frame, PHASES.focusMac));
    const unfocusP = easeIO(phaseProgress(frame, PHASES.unfocus));
    const hoverPhoneP = easeIO(phaseProgress(frame, PHASES.hoverPhone));
    const focusPhoneP = easeIO(phaseProgress(frame, PHASES.focusPhone));
    const outroP = easeIO(phaseProgress(frame, PHASES.outro));

    if (frame < PHASES.hoverMac[0]) return 0; // closed
    if (frame < PHASES.focusMac[0])
      return interpolate(hoverP, [0, 1], [0, 15]); // hover
    if (frame < PHASES.unfocus[0])
      return interpolate(focusP, [0, 1], [15, 110]); // open
    if (frame < PHASES.hoverPhone[0])
      return interpolate(unfocusP, [0, 1], [110, 0]); // closing
    if (frame < PHASES.focusPhone[0])
      return interpolate(hoverPhoneP, [0, 1], [0, 0]); // stays closed
    if (frame < PHASES.outro[0])
      return interpolate(focusPhoneP, [0, 1], [0, 0]);
    return interpolate(outroP, [0, 1], [0, 0]);
  }, [frame]);

  // iPhone: facedown → tilted → floating
  // facedown = rotated face-down on table
  // tilted = slight tilt toward camera
  // floating = lifted off table, face toward camera
  const iphoneState = useMemo(() => {
    const hoverPhoneP = easeIO(phaseProgress(frame, PHASES.hoverPhone));
    const focusPhoneP = easeIO(phaseProgress(frame, PHASES.focusPhone));
    const outroP = easeIO(phaseProgress(frame, PHASES.outro));

    if (frame < PHASES.hoverPhone[0])
      return { rotX: Math.PI, y: 0 }; // facedown
    if (frame < PHASES.focusPhone[0])
      return {
        rotX: interpolate(hoverPhoneP, [0, 1], [Math.PI, Math.PI * 0.85]),
        y: interpolate(hoverPhoneP, [0, 1], [0, 0.1]),
      }; // tilted
    if (frame < PHASES.outro[0])
      return {
        rotX: interpolate(focusPhoneP, [0, 1], [Math.PI * 0.85, Math.PI * 0.5]),
        y: interpolate(focusPhoneP, [0, 1], [0.1, 0.8]),
      }; // floating
    return {
      rotX: interpolate(outroP, [0, 1], [Math.PI * 0.5, Math.PI]),
      y: interpolate(outroP, [0, 1], [0.8, 0]),
    }; // back to facedown
  }, [frame]);

  // ── Camera animation ──
  const camState = useMemo(() => {
    const hoverP = easeIO(phaseProgress(frame, PHASES.hoverMac));
    const focusP = easeIO(phaseProgress(frame, PHASES.focusMac));
    const unfocusP = easeIO(phaseProgress(frame, PHASES.unfocus));
    const hoverPhoneP = easeIO(phaseProgress(frame, PHASES.hoverPhone));
    const outroP = easeIO(phaseProgress(frame, PHASES.outro));

    if (frame < PHASES.hoverMac[0])
      return { pos: CAM.start.pos, target: CAM.start.target };
    if (frame < PHASES.focusMac[0])
      return {
        pos: lerpVec3(CAM.start.pos, CAM.front.pos, hoverP),
        target: lerpVec3(CAM.start.target, CAM.front.target, hoverP),
      };
    if (frame < PHASES.unfocus[0])
      return {
        pos: lerpVec3(CAM.front.pos, CAM.macbook.pos, focusP),
        target: lerpVec3(CAM.front.target, CAM.macbook.target, focusP),
      };
    if (frame < PHASES.hoverPhone[0])
      return {
        pos: lerpVec3(CAM.macbook.pos, CAM.front.pos, unfocusP),
        target: lerpVec3(CAM.macbook.target, CAM.front.target, unfocusP),
      };
    if (frame < PHASES.focusPhone[0])
      return {
        pos: lerpVec3(CAM.front.pos, CAM.iphone.pos, hoverPhoneP),
        target: lerpVec3(CAM.front.target, CAM.iphone.target, hoverPhoneP),
      };
    if (frame < PHASES.outro[0])
      return { pos: CAM.iphone.pos, target: CAM.iphone.target };
    return {
      pos: lerpVec3(CAM.iphone.pos, CAM.start.pos, outroP),
      target: lerpVec3(CAM.iphone.target, CAM.start.target, outroP),
    };
  }, [frame]);

  // Apply camera
  camera.position.set(camState.pos[0], camState.pos[1], camState.pos[2]);
  camera.lookAt(new THREE.Vector3(camState.target[0], camState.target[1], camState.target[2]));

  // Apply macbook lid rotation
  if (macbookScreen) {
    const rad = (macLidAngle * Math.PI) / 180;
    macbookScreen.rotation.x = -rad; // negative because lid opens upward
  }

  // Apply iphone transform
  if (iphone) {
    iphone.rotation.x = iphoneState.rotX;
    iphone.position.y = iphoneState.y;
  }

  return (
    <>
      <primitive object={gltf.scene} />
      <Environment preset="studio" environmentIntensity={1.5} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 3]} intensity={2.0} castShadow />
      <directionalLight position={[-3, 4, -2]} intensity={0.8} color="#b0c4de" />
      <pointLight position={[0, 3, 2]} intensity={1.5} decay={1} />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.5}
        scale={10}
        blur={2}
        far={4}
      />
    </>
  );
};

// ── Export ──

export const DeviceShowcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: "#242424" }}>
      <ThreeCanvas
        width={width}
        height={height}
        camera={{ fov: 35, near: 0.01, far: 100, position: [0.5, 3.5, 5] }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
      >
        <React.Suspense fallback={null}>
          <DeviceScene frame={frame} />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
