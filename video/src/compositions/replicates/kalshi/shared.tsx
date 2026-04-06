import React from "react";
import { interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";

export const { fontFamily } = loadFont("normal", {
  subsets: ["latin"],
  weights: ["400", "500", "600", "700", "800", "900"],
});

// Kalshi brand
export const GREEN = "#00D26A";
export const LIGHT_BG = "#F0F0F0";
export const DARK_BG = "#1A1A1A";

export const baseText: React.CSSProperties = {
  fontFamily,
  fontWeight: 800,
  lineHeight: 1.15,
  display: "inline-block",
  color: "#000",
};

export const greenText: React.CSSProperties = {
  ...baseText,
  color: GREEN,
};

// Light gray background used throughout most of the video
export const LightBg: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: LIGHT_BG,
    }}
  />
);

// Dark background for cinematic sections
export const DarkBg: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: DARK_BG,
    }}
  />
);

// Centered container
export const Center: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      ...style,
    }}
  >
    {children}
  </div>
);

// Animation helpers — GSAP-style easing
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function easeOutBack(t: number, s = 1.70158): number {
  const c = t - 1;
  return c * c * ((s + 1) * c + s) + 1;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// Progress: clamp 0-1 between frame start and end
export function progress(frame: number, start: number, dur: number): number {
  if (dur <= 0) return frame >= start ? 1 : 0;
  return Math.max(0, Math.min(1, (frame - start) / dur));
}

// Word-by-word reveal helper
export function wordReveal(
  frame: number,
  enterFrame: number,
  fadeDur = 4
): { opacity: number; y: number } {
  const opacity = interpolate(frame, [enterFrame, enterFrame + fadeDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [enterFrame, enterFrame + fadeDur], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return { opacity, y };
}

// Fade in/out for entire scene
export function sceneFade(
  frame: number,
  totalDur: number,
  fadeInDur = 8,
  fadeOutDur = 8
): number {
  const fadeIn = interpolate(frame, [0, fadeInDur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [totalDur - fadeOutDur, totalDur],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return fadeIn * fadeOut;
}

// Seeded pseudo-random (deterministic)
export function srand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
