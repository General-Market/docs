/**
 * EndLogoReveal — closing card for Sequence02.
 *
 * Replaces the dark-green middle-banner with a full-frame broll/logo mosaic
 * (MegaGrid from Launch30) behind the GM lockup and "Trade 10,000x more"
 * tagline. Logo scales in; tagline fades in on its tail.
 */

import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { font } from "../../common/fonts";
import { SOURCES } from "../launch/data/sources";
import { toFrames } from "./theme";

const TILT_X = 12;
const GRID_SCALE = 1.15;
const SCROLL_SPEED = 0.6;
const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);

/** Full-frame mosaic of source logos — same treatment as Launch30's MegaGrid. */
const MegaGridBg: React.FC<{ startFrame: number }> = ({ startFrame }) => {
  const frame = useCurrentFrame();
  const scrollY = Math.max(0, frame - startFrame) * SCROLL_SPEED;
  const cols = 10;
  const rows = 10;
  const count = cols * rows;

  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#ffffff" }} />
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1800,
          perspectiveOrigin: "50% 45%",
        }}
      >
        <AbsoluteFill
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gridTemplateRows: `repeat(${rows}, 1fr)`,
            gap: 3,
            padding: 3,
            filter: "blur(6px)",
            transform: `rotateX(${TILT_X}deg) scale(${GRID_SCALE}) translateY(${-scrollY}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {Array.from({ length: count }).map((_, i) => {
            const source = SOURCES[i % SOURCES.length];
            const logoSrc = source.logo.startsWith("/")
              ? source.logo.slice(1)
              : source.logo;
            return (
              <div
                key={i}
                style={{
                  background: source.bg,
                  borderRadius: 4,
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 6,
                }}
              >
                <Img
                  src={staticFile(logoSrc)}
                  style={{
                    maxWidth: "80%",
                    maxHeight: "80%",
                    objectFit: "contain",
                  }}
                />
              </div>
            );
          })}
        </AbsoluteFill>
      </div>

      {/* White-wash so the logo reads — same as MegaGrid in Launch30. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.72) 100%)",
        }}
      />
    </>
  );
};

/** Transcript-time second when the end card enters. */
const START_SEC = 62.4;

export const EndLogoReveal: React.FC = () => {
  const frame = useCurrentFrame();
  const startFrame = toFrames(START_SEC);
  const t = Math.max(0, frame - startFrame);

  // Logo pop + tagline fade — tight window (~42 frames total).
  const logoProgress = interpolate(t, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });
  const logoScale = interpolate(logoProgress, [0, 1], [0.7, 1]);
  const logoOpacity = logoProgress;

  const taglineOpacity = interpolate(t, [12, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE_OUT,
  });

  return (
    <AbsoluteFill>
      <MegaGridBg startFrame={startFrame} />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: 40,
        }}
      >
        <Img
          src={staticFile("gm-logo.svg")}
          style={{
            width: 220,
            height: 220,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
            filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.35))",
          }}
        />

        <div
          style={{
            fontFamily: font,
            fontSize: 96,
            fontWeight: 800,
            color: "#0e0f0c",
            textAlign: "center",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 32px rgba(255,255,255,0.8)",
            opacity: taglineOpacity,
          }}
        >
          Trade 10,000x more
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
