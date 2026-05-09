import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font } from "../../common/fonts";

const BG_TOP = "#020919";
const BG_BOTTOM = "#000308";

const Ghost: React.FC<{
  letter: string;
  label: string;
  x: number;
  y: number;
  rotate?: number;
}> = ({ letter, label, x, y, rotate = 0 }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `rotate(${rotate}deg)`,
      transformOrigin: "left center",
      display: "flex",
      alignItems: "center",
      gap: 11,
      padding: "9px 18px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.04)",
      filter: "blur(0.5px)",
      opacity: 0.50,
    }}
  >
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.50)",
        fontFamily: font,
        fontSize: 13,
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
        fontSize: 17,
        fontWeight: 600,
        color: "rgba(220,230,255,0.50)",
        letterSpacing: "-0.012em",
        textDecoration: "line-through",
        textDecorationColor: "rgba(255,90,90,0.65)",
        textDecorationThickness: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMVaultOrb: React.FC = () => {
  const cx = 750;
  const cy = 250;
  const orbR = 175;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 60%, #08122E 0%, ${BG_TOP} 50%, ${BG_BOTTOM} 100%)`,
      }}
    >
      {/* Outer glow halo around the orb */}
      <div
        style={{
          position: "absolute",
          left: cx - orbR * 2.2,
          top: cy - orbR * 2.2,
          width: orbR * 4.4,
          height: orbR * 4.4,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(140,90,255,0.18) 0%, rgba(40,80,200,0.12) 30%, rgba(0,0,0,0) 60%)",
          filter: "blur(8px)",
        }}
      />

      {/* The orb — Apple Intelligence iridescent sphere */}
      <div
        style={{
          position: "absolute",
          left: cx - orbR,
          top: cy - orbR,
          width: orbR * 2,
          height: orbR * 2,
          borderRadius: "50%",
          background: `
            radial-gradient(circle at 35% 28%, rgba(180,210,255,0.95) 0%, rgba(120,160,255,0.85) 6%, rgba(60,100,230,0.85) 14%, transparent 30%),
            radial-gradient(circle at 70% 70%, rgba(180,90,220,0.75) 0%, transparent 28%),
            radial-gradient(circle at 35% 75%, rgba(60,180,220,0.55) 0%, transparent 32%),
            radial-gradient(circle at 50% 50%, rgba(40,80,200,1) 0%, rgba(20,30,90,1) 60%, rgba(5,10,40,1) 100%)
          `,
          boxShadow:
            "0 30px 90px rgba(40,80,220,0.55), inset 0 -20px 60px rgba(0,0,0,0.55), inset 0 20px 40px rgba(180,210,255,0.18)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        }}
      >
        {/* Inner highlight wisp */}
        <div
          style={{
            position: "absolute",
            top: "8%",
            left: "20%",
            width: "55%",
            height: "20%",
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 70%)",
            filter: "blur(6px)",
            pointerEvents: "none",
          }}
        />

        {/* Status pip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            zIndex: 2,
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#34D399",
              boxShadow: "0 0 8px rgba(52,211,153,0.95)",
            }}
          />
          <div
            style={{
              fontFamily: font,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            Anti-Cheat
          </div>
        </div>

        {/* @you */}
        <div
          style={{
            fontFamily: font,
            fontSize: 60,
            fontWeight: 800,
            color: "#FFFFFF",
            letterSpacing: "-0.038em",
            lineHeight: 1,
            zIndex: 2,
            textShadow:
              "0 0 24px rgba(180,210,255,0.55), 0 0 6px rgba(255,255,255,0.85)",
          }}
        >
          @you
        </div>
        <div
          style={{
            fontFamily: font,
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(200,215,255,0.65)",
            letterSpacing: "-0.005em",
            zIndex: 2,
          }}
        >
          held by the protocol
        </div>
      </div>

      {/* Ghosted archetypes drifting around */}
      <Ghost letter="A" label="Insider Traders" x={90} y={130} rotate={-4} />
      <Ghost letter="B" label="Front Runners" x={1090} y={120} rotate={3} />
      <Ghost letter="C" label="Market Manipulators" x={1080} y={380} rotate={-2} />
      <Ghost letter="D" label="Orderflow Buyers" x={110} y={390} rotate={3} />

      {/* General brand mark */}
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
