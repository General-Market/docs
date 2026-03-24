/**
 * Long03Composition — "How DeFi Vaults Work" title card
 *
 * Isometric geometric background with 4 vault mechanisms,
 * continuous slow zoom, title text reveal, then brand logos.
 *
 * Timeline (12s at 30fps = 360 frames):
 *   f0-20:   Background only, zoom begins
 *   f20-40:  Title "How DeFi / Vaults Work" scales+fades in
 *   f42-55:  "Veda | Plasma" logos fade in
 *   f55-360: Hold with continued zoom
 *
 * Aspect ratio: 1:1 square (1080x1080)
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from "remotion";
import { IsometricBackground } from "./IsometricBackground";

const FPS = 30;
const DURATION_SECONDS = 12;
const DURATION_FRAMES = FPS * DURATION_SECONDS;

// Animation timing (frames)
const TITLE_START = 18;
const LOGOS_START = 42;
const LOGOS_END = 55;

// Zoom parameters — slow continuous zoom
const ZOOM_START = 1.05;
const ZOOM_END = 1.30;

// Brand logos as inline SVGs
const VedaLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Veda heart/teardrop logo */}
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="#111111"
    />
  </svg>
);

const PlasmaLogo: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Plasma starburst/radial logo */}
    <circle cx="20" cy="20" r="7" fill="#111111" />
    {Array.from({ length: 24 }).map((_, i) => {
      const angle = (i * 360) / 24;
      const rad = (angle * Math.PI) / 180;
      const innerR = 10;
      const outerR = i % 3 === 0 ? 19 : i % 3 === 1 ? 16 : 14;
      const sw = i % 3 === 0 ? 2.2 : 1.4;
      return (
        <line
          key={i}
          x1={20 + Math.cos(rad) * innerR}
          y1={20 + Math.sin(rad) * innerR}
          x2={20 + Math.cos(rad) * outerR}
          y2={20 + Math.sin(rad) * outerR}
          stroke="#111111"
          strokeWidth={sw}
          strokeLinecap="round"
        />
      );
    })}
  </svg>
);

export const Long03Composition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Continuous slow zoom on background
  const zoom = interpolate(
    frame,
    [0, DURATION_FRAMES],
    [ZOOM_START, ZOOM_END],
    { extrapolateRight: "clamp" },
  );

  // Title animation — spring for organic feel
  const titleSpring = spring({
    frame: frame - TITLE_START,
    fps,
    config: { damping: 12, stiffness: 100, mass: 0.7 },
  });

  const titleOpacity = interpolate(
    frame,
    [TITLE_START, TITLE_START + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleScale = interpolate(titleSpring, [0, 1], [0.88, 1]);

  // Logos animation — starts after title, quick fade
  const logosOpacity = interpolate(frame, [LOGOS_START, LOGOS_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const logosY = interpolate(frame, [LOGOS_START, LOGOS_END], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#f0ede5",
        overflow: "hidden",
      }}
    >
      {/* Zooming isometric background */}
      <AbsoluteFill
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: "center center",
        }}
      >
        <IsometricBackground frame={frame} fps={fps} />
      </AbsoluteFill>

      {/* Title text overlay */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
            textAlign: "center",
            lineHeight: 1.15,
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              fontWeight: 700,
              fontSize: 96,
              color: "#0a0a0a",
              letterSpacing: "-0.025em",
            }}
          >
            How DeFi
          </div>
          <div
            style={{
              fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
              fontWeight: 700,
              fontSize: 96,
              color: "#0a0a0a",
              letterSpacing: "-0.025em",
            }}
          >
            Vaults Work
          </div>
        </div>

        {/* Brand logos */}
        <div
          style={{
            opacity: logosOpacity,
            transform: `translateY(${logosY}px)`,
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginTop: 28,
          }}
        >
          {/* Veda */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <VedaLogo size={24} />
            <span
              style={{
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: 500,
                fontSize: 22,
                color: "#0a0a0a",
              }}
            >
              Veda
            </span>
          </div>

          {/* Separator */}
          <div
            style={{
              width: 1.5,
              height: 24,
              backgroundColor: "#888888",
            }}
          />

          {/* Plasma */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <PlasmaLogo size={24} />
            <span
              style={{
                fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
                fontWeight: 500,
                fontSize: 22,
                color: "#0a0a0a",
              }}
            >
              Plasma
            </span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const long03Meta = {
  id: "Long03",
  component: Long03Composition,
  durationInFrames: DURATION_FRAMES,
  fps: FPS as 30,
  width: 1080 as 1080,
  height: 1080 as 1080,
};
