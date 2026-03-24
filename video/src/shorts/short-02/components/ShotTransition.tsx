/**
 * ShotTransition — renders a transition-in overlay at the start of each shot.
 * Sits on top of all content and animates away to reveal the shot.
 * Driven by `transitionIn` and `transitionDuration` from ShotDef.
 *
 * Includes professional transitions: blinds, circleWipe, diagonalSlice,
 * zoomBlur, flash — inspired by TransitionAnimations composition.
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

// Smoothstep easing helper
const smoothstep = (t: number) => t * t * (3 - 2 * t);

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
          <AbsoluteFill
            style={{ backgroundColor: COLORS.BG_BASE, opacity: overlayOpacity }}
          />
          <div
            style={{
              position: "absolute",
              left: `${barX}%`,
              top: 0,
              width: "15%",
              height: "100%",
              background: `linear-gradient(90deg, transparent, ${COLORS.ACCENT_1}80, transparent)`,
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
          <AbsoluteFill
            style={{ backgroundColor: COLORS.BG_BASE, opacity: intensity * 0.5 }}
          />
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

    // ---- Professional transitions ----

    case "blinds": {
      const blindCount = 10;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
          {Array.from({ length: blindCount }).map((_, i) => {
            const delay = i * 1.5;
            const t = Math.max(0, Math.min(1, (frame - delay) / (durationFrames - delay)));
            const progress = smoothstep(t) * 100;
            const sliceH = 100 / blindCount;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  top: `${i * sliceH}%`,
                  width: "100%",
                  height: `${sliceH + 0.5}%`,
                  backgroundColor: COLORS.BG_BASE,
                  transform: `scaleY(${1 - progress / 100})`,
                  transformOrigin: i % 2 === 0 ? "top" : "bottom",
                }}
              />
            );
          })}
        </AbsoluteFill>
      );
    }

    case "circleWipe": {
      const t = Math.min(1, frame / durationFrames);
      const progress = smoothstep(t) * 150;
      return (
        <AbsoluteFill
          style={{
            backgroundColor: COLORS.BG_BASE,
            clipPath: `circle(${Math.max(0, 100 - progress)}% at 50% 50%)`,
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      );
    }

    case "diagonalSlice": {
      const t = Math.min(1, frame / durationFrames);
      const progress = smoothstep(t) * 150;
      return (
        <AbsoluteFill style={{ pointerEvents: "none", zIndex: 100 }}>
          {/* Two diagonal slices that slide apart */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: COLORS.BG_BASE,
              clipPath: `polygon(0 0, ${100 - progress}% 0, ${60 - progress}% 100%, 0 100%)`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: COLORS.BG_BASE,
              clipPath: `polygon(${progress + 40}% 0, 100% 0, 100% 100%, ${progress}% 100%)`,
            }}
          />
          {/* Gold accent line at the diagonal */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(${105}deg, transparent ${48 - progress * 0.3}%, ${COLORS.ACCENT_1}60 50%, transparent ${52 + progress * 0.3}%)`,
              opacity: Math.max(0, 1 - t * 1.5),
            }}
          />
        </AbsoluteFill>
      );
    }

    case "zoomBlur": {
      const progress = spring({
        frame,
        fps,
        config: { damping: 12, stiffness: 80, mass: 0.8 },
        durationInFrames: durationFrames,
      });
      const blur = interpolate(progress, [0, 1], [40, 0]);
      const scale = interpolate(progress, [0, 1], [1.8, 1]);
      const opacity = interpolate(progress, [0, 1], [1, 0]);
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

    case "flash": {
      const t = Math.min(1, frame / durationFrames);
      // Flash starts white, fades to black, then disappears
      const whitePhase = t < 0.3;
      const opacity = whitePhase
        ? interpolate(t, [0, 0.15, 0.3], [1, 1, 0.5])
        : interpolate(t, [0.3, 1], [0.5, 0]);
      const bgColor = whitePhase ? "#ffffff" : COLORS.BG_BASE;
      return (
        <AbsoluteFill
          style={{
            backgroundColor: bgColor,
            opacity: Math.max(0, opacity),
            pointerEvents: "none",
            zIndex: 100,
          }}
        />
      );
    }

    default:
      return null;
  }
};
