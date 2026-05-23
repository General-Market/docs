import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MOTIF · UNDERWATER — "When the floor eats the edge".
//
// A vertical ruler in basis points, 0 at the bottom. A band marks a
// strategy's edge at 2–4 bps. A red FEE FLOOR line sits above it at 10 bps.
// Everything below the fee floor is shaded "underwater" — the strategy can't
// surface. The edge is real; it just lives below the cost line.

const RULER_TOP = 270;
const RULER_H = 620;
const RULER_X = 980; // x of the ruler axis
const MAX_BPS = 12;
const RED = "#FF5A52";

// Map a bps value to a y pixel on the ruler (0 at bottom).
const yFor = (bps: number) => RULER_TOP + RULER_H - (bps / MAX_BPS) * RULER_H;

const EDGE_LO = 2;
const EDGE_HI = 4;
const FEE_FLOOR = 10;

const TRACK_W = 200; // width of the bar/band column left of the axis

export const BpsRuler: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const axisOp = interpolate(frame, [8, 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underwater shading wipes down from the fee-floor line.
  const floorReveal = spring({
    fps,
    frame: Math.max(0, frame - 18),
    config: { mass: 0.6, damping: 16, stiffness: 110 },
    durationInFrames: 26,
  });
  const floorY = yFor(FEE_FLOOR);
  const waterTop = floorY;
  const waterH = (RULER_TOP + RULER_H - floorY) * floorReveal;

  // The edge band grows up from 0 to its 2–4 window.
  const bandRise = spring({
    fps,
    frame: Math.max(0, frame - 12),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 24,
  });
  const bandTopFull = yFor(EDGE_HI);
  const bandBot = yFor(EDGE_LO);
  const bandTop = bandBot - (bandBot - bandTopFull) * bandRise;

  const ticks = [0, 2, 4, 6, 8, 10];
  const trackLeft = RULER_X - TRACK_W - 24;

  return (
    <SceneFrame kicker="MOTIF · UNDERWATER" title="When the floor eats the edge">
      <AbsoluteFill>
        {/* Underwater shading below the fee floor */}
        <div
          style={{
            position: "absolute",
            left: trackLeft - 40,
            top: waterTop,
            width: TRACK_W + 360,
            height: waterH,
            background:
              "linear-gradient(180deg, rgba(255,90,82,0.20) 0%, rgba(255,90,82,0.06) 100%)",
            borderTop: `2px dashed ${RED}`,
          }}
        />

        {/* The edge band, 2–4 bps */}
        <div
          style={{
            position: "absolute",
            left: trackLeft,
            top: bandTop,
            width: TRACK_W,
            height: bandBot - bandTop,
            background: scene.accent,
            borderRadius: 8,
            boxShadow: `0 0 0 1px ${scene.accentSoft} inset, 0 16px 40px rgba(0,82,255,0.32)`,
            opacity: interpolate(bandRise, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
          }}
        />

        {/* Ruler axis + ticks */}
        <svg
          width={520}
          height={RULER_H + 80}
          viewBox={`0 0 520 ${RULER_H + 80}`}
          style={{
            position: "absolute",
            left: RULER_X - 4,
            top: RULER_TOP - 40,
            overflow: "visible",
            opacity: axisOp,
          }}
        >
          {/* vertical axis */}
          <line
            x1={4}
            y1={40}
            x2={4}
            y2={40 + RULER_H}
            stroke={scene.gridLineBright}
            strokeWidth={2}
          />
          {ticks.map((t) => {
            const y = yFor(t) - (RULER_TOP - 40);
            return (
              <g key={t}>
                <line x1={4} y1={y} x2={26} y2={y} stroke={scene.gridLineBright} strokeWidth={2} />
              </g>
            );
          })}
        </svg>

        {/* Mono tick labels */}
        {ticks.map((t) => (
          <div
            key={t}
            style={{
              position: "absolute",
              left: RULER_X + 34,
              top: yFor(t) - 14,
              opacity: axisOp,
              fontFamily: monoFont,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: scene.inkSoft,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {t} bps
          </div>
        ))}

        {/* FEE FLOOR label riding the red line */}
        <div
          style={{
            position: "absolute",
            left: trackLeft - 40,
            top: floorY - 36,
            opacity: interpolate(floorReveal, [0, 0.3], [0, 1], { extrapolateRight: "clamp" }),
            fontFamily: monoFont,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: RED,
          }}
        >
          fee floor · 10 bps
        </div>

        {/* Edge band label */}
        <div
          style={{
            position: "absolute",
            left: trackLeft,
            top: yFor(EDGE_LO) + 16,
            width: TRACK_W,
            textAlign: "center",
            opacity: interpolate(bandRise, [0.3, 0.7], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            fontFamily: font,
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.01em",
            color: scene.ink,
          }}
        >
          EDGE
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 16,
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: scene.inkDim,
              marginTop: 4,
            }}
          >
            2–4 bps
          </div>
        </div>

        {/* Underwater caption */}
        <div
          style={{
            position: "absolute",
            left: trackLeft - 40,
            top: RULER_TOP + RULER_H + 20,
            opacity: interpolate(frame, [40, 58], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: RED,
          }}
        >
          underwater · the edge can't surface
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
