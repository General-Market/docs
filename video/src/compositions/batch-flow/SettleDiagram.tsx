import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame } from "remotion";
import { FIELD_BG } from "./chrome";
import { BrandMark } from "../../components/BrandMark";
import { C, EASE, font, FPS, H, monoFont, sec, W } from "./theme";
import { PersonIcon } from "./throughput";
import {
  MARKETS,
  N_TRADERS,
  sideCount,
  STAKE_PER_MARKET,
  TRADER_NAMES,
  traderNet,
  traderNetOnLine,
} from "./data";

// ── BatchSettleDiagram — the settle half, animated on one continuous board ─────
// The board the static master laid out, now in motion. An internal camera flies
// over it, and the only thing that ever changes is which part you're looking at:
//   1. the balance UNFOLDS — the ten markets are flung out of the pool, line by
//      line, slamming into their row with a spring rebound and motion blur;
//   2. a cursor swoops in on a bezier and CLICKS the tenth line — the click
//      punches the camera and the price crosses its +2% target (YES wins), then
//      the parimutuel pays: the losers fund the winners;
//   3. it PULLS BACK and every line stamps YES or NO with a ring of light;
//   4. it pans to the ledger, which FILLS — each line's number springs across
//      the five traders, the columns sum, your total settling last at +$4.17.
// One surface, morphing — never a cut. Pastel-glass world, blue dot lattice.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ci = (frame: number, a: number, b: number, from: number, to: number, easing?: (t: number) => number): number =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
const cubicOut = (t: number): number => 1 - Math.pow(1 - clamp01(t), 3);
// one axis of a cubic bezier
const bez = (t: number, p0: number, p1: number, p2: number, p3: number): number => {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
};

const TRADER_COLORS = ["#0071E3", "#FF7A59", "#7B5CFF", "#17B0A6", "#FF6FB5"];
const ZOOM_LINE = 9; // the tenth market — Manifesting, outcome YES

const isYes = (i: number): boolean => MARKETS[i].outcome === "up";
const yesCount = (i: number): number => sideCount(i, "up");
const noCount = (i: number): number => sideCount(i, "down");

// ── board geometry — one wide surface, 0..BW × 0..BH ─────────────────────────
const BW = 1980;
const BH = H;

const ROW_H = 64;
const ROW_PITCH = 80;
const BLOCK_H = 10 * ROW_H + 9 * (ROW_PITCH - ROW_H);
const LTOP = (BH - BLOCK_H) / 2;
const rowY = (i: number): number => LTOP + i * ROW_PITCH + ROW_H / 2; // 180..900
const HEADER_Y = 100;
const TOTAL_Y = 988;

const POOL = { cx: 280, cy: BH / 2, w: 304, h: 224 };
const BUS_X = 470;
const LEDGER = { cx: 742, w: 400 };
const LEDGER_L = LEDGER.cx - LEDGER.w / 2;
const LEDGER_R = LEDGER.cx + LEDGER.w / 2;
const OUT = { cx: 1086, w: 128, h: 50 };
const OUT_L = OUT.cx - OUT.w / 2;
const OUT_R = OUT.cx + OUT.w / 2;
const TABLE = { x0: 1252, w: 668 };
const COL_W = TABLE.w / N_TRADERS;
const colCx = (t: number): number => TABLE.x0 + t * COL_W + COL_W / 2;
const TABLE_CX = TABLE.x0 + TABLE.w / 2;

// the dive graphs live on the board, in the space the table later fills — the
// camera travels to each in turn rather than parking on both at once.
const CHART_POS = { cx: 1440, cy: 350 };
const SPLIT_POS = { cx: 1440, cy: 760 };

