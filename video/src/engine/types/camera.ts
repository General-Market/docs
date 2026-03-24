// ---------------------------------------------------------------------------
// Camera rig — composable behaviors stacked additively
// ---------------------------------------------------------------------------

export interface OrbitBehavior {
  type: "orbit";
  /** Start → end angle range (radians) over normalized time [0..1] */
  angleRange: [number, number];
  /** Start → end radius */
  radius: number | [number, number];
  /** Start → end height */
  height: number | [number, number];
}

export interface DollyBehavior {
  type: "dolly";
  /** Start → end Z position */
  zRange: [number, number];
  /** Optional X offset (static) */
  xOffset?: number;
  /** Optional X range (animated start → end) — overrides xOffset */
  xRange?: [number, number];
  /** Start → end height */
  height?: number | [number, number];
}

export interface ShakeBehavior {
  type: "shake";
  /** Base amplitude */
  amplitude: number;
  /** Amplitude at end (grows over shot) — if provided, lerps from amplitude → amplitudeEnd */
  amplitudeEnd?: number;
  /** Frequency multiplier (default 1.0) */
  frequency?: number;
}

export interface DutchTiltBehavior {
  type: "dutchTilt";
  /** Max tilt angle in radians */
  maxAngle: number;
  /** Speed of oscillation */
  speed?: number;
  /** Envelope: "constant" | "peak-mid" | "decay" */
  envelope?: "constant" | "peak-mid" | "decay";
}

export interface CraneBehavior {
  type: "crane";
  /** Start → end height delta (added to base position) */
  heightDelta: [number, number];
}

export interface BreatheBehavior {
  type: "breathe";
  /** Amplitude of breathing movement */
  amplitude: number;
  /** Speed (default 0.025) */
  speed?: number;
}

export interface FollowBehavior {
  type: "follow";
  /** Entity ID to follow */
  entity: string;
  /** Offset from entity position */
  offset?: [number, number, number];
}

export interface StaticBehavior {
  type: "static";
  /** Fixed camera position */
  position: [number, number, number];
}

export interface SwayBehavior {
  type: "sway";
  /** Amplitude of horizontal sway */
  amplitude: number;
  /** Speed (default 0.015) */
  speed?: number;
}

export interface PulseRadiusBehavior {
  type: "pulseRadius";
  /** Base radius */
  baseRadius: number;
  /** Pulse amplitude */
  amplitude: number;
  /** Number of full cycles over the shot */
  cycles: number;
}

export type CameraBehavior =
  | OrbitBehavior
  | DollyBehavior
  | ShakeBehavior
  | DutchTiltBehavior
  | CraneBehavior
  | BreatheBehavior
  | FollowBehavior
  | StaticBehavior
  | SwayBehavior
  | PulseRadiusBehavior;

export interface CameraRig {
  /** Composable behaviors — applied additively in order */
  behaviors: CameraBehavior[];
  /** Where camera looks — static point or entity-relative */
  lookAt: [number, number, number] | { entity: string; offset?: [number, number, number] };
  /** Optional: lookAt drift over time [start, end] */
  lookAtDrift?: { y?: [number, number]; z?: [number, number]; x?: [number, number] };
}
