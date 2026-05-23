import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SceneFrame, font, monoFont, scene } from "../props";

// MECHANISM 06 / 13 — "The zero-fee trap".
//
// One order splits to two routes. Route A goes through a REAL BOOK and pays a
// small visible fee on a tight spread. Route B is sold to a BROKER who charges
// 0% — but fills you on a wider spread. The total-cost bars at the foot reveal
// the truth: the zero-fee route costs MORE. Free is the expensive one.

const STAGE_W = 1440;
const STAGE_LEFT = (1920 - STAGE_W) / 2;
const STAGE_TOP = 320;

// Cost components in cents-per-unit, for the bar comparison.
const ROUTE_A = { fee: 2, spread: 3, total: 5, feeLabel: "0.02%", route: "REAL BOOK" };
const ROUTE_B = { fee: 0, spread: 9, total: 9, feeLabel: "0% FEE", route: "BROKER" };
const MAX_TOTAL = 9;

const RouteCard: React.FC<{
  x: number;
  title: string;
  sub: string;
  accent: boolean;
  delay: number;
}> = ({ x, title, sub, accent, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 22,
  });
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: 70,
        width: 300,
        transform: `translateX(-50%) scale(${(0.7 + 0.3 * pop).toFixed(3)})`,
        opacity: interpolate(pop, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }),
        borderRadius: 16,
        background: accent ? "rgba(0,82,255,0.16)" : "rgba(255,255,255,0.06)",
        border: `1.5px solid ${accent ? scene.accentSoft : scene.gridLineBright}`,
        boxShadow: "0 16px 38px rgba(2,14,43,0.4)",
        padding: "20px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 28,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: scene.ink,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: accent ? scene.accentSoft : scene.inkDim,
          marginTop: 8,
        }}
      >
        {sub}
      </div>
    </div>
  );
};

// A stacked total-cost bar: fee segment + spread segment.
const CostBar: React.FC<{
  x: number;
  data: typeof ROUTE_A;
  loud: boolean;
  delay: number;
}> = ({ x, data, loud, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({
    fps,
    frame: Math.max(0, frame - delay),
    config: { mass: 0.6, damping: 15, stiffness: 120 },
    durationInFrames: 26,
  });
  const op = interpolate(frame - delay, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const maxH = 200;
  const feeH = (data.fee / MAX_TOTAL) * maxH * rise;
  const spreadH = (data.spread / MAX_TOTAL) * maxH * rise;
  const totalH = feeH + spreadH;
  const barW = 132;
  const baseline = 240;

  return (
    <div style={{ position: "absolute", left: x, top: 0, width: barW, transform: "translateX(-50%)" }}>
      {/* Spread segment (bottom) */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: baseline - spreadH,
          width: barW,
          height: spreadH,
          borderRadius: "4px 4px 0 0",
          background: loud ? scene.accent : "rgba(255,255,255,0.20)",
          boxShadow: loud ? "0 0 0 1px rgba(91,121,255,0.6) inset" : "none",
        }}
      />
      {/* Fee segment (on top of spread) */}
      {data.fee > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: baseline - totalH,
            width: barW,
            height: feeH,
            borderRadius: "8px 8px 0 0",
            background: scene.accentSoft,
          }}
        />
      ) : null}

      {/* Total readout above the bar */}
      <div
        style={{
          position: "absolute",
          left: -30,
          top: baseline - totalH - 56,
          width: barW + 60,
          textAlign: "center",
          fontFamily: font,
          fontSize: loud ? 46 : 38,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: loud ? scene.accentSoft : scene.ink,
          fontVariantNumeric: "tabular-nums",
          opacity: op,
        }}
      >
        {data.total}¢
      </div>

      {/* Floor line */}
      <div
        style={{
          position: "absolute",
          left: -20,
          top: baseline,
          width: barW + 40,
          borderTop: "1px solid rgba(255,255,255,0.18)",
        }}
      />
      {/* Route + fee tag below */}
      <div
        style={{
          position: "absolute",
          left: -40,
          top: baseline + 16,
          width: barW + 80,
          textAlign: "center",
          opacity: op,
        }}
      >
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: scene.ink,
          }}
        >
          {data.route}
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: scene.inkDim,
            marginTop: 4,
          }}
        >
          fee {data.feeLabel} · wider spread
        </div>
      </div>
    </div>
  );
};

export const OrderFlowPfof: React.FC = () => {
  const frame = useCurrentFrame();

  const orderOp = interpolate(frame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const lineDraw = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const cx = STAGE_W / 2;
  const ax = STAGE_W * 0.28;
  const bx = STAGE_W * 0.72;

  // Verdict tag fades in after both bars settle.
  const verdictOp = interpolate(frame, [70, 86], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneFrame kicker="MECHANISM 06 / 13" title="The zero-fee trap">
      <AbsoluteFill>
        <div
          style={{
            position: "absolute",
            left: STAGE_LEFT,
            top: STAGE_TOP,
            width: STAGE_W,
            height: 600,
          }}
        >
          {/* The single order at the top, splitting to two routes */}
          <div
            style={{
              position: "absolute",
              left: cx,
              top: 0,
              transform: "translateX(-50%)",
              opacity: orderOp,
              padding: "10px 24px",
              borderRadius: 12,
              background: scene.chip,
              boxShadow: `0 14px 32px ${scene.chipShadow}`,
              fontFamily: monoFont,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: scene.accent,
              whiteSpace: "nowrap",
            }}
          >
            YOUR ORDER
          </div>

          {/* Splitter lines order → two cards */}
          <svg
            width={STAGE_W}
            height={70}
            viewBox={`0 0 ${STAGE_W} 70`}
            style={{ position: "absolute", left: 0, top: 44, overflow: "visible" }}
          >
            <path
              d={`M ${cx} 0 C ${cx} 30, ${ax} 18, ${ax} 26`}
              fill="none"
              stroke={scene.inkSoft}
              strokeWidth={3}
              strokeDasharray="120"
              strokeDashoffset={120 * (1 - lineDraw)}
              strokeLinecap="round"
            />
            <path
              d={`M ${cx} 0 C ${cx} 30, ${bx} 18, ${bx} 26`}
              fill="none"
              stroke={scene.accentSoft}
              strokeWidth={3}
              strokeDasharray="120"
              strokeDashoffset={120 * (1 - lineDraw)}
              strokeLinecap="round"
            />
          </svg>

          {/* Route cards */}
          <RouteCard x={ax} title="ROUTE A" sub="Real book · visible fee" accent={false} delay={20} />
          <RouteCard x={bx} title="ROUTE B" sub="Broker · 0% fee" accent delay={26} />

          {/* Total-cost bars */}
          <div style={{ position: "absolute", left: 0, top: 250, width: STAGE_W, height: 320 }}>
            <CostBar x={ax} data={ROUTE_A} loud={false} delay={40} />
            <CostBar x={bx} data={ROUTE_B} loud delay={48} />
          </div>

          {/* Verdict — free is the expensive one */}
          <div
            style={{
              position: "absolute",
              left: bx,
              top: 250,
              transform: "translateX(-50%)",
              opacity: verdictOp,
              fontFamily: monoFont,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: scene.ink,
              whiteSpace: "nowrap",
            }}
          >
            costs more ▲
          </div>
        </div>
      </AbsoluteFill>
    </SceneFrame>
  );
};
