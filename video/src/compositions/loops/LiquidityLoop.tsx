import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { colors } from "../anticheat/theme";
import { DotGrid, DotGridVignette } from "../anticheat/DotGrid";
import { font, monoFont } from "../../common/fonts";
import { BrandMark } from "../../components/BrandMark";

// The brand's base world (AntiCheat / the site): light #F0F2F4 ground, animated
// blue dot-grid, near-black bold type, electric blue with a glow. The death
// spiral lives in the diagram, not in a dark mood.
const FPS = 30;
const W = 1920;
const H = 1080;

// One full lap of the cycle = the whole composition.
const PERIOD = 120;

const A = { cx: 560, cy: 558 };
const B = { cx: 1360, cy: 558 };
const NODE_W = 470;
const NODE_H = 176;

// State colours ease between dim (resting) and electric blue (active).
type RGB = readonly [number, number, number];
const DIM: RGB = [110, 114, 122]; // colors.dim   #6E727A
const FG: RGB = [10, 10, 10]; // colors.fg    #0A0A0A
const ACCENT: RGB = [45, 91, 255]; // colors.accent #2D5BFF
const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

// Two directed edges between the states, as cubic-bézier control points.
type Pt = readonly [number, number];
const TOP: readonly Pt[] = [
  [790, 523],
  [900, 356],
  [1020, 356],
  [1130, 523],
];
const BOT: readonly Pt[] = [
  [1130, 593],
  [1020, 760],
  [900, 760],
  [790, 593],
];
const topPath = "M790,523 C900,356 1020,356 1130,523";
const botPath = "M1130,593 C1020,760 900,760 790,593";

const bez = (p: readonly Pt[], t: number): Pt => {
  const u = 1 - t;
  const x =
    u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0];
  const y =
    u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1];
  return [x, y];
};

// wrapped (cyclic) bump so a node can pulse across the loop seam
const wrapDist = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 1 - d);
};
const bump = (phase: number, center: number, hw: number) => {
  const d = wrapDist(phase, center);
  return d < hw ? 0.5 * (1 + Math.cos((Math.PI * d) / hw)) : 0;
};
const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

const Icon: React.FC<{ type: "droplet" | "users"; color: string }> = ({ type, color }) =>
  type === "droplet" ? (
    <svg width={46} height={46} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 C12 3 5.5 10.2 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.2 12 3 12 3 Z"
        stroke={color}
        strokeWidth={1.9}
      />
    </svg>
  ) : (
    <svg width={54} height={46} viewBox="0 0 28 24" fill="none">
      <circle cx={10} cy={8} r={4} stroke={color} strokeWidth={1.9} />
      <path d="M3 21 C3 16 6 14.5 10 14.5 C14 14.5 17 16 17 21" stroke={color} strokeWidth={1.9} />
      <circle cx={20} cy={9} r={3.2} stroke={color} strokeWidth={1.9} />
      <path d="M17.5 21 C17.5 17 19 15.6 21.5 15.6 C24 15.6 25.5 17 25.5 20.5" stroke={color} strokeWidth={1.9} />
    </svg>
  );

// A white surface card; the electric-blue rim + glow ignite with the pulse,
// the way the AntiCheat panels light up.
const Node: React.FC<{
  x: number;
  y: number;
  label: string;
  active: number;
  icon: "droplet" | "users";
}> = ({ x, y, label, active, icon }) => (
  <div
    style={{
      position: "absolute",
      left: x - NODE_W / 2,
      top: y - NODE_H / 2,
      width: NODE_W,
      height: NODE_H,
      borderRadius: 28,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 22,
      background: colors.surface,
      border: `1.5px solid ${active > 0.02 ? `rgba(45, 91, 255,${(0.25 + 0.6 * active).toFixed(3)})` : colors.rule}`,
      boxShadow: `0 18px 44px rgba(10,12,20,0.12)${active > 0.02 ? `, 0 0 ${(56 * active).toFixed(0)}px rgba(45, 91, 255,${(0.36 * active).toFixed(3)})` : ""}`,
      transform: `scale(${(1 + 0.035 * active).toFixed(3)})`,
    }}
  >
    <Icon type={icon} color={mix(DIM, ACCENT, active)} />
    <div
      style={{
        fontFamily: font,
        fontWeight: 800,
        fontSize: 52,
        letterSpacing: "-0.03em",
        color: colors.fg,
      }}
    >
      {label}
    </div>
  </div>
);

