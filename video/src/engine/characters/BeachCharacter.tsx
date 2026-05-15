import React, { useMemo, useEffect } from "react";
import * as THREE from "three";
// @ts-ignore
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useGLTF } from "@react-three/drei";
import { staticFile } from "remotion";
import { preloadOnce } from "../../lib/preloadOnce";

const ROBOT_URL = staticFile("models/RobotExpressive.glb");
preloadOnce(useGLTF.preload, ROBOT_URL);

export const BeachCharacter: React.FC<{
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
}> = ({
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  animationName = "Idle",
}) => {
  const gltf = useGLTF(ROBOT_URL);

  const { cloned, mixer } = useMemo(() => {
    const c = cloneSkeleton(gltf.scene) as THREE.Group;
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

  useEffect(() => {
    mixer.stopAllAction();
    const clip = gltf.animations.find((a) => a.name === animationName);
    if (clip) mixer.clipAction(clip).play();
  }, [animationName, mixer, gltf.animations]);

  try { mixer.setTime(frame / fps); } catch { /* ignore stale mixer */ }

  const s = scale * 0.85;

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={[s, s, s]}
    >
      <primitive object={cloned} />
    </group>
  );
};
