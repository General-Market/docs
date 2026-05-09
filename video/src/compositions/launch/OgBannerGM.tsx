import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#FAFAF7";
const TEXT = "#0e0f0c";
const APPLE_BLUE = "#0071E3";
const RED = "#DC2626";
const RED_DARK = "#991B1B";
const PILL_BG = "#FFFFFF";
const PILL_SHADOW =
  "0 1px 2px rgba(15,23,42,0.04), 0 10px 28px rgba(15,23,42,0.07)";

const Shield3D: React.FC<{ size: number }> = ({ size }) => {
  const h = size * 1.16;
  return (
    <svg
      width={size}
      height={h}
      viewBox="0 0 200 232"
      style={{
        filter:
          "drop-shadow(0 28px 44px rgba(0,80,181,0.42)) drop-shadow(0 8px 14px rgba(0,0,0,0.20))",
        display: "block",
      }}
    >
      <defs>
        <linearGradient id="sFace" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#5AAEFF" />
          <stop offset="42%" stopColor="#0A84FF" />
          <stop offset="100%" stopColor="#0050B5" />
        </linearGradient>
        <linearGradient id="sRim" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#B8DBFF" />
          <stop offset="100%" stopColor="#003570" />
        </linearGradient>
        <radialGradient id="sGloss" cx="48%" cy="20%" r="62%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.62)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        <linearGradient id="sEdge" x1="0%" y1="0%" x2="100%" y2="0%">
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
        fill="url(#sRim)"
      />

      {/* Inner face */}
      <path
        d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
        fill="url(#sFace)"
      />

      {/* Cross-face edge shading (left highlight, right shadow) */}
      <path
        d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
        fill="url(#sEdge)"
        opacity="0.55"
      />

      {/* Top gloss highlight */}
      <path
        d="M100 18 C136 18 162 27 184 37 V112 C184 164 148 202 100 216 C52 202 16 164 16 112 V37 C38 27 64 18 100 18 Z"
        fill="url(#sGloss)"
      />

      {/* Checkmark — the protection mark */}
      <path
        d="M58 116 L94 152 L146 86"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="20"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Checkmark inner gloss */}
      <path
        d="M58 116 L94 152 L146 86"
        fill="none"
        stroke="rgba(255,255,255,0.40)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0,-3)"
      />
    </svg>
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
  const avatar = height - 16;
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
        padding: `0 28px 0 8px`,
        gap: 16,
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
  const avatar = height - 16;
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
        padding: `0 12px 0 8px`,
        gap: 14,
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
          fontSize: avatar * 0.4,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "2px solid #FFFFFF",
          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        you
      </div>

      <div
        style={{
          fontFamily: font,
          fontSize: height * 0.36,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: "-0.025em",
        }}
      >
        @you
      </div>

      <div
        style={{
          marginLeft: "auto",
          height: height * 0.62,
          padding: "0 18px",
          borderRadius: height,
          background: APPLE_BLUE,
          color: "#FFFFFF",
          fontFamily: font,
          fontSize: height * 0.24,
          fontWeight: 700,
          letterSpacing: "0.10em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 6px 18px rgba(0,113,227,0.32)",
        }}
      >
        PROTECTED
      </div>
    </div>
  );
};

export const OgBannerGM: React.FC = () => {
  const PILL_W = 420;
  const YOU_H = 78;
  const ARCH_H = 60;
  const GAP_AFTER_YOU = 14;
  const GAP_BTW = 9;
  const RIGHT_PAD = 50;
  const stackHeight = YOU_H + GAP_AFTER_YOU + 4 * ARCH_H + 3 * GAP_BTW;
  const STACK_TOP = (500 - stackHeight) / 2;

  const SHIELD_SIZE = 196;
  const SHIELD_RIGHT = RIGHT_PAD + PILL_W + 28;
  const SHIELD_TOP = (500 - SHIELD_SIZE * 1.16) / 2;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        backgroundImage:
          "radial-gradient(circle, rgba(30, 41, 90, 0.13) 1.4px, transparent 1.6px)",
        backgroundSize: "22px 22px",
      }}
    >
      {/* Soft radial glow behind the shield to lift it from the dot grid */}
      <div
        style={{
          position: "absolute",
          right: SHIELD_RIGHT - 60,
          top: SHIELD_TOP - 40,
          width: 320,
          height: 320,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,113,227,0.22) 0%, rgba(0,113,227,0) 65%)",
          filter: "blur(2px)",
          pointerEvents: "none",
        }}
      />

      {/* Left content — brand + headline */}
      <AbsoluteFill
        style={{
          padding: "40px 60px 0 60px",
          gap: 22,
          alignItems: "flex-start",
          justifyContent: "flex-start",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
            General Market
          </div>
        </div>

        <div
          style={{
            fontFamily: font,
            fontSize: 50,
            fontWeight: 800,
            color: TEXT,
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            maxWidth: 680,
          }}
        >
          The first prediction
          <br />
          market where insiders
          <br />
          don&rsquo;t steal{" "}
          <span style={{ color: "#16a34a" }}>70%</span> of your
          <br />
          money
        </div>
      </AbsoluteFill>

      {/* Hero 3D shield — anchored between headline and pill stack */}
      <div
        style={{
          position: "absolute",
          right: SHIELD_RIGHT,
          top: SHIELD_TOP,
        }}
      >
        <Shield3D size={SHIELD_SIZE} />
      </div>

      {/* Right pill stack */}
      <AbsoluteFill
        style={{
          alignItems: "flex-end",
          justifyContent: "flex-start",
          padding: `${STACK_TOP}px ${RIGHT_PAD}px 0 0`,
          gap: 0,
        }}
      >
        <YouPill width={PILL_W} height={YOU_H} />
        <div style={{ height: GAP_AFTER_YOU }} />
        <ArchetypePill
          letter="A"
          label="Insider Traders"
          width={PILL_W}
          height={ARCH_H}
        />
        <div style={{ height: GAP_BTW }} />
        <ArchetypePill
          letter="B"
          label="Front Runners"
          width={PILL_W}
          height={ARCH_H}
        />
        <div style={{ height: GAP_BTW }} />
        <ArchetypePill
          letter="C"
          label="Market Manipulators"
          width={PILL_W}
          height={ARCH_H}
        />
        <div style={{ height: GAP_BTW }} />
        <ArchetypePill
          letter="D"
          label="Orderflow Buyers"
          width={PILL_W}
          height={ARCH_H}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
