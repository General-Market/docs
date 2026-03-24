// ---------------------------------------------------------------------------
// Scene definition — the "scene file" that describes a complete phase
// ---------------------------------------------------------------------------

import type { CameraRig } from "./camera";
import type { LightingPreset } from "./lighting";

/** A single animation segment in a timeline */
export interface AnimationSegment {
  /** Clip/FBX stem name, e.g. "idle", "walking", "entering-car" */
  clip: string;
  /** Normalized start time [0..1] within the phase. Default 0. */
  start?: number;
  /** Normalized end time [0..1]. Default 1. */
  end?: number;
}

/** Transform for an entity in 3D space */
export interface TransformDef {
  position: [number, number, number];
  rotation?: [number, number, number];
  rotationY?: number;
  scale?: number | [number, number, number];
}

/** Motion path — animates position over time via waypoints */
export interface MotionPath {
  /** Waypoints the entity moves through. Each has a normalized time [0..1]. */
  waypoints: Waypoint[];
  /** Easing between waypoints (default "smoothstep") */
  easing?: "smoothstep" | "cubic" | "linear";
}

/** A single waypoint in a motion path */
export interface Waypoint {
  /** Normalized time [0..1] within the phase */
  t: number;
  position: [number, number, number];
  /** Optional rotation at this point (lerps between waypoints) */
  rotationY?: number;
}

/** Entity definition — a prefab instance in the scene */
export interface EntityDef {
  /** Unique ID within the scene */
  id: string;
  /** Prefab name from the registry */
  prefab: string;
  /** 3D transform */
  transform: TransformDef;
  /** Single animation clip (shorthand) */
  animation?: { clip: string };
  /** Animation timeline — multiple clips over time (overrides animation) */
  animations?: AnimationSegment[];
  /** Motion path — moves entity over time */
  motion?: MotionPath;
  /** Prefab-specific props (passed through to the component) */
  props?: Record<string, unknown>;
  /** Whether to show this entity (can be quality-gated) */
  visible?: boolean;
  /** Only show in these quality modes */
  qualityMin?: "draft" | "preview" | "final";
}

/** Weather configuration */
export interface WeatherDef {
  rain?: boolean;
  lightning?: boolean;
  fog?: { color: string; near: number; far: number };
}

/** Post-processing effects */
export interface EffectsDef {
  bloom?: { strength: number; radius: number; threshold: number };
  desaturation?: number;
  filmGrain?: number;
}

/** Complete scene definition — the data-driven "scene file" */
export interface SceneDefinition {
  id: string;
  /** Lighting preset name (string) or inline preset */
  lighting: string | LightingPreset;
  /** Camera rig with composable behaviors */
  camera: CameraRig;
  /** Entities (prefab instances) in the scene */
  entities: EntityDef[];
  /** Weather effects */
  weather?: WeatherDef;
  /** Post-processing effects */
  effects?: EffectsDef;
  /** Environment config */
  environment?: {
    isDark?: boolean;
    hasCar?: boolean;
    hasDesk?: boolean;
    hasParkingLot?: boolean;
  };
}
