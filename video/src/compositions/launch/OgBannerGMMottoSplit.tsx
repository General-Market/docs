import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const LIGHT_BG = "#F5F5F7";
const DARK_BG = "#000000";
const TEXT = "#1D1D1F";
const TEXT_DARK = "#F5F5F7";
const TEXT_SECONDARY = "#6E6E73";
const TEXT_SECONDARY_DARK = "rgba(245,245,247,0.55)";
const ACCENT_DARK = "#2997FF";

const SPLIT_X = 880;

export const OgBannerGMMottoSplit: React.FC = () => {
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SPLIT_X,
          height: 500,
          backgroundColor: LIGHT_BG,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SPLIT_X,
          top: 0,
          width: 1500 - SPLIT_X,
          height: 500,
          backgroundColor: DARK_BG,
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
          top: 200,
          fontFamily: font,
          fontSize: 110,
          fontWeight: 600,
          color: TEXT,
          letterSpacing: "-0.025em",
          lineHeight: 1,
        }}
      >
        Trade easily.
      </div>

      <div
        style={{
          position: "absolute",
          left: 64,
          bottom: 56,
          fontFamily: font,
          fontSize: 14,
          fontWeight: 500,
          color: TEXT_SECONDARY,
          letterSpacing: "-0.011em",
        }}
      >
        The new baseline for finance.
      </div>

      <div
        style={{
          position: "absolute",
          right: 48,
          top: 48,
          textAlign: "right",
          fontFamily: font,
          fontSize: 13,
          fontWeight: 600,
          color: TEXT_SECONDARY_DARK,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Anti-Cheat
        <br />
        Prediction Markets
      </div>

      <div
        style={{
          position: "absolute",
          left: SPLIT_X + 48,
          top: 196,
          width: 1500 - SPLIT_X - 96,
          fontFamily: font,
          fontSize: 56,
          fontWeight: 600,
          color: TEXT_DARK,
          letterSpacing: "-0.022em",
          lineHeight: 1.1,
        }}
      >
        With an <span style={{ color: ACCENT_DARK }}>anti-cheat.</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: SPLIT_X + 48,
          bottom: 56,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: ACCENT_DARK,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: SPLIT_X + 64,
          bottom: 50,
          fontFamily: font,
          fontSize: 13,
          fontWeight: 600,
          color: TEXT_SECONDARY_DARK,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
        }}
      >
        Live
      </div>
    </AbsoluteFill>
  );
};
