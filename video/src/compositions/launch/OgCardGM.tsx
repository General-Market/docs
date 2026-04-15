import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";
import { SOURCES } from "./data/sources";

const GRID_COLS = 10;
const GRID_ROWS = 10;
const CELL_COUNT = GRID_COLS * GRID_ROWS;

const TILT_X = 12;
const GRID_SCALE = 1.25;
const SCROLL_OFFSET = 342;

export const OgCardGM: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#ffffff" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          perspective: 1800,
          perspectiveOrigin: "50% 45%",
        }}
      >
        <AbsoluteFill
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            gap: 3,
            padding: 3,
            filter: "blur(6px)",
            transform: `rotateX(${TILT_X}deg) scale(${GRID_SCALE}) translateY(${-SCROLL_OFFSET}px)`,
            transformStyle: "preserve-3d",
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
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.72) 100%)",
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
            gap: 18,
            marginBottom: 28,
          }}
        >
          <Img
            src={staticFile("gm-logo.svg")}
            style={{ width: 56, height: 56 }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 44,
              fontWeight: 800,
              color: "#0e0f0c",
              letterSpacing: "-0.02em",
            }}
          >
            General Market
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 54,
            fontWeight: 900,
            color: "#0e0f0c",
            textAlign: "center",
            lineHeight: 1.12,
            letterSpacing: "-0.025em",
            textShadow: "0 4px 40px rgba(255,255,255,0.9)",
            maxWidth: 1040,
          }}
        >
          The first prediction market where insiders
          <br />
          don&rsquo;t steal 70% of your money
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
