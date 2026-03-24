// ---------------------------------------------------------------------------
// Prefab registry — reusable component definitions
// ---------------------------------------------------------------------------

import type React from "react";

/** Props passed to every prefab component */
export interface PrefabBaseProps {
  frame: number;
  fps: number;
  durationFrames: number;
  /** Normalized time [0..1] within the current phase */
  t: number;
  /** Resolved animation clip name (from timeline or single) */
  animationClip?: string;
  /** Motion-interpolated position */
  position: [number, number, number];
  rotationY: number;
  scale: number;
}

/** A prefab registration entry */
export interface PrefabRegistration {
  /** Display name for debugging */
  name: string;
  /** The React component to render */
  component: React.ComponentType<PrefabBaseProps & Record<string, unknown>>;
  /** Default props */
  defaults?: Record<string, unknown>;
}

/** The registry is a simple string → PrefabRegistration map */
export type PrefabRegistry = Record<string, PrefabRegistration>;
