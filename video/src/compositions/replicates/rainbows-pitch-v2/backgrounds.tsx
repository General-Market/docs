import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";

// ── Colors ──
// Was a saturated blue; the pitch now lives in monochrome — keeping the
// BLUE export so existing call sites don't have to learn another name.
export const BLUE = "#000000";
export const DARK = "#0a0a0a";
export const LIGHT_BG = "#fafafa";

// Subtle film grain via noise + filter.
const Grain: React.FC<{ color?: string; opacity?: number }> = ({
  color = "#ffffff",
  opacity = 0.04,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity, mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%" preserveAspectRatio="none">
        <filter id={`grain-${frame % 4}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={frame % 4} />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${frame % 4})`} fill={color} />
      </svg>
    </AbsoluteFill>
  );
};

// ── Black background — the "energetic" frames that used to be blue ──
export const BlueGradient: React.FC<{ speed?: number }> = () => {
  const frame = useCurrentFrame();
  const breathe = 0.92 + 0.08 * Math.sin(frame * 0.04);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* very subtle vignette so the pure black has shape */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 45%, rgba(255,255,255,0.04) 0%, transparent 65%)",
          opacity: breathe,
        }}
      />
      {/* trading-desk gridlines */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.5 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="bk-grid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bk-grid)" />
        </svg>
      </AbsoluteFill>
      <Grain color="#ffffff" opacity={0.05} />
    </AbsoluteFill>
  );
};

// ── Paper-white background — the "calm" frames that used to be light blue ──
export const LightGradient: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#f5f5f3" }}>
      {/* off-center diagonal rule for editorial energy */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 0,
          bottom: 0,
          width: 1,
          background: "rgba(0,0,0,0.06)",
          transform: "translateX(-50%) rotate(8deg)",
        }}
      />
      <Grain color="#000000" opacity={0.025} />
    </AbsoluteFill>
  );
};

// ── Solid black (replaces SolidBlue for the high-impact frames) ──
export const SolidBlue: React.FC = () => (
  <AbsoluteFill style={{ background: "#000" }}>
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(255,255,255,0.06) 0%, transparent 65%)",
      }}
    />
    <Grain color="#ffffff" opacity={0.05} />
  </AbsoluteFill>
);

// ── Dark background — already black-ish, just upgraded with grain ──
export const DarkBg: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
    <Grain color="#ffffff" opacity={0.04} />
  </AbsoluteFill>
);

// ── Grid overlay ──
export const GridOverlay: React.FC<{
  color?: string;
  cols?: number;
  rows?: number;
  opacity?: number;
}> = ({ color = "rgba(255,255,255,0.15)", cols = 10, rows = 6, opacity = 1 }) => {
  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Vertical lines */}
      {Array.from({ length: cols + 1 }, (_, i) => (
        <div
          key={`v${i}`}
          style={{
            position: "absolute",
            left: `${(i / cols) * 100}%`,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: color,
          }}
        />
      ))}
      {/* Horizontal lines */}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <div
          key={`h${i}`}
          style={{
            position: "absolute",
            top: `${(i / rows) * 100}%`,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: color,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

// ── Word-by-word text animation ──
export const WordByWord: React.FC<{
  text: string;
  fps: number;
  startFrame?: number;
  frameDelta?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: string;
  fontFamily?: string;
  textAlign?: "center" | "left";
  top?: string;
  left?: string;
  maxWidth?: string;
}> = ({
  text,
  fps,
  startFrame = 0,
  frameDelta = 5,
  color = "#FFFFFF",
  fontSize = 72,
  fontWeight = 800,
  fontStyle = "italic",
  fontFamily = "Inter, system-ui, sans-serif",
  textAlign = "center",
  top = "50%",
  left = "50%",
  maxWidth = "85%",
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        transform: "translate(-50%, -50%)",
        maxWidth,
        textAlign,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: textAlign === "center" ? "center" : "flex-start",
        gap: `0 ${fontSize * 0.3}px`,
      }}
    >
      {words.map((word, i) => {
        const wordFrame = startFrame + i * frameDelta;
        const opacity = interpolate(frame, [wordFrame, wordFrame + 3], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const y = interpolate(frame, [wordFrame, wordFrame + 4], [15, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <span
            key={i}
            style={{
              fontFamily,
              fontSize,
              fontWeight,
              fontStyle,
              color,
              opacity,
              transform: `translateY(${y}px)`,
              display: "inline-block",
              lineHeight: 1.15,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};

// ── Fade wrapper ──
export const FadeIn: React.FC<{
  children: React.ReactNode;
  start?: number;
  duration?: number;
}> = ({ children, start = 0, duration = 8 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity, width: "100%", height: "100%" }}>{children}</div>;
};
