/**
 * PunchZoom — cue-based zoom with clean holds.
 *
 * A ZoomCue says: at this second, the scale becomes X. The camera eases into
 * the new scale over easeSec (or cuts instantly if 0) and HOLDS there until
 * the next cue fires. No auto-release to 1.0, no envelopes overlapping each
 * other into a breathing loop — just locked states with deliberate moves.
 *
 *   const scale = useZoom(ZOOM_CUES);
 *   <video style={{ transform: `scale(${scale})` }} />
 *
 * Two transition types:
 *
 *   easeSec: 0       — hard cut, land on the beat
 *   easeSec: 0.4     — smooth bezier (expo-out) into the next hold
 *
 * Charisma comes from the HOLD. Move only when the voice earns it.
 */

import React from "react";
import {
  Easing,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface ZoomCue {
  /** When this scale becomes active (seconds). */
  atSec: number;
  /** Target scale at this cue. */
  scale: number;
  /** Transition duration in seconds. 0 = hard cut. Default 0.25. */
  easeSec?: number;
  /** Optional label — readability only. */
  label?: string;
}

/** Expo-out: fast initial motion, smooth long land. The "charisma" curve. */
const CHARISMA_EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** Returns the current scale from a sorted list of cues. */
export const useZoom = (cues: ZoomCue[]): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tSec = frame / fps;

  let prevScale = 1.0;
  let scale = 1.0;

  for (const cue of cues) {
    if (tSec < cue.atSec) break;

    const ease = cue.easeSec ?? 0.25;
    if (ease <= 0 || tSec >= cue.atSec + ease) {
      // Transition complete — hold at target
      prevScale = cue.scale;
      scale = cue.scale;
      continue;
    }

    // Inside the transition window
    const t = (tSec - cue.atSec) / ease;
    const eased = CHARISMA_EASE(Math.max(0, Math.min(1, t)));
    scale = prevScale + (cue.scale - prevScale) * eased;
    break;
  }

  return scale;
};

/** Wraps children in a scaled container driven by the cue list. */
export const PunchZoom: React.FC<{
  cues: ZoomCue[];
  origin?: string;
  children: React.ReactNode;
}> = ({ cues, origin = "center center", children }) => {
  const scale = useZoom(cues);
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        transform: `scale(${scale})`,
        transformOrigin: origin,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
};
