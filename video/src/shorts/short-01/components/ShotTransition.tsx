/**
 * ShotTransition — renders a transition-in overlay at the start of each shot.
 * Sits on top of all content and animates away to reveal the shot.
 * Driven by `transitionIn` and `transitionDuration` from ShotDef.
 */

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import type { TransitionIn } from "../types";
import { COLORS } from "../types";

interface Props {
  type: TransitionIn;
  durationFrames?: number;
}

export const ShotTransition: React.FC<Props> = ({
  type,
  durationFrames = 9,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (type === "cut" || type === "morph" || frame >= durationFrames) return null;

  switch (type) {
    case "fade": {
      const opacity = interpolate(frame, [0, durationFrames], [1, 0], {
        extrapolateRight: "clamp",
      });
      return (
        <AbsoluteFill
          style={{
            backgroundColor: COLORS.BG_BASE,
            opacity,
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      );
    }

    case "zoom": {
      const progress = spring({
        frame,
        fps,
        config: { damping: 15, stiffness: 120, mass: 1 },
        durationInFrames: durationFrames,
      });
      const scale = interpolate(progress, [0, 1], [1.4, 1]);
      const blur = interpolate(progress, [0, 1], [25, 0]);
      const opacity = interpolate(progress, [0, 1], [0.9, 0]);
      return (
        <AbsoluteFill
          style={{
            backgroundColor: COLORS.BG_BASE,
            opacity,
            transform: `scale(${scale})`,
            filter: `blur(${blur}px)`,
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      );
    }

    case "whip": {
      const progress = interpolate(frame, [0, durationFrames], [0, 1], {
        extrapolateRight: "clamp",
      });
      const barX = interpolate(progress, [0, 1], [-20, 110]);
      const overlayOpacity = interpolate(progress, [0, 0.3, 1], [1, 0.5, 0]);
      return (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
          {/* Dark overlay that reveals */}
          <AbsoluteFill
            style={{ backgroundColor: COLORS.BG_BASE, opacity: overlayOpacity }}
          />
          {/* Sweeping accent bar */}
          <div
            style={{
              position: "absolute",
              left: `${barX}%`,
              top: 0,
              width: "15%",
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${COLORS.ACCENT_BLUE}80, transparent)`,
              transform: "skewX(-10deg)",
              filter: "blur(2px)",
            }}
          />
        </AbsoluteFill>
      );
    }

    case "glitch": {
      const progress = interpolate(frame, [0, durationFrames], [0, 1], {
        extrapolateRight: "clamp",
      });
      const intensity = 1 - progress;
      const slices = Array.from({ length: 10 }, (_, i) => {
        const y = (i / 10) * 100;
        const h = 100 / 10;
        const offsetX = noise2D("gx", i, frame * 0.4) * 80 * intensity;
        const visible = noise2D("gv", i, frame * 0.6) > -0.2;
        const colorIndex = i % 3;
        const color =
          colorIndex === 0
            ? "rgba(255,0,0,0.2)"
            : colorIndex === 1
              ? "rgba(0,255,255,0.2)"
              : "rgba(0,0,0,0.4)";
        return { y, h, offsetX, visible, color };
      });

      return (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
          {/* Base overlay */}
          <AbsoluteFill
            style={{ backgroundColor: COLORS.BG_BASE, opacity: intensity * 0.5 }}
          />
          {/* RGB glitch slices */}
          {slices.map(
            (s, i) =>
              s.visible && (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    left: s.offsetX,
                    top: `${s.y}%`,
                    width: "100%",
                    height: `${s.h}%`,
                    backgroundColor: s.color,
                    mixBlendMode: "screen",
                  }}
                />
              ),
          )}
          {/* Scanline flicker */}
          {intensity > 0.3 && (
            <AbsoluteFill
              style={{
                backgroundImage: `repeating-linear-gradient(
                  0deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,${intensity * 0.15}) 2px,
                  rgba(0,0,0,${intensity * 0.15}) 4px
                )`,
              }}
            />
          )}
        </AbsoluteFill>
      );
    }

    default:
      return null;
  }
};
