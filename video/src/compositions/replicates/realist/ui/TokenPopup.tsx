import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";
import { COLORS as C, POPUP } from "./copy/token";
import {
  sampleAt,
  buyTotalTable,
  sellRowTable,
  posStatsTable,
  pctK,
  SELL_MODE_FLIP_F,
  SELL_MODE_FLIP2_F,
  BUY_TIP_WARN_F,
} from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const FONT = `${fontFamily}, -apple-system, sans-serif`;

// ─────────────────────────────────────────────────────────────────────
// Floating multi-wallet trade popup (live token page, f418+).
// Geometry measured off plates f0900 / f1650: body x121 y372 323×356.
// ─────────────────────────────────────────────────────────────────────

const T: React.FC<{
  size: number;
  color: string;
  weight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size, color, weight = 500, style, children }) => (
  <span style={{ fontFamily: FONT, fontSize: size, color, fontWeight: weight, lineHeight: 1, ...style }}>
    {children}
  </span>
);

// "0.0₃2" — subscripted zero count
const SubZero: React.FC<{ parts: readonly string[]; color: string; size?: number }> = ({ parts, color, size = 10.5 }) => (
  <span style={{ fontFamily: FONT, fontSize: size, color, fontWeight: 500, lineHeight: 1 }}>
    {parts[0]}
    <span style={{ fontSize: size * 0.72, verticalAlign: "-0.22em" }}>{parts[1]}</span>
    {parts[2]}
  </span>
);

// ≡ stacked-bars (SOL amount) glyph — Solana mark, vertical teal→blue→purple
// gradient measured off the plates (r3); was flat #7d8bd0.
const Bars: React.FC<{ size?: number; color?: string }> = ({ size = 11, color }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <rect x="1" y="2" width="10" height="2" rx="1" fill={color ?? C.barsTop} />
    <rect x="1" y="5.5" width="10" height="2" rx="1" fill={color ?? C.barsMid} />
    <rect x="1" y="9" width="10" height="2" rx="1" fill={color ?? C.barsBot} />
  </svg>
);

const Warn: React.FC = () => (
  <svg width={10} height={10} viewBox="0 0 10 10" style={{ display: "block" }}>
    <path d="M5 0.8 9.5 9H0.5Z" fill={C.sand} />
    <rect x="4.4" y="3.6" width="1.2" height="2.8" rx="0.6" fill={C.popupBg} />
    <rect x="4.4" y="7.1" width="1.2" height="1.2" rx="0.6" fill={C.popupBg} />
  </svg>
);

// gas icon — the plates show a small GOLD banknote/pump blob; the previous
// "⛽" TEXT glyph rendered as the full-color red emoji on macOS (r4 fix).
const GasIcon: React.FC = () => (
  <svg width={10} height={11} viewBox="0 0 10 11" style={{ display: "block" }}>
    <rect x="0.8" y="1" width="6" height="9" rx="1.1" fill={C.sand} />
    <rect x="2" y="2.4" width="3.6" height="2.6" rx="0.5" fill={C.popupBg} />
    <path d="M7.4 3.4 L9 4.8 L9 8.8" fill="none" stroke={C.sand} strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

// tip icon — flat disc/coin (grey until the tip warn appears, then sand)
const TipIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width={11} height={11} viewBox="0 0 11 11" style={{ display: "block" }}>
    <ellipse cx="5.5" cy="5.5" rx="4.6" ry="3.1" fill="none" stroke={color} strokeWidth="1.2" />
    <ellipse cx="5.5" cy="5.5" rx="1.7" ry="1.1" fill="none" stroke={color} strokeWidth="1" />
  </svg>
);

// pill ring 75×27, pitch 80 (r3 mask measurement); ring + text colors are
// the washed plate cores, not the source-site accents.
const PresetCell: React.FC<{ x: number; y: number; text: string; kind: "buy" | "sell" }> = ({ x, y, text, kind }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 75,
      height: 27,
      borderRadius: 13.5,
      border: `1px solid ${kind === "buy" ? C.popupPillBuyRing : C.popupPillSellRing}`,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <T size={13} weight={600} color={kind === "buy" ? C.popupPillBuyText : C.popupPillSellText}>
      {text}
    </T>
  </div>
);

const CELL_X = [122.5, 202.5, 282.5, 362.5];