// ── timeline (frames @60) ─────────────────────────────────────────────────────
const T = {
  poolIn: [0, sec(0.6)] as [number, number],
  ledgerStart: sec(0.7),
  ledgerStep: sec(0.17),
  ledgerDur: sec(0.85),
  holdA: sec(4.0),
  diveIn: [sec(4.2), sec(5.6)] as [number, number], // tight on the tenth line
  click: sec(5.6),
  cursorIn: [sec(4.4), sec(5.6)] as [number, number],
  chartTravel: [sec(5.9), sec(7.0)] as [number, number], // camera climbs to the chart
  chartDraw: [sec(6.6), sec(8.6)] as [number, number], // the price crosses +2%
  splitTravel: [sec(9.0), sec(10.0)] as [number, number], // camera drops to the split
  splitFlow: [sec(10.2), sec(12.2)] as [number, number], // YES takes the pool
  graphsOut: [sec(13.0), sec(13.8)] as [number, number],
  pullBack: [sec(13.4), sec(14.8)] as [number, number],
  resolveStart: sec(14.6),
  resolveStep: sec(0.15),
  resolveDur: sec(0.5),
  panTable: [sec(16.8), sec(18.2)] as [number, number],
  tableStart: sec(18.3),
  tableStep: sec(0.2),
  tableDur: sec(0.5),
  totals: [sec(20.9), sec(21.9)] as [number, number],
  allHold: [sec(22.0), sec(22.8)] as [number, number], // hold on every trader
  isolate: [sec(22.9), sec(24.4)] as [number, number], // close on only your P&L
  youPulse: [sec(24.0), sec(24.8)] as [number, number],
};
const TOTAL = sec(26.0);
const CLICK = T.click;
// the tenth line sits dead-centre when the camera dives onto it — the click
// target and the origin of the click's burst.
const CLICK_SX = 960;
const CLICK_SY = 540;
const YOU_CX = colCx(0);

// ── internal camera — keyframed glide over the board ──────────────────────────
const CAM = Easing.bezier(0.5, 0, 0.2, 1);
type Key = { at: number; cx: number; cy: number; scale: number };
const KEYS: Key[] = [
  { at: 0, cx: 560, cy: 540, scale: 1.2 },
  { at: T.holdA, cx: 560, cy: 540, scale: 1.2 },
  { at: T.diveIn[1], cx: LEDGER.cx, cy: rowY(ZOOM_LINE), scale: 2.1 }, // dive + click
  { at: T.chartTravel[1], cx: CHART_POS.cx, cy: CHART_POS.cy, scale: 1.42 }, // the price
  { at: T.splitTravel[0], cx: CHART_POS.cx, cy: CHART_POS.cy, scale: 1.42 },
  { at: T.splitTravel[1], cx: SPLIT_POS.cx, cy: SPLIT_POS.cy, scale: 1.42 }, // the payout
  { at: T.graphsOut[0], cx: SPLIT_POS.cx, cy: SPLIT_POS.cy, scale: 1.42 },
  { at: T.pullBack[1], cx: 700, cy: 540, scale: 1.16 }, // resolve
  { at: T.panTable[0], cx: 700, cy: 540, scale: 1.16 },
  { at: T.panTable[1], cx: TABLE_CX - 120, cy: 540, scale: 1.0 }, // every trader
  { at: T.isolate[0], cx: TABLE_CX - 120, cy: 540, scale: 1.0 },
  { at: T.isolate[1], cx: YOU_CX + 26, cy: 540, scale: 1.62 }, // only your P&L
  { at: TOTAL, cx: YOU_CX + 26, cy: 540, scale: 1.62 },
];
const cameraAt = (frame: number): { cx: number; cy: number; scale: number } => {
  if (frame <= KEYS[0].at) return KEYS[0];
  for (let i = 0; i < KEYS.length - 1; i++) {
    const a = KEYS[i];
    const b = KEYS[i + 1];
    if (frame <= b.at) {
      const p = a.at === b.at ? 1 : CAM(clamp01((frame - a.at) / (b.at - a.at)));
      return { cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), scale: lerp(a.scale, b.scale, p) };
    }
  }
  return KEYS[KEYS.length - 1];
};

const place = (left: number, top: number): React.CSSProperties => ({
  position: "absolute",
  left,
  top,
  transform: "translate(-50%,-50%)",
});

const glass = (radius: number): React.CSSProperties => ({
  background: "linear-gradient(160deg, rgba(255,255,255,0.70) 0%, rgba(255,255,255,0.44) 100%)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: radius,
  boxShadow: "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.86)",
});

