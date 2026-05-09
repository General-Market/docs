import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { font, monoFont } from "../../common/fonts";

const BG_TOP = "#000000";
const BG_BOTTOM = "#070A14";
const SLAB_TOP = "#0B0E18";
const SLAB_BOTTOM = "#02030A";

const Dust: React.FC<{
  letter: string;
  label: string;
  x: number;
  y: number;
  rotate: number;
  opacity: number;
  scale: number;
}> = ({ letter, label, x, y, rotate, opacity, scale }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `rotate(${rotate}deg) scale(${scale})`,
      transformOrigin: "left center",
      display: "flex",
      alignItems: "center",
      gap: 10,
      opacity,
      filter: `blur(${(1 - opacity) * 3}px)`,
    }}
  >
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 13,
        fontWeight: 600,
        color: "rgba(255,255,255,0.40)",
        letterSpacing: "0.12em",
      }}
    >
      {letter}
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 22,
        fontWeight: 600,
        color: "rgba(220,220,235,0.45)",
        letterSpacing: "-0.012em",
        textDecoration: "line-through",
        textDecorationColor: "rgba(255,90,90,0.50)",
        textDecorationThickness: 1.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </div>
  </div>
);

export const OgBannerGMVaultMonolith: React.FC = () => {
  const slabW = 320;
  const slabH = 420;
  const slabX = (1500 - slabW) / 2;
  const slabY = (500 - slabH) / 2;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${BG_TOP} 0%, ${BG_BOTTOM} 100%)`,
      }}
    >
      {/* Subtle starfield/dust */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(180,200,255,0.10) 0.5px, transparent 0.6px)",
          backgroundSize: "32px 32px",
          opacity: 0.6,
        }}
      />

      {/* Dim radial vignette behind the slab */}
      <div
        style={{
          position: "absolute",
          left: slabX - 200,
          top: slabY - 80,
          width: slabW + 400,
          height: slabH + 160,
          background:
            "radial-gradient(ellipse at center, rgba(20,40,90,0.30) 0%, rgba(0,0,0,0) 60%)",
          filter: "blur(4px)",
        }}
      />

      {/* Dust archetypes — scattered orbiting the monolith */}
      <Dust letter="A" label="Insider Traders" x={120} y={90} rotate={-4} opacity={0.62} scale={0.9} />
      <Dust letter="C" label="Market Manipulators" x={1080} y={70} rotate={3} opacity={0.55} scale={0.85} />
      <Dust letter="D" label="Orderflow Buyers" x={120} y={400} rotate={2} opacity={0.50} scale={0.88} />
      <Dust letter="B" label="Front Runners" x={1110} y={430} rotate={-3} opacity={0.45} scale={0.9} />

      {/* The monolith */}
      <div
        style={{
          position: "absolute",
          left: slabX,
          top: slabY,
          width: slabW,
          height: slabH,
          background: `linear-gradient(180deg, ${SLAB_TOP} 0%, ${SLAB_BOTTOM} 100%)`,
          borderRadius: 4,
          boxShadow: `
            0 50px 120px rgba(0,0,0,0.85),
            0 20px 40px rgba(10,30,80,0.45),
            inset 0 1px 0 rgba(140,180,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.6),
            inset 1px 0 0 rgba(140,180,255,0.06),
            inset -1px 0 0 rgba(0,0,0,0.4)
          `,
          padding: "32px 28px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Top — engraved status */}
        <div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(140,200,255,0.55)",
              letterSpacing: "0.30em",
              textTransform: "uppercase",
            }}
          >
            Anti-Cheat
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 11,
              fontWeight: 500,
              color: "rgba(255,255,255,0.30)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginTop: 2,
            }}
          >
            Active · Block 0
          </div>
        </div>

        {/* Center — @you backlit */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 13,
              fontWeight: 600,
              color: "rgba(180,200,255,0.45)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 14,
            }}
          >
            Holder
          </div>
          <div
            style={{
              fontFamily: font,
              fontSize: 64,
              fontWeight: 700,
              color: "#FFFFFF",
              letterSpacing: "-0.04em",
              lineHeight: 1,
              textShadow:
                "0 0 24px rgba(140,180,255,0.55), 0 0 4px rgba(180,210,255,0.85)",
            }}
          >
            @you
          </div>
        </div>

        {/* Bottom — small GM mark */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            opacity: 0.55,
          }}
        >
          <Img
            src={staticFile("gm-logo-white.svg")}
            style={{ width: 36, height: 36 }}
          />
        </div>
      </div>

      {/* Edge specular highlight — gives the slab dimensional gleam */}
      <div
        style={{
          position: "absolute",
          left: slabX,
          top: slabY,
          width: 2,
          height: slabH,
          background:
            "linear-gradient(180deg, rgba(180,210,255,0) 0%, rgba(180,210,255,0.50) 30%, rgba(180,210,255,0.10) 100%)",
          borderRadius: 1,
        }}
      />

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
            color: "rgba(255,255,255,0.85)",
            letterSpacing: "-0.018em",
          }}
        >
          General
        </div>
      </div>
    </AbsoluteFill>
  );
};
