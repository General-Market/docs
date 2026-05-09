import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG_TOP = "#020919";
const BG_MID = "#0A1A3A";
const BG_BOTTOM = "#03060F";

const Bokeh: React.FC = () => {
  const dots = [
    { x: 90, y: 80, r: 56, c: "rgba(60,140,255,0.22)" },
    { x: 280, y: 380, r: 90, c: "rgba(40,100,200,0.18)" },
    { x: 1180, y: 90, r: 140, c: "rgba(80,160,255,0.20)" },
    { x: 1380, y: 360, r: 80, c: "rgba(60,120,220,0.20)" },
    { x: 740, y: 60, r: 120, c: "rgba(100,180,255,0.10)" },
    { x: 480, y: 460, r: 60, c: "rgba(40,100,200,0.18)" },
    { x: 1050, y: 440, r: 70, c: "rgba(60,140,255,0.16)" },
    { x: 240, y: 200, r: 30, c: "rgba(180,210,255,0.42)" },
    { x: 1280, y: 220, r: 22, c: "rgba(200,220,255,0.46)" },
    { x: 820, y: 410, r: 16, c: "rgba(220,235,255,0.50)" },
  ];
  return (
    <>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.x - d.r,
            top: d.y - d.r,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${d.c} 0%, rgba(0,0,0,0) 70%)`,
            filter: "blur(2px)",
          }}
        />
      ))}
    </>
  );
};

const GhostArchetype: React.FC<{
  letter: string;
  label: string;
  x: number;
  y: number;
  rotate: number;
  scale: number;
}> = ({ letter, label, x, y, rotate, scale }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `rotate(${rotate}deg) scale(${scale})`,
      transformOrigin: "left center",
      display: "flex",
      alignItems: "center",
      gap: 14,
      padding: "14px 28px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
      filter: "blur(1.5px)",
      opacity: 0.55,
    }}
  >
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.55)",
        fontFamily: font,
        fontSize: 17,
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
        fontSize: 22,
        fontWeight: 600,
        color: "rgba(220,230,255,0.55)",
        letterSpacing: "-0.012em",
        textDecoration: "line-through",
        textDecorationColor: "rgba(255,90,90,0.85)",
        textDecorationThickness: 2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMVault: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 30% 30%, ${BG_MID} 0%, ${BG_TOP} 50%, ${BG_BOTTOM} 100%)`,
      }}
    >
      <Bokeh />

      {/* Ghosted insider archetypes — drifting behind the glass */}
      <GhostArchetype letter="A" label="Insider Traders" x={140} y={200} rotate={-3} scale={0.95} />
      <GhostArchetype letter="B" label="Front Runners" x={1080} y={130} rotate={2} scale={0.90} />
      <GhostArchetype letter="C" label="Market Manipulators" x={1090} y={350} rotate={-2} scale={0.92} />
      <GhostArchetype letter="D" label="Orderflow Buyers" x={120} y={400} rotate={3} scale={0.92} />

      {/* Frosted glass card — center hero */}
      <div
        style={{
          position: "absolute",
          left: (1500 - 700) / 2,
          top: (500 - 300) / 2,
          width: 700,
          height: 300,
          borderRadius: 32,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          border: "1px solid rgba(255,255,255,0.20)",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
          padding: 36,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          overflow: "hidden",
        }}
      >
        {/* Top of card: anti-cheat status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#34D399",
                boxShadow: "0 0 12px rgba(52,211,153,0.85)",
              }}
            />
            <div
              style={{
                fontFamily: font,
                fontSize: 14,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              Anti-Cheat · Active
            </div>
          </div>
          <Img
            src={staticFile("gm-logo-white.svg")}
            style={{ width: 54, height: 54 }}
          />
        </div>

        {/* Center of card: @you identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)",
              border: "2px solid rgba(255,255,255,0.30)",
              color: "#FFFFFF",
              fontFamily: font,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: "-0.025em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.30)",
            }}
          >
            you
          </div>
          <div>
            <div
              style={{
                fontFamily: font,
                fontSize: 56,
                fontWeight: 800,
                color: "#FFFFFF",
                letterSpacing: "-0.035em",
                lineHeight: 1,
              }}
            >
              @you
            </div>
            <div
              style={{
                marginTop: 8,
                fontFamily: font,
                fontSize: 17,
                fontWeight: 500,
                color: "rgba(220,230,255,0.65)",
                letterSpacing: "-0.012em",
              }}
            >
              Behind the glass. Out of reach.
            </div>
          </div>
        </div>
      </div>

      {/* General brand mark — top-left */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 36,
          display: "flex",
          alignItems: "center",
          gap: 14,
          mixBlendMode: "screen",
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
