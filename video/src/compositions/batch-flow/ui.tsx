import React from "react";
import { C, EASE, font, monoFont, PILL_GRADIENT } from "./theme";
import { glassCard, glassPanel } from "./chrome";
import { MARKETS, type Market } from "./data";

// A faithful-but-clean rebuild of the product dashboard from the screenshot,
// dressed in the frosted-glass language: header, candle chart, the TOP-10 grid
// of UP/DOWN cards, the round panel and the stake/confirm panel. Selection +
// cursor are driven by props so the beats can animate picking ten outcomes and
// confirming.

// ── Geometry (composition space, 1920×1080) ──────────────────────────────────
export const GRID_X0 = 24;
export const GRID_Y0 = 506;
export const CARD_W = 278;
export const CARD_H = 206;
export const GAP = 16;
export const ROW_GAP = 16;
export const COLS = 5;

export const cardOrigin = (index: number): { x: number; y: number } => {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return {
    x: GRID_X0 + col * (CARD_W + GAP),
    y: GRID_Y0 + row * (CARD_H + ROW_GAP),
  };
};

export const cardButtonPos = (index: number, side: "up" | "down"): { x: number; y: number } => {
  const o = cardOrigin(index);
  return {
    x: o.x + (side === "up" ? CARD_W * 0.305 : CARD_W * 0.695),
    y: o.y + CARD_H - 30,
  };
};

export const CONFIRM_POS = { x: 1698, y: 512 };

// ── seeded sparkline ─────────────────────────────────────────────────────────
const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const Sparkline: React.FC<{ seed: number; up: boolean; w: number; h: number }> = ({ seed, up, w, h }) => {
  const rnd = mulberry32(seed);
  const n = 34;
  const pad = 6;
  const openFrac = 0.52;
  let v = openFrac;
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    v += (rnd() - 0.5) * 0.16;
    const drift = (up ? 1 : -1) * (i / n) * 0.34;
    ys.push(Math.max(0.08, Math.min(0.92, openFrac + (v - openFrac) + drift)));
  }
  const color = up ? C.up : C.down;
  const pts = ys
    .map((y, i) => `${(pad + (i / (n - 1)) * (w - pad * 2)).toFixed(1)},${(pad + (1 - y) * (h - pad * 2)).toFixed(1)}`)
    .join(" ");
  const openY = pad + (1 - openFrac) * (h - pad * 2);
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <line x1={pad} y1={openY} x2={w - pad} y2={openY} stroke="rgba(60,64,130,0.26)" strokeWidth={1} strokeDasharray="4 4" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// ── market card ───────────────────────────────────────────────────────────
const PickButton: React.FC<{ side: "up" | "down"; picked: boolean }> = ({ side, picked }) => {
  const isUp = side === "up";
  const color = isUp ? C.up : C.down;
  return (
    <div
      style={{
        flex: 1,
        height: 40,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        fontFamily: font,
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: "0.02em",
        background: picked ? color : "rgba(255,255,255,0.45)",
        color: picked ? "#FFFFFF" : C.dim,
        border: `1.5px solid ${picked ? color : "rgba(255,255,255,0.7)"}`,
        boxShadow: picked
          ? `0 8px 20px ${color}55, inset 0 1px 0 rgba(255,255,255,0.4)`
          : "inset 0 1px 0 rgba(255,255,255,0.7)",
      }}
    >
      <span style={{ fontSize: 15 }}>{isUp ? "▲" : "▼"}</span>
      {isUp ? "UP" : "DOWN"}
    </div>
  );
};

export const MarketCard: React.FC<{
  market: Market;
  index: number;
  picked: "up" | "down" | null;
  active: boolean;
}> = ({ market, picked, active }) => {
  const trendUp = market.seed % 2 === 0;
  return (
    <div
      style={{
        ...glassCard(16),
        width: CARD_W,
        height: CARD_H,
        border: active ? `2px solid ${C.blue}` : "1px solid rgba(255,255,255,0.6)",
        boxShadow: active
          ? `0 14px 36px ${C.blue}3D, inset 0 1px 0 rgba(255,255,255,0.85)`
          : "0 8px 24px rgba(70,74,140,0.13), inset 0 1px 0 rgba(255,255,255,0.82)",
        padding: "14px 16px 14px",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: font,
            fontSize: 15,
            fontWeight: 800,
            color: C.text,
          }}
        >
          {market.id}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: font,
              fontSize: 17,
              fontWeight: 700,
              color: C.text,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {market.name}
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 600, color: C.dim }}>
            ${market.price.toFixed(2)}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, marginTop: 8, marginBottom: 10 }}>
        <Sparkline seed={market.seed} up={trendUp} w={CARD_W - 32} h={72} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <PickButton side="up" picked={picked === "up"} />
        <PickButton side="down" picked={picked === "down"} />
      </div>
    </div>
  );
};

