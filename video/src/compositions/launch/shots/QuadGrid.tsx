import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  staticFile,
} from "remotion";
import { font } from "../../../common/fonts";
import type { BrollCategory } from "../types";

const QUAD_COLS = 4;
const QUAD_ROWS = 3;
const QUAD_CELLS = QUAD_COLS * QUAD_ROWS;

const CATEGORY_COLORS: Record<string, string> = {
  twitch: "#9146FF",
  pumpfun: "#00D4AA",
  movies: "#F59E0B",
  animals: "#22C55E",
};

function brollPath(category: string, index: number): string {
  const padded = String(index + 1).padStart(2, "0");
  const ext = category === "movies" ? "jpg" : "mp4";
  return `launch/broll/${category}/${category}-${padded}.${ext}`;
}

interface QuadGridProps {
  categories: BrollCategory[];
  question: string;
}

export const QuadGrid: React.FC<QuadGridProps> = ({ categories, question }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const textScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 14, stiffness: 120, mass: 0.8 },
    durationInFrames: 20,
  });

  const quadPositions = [
    { top: 0, left: 0 },
    { top: 0, left: "50%" },
    { top: "50%", left: 0 },
    { top: "50%", left: "50%" },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      {categories.slice(0, 4).map((cat, qi) => {
        const pos = quadPositions[qi];
        const quadSpring = spring({
          frame: frame - qi * 3,
          fps,
          config: { damping: 16, stiffness: 150 },
          durationInFrames: 15,
        });
        const isVideo = cat !== "movies";
        const color = CATEGORY_COLORS[cat] ?? "#444";

        return (
          <div
            key={qi}
            style={{
              position: "absolute",
              top: pos.top,
              left: pos.left,
              width: "50%",
              height: "50%",
              display: "grid",
              gridTemplateColumns: `repeat(${QUAD_COLS}, 1fr)`,
              gridTemplateRows: `repeat(${QUAD_ROWS}, 1fr)`,
              gap: 2,
              padding: 2,
              filter: "blur(4px)",
              transform: `scale(${quadSpring})`,
              opacity: interpolate(quadSpring, [0, 1], [0, 1]),
            }}
          >
            {Array.from({ length: QUAD_CELLS }).map((_, ci) => (
              <div
                key={ci}
                style={{
                  backgroundColor: color,
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                {isVideo ? (
                  <OffthreadVideo
                    src={staticFile(brollPath(cat, ci))}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    muted
                  />
                ) : (
                  <Img
                    src={staticFile(brollPath(cat, ci))}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Divider lines */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          width: 3,
          height: "100%",
          backgroundColor: "rgba(255,255,255,0.15)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: "100%",
          height: 3,
          backgroundColor: "rgba(255,255,255,0.15)",
        }}
      />

      {/* Center overlay text */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            transform: `scale(${Math.max(0, textScale)})`,
            textShadow: "0 4px 40px rgba(0,0,0,0.8)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
