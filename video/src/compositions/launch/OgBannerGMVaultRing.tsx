import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG_TOP = "#020919";
const BG_MID = "#0A1A3A";
const BG_BOTTOM = "#03060F";
const BLUE_BRIGHT = "#5AAEFF";

const Ghost: React.FC<{
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
      gap: 12,
      padding: "10px 22px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.05)",
      filter: "blur(0.5px)",
      opacity: 0.55,
    }}
  >
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.5)",
        fontFamily: font,
        fontSize: 14,
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
        fontSize: 18,
        fontWeight: 600,
        color: "rgba(220,230,255,0.50)",
        letterSpacing: "-0.012em",
        textDecoration: "line-through",
        textDecorationColor: "rgba(255,90,90,0.75)",
        textDecorationThickness: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMVaultRing: React.FC = () => {
  const cx = 750;
  const cy = 250;

  // Concentric rings — radii in px
  const ringDefs = [
    { r: 80, opacity: 0.95, w: 2.5, blur: 0 },
    { r: 130, opacity: 0.55, w: 2, blur: 0 },
    { r: 195, opacity: 0.30, w: 1.5, blur: 1 },
    { r: 270, opacity: 0.18, w: 1, blur: 2 },
    { r: 350, opacity: 0.08, w: 1, blur: 3 },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 50%, ${BG_MID} 0%, ${BG_TOP} 55%, ${BG_BOTTOM} 100%)`,
      }}
    >
      {/* Ring system — glowing halos */}
      <svg
        width={1500}
        height={500}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(90,174,255,0.55)" />
            <stop offset="60%" stopColor="rgba(10,132,255,0.10)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Central glow */}
        <circle cx={cx} cy={cy} r={170} fill="url(#centerGlow)" />

        {/* Rings */}
        {ringDefs.map((ring, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={ring.r}
            fill="none"
            stroke={BLUE_BRIGHT}
            strokeWidth={ring.w}
            opacity={ring.opacity}
            style={{ filter: ring.blur ? `blur(${ring.blur}px)` : undefined }}
          />
        ))}

        {/* Tick marks on outermost ring (suggesting it's a HUD) */}
        {Array.from({ length: 24 }).map((_, i) => {
          const angle = (i / 24) * Math.PI * 2;
          const r1 = 350;
          const r2 = 358;
          const x1 = cx + Math.cos(angle) * r1;
          const y1 = cy + Math.sin(angle) * r1;
          const x2 = cx + Math.cos(angle) * r2;
          const y2 = cy + Math.sin(angle) * r2;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={BLUE_BRIGHT}
              strokeWidth={1}
              opacity={0.18}
            />
          );
        })}

        {/* Pulse marker dots at cardinal points */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a, i) => {
          const r = 195;
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={4}
              fill={BLUE_BRIGHT}
              opacity={0.85}
              style={{ filter: "drop-shadow(0 0 6px rgba(90,174,255,0.85))" }}
            />
          );
        })}
      </svg>

      {/* @you core — at center of rings */}
      <div
        style={{
          position: "absolute",
          left: cx - 130,
          top: cy - 130,
          width: 260,
          height: 260,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, rgba(90,174,255,0.30) 0%, rgba(10,40,90,0.92) 60%, rgba(2,9,25,1) 100%)",
          border: "1px solid rgba(140,200,255,0.35)",
          boxShadow:
            "inset 0 0 40px rgba(90,174,255,0.20), 0 0 60px rgba(10,132,255,0.40)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#34D399",
              boxShadow: "0 0 10px rgba(52,211,153,0.95)",
            }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.78)",
              letterSpacing: "0.20em",
              textTransform: "uppercase",
            }}
          >
            Anti-Cheat
          </div>
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 64,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.035em",
            lineHeight: 1,
            textShadow: "0 0 20px rgba(140,200,255,0.4)",
          }}
        >
          @you
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 13,
            fontWeight: 500,
            color: "rgba(180,200,235,0.65)",
            letterSpacing: "-0.008em",
          }}
        >
          inside the field
        </div>
      </div>

      {/* Ghosted archetypes outside the outer ring */}
      <Ghost letter="A" label="Insider Traders" x={70} y={70} />
      <Ghost letter="B" label="Front Runners" x={70} y={420} />
      <Ghost letter="C" label="Market Manipulators" x={1140} y={70} />
      <Ghost letter="D" label="Orderflow Buyers" x={1170} y={420} />

      {/* General brand mark */}
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