// Settings strip under each preset grid. The plates lay this out as a FLOW,
// not fixed columns: "∅ Off" sits at x276 on the buy row (short grey "0.01",
// no warn) but x299 on the sell row (long sand "0.0₃5" + warn) — r4 blob
// measurement, f0500. Fixed lefts for the first two clusters (they never
// change width), flex flow from the tip cluster on.
const SettingsRow: React.FC<{
  y: number;
  pct: string;
  gas: readonly string[];
  tip: { val: string | readonly string[]; warn: boolean };
  right: { text: string; color: string };
}> = ({ y, pct, gas, tip, right }) => {
  const tipColor = tip.warn ? C.sandVal : C.settingsGrey;
  return (
    // every cluster is a FLEX div (alignItems center, height 13) — abs spans
    // holding fallback-font glyphs (⇅) grow the line strut and sat ~7px low
    // even with top:0 (r4; sibling of the r2 static-flow bug)
    <div style={{ position: "absolute", left: 124, top: y, width: 312, height: 13 }}>
      <div style={{ position: "absolute", left: 0, top: 0, height: 13, display: "flex", alignItems: "center" }}>
        <T size={10.5} color={C.settingsGrey}>
          ⇅ {pct}
        </T>
      </div>
      <div style={{ position: "absolute", left: 47, top: 0, height: 13, display: "flex", alignItems: "center", gap: 3 }}>
        <GasIcon />
        <SubZero parts={gas} color={C.sandVal} />
        <Warn />
      </div>
      <div style={{ position: "absolute", left: 110, top: 0, height: 13, display: "flex", alignItems: "center", gap: 3 }}>
        <TipIcon color={tip.warn ? C.sand : C.settingsGrey} />
        {typeof tip.val === "string" ? (
          <T size={10.5} color={tipColor}>
            {tip.val}
          </T>
        ) : (
          <SubZero parts={tip.val} color={tipColor} />
        )}
        {tip.warn ? <Warn /> : null}
        <div style={{ width: 4 }} />
        <T size={10.5} color={C.settingsGrey}>
          ∅ {POPUP.buySettings.off}
        </T>
      </div>
      {/* NO checkbox before "Adv." — a faint box seen in 600% zooms probed
          as pure bg on f0500/f0700/f1050/f1620 (upscale phantom, r4) */}
      <div style={{ position: "absolute", right: 0, top: 0, height: 13, display: "flex", alignItems: "center" }}>
        <T size={10.5} weight={500} color={right.color}>
          {right.text}
        </T>
      </div>
    </div>
  );
};

