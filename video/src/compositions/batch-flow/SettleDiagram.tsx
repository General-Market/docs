import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
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
//   1. the balance UNFOLDS — the ten markets drop out of the pool, line by line;
//   2. the camera DIVES into the tenth line — a price crosses its target (YES
//      wins) and the parimutuel pays: the losers fund the winners;
//   3. it PULLS BACK and every line lands YES or NO at once;
//   4. it pans to the ledger, which FILLS — each line's number written across
//      the five traders, the columns summed, your total settling last at +$4.17.
// One surface, morphing — never a cut. Pastel-glass world, blue dot lattice.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const ci = (frame: number, a: number, b: number, from: number, to: number, easing?: (t: number) => number): number =>
  interpolate(frame, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });

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

// ── timeline (frames @60) ─────────────────────────────────────────────────────
const T = {
  poolIn: [0, sec(0.6)] as [number, number],
  ledgerStart: sec(0.7),
  ledgerStep: sec(0.16),
  ledgerDur: sec(0.7),
  holdA: sec(4.2),
  diveIn: [sec(4.4), sec(6.2)] as [number, number], // camera pushes into line 10
  chartIn: [sec(6.2), sec(7.0)] as [number, number],
  chartDraw: [sec(6.4), sec(8.6)] as [number, number],
  splitIn: [sec(8.6), sec(9.4)] as [number, number],
  splitFlow: [sec(9.4), sec(11.0)] as [number, number],
  graphsOut: [sec(11.6), sec(12.2)] as [number, number],
  pullBack: [sec(12.0), sec(13.4)] as [number, number],
  resolveStart: sec(13.2),
  resolveStep: sec(0.14),
  resolveDur: sec(0.42),
  panTable: [sec(15.6), sec(17.0)] as [number, number],
  tableStart: sec(17.0),
  tableStep: sec(0.18),
  tableDur: sec(0.4),
  totals: [sec(20.6), sec(21.6)] as [number, number],
  youPulse: [sec(21.6), sec(22.4)] as [number, number],
};
const TOTAL = sec(24.0);

// ── internal camera — keyframed glide over the board ──────────────────────────
const CAM = Easing.bezier(0.5, 0, 0.2, 1);
type Key = { at: number; cx: number; cy: number; scale: number };
const KEYS: Key[] = [
  { at: 0, cx: 560, cy: 540, scale: 1.2 },
  { at: T.holdA, cx: 560, cy: 540, scale: 1.2 },
  { at: T.diveIn[1], cx: 1000, cy: rowY(ZOOM_LINE), scale: 1.92 }, // line 10 sits left, graphs fill right
  { at: T.graphsOut[0], cx: 1000, cy: rowY(ZOOM_LINE), scale: 1.92 },
  { at: T.pullBack[1], cx: 700, cy: 540, scale: 1.16 },
  { at: T.panTable[0], cx: 700, cy: 540, scale: 1.16 },
  { at: T.panTable[1], cx: TABLE_CX - 120, cy: 540, scale: 1.02 },
  { at: TOTAL, cx: TABLE_CX - 120, cy: 540, scale: 1.02 },
];

