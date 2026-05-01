import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";
import { OG_LOGOS } from "./data/ogLogos";

const GRID_COLS = 8;
const GRID_ROWS = 5;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const NS_BG = "#0F0F10";
const NS_INK = "#FAFAFA";
const NS_RED = "#DC2626";

export const OgBannerNS: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: NS_BG }}>
      {/* Right-side logo grid, masked with a left-to-right fade.
          Tiles keep their brand colors but sit on a dark canvas. */}
      <AbsoluteFill
        style={{
          left: "52%",
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
          justifyContent: "flex-start",
          alignItems: "flex-start",
          padding: "36px 60px 0 60px",
          gap: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Img
            src={staticFile("nsgame-logo.svg")}
            style={{ height: 44, width: "auto" }}
          />
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 60,
            fontWeight: 800,
            color: NS_INK,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
          }}
        >
          AI agents bet against
          <br />
          AI agents across{" "}
          <span style={{ color: NS_RED }}>25,000</span>
          <br />
          markets. The losers
          <br />
          fund the rest<span style={{ color: NS_RED }}>.</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
