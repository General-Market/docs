import React from "react";
import {
  AbsoluteFill,
  interpolate,
  interpolateColors,
  useCurrentFrame,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { COLORS } from "../types";

interface Props {
  durationFrames: number;
  /** Color start (Reddit orange) */
  fromColor?: string;
  /** Color end (Bloomberg green or electric blue) */
  toColor?: string;
  /** Secondary end color */
  toColorAlt?: string;
}

// Fake "Reddit post" rows that morph into terminal ticker rows
const ROWS = [
  { reddit: "Who would win: Goku vs Gojo?", terminal: "GOKU/GOJO    +2.4%  ▲", votes: "12.5k", price: "$847.20" },
  { reddit: "One Piece ch. 1145 predictions", terminal: "OP-1145      +0.8%  ▲", votes: "8.2k", price: "$1,203.50" },
  { reddit: "My Hero ending was mid", terminal: "MHA-END      -5.1%  ▼", votes: "24.1k", price: "$12.40" },
  { reddit: "JJK powerscaling is broken", terminal: "JJK-PWR      -1.2%  ▼", votes: "6.7k", price: "$445.80" },
  { reddit: "Chainsaw Man outsells everything", terminal: "CSM-VOL      +8.3%  ▲", votes: "15.3k", price: "$2,100.00" },
  { reddit: "Frieren will sweep anime awards", terminal: "FRN-AWD      +3.7%  ▲", votes: "19.8k", price: "$670.30" },
];

const Row: React.FC<{
  reddit: string;
  terminal: string;
  votes: string;
  price: string;
  morphProgress: number;
  index: number;
  fromColor: string;
  toColor: string;
}> = ({ reddit, terminal, votes, price, morphProgress, index, fromColor, toColor }) => {
  // Stagger: each row starts morphing slightly later
  const stagger = index * 0.08;
  const rowProgress = interpolate(morphProgress, [stagger, stagger + 0.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textColor = interpolateColors(rowProgress, [0, 1], [fromColor, toColor]);
  const bgColor = interpolateColors(
    rowProgress,
    [0, 1],
    ["rgba(255,69,0,0.08)", "rgba(0,255,65,0.06)"],
  );

  // Crossfade text content
  const redditOpacity = interpolate(rowProgress, [0.3, 0.6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const terminalOpacity = interpolate(rowProgress, [0.4, 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Votes → Price crossfade
  const metaColor = interpolateColors(rowProgress, [0, 1], ["#FF8B60", "#00FF41"]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 20px",
        backgroundColor: bgColor,
        borderBottom: `1px solid ${interpolateColors(
          rowProgress,
          [0, 1],
          ["rgba(255,69,0,0.15)", "rgba(0,255,65,0.15)"],
        )}`,
        fontFamily: "monospace",
        fontSize: 22,
        position: "relative",
        height: 52,
      }}
    >
      {/* Reddit text fading out */}
      <span style={{ color: textColor, opacity: redditOpacity, position: "absolute", left: 20 }}>
        {reddit}
      </span>
      {/* Terminal text fading in */}
      <span
        style={{
          color: textColor,
          opacity: terminalOpacity,
          position: "absolute",
          left: 20,
          letterSpacing: 1,
        }}
      >
        {terminal}
      </span>
      {/* Meta: votes → price */}
      <span style={{ color: metaColor, position: "absolute", right: 20, fontSize: 18 }}>
        {rowProgress < 0.5 ? `⬆ ${votes}` : price}
      </span>
    </div>
  );
};

export const RedditToTerminalMorph: React.FC<Props> = ({
  durationFrames,
  fromColor = COLORS.REDDIT_ORANGE,
  toColor = COLORS.BLOOMBERG_GREEN,
  toColorAlt = COLORS.ACCENT_BLUE,
}) => {
  const frame = useCurrentFrame();

  const morphProgress = interpolate(frame, [0, durationFrames * 0.8], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Overall color grade shift
  const bgGrade = interpolateColors(morphProgress, [0, 1], [
    "rgba(255,69,0,0.05)",
    "rgba(0,212,255,0.05)",
  ]);

  // Header bar morphs
  const headerColor = interpolateColors(morphProgress, [0, 1], [fromColor, toColorAlt]);
  const headerText =
    morphProgress < 0.5
      ? "r/manga — Hot Posts"
      : "MANGA EXCHANGE — LIVE TICKERS";

  // Optional 2-frame glitch at midpoint
  const isGlitch = morphProgress > 0.48 && morphProgress < 0.52;
  const glitchOffset = isGlitch
    ? noise2D("glitch", frame * 5, 0) * 8
    : 0;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bgGrade,
        transform: `translateX(${glitchOffset}px)`,
      }}
    >
      {/* Header bar */}
      <div
        style={{
          position: "absolute",
          top: 320,
          left: 40,
          right: 232,
          padding: "14px 20px",
          backgroundColor: `${headerColor}20`,
          borderBottom: `2px solid ${headerColor}`,
          fontFamily: "monospace",
          fontSize: 20,
          fontWeight: 700,
          color: headerColor,
          letterSpacing: morphProgress > 0.5 ? 2 : 0,
        }}
      >
        {headerText}
      </div>

      {/* Rows */}
      <div
        style={{
          position: "absolute",
          top: 380,
          left: 40,
          right: 232,
        }}
      >
        {ROWS.map((row, i) => (
          <Row
            key={i}
            {...row}
            morphProgress={morphProgress}
            index={i}
            fromColor={fromColor}
            toColor={toColor}
          />
        ))}
      </div>

      {/* Glitch overlay */}
      {isGlitch && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(0,212,255,0.03) 2px,
              rgba(0,212,255,0.03) 4px
            )`,
            pointerEvents: "none",
            zIndex: 10,
          }}
        />
      )}

      {/* Scanlines for terminal feel (fades in) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0,0,0,0.03) 3px,
            rgba(0,0,0,0.03) 4px
          )`,
          opacity: morphProgress * 0.5,
          pointerEvents: "none",
          zIndex: 11,
        }}
      />
    </AbsoluteFill>
  );
};