// ── header ────────────────────────────────────────────────────────────────
const Header: React.FC = () => (
  <div
    style={{
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 64,
      display: "flex",
      alignItems: "center",
      padding: "0 36px",
      borderBottom: "1px solid rgba(255,255,255,0.5)",
      background: "rgba(255,255,255,0.34)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
    }}
  >
    <div
      style={{
        width: 30,
        height: 30,
        borderRadius: 9,
        background: "linear-gradient(150deg, #1FB877, #0E9E63)",
        marginRight: 12,
        boxShadow: "0 4px 12px rgba(31,184,119,0.4)",
      }}
    />
    <div style={{ fontFamily: font, fontSize: 21, fontWeight: 800, color: C.text }}>Pump.fun Tokens</div>
    <div style={{ display: "flex", gap: 28, marginLeft: 44, fontFamily: font, fontSize: 17, fontWeight: 600 }}>
      {["Overview", "Markets", "Activity", "Leaderboard", "Vault"].map((t, i) => (
        <div key={t} style={{ color: i === 0 ? C.text : C.dim }}>
          {t}
        </div>
      ))}
    </div>
    <div style={{ marginLeft: "auto", fontFamily: monoFont, fontSize: 19, fontWeight: 700, color: C.text }}>$0.64</div>
  </div>
);

// ── big candle chart ──────────────────────────────────────────────────────
const BigChart: React.FC = () => {
  const x0 = 24;
  const y0 = 80;
  const w = 1456;
  const h = 414;
  const plotL = x0 + 24;
  const plotR = x0 + w - 96;
  const plotT = y0 + 96;
  const plotB = y0 + h - 44;
  const rnd = mulberry32(2026);
  const nC = 96;
  const cw = (plotR - plotL) / nC;
  let price = 0.5;
  const candles: { o: number; c: number; hi: number; lo: number }[] = [];
  for (let i = 0; i < nC; i++) {
    const o = price;
    price += (rnd() - 0.5) * 0.06 + (i > nC * 0.55 ? -0.004 : 0.004);
    price = Math.max(0.12, Math.min(0.9, price));
    const c = price;
    const hi = Math.max(o, c) + rnd() * 0.03;
    const lo = Math.min(o, c) - rnd() * 0.03;
    candles.push({ o, c, hi, lo });
  }
  const yAt = (v: number) => plotB - v * (plotB - plotT);
  const openLineY = yAt(candles[Math.floor(nC * 0.5)].o);
  return (
    <div
      style={{
        ...glassCard(16),
        position: "absolute",
        left: x0,
        top: y0,
        width: w,
        height: h,
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", left: 24, top: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontFamily: font, fontSize: 18, color: C.text }}>F</div>
        <div>
          <div style={{ fontFamily: font, fontSize: 24, fontWeight: 800, color: C.text }}>Fartcoin (9BB6..pump)</div>
          <div style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 600, color: C.faint }}>PF:FARTCOIN</div>
        </div>
      </div>
      <div style={{ position: "absolute", right: 110, top: 18, textAlign: "right" }}>
        <div style={{ fontFamily: font, fontSize: 28, fontWeight: 800, color: C.text }}>$0.18</div>
        <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 600, color: C.down }}>-0.14% this round</div>
      </div>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
        <line x1={plotL} y1={openLineY} x2={plotR} y2={openLineY} stroke="rgba(60,64,130,0.28)" strokeWidth={1} strokeDasharray="5 5" />
        <line x1={plotL} y1={yAt(0.62)} x2={plotR} y2={yAt(0.62)} stroke={C.up} strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
        {candles.map((cd, i) => {
          const cx = plotL + i * cw + cw / 2;
          const green = cd.c >= cd.o;
          const col = green ? C.up : C.down;
          return (
            <g key={i}>
              <line x1={cx} y1={yAt(cd.hi)} x2={cx} y2={yAt(cd.lo)} stroke={col} strokeWidth={1} />
              <rect
                x={cx - cw * 0.32}
                y={yAt(Math.max(cd.o, cd.c))}
                width={cw * 0.64}
                height={Math.max(1, Math.abs(yAt(cd.o) - yAt(cd.c)))}
                fill={col}
              />
            </g>
          );
        })}
      </svg>
      {/* right-edge price tags */}
      <div style={{ position: "absolute", right: 8, top: openLineY - y0 - 28 }}>
        <div style={{ background: C.up, color: "#fff", fontFamily: monoFont, fontSize: 13, fontWeight: 700, padding: "3px 8px", borderRadius: 6, marginBottom: 4, boxShadow: `0 4px 12px ${C.up}55` }}>to win +1%</div>
        <div style={{ background: C.text, color: "#fff", fontFamily: monoFont, fontSize: 13, fontWeight: 700, padding: "3px 8px", borderRadius: 6 }}>$0.18</div>
      </div>
    </div>
  );
};