// soft radial light — the bloom that makes a beat feel lit, not drawn
const Bloom: React.FC<{ x: number; y: number; r: number; color: string; op: number }> = ({ x, y, r, color, op }) =>
  op <= 0.01 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, transparent 68%)`,
        opacity: op,
        filter: "blur(8px)",
        pointerEvents: "none",
      }}
    />
  );

// ── small parts ──────────────────────────────────────────────────────────────
const SectionTag: React.FC<{ cx: number; y: number; text: string; op: number }> = ({ cx, y, text, op }) => (
  <div
    style={{
      ...place(cx, y),
      fontFamily: monoFont,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: "0.14em",
      color: C.faint,
      whiteSpace: "nowrap",
      opacity: op,
    }}
  >
    {text}
  </div>
);

const VotePill: React.FC<{ label: string; n: number; color: string }> = ({ label, n, color }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "3px 11px",
      borderRadius: 999,
      background: `${color}1c`,
      border: `1px solid ${color}55`,
      fontFamily: monoFont,
      fontSize: 16,
      fontWeight: 700,
      color,
      fontVariantNumeric: "tabular-nums",
    }}
  >
    <span style={{ opacity: 0.8 }}>{label}</span>
    <span>{n}</span>
  </div>
);

// each market is flung out of the bus and slams into its row (spring rebound +
// motion blur) — never a slide-fade
const LedgerBox: React.FC<{ i: number; frame: number; focused: boolean }> = ({ i, frame, focused }) => {
  const m = MARKETS[i];
  const local = frame - (T.ledgerStart + i * T.ledgerStep);
  if (local < 0) return null;
  const s = spring({ frame: local, fps: FPS, config: { damping: 13, stiffness: 150, mass: 0.7 } });
  const startX = BUS_X + 24;
  const x = lerp(startX, LEDGER.cx, s);
  const op = ci(local, 0, sec(0.16), 0, 1);
  const blur = ci(local, 0, sec(0.42), 7, 0);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: rowY(i),
        transform: "translate(-50%,-50%)",
        opacity: op,
        filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : "none",
        width: LEDGER.w,
        height: ROW_H,
        ...glass(16),
        border: focused ? `2px solid ${C.blue}` : "1px solid rgba(255,255,255,0.7)",
        boxShadow: focused
          ? `0 14px 34px rgba(70,74,140,0.18), 0 0 28px ${C.blue}44, inset 0 1px 0 rgba(255,255,255,0.86)`
          : "0 10px 28px rgba(70,74,140,0.14), inset 0 1px 0 rgba(255,255,255,0.86)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 21,
          fontWeight: 700,
          color: C.text,
          letterSpacing: "-0.01em",
          maxWidth: 210,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {m.name}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <VotePill label="YES" n={yesCount(i)} color={C.up} />
        <VotePill label="NO" n={noCount(i)} color={C.down} />
      </div>
    </div>
  );
};

// outcome stamps in with a spring overshoot and a ring of light pops behind it
const OutcomeChip: React.FC<{ i: number; frame: number }> = ({ i, frame }) => {
  const yes = isYes(i);
  const col = yes ? C.up : C.down;
  const local = frame - (T.resolveStart + i * T.resolveStep);
  if (local < 0) return null;
  const s = spring({ frame: local, fps: FPS, config: { damping: 11, stiffness: 170, mass: 0.7 } });
  const op = ci(local, 0, sec(0.12), 0, 1);
  // ring pop
  const ringT = clamp01(local / sec(0.45));
  const ringScale = lerp(0.5, 2.6, cubicOut(ringT));
  const ringOp = ci(local, 0, sec(0.08), 0, 0.55) * ci(local, sec(0.08), sec(0.45), 1, 0);
  return (
    <div style={{ ...place(OUT.cx, rowY(i)), width: 0, height: 0 }}>
      <div
        style={{
          position: "absolute",
          left: -34,
          top: -34,
          width: 68,
          height: 68,
          borderRadius: "50%",
          border: `2.5px solid ${col}`,
          transform: `scale(${ringScale.toFixed(2)})`,
          opacity: ringOp,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -OUT.w / 2,
          top: -OUT.h / 2,
          opacity: op,
          width: OUT.w,
          height: OUT.h,
          borderRadius: 12,
          background: `${col}1f`,
          border: `2px solid ${col}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: font,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "0.02em",
          color: col,
          transformOrigin: "center",
          transform: `scale(${s.toFixed(3)})`,
        }}
      >
        {yes ? "YES" : "NO"}
      </div>
    </div>
  );
};

