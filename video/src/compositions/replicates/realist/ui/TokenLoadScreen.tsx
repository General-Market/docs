import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import {
  COLORS as C,
  LOAD_NAV,
  LOAD_HEADER,
  LOAD_DIALOG,
  LOAD_POPUP,
  LOAD_TOASTS,
  LOAD_BOTTOM,
  LOAD_PADRE,
} from "./copy/token";
import {
  sampleAt,
  loadMcTable,
  loadColsTable,
  loadFooterTable,
  loadSolTable,
  loadTokenAmtTable,
  loadSellValTable,
  loadHoldersTable,
  loadToastPhaseTable,
  loadCardsTable,
  LOAD_BLUE_FROM,
  LOAD_BLUE_TO,
} from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const FONT = `${fontFamily}, -apple-system, sans-serif`;

// ─────────────────────────────────────────────────────────────────────
// LOADING token page (old Trenches chrome), frames 333–391.
// Measured off plates f0335 / f0385 / f0390.
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

const Bars: React.FC<{ size?: number; color?: string }> = ({ size = 11, color = "#7d8bd0" }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" style={{ display: "inline-block", verticalAlign: "-1px" }}>
    <rect x="1" y="2" width="10" height="2" rx="1" fill={color} />
    <rect x="1" y="5.5" width="10" height="2" rx="1" fill={color} />
    <rect x="1" y="9" width="10" height="2" rx="1" fill={color} />
  </svg>
);

const Skel: React.FC<{ x: number; y: number; w: number; h?: number }> = ({ x, y, w, h = 10 }) => (
  <div
    style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: h / 2, background: "#272a33" }}
  />
);

const Spinner: React.FC<{ phase: number; done?: boolean }> = ({ phase, done }) =>
  done ? (
    <svg width={15} height={15} viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="7" fill="#2AA57A" />
      <path d="M4.6 8.2 7 10.6l4.4-4.8" stroke="#fff" strokeWidth="1.6" fill="none" />
    </svg>
  ) : (
    <svg width={15} height={15} viewBox="0 0 16 16" style={{ transform: `rotate(${phase}deg)` }}>
      <circle cx="8" cy="8" r="6" stroke="#3a3e49" strokeWidth="2" fill="none" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke="#9aa0ad" strokeWidth="2" fill="none" />
    </svg>
  );

// "Executing orders" / "Orders completed" toast
const OrderToast: React.FC<{ y: number; done: boolean; phase: number }> = ({ y, done, phase }) => (
  <div
    style={{
      position: "absolute",
      left: 1631,
      top: y,
      width: 285,
      height: 74,
      background: "#20232b",
      border: "1px solid #33363f",
      borderRadius: 8,
      boxShadow: "0 6px 18px rgba(0,0,0,0.4)",
    }}
  >
    <div style={{ position: "absolute", left: 12, top: 8 }}>
      <Spinner phase={phase} done={done} />
    </div>
    <span style={{ position: "absolute", left: 36, top: 6 }}>
      <T size={12.5} weight={600} color="#e4e7ee">
        {done ? LOAD_TOASTS.completed : LOAD_TOASTS.executing}
      </T>
    </span>
    <span style={{ position: "absolute", right: 10, top: 6 }}>
      <T size={12} color="#8b8e97">
        ✕
      </T>
    </span>
    <span style={{ position: "absolute", left: 36, top: 27, whiteSpace: "nowrap" }}>
      <T size={11.5} color="#c6c9d2">
        {LOAD_TOASTS.buyLine}{" "}
      </T>
      <Img
        src={staticFile("realist-assets/ui/pump-avatar.png")}
        style={{ width: 12, height: 12, borderRadius: 6, verticalAlign: "-2px" }}
      />
      <T size={11.5} weight={600} color="#e4e7ee">
        {" "}
        {LOAD_TOASTS.buyToken}
      </T>
      <T size={11.5} color="#c6c9d2">
        {" "}
        {LOAD_TOASTS.buyAmount}
      </T>
    </span>
    <span style={{ position: "absolute", left: 36, top: 49 }}>
      <T size={11} color="#8b8e97">
        {LOAD_TOASTS.waiting} {done ? LOAD_TOASTS.zero : LOAD_TOASTS.walletTotal}
      </T>
      <T size={11} color={done ? "#3ED6C5" : "#8b8e97"} style={{ marginLeft: 14 }}>
        {LOAD_TOASTS.success} {done ? LOAD_TOASTS.walletTotal : LOAD_TOASTS.zero}
      </T>
      <T size={11} color="#8b8e97" style={{ marginLeft: 14 }}>
        {LOAD_TOASTS.error} {LOAD_TOASTS.zero}
      </T>
    </span>
  </div>
);

const SubZero: React.FC<{ parts: readonly string[]; color: string; size: number; weight?: number }> = ({
  parts,
  color,
  size,
  weight = 500,
}) => (
  <span style={{ fontFamily: FONT, fontSize: size, color, fontWeight: weight, lineHeight: 1 }}>
    {parts[0]}
    <span style={{ fontSize: size * 0.72, verticalAlign: "-0.22em" }}>{parts[1]}</span>
    {parts[2]}
  </span>
);

// token-data stat card
const Card: React.FC<{ x: number; y: number; label: string; value: string; vColor: string; badge?: string }> = ({
  x,
  y,
  label,
  value,
  vColor,
  badge,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: 96,
      height: 56,
      background: "#1E2128",
      borderRadius: 6,
      textAlign: "center",
    }}
  >
    <div style={{ marginTop: 11 }}>
      <T size={12} weight={600} color={vColor}>
        {value}
      </T>
      {badge ? (
        <T size={11} weight={500} color="#c6c9d2" style={{ marginLeft: 6 }}>
          {badge}
        </T>
      ) : null}
    </div>
    <div style={{ marginTop: -1 }}>
      <T size={10} color="#8b8e97">
        {label}
      </T>
    </div>
  </div>
);

