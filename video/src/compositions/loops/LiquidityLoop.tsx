import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C } from "../batch-flow/theme";
import { font, monoFont } from "../../common/fonts";
import { BrandMark } from "../../components/BrandMark";

// The brand's pastel-glass world (BatchFlowReel / PerpsGraveyard), not the old
// dark "death spiral" mood — the grimness lives in the diagram, not the lights.
const FPS = 30;
const W = 1920;
const H = 1080;

// One full lap of the cycle = the whole composition, so playback loops seamlessly.
const PERIOD = 120;

const A = { cx: 560, cy: 540 };
const B = { cx: 1360, cy: 540 };
const NODE_W = 460;
const NODE_H = 168;

const BG_GRADIENT = "linear-gradient(135deg, #DCE6FF 0%, #E7E3FF 52%, #F2E4F1 100%)";

// Colour mixing on the light ground — states ease between grey (resting) and
// azure (active) rather than fading white opacity over black.
type RGB = readonly [number, number, number];
const DIM: RGB = [90, 91, 106]; // C.dim  #5A5B6A
const INK: RGB = [29, 29, 31]; // C.text #1D1D1F
const AZURE: RGB = [0, 113, 227]; // C.blue #0071E3
const mix = (a: RGB, b: RGB, t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;

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
    <svg width={44} height={44} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3 C12 3 5.5 10.2 5.5 15 a6.5 6.5 0 0 0 13 0 C18.5 10.2 12 3 12 3 Z"
        stroke={color}
        strokeWidth={1.8}
      />
    </svg>
  ) : (
    <svg width={52} height={44} viewBox="0 0 28 24" fill="none">
      <circle cx={10} cy={8} r={4} stroke={color} strokeWidth={1.8} />
      <path d="M3 21 C3 16 6 14.5 10 14.5 C14 14.5 17 16 17 21" stroke={color} strokeWidth={1.8} />
      <circle cx={20} cy={9} r={3.2} stroke={color} strokeWidth={1.8} />
      <path d="M17.5 21 C17.5 17 19 15.6 21.5 15.6 C24 15.6 25.5 17 25.5 20.5" stroke={color} strokeWidth={1.8} />
    </svg>
  );

// A frosted-glass pill on the pastel ground; the azure rim + glow rise with the
// pulse, the way the BatchFlowReel nodes light as the camera reaches them.
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
      gap: 20,
      background: `rgba(255,255,255,${(0.55 + 0.12 * active).toFixed(3)})`,
      border: `2px solid ${active > 0.02 ? `rgba(0,113,227,${(0.28 + 0.55 * active).toFixed(3)})` : "rgba(60,60,110,0.18)"}`,
      boxShadow: `0 14px 34px rgba(10,12,20,0.10)${active > 0.02 ? `, 0 0 ${(52 * active).toFixed(0)}px rgba(0,113,227,${(0.3 * active).toFixed(3)})` : ""}`,
      backdropFilter: "saturate(180%) blur(20px)",
      WebkitBackdropFilter: "saturate(180%) blur(20px)",
      transform: `scale(${(1 + 0.04 * active).toFixed(3)})`,
    }}
  >
    <Icon type={icon} color={mix(DIM, AZURE, active)} />
    <div
      style={{
        fontFamily: font,
        fontWeight: 800,
        fontSize: 50,
        letterSpacing: "-0.02em",
        color: mix(DIM, INK, Math.max(active, 0.35)),
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

  const topColor = topActive ? C.blue : C.rule;
  const botColor = botActive ? C.blue : C.rule;

  return (
    <AbsoluteFill style={{ background: BG_GRADIENT, fontFamily: font }}>
      {/* soft azure bloom at the loop's centre */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(900px 520px at 50% 52%, rgba(0,113,227,0.07), transparent 70%)",
        }}
      />
      {/* faint paper scanline + vignette — the PerpsGraveyard ground */}
      <AbsoluteFill
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(10,12,20,0.028) 0px, rgba(10,12,20,0.028) 1px, transparent 1px, transparent 3px)",
          mixBlendMode: "multiply",
          opacity: 0.5,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(120% 120% at 42% 42%, rgba(10,12,20,0) 58%, rgba(10,12,20,0.10) 100%)",
          pointerEvents: "none",
        }}
      />

      <BrandMark surface="light" />

      <div
        style={{
          position: "absolute",
          top: 150,
          width: W,
          textAlign: "center",
          fontFamily: monoFont,
          fontSize: 24,
          letterSpacing: "0.34em",
          fontWeight: 700,
          color: C.faint,
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
          strokeLinecap="round"
          markerEnd="url(#ah)"
          style={{ color: topColor }}
        />
        <path
          d={botPath}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
          strokeLinecap="round"
          markerEnd="url(#ah)"
          style={{ color: botColor }}
        />
        {tok && (
          <g opacity={tokOp}>
            <circle cx={tok[0]} cy={tok[1]} r={26} fill="rgba(0,113,227,0.18)" />
            <circle
              cx={tok[0]}
              cy={tok[1]}
              r={12}
              fill={C.blue}
              style={{ filter: `drop-shadow(0 0 14px rgba(0,113,227,0.6))` }}
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
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: topActive ? C.blue : C.dim,
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
          fontFamily: monoFont,
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: botActive ? C.blue : C.dim,
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
          letterSpacing: "-0.01em",
        }}
      >
        <span style={{ color: mix(DIM, AZURE, pulseA) }}>No liquidity, no users.</span>
        <span style={{ color: "rgba(60,60,110,0.2)" }}>&nbsp;&nbsp;</span>
        <span style={{ color: mix(DIM, AZURE, pulseB) }}>No users, no liquidity.</span>
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
