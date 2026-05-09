import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG_TOP = "#02060F";
const BG_BOTTOM = "#000000";

const ShadowGhost: React.FC<{
  letter: string;
  label: string;
  x: number;
  y: number;
}> = ({ letter, label, x, y }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      display: "flex",
      alignItems: "center",
      gap: 10,
      opacity: 0.28,
      filter: "blur(0.5px)",
    }}
  >
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
        color: "rgba(255,255,255,0.4)",
        fontFamily: font,
        fontSize: 12,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {letter}
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 17,
        fontWeight: 600,
        color: "rgba(220,230,255,0.50)",
        letterSpacing: "-0.012em",
        textDecoration: "line-through",
        textDecorationColor: "rgba(255,90,90,0.55)",
        textDecorationThickness: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMVaultBeam: React.FC = () => {
  const beamCx = 750;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${BG_TOP} 0%, ${BG_BOTTOM} 100%)`,
        overflow: "hidden",
      }}
    >
      {/* Beam — wide cone of light from the top */}
      <svg
        width={1500}
        height={500}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <linearGradient id="beamGrad" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgba(140,200,255,0.55)" />
            <stop offset="40%" stopColor="rgba(80,150,255,0.30)" />
            <stop offset="100%" stopColor="rgba(20,50,140,0)" />
          </linearGradient>
          <linearGradient id="beamCore" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="rgba(220,235,255,0.85)" />
            <stop offset="50%" stopColor="rgba(140,200,255,0.40)" />
            <stop offset="100%" stopColor="rgba(60,120,220,0)" />
          </linearGradient>
          <radialGradient id="floorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(140,200,255,0.45)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Outer beam cone */}
        <polygon
          points={`${beamCx - 110},0 ${beamCx + 110},0 ${
            beamCx + 380
          },500 ${beamCx - 380},500`}
          fill="url(#beamGrad)"
          style={{ filter: "blur(6px)" }}
        />
        {/* Inner beam core */}
        <polygon
          points={`${beamCx - 50},0 ${beamCx + 50},0 ${
            beamCx + 230
          },500 ${beamCx - 230},500`}
          fill="url(#beamCore)"
          style={{ filter: "blur(2px)" }}
        />

        {/* Floor pool glow */}
        <ellipse
          cx={beamCx}
          cy={460}
          rx={340}
          ry={50}
          fill="url(#floorGlow)"
        />

        {/* Dust motes in the beam */}
        {Array.from({ length: 14 }).map((_, i) => {
          const x = beamCx + (Math.sin(i * 1.7) * 180);
          const y = 80 + i * 28;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.4}
              fill="rgba(220,235,255,0.85)"
              style={{ filter: "drop-shadow(0 0 4px rgba(220,235,255,0.85))" }}
            />
          );
        })}
      </svg>

      {/* @you — illuminated, in the beam */}
      <div
        style={{
          position: "absolute",
          left: beamCx - 220,
          top: 130,
          width: 440,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(180,210,255,0.30)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#34D399",
              boxShadow: "0 0 8px rgba(52,211,153,0.95)",
            }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Anti-Cheat
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 96,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.04em",
            lineHeight: 1,
            textShadow:
              "0 0 32px rgba(180,210,255,0.65), 0 0 8px rgba(255,255,255,0.70)",
          }}
        >
          @you
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 18,
            fontWeight: 500,
            color: "rgba(200,215,255,0.78)",
            letterSpacing: "-0.012em",
            textShadow: "0 0 12px rgba(180,210,255,0.40)",
          }}
        >
          inside the spotlight. nothing else gets in.
        </div>
      </div>

      {/* Archetypes — in the shadow on the wings */}
      <ShadowGhost letter="A" label="Insider Traders" x={90} y={150} />
      <ShadowGhost letter="C" label="Market Manipulators" x={70} y={350} />
      <ShadowGhost letter="B" label="Front Runners" x={1140} y={150} />
      <ShadowGhost letter="D" label="Orderflow Buyers" x={1140} y={350} />

      {/* General brand mark */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 36,
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <Img
          src={staticFile("gm-logo-white.svg")}
          style={{ width: 32, height: 32 }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 700,
            color: "rgba(255,255,255,0.92)",
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>
    </AbsoluteFill>
  );
};
