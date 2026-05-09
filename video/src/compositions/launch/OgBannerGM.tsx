import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#FAFAF7";
const TEXT = "#0e0f0c";
const RED = "#DC2626";
const RED_DARK = "#991B1B";
const PILL_BG = "#FFFFFF";
const PILL_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 12px 32px rgba(15,23,42,0.08)";

const Shield3DGM: React.FC<{ size: number }> = ({ size }) => {
  const h = size * 1.16;
  const logoSize = size * 0.66;
  return (
    <div style={{ position: "relative", width: size, height: h }}>
      <svg
        width={size}
        height={h}
        viewBox="0 0 200 232"
        style={{
          filter:
            "drop-shadow(0 32px 56px rgba(0,80,181,0.45)) drop-shadow(0 10px 18px rgba(0,0,0,0.24))",
          display: "block",
        }}
      >
        <defs>
          <linearGradient id="sFaceGM" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#5AAEFF" />
            <stop offset="42%" stopColor="#0A84FF" />
            <stop offset="100%" stopColor="#0050B5" />
          </linearGradient>
          <linearGradient id="sRimGM" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#B8DBFF" />
            <stop offset="100%" stopColor="#003570" />
          </linearGradient>
          <radialGradient id="sGlossGM" cx="48%" cy="20%" r="62%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.62)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id="sEdgeGM" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </linearGradient>
        </defs>

        {/* Depth plate offset to bottom-right — gives the shield real thickness */}
        <path
          d="M100 14 C138 14 165 23 186 33 V112 C186 168 152 208 100 222 C48 208 14 168 14 112 V33 C35 23 62 14 100 14 Z"
          fill="#002F6C"
          transform="translate(5, 7)"
        />
        {/* Outer rim */}
        <path
          d="M100 6 C140 6 170 16 194 28 V112 C194 172 156 216 100 232 C44 216 6 172 6 112 V28 C30 16 60 6 100 6 Z"
          fill="url(#sRimGM)"
        />
        {/* Inner face */}
        <path
          d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
          fill="url(#sFaceGM)"
        />
        {/* Cross-face edge shading */}
        <path
          d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
          fill="url(#sEdgeGM)"
          opacity="0.55"
        />
        {/* Top gloss highlight */}
        <path
          d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
          fill="url(#sGlossGM)"
        />
      </svg>

      {/* GM emblem — black plate inscribed on the shield face */}
      <Img
        src={staticFile("gm-logo.svg")}
        style={{
          position: "absolute",
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          width: logoSize,
          height: "auto",
          borderRadius: 18,
          boxShadow:
            "0 6px 14px rgba(0,20,55,0.40), inset 0 -2px 4px rgba(255,255,255,0.06)",
        }}
      />
    </div>
  );
};

const XBadge: React.FC<{ size: number }> = ({ size }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      background: `radial-gradient(circle at 35% 30%, #EF4444 0%, ${RED} 55%, ${RED_DARK} 100%)`,
      color: "#FFFFFF",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: font,
      fontSize: size * 0.55,
      fontWeight: 800,
      lineHeight: 1,
      flexShrink: 0,
      boxShadow:
        "0 3px 6px rgba(153,27,27,0.35), inset 0 -2px 3px rgba(0,0,0,0.18)",
    }}
  >
    ✕
  </div>
);

