import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";
import { SOURCES } from "./data/sources";

const GRID_COLS = 7;
const GRID_ROWS = 9;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

export const OgCardGM: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAF7" }}>
      {/* Right-side logo grid, masked with a left-to-right fade */}
      <AbsoluteFill
        style={{
          left: "52%",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 30%, rgba(0,0,0,1) 100%)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: 6,
            padding: 6,
          }}
        >
          {Array.from({ length: CELL_COUNT }).map((_, i) => {
            const source = SOURCES[(i * 11 + 5) % SOURCES.length];
            const logoSrc = source.logo.startsWith("/")
              ? source.logo.slice(1)
              : source.logo;

            return (
              <div
                key={i}
                style={{
                  background: source.bg,
                  borderRadius: 8,
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 8,
                }}
              >
                <Img
                  src={staticFile(logoSrc)}
                  style={{
                    maxWidth: "72%",
                    maxHeight: "72%",
                    objectFit: "contain",
                  }}
                />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Left content block */}
      <AbsoluteFill
        style={{
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "56px 64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 28, height: 28 }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 20,
              fontWeight: 600,
              color: "#0e0f0c",
              letterSpacing: "-0.01em",
            }}
          >
            General Market
          </div>
        </div>

        <div style={{ maxWidth: 620 }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 56,
              fontWeight: 700,
              color: "#0e0f0c",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
            }}
          >
            The first prediction market where insiders don&rsquo;t steal{" "}
            <span style={{ color: "#16a34a" }}>70%</span> of your money.
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 18,
            fontWeight: 500,
            color: "#6b6d68",
            letterSpacing: "-0.005em",
          }}
        >
          generalmarket.io
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
