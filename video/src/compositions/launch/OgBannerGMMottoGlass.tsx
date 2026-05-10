import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const TEXT = "#1D1D1F";
const ACCENT = "#0071E3";
const RED = "#DC2626";
const RED_DARK = "#991B1B";

const StruckPill: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 14px 8px 10px",
      borderRadius: 980,
      background: "rgba(255,255,255,0.72)",
      backdropFilter: "saturate(180%) blur(12px)",
      WebkitBackdropFilter: "saturate(180%) blur(12px)",
      border: "1px solid rgba(15,23,42,0.08)",
    }}
  >
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: `radial-gradient(circle at 35% 30%, #EF4444 0%, ${RED} 55%, ${RED_DARK} 100%)`,
        color: "#FFFFFF",
        fontFamily: font,
        fontSize: 11,
        fontWeight: 800,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "inset 0 -1px 1px rgba(0,0,0,0.18)",
      }}
    >
      ✕
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 14,
        fontWeight: 600,
        color: RED_DARK,
        letterSpacing: "-0.014em",
        textDecoration: "line-through",
        textDecorationColor: RED,
        textDecorationThickness: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMMottoGlass: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundImage:
          "linear-gradient(120deg, #E6EFFF 0%, #F5F5F7 55%, #FFFFFF 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: -160,
          top: -160,
          width: 620,
          height: 620,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,113,227,0.22) 0%, rgba(0,113,227,0) 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -120,
          bottom: -180,
          width: 540,
          height: 540,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(41,151,255,0.16) 0%, rgba(41,151,255,0) 70%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 64,
          top: 40,
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
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          top: 110,
          bottom: 40,
          borderRadius: 28,
          padding: "36px 48px 32px",
          background: "rgba(250,250,252,0.78)",
          backdropFilter: "saturate(180%) blur(20px)",
          WebkitBackdropFilter: "saturate(180%) blur(20px)",
          border: "1px solid rgba(15,23,42,0.06)",
          boxShadow:
            "0 30px 80px rgba(15,23,42,0.10), 0 1px 2px rgba(15,23,42,0.04)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: font,
              fontSize: 88,
              fontWeight: 600,
              color: TEXT,
              letterSpacing: "-0.025em",
              lineHeight: 1.0714,
            }}
          >
            Trade easily.
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 88,
              fontWeight: 600,
              color: ACCENT,
              letterSpacing: "-0.025em",
              lineHeight: 1.0714,
              marginTop: 2,
            }}
          >
            With an anti-cheat.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 14,
          }}
        >
          <StruckPill label="Front-running" />
          <StruckPill label="Insider trading" />
          <StruckPill label="Stop hunting" />
          <StruckPill label="Spoofing" />
          <StruckPill label="PFOF" />
          <StruckPill label="Latency arb" />
        </div>
      </div>
    </AbsoluteFill>
  );
};
