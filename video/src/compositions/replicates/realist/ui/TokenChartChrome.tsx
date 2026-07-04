import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";
import { COLORS as C, CHART_TOOLBAR, OHLC, CHART_FOOT } from "./copy/token";
import { sampleAt, ohlcTable, clockAt } from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const FONT = `${fontFamily}, -apple-system, sans-serif`;

// ─────────────────────────────────────────────────────────────────────
// Chart chrome for the live token page: toolbar row, OHLC readout,
// left icon strip, foot rows, backgrounds/dividers. The chart interior
// (grid/candles/bubbles/scale text) is ChartArea.tsx.
// Geometry measured off plates f0900 / f1650.
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

// small generic grey line-glyph for the left toolbar
const ToolGlyph: React.FC<{ i: number }> = ({ i }) => {
  const s = "#767a85";
  const shapes: React.ReactNode[] = [
    <path key="0" d="M4 12 12 4M9 4h3v3" stroke={s} strokeWidth="1.3" fill="none" />, // cursor/cross
    <path key="1" d="M3 13 13 3" stroke={s} strokeWidth="1.3" />, // trend line
    <path key="2" d="M3 8h10M8 5v6" stroke={s} strokeWidth="1.3" />, // cross line
    <path key="3" d="M3 11 8 6l5 5" stroke={s} strokeWidth="1.3" fill="none" />, // pitchfork
    <path key="4" d="M3 12 4 9l6-6 2 2-6 6Z" stroke={s} strokeWidth="1.2" fill="none" />, // pencil
    <path key="5" d="M4 4h8M8 4v8" stroke={s} strokeWidth="1.3" />, // text T
    <circle key="6" cx="8" cy="8" r="4.5" stroke={s} strokeWidth="1.2" fill="none" />, // emoji
    <path key="7" d="M3 10l4-4 2 2 4-4M3 13h10" stroke={s} strokeWidth="1.2" fill="none" />, // pattern
    <path key="8" d="M3 5h10v6H3Z M6 5v6" stroke={s} strokeWidth="1.1" fill="none" />, // measure
    <circle key="9" cx="7" cy="7" r="3.5" stroke={s} strokeWidth="1.2" fill="none" />, // zoom (+ handle)
    <path key="10" d="M5 3v5a3 3 0 0 0 6 0V3M4 13h8" stroke={s} strokeWidth="1.2" fill="none" />, // magnet
    <rect key="11" x="4" y="6" width="8" height="7" rx="1" stroke={s} strokeWidth="1.2" fill="none" />, // lock
    <path key="12" d="M4 6h8l-1 7H5ZM6 6V4h4v2" stroke={s} strokeWidth="1.1" fill="none" />, // trash
  ];
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" style={{ display: "block" }}>
      {shapes[i % shapes.length]}
    </svg>
  );
};

