// ---------------------------------------------------------------------------
// Character registry — single-place definition for all character models.
// To add/swap a character: add one entry to CHARACTERS + drop files in folder.
// ---------------------------------------------------------------------------

import { staticFile } from "remotion";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
// @ts-ignore — FBXLoader types may not be bundled
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { preloadOnce, preloadOnceWith } from "../../lib/preloadOnce";

export const CHAR_DIR = "models/characters";

export type CharacterKey = "casualMan" | "eric" | "drex" | "dancingGurl" | "nyanChan";

export interface CharacterDef {
  folder: string;
  glbFile?: string;              // defaults to ${folder}.glb
  baseScale: number;
  fbxAnims?: "all" | string[];   // "all" = full library, string[] = specific files, undefined = Soldier fallback
  npc?: boolean;
  npcTags?: string[];            // pool filtering ("beach", etc.)
}

export const CHARACTERS: Record<CharacterKey, CharacterDef> = {
  casualMan: {
    folder: "CasualMan", baseScale: 0.6, fbxAnims: "all", npc: true,
  },
  eric: {
    folder: "EricBusinessman", baseScale: 0.006,
  },
  drex: {
    folder: "Drex", baseScale: 0.6, fbxAnims: [
      "idle", "walking", "running", "acknowledging", "arm-stretching",
      "bboy-hip-hop-move", "bboy-uprock-start", "bboy-uprock",
      "cheering", "cheering-1", "dancing", "silly-dancing",
      "standard-idle", "standard-run", "standard-walk",
      "swing-dancing", "wiping-sweat",
    ],
  },
  dancingGurl: {
    folder: "DancingGurl", baseScale: 0.6, npc: true, npcTags: ["beach"], fbxAnims: [
      "idle", "walking", "running", "salsa-dancing",
      "chicken-dance", "female-walk", "happy", "samba-dancing",
      "standing-arguing", "standing", "walk-in-circle", "texting-and-walking",
      "running-1", "salsa-dancing-2", "talking-2",
    ],
  },
  nyanChan: {
    folder: "NyanChanBikini", baseScale: 0.35,
  },
};

// Preload list for characters with fbxAnims: "all" (only a curated subset)
export const CHAR_ALL_FBX_PRELOAD: Partial<Record<CharacterKey, string[]>> = {
  casualMan: [
    "look-around", "pointing", "weight-shift", "excited", "entering-code",
    "surprised", "counting", "hands-forward-gesture", "neck-stretching",
    "angry-point", "laughing", "yelling-while-standing", "thoughtful-head-nod",
    "defeated", "running", "shrugging", "entering-car", "idle",
    "walking", "salsa-dancing", "waving", "agreeing", "fall-flat",
    "talking", "victory", "cards", "treadmill-running",
  ],
};

// Scene role constants — swap OTHER_CHARACTER to change the secondary character
export const PROTAGONIST: CharacterKey = "casualMan";
export const OTHER_CHARACTER: CharacterKey = "drex";

export const PROTAGONIST_COLOR = "#3B82F6";
export const BIG_ROBOT_COLOR = "#1a3a6a";

// --- Derived lookups (computed once from CHARACTERS) ---

export const CHAR_URLS = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    key,
    staticFile(`${CHAR_DIR}/${def.folder}/${def.glbFile ?? `${def.folder}.glb`}`),
  ]),
) as Record<CharacterKey, string>;

export const CHAR_FOLDER: Record<string, string> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    CHAR_URLS[key], `${CHAR_DIR}/${def.folder}`,
  ]),
);

export const MODEL_BASE_SCALE: Record<string, number> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]).map(([key, def]) => [
    CHAR_URLS[key], def.baseScale,
  ]),
);

export const CHAR_AVAILABLE_FBX: Record<string, "all" | Set<string>> = Object.fromEntries(
  (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][])
    .filter(([, def]) => def.fbxAnims)
    .map(([key, def]) => [
      CHAR_URLS[key],
      def.fbxAnims === "all" ? "all" : new Set(def.fbxAnims),
    ]),
);

export const NPC_MODEL_POOL: string[] = (Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][])
  .filter(([, def]) => def.npc)
  .map(([key]) => CHAR_URLS[key]);

// Map old NPC/Soldier animation names → Mixamo FBX file stems (lowercase)
export const ANIM_TO_FBX: Record<string, string> = {
  Walk: "walking",
  Walking: "walking",
  Run: "running",
  Running: "running",
  Idle: "idle",
  Dance: "salsa-dancing",
  Jump: "excited",
  Wave: "waving",
  ThumbsUp: "agreeing",
  WalkJump: "happy-walk",
  Yes: "agreeing",
  No: "thoughtful-head-shake",
  Death: "fall-flat",
  Punch: "mma-kick",
  Sitting: "sitting-talking",
  Standing: "standing",
};

// Map ALL animation names to Soldier's available set (legacy fallback)
export const SOLDIER_ANIM: Record<string, string> = {
  Walking: "Walk",
  Running: "Run",
  Idle: "Idle",
  Punch: "Run",
  Death: "Idle",
  ThumbsUp: "Idle",
  Walk: "Walk",
  Run: "Run",
  Dance: "Walk",
  Wave: "Idle",
  Jump: "Run",
  WalkJump: "Walk",
  Sitting: "Idle",
  Standing: "Idle",
  Yes: "Idle",
  No: "Idle",
};

// FBX fallback chain: when the requested anim isn't available, try these in order
export const FBX_FALLBACKS: Record<string, string[]> = {
  "waving": ["happy", "idle"],
  "agreeing": ["happy", "idle"],
  "excited": ["happy", "salsa-dancing", "idle"],
  "happy-walk": ["walking", "female-walk"],
  "thoughtful-head-shake": ["standing-arguing", "standing", "idle"],
  "fall-flat": ["idle"],
  "mma-kick": ["salsa-dancing", "idle"],
  "sitting-talking": ["standing", "idle"],
};

// --- Auto-preload all GLB models ---
for (const key of Object.keys(CHARACTERS) as CharacterKey[]) {
  preloadOnce(useGLTF.preload, CHAR_URLS[key]);
}

// --- Auto-preload FBX animations ---
for (const [key, def] of Object.entries(CHARACTERS) as [CharacterKey, CharacterDef][]) {
  if (def.fbxAnims === "all") {
    const preloadList = CHAR_ALL_FBX_PRELOAD[key];
    if (preloadList) {
      for (const anim of preloadList) {
        preloadOnceWith(useLoader.preload, FBXLoader, staticFile(`${CHAR_DIR}/${def.folder}/${anim}.fbx`));
      }
    }
  } else if (Array.isArray(def.fbxAnims)) {
    for (const anim of def.fbxAnims) {
      preloadOnceWith(useLoader.preload, FBXLoader, staticFile(`${CHAR_DIR}/${def.folder}/${anim}.fbx`));
    }
  }
}
