/**
 * PunchZoom — ADSR zoom envelope for punching on emotional beats.
 *
 * Each event defines a moment in seconds where the zoom peaks, plus
 * attack / hold / release phases. Fast zoom-in, brief hold at target,
 * slow decay back to 1.0. Overlapping events take the max so they
 * never cancel each other.
 *
 *   const scale = usePunchZoom(PUNCH_EVENTS);
 *   <video style={{ transform: `scale(${scale})` }} />
 *
 * Or, wrapper-style:
 *
 *   <PunchZoom events={PUNCH_EVENTS}>
 *     <OffthreadVideo ... />
 *   </PunchZoom>
 */

import React from "react";
import {
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export interface PunchEvent {
  /** Peak moment in seconds. */
  atSec: number;
  /** Peak scale. Default 1.10. */
  scale?: number;
  /** Attack (zoom-in) duration in seconds. Default 0.10 — fast. */
  inSec?: number;
  /** Hold at peak duration in seconds. Default 0.25. */
  holdSec?: number;
  /** Release (zoom-out) duration in seconds. Default 0.55. */
  outSec?: number;
  /** Optional label — for readability only. */
  label?: string;
}

const EASE_IN = Easing.bezier(0.4, 0, 0.2, 1); // fast start, land soft
const EASE_OUT = Easing.bezier(0.5, 0, 0.7, 1); // slow release

/** Returns the current webcam scale from a list of punch events. */
export const usePunchZoom = (events: PunchEvent[]): number => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  let scale = 1.0;

  for (const ev of events) {
    const target = ev.scale ?? 1.08;
    const attackF = Math.round((ev.inSec ?? 0.18) * fps);
    const holdF = Math.round((ev.holdSec ?? 0.3) * fps);
    const releaseF = Math.round((ev.outSec ?? 0.75) * fps);

    const peakF = Math.round(ev.atSec * fps);
    const attackStart = peakF - attackF;
    const holdEnd = peakF + holdF;
    const releaseEnd = holdEnd + releaseF;

    if (frame < attackStart || frame >= releaseEnd) continue;

    let s: number;
    if (frame < peakF) {
      s = interpolate(frame, [attackStart, peakF], [1.0, target], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_IN,
      });
    } else if (frame < holdEnd) {
      s = target;
    } else {
      s = interpolate(frame, [holdEnd, releaseEnd], [target, 1.0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASE_OUT,
      });
    }

    if (s > scale) scale = s;
  }

  return scale;
};

/** Wraps children in a scaled container driven by the punch envelope. */
export const PunchZoom: React.FC<{
  events: PunchEvent[];
  /** CSS transform-origin. Default "center center". */
  origin?: string;
  children: React.ReactNode;
}> = ({ events, origin = "center center", children }) => {
  const scale = usePunchZoom(events);
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