export const TokenLoadScreen: React.FC<{ frame: number }> = ({ frame }) => {
  const mc = sampleAt(loadMcTable, frame);
  const cols = sampleAt(loadColsTable, frame);
  const footer = sampleAt(loadFooterTable, frame);
  const solTotal = sampleAt(loadSolTable, frame);
  const tokenAmt = sampleAt(loadTokenAmtTable, frame);
  const sellVal = sampleAt(loadSellValTable, frame);
  const holders = sampleAt(loadHoldersTable, frame);
  const toastPhase = sampleAt(loadToastPhaseTable, frame);
  const cards = sampleAt(loadCardsTable, frame);
  const compactPopup = true; // plate is compact from f333 on
  const walletsLoaded = frame >= 376;
  const spin = (frame * 16) % 360;

  // chart phase: dark → solid blue → padre chart
  const blue = frame >= LOAD_BLUE_FROM && frame <= LOAD_BLUE_TO;
  const padre = frame > LOAD_BLUE_TO;
  const candleTop = 850 - Math.min(Math.max(frame - 386, 0), 5) * 118; // grows 387→391

  const railX = 1612;

  return (
    <AbsoluteFill style={{ background: "#14161c", fontFamily: FONT }}>
      {/* ── top nav (old chrome) ── */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 56, background: "#14161c" }} />
      {LOAD_NAV.links.map((l, i) => (
        <span key={l} style={{ position: "absolute", left: [115, 201, 287, 368, 434][i], top: 21 }}>
          <T size={13.5} weight={500} color={i === 0 ? "#c9cbd4" : "#8b8e97"}>
            {l}
          </T>
        </span>
      ))}
      <div
        style={{
          position: "absolute",
          left: 1355,
          top: 14,
          height: 27,
          padding: "0 11px",
          borderRadius: 7,
          background: "#23262e",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <svg width={11} height={11} viewBox="0 0 12 12">
          <rect x="2" y="3" width="7" height="8" rx="1.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <path d="M4 3V1.5h6v8" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
        </svg>
        <T size={12} color="#c6c9d2">
          {LOAD_NAV.pasteCa}
        </T>
      </div>
      <div
        style={{
          position: "absolute",
          left: 1450,
          top: 14,
          width: 178,
          height: 27,
          borderRadius: 7,
          background: "#20232b",
          display: "flex",
          alignItems: "center",
          paddingLeft: 9,
          gap: 6,
        }}
      >
        <svg width={11} height={11} viewBox="0 0 12 12">
          <circle cx="5" cy="5" r="3.6" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
          <path d="m8 8 2.6 2.6" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
        <T size={11.5} color="#6a6e79">
          {LOAD_NAV.searchPlaceholder}
        </T>
      </div>

      {/* sub-toolbar icon row */}
      <div style={{ position: "absolute", left: 0, top: 56, width: 1920, height: 28, borderBottom: "1px solid #20232b" }}>
        {[18, 46, 72, 98].map((x, i) => (
          <svg key={x} width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: x, top: 7 }}>
            {i === 0 ? (
              <path d="M3 7a4 4 0 1 1 1 3M3 7V4M3 7h3" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            ) : i === 1 ? (
              <path d="M2 11 6 7l2 2 4-5" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            ) : i === 2 ? (
              <path d="m7 1.5 1.7 3.6 4 .5-3 2.7.8 3.9L7 10.3l-3.5 1.9.8-3.9-3-2.7 4-.5Z" stroke="#8b8e97" strokeWidth="1" fill="none" />
            ) : (
              <circle cx="7" cy="7" r="3" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            )}
          </svg>
        ))}
      </div>

      {/* ── header ── */}
      <span style={{ position: "absolute", left: 62, top: 96 }}>
        <T size={15} weight={600} color="#e9ecf3">
          {LOAD_HEADER.name}
        </T>
      </span>
      {[186, 208, 230, 252, 274].map((x, i) => (
        <svg key={x} width={12} height={12} viewBox="0 0 12 12" style={{ position: "absolute", left: x, top: 98 }}>
          {i === 0 ? (
            <>
              <circle cx="5" cy="5" r="3.4" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
              <path d="m7.6 7.6 2.4 2.4" stroke="#8b8e97" strokeWidth="1.1" />
            </>
          ) : i === 1 ? (
            <path d="M5 7a2.4 2.4 0 0 0 3.4 0l2-2a2.4 2.4 0 0 0-3.4-3.4l-1 1M7 5a2.4 2.4 0 0 0-3.4 0l-2 2a2.4 2.4 0 0 0 3.4 3.4l1-1" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          ) : i === 2 ? (
            <rect x="2" y="4" width="8" height="6.5" rx="1" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          ) : i === 3 ? (
            <path d="m6 1.5 1.4 3 3.3.4-2.4 2.2.6 3.2L6 8.8 3.1 10.3l.6-3.2L1.3 4.9l3.3-.4Z" stroke="#8b8e97" strokeWidth="1" fill="none" />
          ) : (
            <path d="M6 1.5a3 3 0 0 1 3 3c0 2.6 1 3.4 1 3.4H2s1-.8 1-3.4a3 3 0 0 1 3-3ZM5 10h2" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          )}
        </svg>
      ))}
      {/* second header line */}
      <div style={{ position: "absolute", left: 44, top: 118, display: "flex", alignItems: "center", gap: 7 }}>
        <svg width={12} height={12} viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.5" stroke="#3ED6C5" strokeWidth="1.2" fill="none" />
          <path d="M7 4v3l2 2" stroke="#3ED6C5" strokeWidth="1.2" fill="none" />
        </svg>
        <T size={12} weight={600} color="#3ED6C5">
          2s
        </T>
        <T size={12.5} color="#8b8e97">
          {LOAD_HEADER.subtitle}
        </T>
        <svg width={11} height={11} viewBox="0 0 12 12">
          <rect x="2" y="3" width="7" height="8" rx="1.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
        </svg>
        <svg width={11} height={11} viewBox="0 0 12 12">
          <path d="M5 7 10.5 1.5M7 1.5h3.5V5M9 7v3.5H1.5V2H5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
        </svg>
        <svg width={12} height={12} viewBox="0 0 14 14">
          <path d="M1.5 7S3.5 3.5 7 3.5 12.5 7 12.5 7 10.5 10.5 7 10.5 1.5 7 1.5 7Z" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          <circle cx="7" cy="7" r="1.6" fill="#8b8e97" />
        </svg>
        <T size={12} color="#8b8e97">
          {walletsLoaded ? LOAD_HEADER.viewsInit : "-"}
        </T>
        {walletsLoaded ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 7px",
              borderRadius: 9,
              background: "#3a3320",
            }}
          >
            <T size={10.5} weight={600} color="#C9A227">
              🏆 {LOAD_HEADER.fundChip}
            </T>
          </span>
        ) : null}
      </div>

      {/* header right columns */}
      <span style={{ position: "absolute", left: 1002, top: 104 }}>
        {mc ? (
          <T size={17} weight={600} color="#e9ecf3">
            {mc}
          </T>
        ) : (
          <Skel x={0} y={4} w={56} h={12} />
        )}
      </span>
      {(
        [
          [1096, LOAD_HEADER.cols.price],
          [1185, LOAD_HEADER.cols.liquidity],
          [1266, LOAD_HEADER.cols.supply],
          [1327, LOAD_HEADER.cols.fees],
          [1436, LOAD_HEADER.cols.curve],
        ] as const
      ).map(([x, label]) => (
        <span key={label} style={{ position: "absolute", left: x, top: 100 }}>
          <T size={11} color="#8b8e97">
            {label}
          </T>
        </span>
      ))}
      <span style={{ position: "absolute", left: 1096, top: 118 }}>
        {cols.price.length ? (
          <SubZero parts={cols.price} color="#c6c9d2" size={12} weight={600} />
        ) : (
          <Skel x={0} y={2} w={40} h={9} />
        )}
      </span>
      <span style={{ position: "absolute", left: 1185, top: 118 }}>
        {cols.liq ? (
          <T size={12} weight={600} color="#c6c9d2">
            {cols.liq} 🔒
          </T>
        ) : (
          <Skel x={0} y={2} w={40} h={9} />
        )}
      </span>
      <span style={{ position: "absolute", left: 1266, top: 118 }}>
        {cols.supply ? (
          <T size={12} weight={600} color="#c6c9d2">
            {cols.supply} ↻
          </T>
        ) : (
          <Skel x={0} y={2} w={26} h={9} />
        )}
      </span>
      <span style={{ position: "absolute", left: 1327, top: 118 }}>
        {cols.fees ? (
          <>
            <Bars size={10} color="#3ED6C5" />{" "}
            <T size={12} weight={600} color="#c6c9d2">
              {cols.fees}
            </T>
          </>
        ) : (
          <Skel x={0} y={2} w={40} h={9} />
        )}
      </span>
      <span style={{ position: "absolute", left: 1436, top: 118 }}>
        {cols.curve ? (
          <T size={12} weight={600} color="#3ED6C5">
            {cols.curve} ⟳
          </T>
        ) : (
          <Skel x={0} y={2} w={30} h={9} />
        )}
      </span>
      {[1538, 1568].map((x, i) => (
        <svg key={x} width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: x, top: 107 }}>
          {i === 0 ? (
            <circle cx="7" cy="7" r="2.4" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
          ) : (
            <rect x="1.5" y="2.5" width="11" height="9" rx="1.5" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
          )}
        </svg>
      ))}

      {/* ── chart area ── */}
      <div style={{ position: "absolute", left: 0, top: 140, width: 1596, height: 830, background: C.loadPageBg }} />
      {blue ? (
        <div style={{ position: "absolute", left: 0, top: 140, width: 1596, height: 830, background: C.blueFlash }} />
      ) : null}
      {padre ? (
        <div style={{ position: "absolute", left: 0, top: 140, width: 1596, height: 830, background: "#0e1116" }}>
          {/* toolbar strip */}
          <div style={{ position: "absolute", left: 0, top: 8, width: 1596, height: 30, background: "#12151b" }}>
            {LOAD_PADRE.timeframes.map((tf, i) => (
              <span key={tf} style={{ position: "absolute", left: 10 + i * 26, top: 9 }}>
                <T size={12} weight={600} color={i === 0 ? "#4a7dd8" : "#8b8e97"}>
                  {tf}
                </T>
              </span>
            ))}
            <span style={{ position: "absolute", left: 150, top: 9 }}>
              <T size={12} color="#c6c9d2">
                {LOAD_PADRE.indicators}
              </T>
            </span>
            <span style={{ position: "absolute", left: 245, top: 9 }}>
              <T size={12} color="#c6c9d2">
                {LOAD_PADRE.priceMcap.prefix}<span style={{ color: "#4a7dd8" }}>{LOAD_PADRE.priceMcap.active}</span>
              </T>
            </span>
            <span style={{ position: "absolute", left: 340, top: 9 }}>
              <T size={12} color="#c6c9d2">
                {LOAD_PADRE.display}
              </T>
            </span>
            <span style={{ position: "absolute", left: 1385, top: 9 }}>
              <T size={12} color="#c6c9d2">
                {LOAD_PADRE.layout}
              </T>
            </span>
          </div>
          {/* OHLC line */}
          <span style={{ position: "absolute", left: 60, top: 55 }}>
            <T size={12} color="#c6c9d2">
              {LOAD_PADRE.symbolLine}{" "}
            </T>
            <T size={12} color="#8b8e97">
              O
            </T>
            <T size={12} color="#3ED6C5">
              {LOAD_PADRE.ohlc.o}{" "}
            </T>
            <T size={12} color="#8b8e97">
              H
            </T>
            <T size={12} color="#3ED6C5">
              {LOAD_PADRE.ohlc.h}{" "}
            </T>
            <T size={12} color="#8b8e97">
              L
            </T>
            <T size={12} color="#3ED6C5">
              {LOAD_PADRE.ohlc.l}{" "}
            </T>
            <T size={12} color="#8b8e97">
              C
            </T>
            <T size={12} color="#3ED6C5">
              {LOAD_PADRE.ohlc.c} {LOAD_PADRE.ohlc.d} ({LOAD_PADRE.ohlc.dp})
            </T>
          </span>
          {/* left tool strip */}
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              style={{ position: "absolute", left: 16, top: 90 + i * 46, width: 14, height: 14, borderRadius: 3, border: "1px solid #3a3e49" }}
            />
          ))}
          {/* migration label */}
          <span style={{ position: "absolute", left: 1416, top: 72 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.migration}
            </T>
          </span>
          {/* green candle */}
          <div
            style={{
              position: "absolute",
              left: 1352,
              top: candleTop - 140,
              width: 7,
              height: 850 - candleTop + 140 > 0 ? 850 - (candleTop - 140) - 140 : 2,
              background: "#2BB48A",
            }}
          />
          {/* avg fill price */}
          <div
            style={{
              position: "absolute",
              left: 48,
              top: 637,
              width: 1470,
              height: 1,
              backgroundImage: "repeating-linear-gradient(90deg,#3ED6C5 0 6px,transparent 6px 12px)",
            }}
          />
          <span style={{ position: "absolute", left: 1345, top: 626 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.avgFill}
            </T>
          </span>
          <div style={{ position: "absolute", left: 1522, top: 629, padding: "2px 5px", background: "#3ED6C5", borderRadius: 2 }}>
            <T size={11} weight={600} color="#0B1418">
              {LOAD_PADRE.avgFillChip}
            </T>
          </div>
          {/* chips right */}
          <div style={{ position: "absolute", left: 1522, top: 72, padding: "2px 5px", background: "#3a3e49", borderRadius: 2 }}>
            <T size={11} color="#e4e7ee">
              {LOAD_PADRE.priceChip}
            </T>
          </div>
          <div style={{ position: "absolute", left: 1498, top: 96, padding: "2px 5px", background: "#20232b", borderRadius: 2 }}>
            <T size={11} color="#c6c9d2">
              {LOAD_PADRE.highChip}
            </T>
          </div>
          <div style={{ position: "absolute", left: 1522, top: 118, padding: "2px 5px", background: "#2BB48A", borderRadius: 2 }}>
        <T size={11} weight={600} color="#0B1418">
              {LOAD_PADRE.lastChip}
            </T>
          </div>
          <div style={{ position: "absolute", left: 1500, top: 700, padding: "2px 5px", background: "#20232b", borderRadius: 2 }}>
            <T size={11} color="#c6c9d2">
              {LOAD_PADRE.lowChip}
            </T>
          </div>
          {/* time labels */}
          <span style={{ position: "absolute", left: 780, top: 772 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.timeLabels[0]}
            </T>
          </span>
          <span style={{ position: "absolute", left: 862, top: 772 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.timeLabels[1]}
            </T>
          </span>
          <span style={{ position: "absolute", left: 20, top: 802 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.footRanges}
            </T>
          </span>
          <span style={{ position: "absolute", left: 1380, top: 802 }}>
            <T size={11} color="#8b8e97">
              {LOAD_PADRE.footClock}<span style={{ color: "#4a7dd8" }}>{LOAD_PADRE.footAuto}</span>
            </T>
          </span>
        </div>
      ) : null}

      {/* ── trade popup ── */}
      {/* tabs strip */}
      <div style={{ position: "absolute", left: 128, top: 373, width: 316, height: 24, background: "#181B22", borderRadius: "6px 6px 0 0", border: "1px solid #262A32", display: "flex", alignItems: "center", paddingLeft: 8, gap: 16 }}>
        {LOAD_POPUP.tabs.map((t, i) => (
          <T key={t} size={11.5} weight={600} color={i === 0 ? "#cfd2da" : "#8b8e97"}>
            {t}
          </T>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 128,
          top: 397,
          width: 316,
          height: 341,
          background: C.popupBg,
          border: `1px solid ${C.popupBorder}`,
          borderRadius: "0 0 8px 8px",
          boxShadow: "0 8px 26px rgba(0,0,0,0.45)",
        }}
      />
      {/* header icons row */}
      <div style={{ position: "absolute", left: 140, top: 408, width: 292, height: 20 }}>
        {/* wallet chip */}
        <div style={{ position: "absolute", left: 0, top: 0, height: 19, padding: "0 7px", borderRadius: 5, border: "1px solid #343946", display: "flex", alignItems: "center", gap: 4 }}>
          <svg width={10} height={10} viewBox="0 0 10 10">
            <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          </svg>
          {walletsLoaded ? (
            <T size={11} weight={600} color="#c6c9d2">
              {LOAD_POPUP.walletCount}
            </T>
          ) : (
            <Skel x={0} y={5} w={14} h={8} />
          )}
        </div>
        {[44, 74].map((x, i) => (
          <svg key={x} width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: x, top: 3 }}>
            {i === 0 ? (
              <rect x="1.5" y="1.5" width="11" height="11" rx="2" stroke="#8b8e97" strokeWidth="1.1" fill="none" />
            ) : (
              <path d="M2 11 6 7l2 2 4-5" stroke="#8b8e97" strokeWidth="1.2" fill="none" />
            )}
          </svg>
        ))}
        <svg width={13} height={13} viewBox="0 0 14 14" style={{ position: "absolute", left: 128, top: 3 }}>
          <path d="M2 12 3 9l6.5-6.5a1.4 1.4 0 0 1 2 2L5 11Z" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
        {LOAD_POPUP.presetsLabels.map((p, i) => (
          <span key={p} style={{ position: "absolute", left: 160 + i * 30, top: 4 }}>
            <T size={12.5} weight={600} color={i === 2 ? C.purpleText : C.textMid}>
              {p}
            </T>
          </span>
        ))}
        <svg width={12} height={13} viewBox="0 0 12 14" style={{ position: "absolute", left: 258, top: 3 }}>
          <path d="M6 1C7.5 4 10 5.5 10 9a4 4 0 0 1-8 0C2 5.5 4.5 4 6 1Z" stroke="#c76a35" strokeWidth="1.2" fill="none" />
        </svg>
        <span style={{ position: "absolute", left: 282, top: 3 }}>
          <T size={13} color={C.textMid}>
            ✕
          </T>
        </span>
      </div>

      {/* Buy row */}
      <div style={{ position: "absolute", left: 142, top: 447, width: 288, height: 16 }}>
        <T size={13.5} weight={600} color="#e9ecf3">
          {LOAD_POPUP.buy}
        </T>
        <span style={{ position: "absolute", right: 0, top: 1, whiteSpace: "nowrap" }}>
          <T size={13} weight={600} color="#e9ecf3">
            {compactPopup ? solTotal : "0.00"}{" "}
          </T>
          <Bars size={11} />
        </span>
      </div>
      {/* buy presets */}
      {compactPopup ? (
        LOAD_POPUP.buyPresets.map((row, r) =>
          row.map((v, i) => (
            <div
              key={`b${r}${i}`}
              style={{
                position: "absolute",
                left: 142 + i * 74,
                top: r === 0 ? 473 : 513,
                width: 66,
                height: 26,
                borderRadius: 13,
                border: `1px solid ${C.tealDim}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={12.5} weight={600} color={C.pos}>
                {v}
              </T>
            </div>
          )),
        )
      ) : (
        <>
          {LOAD_POPUP.buyPresets[0].map((v, i) => (
            <div
              key={`bb${i}`}
              style={{
                position: "absolute",
                left: 142 + i * 76,
                top: 462,
                width: 68,
                height: 62,
                borderRadius: 10,
                border: `1px solid ${C.tealDim}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={13} weight={600} color={C.pos}>
                {v}
              </T>
            </div>
          ))}
        </>
      )}
      {/* buy settings */}
      <div style={{ position: "absolute", left: 142, top: compactPopup ? 547 : 536, whiteSpace: "nowrap" }}>
        <T size={10.5} color={C.textMid}>
          ⛽ {LOAD_POPUP.buySettings.gas}{"   "}◎ {LOAD_POPUP.buySettings.tip}{"   "}⚖ {LOAD_POPUP.buySettings.pct}{"   "}🛡 {LOAD_POPUP.buySettings.shield}
        </T>
      </div>

      {/* Sell row */}
      <div style={{ position: "absolute", left: 142, top: 576, width: 288, height: 16 }}>
        <T size={13.5} weight={600} color="#e9ecf3">
          {LOAD_POPUP.sell}
        </T>
        <svg width={11} height={11} viewBox="0 0 12 12" style={{ position: "absolute", left: 46, top: 2 }}>
          <path d="M2 4h7M7 2l2 2-2 2M10 8H3M5 6 3 8l2 2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
        <span style={{ position: "absolute", right: 0, top: 1, whiteSpace: "nowrap" }}>
          <T size={12.5} weight={600} color="#e9ecf3">
            {sellVal}{" "}
          </T>
          <Bars size={11} />
          <T size={12.5} weight={500} color="#c6c9d2">
            {" "}
            {tokenAmt || "0.00"} {LOAD_POPUP.pumpwheel}
          </T>
        </span>
      </div>
      {/* sell presets */}
      {compactPopup ? (
        LOAD_POPUP.sellPresets.map((row, r) =>
          row.map((v, i) => (
            <div
              key={`s${r}${i}`}
              style={{
                position: "absolute",
                left: 142 + i * 74,
                top: r === 0 ? 604 : 643,
                width: 66,
                height: 26,
                borderRadius: 13,
                border: `1px solid ${C.negDim}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={12.5} weight={600} color={C.neg}>
                {v}
              </T>
            </div>
          )),
        )
      ) : (
        <>
          {LOAD_POPUP.sellPresets[0].map((v, i) => (
            <div
              key={`sb${i}`}
              style={{
                position: "absolute",
                left: 142 + i * 76,
                top: 584,
                width: 68,
                height: 62,
                borderRadius: 10,
                border: `1px solid ${C.negDim}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T size={12.5} weight={600} color={C.neg}>
                {v}
              </T>
            </div>
          ))}
        </>
      )}
      {/* sell settings */}
      <div style={{ position: "absolute", left: 142, top: compactPopup ? 676 : 658, whiteSpace: "nowrap" }}>
        <T size={10.5} color={C.textMid}>
          ⛽ {LOAD_POPUP.sellSettings.gas}{"   "}◎ {LOAD_POPUP.sellSettings.tip}{"   "}⚖ {LOAD_POPUP.sellSettings.pct}{"   "}∅ {LOAD_POPUP.sellSettings.off}
        </T>
        <span style={{ marginLeft: 40 }}>
          <T size={10.5} weight={600} color={C.neg}>
            {LOAD_POPUP.sellSettings.init}
          </T>
        </span>
      </div>
      {/* popup footer */}
      <div style={{ position: "absolute", left: 129, top: 698, width: 314, height: 34, borderTop: `1px solid ${C.divider}` }}>
        {footer ? (
          <>
            {[
              { x: 14, v: footer[0], c: "#e9ecf3" },
              { x: 90, v: footer[1], c: "#e9ecf3" },
              { x: 158, v: footer[2], c: "#e9ecf3" },
            ].map((s, i) => (
              <span key={i} style={{ position: "absolute", left: s.x, top: 11, whiteSpace: "nowrap" }}>
                <T size={12.5} weight={600} color={s.c}>
                  {s.v}
                </T>{" "}
                <Bars size={10} />
              </span>
            ))}
            <span style={{ position: "absolute", left: 226, top: 11, whiteSpace: "nowrap" }}>
              <T size={12.5} weight={600} color={footer[3].startsWith("-") ? C.neg : C.pos}>
                {footer[3]}
              </T>{" "}
              <Bars size={10} />
              <T size={12.5} weight={600} color={footer[3].startsWith("-") ? C.neg : C.pos}>
                {" "}
                {footer[4]}
              </T>
            </span>
          </>
        ) : (
          <>
            <Skel x={14} y={13} w={44} />
            <Skel x={90} y={13} w={40} />
            <Skel x={158} y={13} w={44} />
            <Skel x={230} y={13} w={64} />
          </>
        )}
      </div>

      {/* ── right rail dialog ── */}
      <div style={{ position: "absolute", left: 1596, top: 84, width: 324, height: 996, background: C.railBg }} />
      {/* rail gear (floats above tabs) */}
      <svg width={14} height={14} viewBox="0 0 14 14" style={{ position: "absolute", left: railX, top: 160 }}>
        <circle cx="7" cy="7" r="2.4" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        <path d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.2 3.2l1.4 1.4M9.4 9.4l1.4 1.4M10.8 3.2 9.4 4.6M4.6 9.4 3.2 10.8" stroke="#8b8e97" strokeWidth="1.1" />
      </svg>
      {/* tabs */}
      <div style={{ position: "absolute", left: railX, top: 188, display: "flex", gap: 10 }}>
        {LOAD_DIALOG.tabs.map((t, i) => (
          <div
            key={t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "0 8px",
              height: 20,
              borderRadius: 4,
              background: i === 0 ? "#22262e" : "transparent",
              border: i === 0 ? "1px solid #343946" : "1px solid transparent",
            }}
          >
            <svg width={9} height={9} viewBox="0 0 10 10">
              <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke="#8d85cf" strokeWidth="1.3" />
            </svg>
            <T size={10.5} weight={600} color={i === 0 ? "#cfd2da" : C.textMid}>
              {t}
            </T>
          </div>
        ))}
      </div>
      {/* wallet selector row */}
      <div style={{ position: "absolute", left: railX, top: 218, width: 296, height: 24, borderRadius: 6, background: "#20232b", display: "flex", alignItems: "center", paddingLeft: 8, gap: 6 }}>
        <svg width={11} height={11} viewBox="0 0 10 10">
          <rect x="1" y="2.5" width="8" height="6" rx="1.5" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
        </svg>
        {walletsLoaded ? (
          <>
            <T size={11.5} color="#c6c9d2">
              {LOAD_DIALOG.walletsSelected}
            </T>
            <Img src={staticFile("realist-assets/ui/pump-avatar.png")} style={{ width: 12, height: 12, borderRadius: 6 }} />
            <T size={11.5} weight={600} color="#e9ecf3">
              143.00M
            </T>
            <span style={{ marginLeft: 26 }}>
              <T size={11.5} weight={600} color="#e9ecf3">
                {solTotal}
              </T>{" "}
              <Bars size={10} />
            </span>
          </>
        ) : (
          <>
            <Skel x={22} y={8} w={110} h={8} />
            <Skel x={168} y={8} w={54} h={8} />
            <Skel x={232} y={8} w={30} h={8} />
          </>
        )}
        <span style={{ position: "absolute", right: 8, top: 5 }}>
          <T size={10} color="#8b8e97">
            ▾
          </T>
        </span>
      </div>
      {/* buy/sell/market segmented */}
      <div style={{ position: "absolute", left: railX, top: 254, width: 296, height: 26, display: "flex", gap: 4 }}>
        <div style={{ width: 92, height: 26, borderRadius: 6, background: C.teal, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <T size={12} weight={700} color={C.onTeal}>
            {LOAD_DIALOG.buy}
          </T>
        </div>
        <div style={{ width: 92, height: 26, borderRadius: 6, background: "#20232b", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <T size={12} weight={600} color="#c6c9d2">
            {LOAD_DIALOG.sell}
          </T>
        </div>
        <div style={{ width: 104, height: 26, borderRadius: 6, background: "#20232b", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <T size={12} weight={600} color="#c6c9d2">
            {LOAD_DIALOG.market}
          </T>
          <T size={9} color="#8b8e97">
            ▾
          </T>
        </div>
      </div>
      {/* total input */}
      <div style={{ position: "absolute", left: railX, top: 296, width: 296, height: 28, borderRadius: 6, background: "#1d2027", border: "1px solid #262A32", display: "flex", alignItems: "center", padding: "0 9px" }}>
        <T size={12} color="#8b8e97">
          {LOAD_DIALOG.total}
        </T>
        <span style={{ marginLeft: "auto" }}>
          <T size={12} color="#5e626e">
            {LOAD_DIALOG.totalZero}
          </T>{" "}
          <T size={12} weight={600} color="#c6c9d2">
            {LOAD_DIALOG.totalUnit}
          </T>
        </span>
      </div>
      {/* presets */}
      <div style={{ position: "absolute", left: railX, top: 337, width: 296, height: 24, display: "flex", gap: 5 }}>
        {LOAD_DIALOG.presets.map((p) => (
          <div key={p} style={{ width: 64, height: 24, borderRadius: 5, background: "#1d2027", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <T size={11.5} weight={600} color="#c6c9d2">
              {p}
            </T>
          </div>
        ))}
        <div style={{ width: 24, height: 24, borderRadius: 5, background: "#1d2027", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={11} height={11} viewBox="0 0 14 14">
            <path d="M2 12 3 9l6.5-6.5a1.4 1.4 0 0 1 2 2L5 11Z" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
          </svg>
        </div>
      </div>
      {/* exit strategy */}
      <div style={{ position: "absolute", left: railX, top: 379, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 13, height: 13, borderRadius: 3, border: "1.3px solid #5e626e" }} />
        <T size={12} color="#c6c9d2">
          {LOAD_DIALOG.exitStrategy}
        </T>
      </div>
      {/* select preset message */}
      <div style={{ position: "absolute", left: railX, top: 406, width: 296, textAlign: "center" }}>
        <T size={11.5} weight={600} color={C.yellow}>
          ↑ {LOAD_DIALOG.selectPreset}
        </T>
      </div>
      {/* gas button */}
      <div style={{ position: "absolute", left: railX, top: 438, width: 296, height: 38, borderRadius: 19, background: C.loadTealBtn, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <T size={13.5} weight={700} color="#0e2a22">
          {LOAD_DIALOG.gasButton}
        </T>
      </div>
      {/* 5M/1H/6H/24H */}
      {LOAD_DIALOG.statCols.map((s, i) => (
        <div key={s} style={{ position: "absolute", left: railX + 12 + i * 74, top: 496, textAlign: "center", width: 56 }}>
          <div>
            <T size={11} color="#8b8e97">
              {s}
            </T>
          </div>
          <div style={{ marginTop: 6 }}>
            <T size={11.5} weight={600} color={frame >= 387 ? C.pos : "#5e626e"}>
              {frame >= 387 ? "+584.7%" : frame >= 381 ? LOAD_DIALOG.statZero : LOAD_DIALOG.statDash}
            </T>
          </div>
        </div>
      ))}
      {/* token data & security */}
      <div style={{ position: "absolute", left: railX, top: 550 }}>
        <T size={12.5} weight={600} color="#e9ecf3">
          {LOAD_DIALOG.tokenData}
        </T>
      </div>
      <span style={{ position: "absolute", left: railX + 284, top: 550 }}>
        <T size={10} color="#8b8e97">
          ⌃
        </T>
      </span>
      {/* cards */}
      {cards.phase === "dash" ? (
        <>
          {LOAD_DIALOG.cardLabels4.map((l, i) => (
            <Card
              key={l}
              x={railX + 4 + (i % 3) * 104}
              y={582 + Math.floor(i / 3) * 67}
              label={l}
              value="-"
              vColor="#8b8e97"
            />
          ))}
        </>
      ) : (
        <>
          {[
            { l: LOAD_DIALOG.cardLabels10[0], v: cards.top10, c: cards.top10Neg ? C.yellow : C.pos },
            { l: LOAD_DIALOG.cardLabels10[1], v: "9.75%", c: C.pos },
            { l: LOAD_DIALOG.cardLabels10[2], v: "4%", c: C.pos, badge: LOAD_DIALOG.snipersBadge },
            { l: LOAD_DIALOG.cardLabels10[3], v: "10%", c: C.yellow },
            { l: LOAD_DIALOG.cardLabels10[4], v: "0%", c: C.pos },
            { l: LOAD_DIALOG.cardLabels10[5], v: "100%", c: C.pos },
            { l: LOAD_DIALOG.cardLabels10[6], v: "0", c: C.pos },
            { l: LOAD_DIALOG.cardLabels10[7], v: "0%", c: C.pos },
            { l: LOAD_DIALOG.cardLabels10[8], v: LOAD_DIALOG.no, c: C.neg },
            { l: LOAD_DIALOG.cardLabels10[9], v: LOAD_DIALOG.no, c: C.pos },
          ]
            .slice(0, cards.phase === "partial" ? 6 : 10)
            .map((card, i) => (
              <Card
                key={card.l}
                x={railX + 4 + (i % 3) * 104}
                y={582 + Math.floor(i / 3) * 67}
                label={card.l}
                value={card.v}
                vColor={card.c}
                badge={card.badge}
              />
            ))}
        </>
      )}
      {/* CA / DA rows — y depends on card grid height */}
      {(() => {
        const gridRows = cards.phase === "dash" ? 2 : cards.phase === "partial" ? 2 : 4;
        const caY = 582 + gridRows * 67 + 9;
        return (
          <>
            <div style={{ position: "absolute", left: railX, top: caY, width: 296, height: 26, borderRadius: 6, background: "#1d2027", display: "flex", alignItems: "center", paddingLeft: 8 }}>
              <T size={11} color="#c6c9d2">
                {LOAD_DIALOG.ca}
              </T>
              <span style={{ marginLeft: "auto", marginRight: 8 }}>
                <T size={10.5} color="#8b8e97">
                  ◎ 🔍
                </T>
              </span>
            </div>
            <div style={{ position: "absolute", left: railX, top: caY + 47, width: 296, height: 26, borderRadius: 6, background: "#1d2027", display: "flex", alignItems: "center", paddingLeft: 8 }}>
              <T size={11} color="#c6c9d2">
                {LOAD_DIALOG.da}
              </T>
              <span style={{ marginLeft: "auto", marginRight: 8 }}>
                <T size={10.5} color="#8b8e97">
                  ◎ 🔍
                </T>
              </span>
            </div>
            <div style={{ position: "absolute", left: railX, top: caY + 105 }}>
              <T size={12.5} weight={600} color="#e9ecf3">
                {LOAD_DIALOG.similar}
              </T>
            </div>
            <div style={{ position: "absolute", left: railX + 220, top: caY + 101, height: 20, padding: "0 7px", borderRadius: 5, background: "#20232b", display: "flex", alignItems: "center", gap: 4 }}>
              <T size={10.5} weight={600} color="#c6c9d2">
                {LOAD_DIALOG.similarSort}
              </T>
              <svg width={10} height={10} viewBox="0 0 12 12">
                <path d="M2 4h7M7 2l2 2-2 2M10 8H3M5 6 3 8l2 2" fill="none" stroke="#8b8e97" strokeWidth="1.2" />
              </svg>
            </div>
            {frame >= 387 ? (
              <div style={{ position: "absolute", left: railX, top: caY + 131, width: 296, height: 56, borderRadius: 6, background: "#1d2027" }}>
                <Img src={staticFile("realist-assets/ui/pump-avatar.png")} style={{ position: "absolute", left: 8, top: 8, width: 40, height: 40, borderRadius: 5 }} />
                <span style={{ position: "absolute", left: 58, top: 10 }}>
                  <T size={11.5} weight={600} color="#e9ecf3">
                    Pumpwheel
                  </T>{" "}
                  <T size={11.5} color="#8b8e97">
                    The Pumpf...
                  </T>
                </span>
                <span style={{ position: "absolute", left: 58, top: 32 }}>
                  <T size={10.5} color="#C9A227">
                    ● 1m
                  </T>
                </span>
                <span style={{ position: "absolute", right: 10, top: 6, textAlign: "right" }}>
                  <T size={10.5} color="#c6c9d2">
                    $6K Liq
                  </T>
                </span>
                <span style={{ position: "absolute", right: 10, top: 22 }}>
                  <T size={10.5} color="#c6c9d2">
                    $2K Vol
                  </T>
                </span>
                <span style={{ position: "absolute", right: 10, top: 38 }}>
                  <T size={10.5} weight={600} color={C.tealText}>
                    $3K MC
                  </T>
                </span>
              </div>
            ) : null}
          </>
        );
      })()}

      {/* ── toasts top-right ── */}
      <OrderToast y={12} done={false} phase={spin} />
      <OrderToast y={95} done={toastPhase === "b"} phase={spin + 120} />

      {/* ── bottom band ── */}
      <div style={{ position: "absolute", left: 0, top: 970, width: 1596, height: 110, background: "#14161c", borderTop: "1px solid #20232b" }} />
      {LOAD_BOTTOM.tabs.map((t, i) => {
        const label =
          t === "Holders"
            ? `${t} (${holders})`
            : t === "Dev Tokens"
              ? `${t} (${LOAD_BOTTOM.devTokensCount})`
              : t;
        return (
          <span key={t} style={{ position: "absolute", left: [24, 95, 185, 276, 392, 496][i], top: 972 }}>
            <T size={12.5} weight={i === 0 ? 600 : 500} color={i === 0 ? "#e9ecf3" : "#8b8e97"}>
              {label}
            </T>
          </span>
        );
      })}
      <div style={{ position: "absolute", left: 24, top: 1000, width: 42, height: 2, background: "#5F58B0" }} />
      {/* instant trade pill */}
      <div style={{ position: "absolute", left: 1425, top: 966, height: 24, padding: "0 12px", borderRadius: 12, background: C.teal, display: "flex", alignItems: "center", gap: 5 }}>
        <T size={11.5} weight={700} color={C.onTeal}>
          ⚡ {LOAD_BOTTOM.instantTrade}
        </T>
      </div>
      {/* feed row */}
      <span style={{ position: "absolute", left: 24, top: 1008 }}>
        <T size={11.5} weight={500} color="#3ED6C5">
          {LOAD_BOTTOM.feedLive}
        </T>
      </span>
      <span style={{ position: "absolute", left: 1358, top: 1008, whiteSpace: "nowrap" }}>
        <T size={11.5} color="#8b8e97">
          {LOAD_BOTTOM.filter}
        </T>
        {LOAD_BOTTOM.filters.map((f, i) => (
          <T key={f} size={11.5} weight={i === 0 ? 600 : 500} color={i === 0 ? "#4a7dd8" : "#8b8e97"} style={{ marginLeft: 12 }}>
            {f}
          </T>
        ))}
      </span>
      {/* table head */}
      {(
        [
          [14, `${LOAD_BOTTOM.tableHead.age} ↓`],
          [92, LOAD_BOTTOM.tableHead.tipPrio],
          [163, LOAD_BOTTOM.tableHead.side],
          [405, LOAD_BOTTOM.tableHead.mcap],
          [660, LOAD_BOTTOM.tableHead.amount],
          [745, `▼ ${LOAD_BOTTOM.tableHead.totalUsd}`],
          [1015, LOAD_BOTTOM.tableHead.totalSol],
          [1505, `▼ ${LOAD_BOTTOM.tableHead.maker}`],
        ] as const
      ).map(([x, label]) => (
        <span key={x} style={{ position: "absolute", left: x, top: 1039 }}>
          <T size={11.5} color="#8b8e97">
            {label}
          </T>
        </span>
      ))}
    </AbsoluteFill>
  );
};
