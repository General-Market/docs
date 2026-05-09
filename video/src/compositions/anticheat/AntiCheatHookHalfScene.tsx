// Half-canvas single-device scene. Same GLB, same animation curves as the
// dual-device AntiCheatHookScene; pruned so each instance only carries
// the laptop or the phone, framed for a 960×1080 viewport. Used by
// AntiCheatHook to render two side-by-side mini-scenes — one per device
// — instead of one wide scene with a split-panel overlay.

import React, { useEffect, useMemo, useRef } from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useRemotionEnvironment,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { beatPulseScene } from "./beats";
import {
  PhoneChart,
  PreviewScreen,
  PreviewVideo,
  RenderedScreen,
  findLaptopScreenMesh,
  findPhoneScreenMesh,
  type BrollSegment,
} from "./AntiCheatHookScene";

const MODEL_URL = staticFile("models/tabletop_macbook_iphone.opt.glb");
useGLTF.preload(MODEL_URL);

// ── Layout — single device, centered for half-canvas viewport ───────────────
//
// Both halves share the same camera / lid / spin tuning so timing matches
// the dual-device version. The active device is the only thing in the
// scene tree; the other branch is hidden via `visible = false`.
const PHONE_BASE_SCALE = 31; // +15% over the dual-scene tuning
const LAPTOP_Y_SHIFT = 0.5; // ≈8% canvas-up — laptop sits higher in frame
const LID_OPEN = new THREE.Quaternion(-0.78333, 0, 0, 0.62161);
const BEVELS_POS = new THREE.Vector3(-0.00012, 0.00824, -0.10401);
const BEVELS_SCALE = new THREE.Vector3(0.27471, 0.27471, 0.27471);
const LAPTOP_SCREEN_ASPECT = 16 / 10;

// Camera centred on the canvas — each half puts its device at world origin.
const CAMERA_POS: [number, number, number] = [0, 3.9, -7];
const CAMERA_TARGET: [number, number, number] = [0, 2.9, 0];
const PHONE_WORLD_Y = 2.9;

const PHONE_YAW_DRIFT_END = 60;
const PHONE_YAW_DRIFT_AMOUNT = -0.09;

const ZOOM_IN_END = 18;
const SETTLED_ZOOM = 1.05;
const LAPTOP_INITIAL_ZOOM = 1.18;
const LAPTOP_END_ZOOM = SETTLED_ZOOM * 1.07;
const PHONE_INITIAL_ZOOM = 0.98;
const PHONE_END_ZOOM = SETTLED_ZOOM * 1.02;
const HOOK_DURATION_FRAMES = 64;

// Phone has no in-3D exit animation — the scroll-down transition in
// AntiCheatHook carries it off-canvas as the new scene scrolls in.

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

type DeviceKey = "laptop" | "phone";

// ── Inner scene ─────────────────────────────────────────────────────────────

