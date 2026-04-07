// Curved dome wipe, ported from SvgMorph. Full-viewport SVG that grows from
// the bottom in three path states: flat → bulge → full cover. Used as the
// transition language between scenes — each scene reveals from a curved wipe.

import React from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "remotion";
import { interpolatePath } from "@remotion/paths";
import { THEME } from "../theme";

const PATH_INITIAL = "M 0 100 V 100 Q 50 100 100 100 V 100 Z";
const PATH_START = "M 0 100 V 50 Q 50 0 100 50 V 100 Z";
const PATH_END = "M 0 100 V 0 Q 50 0 100 0 V 100 Z";

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function getMorphPath(progress: number): string {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0.5) {
    const t = easeIn(p / 0.5);
    return interpolatePath(t, PATH_INITIAL, PATH_START);
  }
  const t = easeOut((p - 0.5) / 0.5);
  return interpolatePath(t, PATH_START, PATH_END);
}

export interface SvgWipeProps {
  startFrame: number;
  durationFrames?: number;
  color?: string;
  /**
   * 'up' — the dome climbs from the bottom, covering the viewport.
   * 'down' — starts fully covered and retracts downward, revealing the scene.
   */
  direction?: "up" | "down";
}

export const SvgWipe: React.FC<SvgWipeProps> = ({
  startFrame,
  durationFrames = 20,
  color = THEME.bgDark,
  direction = "up",
}) => {
  const frame = useCurrentFrame();
  const local = frame - startFrame;

  if (local < 0 || local > durationFrames) {
    // Outside the wipe window: for 'down' after completion, nothing. For 'up'
    // before the window, nothing. Past the window for 'up', hold full cover.
    if (direction === "up" && local > durationFrames) {
      return (
        <AbsoluteFill style={{ pointerEvents: "none" }}>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          >
            <path d={PATH_END} fill={color} />
          </svg>
        </AbsoluteFill>
      );
    }
    return null;
  }

  const raw = local / durationFrames;
  const progress = direction === "up" ? raw : 1 - raw;
  const d = getMorphPath(progress);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <path d={d} fill={color} />
      </svg>
    </AbsoluteFill>
  );
};
