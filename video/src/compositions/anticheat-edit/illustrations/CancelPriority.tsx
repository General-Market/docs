import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// Pulling out first — both fire a CANCEL at the same instant. The MM's cancel
// lands first and clears; yours lands late and the order gets hit by the
// adverse move before it can leave. A tiny shared timeline shows the MM
// cancel resolving well before yours, and a price line ticking against you
// in the gap between the two.

const TL_LEFT = 380;
const TL_RIGHT = 1540;
const TL_W = TL_RIGHT - TL_LEFT;
const FIRE_X = TL_LEFT + TL_W * 0.16; // both fire here
const MM_LAND_X = TL_LEFT + TL_W * 0.42; // MM cancel resolves
const YOU_LAND_X = TL_LEFT + TL_W * 0.82; // your cancel resolves (too late)

const ROW_MM = 430;
const ROW_YOU = 660;

const Lane: React.FC<{
  y: number;
  label: string;
  sub: string;
  landX: number;
  good: boolean;
  delay: number;
}> = ({ y, label, sub, landX, good, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const op = interpolate(frame - delay, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // the cancel travels from FIRE_X to landX
  const travel = spring({
    fps,
    frame: Math.max(0, frame - delay - 4),
    config: { mass: 0.7, damping: 18, stiffness: 90 },
    durationInFrames: good ? 22 : 40,
  });
  const dotX = interpolate(travel, [0, 1], [FIRE_X, landX]);
  const landed = travel > 0.98;

  const accent = good ? "#3CCB7F" : "#FF6B5E";

  return (
    <div style={{ opacity: op }}>
      {/* lane rule */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        <line x1={TL_LEFT} y1={y} x2={TL_RIGHT} y2={y} stroke="rgba(255,255,255,0.16)" strokeWidth={2} />
        {/* fire marker */}
        <line x1={FIRE_X} y1={y - 22} x2={FIRE_X} y2={y + 22} stroke={scene.inkSoft} strokeWidth={2} />
        {/* travelling cancel + trail */}
        <line x1={FIRE_X} y1={y} x2={dotX} y2={y} stroke={accent} strokeWidth={3} opacity={0.5} />
        <circle cx={dotX} cy={y} r={11} fill={accent} />
        {/* landing marker */}
        <line x1={landX} y1={y - 26} x2={landX} y2={y + 26} stroke={accent} strokeWidth={2} opacity={landed ? 1 : 0.3} />
      </svg>

      {/* lane label */}
      <div
        style={{
          position: "absolute",
          left: 120,
          top: y - 26,
          width: 240,
          textAlign: "right",
          paddingRight: 24,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: scene.ink,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 4,
          }}
        >
          {sub}
        </div>
      </div>

      {/* outcome chip at the landing point */}
      <div
        style={{
          position: "absolute",
          left: landX - 80,
          top: y - 64,
          width: 160,
          textAlign: "center",
          padding: "7px 0",
          borderRadius: 999,
          background: landed ? accent : "transparent",
          border: `1.5px solid ${accent}`,
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: landed ? scene.blueAbyss : accent,
          opacity: interpolate(frame - delay - (good ? 24 : 42), [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          whiteSpace: "nowrap",
        }}
      >
        {good ? "Cancelled" : "Filled — hit"}
      </div>
    </div>
  );
};

export const CancelPriority: React.FC = () => {
  const frame = useCurrentFrame();

  // adverse price line drifting down across the gap window
  const adverseOp = interpolate(frame, [40, 56], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 09 / 13" title="Pulling out first">
      <AbsoluteFill>
        {/* shared "fire" caption */}
        <div
          style={{
            position: "absolute",
            left: FIRE_X - 110,
            top: ROW_MM - 96,
            width: 220,
            textAlign: "center",
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: scene.inkSoft,
            opacity: interpolate(frame, [8, 20], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Both fire CANCEL ↓
        </div>

        {/* the adverse move — a price line ticking against you between the two landings */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 1920 1080"
          style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: adverseOp }}
        >
          <path
            d={`M ${MM_LAND_X} ${(ROW_MM + ROW_YOU) / 2 + 70}
                L ${MM_LAND_X + 90} ${(ROW_MM + ROW_YOU) / 2 + 84}
                L ${MM_LAND_X + 180} ${(ROW_MM + ROW_YOU) / 2 + 78}
                L ${MM_LAND_X + 280} ${(ROW_MM + ROW_YOU) / 2 + 104}
                L ${YOU_LAND_X} ${(ROW_MM + ROW_YOU) / 2 + 130}`}
            stroke="#FF6B5E"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <text
            x={MM_LAND_X + 100}
            y={(ROW_MM + ROW_YOU) / 2 + 50}
            fill="#FF8C82"
            fontFamily={monoFont}
            fontSize={15}
            letterSpacing="0.08em"
            style={{ textTransform: "uppercase" }}
          >
            ADVERSE MOVE
          </text>
        </svg>

        {/* MM lane — cancel lands first, clean */}
        <Lane
          y={ROW_MM}
          label="MM"
          sub="Cancel lands first"
          landX={MM_LAND_X}
          good
          delay={24}
        />

        {/* YOU lane — cancel lands late, order filled */}
        <Lane
          y={ROW_YOU}
          label="YOU"
          sub="Cancel lands late"
          landX={YOU_LAND_X}
          good={false}
          delay={24}
        />

        {/* time axis caption */}
        <div
          style={{
            position: "absolute",
            left: TL_LEFT,
            top: ROW_YOU + 120,
            width: TL_W,
            display: "flex",
            justifyContent: "space-between",
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.inkDim,
            opacity: interpolate(frame, [20, 32], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span>t = 0</span>
          <span>microseconds →</span>
        </div>

        {/* punch line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 916,
            textAlign: "center",
            opacity: interpolate(frame, [70, 84], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <span
            style={{
              fontFamily: font,
              fontSize: 38,
              fontWeight: 800,
              letterSpacing: "-0.022em",
              color: scene.ink,
            }}
          >
            They&apos;re out before you can move
          </span>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
