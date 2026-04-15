import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";
import { SOURCES } from "./data/sources";

const GRID_COLS = 14;
const GRID_ROWS = 8;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const TILT_X = 8;
const GRID_SCALE = 1.35;

export const OgCardGM: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 2200,
          perspectiveOrigin: "50% 50%",
        }}
      >
        <AbsoluteFill
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: 4,
            padding: 4,
            filter: "blur(5px)",
            transform: `rotateX(${TILT_X}deg) scale(${GRID_SCALE})`,
            transformStyle: "preserve-3d",
          }}
        >
          {Array.from({ length: CELL_COUNT }).map((_, i) => {
            const source = SOURCES[(i * 7 + 3) % SOURCES.length];
            const logoSrc = source.logo.startsWith("/")
              ? source.logo.slice(1)
              : source.logo;

            return (
              <div
                key={i}
                style={{
                  background: source.bg,
                  borderRadius: 6,
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
                    maxWidth: "75%",
                    maxHeight: "75%",
                    objectFit: "contain",
                  }}
                />
              </div>
            );
          })}
        </AbsoluteFill>
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.88) 70%, rgba(255,255,255,0.95) 100%)",
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: "0 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
            padding: "10px 22px",
            background: "rgba(255,255,255,0.85)",
            border: "1px solid rgba(14,15,12,0.08)",
            borderRadius: 999,
            boxShadow: "0 2px 20px rgba(14,15,12,0.06)",
          }}
        >
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 34, height: 34 }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 30,
              fontWeight: 700,
              color: "#0e0f0c",
              letterSpacing: "-0.01em",
            }}
          >
            General Market
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 62,
            fontWeight: 900,
            color: "#0e0f0c",
            textAlign: "center",
            lineHeight: 1.08,
            letterSpacing: "-0.028em",
            maxWidth: 980,
          }}
        >
          The first prediction market
          <br />
          where insiders don&rsquo;t steal
          <br />
          <span style={{ color: "#0e0f0c" }}>70% of your money</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
