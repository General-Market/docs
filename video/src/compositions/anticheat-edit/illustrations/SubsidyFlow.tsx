import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MOTIF · WHO PAYS — "The loser funds the winner".
//
// A cluster of small RETAIL boxes on the left feed value through arrows into
// one larger VENUE node, which passes a single arrow out to MARKET MAKER on
// the right. Value-pulses travel the arrows with the frame. The crowd pays;
// one desk collects.

const STAGE_W = 1560;
const STAGE_H = 480;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 350;

const VENUE = { x: 780, y: 240 };
const MM = { x: 1380, y: 240 };

// Six retail boxes stacked on the left.
const RETAIL = Array.from({ length: 6 }, (_, i) => ({
  x: 150,
  y: 60 + i * 72,
}));

// A pulse position along a straight segment, looping with the frame.
const flow = (frame: number, offset: number, period: number) =>
  ((frame + offset) % period) / period;

export const SubsidyFlow: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const linesOp = interpolate(frame, [16, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const venuePop = spring({
    fps,
    frame: Math.max(0, frame - 10),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });
  const mmPop = spring({
    fps,
    frame: Math.max(0, frame - 16),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });

  return (
    <SceneFrame kicker="MOTIF · WHO PAYS" title="The loser funds the winner">
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
          <svg
            width={STAGE_W}
            height={STAGE_H}
            viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* Retail → venue arrows */}
            {RETAIL.map((r, i) => {
              const x1 = r.x + 70;
              const y1 = r.y + 24;
              const x2 = VENUE.x - 90;
              const y2 = VENUE.y;
              const t = flow(frame, i * 16, 64);
              const dropletX = x1 + (x2 - x1) * t;
              const dropletY = y1 + (y2 - y1) * t;
              return (
                <g key={i} opacity={linesOp}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={scene.gridLineBright}
                    strokeWidth={2}
                  />
                  <circle cx={dropletX} cy={dropletY} r={6} fill={scene.accentSoft} />
                </g>
              );
            })}

            {/* Venue → market maker single fat arrow */}
            <g opacity={linesOp}>
              <line
                x1={VENUE.x + 110}
                y1={VENUE.y}
                x2={MM.x - 130}
                y2={MM.y}
                stroke={scene.accent}
                strokeWidth={5}
              />
              {/* arrowhead */}
              <polygon
                points={`${MM.x - 130},${MM.y - 12} ${MM.x - 130},${MM.y + 12} ${MM.x - 108},${MM.y}`}
                fill={scene.accent}
              />
              {[0, 1, 2].map((k) => {
                const t = flow(frame, k * 24, 72);
                const x = VENUE.x + 110 + (MM.x - 130 - (VENUE.x + 110)) * t;
                return <circle key={k} cx={x} cy={MM.y} r={8} fill={scene.ink} />;
              })}
            </g>
          </svg>

          {/* Retail boxes */}
          {RETAIL.map((r, i) => {
            const pop = spring({
              fps,
              frame: Math.max(0, frame - 4 - i),
              config: { mass: 0.6, damping: 15, stiffness: 130 },
              durationInFrames: 20,
            });
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: r.x,
                  top: r.y,
                  width: 140,
                  height: 48,
                  transform: `scale(${(0.6 + 0.4 * pop).toFixed(3)})`,
                  opacity: interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.06)",
                  border: `1.5px solid ${scene.gridLineBright}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: monoFont,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: scene.inkSoft,
                }}
              >
                retail
              </div>
            );
          })}

          {/* Venue node */}
          <BigNode
            cx={VENUE.x}
            cy={VENUE.y}
            w={200}
            h={140}
            label="VENUE"
            sub="collects"
            pop={venuePop}
            accent={false}
          />

          {/* Market maker node */}
          <BigNode
            cx={MM.x}
            cy={MM.y}
            w={220}
            h={120}
            label="MARKET MAKER"
            sub="keeps it"
            pop={mmPop}
            accent
          />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};

const BigNode: React.FC<{
  cx: number;
  cy: number;
  w: number;
  h: number;
  label: string;
  sub: string;
  pop: number;
  accent: boolean;
}> = ({ cx, cy, w, h, label, sub, pop, accent }) => (
  <div
    style={{
      position: "absolute",
      left: cx - w / 2,
      top: cy - h / 2,
      width: w,
      height: h,
      transform: `scale(${(0.6 + 0.4 * pop).toFixed(3)})`,
      opacity: interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
      borderRadius: 18,
      background: accent ? scene.accent : "rgba(255,255,255,0.08)",
      border: `1.5px solid ${accent ? scene.accentSoft : scene.gridLineBright}`,
      boxShadow: accent
        ? "0 18px 44px rgba(0,82,255,0.4)"
        : "0 18px 40px rgba(2,14,43,0.4)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    }}
  >
    <div
      style={{
        fontFamily: font,
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: "-0.02em",
        color: scene.ink,
        textAlign: "center",
        lineHeight: 1,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: monoFont,
        fontSize: 14,
        fontWeight: 500,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: accent ? scene.inkSoft : scene.inkDim,
      }}
    >
      {sub}
    </div>
  </div>
);
