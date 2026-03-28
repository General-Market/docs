/**
 * VisionVC3 — Scatter narrative + bar chart
 *
 * Dots feel scattered/random (seeded offsets). Title at bottom.
 *
 * Scene 1 — Scatter:
 *   1. Chart + scattered competitor dots appear
 *   2. "What if we listed 10x more markets" — GM appears WITH fees
 *   3. "And paid nothing" — GM slides LEFT to $0
 *   4. Label + ring pulse. Hold.
 *
 * Scene 2 — Bar chart:
 *   5. Hero bar grows. 1→48x counter.
 */
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT, ANIM } from "../vision-vc2/tokens";

const FPS = 30;

// ── Seeded random (deterministic per platform) ────────────────────────

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h;
}

function seededRand(seed: string, index: number): number {
  const h = hash(seed + index);
  return ((h & 0x7fffffff) % 1000) / 1000; // 0..1
}

function randOffset(seed: string, i: number, range: number): number {
  return (seededRand(seed, i) - 0.5) * range;
}

// ── Chart data ────────────────────────────────────────────────────────

const PLATFORMS = [
  { name: "Bitget", markets: 800, cost: 2_000, color: "#00B8A9" },
  { name: "Binance", markets: 1_600, cost: 5_000, color: "#D4A017" },
  { name: "Polymarket", markets: 36_000, cost: 10_000, color: "#7B68EE" },
  { name: "Pump.fun", markets: 95_500, cost: 12_500, color: "#7CB342" },
  { name: "Kalshi", markets: 35_000, cost: 20_000, color: "#FF5722" },
  { name: "Coinbase", markets: 300, cost: 24_000, color: "#0052FF" },
];

const GM = { name: "General Market", markets: 580_000, cost: 0, color: "#00C853" };
const GM_FAKE_COST = 12_000;

// Chart geometry
const CH = { left: 200, right: 1800, top: 120, bottom: 860 };
const W = CH.right - CH.left;
const H = CH.bottom - CH.top;
const X_MAX = 30_000;
const Y_MAX = 620_000;
const xp = (c: number) => CH.left + (c / X_MAX) * W;
const yp = (m: number) => CH.bottom - (m / Y_MAX) * H;
const gmY = yp(GM.markets);
const gmWithFeesX = xp(GM_FAKE_COST);
const gmFreeX = xp(0);

const XT = [{ v: 0, l: "$0" }, { v: 10_000, l: "$10K" }, { v: 20_000, l: "$20K" }, { v: 30_000, l: "$30K" }];
const YT = [
  { v: 0, l: "0" }, { v: 100_000, l: "100K" }, { v: 200_000, l: "200K" },
  { v: 300_000, l: "300K" }, { v: 400_000, l: "400K" }, { v: 500_000, l: "500K" }, { v: 600_000, l: "600K" },
];

// Pre-compute random offsets per platform (deterministic)
const DOT_DATA = PLATFORMS.map((p, i) => ({
  ...p,
  cx: xp(p.cost) + randOffset(p.name, 0, 40),
  cy: yp(p.markets) + randOffset(p.name, 1, 30),
  labelX: 14 + randOffset(p.name, 2, 8),
  labelY: randOffset(p.name, 3, 20),
  dotSize: 16 + randOffset(p.name, 4, 6),
}));

// ── Scene 1: Scatter narrative ────────────────────────────────────────

const CHART_IN = 12;
const TEXT1_IN = 16;
const GM_POP = 20;
const TEXT1_OUT_S = 50;
const TEXT1_OUT_E = 58;
const TEXT2_IN = 60;
const SLIDE_S = 62;
const SLIDE_E = 78;
const TEXT2_OUT_S = 82;
const TEXT2_OUT_E = 88;
const LABEL_IN = 85;

const easeOut = Easing.out(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);

