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

// Halftone dot field, baked as inline SVG data URI for cheap repeat.
const halftoneSvg = (color: string, opacity: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='2' cy='2' r='1' fill='${color}' fill-opacity='${opacity}'/></svg>`,
  )}")`;

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

// Tiny TradingView-style metadata badges anchored to the corners.
const CornerBadge: React.FC<{
  pos: "tl" | "tr" | "bl" | "br";
  color: string;
  children: React.ReactNode;
}> = ({ pos, color, children }) => {
  const top = pos.startsWith("t") ? 22 : undefined;
  const bottom = pos.startsWith("b") ? 22 : undefined;
  const left = pos.endsWith("l") ? 22 : undefined;
  const right = pos.endsWith("r") ? 22 : undefined;
  return (
    <div
      style={{
        position: "absolute",
        top,
        bottom,
        left,
        right,
        fontFamily: "ui-monospace, SFMono-Regular, monospace",
        fontSize: 12,
        color,
        opacity: 0.6,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
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
      <CornerBadge pos="tr" color="#ffffff">
        ● LIVE · {String(Math.floor(frame / 24)).padStart(2, "0")}:
        {String(frame % 24).padStart(2, "0")}
      </CornerBadge>
    </AbsoluteFill>
  );
};

// ── Paper-white background — the "calm" frames that used to be light blue ──
export const LightGradient: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: "#f5f5f3" }}>
      {/* halftone dot field */}
      <AbsoluteFill
        style={{
          backgroundImage: halftoneSvg("#000", 0.18),
          backgroundSize: "8px 8px",
          opacity: 0.7,
          pointerEvents: "none",
        }}
      />
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
      <CornerBadge pos="bl" color="#000000">
        EDITION №01 · 2026
      </CornerBadge>
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
