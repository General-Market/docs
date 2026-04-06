import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";
import {
  fontFamily,
  baseText,
  GREEN,
  LightBg,
  progress,
} from "../shared";

/* ------------------------------------------------------------------ */
/*  Scene 01 — Calendar "Every [Sun 15] Spring"                       */
/*  120 frames / 4s @ 30fps — 1920x1080                               */
/*                                                                     */
/*  Entrance: calendar pops (spring), words slide in from sides.       */
/*  Exit: calendar page peels away, elements fade out.                 */
/* ------------------------------------------------------------------ */

const CAL_W = 190;
const CAL_H = 210;
const CAL_RADIUS = 22;
const HEADER_H = 62;
const TEXT_SIZE = 90;
const GAP = 54;

export const Scene01_Calendar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* ---- entrance ---- */
  const calScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 12, stiffness: 120 },
  });

  const everySlide = interpolate(frame, [18, 42], [-140, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const everyOpacity = interpolate(frame, [18, 42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const springSlide = interpolate(frame, [26, 50], [140, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const springOpacity = interpolate(frame, [26, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ---- exit: page peel on calendar body (frames 80-110) ---- */
  const peelProgress = progress(frame, 80, 30);
  const peelRotateY = interpolate(peelProgress, [0, 1], [0, -90]);
  const peelOriginX = interpolate(peelProgress, [0, 1], [50, 100]);
  const bodyOpacity = interpolate(peelProgress, [0.6, 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ---- exit: fade everything out (last 12 frames) ---- */
  const exitFade = interpolate(frame, [108, 120], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  /* ---- entrance fade ---- */
  const entranceFade = interpolate(frame, [0, 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const masterOpacity = entranceFade * exitFade;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
      }}
    >
      <LightBg />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          alignItems: "center",
          gap: GAP,
          opacity: masterOpacity,
        }}
      >
        {/* "Every" */}
        <div
          style={{
            ...baseText,
            fontSize: TEXT_SIZE,
            transform: `translateX(${everySlide}px)`,
            opacity: everyOpacity,
            whiteSpace: "nowrap",
          }}
        >
          Every
        </div>

        {/* Calendar icon */}
        <div
          style={{
            transform: `scale(${calScale})`,
            width: CAL_W,
            height: CAL_H,
            borderRadius: CAL_RADIUS,
            overflow: "hidden",
            boxShadow: "0 6px 28px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            background: "#fff",
          }}
        >
          {/* Green header bar */}
          <div
            style={{
              background: `linear-gradient(135deg, #2EEAA0 0%, ${GREEN} 100%)`,
              height: HEADER_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 600,
                fontSize: 26,
                color: "#fff",
                letterSpacing: 0.5,
              }}
            >
              Sun
            </span>
          </div>

          {/* White body with "15" — peels away on exit */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#fff",
              transformOrigin: `${peelOriginX}% 0%`,
              transform: `perspective(600px) rotateY(${peelRotateY}deg)`,
              opacity: bodyOpacity,
            }}
          >
            <span
              style={{
                fontFamily,
                fontWeight: 800,
                fontSize: 78,
                color: "#000",
                lineHeight: 1,
              }}
            >
              15
            </span>
          </div>
        </div>

        {/* "Spring" */}
        <div
          style={{
            ...baseText,
            fontSize: TEXT_SIZE,
            transform: `translateX(${springSlide}px)`,
            opacity: springOpacity,
            whiteSpace: "nowrap",
          }}
        >
          Spring
        </div>
      </div>
    </div>
  );
};
