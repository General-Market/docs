import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, monoFont, scene } from "../props";

// MECHANISM 03 / 13 — "Paying for the edge".
//
// A balance beam, level at rest. On the left pan sits a stack of payments
// labelled "PAY THE PLATFORM". As each coin lands, the beam tips left and the
// "OUTCOME" needle below swings off-centre — the trade is pre-tilted in their
// favour before it is ever placed. Reward is bought, not won.

const STAGE_W = 1200;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 360;

const PIVOT = { x: STAGE_W / 2, y: 180 };
const BEAM_HALF = 360; // beam reaches ±360 from pivot
const PAN_DROP = 96; // pans hang this far below their beam endpoint

export const MaxingOut: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Three coins land in sequence; each one tips the beam further left.
  const coinTimes = [22, 40, 58];
  const landed = coinTimes.map((t) =>
    spring({
      fps,
      frame: Math.max(0, frame - t),
      config: { mass: 0.5, damping: 12, stiffness: 140 },
      durationInFrames: 18,
    }),
  );
  const weight = landed.reduce((a, b) => a + b, 0); // 0 → 3

  // Tilt: empty beam level, full stack tips ~16° (left side down).
  const maxTilt = 16;
  const tiltDeg = (weight / 3) * maxTilt;
  const tilt = (tiltDeg * Math.PI) / 180;

  // Beam endpoints in stage coords.
  const lx = PIVOT.x - BEAM_HALF * Math.cos(tilt);
  const ly = PIVOT.y + BEAM_HALF * Math.sin(tilt);
  const rx = PIVOT.x + BEAM_HALF * Math.cos(tilt);
  const ry = PIVOT.y - BEAM_HALF * Math.sin(tilt);

  // The outcome needle below swings with the tilt (pre-tilted result).
  const needleDeg = (weight / 3) * 34; // up to 34° off true

  return (
    <SceneFrame kicker="MECHANISM 03 / 13" title="Paying for the edge">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: 560,
          }}
        >
          <svg
            width={STAGE_W}
            height={560}
            viewBox={`0 0 ${STAGE_W} 560`}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}
          >
            {/* Pillar */}
            <line
              x1={PIVOT.x}
              y1={PIVOT.y}
              x2={PIVOT.x}
              y2={PIVOT.y + 150}
              stroke={scene.gridLineBright}
              strokeWidth={8}
              strokeLinecap="round"
            />
            <rect
              x={PIVOT.x - 70}
              y={PIVOT.y + 148}
              width={140}
              height={14}
              rx={7}
              fill={scene.gridLineBright}
            />

            {/* Beam */}
            <line
              x1={lx}
              y1={ly}
              x2={rx}
              y2={ry}
              stroke={scene.ink}
              strokeWidth={9}
              strokeLinecap="round"
            />
            {/* Pivot fulcrum */}
            <circle cx={PIVOT.x} cy={PIVOT.y} r={13} fill={scene.accent} />

            {/* Pan hangers */}
            <line x1={lx} y1={ly} x2={lx} y2={ly + PAN_DROP} stroke={scene.inkSoft} strokeWidth={3} />
            <line x1={rx} y1={ry} x2={rx} y2={ry + PAN_DROP} stroke={scene.inkSoft} strokeWidth={3} />

            {/* Left pan dish (the paid side) */}
            <path
              d={`M ${lx - 78} ${ly + PAN_DROP} Q ${lx} ${ly + PAN_DROP + 40} ${lx + 78} ${ly + PAN_DROP} Z`}
              fill="none"
              stroke={scene.accentSoft}
              strokeWidth={4}
            />
            {/* Right pan dish (the outcome side) */}
            <path
              d={`M ${rx - 78} ${ry + PAN_DROP} Q ${rx} ${ry + PAN_DROP + 40} ${rx + 78} ${ry + PAN_DROP} Z`}
              fill="none"
              stroke={scene.inkSoft}
              strokeWidth={4}
            />

            {/* Coins stacked on the left pan, appearing as they land */}
            {coinTimes.map((_, i) => {
              const k = landed[i];
              if (k < 0.02) return null;
              const cy = ly + PAN_DROP - 12 - i * 22;
              return (
                <g key={i} opacity={Math.min(1, k)}>
                  <ellipse
                    cx={lx}
                    cy={cy}
                    rx={46}
                    ry={15}
                    fill={scene.accent}
                    stroke={scene.accentSoft}
                    strokeWidth={2}
                    transform={`translate(0 ${(1 - k) * -40}) scale(${(0.7 + 0.3 * k).toFixed(3)})`}
                    style={{ transformOrigin: `${lx}px ${cy}px` }}
                  />
                </g>
              );
            })}
          </svg>

          {/* Left label — PAY THE PLATFORM */}
          <PanLabel
            x={lx}
            y={ly + PAN_DROP + 60}
            big="PAY THE PLATFORM"
            small="before the trade"
            tone="accent"
            delay={18}
          />

          {/* Right label — OUTCOME, pre-tilted */}
          <PanLabel
            x={rx}
            y={ry + PAN_DROP + 60}
            big="THE OUTCOME"
            small="already tilted"
            tone="ink"
            delay={26}
          />

          {/* Outcome needle gauge below — swings with the bought weight */}
          <Gauge cx={STAGE_W / 2} cy={520} deg={needleDeg} />
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};

const PanLabel: React.FC<{
  x: number;
  y: number;
  big: string;
  small: string;
  tone: "accent" | "ink";
  delay: number;
}> = ({ x, y, big, small, tone, delay }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: "translateX(-50%)",
        textAlign: "center",
        opacity: op,
        width: 280,
      }}
    >
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: tone === "accent" ? scene.accentSoft : scene.ink,
          whiteSpace: "nowrap",
        }}
      >
        {big}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: scene.inkDim,
          marginTop: 6,
        }}
      >
        {small}
      </div>
    </div>
  );
};

// A semicircular gauge whose needle swings off-true as weight is bought.
const Gauge: React.FC<{ cx: number; cy: number; deg: number }> = ({ cx, cy, deg }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [20, 34], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const r = 70;
  // 0° = straight up; positive deg tilts the needle to MM's favour (left).
  const a = ((-90 - deg) * Math.PI) / 180;
  const nx = cx + r * Math.cos(a);
  const ny = cy + r * Math.sin(a);
  return (
    <svg
      width={400}
      height={120}
      viewBox={`${cx - 200} ${cy - 90} 400 120`}
      style={{ position: "absolute", left: 0, top: 0, overflow: "visible", opacity: op }}
    >
      {/* Arc track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={6}
        strokeLinecap="round"
      />
      {/* True-centre tick */}
      <line x1={cx} y1={cy - r - 8} x2={cx} y2={cy - r + 4} stroke={scene.inkDim} strokeWidth={2} />
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={scene.accent} strokeWidth={5} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={8} fill={scene.accent} />
    </svg>
  );
};
