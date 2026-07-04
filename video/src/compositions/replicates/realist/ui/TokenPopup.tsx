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

// ≡ stacked-bars (SOL amount) glyph
const Bars: React.FC<{ size?: number; color?: string }> = ({ size = 11, color = "#7d8bd0" }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <rect x="1" y="2" width="10" height="2" rx="1" fill={color} />
    <rect x="1" y="5.5" width="10" height="2" rx="1" fill={color} />
    <rect x="1" y="9" width="10" height="2" rx="1" fill={color} />
  </svg>
);

const Warn: React.FC = () => (
  <svg width={9} height={9} viewBox="0 0 10 10" style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <path d="M5 0.8 9.5 9H0.5Z" fill="#C9A227" />
  </svg>
);

const PresetCell: React.FC<{ x: number; y: number; text: string; kind: "buy" | "sell" }> = ({ x, y, text, kind }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 73,
      height: 26,
      borderRadius: 13,
      border: `1px solid ${kind === "buy" ? C.tealDim : C.negDim}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <T size={13} weight={600} color={kind === "buy" ? C.pos : C.neg}>
      {text}
    </T>
  </div>
);

const CELL_X = [123, 203.5, 284, 364.5];

const SettingsRow: React.FC<{
  y: number;
  pct: string;
  gas: readonly string[];
  tip: string | readonly string[];
  right: { text: string; color: string };
}> = ({ y, pct, gas, tip, right }) => (
  <div style={{ position: "absolute", left: 124, top: y, width: 312, height: 12 }}>
    <span style={{ position: "absolute", left: 0 }}>
      <T size={10.5} color={C.textMid}>
        ⇅ {pct}
      </T>
    </span>
    <span style={{ position: "absolute", left: 46 }}>
      <T size={10.5} color={C.textMid}>
        ⛽{" "}
      </T>
      <SubZero parts={gas} color={C.textMid} />
      <Warn />
    </span>
    <span style={{ position: "absolute", left: 118 }}>
      <T size={10.5} color={C.textMid}>
        ◎{" "}
      </T>
      {typeof tip === "string" ? (
        <T size={10.5} color={C.textMid}>
          {tip}{" "}
        </T>
      ) : (
        <SubZero parts={tip} color={C.textMid} />
      )}
      <Warn />
    </span>
    <span style={{ position: "absolute", left: 188 }}>
      <T size={10.5} color={C.textMid}>
        ∅ {POPUP.buySettings.off}
      </T>
    </span>
    <span style={{ position: "absolute", right: 0 }}>
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
      {/* wallet tab chips above the popup */}
      <div style={{ position: "absolute", left: 121, top: 345, width: 323, height: 22, display: "flex", gap: 10 }}>
        {POPUP.tabs.map((t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0 9px",
              height: 21,
              borderRadius: 4,
              background: i === 0 ? "#22262e" : "transparent",
              border: i === 0 ? "1px solid #343946" : "1px solid transparent",
            }}
          >
            <svg width={10} height={10} viewBox="0 0 10 10">
              <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke="#8d85cf" strokeWidth="1.3" />
              <path d="M3 2.5 V1.5 h5 v4" fill="none" stroke="#8d85cf" strokeWidth="1.1" />
            </svg>
            <T size={11} weight={600} color={i === 0 ? "#cfd2da" : i === 2 ? "#8d85cf" : C.textMid}>
              {t}
            </T>
          </div>
        ))}
      </div>

      {/* body */}
      <div
        style={{
          position: "absolute",
          left: 121,
          top: 372,
          width: 323,
          height: 356,
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
      <div style={{ position: "absolute", left: 122, top: 411, width: 321, height: 1, background: C.divider }} />

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
            background: "#2a2d36",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Bars size={10} />
          <T size={10.5} weight={700} color={C.textHi}>
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
          <span style={{ width: 8, height: 8, borderRadius: 4, background: "#3a6ea8", display: "inline-block" }} />
          <T size={10.5} weight={600} color={C.textDim}>
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
        row.map((v, i) => <PresetCell key={`b${r}${i}`} x={CELL_X[i]} y={r === 0 ? 452 : 488} text={v} kind="buy" />),
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
        row.map((v, i) => <PresetCell key={`s${r}${i}`} x={CELL_X[i]} y={r === 0 ? 587 : 623} text={v} kind="sell" />),
      )}
      <SettingsRow
        y={665}
        pct={POPUP.sellSettings.pct}
        gas={POPUP.sellSettings.gas}
        tip={POPUP.sellSettings.tip}
        right={{ text: POPUP.sellSettings.init, color: C.neg }}
      />

      {/* footer stats */}
      <div style={{ position: "absolute", left: 122, top: 694, width: 321, height: 34, borderTop: `1px solid ${C.divider}` }}>
        {[
          { x: 13, v: pos.bought, c: C.pos },
          { x: 87, v: pos.sold, c: C.neg },
          { x: 158, v: pos.holding, c: C.text },
          { x: 228, v: `${pos.pnl}(${pctK(pos.pnlPct)})`, c: C.pos },
        ].map((s, i) => (
          <span key={i} style={{ position: "absolute", left: s.x, top: 11, whiteSpace: "nowrap" }}>
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