const PoolBox: React.FC<{ op: number }> = ({ op }) => (
  <div
    style={{
      ...place(POOL.cx, POOL.cy),
      opacity: op,
      width: POOL.w,
      height: POOL.h,
      borderRadius: 26,
      ...glass(26),
      border: `2.5px solid ${C.blue}`,
      boxShadow: `0 22px 54px rgba(70,74,140,0.22), 0 0 60px ${C.blue}30, inset 0 1px 0 rgba(255,255,255,0.86)`,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    }}
  >
    <div style={{ fontFamily: font, fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>THE POOL</div>
    <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, color: C.dim }}>{N_TRADERS} traders · 10 lines</div>
    <div style={{ fontFamily: font, fontSize: 30, fontWeight: 800, color: C.blue, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
      ${N_TRADERS * 10 * STAKE_PER_MARKET}
    </div>
  </div>
);

// ── cursor — swoops in on a bezier and clicks the tenth line ──────────────────
const Cursor: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < T.cursorIn[0] - sec(0.2) || frame > CLICK + sec(1.1)) return null;
  const t = cubicOut(ci(frame, T.cursorIn[0], T.cursorIn[1], 0, 1));
  const x = bez(t, 1540, 1300, 1040, CLICK_SX);
  const y = bez(t, 1180, 760, 600, CLICK_SY);
  const sc = frame < CLICK ? ci(frame, CLICK - 2, CLICK, 1, 0.82) : ci(frame, CLICK, CLICK + 5, 0.82, 1);
  const op = Math.min(ci(frame, T.cursorIn[0] - sec(0.2), T.cursorIn[0], 0, 1), ci(frame, CLICK + sec(0.5), CLICK + sec(1.1), 1, 0));
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 34,
        height: 34,
        opacity: op,
        transform: `scale(${sc.toFixed(3)})`,
        transformOrigin: "4px 3px",
        filter: "drop-shadow(0 6px 14px rgba(20,30,80,0.35))",
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      <svg viewBox="0 0 24 24" width={34} height={34}>
        <path d="M4.5 3 L4.5 19 L8.5 15.5 L11 21 L13.4 20 L10.9 14.6 L16.5 14.6 Z" fill="#ffffff" stroke="#0a0a0a" strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </div>
  );
};

// ── click burst — rings, spikes, white core, at the click point ───────────────
const ClickFX: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - CLICK;
  if (local < -1 || local > sec(0.7)) return null;
  const t = ci(frame, CLICK, CLICK + sec(0.4), 0, 1);
  const ringScale = lerp(0.3, 3.4, cubicOut(t));
  const ringOp = ci(local, 0, sec(0.1), 0, 0.6) * ci(local, sec(0.1), sec(0.4), 1, 0);
  const ring2 = lerp(0.2, 2.3, cubicOut(t));
  const ring2Op = ci(local, 0, sec(0.16), 0, 0.42) * ci(local, sec(0.16), sec(0.42), 1, 0);
  const coreOp = ci(local, 0, sec(0.06), 0, 1) * ci(local, sec(0.06), sec(0.3), 1, 0);
  const coreScale = lerp(0.4, 1.7, cubicOut(t));
  const spikeT = cubicOut(clamp01(local / sec(0.34)));
  const spikeOp = ci(local, 0, sec(0.08), 0, 1) * ci(local, sec(0.08), sec(0.42), 1, 0);
  const spikeLen = lerp(0, 74, spikeT);
  const spikeOff = lerp(12, 34, spikeT);
  const spikes = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);
  return (
    <div style={{ position: "absolute", left: CLICK_SX, top: CLICK_SY, width: 0, height: 0, pointerEvents: "none", zIndex: 35 }}>
      <div style={{ position: "absolute", left: -38, top: -38, width: 76, height: 76, borderRadius: "50%", border: `3px solid ${C.blue}`, transform: `scale(${ringScale.toFixed(2)})`, opacity: ringOp }} />
      <div style={{ position: "absolute", left: -30, top: -30, width: 60, height: 60, borderRadius: "50%", border: `2px solid ${C.blue}`, transform: `scale(${ring2.toFixed(2)})`, opacity: ring2Op }} />
      <div
        style={{
          position: "absolute",
          left: -22,
          top: -22,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "radial-gradient(circle, #ffffff 0%, rgba(0,113,227,0.55) 60%, transparent 100%)",
          transform: `scale(${coreScale.toFixed(2)})`,
          opacity: coreOp,
          filter: "blur(2px)",
        }}
      />
      {spikes.map((a, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: Math.cos(a) * spikeOff - spikeLen / 2,
            top: Math.sin(a) * spikeOff - 1.5,
            width: spikeLen,
            height: 3,
            background: C.blue,
            borderRadius: 2,
            transform: `rotate(${(a * 180) / Math.PI}deg)`,
            transformOrigin: "50% 50%",
            opacity: spikeOp,
          }}
        />
      ))}
    </div>
  );
};

