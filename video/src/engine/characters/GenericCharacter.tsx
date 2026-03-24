import React, { useMemo } from "react";
import * as THREE from "three";
// @ts-ignore
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useGLTF } from "@react-three/drei";
import { canonicalBone, SOLDIER_URL } from "./animRetarget";
import { SOLDIER_ANIM } from "./CharacterRegistry";

// ---------------------------------------------------------------------------
// Generic character — loads any GLB model, plays embedded animations if
// available, otherwise copies Soldier's Walk/Run/Idle bone poses directly.
// ---------------------------------------------------------------------------

export const GenericCharacter: React.FC<{
  modelUrl: string;
  frame: number;
  fps?: number;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  color?: string;
  animationName?: string;
  baseScaleFactor?: number; // model-specific size correction
}> = ({
  modelUrl,
  frame,
  fps = 30,
  position,
  rotationY = 0,
  scale = 1,
  color,
  animationName = "Idle",
  baseScaleFactor = 1,
}) => {
  const gltf = useGLTF(modelUrl);
  const soldierGltf = useGLTF(SOLDIER_URL);

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
    // Force TRS mode on all nodes — Sketchfab GLTFs often set matrixAutoUpdate=false
    // which means quaternion/position changes are silently ignored during rendering.
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [gltf.scene, color]);

  // Find the target SkinnedMesh (needed for retargetClip)
  const targetMesh = useMemo((): THREE.SkinnedMesh | null => {
    let mesh: THREE.SkinnedMesh | null = null;
    cloned.traverse((nd: THREE.Object3D) => {
      if ((nd as THREE.SkinnedMesh).isSkinnedMesh && !mesh) mesh = nd as THREE.SkinnedMesh;
    });
    return mesh;
  }, [cloned]);

  // Clone Soldier scene for retargeting (retargetClip modifies the source)
  const soldierClone = useMemo(() => {
    const c = cloneSkeleton(soldierGltf.scene) as THREE.Group;
    // Force TRS mode — ensures bone.quaternion is the actual local Q
    c.traverse((nd) => {
      if (!nd.matrixAutoUpdate) {
        nd.matrix.decompose(nd.position, nd.quaternion, nd.scale);
        nd.matrixAutoUpdate = true;
      }
    });
    return c;
  }, [soldierGltf.scene]);

  // Build bone-name mapping: target bone name → soldier bone name
  const boneNameMap = useMemo(() => {
    const names: Record<string, string> = {};
    if (!targetMesh?.skeleton) return names;
    // Index soldier bones by canonical name
    const soldierByCanon: Record<string, string> = {};
    soldierClone.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) {
        const canon = canonicalBone(nd.name).toLowerCase();
        if (!soldierByCanon[canon]) soldierByCanon[canon] = nd.name;
      }
    });
    // Map each target bone to its soldier counterpart
    for (const b of targetMesh!.skeleton.bones) {
      const canon = canonicalBone(b.name).toLowerCase();
      if (soldierByCanon[canon]) names[b.name] = soldierByCanon[canon];
    }
    return names;
  }, [targetMesh, soldierClone]);

  // Animation retargeting using the Wicked Engine / retargeting-threejs world-space formula:
  //   retargetedLocalQ = left * srcAnimLocalQ * right
  // where:
  //   left  = inv(trgParentWorldBindQ) * srcParentWorldBindQ
  //   right = inv(srcWorldBindQ) * trgWorldBindQ
  //
  // This correctly handles different bind poses (T-pose source → A-pose target)
  // by going through world space. World bind Qs from skeleton.boneInverses.
  // Root bones (Hips) whose parent is not a bone are skipped.
  const retargetedClips = useMemo(() => {
    const clips: Record<string, THREE.AnimationClip> = {};
    if (!targetMesh?.skeleton) return clips;

    // Find soldier SkinnedMesh (needed for boneInverses)
    const soldierMeshes: THREE.SkinnedMesh[] = [];
    soldierClone.traverse((nd) => {
      if ((nd as THREE.SkinnedMesh).isSkinnedMesh)
        soldierMeshes.push(nd as THREE.SkinnedMesh);
    });
    const soldierMesh = soldierMeshes[0];
    if (!soldierMesh?.skeleton) return clips;

    // --- Compute WORLD bind-pose quaternions from boneInverses ---
    // inv(boneInverse[i]) = world bind matrix → decompose for world bind Q.
    // These are the ground-truth world orientations at bind time.
    const _m4 = new THREE.Matrix4();
    const _pos = new THREE.Vector3();
    const _scl = new THREE.Vector3();
    const _quat = new THREE.Quaternion();

    const srcWorldBindQ: Record<string, THREE.Quaternion> = {};
    for (let i = 0; i < soldierMesh.skeleton.bones.length; i++) {
      _m4.copy(soldierMesh.skeleton.boneInverses[i]).invert();
      _m4.decompose(_pos, _quat, _scl);
      srcWorldBindQ[soldierMesh.skeleton.bones[i].name] = _quat.clone();
    }

    const trgWorldBindQ: Record<string, THREE.Quaternion> = {};
    for (let i = 0; i < targetMesh.skeleton.bones.length; i++) {
      _m4.copy(targetMesh.skeleton.boneInverses[i]).invert();
      _m4.decompose(_pos, _quat, _scl);
      trgWorldBindQ[targetMesh.skeleton.bones[i].name] = _quat.clone();
    }

    // Index soldier bones by name
    const soldierBoneByName: Record<string, THREE.Bone> = {};
    soldierClone.traverse((nd) => {
      if ((nd as THREE.Bone).isBone) soldierBoneByName[nd.name] = nd as THREE.Bone;
    });

    // Build bone pairs + reverse map (soldier name → target name)
    type BonePair = { target: THREE.Bone; soldier: THREE.Bone };
    const pairs: BonePair[] = [];
    const soldierToTarget: Record<string, string> = {};
    for (const bone of targetMesh.skeleton.bones) {
      const soldierName = boneNameMap[bone.name];
      if (soldierName && soldierBoneByName[soldierName]) {
        pairs.push({ target: bone, soldier: soldierBoneByName[soldierName] });
        soldierToTarget[soldierName] = bone.name;
      }
    }
    if (pairs.length === 0) return clips;

    // --- Precompute retargeting quaternions (world-space formula) ---
    // left  = inv(trgParentWorldBind) * srcParentWorldBind
    // right = inv(srcWorldBind) * trgWorldBind
    // Per keyframe: trgLocal = left * srcAnimLocal * right
    const retargetLeftQ: Record<string, THREE.Quaternion> = {};
    const retargetRightQ: Record<string, THREE.Quaternion> = {};

    for (const { target, soldier } of pairs) {
      // Skip root bones (parent not a bone — Hips in Soldier)
      const srcParent = soldier.parent;
      const trgParent = target.parent;
      const srcParentIsBone = srcParent
        && (srcParent as THREE.Bone).isBone
        && srcWorldBindQ[srcParent.name];
      const trgParentIsBone = trgParent
        && (trgParent as THREE.Bone).isBone
        && trgWorldBindQ[trgParent.name];
      if (!srcParentIsBone || !trgParentIsBone) continue;

      const srcPWB = srcWorldBindQ[srcParent!.name];
      const srcWB = srcWorldBindQ[soldier.name];
      const trgPWB = trgWorldBindQ[trgParent!.name];
      const trgWB = trgWorldBindQ[target.name];
      if (!srcPWB || !srcWB || !trgPWB || !trgWB) continue;

      // left = inv(trgParentWorldBind) * srcParentWorldBind
      retargetLeftQ[soldier.name] = trgPWB.clone().conjugate().multiply(srcPWB);
      // right = inv(srcWorldBind) * trgWorldBind
      retargetRightQ[soldier.name] = srcWB.clone().conjugate().multiply(trgWB);
    }

    // --- Process each Soldier animation clip (direct track transform) ---
    for (const clip of soldierGltf.animations) {
      if (clip.duration < 0.1) continue;

      const newTracks: THREE.KeyframeTrack[] = [];

      for (const track of clip.tracks) {
        // Only retarget quaternion tracks
        if (!track.name.endsWith(".quaternion")) continue;

        const srcBoneName = track.name.replace(".quaternion", "");
        const trgBoneName = soldierToTarget[srcBoneName];
        if (!trgBoneName) continue;

        // World-space retargeting: trgLocal = left * srcAnimLocal * right
        const left = retargetLeftQ[srcBoneName];
        const right = retargetRightQ[srcBoneName];
        if (!left || !right) continue;

        const srcValues = track.values;
        const newValues = new Float32Array(srcValues.length);

        for (let i = 0; i < srcValues.length; i += 4) {
          _quat.set(srcValues[i], srcValues[i + 1], srcValues[i + 2], srcValues[i + 3]);
          _quat.premultiply(left);   // left * srcLocal
          _quat.multiply(right);     // * right

          newValues[i] = _quat.x;
          newValues[i + 1] = _quat.y;
          newValues[i + 2] = _quat.z;
          newValues[i + 3] = _quat.w;
        }

        newTracks.push(new THREE.QuaternionKeyframeTrack(
          `${trgBoneName}.quaternion`,
          Float32Array.from(track.times),
          newValues,
        ));
      }

      if (newTracks.length > 0) {
        clips[clip.name] = new THREE.AnimationClip(clip.name, clip.duration, newTracks);
      }
    }

    return clips;
  }, [targetMesh, soldierClone, boneNameMap, soldierGltf.animations, cloned]);

  // Single mixer for the target model
  const mixer = useMemo(() => new THREE.AnimationMixer(cloned), [cloned]);

  // Pick the best clip: own animation first, then retargeted soldier clip
  const activeClip = useMemo(() => {
    mixer.stopAllAction();
    const mapped = SOLDIER_ANIM[animationName] ?? "Idle";
    const candidates = [animationName, mapped].filter(Boolean) as string[];

    // 1) Try model's own animation
    for (const name of candidates) {
      const clip = gltf.animations.find(
        (a) =>
          (a.name === name || a.name.toLowerCase() === name.toLowerCase()) &&
          a.duration > 0.1,
      );
      if (clip) {
        mixer.clipAction(clip).play();
        return clip.name;
      }
    }

    // 2) Fall back to retargeted Soldier clip
    const soldierClip = retargetedClips[mapped];
    if (soldierClip) {
      mixer.clipAction(soldierClip).play();
      return soldierClip.name;
    }
    return null;
  }, [animationName, mixer, gltf.animations, retargetedClips]);

  // Debug: log once
  const debuggedRef = React.useRef(false);
  if (!debuggedRef.current) {
    debuggedRef.current = true;
    // Show arm-specific bone mapping to verify retargeting
    const armBones = Object.entries(boneNameMap).filter(([t]) => {
      const c = canonicalBone(t).toLowerCase();
      return c.includes("shoulder") || c.includes("arm") || c.includes("hand");
    });
    // Count retargeted tracks per clip
    const trackCounts = Object.fromEntries(
      Object.entries(retargetedClips).map(([name, clip]) => [name, clip.tracks.length]),
    );
    console.warn(
      `[GenericChar] model=${modelUrl.split("/").pop()} activeClip=${activeClip}`,
      `\n  boneMap(${Object.keys(boneNameMap).length} bones):`,
      Object.entries(boneNameMap).slice(0, 8).map(([t, s]) => `${t}→${s}`).join(", "),
      `\n  armBones(${armBones.length}):`, armBones.map(([t, s]) => `${t}→${s}`).join(", "),
      `\n  retargetedClips:`, JSON.stringify(trackCounts),
    );
  }

  // --- Per-frame animation ---
  try {
    if (activeClip) {
      mixer.setTime(frame / fps);
    }
  } catch (err) {
    console.error("[GenericChar] animation error:", modelUrl.split("/").pop(), err);
  }

  const s = scale * baseScaleFactor;

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
