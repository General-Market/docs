// Source: a "boy-in-a-cube" demo — a photo of a person sits inside a glass box
// whose interior walls scroll Kipling's *If*. The original drives the text by
// CSS keyframes (margin-left animation) and adds hue-rotate + zoom-in over
// a 200s loop. We compress the loop to fit a 10s scene and drive the same
// values with frame number.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// Long poem reduced to a single repeating phrase ribbon. The original wraps the
// full poem and lets it scroll for minutes; for a 10s clip we want a fast-moving
// banner that always reads as text.
const POEM_WORDS = [
  "keep", "losing", "blaming", "trust", "doubt", "allowance", "wait",
  "lied", "lies", "hated", "hating", "dream", "master", "think", "aim",
  "triumph", "disaster", "impostors", "truth", "twisted", "trap",
  "broken", "stoop", "heap", "winnings", "risk", "lose", "loss",
  "force", "sinew", "serve", "hold on", "Will", "talk", "virtue",
  "walk", "touch", "foes", "count", "minute", "run", "Earth", "Man",
];

const RIBBON_TEXT = `If you can keep your head when all about you are losing theirs and blaming it on you, if you can trust yourself when all men doubt you but make allowance for their doubting too, if you can wait and not be tired by waiting, or being lied about, don't deal in lies — `;

export const KiplingCube: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = frame / durationInFrames; // 0..1

  // Slow zoom-in matches the CSS keyframes
  const scale = interpolate(t, [0, 1], [1, 1.6], { easing: Easing.linear });
  // Hue rotation
  const hue = Math.sin(t * Math.PI * 2) * 50;
  // Ribbon scroll velocity
  const scrollPx = -t * 4200;

  return (
    <AbsoluteFill
      style={{
        background: "black",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 1500,
          height: 900,
          position: "relative",
          transform: `scale(${scale})`,
          transformOrigin: "center",
          borderRadius: 28,
          overflow: "hidden",
          filter: `hue-rotate(${hue}deg)`,
        }}
      >
        {/* Background plate (subtle gradient stand-in for the photo) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 50% 60%, #4c7fb5, #0a2a4a 70%, #000 100%)",
          }}
        />
        {/* Subject silhouette — pure CSS stand-in */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 0,
            transform: "translateX(-50%)",
            width: 360,
            height: 720,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(0,0,0,.6) 80%, rgba(0,0,0,.95) 100%)",
            filter: "blur(2px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: 60,
            transform: "translateX(-50%)",
            width: 200,
            height: 480,
            background: "radial-gradient(circle at 50% 30%, #d2a87a, #4a2a14 80%, transparent 100%)",
            borderRadius: "40% 40% 20% 20%",
          }}
        />

        {/* The cube interior — four walls of scrolling text */}
        <CubeWall side="left" scrollPx={scrollPx} />
        <CubeWall side="right" scrollPx={scrollPx} />
        <CubeWall side="back" scrollPx={scrollPx} />
        <CubeWall side="top" scrollPx={scrollPx} />

        {/* Overlay hue tint */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            mixBlendMode: "overlay",
            background:
              "radial-gradient(ellipse at center, #1e5799 0%, #7db9e8 100%)",
            opacity: 1,
            pointerEvents: "none",
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

const CubeWall: React.FC<{
  side: "left" | "right" | "back" | "top";
  scrollPx: number;
}> = ({ side, scrollPx }) => {
  // Pseudo-3D inset positions using CSS skews — close enough at 10s.
  const styles: Record<typeof side, React.CSSProperties> = {
    left: {
      left: "8%",
      right: "65%",
      top: "12%",
      bottom: "12%",
      transform: "perspective(1200px) rotateY(45deg)",
      transformOrigin: "left center",
    },
    right: {
      left: "65%",
      right: "8%",
      top: "12%",
      bottom: "12%",
      transform: "perspective(1200px) rotateY(-45deg)",
      transformOrigin: "right center",
    },
    back: {
      left: "20%",
      right: "20%",
      top: "12%",
      bottom: "12%",
    },
    top: {
      left: "8%",
      right: "8%",
      top: 0,
      height: "12%",
      transform: "perspective(1200px) rotateX(70deg)",
      transformOrigin: "center bottom",
    },
  };
  return (
    <div
      style={{
        position: "absolute",
        overflow: "hidden",
        ...styles[side],
      }}
    >
      <div
        style={{
          whiteSpace: "nowrap",
          color: "white",
          opacity: 0.55,
          fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
          fontSize: 60,
          fontWeight: 400,
          paddingTop: 20,
          transform: `translateX(${scrollPx * (side === "back" ? 1.2 : 1)}px)`,
          willChange: "transform",
        }}
      >
        {RIBBON_TEXT.repeat(20).split(" ").map((word, i) => {
          const isHighlight = POEM_WORDS.includes(word.toLowerCase().replace(/[^a-z]/g, ""));
          return (
            <span key={i} style={{ color: isHighlight ? "#ff5050" : "white" }}>
              {word}{" "}
            </span>
          );
        })}
      </div>
    </div>
  );
};
