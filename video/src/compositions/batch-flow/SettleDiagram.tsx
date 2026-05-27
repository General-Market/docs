import React from "react";
import { AbsoluteFill } from "remotion";
import { FIELD_BG } from "./chrome";
import { BrandMark } from "../../components/BrandMark";
import { C, font, FPS, H, monoFont, W } from "./theme";
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

// ── BatchSettleDiagram — the STATIC master ────────────────────────────────────
// The whole back half of the reel as one drawn board, every element in place,
// nothing moving. This is the map we agree on before any of it is animated.
//   POOL  →  the ten markets, stacked in a balance (vote split per line)
//         →  each line lands YES or NO
//         →  every trader's P&L, line by line, summed to a final number.
// How a single line RESOLVES — the price crossing its target, the parimutuel
// paying out — is NOT drawn here. That is a zoom-in beat on the tenth market,
// and those graphs only appear in the animation when the camera dives into it.
// Pastel-glass world, blue dot lattice — the same surface as the rest of the reel.

const TRADER_COLORS = ["#0071E3", "#FF7A59", "#7B5CFF", "#17B0A6", "#FF6FB5"];
const ZOOM_LINE = 9; // the tenth market — where the reel zooms in

// up = YES (price above the line); down = NO.
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
const LEDGER_R = LEDGER.cx + LEDGER.w / 2;
const OUT = { cx: 1086, w: 128, h: 50 };
const OUT_L = OUT.cx - OUT.w / 2;
const OUT_R = OUT.cx + OUT.w / 2;
const TABLE = { x0: 1252, w: 668 };
const COL_W = TABLE.w / N_TRADERS;
const colCx = (t: number): number => TABLE.x0 + t * COL_W + COL_W / 2;
const TABLE_CX = TABLE.x0 + TABLE.w / 2;

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
const SectionTag: React.FC<{ cx: number; y: number; text: string }> = ({ cx, y, text }) => (
  <div
    style={{
      ...place(cx, y),
      fontFamily: monoFont,
      fontSize: 18,
      fontWeight: 700,
      letterSpacing: "0.14em",
      color: C.faint,
      whiteSpace: "nowrap",
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

const LedgerBox: React.FC<{ i: number; focused: boolean }> = ({ i, focused }) => {
  const m = MARKETS[i];
  return (
    <div
      style={{
        ...place(LEDGER.cx, rowY(i)),
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

const OutcomeChip: React.FC<{ i: number; focused: boolean }> = ({ i, focused }) => {
  const yes = isYes(i);
  const col = yes ? C.up : C.down;
  return (
    <div
      style={{
        ...place(OUT.cx, rowY(i)),
        width: OUT.w,
        height: OUT.h,
        borderRadius: 12,
        background: `${col}1f`,
        border: `2px solid ${focused ? col : col + "88"}`,
        boxShadow: focused ? `0 0 24px ${col}55` : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: 22,
        fontWeight: 800,
        letterSpacing: "0.02em",
        color: col,
      }}
    >
      {yes ? "YES" : "NO"}
    </div>
  );
};

const PoolBox: React.FC = () => (
  <div
    style={{
      ...place(POOL.cx, POOL.cy),
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
    <div style={{ fontFamily: font, fontSize: 40, fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>
      THE POOL
    </div>
    <div style={{ fontFamily: monoFont, fontSize: 19, fontWeight: 700, color: C.dim }}>
      {N_TRADERS} traders · 10 lines
    </div>
    <div
      style={{
        fontFamily: font,
        fontSize: 30,
        fontWeight: 800,
        color: C.blue,
        fontVariantNumeric: "tabular-nums",
        marginTop: 4,
      }}
    >
      ${N_TRADERS * 10 * STAKE_PER_MARKET}
    </div>
  </div>
);

// ── the P&L table — every trader, every line, summed ──────────────────────────
const Cell: React.FC<{ value: number; cx: number; cy: number; highlight: boolean }> = ({ value, cx, cy, highlight }) => {
  const pos = value > 0.001;
  const col = pos ? C.up : C.down;
  return (
    <div
      style={{
        ...place(cx, cy),
        fontFamily: monoFont,
        fontSize: 18,
        fontWeight: highlight ? 800 : 600,
        color: col,
        fontVariantNumeric: "tabular-nums",
        opacity: pos ? 1 : 0.72,
      }}
    >
      {pos ? "+" : "−"}${Math.abs(value).toFixed(2)}
    </div>
  );
};

const PnlTable: React.FC = () => (
  <>
    {/* You-column highlight band */}
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
      }}
    />

    {/* header — trader glyphs + names */}
    {TRADER_NAMES.map((name, t) => (
      <div key={`h${t}`} style={{ ...place(colCx(t), HEADER_Y), display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
        <PersonIcon size={42} accent={TRADER_COLORS[t]} />
        <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: t === 0 ? C.blue : C.dim, whiteSpace: "nowrap" }}>
          {t === 0 ? "You" : name}
        </div>
      </div>
    ))}

    {/* cells */}
    {MARKETS.map((_m, i) =>
      TRADER_NAMES.map((_n, t) => (
        <Cell key={`c${i}-${t}`} value={traderNetOnLine(i, t)} cx={colCx(t)} cy={rowY(i)} highlight={t === 0} />
      )),
    )}

    {/* rule above totals */}
    <div
      style={{
        position: "absolute",
        left: TABLE.x0,
        top: TOTAL_Y - 32,
        width: TABLE.w,
        height: 2,
        background: "rgba(60,64,130,0.18)",
      }}
    />
    <div style={{ ...place(TABLE.x0 - 96, TOTAL_Y), fontFamily: monoFont, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: C.faint }}>
      TOTAL
    </div>
    {TRADER_NAMES.map((_n, t) => {
      const net = traderNet(t);
      const pos = net > 0.001;
      const col = pos ? C.up : C.down;
      return (
        <div
          key={`t${t}`}
          style={{
            ...place(colCx(t), TOTAL_Y),
            fontFamily: font,
            fontSize: t === 0 ? 30 : 24,
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
);

// ── connectors — pool bus, line arrows ────────────────────────────────────────
const ARROW = "rgba(0,113,227,0.42)";
const Connectors: React.FC = () => (
  <svg width={BW} height={BH} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
    <defs>
      <marker id="sd-arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto" markerUnits="userSpaceOnUse">
        <path d="M1,1 L8,5 L1,9" fill="none" stroke={ARROW} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </marker>
    </defs>

    {/* pool → vertical bus */}
    <path d={`M ${POOL.cx + POOL.w / 2} ${POOL.cy} H ${BUS_X}`} stroke={ARROW} strokeWidth={2.5} fill="none" />
    <line x1={BUS_X} y1={rowY(0)} x2={BUS_X} y2={rowY(9)} stroke={ARROW} strokeWidth={2.5} />
    {/* bus → each ledger box */}
    {MARKETS.map((_m, i) => (
      <path
        key={`b${i}`}
        d={`M ${BUS_X} ${rowY(i)} H ${LEDGER.cx - LEDGER.w / 2 - 8}`}
        stroke={ARROW}
        strokeWidth={2}
        fill="none"
        markerEnd="url(#sd-arrow)"
      />
    ))}
    {/* ledger box → outcome chip */}
    {MARKETS.map((_m, i) => (
      <path
        key={`o${i}`}
        d={`M ${LEDGER_R} ${rowY(i)} H ${OUT_L - 8}`}
        stroke={ARROW}
        strokeWidth={2}
        fill="none"
        markerEnd="url(#sd-arrow)"
      />
    ))}
    {/* outcome → P&L row */}
    {MARKETS.map((_m, i) => (
      <path
        key={`p${i}`}
        d={`M ${OUT_R} ${rowY(i)} H ${TABLE.x0 - 12}`}
        stroke={ARROW}
        strokeWidth={1.6}
        fill="none"
        markerEnd="url(#sd-arrow)"
      />
    ))}
  </svg>
);

export const SettleDiagram: React.FC = () => {
  // fit the whole board into the 1920×1080 viewport (show everything)
  const scale = W / BW;
  const ty = (H - BH * scale) / 2;
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
          transform: `translate(0px, ${ty.toFixed(1)}px) scale(${scale.toFixed(5)})`,
          transformOrigin: "0 0",
          background: FIELD_BG,
          backgroundImage: "radial-gradient(circle, rgba(0,113,227,0.22) 1.2px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      >
        <Connectors />

        <SectionTag cx={POOL.cx} y={POOL.cy - POOL.h / 2 - 34} text="THE POOL" />
        <SectionTag cx={LEDGER.cx} y={LTOP - 44} text="TEN MARKETS" />
        <SectionTag cx={OUT.cx} y={LTOP - 44} text="OUTCOME" />
        <SectionTag cx={TABLE_CX} y={HEADER_Y - 76} text="EVERY TRADER · P&L" />

        <PoolBox />
        {MARKETS.map((_m, i) => (
          <React.Fragment key={`row${i}`}>
            <LedgerBox i={i} focused={i === ZOOM_LINE} />
            <OutcomeChip i={i} focused={i === ZOOM_LINE} />
          </React.Fragment>
        ))}

        {/* the tenth line is where the reel zooms in (its graphs appear there,
            in the animation only) */}
        <div
          style={{
            ...place(LEDGER.cx, rowY(ZOOM_LINE) + ROW_H / 2 + 22),
            fontFamily: monoFont,
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: C.blue,
            whiteSpace: "nowrap",
          }}
        >
          ▸ the reel zooms into this line
        </div>

        <PnlTable />
      </div>
    </AbsoluteFill>
  );
};

export const settleDiagramMeta = {
  id: "BatchSettleDiagram",
  component: SettleDiagram,
  durationInFrames: FPS * 2,
  fps: FPS,
  width: W,
  height: H,
};