const camera = (frame: number): { cx: number; cy: number; scale: number } => {
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

const LedgerBox: React.FC<{ i: number; reveal: number; focused: boolean }> = ({ i, reveal, focused }) => {
  const m = MARKETS[i];
  const dx = lerp(-34, 0, reveal);
  return (
    <div
      style={{
        position: "absolute",
        left: LEDGER.cx,
        top: rowY(i),
        transform: `translate(calc(-50% + ${dx.toFixed(1)}px), -50%)`,
        opacity: reveal,
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

const OutcomeChip: React.FC<{ i: number; reveal: number }> = ({ i, reveal }) => {
  const yes = isYes(i);
  const col = yes ? C.up : C.down;
  const flip = lerp(0.6, 1, reveal);
  return (
    <div
      style={{
        ...place(OUT.cx, rowY(i)),
        opacity: reveal,
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
        transform: `translate(-50%,-50%) scale(${flip.toFixed(3)})`,
      }}
    >
      {yes ? "YES" : "NO"}
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
  const win = yesCount(ZOOM_LINE);
  const lose = noCount(ZOOM_LINE);
  const perWinner = (N_TRADERS * STAKE_PER_MARKET) / win;
  return (
    <div style={{ width: 612, height: 392, ...glass(22), padding: 26, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", color: C.faint }}>
        PARIMUTUEL · ${N_TRADERS * STAKE_PER_MARKET} POOL
      </div>
      <div style={{ marginTop: 14, flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            width: 178,
            height: 138,
            borderRadius: 18,
            background: `${C.up}18`,
            border: `2px solid ${C.up}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.up }}>YES</div>
          <div style={{ fontFamily: monoFont, fontSize: 17, fontWeight: 700, color: C.dim }}>{win} winners</div>
          <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.up, fontVariantNumeric: "tabular-nums" }}>+${perWinner.toFixed(2)}</div>
        </div>

        <svg width={180} height={60} style={{ overflow: "visible" }}>
          <line x1={0} y1={30} x2={180} y2={30} stroke="rgba(60,64,130,0.18)" strokeWidth={2} />
          {[0, 1, 2, 3].map((k) => {
            const phase = (flow * 1.3 + k * 0.25) % 1;
            return <circle key={k} cx={lerp(180, 6, phase)} cy={30} r={5} fill={C.up} opacity={0.9} />;
          })}
          <path d="M 18 22 L 6 30 L 18 38" fill="none" stroke={C.up} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <div
          style={{
            width: 178,
            height: 138,
            borderRadius: 18,
            background: `${C.down}14`,
            border: `2px solid ${C.down}88`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.down }}>NO</div>
          <div style={{ fontFamily: monoFont, fontSize: 17, fontWeight: 700, color: C.dim }}>{lose} losers</div>
          <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.down, fontVariantNumeric: "tabular-nums" }}>−${(lose * STAKE_PER_MARKET).toFixed(2)}</div>
        </div>
      </div>
      <div style={{ fontFamily: font, fontSize: 21, fontWeight: 700, color: C.text }}>
        The losers <span style={{ color: C.down, fontWeight: 800 }}>pay</span> the winners
      </div>
    </div>
  );
};

// ── the P&L table ─────────────────────────────────────────────────────────────
const Cell: React.FC<{ value: number; cx: number; cy: number; reveal: number; highlight: boolean }> = ({ value, cx, cy, reveal, highlight }) => {
  const pos = value > 0.001;
  const col = pos ? C.up : C.down;
  return (
    <div
      style={{
        ...place(cx, cy),
        opacity: reveal * (pos ? 1 : 0.72),
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
  const { cx, cy, scale } = camera(frame);
  const tx = W / 2 - cx * scale;
  const ty = H / 2 - cy * scale;

  const poolOp = ci(frame, T.poolIn[0], T.poolIn[1], 0, 1, EASE.out);
  const ledgerReveal = (i: number): number =>
    ci(frame, T.ledgerStart + i * T.ledgerStep, T.ledgerStart + i * T.ledgerStep + T.ledgerDur, 0, 1, EASE.out);
  const resolveReveal = (i: number): number =>
    ci(frame, T.resolveStart + i * T.resolveStep, T.resolveStart + i * T.resolveStep + T.resolveDur, 0, 1, EASE.out);
  const cellReveal = (i: number): number =>
    ci(frame, T.tableStart + i * T.tableStep, T.tableStart + i * T.tableStep + T.tableDur, 0, 1, EASE.out);

  const chartDraw = ci(frame, T.chartDraw[0], T.chartDraw[1], 0, 1, EASE.inOut);
  const splitFlow = ci(frame, T.splitFlow[0], T.splitFlow[1], 0, 1);
  const graphsOp = Math.min(
    ci(frame, T.chartIn[0], T.chartIn[1], 0, 1),
    ci(frame, T.graphsOut[0], T.graphsOut[1], 1, 0),
  );
  const chartIn = ci(frame, T.chartIn[0], T.chartIn[1], 0, 1, EASE.out);
  const splitIn = ci(frame, T.splitIn[0], T.splitIn[1], 0, 1, EASE.out);

  const tableAppear = ci(frame, T.panTable[0], T.panTable[1], 0, 1, EASE.out);
  const totalsReveal = ci(frame, T.totals[0], T.totals[1], 0, 1, EASE.out);
  const youPulse = ci(frame, T.youPulse[0], (T.youPulse[0] + T.youPulse[1]) / 2, 0, 1) * ci(frame, (T.youPulse[0] + T.youPulse[1]) / 2, T.youPulse[1], 1, 0);

  const tagOp = ci(frame, sec(0.2), sec(0.8), 0, 1) * (1 - ci(frame, T.diveIn[0], T.diveIn[1], 0, 1)) + ci(frame, T.pullBack[0], T.pullBack[1], 0, 1);

  return (
    <AbsoluteFill style={{ background: FIELD_BG, fontFamily: font }}>
      <BrandMark surface="light" />
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: BW,
          height: BH,
          transform: `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${scale.toFixed(5)})`,
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
          <line x1={BUS_X} y1={rowY(0)} x2={BUS_X} y2={lerp(rowY(0), rowY(9), Math.max(...MARKETS.map((_m, i) => ledgerReveal(i) > 0.05 ? i / 9 : 0)))} stroke="rgba(0,113,227,0.42)" strokeWidth={2.5} />
          {MARKETS.map((_m, i) => {
            const e = ledgerReveal(i);
            return (
              <path key={`b${i}`} d={`M ${BUS_X} ${rowY(i)} H ${LEDGER_L - 8}`} stroke="rgba(0,113,227,0.42)" strokeWidth={2} fill="none" markerEnd="url(#sd-arrow)" opacity={e} />
            );
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
            <LedgerBox i={i} reveal={ledgerReveal(i)} focused={i === ZOOM_LINE} />
            {resolveReveal(i) > 0.01 && <OutcomeChip i={i} reveal={resolveReveal(i)} />}
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
                opacity: tableAppear * (0.6 + 0.4 * youPulse + (youPulse > 0 ? 0 : 0)),
              }}
            />
            {TRADER_NAMES.map((name, t) => (
              <div key={`h${t}`} style={{ ...place(colCx(t), HEADER_Y), opacity: tableAppear, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                <PersonIcon size={42} accent={TRADER_COLORS[t]} />
                <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: t === 0 ? C.blue : C.dim, whiteSpace: "nowrap" }}>
                  {t === 0 ? "You" : name}
                </div>
              </div>
            ))}
            {MARKETS.map((_m, i) =>
              TRADER_NAMES.map((_n, t) => (
                <Cell key={`c${i}-${t}`} value={traderNetOnLine(i, t)} cx={colCx(t)} cy={rowY(i)} reveal={cellReveal(i)} highlight={t === 0} />
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
              const sc = isYou ? 1 + 0.12 * youPulse : 1;
              return (
                <div
                  key={`t${t}`}
                  style={{
                    position: "absolute",
                    left: colCx(t),
                    top: TOTAL_Y,
                    transform: `translate(-50%,-50%) scale(${sc.toFixed(3)})`,
                    opacity: totalsReveal,
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
      </div>

      {/* the dive graphs — screen-space overlays, stacked on the right ───────── */}
      {graphsOp > 0.01 && (
        <>
          <div
            style={{
              position: "absolute",
              right: 80,
              top: 96,
              opacity: graphsOp * chartIn,
              transform: `translateY(${lerp(28, 0, chartIn).toFixed(1)}px)`,
            }}
          >
            <PriceChartCard draw={chartDraw} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 80,
              top: 560,
              opacity: graphsOp * splitIn,
              transform: `translateY(${lerp(28, 0, splitIn).toFixed(1)}px)`,
            }}
          >
            <SplitCard flow={splitFlow} />
          </div>
        </>
      )}
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
