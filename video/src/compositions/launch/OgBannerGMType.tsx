import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#FAFAF7";
const TEXT = "#0e0f0c";
const ACCENT = "#0071E3";
const RED = "#DC2626";
const RED_DARK = "#991B1B";

const StruckTag: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 18px",
      borderRadius: 999,
      background: "#FFFFFF",
      border: "1px solid rgba(15,23,42,0.07)",
      boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
    }}
  >
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, #EF4444 0%, ${RED} 55%, ${RED_DARK} 100%)`,
        color: "#FFFFFF",
        fontFamily: font,
        fontSize: 13,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 -1px 2px rgba(0,0,0,0.18)",
      }}
    >
      ✕
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 18,
        fontWeight: 600,
        color: RED_DARK,
        letterSpacing: "-0.014em",
        textDecoration: "line-through",
        textDecorationColor: RED,
        textDecorationThickness: 2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMType: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {/* Brand mark — top-left */}
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
          style={{ width: 36, height: 36, borderRadius: 6 }}
        />
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 700,
            color: TEXT,
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>

      {/* Subtle dot grid bottom-right just to texture the void */}
      <div
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: 540,
          height: 360,
          backgroundImage:
            "radial-gradient(circle, rgba(15,23,42,0.10) 1.2px, transparent 1.4px)",
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 100% 100%, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Hero number */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 120,
          display: "flex",
          alignItems: "baseline",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 240,
            fontWeight: 900,
            color: TEXT,
            letterSpacing: "-0.06em",
            lineHeight: 0.84,
          }}
        >
          70
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 120,
            fontWeight: 800,
            color: ACCENT,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            marginLeft: -8,
          }}
        >
          %
        </div>
      </div>

      {/* Subhead */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 348,
          fontFamily: font,
          fontSize: 38,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        of trading profits, <span style={{ color: ACCENT }}>untouched.</span>
      </div>

      {/* Struck-through tag row */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: 408,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <StruckTag label="Insider Traders" />
        <StruckTag label="Front Runners" />
        <StruckTag label="Market Manipulators" />
        <StruckTag label="Orderflow Buyers" />
      </div>

      {/* Right-side eyebrow caption */}
      <div
        style={{
          position: "absolute",
          right: 60,
          top: 50,
          textAlign: "right",
          fontFamily: font,
          fontSize: 14,
          fontWeight: 700,
          color: "#6E6E73",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
      >
        Anti-Cheat
        <br />
        Prediction Markets
      </div>
    </AbsoluteFill>
  );
};
