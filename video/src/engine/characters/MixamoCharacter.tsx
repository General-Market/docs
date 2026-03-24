import React, { useMemo } from "react";
import * as THREE from "three";
// @ts-ignore
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
// @ts-ignore
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { staticFile } from "remotion";
import { canonicalBone } from "./animRetarget";
import { CHAR_FOLDER } from "./CharacterRegistry";

// ---------------------------------------------------------------------------
// Mixamo Character — loads FBX animations directly from character folder
// Used for characters with Mixamo FBX animation libraries (bypasses Soldier retargeting)
// ---------------------------------------------------------------------------

export const MixamoCharacter: React.FC<{
  modelUrl: string;
  animName: string; // FBX file stem, e.g. "idle", "look-around"
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  baseScaleFactor?: number;
  stripRootMotion?: boolean; // true = zero out Hips XZ drift (keep vertical bounce)
  handProp?: "phone"; // attach a prop to left hand bone
}> = ({
  modelUrl,
  animName,
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  baseScaleFactor = 1,
  stripRootMotion = false,
  handProp,
}) => {
  const gltf = useGLTF(modelUrl);
  const charFolder = CHAR_FOLDER[modelUrl];
  const fbxUrl = staticFile(`${charFolder}/${animName}.fbx`);
  const fbx = useLoader(FBXLoader, fbxUrl) as THREE.Group;

  // Clone target model + tint
  const cloned = useMemo(() => {
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
            nm.color.lerp(tint, 0.3);
            return nm;
          });
          mesh.material = newMats.length === 1 ? newMats[0] : newMats;
        }
      });
    }
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [gltf.scene, color]);

  // Build map: canonical bone name (lowercase) -> target model bone name
  const targetBoneMap = useMemo(() => {
    const map: Record<string, string> = {};
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.name;
      }
    });
    return map;
  }, [cloned]);

  // Capture rest-pose quaternions from both skeletons (before any animation plays).
  // FBX skeleton = Mixamo auto-rig rest pose, target = CasualMan's original bind pose.
  // The difference is used to correct each animation keyframe.
  const fbxRestQ = useMemo(() => {
    const map: Record<string, THREE.Quaternion> = {};
    (fbx as THREE.Group).traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.quaternion.clone();
      }
    });
    return map;
  }, [fbx]);

  const trgRestQ = useMemo(() => {
    const map: Record<string, THREE.Quaternion> = {};
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!map[canon]) map[canon] = nd.quaternion.clone();
      }
    });
    return map;
  }, [cloned]);

  // Remap FBX animation tracks to target skeleton bone names.
  // For quaternion tracks: apply rest-pose offset correction so that the
  // animation "delta" from Mixamo's bind pose maps correctly to CasualMan's bind pose.
  //   offset = trgRest * inv(srcRest)
  //   correctedQ = offset * srcAnimQ
  // Only keep quaternion tracks + Hips position (root motion).
  const remappedClip = useMemo(() => {
    if (!fbx.animations?.length) return null;
    const srcClip = fbx.animations[0]; // Mixamo FBX has one clip
    const newTracks: THREE.KeyframeTrack[] = [];
    const _q = new THREE.Quaternion();

    for (const track of srcClip.tracks) {
      const dotIdx = track.name.lastIndexOf(".");
      if (dotIdx < 0) continue;
      const srcBone = track.name.substring(0, dotIdx);
      const prop = track.name.substring(dotIdx); // ".quaternion", ".position", ".scale"

      const canon = canonicalBone(srcBone).toLowerCase();
      // Only keep quaternion tracks + Hips position (root motion)
      if (prop === ".position" && canon !== "hips") continue;
      if (prop === ".scale") continue;

      const targetBone = targetBoneMap[canon];
      if (!targetBone) continue;

      if (prop === ".quaternion") {
        // Apply rest-pose offset: correctedQ = offset * srcAnimQ
        const srcRest = fbxRestQ[canon];
        const trgRest = trgRestQ[canon];
        const values = Float32Array.from(track.values);

        if (srcRest && trgRest) {
          const offset = trgRest.clone().multiply(srcRest.clone().conjugate());
          for (let i = 0; i < values.length; i += 4) {
            _q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
            _q.premultiply(offset);
            values[i] = _q.x;
            values[i + 1] = _q.y;
            values[i + 2] = _q.z;
            values[i + 3] = _q.w;
          }
        }

        newTracks.push(new THREE.QuaternionKeyframeTrack(
          `${targetBone}${prop}`,
          Float32Array.from(track.times),
          values,
        ));
      } else {
        // Position track (Hips only)
        if (stripRootMotion) {
          // Zero out horizontal drift (X/Z) — keep vertical bounce (Y)
          const values = Float32Array.from(track.values);
          const x0 = values[0], z0 = values[2]; // lock to first-frame origin
          for (let i = 0; i < values.length; i += 3) {
            values[i] = x0;       // lock X
            values[i + 2] = z0;   // lock Z (Y at i+1 preserved)
          }
          newTracks.push(new THREE.VectorKeyframeTrack(
            `${targetBone}${prop}`,
            Float32Array.from(track.times),
            values,
          ));
        } else {
          const newTrack = track.clone();
          newTrack.name = `${targetBone}${prop}`;
          newTracks.push(newTrack);
        }
      }
    }

    if (newTracks.length === 0) return null;
    return new THREE.AnimationClip(srcClip.name || animName, srcClip.duration, newTracks);
  }, [fbx, targetBoneMap, fbxRestQ, trgRestQ, animName, stripRootMotion]);

  // Debug: log remapping info once per animation
  const debuggedRef = React.useRef("");
  if (debuggedRef.current !== animName) {
    debuggedRef.current = animName;
    const srcTracks = fbx.animations?.[0]?.tracks ?? [];
    const unmapped = srcTracks
      .filter((t) => {
        const d = t.name.lastIndexOf(".");
        const bone = d > 0 ? t.name.substring(0, d) : t.name;
        return !targetBoneMap[canonicalBone(bone).toLowerCase()];
      })
      .map((t) => t.name);
    console.warn(
      `[MixamoChar] anim="${animName}" fbxTracks=${srcTracks.length}`,
      `remapped=${remappedClip?.tracks.length ?? 0}`,
      `targetBones=${Object.keys(targetBoneMap).length}`,
      unmapped.length > 0 ? `\n  unmapped: ${unmapped.join(", ")}` : "",
    );
  }

  // Create mixer and play the remapped clip
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  useMemo(() => {
    mixer.stopAllAction();
    if (remappedClip) mixer.clipAction(remappedClip).play();
  }, [remappedClip, mixer]);

  // Attach hand prop (phone) to left hand bone
  useMemo(() => {
    // Always clean up any existing prop first
    const old = cloned.getObjectByName("__hand_prop");
    if (old?.parent) old.parent.remove(old);

    if (!handProp) return;

    // Find left hand bone
    let foundBone: THREE.Object3D | undefined;
    cloned.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const name = canonicalBone(nd.name).toLowerCase();
        if (name === "lefthand") foundBone = nd;
      }
    });
    if (!foundBone) return;
    const handBone = foundBone;

    if (handProp === "phone") {
      const phoneGroup = new THREE.Group();
      phoneGroup.name = "__hand_prop";
      // Phone body (dark slab) — realistic smartphone ~7cm x 14cm
      const bodyGeo = new THREE.BoxGeometry(0.07, 0.14, 0.01);
      const bodyMat = new THREE.MeshStandardMaterial({ color: "#111111", roughness: 0.15, metalness: 0.9 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      phoneGroup.add(body);
      // Screen (glowing)
      const screenGeo = new THREE.BoxGeometry(0.06, 0.12, 0.003);
      const screenMat = new THREE.MeshStandardMaterial({ color: "#223355", emissive: "#334466", emissiveIntensity: 1.5, roughness: 0.05 });
      const screen = new THREE.Mesh(screenGeo, screenMat);
      screen.position.z = 0.007; // screen faces outward from palm
      phoneGroup.add(screen);
      // Position: nestled between thumb and fingers
      phoneGroup.position.set(0, 0.08, 0.02);
      phoneGroup.rotation.set(0.45, 0.1, Math.PI / 2);
      handBone.add(phoneGroup);
    }
  }, [cloned, handProp]);

  // Advance to current frame (deterministic for Remotion)
  try { mixer.setTime(frame / fps); } catch { /* ignore stale mixer */ }

  const s = scale * baseScaleFactor;
  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[s, s, s]}>
      <primitive object={cloned} />
    </group>
  );
};
