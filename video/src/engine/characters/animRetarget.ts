// ---------------------------------------------------------------------------
// Animation retargeting — reuse Soldier's Walk/Run/Idle on any humanoid model
// Maps bone names across naming conventions:
//   Soldier/Mixamo:    mixamorig:LeftArm
//   CasualMan/Fashion: LeftArm_27, Hips_02
//   DancingGurl:       mixamorig:LeftArm_09
//   EricBusinessman:   upperarm_l_024  (UE4 style)
//   NyanChanBikini:    J_Bip_L_UpperArm_67  (VRM style)
// ---------------------------------------------------------------------------

import { staticFile } from "remotion";
import { useGLTF } from "@react-three/drei";
import { preloadOnce } from "../../lib/preloadOnce";

export const SOLDIER_URL = staticFile("models/Soldier.glb");
preloadOnce(useGLTF.preload, SOLDIER_URL);

/** Normalize any humanoid bone name to standard Mixamo canonical form */
export function canonicalBone(name: string): string {
  let n = name.replace(/_\d+$/, ""); // strip numeric suffix

  // Mixamorig prefix (Soldier, DancingGurl) — colon stripped by GLTFLoader sanitization
  n = n.replace(/^mixamorig:?/, "");

  // VRM prefix (NyanChan) — extract side then remap
  const vrm = n.match(/^J_Bip_([CLR])_(.*)/);
  if (vrm) {
    const side = vrm[1];
    let part = vrm[2];
    const vrmRename: Record<string, string> = {
      UpperArm: "Arm", LowerArm: "ForeArm",
      UpperLeg: "UpLeg", LowerLeg: "Leg",
    };
    part = vrmRename[part] ?? part;
    n = (side === "L" ? "Left" : side === "R" ? "Right" : "") + part;
  }

  // UE4 naming (EricBusinessman)
  const ue4: Record<string, string> = {
    hip: "Hips", spine_01: "Spine", spine_02: "Spine1", spine_03: "Spine2",
    neck: "Neck", head: "Head", head_end: "HeadTop_End",
    shoulder_l: "LeftShoulder", upperarm_l: "LeftArm",
    lowerarm_l: "LeftForeArm", hand_l: "LeftHand",
    shoulder_r: "RightShoulder", upperarm_r: "RightArm",
    lowerarm_r: "RightForeArm", hand_r: "RightHand",
    upperleg_l: "LeftUpLeg", lowerleg_l: "LeftLeg",
    foot_l: "LeftFoot", foot_end_l: "LeftToeBase",
    upperleg_r: "RightUpLeg", lowerleg_r: "RightLeg",
    foot_r: "RightFoot", foot_end_r: "RightToeBase",
  };
  const lower = n.toLowerCase();
  if (ue4[lower]) return ue4[lower];

  return n;
}
