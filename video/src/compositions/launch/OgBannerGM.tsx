import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";
import { OG_LOGOS } from "./data/ogLogos";

const GRID_COLS = 6;
const GRID_ROWS = 4;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

export const OgBannerGM: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#FAFAF7" }}>
      {/* Right-side logo grid, masked with a left-to-right fade */}
      <AbsoluteFill
        style={{
          left: "56%",
          WebkitMaskImage:
            "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 100%)",
          maskImage:
            "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 22%, rgba(0,0,0,1) 100%)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: 8,
            padding: 8,
          }}
        >
          {Array.from({ length: CELL_COUNT }).map((_, i) => {
            const source = OG_LOGOS[i % OG_LOGOS.length];
            const logoSrc = source.logo.startsWith("/")
              ? source.logo.slice(1)
              : source.logo;

            return (
              <div
                key={i}
                style={{
                  background: source.bg,
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: 10,
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

      {/* Left content block — lifted to clear profile picture area */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "flex-start",
          padding: "40px 72px 130px 72px",
          gap: 26,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 52, height: 52 }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 38,
              fontWeight: 700,
              color: "#0e0f0c",
              letterSpacing: "-0.015em",
            }}
          >
            General Market
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 44,
            fontWeight: 700,
            color: "#0e0f0c",
            lineHeight: 1.12,
            letterSpacing: "-0.03em",
          }}
        >
          The first prediction market where
          <br />
          insider traders don&rsquo;t steal
          <br />
          <span style={{ color: "#16a34a" }}>70%</span> of your money
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
