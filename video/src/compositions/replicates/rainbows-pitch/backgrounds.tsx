import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
} from "remotion";
import { noise2D } from "@remotion/noise";

// ── Colors ──
export const BLUE = "#0040FF";
export const DARK = "#0a0a0a";
export const LIGHT_BG = "#eef2ff";

// ── Animated blue-white mesh gradient (the signature look) ──
export const BlueGradient: React.FC<{ speed?: number }> = ({ speed = 0.003 }) => {
  const frame = useCurrentFrame();
  const t = frame * speed;

  const x1 = 10 + noise2D("gx1", t, 0) * 15;
  const y1 = 10 + noise2D("gy1", t, 0.5) * 15;
  const x2 = 85 + noise2D("gx2", t, 1) * 12;
  const y2 = 10 + noise2D("gy2", t, 1.5) * 12;
  const x3 = 15 + noise2D("gx3", t, 2) * 15;
  const y3 = 90 + noise2D("gy3", t, 2.5) * 10;
  const x4 = 90 + noise2D("gx4", t, 3) * 10;
  const y4 = 85 + noise2D("gy4", t, 3.5) * 10;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 100% 100% at ${x1}% ${y1}%, rgba(255,255,255,0.75) 0%, transparent 55%),
          radial-gradient(ellipse 90% 90% at ${x2}% ${y2}%, rgba(255,255,255,0.65) 0%, transparent 50%),
          radial-gradient(ellipse 100% 100% at ${x3}% ${y3}%, rgba(200,220,255,0.35) 0%, transparent 55%),
          radial-gradient(ellipse 85% 85% at ${x4}% ${y4}%, rgba(255,255,255,0.55) 0%, transparent 50%),
          radial-gradient(ellipse 70% 70% at 50% 50%, rgba(100,160,255,0.2) 0%, transparent 65%),
          linear-gradient(135deg, #0050FF 0%, #1060FF 25%, #3080FF 45%, #1060FF 65%, #0040FF 85%, #0035EE 100%)
        `,
      }}
    />
  );
};

// ── Light gradient (near-white with subtle blue tint) ──
export const LightGradient: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame * 0.002;
  const x = 25 + noise2D("lgx", t, 0) * 15;
  const y = 30 + noise2D("lgy", t, 0.5) * 15;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at ${x}% ${y}%, rgba(255,255,255,1) 0%, transparent 70%),
          linear-gradient(135deg, #f0f4ff 0%, #e8eeff 40%, #f5f8ff 60%, #eef2ff 100%)
        `,
      }}
    />
  );
};

// ── Solid blue (for the "experience" scene) ──
export const SolidBlue: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(160deg, #0055FF 0%, #0040FF 40%, #0035EE 70%, #0045FF 100%)",
    }}
  />
);

// ── Dark background ──
export const DarkBg: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#111111" }} />
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
