import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG = "#000000";
const TEXT = "#F5F5F7";
const TEXT_SECONDARY = "#A1A1A6";
const ACCENT = "#2997FF";

export const OgBannerGMMottoDark: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "100%",
          width: 1400,
          height: 900,
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(ellipse at center, rgba(41,151,255,0.20) 0%, rgba(41,151,255,0) 60%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1.2px)",
          backgroundSize: "26px 26px",
          maskImage:
            "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 75%)",
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

      <div
        style={{
          position: "absolute",
          left: 0,
          top: "50%",
          width: "100%",
          transform: "translateY(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 104,
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
            fontSize: 104,
            fontWeight: 600,
            color: ACCENT,
            letterSpacing: "-0.025em",
            lineHeight: 1.0714,
            marginTop: 4,
          }}
        >
          With an anti-cheat.
        </div>
        <div
          style={{
            marginTop: 24,
            fontFamily: font,
            fontSize: 17,
            fontWeight: 500,
            color: TEXT_SECONDARY,
            letterSpacing: "-0.011em",
          }}
        >
          The new baseline for finance.
        </div>
      </div>
    </AbsoluteFill>
  );
};