const HalfScene: React.FC<{
  device: DeviceKey;
  laptopSegments: BrollSegment[];
  laptopBrollAspect: number;
  laptopVideoRef: React.RefObject<HTMLVideoElement | null>;
  emissiveIntensity: number;
  lightingIntensity: number;
  frame: number;
}> = ({
  device,
  laptopSegments,
  laptopBrollAspect,
  laptopVideoRef,
  emissiveIntensity,
  lightingIntensity,
  frame,
}) => {
  const { camera: threeCam } = useThree();
  const gltf = useGLTF(MODEL_URL);
  const env = useRemotionEnvironment();

  // Each half gets its own clone — keyed by device so the two instances
  // never share scene-graph state.
  const sceneClone = useMemo(() => gltf.scene.clone(true), [gltf]);

  const laptopScreen = useMemo(() => {
    if (device !== "laptop") return null;
    const bevels = sceneClone.getObjectByName("Bevels_2");
    return bevels ? findLaptopScreenMesh(bevels) : null;
  }, [sceneClone, device]);

  const phoneScreen = useMemo(() => {
    if (device !== "phone") return null;
    const iphone = sceneClone.getObjectByName("iphone");
    return iphone ? findPhoneScreenMesh(iphone) : null;
  }, [sceneClone, device]);

  // Hide the inactive branch. For laptop-only we drop the iphone; for
  // phone-only we hide everything that isn't the iphone subtree (the
  // tabletop and macbook live as siblings of "iphone" in the GLB).
  useEffect(() => {
    const iphone = sceneClone.getObjectByName("iphone");
    if (device === "laptop") {
      if (iphone) iphone.visible = false;
    } else {
      sceneClone.traverse((node) => {
        if (node === sceneClone) return;
        let belongsToIphone = false;
        let cursor: THREE.Object3D | null = node;
        while (cursor && cursor !== sceneClone) {
          if (cursor.name === "iphone") {
            belongsToIphone = true;
            break;
          }
          cursor = cursor.parent;
        }
        node.visible = belongsToIphone;
      });
    }
  }, [device, sceneClone]);

  // Lid stays open the whole scene now — there's no closing slam in the
  // 64-frame hook. Bevels still need their hero pose locked in once.
  if (device === "laptop") {
    const bevels = sceneClone.getObjectByName("Bevels_2");
    if (bevels) {
      bevels.position.copy(BEVELS_POS);
      bevels.quaternion.copy(LID_OPEN);
      bevels.scale.copy(BEVELS_SCALE);
    }
    sceneClone.position.set(0, LAPTOP_Y_SHIFT, 0);
  } else {
    sceneClone.position.set(0, 0, 0);
  }

  // Phone keeps a slow yaw drift over the first second so the device
  // feels alive without ever reading as overt animation.
  const driftT = clamp01(frame / PHONE_YAW_DRIFT_END);
  const driftEased = (1 - Math.cos(driftT * Math.PI)) * 0.5;

  // Zoom curves carried through the camera. Laptop gets the dominant
  // curve; phone uses the gentler one when device === "phone".
  const laptopZoomBase =
    frame < ZOOM_IN_END
      ? interpolate(
          frame,
          [0, ZOOM_IN_END],
          [LAPTOP_INITIAL_ZOOM, SETTLED_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : interpolate(
          frame,
          [ZOOM_IN_END, HOOK_DURATION_FRAMES],
          [SETTLED_ZOOM, LAPTOP_END_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
  const phoneZoomBase =
    frame < ZOOM_IN_END
      ? interpolate(
          frame,
          [0, ZOOM_IN_END],
          [PHONE_INITIAL_ZOOM, SETTLED_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : interpolate(
          frame,
          [ZOOM_IN_END, HOOK_DURATION_FRAMES],
          [SETTLED_ZOOM, PHONE_END_ZOOM],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  const beatKick = beatPulseScene(frame, "Hook", 4, 26);
  const laptopZoom = laptopZoomBase + beatKick * 0.01;
  const phoneZoom = phoneZoomBase + beatKick * 0.007;
  const activeZoom = device === "laptop" ? laptopZoom : phoneZoom;

  const yawKick = beatKick * -0.005;
  const yawDrift = PHONE_YAW_DRIFT_AMOUNT * driftEased + yawKick;

  if (device === "phone") {
    const iphone = sceneClone.getObjectByName("iphone");
    if (iphone) {
      iphone.position.set(0, PHONE_WORLD_Y, 0);
      iphone.scale.setScalar(PHONE_BASE_SCALE);
      const cameraForward = new THREE.Vector3(...CAMERA_TARGET)
        .sub(new THREE.Vector3(...CAMERA_POS))
        .normalize();
      const phoneLookTarget = new THREE.Vector3(0, PHONE_WORLD_Y, 0)
        .addScaledVector(cameraForward, 50);
      iphone.lookAt(phoneLookTarget);
      iphone.rotateY(yawDrift);
    }
  }

  const perspCam = threeCam as THREE.PerspectiveCamera;
  perspCam.position.set(...CAMERA_POS);
  perspCam.lookAt(...CAMERA_TARGET);
  perspCam.fov = 50;
  perspCam.zoom = activeZoom;
  perspCam.updateProjectionMatrix();

  return (
    <>
      <primitive object={sceneClone} />
      <React.Suspense fallback={null}>
        {device === "laptop" &&
          (env.isRendering
            ? laptopSegments.map((seg, i) => (
                <Sequence
                  key={`l-${i}`}
                  from={seg.from - seg.startFrom}
                  durationInFrames={seg.durationInFrames + seg.startFrom}
                  layout="none"
                >
                  <RenderedScreen
                    mesh={laptopScreen}
                    broll={seg.url}
                    brollAspect={laptopBrollAspect}
                    screenAspect={LAPTOP_SCREEN_ASPECT}
                    emissiveIntensity={emissiveIntensity}
                    brightness={1}
                  />
                </Sequence>
              ))
            : (
              <PreviewScreen
                mesh={laptopScreen}
                videoRef={laptopVideoRef}
                canvasW={1280}
                canvasH={800}
                emissiveIntensity={emissiveIntensity}
                brightness={1}
                frame={frame}
              />
            ))}
        {device === "phone" && (
          <PhoneChart
            mesh={phoneScreen}
            emissiveIntensity={emissiveIntensity}
            brightness={1}
            frame={frame}
          />
        )}
      </React.Suspense>
      <Environment
        preset="apartment"
        environmentIntensity={1.4 * lightingIntensity}
      />
      <ambientLight intensity={0.45 * lightingIntensity} />
      <directionalLight
        position={[5, 8, -5]}
        intensity={1.6 * lightingIntensity}
        castShadow
      />
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.45}
        scale={14}
        blur={1.8}
        far={5}
      />
    </>
  );
};

// ── Wrapper ────────────────────────────────────────────────────────────────

export type AntiCheatHookHalfSceneProps = {
  device: DeviceKey;
  laptopSegments: BrollSegment[];
  laptopBrollAspect?: number;
  width?: number;
  height?: number;
  emissiveIntensity?: number;
  lightingIntensity?: number;
};

export const AntiCheatHookHalfScene: React.FC<AntiCheatHookHalfSceneProps> = ({
  device,
  laptopSegments,
  laptopBrollAspect = 16 / 9,
  width = 960,
  height = 1080,
  emissiveIntensity = 1.6,
  lightingIntensity = 0.85,
}) => {
  const frame = useCurrentFrame();
  const laptopVideoRef = useRef<HTMLVideoElement | null>(null);
  const env = useRemotionEnvironment();

  return (
    <AbsoluteFill style={{ width, height, background: "transparent" }}>
      {!env.isRendering && device === "laptop" && (
        <>
          {laptopSegments.map((seg, i) => (
            <PreviewVideo
              key={`l-${i}`}
              segment={seg}
              videoRef={laptopVideoRef}
            />
          ))}
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
          toneMappingExposure: 0.9,
        }}
        style={{ background: "transparent" }}
      >
        <React.Suspense fallback={null}>
          <HalfScene
            device={device}
            laptopSegments={laptopSegments}
            laptopBrollAspect={laptopBrollAspect}
            laptopVideoRef={laptopVideoRef}
            emissiveIntensity={emissiveIntensity}
            lightingIntensity={lightingIntensity}
            frame={frame}
          />
        </React.Suspense>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
