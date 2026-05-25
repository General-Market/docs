// Faithful port of juxtopposed's "Retro Glitch RGB" CodePen.
//
// Source structure: three identical content layers (red/green/blue), each
// absolutely positioned and screen-blended. Where they align they reconstruct
// white; where they jitter apart they fan into RGB chromatic-aberration fringes.
//
// Each layer animates on a 1-second keyframe loop. At 60fps that is a 60-frame
// cycle. The three @keyframes (set1/set2/set3) are converted to interpolate()
// calls over `frame % 60`, using the exact pixel values from the source.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

// ── Keyframe conversion ───────────────────────────────────────────────────
//
// Original loop: 1s @ 60fps → 60 frames per cycle.
// CSS %  →  frames  (0%=0, 15%=9, 30%=18, 45%=27, 60%=36, 75%=45, 100%=60)
// Each set has x and y components interpolated separately.

const KEYFRAME_STEPS = [0, 9, 18, 27, 36, 45, 60];

// @keyframes set1: translate(4,4) (5,6) (4,4) (5,6) (4,4) (6,-2) (4,4)
const SET1_X = [4, 5, 4, 5, 4, 6, 4];
const SET1_Y = [4, 6, 4, 6, 4, -2, 4];

// @keyframes set2: translate(0,0) (-1,-2) (0,0) (-1,-2) (0,0) (-1,1) (0,0)
const SET2_X = [0, -1, 0, -1, 0, -1, 0];
const SET2_Y = [0, -2, 0, -2, 0, 1, 0];

// @keyframes set3: translate(-4,-4) (-6,-6) (-4,-4) (0,0) (-4,-4) (-3,-5) (-4,-4)
const SET3_X = [-4, -6, -4, 0, -4, -3, -4];
const SET3_Y = [-4, -6, -4, 0, -4, -5, -4];

function jitter(frame: number, keyValues: number[]): number {
  const cycle = frame % 60;
  return interpolate(cycle, KEYFRAME_STEPS, keyValues, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

// ── Layer component ───────────────────────────────────────────────────────

interface LayerProps {
  color: string;
  tx: number;
  ty: number;
  rects: React.ReactNode;
  buttonLabel1: string;
  buttonLabel2: string;
}

const Layer: React.FC<LayerProps> = ({
  color,
  tx,
  ty,
  rects,
  buttonLabel1,
  buttonLabel2,
}) => {
  const sharedAbsolute: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    mixBlendMode: "screen",
    transform: `translate(${tx}px, ${ty}px)`,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    padding: "3em",
    gap: "2em",
    color,
    border: `12px solid ${color}`,
  };

  return (
    <div style={sharedAbsolute}>
      {/* Row 1: text column + rects column */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "80%",
          width: "100%",
          gap: "2em",
          position: "relative",
        }}
      >
        {/* Left column — text */}
        <div
          style={{
            width: "40%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
          }}
        >
          <h2 style={{ fontSize: 60, margin: 0, fontWeight: 700, color }}>
            OBSERVE
          </h2>
          <h2
            style={{
              fontSize: 60,
              margin: 0,
              fontWeight: 700,
              letterSpacing: 7,
              color,
            }}
          >
            OPPOSE
          </h2>
          <h2 style={{ fontSize: 60, margin: 0, fontWeight: 700, color }}>
            UPSCALE ×4
          </h2>
        </div>

        {/* Right column — bars */}
        <div
          style={{
            width: "60%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "0.5em",
            boxSizing: "border-box",
          }}
        >
          {rects}
        </div>
      </div>

      {/* Row 2: two buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          height: "20%",
          width: "100%",
          gap: "2em",
        }}
      >
        <div
          style={{
            width: "40%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 45,
            fontWeight: 700,
            border: `12px solid ${color}`,
            boxSizing: "border-box",
            color,
          }}
        >
          {buttonLabel1}
        </div>
        <div
          style={{
            width: "60%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: 45,
            fontWeight: 700,
            border: `12px solid ${color}`,
            boxSizing: "border-box",
            color,
          }}
        >
          {buttonLabel2}
        </div>
      </div>
    </div>
  );
};

// ── Rect bars ─────────────────────────────────────────────────────────────

function makeBars(color: string): React.ReactNode {
  const heights = ["2%", "4%", "7%", "10%", "15%", "30%"];
  return (
    <>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: "100%",
            height: h,
            backgroundColor: color,
          }}
        />
      ))}
    </>
  );
}

// ── Main composition ──────────────────────────────────────────────────────

export const RgbGlitch: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const s1x = jitter(frame, SET1_X);
  const s1y = jitter(frame, SET1_Y);
  const s2x = jitter(frame, SET2_X);
  const s2y = jitter(frame, SET2_Y);
  const s3x = jitter(frame, SET3_X);
  const s3y = jitter(frame, SET3_Y);

  const panelW = 840;
  const panelH = 800;
  const panelLeft = (width - panelW) / 2;
  const panelTop = (height - panelH) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@700&display=swap"
        rel="stylesheet"
      />
      {/* Panel wrapper — blur applied here, not on the AbsoluteFill bg */}
      <div
        style={{
          position: "absolute",
          left: panelLeft,
          top: panelTop,
          width: panelW,
          height: panelH,
          filter: "blur(4px)",
          fontFamily: '"Inter", sans-serif',
        }}
      >
        <Layer
          color="#FF0000"
          tx={s1x}
          ty={s1y}
          rects={makeBars("#FF0000")}
          buttonLabel1="CONNECT"
          buttonLabel2="VIEW DESIGN"
        />
        <Layer
          color="#00FF00"
          tx={s2x}
          ty={s2y}
          rects={makeBars("#00FF00")}
          buttonLabel1="CONNECT"
          buttonLabel2="VIEW DESIGN"
        />
        <Layer
          color="#0000FF"
          tx={s3x}
          ty={s3y}
          rects={makeBars("#0000FF")}
          buttonLabel1="CONNECT"
          buttonLabel2="VIEW DESIGN"
        />
      </div>
    </AbsoluteFill>
  );
};
