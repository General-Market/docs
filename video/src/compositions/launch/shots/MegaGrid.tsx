import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../../common/fonts";
import { SOURCES } from "../data/sources";

const GRID_COLS = 10;
const GRID_ROWS = 10;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

interface MegaGridProps {
  question: string;
}

export const MegaGrid: React.FC<MegaGridProps> = ({ question }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <AbsoluteFill
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: 3,
          padding: 3,
          filter: "blur(6px)",
        }}
      >
        {Array.from({ length: CELL_COUNT }).map((_, i) => {
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

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.6) 100%)",
        }}
      />

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 80,
            fontWeight: 900,
            color: "#0e0f0c",
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            textShadow: "0 4px 40px rgba(255,255,255,0.8)",
            whiteSpace: "pre-line",
          }}
        >
          {question}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