// ── the dive graphs (screen-space overlays) ───────────────────────────────────
const CHART_W = 560;
const CHART_H = 232;
const TARGET_Y = 62;
const PTS: [number, number][] = [
  [14, 196],
  [86, 182],
  [158, 188],
  [230, 150],
  [302, 132],
  [376, 96],
  [448, 60],
  [546, 44],
];
const CHART_LEN = (() => {
  let s = 0;
  for (let i = 1; i < PTS.length; i++) s += Math.hypot(PTS[i][0] - PTS[i - 1][0], PTS[i][1] - PTS[i - 1][1]);
  return s;
})();

const PriceChartCard: React.FC<{ draw: number }> = ({ draw }) => {
  const poly = PTS.map((p) => p.join(",")).join(" ");
  const area = `${poly} ${PTS[PTS.length - 1][0]},${CHART_H} 14,${CHART_H}`;
  const last = PTS[PTS.length - 1];
  const dashOff = (1 - clamp01(draw)) * CHART_LEN;
  const crossed = draw > 0.78;
  return (
    <div style={{ width: 612, height: 392, ...glass(22), padding: 26, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", color: C.faint }}>
        {MARKETS[ZOOM_LINE].name.toUpperCase()} · 10 MIN
      </div>
      <svg width={CHART_W} height={CHART_H} style={{ marginTop: 10, overflow: "visible" }}>
        <defs>
          <linearGradient id="sd-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity={0.22} />
            <stop offset="100%" stopColor={C.blue} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#sd-area)" opacity={clamp01(draw * 1.4)} />
        <line x1={0} y1={TARGET_Y} x2={CHART_W} y2={TARGET_Y} stroke={C.up} strokeWidth={2} strokeDasharray="8 7" opacity={0.85} />
        <text x={CHART_W} y={TARGET_Y - 10} textAnchor="end" fontFamily={monoFont} fontSize={20} fontWeight={700} fill={C.up}>
          +2%
        </text>
        <polyline
          points={poly}
          fill="none"
          stroke={C.blue}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={CHART_LEN}
          strokeDashoffset={dashOff}
        />
        <circle cx={last[0]} cy={last[1]} r={7} fill={C.up} stroke="#fff" strokeWidth={2.5} opacity={crossed ? 1 : 0} />
      </svg>
      <div style={{ marginTop: "auto", fontFamily: font, fontSize: 22, fontWeight: 700, color: C.text, opacity: crossed ? 1 : 0.35 }}>
        Above the line — <span style={{ color: C.up, fontWeight: 800 }}>YES wins</span>
      </div>
    </div>
  );
};

const SplitCard: React.FC<{ flow: number }> = ({ flow }) => {
  const win = yesCount(ZOOM_LINE); // 3 backed YES — the winners
  const lose = noCount(ZOOM_LINE); // 2 backed NO — they pay
  const pool = N_TRADERS * STAKE_PER_MARKET; // 5
  const perWinner = pool / win;
  // YES fills from its own stakes up to the whole pool; NO drains to nothing.
  const yesHas = win * STAKE_PER_MARKET + lose * STAKE_PER_MARKET * flow;
  const noHas = lose * STAKE_PER_MARKET * (1 - flow);
  const noDim = 1 - flow * 0.62;
  const glow = 14 + flow * 40;
  return (
    <div style={{ width: 612, height: 392, ...glass(22), padding: 26, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", color: C.faint }}>
        PARIMUTUEL · ${pool} POOL · YES WON
      </div>
      <div style={{ marginTop: 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* YES — receives the whole pool */}
        <div
          style={{
            width: 188,
            height: 150,
            borderRadius: 18,
            background: `${C.up}${flow > 0.5 ? "26" : "18"}`,
            border: `2.5px solid ${C.up}`,
            boxShadow: `0 0 ${glow.toFixed(0)}px ${C.up}66`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.up }}>YES</div>
          <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: C.dim }}>{win} winners</div>
          <div style={{ fontFamily: font, fontSize: 30, fontWeight: 800, color: C.up, fontVariantNumeric: "tabular-nums" }}>${yesHas.toFixed(2)}</div>
          <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: C.up, opacity: clamp01((flow - 0.8) * 5) }}>+${perWinner.toFixed(2)} each</div>
        </div>

        {/* the NO stakes crossing into YES */}
        <svg width={150} height={60} style={{ overflow: "visible" }}>
          <line x1={0} y1={30} x2={150} y2={30} stroke="rgba(60,64,130,0.16)" strokeWidth={2} />
          {[0, 1, 2, 3, 4].map((k) => {
            const phase = (flow * 1.25 + k * 0.2) % 1;
            return <circle key={k} cx={lerp(150, 2, phase)} cy={30} r={5} fill={C.up} opacity={flow > 0.02 && flow < 0.99 ? 0.95 : 0} />;
          })}
          <path d="M 16 22 L 4 30 L 16 38" fill="none" stroke={C.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        {/* NO — drains to zero */}
        <div
          style={{
            width: 188,
            height: 150,
            borderRadius: 18,
            background: `${C.down}10`,
            border: `2px solid ${C.down}66`,
            opacity: noDim,
            filter: `grayscale(${(flow * 0.5).toFixed(2)})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.down }}>NO</div>
          <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, color: C.dim }}>{lose} losers</div>
          <div style={{ fontFamily: font, fontSize: 30, fontWeight: 800, color: C.down, fontVariantNumeric: "tabular-nums" }}>${noHas.toFixed(2)}</div>
        </div>
      </div>
      <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, color: C.text }}>
        <span style={{ color: C.up, fontWeight: 800 }}>YES takes the pool</span> — NO gets nothing
      </div>
    </div>
  );
};

// ── the P&L table ─────────────────────────────────────────────────────────────
const Cell: React.FC<{ value: number; cx: number; cy: number; frame: number; row: number; highlight: boolean; dim: number }> = ({ value, cx, cy, frame, row, highlight, dim }) => {
  const local = frame - (T.tableStart + row * T.tableStep);
  if (local < 0) return null;
  const s = spring({ frame: local, fps: FPS, config: { damping: 14, stiffness: 160, mass: 0.6 } });
  const pos = value > 0.001;
  const col = pos ? C.up : C.down;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%, calc(-50% + ${lerp(10, 0, s).toFixed(1)}px)) scale(${lerp(0.9, 1, s).toFixed(3)})`,
        opacity: clamp01(s * 1.4) * (pos ? 1 : 0.72) * dim,
        fontFamily: monoFont,
        fontSize: 18,
        fontWeight: highlight ? 800 : 600,
        color: col,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {pos ? "+" : "−"}${Math.abs(value).toFixed(2)}
    </div>
  );
};

export const SettleDiagram: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);

  // click punch + shake — the camera lands when the cursor hits the tenth line
  const punch = ci(frame, CLICK - 1, CLICK + 3, 1, 1.05) * ci(frame, CLICK + 3, CLICK + sec(0.5), 1, 1 / 1.05);
  const sd = frame - CLICK;
  const shakeAmp = ci(sd, 0, 1, 0, 15) * ci(sd, 1, 8, 1, 0);
  const shakeX = Math.sin(sd * 16.5) * shakeAmp;
  const shakeY = Math.cos(sd * 21.3) * shakeAmp * 0.6;
  const eff = cam.scale * punch;
  const tx = W / 2 - cam.cx * eff + shakeX;
  const ty = H / 2 - cam.cy * eff + shakeY;

  const poolOp = ci(frame, T.poolIn[0], T.poolIn[1], 0, 1, EASE.out);
  const resolveReveal = (i: number): number =>
    ci(frame, T.resolveStart + i * T.resolveStep, T.resolveStart + i * T.resolveStep + T.resolveDur, 0, 1, EASE.out);
  const busProg = clamp01((frame - T.ledgerStart) / (T.ledgerStep * 9 + T.ledgerDur * 0.4));

  const chartDraw = ci(frame, T.chartDraw[0], T.chartDraw[1], 0, 1, EASE.inOut);
  const splitFlow = ci(frame, T.splitFlow[0], T.splitFlow[1], 0, 1);
  // both graphs live on the board from the click; the camera travels to each.
  const graphsOp = Math.min(ci(frame, CLICK, CLICK + sec(0.5), 0, 1), ci(frame, T.graphsOut[0], T.graphsOut[1], 1, 0));
  const chartOp = graphsOp * ci(frame, CLICK + sec(0.1), CLICK + sec(0.6), 0, 1, EASE.out);
  const splitOp = graphsOp * ci(frame, T.splitTravel[0] - sec(0.3), T.splitTravel[0] + sec(0.3), 0, 1, EASE.out);

  const tableAppear = ci(frame, T.panTable[0], T.panTable[1], 0, 1, EASE.out);
  const totalsReveal = ci(frame, T.totals[0], T.totals[1], 0, 1, EASE.out);
  const isolate = ci(frame, T.isolate[0], T.isolate[1], 0, 1, EASE.inOut);
  const othersDim = 1 - isolate * 0.86; // fade every trader but You at the close
  const youPulse = ci(frame, T.youPulse[0], (T.youPulse[0] + T.youPulse[1]) / 2, 0, 1) * ci(frame, (T.youPulse[0] + T.youPulse[1]) / 2, T.youPulse[1], 1, 0);

  const tagOp = ci(frame, sec(0.2), sec(0.8), 0, 1) * (1 - ci(frame, T.diveIn[0], T.diveIn[1], 0, 1)) + ci(frame, T.pullBack[0], T.pullBack[1], 0, 1) * (1 - isolate);

  return (
    <AbsoluteFill style={{ background: FIELD_BG, fontFamily: font }}>
      {/* a still top-light for depth — the board is lit, not flat */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 90% at 50% -10%, rgba(0,113,227,0.10) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />
      <BrandMark surface="light" />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BW,
          height: BH,
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${eff.toFixed(5)})`,
          transformOrigin: "0 0",
          willChange: "transform",
          background: FIELD_BG,
          backgroundImage: "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      >
        {/* connectors */}
        <svg width={BW} height={BH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <defs>
            <marker id="sd-arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M1,1 L8,5 L1,9" fill="none" stroke="rgba(0,113,227,0.42)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          <path d={`M ${POOL.cx + POOL.w / 2} ${POOL.cy} H ${BUS_X}`} stroke="rgba(0,113,227,0.42)" strokeWidth={2.5} fill="none" opacity={poolOp} />
          <line x1={BUS_X} y1={rowY(0)} x2={BUS_X} y2={lerp(rowY(0), rowY(9), busProg)} stroke="rgba(0,113,227,0.42)" strokeWidth={2.5} />
          {MARKETS.map((_m, i) => {
            const e = ci(frame, T.ledgerStart + i * T.ledgerStep, T.ledgerStart + i * T.ledgerStep + sec(0.3), 0, 1);
            return <path key={`b${i}`} d={`M ${BUS_X} ${rowY(i)} H ${LEDGER_L - 8}`} stroke="rgba(0,113,227,0.42)" strokeWidth={2} fill="none" markerEnd="url(#sd-arrow)" opacity={e} />;
          })}
          {MARKETS.map((_m, i) => (
            <path key={`o${i}`} d={`M ${LEDGER_R} ${rowY(i)} H ${OUT_L - 8}`} stroke="rgba(0,113,227,0.42)" strokeWidth={2} fill="none" markerEnd="url(#sd-arrow)" opacity={resolveReveal(i)} />
          ))}
          {MARKETS.map((_m, i) => (
            <path key={`p${i}`} d={`M ${OUT_R} ${rowY(i)} H ${TABLE.x0 - 12}`} stroke="rgba(0,113,227,0.42)" strokeWidth={1.6} fill="none" markerEnd="url(#sd-arrow)" opacity={Math.min(resolveReveal(i), tableAppear)} />
          ))}
        </svg>

        <SectionTag cx={POOL.cx} y={POOL.cy - POOL.h / 2 - 34} text="THE POOL" op={Math.min(poolOp, tagOp)} />
        <SectionTag cx={LEDGER.cx} y={LTOP - 44} text="TEN MARKETS" op={tagOp} />
        <SectionTag cx={OUT.cx} y={LTOP - 44} text="OUTCOME" op={Math.min(resolveReveal(0), tagOp)} />
        <SectionTag cx={TABLE_CX} y={HEADER_Y - 76} text="EVERY TRADER · P&L" op={tableAppear} />

        <PoolBox op={poolOp} />
        {MARKETS.map((_m, i) => (
          <React.Fragment key={`row${i}`}>
            <LedgerBox i={i} frame={frame} focused={i === ZOOM_LINE} />
            <OutcomeChip i={i} frame={frame} />
          </React.Fragment>
        ))}

        {/* P&L table — board space */}
        {tableAppear > 0.01 && (
          <>
            <div
              style={{
                position: "absolute",
                left: colCx(0) - COL_W / 2,
                top: HEADER_Y - 56,
                width: COL_W,
                height: TOTAL_Y + 44 - (HEADER_Y - 56),
                borderRadius: 16,
                background: `${C.blue}0e`,
                border: `1px solid ${C.blue}33`,
                opacity: tableAppear,
              }}
            />
            {/* light behind your winning total */}
            <Bloom x={colCx(0)} y={TOTAL_Y} r={130} color={`${C.up}55`} op={totalsReveal * (0.5 + 0.5 * youPulse)} />
            {TRADER_NAMES.map((name, t) => (
              <div key={`h${t}`} style={{ ...place(colCx(t), HEADER_Y), opacity: tableAppear * (t === 0 ? 1 : othersDim), display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <PersonIcon size={42} accent={TRADER_COLORS[t]} />
                <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: t === 0 ? C.blue : C.dim, whiteSpace: "nowrap" }}>
                  {t === 0 ? "You" : name}
                </div>
              </div>
            ))}
            {MARKETS.map((_m, i) =>
              TRADER_NAMES.map((_n, t) => (
                <Cell key={`c${i}-${t}`} value={traderNetOnLine(i, t)} cx={colCx(t)} cy={rowY(i)} frame={frame} row={i} highlight={t === 0} dim={t === 0 ? 1 : othersDim} />
              )),
            )}
            <div style={{ position: "absolute", left: TABLE.x0, top: TOTAL_Y - 32, width: TABLE.w, height: 2, background: "rgba(60,64,130,0.18)", opacity: totalsReveal }} />
            <div style={{ ...place(TABLE.x0 - 96, TOTAL_Y), opacity: totalsReveal, fontFamily: monoFont, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: C.faint }}>
              TOTAL
            </div>
            {TRADER_NAMES.map((_n, t) => {
              const net = traderNet(t);
              const pos = net > 0.001;
              const col = pos ? C.up : C.down;
              const isYou = t === 0;
              const ls = spring({ frame: frame - T.totals[0] - t * sec(0.06), fps: FPS, config: { damping: 13, stiffness: 150, mass: 0.6 } });
              const sc = (isYou ? 1 + 0.12 * youPulse : 1) * lerp(0.7, 1, clamp01(ls));
              return (
                <div
                  key={`t${t}`}
                  style={{
                    position: "absolute",
                    left: colCx(t),
                    top: TOTAL_Y,
                    transform: `translate(-50%,-50%) scale(${sc.toFixed(3)})`,
                    opacity: clamp01(ls * 1.4) * (isYou ? 1 : othersDim),
                    fontFamily: font,
                    fontSize: isYou ? 30 : 24,
                    fontWeight: 800,
                    color: col,
                    fontVariantNumeric: "tabular-nums",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pos ? "+" : "−"}${Math.abs(net).toFixed(2)}
                </div>
              );
            })}
          </>
        )}

        {/* the dive graphs — on the board, in the space the table later fills;
            the camera climbs to the chart, then drops to the payout */}
        {graphsOp > 0.01 && (
          <>
            <Bloom x={CHART_POS.cx} y={CHART_POS.cy} r={400} color={`${C.blue}24`} op={chartOp} />
            <Bloom x={SPLIT_POS.cx} y={SPLIT_POS.cy} r={400} color={`${C.up}1f`} op={splitOp} />
            <div style={{ ...place(CHART_POS.cx, CHART_POS.cy), opacity: chartOp }}>
              <PriceChartCard draw={chartDraw} />
            </div>
            <div style={{ ...place(SPLIT_POS.cx, SPLIT_POS.cy), opacity: splitOp }}>
              <SplitCard flow={splitFlow} />
            </div>
          </>
        )}
      </div>

      {/* cursor + its click burst — screen space */}
      <Cursor />
      <ClickFX />
    </AbsoluteFill>
  );
};

export const settleDiagramMeta = {
  id: "BatchSettleDiagram",
  component: SettleDiagram,
  durationInFrames: TOTAL,
  fps: FPS,
  width: W,
  height: H,
};