// ── round panel ─────────────────────────────────────────────────────────────
const RoundPanel: React.FC = () => {
  const col = (head: string, big: string, sub: string, live?: boolean) => (
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: live ? C.up : C.faint, display: "flex", alignItems: "center", gap: 5 }}>
        {live ? <span style={{ width: 7, height: 7, borderRadius: 4, background: C.up, display: "inline-block", boxShadow: `0 0 8px ${C.up}` }} /> : null}
        {head}
      </div>
      <div style={{ fontFamily: font, fontSize: 26, fontWeight: 800, color: C.text, marginTop: 4 }}>{big}</div>
      <div style={{ fontFamily: monoFont, fontSize: 12, fontWeight: 600, color: C.faint, marginTop: 2 }}>{sub}</div>
    </div>
  );
  return (
    <div style={{ ...glassPanel(16), position: "absolute", left: 1500, top: 80, width: 396, padding: "18px 20px", boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 8 }}>
        {col("LAST", "Closed", "7:42")}
        {col("NOW", "7:42", "live", true)}
        {col("NEXT", "17:42", "27:42")}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontFamily: monoFont, fontSize: 14, fontWeight: 600, color: C.dim }}>
        <span>POOL</span>
        <span style={{ color: C.text, fontWeight: 700 }}>$152.47</span>
      </div>
    </div>
  );
};

// ── stake panel ───────────────────────────────────────────────────────────
export const StakePanel: React.FC<{ confirmGlow?: number }> = ({ confirmGlow = 0 }) => (
  <div style={{ ...glassPanel(16), position: "absolute", left: 1500, top: 218, width: 396, padding: "22px 22px 24px", boxSizing: "border-box" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: C.faint }}>STAKE</span>
      <span style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 600, color: C.dim }}>2,980 USDC</span>
    </div>
    <div style={{ fontFamily: font, fontSize: 56, fontWeight: 800, color: C.text, marginTop: 6 }}>$10</div>
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      {["$1", "$5", "$10", "$25", "$50"].map((v) => (
        <div
          key={v}
          style={{
            flex: 1,
            textAlign: "center",
            padding: "9px 0",
            borderRadius: 999,
            fontFamily: font,
            fontSize: 15,
            fontWeight: 700,
            background: v === "$10" ? C.blue : "rgba(255,255,255,0.45)",
            color: v === "$10" ? "#fff" : C.dim,
            border: v === "$10" ? "none" : "1px solid rgba(255,255,255,0.7)",
            boxShadow: v === "$10" ? `0 6px 16px ${C.blue}55` : "inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          {v}
        </div>
      ))}
    </div>
    <div style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 600, color: C.dim, marginTop: 12 }}>$1.00 × 10 markets</div>
    <div
      style={{
        marginTop: 16,
        height: 60,
        borderRadius: 14,
        background: PILL_GRADIENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: font,
        fontSize: 22,
        fontWeight: 700,
        color: "#fff",
        textShadow: "0 1px 2px rgba(40,40,90,0.28)",
        boxShadow: `0 ${12 + confirmGlow * 22}px ${32 + confirmGlow * 34}px rgba(94,120,255,${(0.4 + confirmGlow * 0.45).toFixed(2)}), inset 0 1px 0 rgba(255,255,255,0.5)`,
        transform: `scale(${(1 - confirmGlow * 0.04).toFixed(3)})`,
      }}
    >
      Confirm
    </div>
  </div>
);