const ScatterNarrative: React.FC = () => {
  const f = useCurrentFrame();

  const chartOp = interpolate(f, [0, CHART_IN], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeOut,
  });

  // Text 1
  const t1E = spring({ frame: Math.max(0, f - TEXT1_IN), fps: FPS, config: ANIM.springFast });
  const t1X = Easing.in(Easing.cubic)(interpolate(f, [TEXT1_OUT_S, TEXT1_OUT_E], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));
  const t1Op = interpolate(t1E, [0, 1], [0, 1]) * (1 - t1X);
  const t1Y = interpolate(t1E, [0, 1], [40, 0]) + t1X * -20;

  // Text 2
  const t2E = spring({ frame: Math.max(0, f - TEXT2_IN), fps: FPS, config: ANIM.springFast });
  const t2X = Easing.in(Easing.cubic)(interpolate(f, [TEXT2_OUT_S, TEXT2_OUT_E], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));
  const t2Op = interpolate(t2E, [0, 1], [0, 1]) * (1 - t2X);
  const t2Y = interpolate(t2E, [0, 1], [40, 0]) + t2X * -20;

  // GM dot
  const gmS = spring({ frame: Math.max(0, f - GM_POP), fps: FPS, config: ANIM.springMedium });
  const gmVis = interpolate(gmS, [0, 0.2], [0, 1], { extrapolateRight: "clamp" });
  const slide = interpolate(f, [SLIDE_S, SLIDE_E], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: easeInOut,
  });
  const gmCurX = gmWithFeesX + (gmFreeX - gmWithFeesX) * slide;

  // Label
  const labS = spring({ frame: Math.max(0, f - LABEL_IN), fps: FPS, config: ANIM.springFast });
  const labOp = interpolate(labS, [0, 1], [0, 1]);
  const labY = interpolate(labS, [0, 1], [20, 0]);

  // Ring
  const ringS = spring({ frame: Math.max(0, f - SLIDE_E), fps: FPS,
    config: { damping: 8, stiffness: 80, mass: 0.6 } });

  // Scene exit
  const sExit = Easing.in(Easing.cubic)(interpolate(f, [SCATTER_DUR - 12, SCATTER_DUR], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  }));

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page, opacity: 1 - sExit }}>
      <svg style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none" }}>
        <g opacity={chartOp}>
          <line x1={CH.left} y1={CH.bottom} x2={CH.right} y2={CH.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          <line x1={CH.left} y1={CH.top} x2={CH.left} y2={CH.bottom}
            stroke={COLOR.textMuted} strokeWidth={1} opacity={0.3} />
          {XT.map(t => {
            const x = xp(t.v);
            return (<g key={`x${t.v}`}>
              {t.v > 0 && <line x1={x} y1={CH.top} x2={x} y2={CH.bottom}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <text x={x} y={CH.bottom + 24} textAnchor="middle"
                fontFamily="Geist, Inter, sans-serif" fontSize={18} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
          {YT.map(t => {
            const y = yp(t.v);
            return (<g key={`y${t.v}`}>
              {t.v > 0 && <line x1={CH.left} y1={y} x2={CH.right} y2={y}
                stroke={COLOR.textMuted} strokeWidth={1} opacity={0.05} strokeDasharray="4 6" />}
              <text x={CH.left - 10} y={y + 5} textAnchor="end"
                fontFamily="Geist, Inter, sans-serif" fontSize={18} fill={COLOR.textSecondary}>{t.l}</text>
            </g>);
          })}
          {f >= SLIDE_E && (
            <circle cx={gmFreeX} cy={gmY} r={18 + ringS * 50}
              fill="none" stroke={GM.color} strokeWidth={2}
              opacity={0.4 * (1 - ringS)} />
          )}
        </g>
      </svg>

      {/* Scattered competitor dots */}
      {DOT_DATA.map(d => (
        <React.Fragment key={d.name}>
          <div style={{
            position: "absolute",
            left: d.cx - d.dotSize / 2,
            top: d.cy - d.dotSize / 2,
            width: d.dotSize, height: d.dotSize,
            borderRadius: "50%",
            border: `2.5px solid ${d.color}`,
            opacity: chartOp,
          }} />
          <div style={{
            position: "absolute",
            left: d.cx + d.labelX,
            top: d.cy + d.labelY,
            fontFamily: FONT.sans, fontSize: 18, fontWeight: 500,
            color: d.color, whiteSpace: "nowrap", opacity: chartOp,
          }}>{d.name}</div>
        </React.Fragment>
      ))}

      {/* GM dot */}
      {gmVis > 0 && (<>
        <div style={{
          position: "absolute",
          left: gmCurX - 16, top: gmY - 16,
          width: 32, height: 32, borderRadius: "50%",
          backgroundColor: GM.color,
          boxShadow: `0 0 24px ${GM.color}50`,
          transform: `scale(${interpolate(gmS, [0, 1], [0, 1])})`,
          opacity: gmVis,
        }} />
        {labOp > 0 && (
          <div style={{
            position: "absolute", left: gmFreeX + 26, top: gmY - 16,
            opacity: labOp, transform: `translateY(${labY}px)`,
          }}>
            <div style={{
              fontFamily: FONT.sans, fontSize: 30, fontWeight: 700,
              color: GM.color, whiteSpace: "nowrap",
            }}>General Market</div>
            <div style={{
              fontFamily: FONT.sans, fontSize: 20, fontWeight: 500,
              color: COLOR.textSecondary, marginTop: 4,
            }}>580K markets · $0 fees</div>
          </div>
        )}
      </>)}

      {/* Text 1 */}
      {t1Op > 0.01 && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: CH.top + H * 0.3, textAlign: "center",
          fontFamily: FONT.sans, fontSize: 72, fontWeight: 600,
          color: COLOR.textPrimary, letterSpacing: "-0.03em",
          opacity: t1Op, transform: `translateY(${t1Y}px)`,
          lineHeight: 1.15,
        }}>
          What if we listed<br />
          <span style={{ fontWeight: 700 }}>10x more markets</span>
        </div>
      )}

      {/* Text 2 */}
      {t2Op > 0.01 && (
        <div style={{
          position: "absolute", left: 0, right: 0,
          top: CH.top + H * 0.35, textAlign: "center",
          fontFamily: FONT.sans, fontSize: 80, fontWeight: 700,
          color: COLOR.textPrimary, letterSpacing: "-0.03em",
          opacity: t2Op, transform: `translateY(${t2Y}px)`,
        }}>
          And paid nothing
        </div>
      )}

      {/* Bottom title */}
      <div style={{
        position: "absolute", bottom: 28, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 21,
        fontWeight: 500, color: COLOR.textSecondary, opacity: chartOp,
      }}>
        Fee Cost for 1M Positions vs Number of Markets
      </div>
    </AbsoluteFill>
  );
};

// ── Scene 2: Bar chart ────────────────────────────────────────────────

const BARS = [
  { name: "Vision", value: 144, hero: true },
  { name: "Crypto Perps", value: 3 },
  { name: "Futures", value: 1 },
  { name: "Options", value: 1 },
  { name: "Prediction\nMarkets", value: 0.14 },
];

const BAR_W = 130;
const BAR_GAP = 50;
const BAR_BW = BARS.length * BAR_W + (BARS.length - 1) * BAR_GAP;
const BAR_L = (1920 - BAR_BW) / 2;
const BL = 860;
const BH = BL - 200;
const BM = 150;
const BAR_DUR = 90;

const BarChartBeat: React.FC = () => {
  const f = useCurrentFrame();
  const eS = spring({ frame: f, fps: FPS, config: ANIM.springFast });
  const op = interpolate(eS, [0, 1], [0, 1]);
  const tY = interpolate(eS, [0, 1], [40, 0]);

  const grow = interpolate(f, [15, 50], [0, 1], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const counter = Math.max(1, Math.round(interpolate(grow, [0, 1], [1, 48], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  })));

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page, opacity: op, transform: `translateY(${tY}px)` }}>
      <svg style={{ position: "absolute", inset: 0, width: 1920, height: 1080, pointerEvents: "none" }}>
        {[0, 50, 100, 150].map(v => {
          const gy = BL - (v / BM) * BH;
          return (<g key={`g${v}`}>
            <line x1={BAR_L - 20} y1={gy} x2={BAR_L + BAR_BW + 20} y2={gy}
              stroke={COLOR.textMuted} strokeWidth={1} opacity={v === 0 ? 0.2 : 0.06} />
            {v > 0 && <text x={BAR_L - 30} y={gy + 5} textAnchor="end"
              fontFamily="Geist, Inter, sans-serif" fontSize={18} fill={COLOR.textMuted}>{v}</text>}
          </g>);
        })}
      </svg>

      {BARS.map((bar, i) => {
        const bx = BAR_L + i * (BAR_W + BAR_GAP);
        const hero = !!bar.hero;
        const h = hero ? Math.max(6, (bar.value / BM) * BH) * grow : Math.max(6, (bar.value / BM) * BH);
        const by = BL - h;
        const label = hero ? "" : bar.value < 1 ? "~1/wk" : String(bar.value);
        return (<React.Fragment key={bar.name}>
          <div style={{
            position: "absolute", left: bx, top: by,
            width: BAR_W, height: Math.max(0, h),
            backgroundColor: hero ? "#00C853" : "#A0A0A0",
            borderRadius: "6px 6px 0 0", opacity: hero ? 1 : 0.5,
          }} />
          {!hero && label && (
            <div style={{
              position: "absolute", left: bx, top: by - 30, width: BAR_W,
              textAlign: "center", fontFamily: FONT.sans, fontSize: 20,
              fontWeight: 500, color: COLOR.textMuted,
            }}>{label}</div>
          )}
          <div style={{
            position: "absolute", left: bx, top: BL + 14, width: BAR_W,
            textAlign: "center", fontFamily: FONT.sans, fontSize: 19,
            fontWeight: hero ? 600 : 500,
            color: hero ? COLOR.textPrimary : COLOR.textSecondary,
            lineHeight: 1.25, whiteSpace: "pre-line",
          }}>{bar.name}</div>
        </React.Fragment>);
      })}

      {f >= 15 && (
        <div style={{
          position: "absolute", left: BAR_L, width: BAR_W,
          top: BL - Math.max(6, (144 / BM) * BH) * grow - 110,
          textAlign: "center",
        }}>
          <div style={{
            fontFamily: FONT.sans, fontSize: 88, fontWeight: 800,
            color: "#00C853", letterSpacing: "-0.04em", lineHeight: 1,
          }}>{counter}x</div>
          <div style={{
            fontFamily: FONT.sans, fontSize: 22, fontWeight: 600,
            color: "#00C853", marginTop: 2, whiteSpace: "nowrap",
          }}>more settlements</div>
        </div>
      )}

      <div style={{
        position: "absolute", bottom: 28, left: 0, right: 0,
        textAlign: "center", fontFamily: FONT.sans, fontSize: 21,
        fontWeight: 500, color: COLOR.textSecondary,
      }}>
        Settlements per Day — Average Across All Markets
      </div>
    </AbsoluteFill>
  );
};

// ── Composition ───────────────────────────────────────────────────────

const GAP = 8;
const SCATTER_DUR = 115;
const TOTAL = SCATTER_DUR + BAR_DUR - GAP;

export const VisionVC3Composition: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
    <Sequence durationInFrames={SCATTER_DUR}>
      <ScatterNarrative />
    </Sequence>
    <Sequence from={SCATTER_DUR - GAP} durationInFrames={BAR_DUR}>
      <BarChartBeat />
    </Sequence>
  </AbsoluteFill>
);

export const visionVC3Meta = {
  id: "VisionVC3",
  component: VisionVC3Composition,
  durationInFrames: TOTAL,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