export const LiquidityLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const phase = (frame % PERIOD) / PERIOD;

  const pulseA = bump(phase, 0.97, 0.13);
  const pulseB = bump(phase, 0.47, 0.13);

  const topActive = phase >= 0.02 && phase <= 0.42;
  const botActive = phase >= 0.52 && phase <= 0.92;

  let tok: Pt | null = null;
  let tokOp = 0;
  if (topActive) {
    const t = (phase - 0.02) / 0.4;
    tok = bez(TOP, t);
    tokOp = Math.min(smooth(t / 0.12), smooth((1 - t) / 0.12));
  } else if (botActive) {
    const t = (phase - 0.52) / 0.4;
    tok = bez(BOT, t);
    tokOp = Math.min(smooth(t / 0.12), smooth((1 - t) / 0.12));
  }

  const topColor = topActive ? colors.accent : colors.rule;
  const botColor = botActive ? colors.accent : colors.rule;

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font, overflow: "hidden" }}>
      <DotGrid speed={0.8} />
      <DotGridVignette intensity={0.22} />
      <BrandMark surface="light" />

      {/* headline — near-black bold, "Death Spiral" the electric-blue glow word */}
      <div
        style={{
          position: "absolute",
          top: 132,
          width: W,
          textAlign: "center",
          fontFamily: font,
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: "-0.035em",
          lineHeight: 1,
          color: colors.fg,
        }}
      >
        The{" "}
        <span
          style={{
            color: colors.accent,
            textShadow:
              "0 0 26px rgba(91,134,255,0.55), 0 0 10px rgba(45, 91, 255,0.45)",
          }}
        >
          Death Spiral
        </span>
      </div>

      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <marker
            id="ah"
            markerWidth="12"
            markerHeight="12"
            refX="7"
            refY="5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill="currentColor" />
          </marker>
        </defs>
        <path
          d={topPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          markerEnd="url(#ah)"
          style={{ color: topColor, filter: topActive ? "drop-shadow(0 0 10px rgba(45, 91, 255,0.5))" : undefined }}
        />
        <path
          d={botPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          markerEnd="url(#ah)"
          style={{ color: botColor, filter: botActive ? "drop-shadow(0 0 10px rgba(45, 91, 255,0.5))" : undefined }}
        />
        {tok && (
          <g opacity={tokOp}>
            <circle cx={tok[0]} cy={tok[1]} r={28} fill="rgba(45, 91, 255,0.16)" />
            <circle
              cx={tok[0]}
              cy={tok[1]}
              r={13}
              fill={colors.accent}
              style={{ filter: `drop-shadow(0 0 16px rgba(45, 91, 255,0.7))` }}
            />
          </g>
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 300,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: topActive ? colors.accent : colors.dim,
        }}
      >
        traders leave
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 778,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: botActive ? colors.accent : colors.dim,
        }}
      >
        makers leave
      </div>

      <Node x={A.cx} y={A.cy} label="No Liquidity" active={pulseA} icon="droplet" />
      <Node x={B.cx} y={B.cy} label="No Users" active={pulseB} icon="users" />

      <div
        style={{
          position: "absolute",
          top: 928,
          width: W,
          textAlign: "center",
          fontFamily: font,
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "-0.015em",
        }}
      >
        <span style={{ color: mix(DIM, FG, Math.max(0.55, pulseA)) }}>No liquidity, no users.</span>
        <span style={{ color: colors.rule }}>&nbsp;&nbsp;</span>
        <span style={{ color: mix(DIM, FG, Math.max(0.55, pulseB)) }}>No users, no liquidity.</span>
      </div>
    </AbsoluteFill>
  );
};

export const liquidityLoopMeta = {
  id: "LiquidityLoop",
  component: LiquidityLoop,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: PERIOD,
};