// ── cursor ──────────────────────────────────────────────────────────────────
export const Cursor: React.FC<{ x: number; y: number; click: number }> = ({ x, y, click }) => (
  <div style={{ position: "absolute", left: x, top: y, transform: "translate(-2px,-2px)", zIndex: 50, pointerEvents: "none" }}>
    {click > 0 ? (
      <div
        style={{
          position: "absolute",
          left: -2,
          top: -2,
          width: 44,
          height: 44,
          marginLeft: -22,
          marginTop: -22,
          borderRadius: 999,
          border: `2px solid ${C.blue}`,
          opacity: click * 0.7,
          transform: `scale(${(0.4 + click * 1.1).toFixed(2)})`,
        }}
      />
    ) : null}
    <svg width="28" height="28" viewBox="0 0 28 28">
      <path d="M3 2 L3 22 L9 16 L13 24 L17 22 L13 14 L21 14 Z" fill="#1D1D1F" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  </div>
);

// ── the assembled dashboard ───────────────────────────────────────────────
//
// `build` (0..1) assembles the chrome around the Fartcoin card instead of
// fading the whole panel in: the header drops, the chart and panels rise, the
// nine other cards pop in with a stagger. `slot0Reveal` brings the Fartcoin
// card itself in — it's the handoff target the opening question morphs into,
// so the question vanishes exactly as this card lands.

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

export const ProductUI: React.FC<{
  picks: ("up" | "down" | null)[];
  activeIndex: number | null;
  confirmGlow?: number;
  build?: number;
  slot0Reveal?: number;
}> = ({ picks, activeIndex, confirmGlow = 0, build = 1, slot0Reveal = 1 }) => {
  const win = (s: number, e: number): number => EASE.out(clamp01((build - s) / (e - s)));
  const hE = win(0, 0.35);
  const cE = win(0.08, 0.5);
  const rE = win(0.3, 0.7);
  const sE = win(0.4, 0.78);
  const lE = win(0.2, 0.5);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, opacity: hE, transform: `translateY(${(-72 * (1 - hE)).toFixed(1)}px)` }}>
        <Header />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: cE, transformOrigin: "center center", transform: `translateY(${(44 * (1 - cE)).toFixed(1)}px) scale(${(0.95 + 0.05 * cE).toFixed(3)})` }}>
        <BigChart />
      </div>
      <div style={{ position: "absolute", left: 24, top: 474, fontFamily: font, fontSize: 15, fontWeight: 700, letterSpacing: "0.06em", color: C.dim, opacity: lE }}>
        TOP 10 BY PRICE
      </div>
      {MARKETS.map((m, i) => {
        const o = cardOrigin(i);
        const e = i === 0 ? slot0Reveal : win(0.24 + i * 0.045, 0.24 + i * 0.045 + 0.4);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: o.x,
              top: o.y,
              opacity: e,
              transformOrigin: "center center",
              transform: `translateY(${(22 * (1 - e)).toFixed(1)}px) scale(${(0.88 + 0.12 * e).toFixed(3)})`,
            }}
          >
            <MarketCard market={m} index={i} picked={picks[i] ?? null} active={activeIndex === i} />
          </div>
        );
      })}
      <div style={{ position: "absolute", inset: 0, opacity: rE, transform: `translateX(${(96 * (1 - rE)).toFixed(1)}px)` }}>
        <RoundPanel />
      </div>
      <div style={{ position: "absolute", inset: 0, opacity: sE, transform: `translateX(${(96 * (1 - sE)).toFixed(1)}px)` }}>
        <StakePanel confirmGlow={confirmGlow} />
      </div>
    </>
  );
};
