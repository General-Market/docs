import React, { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { staticFile } from "remotion";
// @ts-ignore — SkeletonUtils types may not be bundled
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

const MODEL_URL = staticFile("models/RobotExpressive.glb");
useGLTF.preload(MODEL_URL);

// ── Impact timing helper (shared between scene + characters) ────────────────
export const IMPACT_EVENTS = [
  { triggerFrame: 50, landFrame: 62, landZ: -1 },
  { triggerFrame: 110, landFrame: 122, landZ: 7 },
  { triggerFrame: 170, landFrame: 182, landZ: 14 },
];

/** Returns 0–1 flinch intensity based on distance from any active impact */
export function getImpactFlinch(
  frame: number,
  posZ: number,
  flinchRadius = 12,
  flinchDuration = 20,
): number {
  let maxFlinch = 0;
  for (const evt of IMPACT_EVENTS) {
    const elapsed = frame - evt.landFrame;
    if (elapsed < 0 || elapsed > flinchDuration) continue;
    const timeFade = 1 - elapsed / flinchDuration;
    const dist = Math.abs(posZ - evt.landZ);
    const distFade = Math.max(0, 1 - dist / flinchRadius);
    maxFlinch = Math.max(maxFlinch, timeFade * distFade);
  }
  return maxFlinch;
}

// ── Animated Robot character loaded from GLB ────────────────────────────────
// Available animations: Dance, Death, Idle, Jump, No, Punch, Running, Sitting,
// Standing, ThumbsUp, Walking, WalkJump, Wave, Yes
const MODEL_SCALE = 0.85;

const RobotCharacter: React.FC<{
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
  animationTime?: number; // absolute time in seconds
  flinchAmount?: number;
}> = ({
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  animationName = "Walking",
  animationTime,
  flinchAmount = 0,
}) => {
  const gltf = useGLTF(MODEL_URL);

  // Clone scene per instance (each needs its own skeleton for independent poses)
  const { cloned, mixer } = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;

    // Apply color tint to materials
    if (color) {
      const tint = new THREE.Color(color);
      c.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          const newMats = mats.map((m) => {
            const nm = (m as THREE.MeshStandardMaterial).clone();
            nm.color.lerp(tint, 0.45);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }

    return { cloned: c, mixer: new THREE.AnimationMixer(c) };
  }, [gltf.scene, color]);

  // Play the requested animation clip
  useMemo(() => {
    mixer.stopAllAction();
    const clip = gltf.animations.find((a) => a.name === animationName);
    if (clip) mixer.clipAction(clip).play();
  }, [animationName, mixer, gltf.animations]);

  // Sync animation time to Remotion frame
  mixer.setTime(animationTime ?? frame / fps);

  const s = scale * MODEL_SCALE;
  const flinchLean = flinchAmount * -0.3;

  return (
    <group
      position={position}
      rotation={[flinchLean, rotationY, 0]}
      scale={[s, s, s]}
    >
      <primitive object={cloned} />
    </group>
  );
};

// ── Walking character — main protagonist ────────────────────────────────────
export const WalkingCharacter: React.FC<{
  frame: number;
  walkPos: [number, number, number];
  color?: string;
  secondaryColor?: string;
  rotationY?: number;
  excited?: boolean;
  excitedIntensity?: number;
  scale?: number;
  flinchAmount?: number;
}> = ({
  frame,
  walkPos,
  color = "#6366F1",
  rotationY = 0,
  excited = false,
  excitedIntensity = 0,
  scale = 1,
  flinchAmount = 0,
}) => {
  const animName =
    excited && excitedIntensity > 0.5 ? "Dance" : "Walking";

  return (
    <RobotCharacter
      frame={frame}
      position={walkPos}
      rotationY={rotationY}
      scale={scale}
      color={color}
      animationName={animName}
      animationTime={frame / 30}
      flinchAmount={flinchAmount}
    />
  );
};

// ── NPC Walker — walks a path, animation synced to distance ────────────────
export const NPCWalker: React.FC<{
  frame: number;
  path: [number, number, number][];
  speed?: number;
  color?: string;
  secondaryColor?: string;
  startDelay?: number;
  scale?: number;
}> = ({
  frame,
  path,
  speed = 0.008,
  color = "#6366F1",
  startDelay = 0,
  scale = 0.9,
}) => {
  const effectiveFrame = Math.max(0, frame - startDelay);

  const totalLen = useMemo(() => {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dz = path[i][2] - path[i - 1][2];
      len += Math.sqrt(dx * dx + dz * dz);
    }
    return len;
  }, [path]);

  const rawProgress = (effectiveFrame * speed) % 1;

  const { pos, angle } = useMemo(() => {
    let targetDist = rawProgress * totalLen;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i][0] - path[i - 1][0];
      const dy = path[i][1] - path[i - 1][1];
      const dz = path[i][2] - path[i - 1][2];
      const segLen = Math.sqrt(dx * dx + dz * dz);
      if (targetDist <= segLen) {
        const t = segLen > 0 ? targetDist / segLen : 0;
        return {
          pos: [
            path[i - 1][0] + dx * t,
            path[i - 1][1] + dy * t,
            path[i - 1][2] + dz * t,
          ] as [number, number, number],
          angle: Math.atan2(dx, dz),
        };
      }
      targetDist -= segLen;
    }
    return { pos: path[path.length - 1], angle: 0 };
  }, [path, rawProgress, totalLen]);

  if (effectiveFrame <= 0) return null;

  const distTraveled = rawProgress * totalLen;
  const flinch = getImpactFlinch(frame, pos[2]);

  // Walk animation time tied to distance so feet match movement speed
  const walkAnimTime = distTraveled * 0.55;

  return (
    <RobotCharacter
      frame={frame}
      position={pos}
      rotationY={angle}
      scale={scale}
      color={color}
      animationName="Walking"
      animationTime={walkAnimTime}
      flinchAmount={flinch}
    />
  );
};

// ── Bystander — idle with flinch reaction ──────────────────────────────────
export const Bystander: React.FC<{
  position: [number, number, number];
  color: string;
  secondaryColor?: string;
  frame: number;
  swaySpeed?: number;
  swayAmount?: number;
  rotationY?: number;
  scale?: number;
}> = ({ position, color, frame, rotationY = 0, scale = 1 }) => {
  const flinch = getImpactFlinch(frame, position[2]);

  // Switch to startled Jump animation on strong impacts
  const animName = flinch > 0.3 ? "Jump" : "Idle";

  return (
    <RobotCharacter
      frame={frame}
      position={position}
      rotationY={rotationY}
      scale={scale}
      color={color}
      animationName={animName}
      animationTime={frame / 30}
      flinchAmount={flinch}
    />
  );
};
