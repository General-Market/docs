import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, monoFont, scene } from "../props";

// ONE MARKET VS TEN THOUSAND — "Who's best at ten thousand".
//
// A split comparison. LEFT, "ONE MARKET": a single specialist bar towers —
// one expert with private info dominates a narrow field. RIGHT, "10,000
// MARKETS": the specialist shrinks to average among a faint crowd while a
// "PATTERN FINDER" bar rises above them all. The edge moves from secret
// info to broad pattern skill.

const STAGE_W = 1560;
const STAGE_H = 540;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 360;

const PANEL_W = 700;
const GAP = STAGE_W - PANEL_W * 2;
const BASELINE = STAGE_H - 96;
const MAX_BAR_H = 360;

type Bar = {
  x: number; // centre x within the panel
  h: number; // 0..1 height fraction
  color: string;
  glow: boolean;
  label?: string;
  faint?: boolean;
};

const Panel: React.FC<{
  left: number;
  heading: string;
  sub: string;
  bars: Bar[];
  delay: number;
}> = ({ left, heading, sub, bars, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headOp = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left,
        top: 0,
        width: PANEL_W,
        height: STAGE_H,
      }}
    >
      {/* Panel framing */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 22,
          background: "rgba(255,255,255,0.035)",
          border: "1px solid rgba(255,255,255,0.10)",
          opacity: headOp,
        }}
      />

      {/* Heading */}
      <div
        style={{
          position: "absolute",
          top: 28,
          left: 0,
          width: PANEL_W,
          textAlign: "center",
          opacity: headOp,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: scene.inkSoft,
          }}
        >
          {heading}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 8,
          }}
        >
          {sub}
        </div>
      </div>

      {/* Baseline */}
      <div
        style={{
          position: "absolute",
          left: 60,
          top: BASELINE,
          width: PANEL_W - 120,
          height: 0,
          borderTop: `1px solid ${scene.gridLine}`,
          opacity: headOp,
        }}
      />

      {/* Bars */}
      {bars.map((b, i) => {
        const local = frame - (delay + 10) - i * 1.6;
        const rise = spring({
          fps,
          frame: Math.max(0, local),
          config: { mass: 0.6, damping: 15, stiffness: 120 },
          durationInFrames: 26,
        });
        const h = b.h * MAX_BAR_H * rise;
        const bw = b.faint ? 22 : 92;
        return (
          <div key={i}>
            {b.glow && h > 4 ? (
              <div
                style={{
                  position: "absolute",
                  left: b.x - 90,
                  top: BASELINE - h - 90,
                  width: 180,
                  height: h + 150,
                  background:
                    "radial-gradient(ellipse at center, rgba(0,82,255,0.42) 0%, rgba(0,82,255,0) 68%)",
                  filter: "blur(6px)",
                  pointerEvents: "none",
                }}
              />
            ) : null}
            <div
              style={{
                position: "absolute",
                left: b.x - bw / 2,
                top: BASELINE - h,
                width: bw,
                height: h,
                borderRadius: bw / 2,
                background: b.color,
                boxShadow: b.glow
                  ? `0 0 0 1px ${scene.accentSoft} inset, 0 12px 30px rgba(0,82,255,0.30)`
                  : "none",
              }}
            />
            {b.label ? (
              <div
                style={{
                  position: "absolute",
                  left: b.x - 110,
                  top: BASELINE - h - 40,
                  width: 220,
                  textAlign: "center",
                  fontFamily: monoFont,
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: b.glow ? scene.ink : scene.inkDim,
                  opacity: rise,
                  whiteSpace: "nowrap",
                }}
              >
                {b.label}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const OneVsTenThousand: React.FC = () => {
  // LEFT: one tall specialist bar.
  const leftBars: Bar[] = [
    { x: PANEL_W / 2, h: 0.96, color: scene.accent, glow: true, label: "SPECIALIST" },
  ];

  // RIGHT: a faint crowd of small bars (the specialist now just average),
  // with one PATTERN FINDER bar rising above them.
  const crowdN = 13;
  const crowdStart = 120;
  const crowdGap = 30;
  const rightBars: Bar[] = Array.from({ length: crowdN }).map((_, i) => {
    const wave = 0.18 + 0.16 * Math.abs(Math.sin(i * 1.3));
    const isSpecialist = i === 6;
    return {
      x: crowdStart + i * crowdGap,
      h: wave,
      color: isSpecialist ? scene.accentSoft : "rgba(255,255,255,0.18)",
      glow: false,
      faint: true,
      label: isSpecialist ? "SPECIALIST" : undefined,
    };
  });
  rightBars.push({
    x: PANEL_W - 150,
    h: 0.92,
    color: scene.accent,
    glow: true,
    label: "PATTERN FINDER",
  });

  return (
    <SceneFrame kicker="ONE MARKET VS TEN THOUSAND" title="Who's best at ten thousand">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: STAGE_H,
          }}
        >
          <Panel
            left={0}
            heading="One market"
            sub="private info wins"
            bars={leftBars}
            delay={14}
          />
          <Panel
            left={PANEL_W + GAP}
            heading="10,000 markets"
            sub="pattern skill wins"
            bars={rightBars}
            delay={40}
          />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
