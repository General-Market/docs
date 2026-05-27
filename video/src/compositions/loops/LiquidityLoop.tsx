import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ACCENT, FPS, H, NAVY, W } from "../article-2/theme";
import { font, monoFont } from "../../common/fonts";

// One full lap of the cycle = the whole composition, so playback loops seamlessly.
const PERIOD = 120;

const A = { cx: 560, cy: 540 };
const B = { cx: 1360, cy: 540 };
const NODE_W = 460;
const NODE_H = 168;

// Two directed edges between the states, as cubic-bézier control points.
type Pt = readonly [number, number];
const TOP: readonly Pt[] = [
  [790, 505],
  [900, 338],
  [1020, 338],
  [1130, 505],
];
const BOT: readonly Pt[] = [
  [1130, 575],
  [1020, 742],
  [900, 742],
  [790, 575],
];
const topPath = "M790,505 C900,338 1020,338 1130,505";
const botPath = "M1130,575 C1020,742 900,742 790,575";

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
    <svg width={42} height={42} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 C12 3 5.5 10.2 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.2 12 3 12 3 Z"
        stroke={color}
        strokeWidth={1.8}
      />
    </svg>
  ) : (
    <svg width={50} height={42} viewBox="0 0 28 24" fill="none">
      <circle cx={10} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <path d="M3 21 C3 16 6 14.5 10 14.5 C14 14.5 17 16 17 21" stroke={color} strokeWidth={1.8} />
      <circle cx={20} cy={9} r={3.2} stroke={color} strokeWidth={1.8} />
      <path d="M17.5 21 C17.5 17 19 15.6 21.5 15.6 C24 15.6 25.5 17 25.5 20.5" stroke={color} strokeWidth={1.8} />
    </svg>
  );

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
      borderRadius: NODE_H / 2,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      background: `rgba(45,91,255,${0.04 + 0.13 * active})`,
      border: `2px solid rgba(45,91,255,${0.18 + 0.62 * active})`,
      boxShadow: active > 0.02 ? `0 0 ${46 * active}px rgba(45,91,255,${0.5 * active})` : "none",
      transform: `scale(${1 + 0.045 * active})`,
    }}
  >
    <Icon type={icon} color={`rgba(255,255,255,${0.6 + 0.4 * active})`} />
    <div
      style={{
        fontFamily: font,
        fontWeight: 800,
        fontSize: 50,
        letterSpacing: "-0.02em",
        color: `rgba(255,255,255,${0.72 + 0.28 * active})`,
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

  const topColor = topActive ? ACCENT : "rgba(255,255,255,0.4)";
  const botColor = botActive ? ACCENT : "rgba(255,255,255,0.4)";

  return (
    <AbsoluteFill style={{ backgroundColor: NAVY }}>
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(900px 520px at 50% 52%, rgba(45,91,255,0.10), transparent 70%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 150,
          width: W,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 26,
          letterSpacing: "6px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
        }}
      >
        THE DEATH SPIRAL
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
          strokeWidth={3.5}
          markerEnd="url(#ah)"
          style={{ color: topColor }}
        />
        <path
          d={botPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          markerEnd="url(#ah)"
          style={{ color: botColor }}
        />
        {tok && (
          <g opacity={tokOp}>
            <circle cx={tok[0]} cy={tok[1]} r={26} fill="rgba(45,91,255,0.22)" />
            <circle
              cx={tok[0]}
              cy={tok[1]}
              r={12}
              fill={ACCENT}
              style={{ filter: `drop-shadow(0 0 14px ${ACCENT})` }}
            />
          </g>
        )}
      </svg>

      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 286,
          textAlign: "center",
          fontFamily: font,
          fontSize: 25,
          fontWeight: 600,
          color: topColor,
        }}
      >
        traders leave
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          width: W,
          top: 762,
          textAlign: "center",
          fontFamily: font,
          fontSize: 25,
          fontWeight: 600,
          color: botColor,
        }}
      >
        makers leave
      </div>

      <Node x={A.cx} y={A.cy} label="No Liquidity" active={pulseA} icon="droplet" />
      <Node x={B.cx} y={B.cy} label="No Users" active={pulseB} icon="users" />

      <div
        style={{
          position: "absolute",
          top: 916,
          width: W,
          textAlign: "center",
          fontFamily: font,
          fontSize: 34,
          fontWeight: 600,
          letterSpacing: "-0.3px",
        }}
      >
        <span style={{ color: `rgba(255,255,255,${0.4 + 0.55 * pulseA})` }}>
          No liquidity, no users.
        </span>
        <span style={{ color: "rgba(255,255,255,0.2)" }}>&nbsp;&nbsp;</span>
        <span style={{ color: `rgba(255,255,255,${0.4 + 0.55 * pulseB})` }}>
          No users, no liquidity.
        </span>
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
