import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#FFFFFF";
const TEXT = "#1D1D1F";
const TEXT_SECONDARY = "#6E6E73";
const ACCENT = "#0071E3";

export const OgBannerGMMottoType: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
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
          right: 64,
          top: 50,
          textAlign: "right",
          fontFamily: font,
          fontSize: 13,
          fontWeight: 600,
          color: TEXT_SECONDARY,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Anti-Cheat
        <br />
        Prediction Markets
      </div>

      <div style={{ position: "absolute", left: 64, top: 162 }}>
        <div
          style={{
            fontFamily: font,
            fontSize: 124,
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
            fontSize: 124,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.025em",
            lineHeight: 1.0714,
            marginTop: 4,
          }}
        >
          With an <span style={{ color: ACCENT }}>anti-cheat.</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 30,
          height: 1,
          background: "rgba(0,0,0,0.08)",
        }}
      />
    </AbsoluteFill>
  );
};