const ArchetypePill: React.FC<{
  letter: string;
  label: string;
  width: number;
  height: number;
}> = ({ letter, label, width, height }) => {
  const avatar = height - 14;
  return (
    <div
      style={{
        width,
        height,
        background: PILL_BG,
        borderRadius: height,
        boxShadow: PILL_SHADOW,
        display: "flex",
        alignItems: "center",
        padding: `0 26px 0 7px`,
        gap: 14,
      }}
    >
      <div
        style={{
          width: avatar,
          height: avatar,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #F4F4F2 0%, #E6E6E2 100%)",
          border: "1px solid rgba(15,23,42,0.06)",
          color: "#1D1D1F",
          fontFamily: font,
          fontSize: avatar * 0.5,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {letter}
      </div>
      <XBadge size={height - 22} />
      <div
        style={{
          fontFamily: font,
          fontSize: height * 0.4,
          fontWeight: 600,
          color: RED_DARK,
          letterSpacing: "-0.018em",
          textDecoration: "line-through",
          textDecorationColor: RED,
          textDecorationThickness: 2.5,
          textUnderlineOffset: 2,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>
    </div>
  );
};

const YouPill: React.FC<{ width: number; height: number }> = ({
  width,
  height,
}) => {
  const avatar = height - 14;
  return (
    <div
      style={{
        width,
        height,
        background: PILL_BG,
        borderRadius: height,
        boxShadow: PILL_SHADOW,
        display: "flex",
        alignItems: "center",
        padding: `0 30px 0 7px`,
        gap: 16,
      }}
    >
      <div
        style={{
          width: avatar,
          height: avatar,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #1D1D1F 0%, #3A3A3F 100%)",
          color: "#FFFFFF",
          fontFamily: font,
          fontSize: avatar * 0.38,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "2px solid #FFFFFF",
          boxShadow: "0 2px 4px rgba(0,0,0,0.12)",
        }}
      >
        you
      </div>
      <div
        style={{
          fontFamily: font,
          fontSize: height * 0.40,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: "-0.025em",
        }}
      >
        @you
      </div>
    </div>
  );
};

export const OgBannerGM: React.FC = () => {
  const SHIELD_SIZE = 320;
  const SHIELD_H = SHIELD_SIZE * 1.16;
  const SHIELD_LEFT = (1500 - SHIELD_SIZE) / 2;
  const SHIELD_TOP = (500 - SHIELD_H) / 2;

  const YOU_W = 220;
  const YOU_H = 84;
  const YOU_LEFT = 80;
  const YOU_TOP = (500 - YOU_H) / 2 - 8;

  const ARCH_W = 410;
  const ARCH_H = 60;
  const ARCH_GAP = 8;
  const ARCH_RIGHT = 60;
  const ARCH_STACK_H = 4 * ARCH_H + 3 * ARCH_GAP;
  const ARCH_TOP = (500 - ARCH_STACK_H) / 2 - 8;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        backgroundImage:
          "radial-gradient(circle, rgba(30, 41, 90, 0.13) 1.4px, transparent 1.6px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Soft radial glow behind the shield */}
      <div
        style={{
          position: "absolute",
          left: SHIELD_LEFT - 80,
          top: SHIELD_TOP - 40,
          width: SHIELD_SIZE + 160,
          height: SHIELD_H + 80,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,113,227,0.22) 0%, rgba(0,113,227,0) 60%)",
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />

      {/* Brand mark — top-left, just "General" */}
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
          src={staticFile("gm-logo.svg")}
          style={{ width: 40, height: 40, borderRadius: 8 }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 28,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>

      {/* @you — left zone */}
      <div
        style={{
          position: "absolute",
          left: YOU_LEFT,
          top: YOU_TOP,
        }}
      >
        <YouPill width={YOU_W} height={YOU_H} />
      </div>

      {/* 3D shield with GM emblem — center zone */}
      <div
        style={{
          position: "absolute",
          left: SHIELD_LEFT,
          top: SHIELD_TOP,
        }}
      >
        <Shield3DGM size={SHIELD_SIZE} />
      </div>

      {/* Insider archetype stack — right zone */}
      <div
        style={{
          position: "absolute",
          right: ARCH_RIGHT,
          top: ARCH_TOP,
          display: "flex",
          flexDirection: "column",
          gap: ARCH_GAP,
          alignItems: "flex-end",
        }}
      >
        <ArchetypePill
          letter="A"
          label="Insider Traders"
          width={ARCH_W}
          height={ARCH_H}
        />
        <ArchetypePill
          letter="B"
          label="Front Runners"
          width={ARCH_W}
          height={ARCH_H}
        />
        <ArchetypePill
          letter="C"
          label="Market Manipulators"
          width={ARCH_W}
          height={ARCH_H}
        />
        <ArchetypePill
          letter="D"
          label="Orderflow Buyers"
          width={ARCH_W}
          height={ARCH_H}
        />
      </div>
    </AbsoluteFill>
  );
};
