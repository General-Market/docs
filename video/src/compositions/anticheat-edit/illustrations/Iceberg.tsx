import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// ONLY WHAT WENT TO COURT — "The part you can see".
//
// An iceberg on the blue field. A small lit tip rises above a shimmering
// waterline, labeled "PUBLIC · LITIGATED". The vast mass below, faint and
// cold, is labeled "10–100× UNCOVERED". Answers the "this isn't true"
// objection — what's documented is only the tip.

const STAGE_W = 1500;
const STAGE_H = 600;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 320;

// Waterline sits high so the tip is small and the mass dominates.
const WATER_Y = 170;
const CX = STAGE_W / 2;

export const Iceberg: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // The berg rises into place from below the waterline.
  const riseSpring = spring({
    fps,
    frame: Math.max(0, frame - 12),
    config: { mass: 0.9, damping: 16, stiffness: 90 },
    durationInFrames: 34,
  });
  const lift = interpolate(riseSpring, [0, 1], [120, 0]);

  // Slow vertical bob once settled — the berg floats.
  const bob = Math.sin(t * 0.7) * 5;
  const bergY = lift + bob;

  // Waterline shimmer: a soft wave path that breathes.
  const waveOp = interpolate(frame, [18, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const wavePts: string[] = [];
  const segs = 60;
  for (let i = 0; i <= segs; i++) {
    const x = (i / segs) * STAGE_W;
    const y =
      WATER_Y +
      Math.sin(i * 0.5 + t * 1.6) * 4 +
      Math.sin(i * 0.21 + t * 0.9) * 3;
    wavePts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // Tip polygon (above water) and mass polygon (below). Coordinates are in
  // stage-local space; the whole berg group is translated by bergY.
  const tip = `${CX},${WATER_Y - 130} ${CX - 95},${WATER_Y + 4} ${CX + 110},${WATER_Y + 4}`;
  const mass = `${CX - 95},${WATER_Y + 4} ${CX + 110},${WATER_Y + 4} ${CX + 230},${WATER_Y + 180} ${CX + 150},${WATER_Y + 360} ${CX - 60},${WATER_Y + 410} ${CX - 250},${WATER_Y + 300} ${CX - 215},${WATER_Y + 120}`;

  const labelOp = interpolate(frame, [40, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const breath = 0.5 + 0.5 * Math.sin(t * 2.2);

  return (
    <SceneFrame kicker="ONLY WHAT WENT TO COURT" title="The part you can see">
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
            {/* Cold water tint below the line */}
            <rect
              x={0}
              y={WATER_Y}
              width={STAGE_W}
              height={STAGE_H - WATER_Y}
              fill="rgba(2,14,43,0.34)"
              opacity={waveOp}
            />

            <g transform={`translate(0 ${bergY.toFixed(2)})`}>
              {/* Submerged mass — vast, faint, cold */}
              <polygon
                points={mass}
                fill="rgba(91,121,255,0.16)"
                stroke="rgba(91,121,255,0.34)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                opacity={riseSpring}
              />
              {/* Lit tip above water */}
              <polygon
                points={tip}
                fill={scene.accent}
                stroke={scene.accentSoft}
                strokeWidth={2}
                strokeLinejoin="round"
                opacity={riseSpring}
                style={{ filter: "drop-shadow(0 8px 24px rgba(0,82,255,0.45))" }}
              />
            </g>

            {/* Shimmering waterline drawn over the berg waist */}
            <polyline
              points={wavePts.join(" ")}
              fill="none"
              stroke={scene.gridLineBright}
              strokeWidth={2}
              opacity={waveOp * (0.7 + 0.3 * breath)}
            />
          </svg>

          {/* Tip label — PUBLIC · LITIGATED */}
          <div
            style={{
              position: "absolute",
              left: CX + 150,
              top: WATER_Y - 120 + bergY,
              opacity: labelOp,
            }}
          >
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: scene.ink,
              }}
            >
              Public · Litigated
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: scene.inkDim,
                marginTop: 6,
              }}
            >
              what went to court
            </div>
          </div>

          {/* Mass label — 10–100× UNCOVERED */}
          <div
            style={{
              position: "absolute",
              left: CX - 470,
              top: WATER_Y + 220 + bergY,
              width: 300,
              textAlign: "right",
              opacity: labelOp,
            }}
          >
            <div
              style={{
                fontFamily: font,
                fontSize: 56,
                fontWeight: 800,
                letterSpacing: "-0.022em",
                color: scene.accentSoft,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.0,
              }}
            >
              10–100×
            </div>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: scene.inkSoft,
                marginTop: 10,
              }}
            >
              uncovered · below the line
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
