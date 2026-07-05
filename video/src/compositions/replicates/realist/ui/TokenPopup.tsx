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
  <svg width={9} height={9} viewBox="0 0 10 10" style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <path d="M5 0.8 9.5 9H0.5Z" fill={C.sand} />
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

const SettingsRow: React.FC<{
  y: number;
  pct: string;
  gas: readonly string[];
  tip: string | readonly string[];
  right: { text: string; color: string };
}> = ({ y, pct, gas, tip, right }) => (
  // every span carries top:0 — absolutely positioned spans WITHOUT top keep
  // their static-flow y (parent 16px line box) and sat ~7px low (r2 fix)
  <div style={{ position: "absolute", left: 124, top: y, width: 312, height: 12 }}>
    <span style={{ position: "absolute", left: 0, top: 0 }}>
      <T size={10.5} color={C.textMid}>
        ⇅ {pct}
      </T>
    </span>
    {/* gas/tip clusters — icon, value AND warn are all sand-gold (r3) */}
    <span style={{ position: "absolute", left: 46, top: 0 }}>
      <T size={10.5} color={C.sand}>
        ⛽{" "}
      </T>
      <SubZero parts={gas} color={C.sand} />
      <Warn />
    </span>
    <span style={{ position: "absolute", left: 118, top: 0 }}>
      <T size={10.5} color={C.sand}>
        ◎{" "}
      </T>
      {typeof tip === "string" ? (
        <T size={10.5} color={C.sand}>
          {tip}{" "}
        </T>
      ) : (
        <SubZero parts={tip} color={C.sand} />
      )}
      <Warn />
    </span>
    <span style={{ position: "absolute", left: 188, top: 0 }}>
      <T size={10.5} color={C.textMid}>
        ∅ {POPUP.buySettings.off}
      </T>
    </span>
    <span style={{ position: "absolute", right: 0, top: 0 }}>
      <T size={10.5} weight={500} color={right.color}>
        {right.text}
      </T>
    </span>
  </div>
);

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
            <svg width={10} height={10} viewBox="0 0 10 10">
              <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke={i === 1 ? C.tabIdleText : "#6C64AB"} strokeWidth="1.3" />
              <path d="M3 2.5 V1.5 h5 v4" fill="none" stroke={i === 1 ? C.tabIdleText : "#6C64AB"} strokeWidth="1.1" />
            </svg>
            <T size={11} weight={600} color={i === 0 ? C.tabActiveText : i === 2 ? "#6C64AB" : C.tabIdleText}>
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

      {/* header row */}
      <div style={{ position: "absolute", left: 133, top: 385, width: 300, height: 18 }}>
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: 0, top: 1 }}>
          <rect x="1" y="1" width="12" height="12" rx="2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          <path d="M4 5h6M4 8h6" stroke="#8b8e97" strokeWidth="1.1" />
        </svg>
        {POPUP.presetsLabels.map((p, i) => (
          <span key={p} style={{ position: "absolute", left: 26 + i * 30, top: 2 }}>
            <T size={12.5} weight={600} color={i === 2 ? C.purpleText : C.textMid}>
              {p}
            </T>
          </span>
        ))}
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 118, top: 2 }}>
          <path d="M2 12 3 9l6.5-6.5a1.4 1.4 0 0 1 2 2L5 11Z" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 203, top: 2 }}>
          <circle cx="7" cy="7" r="2.4" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          <path
            d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M10.8 3.2 9.4 4.6M4.6 9.4 3.2 10.8"
            stroke="#8b8e97"
            strokeWidth="1.1"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            left: 228,
            top: -1,
            height: 19,
            padding: "0 8px",
            borderRadius: 10,
            border: "1px solid #343946",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg width={10} height={10} viewBox="0 0 10 10">
            <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          </svg>
          <T size={11} weight={600} color={C.text}>
            {POPUP.walletCount}
          </T>
        </div>
        <span style={{ position: "absolute", left: 284, top: 1 }}>
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
        <div
          style={{
            position: "absolute",
            left: 31,
            top: 0,
            height: 20,
            padding: "0 8px",
            borderRadius: 10,
            background: C.solChipBg,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Bars size={10} />
          <T size={10.5} weight={700} color={C.solChipText}>
            {POPUP.sol}
          </T>
        </div>
        <div
          style={{
            position: "absolute",
            left: 80,
            top: 0,
            height: 20,
            padding: "0 8px",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {/* USDC coin: blue disc + white mark (r3) */}
          <span style={{ position: "relative", width: 9, height: 9, borderRadius: 4.5, background: C.usdcBlue, display: "inline-block" }}>
            <span style={{ position: "absolute", left: 2.5, top: 2, width: 4, height: 5, borderRadius: 2, border: "1px solid #DDE4EE", boxSizing: "border-box" }} />
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
        y={530}
        pct={POPUP.buySettings.pct}
        gas={POPUP.buySettings.gas}
        tip={POPUP.buySettings.tip}
        right={{ text: POPUP.buySettings.adv, color: C.textMid }}
      />

      {/* Sell row */}
      <div style={{ position: "absolute", left: 124, top: 558, width: 312, height: 18 }}>
        <span style={{ position: "absolute", left: 0, top: 2 }}>
          <T size={14} weight={600} color={C.textHi}>
            {POPUP.sell}
          </T>
        </span>
        <span style={{ position: "absolute", left: 34, top: 4 }}>
          <T size={11} weight={600} color={C.textMid}>
            {solMode ? POPUP.sellModeSol : POPUP.sellModePct}
          </T>
        </span>
        <svg width={12} height={12} viewBox="0 0 12 12" style={{ position: "absolute", left: 60, top: 3 }}>
          <path d="M2 4h7M7 2l2 2-2 2M10 8H3M5 6 3 8l2 2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
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
        tip={POPUP.sellSettings.tip}
        right={{ text: POPUP.sellSettings.init, color: C.sellInit }}
      />

      {/* footer stats — no divider exists on the plates (r3); ≡ icons start
          at x138/208/279/336, text band c≈708.5 */}
      <div style={{ position: "absolute", left: 114, top: 697, width: 330, height: 30 }}>
        {[
          { x: 24, v: pos.bought, c: C.footTeal },
          { x: 94, v: pos.sold, c: C.footPink },
          { x: 165, v: pos.holding, c: C.footWhite },
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