export const TokenPopup: React.FC<{ frame: number }> = ({ frame }) => {
  const buyTotal = sampleAt(buyTotalTable, frame);
  const sellRow = sampleAt(sellRowTable, frame);
  const pos = sampleAt(posStatsTable, frame);
  const solMode = frame >= SELL_MODE_FLIP_F && frame < SELL_MODE_FLIP2_F;
  const sellPresets = solMode ? POPUP.sellPresetsB : POPUP.sellPresetsA;

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {/* wallet tab chips above the popup — HODLER is PURPLE on the plates
          (text #6560A0 on #222544), J7DEV grey with a grey icon (r3) */}
      <div style={{ position: "absolute", left: 114, top: 344, width: 330, height: 23, display: "flex", gap: 10 }}>
        {POPUP.tabs.map((t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0 9px",
              height: 22,
              borderRadius: 4,
              background: i === 0 ? C.tabActiveBg : "transparent",
              border: i === 0 ? `1px solid ${C.tabActiveBorder}` : "1px solid transparent",
            }}
          >
            {/* folder tab icon (the plates show a real folder silhouette, r4) */}
            <svg width={10} height={10} viewBox="0 0 10 10">
              <path
                d="M1 2.6 h2.7 l1 1.2 h3.9 a0.9 0.9 0 0 1 0.9 0.9 v2.7 a0.9 0.9 0 0 1 -0.9 0.9 h-6.7 a0.9 0.9 0 0 1 -0.9 -0.9 Z"
                fill="none"
                stroke={i === 1 ? C.tabIdleText : C.tabActiveText}
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
            </svg>
            <T size={11} weight={600} color={i === 1 ? C.tabIdleText : C.tabActiveText}>
              {t}
            </T>
          </div>
        ))}
      </div>

      {/* body — bbox re-measured r3: x114 y365 330×361 (was 121/372/323/356) */}
      <div
        style={{
          position: "absolute",
          left: 114,
          top: 365,
          width: 330,
          height: 361,
          background: C.popupBg,
          border: `1px solid ${C.popupBorder}`,
          borderRadius: 8,
          boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
        }}
      />

      {/* header row — top 385→382 r4: keyboard/P-labels/✕ all sat ~3px
          below the plate ink (plate text band y385-397) */}
      <div style={{ position: "absolute", left: 133, top: 382, width: 300, height: 18 }}>
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: 0, top: 1 }}>
          <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          <path d="M4 5h6M4 8h6" stroke="#8b8e97" strokeWidth="1.1" />
        </svg>
        {/* P3 carries a subtle purple-navy chip on the plates (x217-237, r4) */}
        <div style={{ position: "absolute", left: 84, top: 0, width: 21, height: 17, borderRadius: 4, background: C.tabActiveBg }} />
        {POPUP.presetsLabels.map((p, i) => (
          <span key={p} style={{ position: "absolute", left: 26 + i * 30, top: 2 }}>
            <T size={12.5} weight={600} color={i === 2 ? C.tabActiveText : C.textMid}>
              {p}
            </T>
          </span>
        ))}
        {/* pencil with the underline the plates show (edit icon) */}
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: 117, top: 2 }}>
          <path d="M2.5 10.5 3 8.5l5.5-5.5a1.3 1.3 0 0 1 1.9 1.9L4.9 10.4Z" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          <path d="M2.5 13 H11.5" stroke="#8b8e97" strokeWidth="1.1" strokeLinecap="round" />
        </svg>
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 200, top: 2 }}>
          <circle cx="7" cy="7" r="2.4" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          <path
            d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M10.8 3.2 9.4 4.6M4.6 9.4 3.2 10.8"
            stroke="#8b8e97"
            strokeWidth="1.1"
          />
        </svg>
        {/* wallet-count chip — the plates show NO bright ring (border ≈
            popupBorder) and a brighter 12px wallet/camera icon (r4) */}
        <div
          style={{
            position: "absolute",
            left: 228,
            top: -1,
            height: 19,
            padding: "0 8px",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width={12} height={12} viewBox="0 0 12 12">
            <rect x="0.8" y="2.6" width="10.4" height="7.6" rx="1.6" fill="none" stroke="#B6BAC3" strokeWidth="1.2" />
            <path d="M7.6 2.6 L9 1.2 L10.6 2.8" fill="none" stroke="#B6BAC3" strokeWidth="1.1" strokeLinejoin="round" />
            <path d="M3 7.2 H6.4" stroke="#B6BAC3" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
          <T size={11} weight={600} color={C.textHi}>
            {POPUP.walletCount}
          </T>
        </div>
        <span style={{ position: "absolute", left: 280, top: 1 }}>
          <T size={13} color={C.textMid}>
            ✕
          </T>
        </span>
      </div>
      <div style={{ position: "absolute", left: 115, top: 413, width: 328, height: 1, background: C.divider }} />

      {/* Buy row */}
      <div style={{ position: "absolute", left: 124, top: 421, width: 312, height: 20 }}>
        <span style={{ position: "absolute", left: 0, top: 3 }}>
          <T size={14} weight={600} color={C.textHi}>
            {POPUP.buy}
          </T>
        </span>
        {/* SOL/USDC segmented toggle — chip re-measured r4 (f0500): SOL
            segment is a TIGHT chip x158-190 y423-437 (was 20px tall and
            ~20px too wide); USDC segment is bare (no bg). */}
        <div
          style={{
            position: "absolute",
            left: 34,
            top: 2,
            height: 15,
            padding: "0 3px",
            borderRadius: 5,
            background: C.solChipBg,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Bars size={7} />
          <T size={9.5} weight={700} color={C.solChipText}>
            {POPUP.sol}
          </T>
        </div>
        <div
          style={{
            position: "absolute",
            left: 74,
            top: 2,
            height: 15,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {/* USDC coin: blue disc + white mark (r3; r4 size 9→10.5 per plate) */}
          <span style={{ position: "relative", width: 10.5, height: 10.5, borderRadius: 5.25, background: C.usdcBlue, display: "inline-block" }}>
            <span style={{ position: "absolute", left: 3, top: 2.5, width: 4.5, height: 5.5, borderRadius: 2.2, border: "1px solid #DDE4EE", boxSizing: "border-box" }} />
          </span>
          <T size={10.5} weight={600} color="#73777F">
            {POPUP.usdc}
          </T>
        </div>
        <span style={{ position: "absolute", right: 0, top: 2 }}>
          <Bars size={12} />{" "}
          <T size={14} weight={600} color={C.textHi}>
            {buyTotal}
          </T>
        </span>
      </div>

      {/* buy presets */}
      {POPUP.buyPresets.map((row, r) =>
        row.map((v, i) => <PresetCell key={`b${r}${i}`} x={CELL_X[i]} y={r === 0 ? 452 : 486.5} text={v} kind="buy" />),
      )}
      <SettingsRow
        y={527}
        pct={POPUP.buySettings.pct}
        gas={POPUP.buySettings.gas}
        tip={{ val: POPUP.buySettings.tip, warn: frame >= BUY_TIP_WARN_F }}
        right={{ text: POPUP.buySettings.adv, color: C.settingsGrey }}
      />

      {/* Sell row */}
      <div style={{ position: "absolute", left: 124, top: 558, width: 312, height: 18 }}>
        <span style={{ position: "absolute", left: 0, top: 2 }}>
          <T size={14} weight={600} color={C.textHi}>
            {POPUP.sell}
          </T>
        </span>
        {/* mode label + swap FLOW together on the plates: ⇄ sits at x170
            after "%" (f0500) but x182 after "SOL" (f1050) — r4 */}
        <div style={{ position: "absolute", left: 31, top: 3, display: "flex", alignItems: "center", gap: 5 }}>
          <T size={11} weight={600} color={C.textMid}>
            {solMode ? POPUP.sellModeSol : POPUP.sellModePct}
          </T>
          <svg width={12} height={12} viewBox="0 0 12 12" style={{ display: "block" }}>
            <path d="M2 4h7M7 2l2 2-2 2M10 8H3M5 6 3 8l2 2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          </svg>
        </div>
        <span style={{ position: "absolute", right: 0, top: 3, whiteSpace: "nowrap" }}>
          <T size={12.5} weight={500} color={C.text}>
            {sellRow.tokens} {POPUP.pumpwheelShort}
          </T>
          <T size={12.5} color={C.textDim}>
            {" "}
            ·{" "}
          </T>
          <T size={12.5} weight={500} color={C.text}>
            {sellRow.usd}
          </T>
          <T size={12.5} color={C.textDim}>
            {" "}
            ·{" "}
          </T>
          <Bars size={11} />{" "}
          <T size={12.5} weight={600} color={C.textHi}>
            {sellRow.sol}
          </T>
        </span>
      </div>

      {/* sell presets */}
      {sellPresets.map((row, r) =>
        row.map((v, i) => <PresetCell key={`s${r}${i}`} x={CELL_X[i]} y={r === 0 ? 584 : 620.5} text={v} kind="sell" />),
      )}
      <SettingsRow
        y={665}
        pct={POPUP.sellSettings.pct}
        gas={POPUP.sellSettings.gas}
        tip={{ val: POPUP.sellSettings.tip, warn: true }}
        right={{ text: POPUP.sellSettings.init, color: C.sellInit }}
      />

      {/* footer stats — no divider exists on the plates (r3); ≡ icons start
          at x138/208/279/336, text band c≈708.5 */}
      <div style={{ position: "absolute", left: 114, top: 697, width: 330, height: 30 }}>
        {[
          { x: 24, v: pos.bought, c: C.footTeal },
          { x: 94, v: pos.sold, c: C.footPink },
          { x: 159, v: pos.holding, c: C.footWhite }, // r4: plate icon x272-284, was 6px right
          { x: 222, v: `${pos.pnl}(${pctK(pos.pnlPct)})`, c: C.footTeal },
        ].map((s, i) => (
          <span key={i} style={{ position: "absolute", left: s.x, top: 6, whiteSpace: "nowrap" }}>
            <Bars size={11} />{" "}
            <T size={12.5} weight={600} color={s.c}>
              {s.v}
            </T>
          </span>
        ))}
      </div>
    </div>
  );
};