export const TokenChartChrome: React.FC<{ frame: number }> = ({ frame }) => {
  const ohlc = sampleAt(ohlcTable, frame);
  const dir = ohlc ? (ohlc.up ? C.ohlcPos : C.ohlcNeg) : C.textMid;

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {/* region backgrounds */}
      <div style={{ position: "absolute", left: 0, top: 150, width: 1632, height: 32, background: C.chartToolbarBg }} />
      <div style={{ position: "absolute", left: 0, top: 182, width: 1632, height: 766, background: C.chartBg }} />
      <div style={{ position: "absolute", left: 0, top: 948, width: 1632, height: 40, background: C.chartToolbarBg }} />
      {/* dividers */}
      <div style={{ position: "absolute", left: 0, top: 181, width: 1632, height: 1, background: C.divider }} />
      <div style={{ position: "absolute", left: 44, top: 182, width: 1, height: 766, background: C.divider }} />
      <div style={{ position: "absolute", left: 1556, top: 182, width: 1, height: 766, background: C.divider }} />
      <div style={{ position: "absolute", left: 0, top: 918, width: 1556, height: 1, background: C.divider }} />
      <div style={{ position: "absolute", left: 0, top: 948, width: 1632, height: 1, background: C.divider }} />
      <div style={{ position: "absolute", left: 1632, top: 84, width: 1, height: 904, background: "#0d0f14" }} />

      {/* ── toolbar row (y150–182) ── */}
      <div style={{ position: "absolute", left: 0, top: 157, width: 1610, height: 20 }}>
        {CHART_TOOLBAR.timeframes.map((tf, i) => (
          <span key={tf} style={{ position: "absolute", left: 10 + i * 26, top: 3 }}>
            <T size={12.5} weight={600} color={i === 0 ? C.tealText : C.textMid}>
              {tf}
            </T>
          </span>
        ))}
        <span style={{ position: "absolute", left: 143, top: 5 }}>
          <T size={9} color={C.textMid}>
            ▾
          </T>
        </span>
        <div style={{ position: "absolute", left: 160, top: 0, width: 1, height: 20, background: C.divider }} />
        {/* candle glyph */}
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: 172, top: 3 }}>
          <path d="M4 1v3M4 10v3M10 1v2M10 11v2" stroke="#8b8e97" strokeWidth="1.2" />
          <rect x="2.5" y="4" width="3" height="6" fill="none" stroke="#8b8e97" strokeWidth="1.1" />
          <rect x="8.5" y="3" width="3" height="8" fill="none" stroke="#8b8e97" strokeWidth="1.1" />
        </svg>
        <span style={{ position: "absolute", left: 200, top: 3 }}>
          <T size={12.5} color={C.textMid}>
            ƒ<span style={{ fontSize: 9 }}>x</span>
          </T>
        </span>
        <span style={{ position: "absolute", left: 222, top: 3 }}>
          <T size={12.5} color={C.text}>
            {CHART_TOOLBAR.indicators}
          </T>
        </span>
        <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: 306, top: 3 }}>
          <rect x="1.5" y="1.5" width="4.5" height="4.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <rect x="8" y="1.5" width="4.5" height="4.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <rect x="1.5" y="8" width="4.5" height="4.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <rect x="8" y="8" width="4.5" height="4.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
        </svg>
        <span style={{ position: "absolute", left: 340, top: 5 }}>
          <T size={9} color={C.textMid}>
            ▾
          </T>
        </span>
        <span style={{ position: "absolute", left: 356, top: 3 }}>
          <T size={12.5} color={C.text}>
            {CHART_TOOLBAR.displayOptions}
          </T>
        </span>
        <span style={{ position: "absolute", left: 510, top: 3 }}>
          <T size={12.5} color={C.text}>
            {CHART_TOOLBAR.showAllBubbles}
          </T>
        </span>
        <span style={{ position: "absolute", left: 645, top: 3 }}>
          <T size={12.5} weight={600} color={C.textHi}>
            {CHART_TOOLBAR.usdSol.active}
          </T>
          <T size={12.5} color={C.textDim}>
            {CHART_TOOLBAR.usdSol.inactive}
          </T>
        </span>
        <span style={{ position: "absolute", left: 718, top: 3 }}>
          <T size={12.5} weight={600} color={C.tealText}>
            {CHART_TOOLBAR.mcPrice.active}
          </T>
          <T size={12.5} color={C.textDim}>
            {CHART_TOOLBAR.mcPrice.inactive}
          </T>
        </span>
        {/* right cluster */}
        <span style={{ position: "absolute", left: 1445, top: 3 }}>
          <T size={12.5} color={C.textMid}>
            {CHART_TOOLBAR.layoutName}
          </T>
        </span>
        {[1500, 1528, 1556, 1584].map((x, i) => (
          <svg key={x} width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: x, top: 3 }}>
            {i === 0 ? (
              <path d="M2 2h10v10H2ZM7 2v10" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
            ) : i === 1 ? (
              <path d="M7 2v7M4 6l3 3 3-3M2 12h10" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            ) : i === 2 ? (
              <path d="M2 5V2h3M12 9v3H9M12 5V2H9M2 9v3h3" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            ) : (
              <>
                <rect x="1.5" y="3.5" width="11" height="8" rx="1.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
                <circle cx="7" cy="7.5" r="2.2" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
              </>
            )}
          </svg>
        ))}
      </div>

      {/* ── OHLC readout row (y188–212) ── */}
      <div style={{ position: "absolute", left: 58, top: 192, height: 16, whiteSpace: "nowrap" }}>
        <T size={12.5} color={C.text}>
          {OHLC.symbolLine}
        </T>
        <span
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: 4,
            background: "#3ED6C5",
            margin: "0 10px 0 14px",
          }}
        />
        {ohlc ? (
          <>
            {(
              [
                [OHLC.o, ohlc.o],
                [OHLC.h, ohlc.h],
                [OHLC.l, ohlc.l],
                [OHLC.c, ohlc.c],
              ] as const
            ).map(([k, v]) => (
              <span key={k}>
                <T size={12.5} color={C.textMid}>
                  {k}
                </T>
                <T size={12.5} weight={500} color={dir}>
                  {v}{" "}
                </T>
              </span>
            ))}
            <T size={12.5} weight={500} color={dir}>
              {ohlc.d} ({ohlc.dp})
            </T>
          </>
        ) : null}
      </div>

      {/* ── left icon strip ── */}
      {Array.from({ length: 13 }).map((_, i) => (
        <div key={i} style={{ position: "absolute", left: 14, top: 232 + i * 34 }}>
          <ToolGlyph i={i} />
        </div>
      ))}

      {/* ── TV logo ── */}
      <div style={{ position: "absolute", left: 64, top: 882 }}>
        <svg width={26} height={26} viewBox="0 0 26 26">
          <circle cx="13" cy="13" r="12" fill="#2a2e37" />
          <path d="M6 9h8v3h-3v7h-3v-7H6ZM16 9h4l-3 10h-3Z" fill="#9ca0ab" />
        </svg>
      </div>

      {/* ── foot row (y948–988) ── */}
      <div style={{ position: "absolute", left: 0, top: 958, width: 1610, height: 18 }}>
        {CHART_FOOT.ranges.map((r, i) => (
          <span key={r} style={{ position: "absolute", left: 64 + i * 28, top: 2 }}>
            <T size={12} color={C.textMid}>
              {r}
            </T>
          </span>
        ))}
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 182, top: 2 }}>
          <circle cx="7" cy="7" r="5.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <path d="M7 4v3l2 2" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
        </svg>
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 208, top: 2 }}>
          <path d="M3 7a4 4 0 1 1 1 3M3 7V4M3 7h3" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
        </svg>
        <span style={{ position: "absolute", left: 1408, top: 2 }}>
          <T size={12} color={C.text}>
            {clockAt(frame)}
            {CHART_FOOT.utcSuffix}
          </T>
        </span>
        <span style={{ position: "absolute", left: 1532, top: 2 }}>
          <T size={12} color={C.textMid}>
            {CHART_FOOT.pct}
          </T>
        </span>
        <span style={{ position: "absolute", left: 1554, top: 2 }}>
          <T size={12} color={C.textMid}>
            {CHART_FOOT.log}
          </T>
        </span>
        <span style={{ position: "absolute", left: 1580, top: 2 }}>
          <T size={12} weight={600} color="#4a7dd8">
            {CHART_FOOT.auto}
          </T>
        </span>
      </div>
    </div>
  );
};
