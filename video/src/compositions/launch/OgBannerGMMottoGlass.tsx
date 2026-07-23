import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont as loadBricolage } from "@remotion/google-fonts/BricolageGrotesque";

const TEXT = "#1D1D1F";
const ACCENT = "#0071E3";

const { fontFamily: bricolageFamily } = loadBricolage("normal", {
  subsets: ["latin"],
  weights: ["600", "700", "800"],
});

const FONT_STACK = `${bricolageFamily}, -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", sans-serif`;

type Props = {
  noun?: string;
};

export const OgBannerGMMottoGlass: React.FC<Props> = ({ noun = "Trader" }) => {
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

      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: FONT_STACK,
            fontSize: 108,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.0,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: TEXT }}>Anti-Cheat Protected </span>
          <span style={{ color: ACCENT }}>{noun}</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
