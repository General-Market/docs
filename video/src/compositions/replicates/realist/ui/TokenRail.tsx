import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";
import { COLORS as C, RAIL, POPUP, MIGRATE, PRESET3_STYLE } from "./copy/token";
import {
  sampleAt,
  stats24Table,
  posStatsTable,
  tokenInfoTable,
  buyTotalTable,
} from "./timeline-token";
import type { TokenInfo } from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, -apple-system, sans-serif`;

// skeleton shimmer-bar fill (dim, matches f0420 placeholder bars)
const SKEL = "#23262E";

// rail content box: x 1641…1915 (bg panel starts at 1632, frame ends 1920)
const X0 = 1641;
const X1 = 1915;
const RW = X1 - X0; // 274

// ---------------------------------------------------------------------------
// Local primitives (same idiom as TrenchesScreen — deliberately re-declared).
// ---------------------------------------------------------------------------

const T: React.FC<{
  size: number;
  color: string;
  weight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size, color, weight = 400, style, children }) => (
  // the 1px same-color shadow mimics the plates' JPEG stroke bleed (r3;
  // crisp strokes overshoot the soft plate and cost SSIM)
  <span style={{ fontSize: size, color, fontWeight: weight, lineHeight: 1, textShadow: `0 0 1px ${color}`, ...style }}>
    {children}
  </span>
);

const Row: React.FC<{ gap?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  gap = 6,
  style,
  children,
}) => <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;

// SOL "≡" mark (three slanted bars). Default = the plate's vertical
// teal→blue→purple gradient (r3); pass color to tint solid.
const SolBars: React.FC<{ size?: number; color?: string }> = ({ size = 11, color }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3.5 3 H13 L11.5 5.2 H2 Z" fill={color ?? C.barsTop} />
    <path d="M2 6.9 H11.5 L13 9.1 H3.5 Z" fill={color ?? C.barsMid} />
    <path d="M3.5 10.8 H13 L11.5 13 H2 Z" fill={color ?? C.barsBot} />
  </svg>
);

// subscript-zero price notation: 0.0₃2
const SubNum: React.FC<{ parts: readonly string[]; size: number; color: string; weight?: number }> = ({
  parts,
  size,
  color,
  weight = 600,
}) => (
  <span style={{ fontSize: size, color, fontWeight: weight, lineHeight: 1 }}>
    {parts[0]}
    <span style={{ fontSize: size * 0.72, verticalAlign: "-0.25em" }}>{parts[1]}</span>
    {parts[2]}
  </span>
);

const Skel: React.FC<{ x: number; y: number; w: number; h: number; r?: number }> = ({
  x,
  y,
  w,
  h,
  r = 4,
}) => (
  <div
    style={{ position: "absolute", left: x, top: y, width: w, height: h, borderRadius: r, background: SKEL }}
  />
);

// ---------------------------------------------------------------------------
// Small glyph set (12–14px line icons, TrenchesScreen vocabulary)
// ---------------------------------------------------------------------------

const Glyph: React.FC<{ kind: string; size?: number; color?: string }> = ({
  kind,
  size = 12,
  color = C.textMid,
}) => {
  const sw = 1.4;
  const common = { width: size, height: size, viewBox: "0 0 16 16", style: { display: "block" } };
  switch (kind) {
    case "chevron":
      return (
        <svg {...common}>
          <path d="M4.5 6.5 L8 10 L11.5 6.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M13 8 A5 5 0 1 1 11.5 4.5 M11.5 4.5 L11.5 1.8 M11.5 4.5 L8.8 4.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <rect x="2" y="4" width="12" height="9" rx="2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M10 8.5 H14" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path d="M3 13 L3.6 10.4 L10.8 3.2 A1.4 1.4 0 0 1 12.8 5.2 L5.6 12.4 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "swapV":
      return (
        <svg {...common}>
          <path d="M5.5 3 L5.5 12 M5.5 12 L3.2 9.7 M5.5 12 L7.8 9.7" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 13 L10.5 4 M10.5 4 L8.2 6.3 M10.5 4 L12.8 6.3" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "gas":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="10.5" rx="1.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M4.6 5 H8.4 V8 H4.6 Z" fill={color} opacity={0.8} />
          <path d="M10 6 L12.5 8 L12.5 12.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "candy":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="3.4" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M11 6 L14 4.5 L13 8 M5 10 L2 11.5 L3 8" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "slash":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.2" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="4.5" y1="11.5" x2="11.5" y2="4.5" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "warn":
      return (
        <svg {...common}>
          <path d="M8 2.5 L14.5 13 L1.5 13 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="8" y1="6.5" x2="8" y2="9.6" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="0.8" fill={color} />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="8" cy="5.5" r="2.6" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M3.5 13.5 C4 10.5 6 9.5 8 9.5 C10 9.5 12 10.5 12.5 13.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "chef":
      return (
        <svg {...common}>
          <path d="M4.5 8.5 A2.6 2.6 0 0 1 5 3.6 A3.2 3.2 0 0 1 11 3.6 A2.6 2.6 0 0 1 11.5 8.5 L11.5 12.5 L4.5 12.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="4.5" y1="10.4" x2="11.5" y2="10.4" stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.6" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="1.4" fill={color} />
          <path d="M8 1.5 L8 4 M8 12 L8 14.5 M1.5 8 L4 8 M12 8 L14.5 8" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M8 2 L13 4 L13 8.5 C13 11.5 10.8 13.4 8 14.2 C5.2 13.4 3 11.5 3 8.5 L3 4 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M5.8 8 L7.4 9.6 L10.4 6.4" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cluster":
      return (
        <svg {...common}>
          <circle cx="5.4" cy="6" r="2.1" fill={color} />
          <circle cx="10.6" cy="6" r="2.1" fill={color} />
          <circle cx="8" cy="10.5" r="2.1" fill={color} />
        </svg>
      );
    case "droplet":
      return (
        <svg {...common}>
          <path d="M8 2 C10.5 5.4 12 7.5 12 9.6 A4 4 0 0 1 4 9.6 C4 7.5 5.5 5.4 8 2 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "people":
      return (
        <svg {...common}>
          <circle cx="5.5" cy="5.5" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="10.5" cy="5.5" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M2 13 C2.5 10.5 4 9.5 5.5 9.5 M8 13.5 C8.5 10.5 9.5 9.5 10.5 9.5 C12 9.5 13.5 10.5 14 13" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "arrowsUpDown":
      return (
        <svg {...common}>
          <path d="M5.5 12.5 L5.5 3.5 M5.5 3.5 L3.2 5.8 M5.5 3.5 L7.8 5.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 3.5 L10.5 12.5 M10.5 12.5 L8.2 10.2 M10.5 12.5 L12.8 10.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "infoCircle":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.6" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="8" y1="7" x2="8" y2="11" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="8" cy="4.8" r="0.9" fill={color} />
        </svg>
      );
    case "doc":
      return (
        <svg {...common}>
          <rect x="3.5" y="2.5" width="9" height="11" rx="1.4" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M5.5 5.5 H10.5 M5.5 8 H10.5 M5.5 10.5 H8.5" stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case "pill":
      return (
        <svg {...common}>
          <rect x="2" y="5.5" width="12" height="5" rx="2.5" fill="none" stroke={color} strokeWidth={sw} transform="rotate(-35 8 8)" />
          <line x1="6" y1="9.5" x2="10" y2="6.5" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "eyeSlash":
      return (
        <svg {...common}>
          <path d="M2 8 C3.5 5 5.5 3.8 8 3.8 C10.5 3.8 12.5 5 14 8 C12.5 11 10.5 12.2 8 12.2 C5.5 12.2 3.5 11 2 8 Z" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="3.5" y1="13" x2="12.5" y2="3" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "extLink":
      return (
        <svg {...common}>
          <path d="M6.5 3.5 L3.5 3.5 L3.5 12.5 L12.5 12.5 L12.5 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 3 L13 3 L13 7 M13 3 L7.8 8.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 5 L8 8 L10.5 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "upArrow":
      return (
        <svg {...common}>
          <path d="M8 13 L8 3.5 M8 3.5 L4.5 7 M8 3.5 L11.5 7" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "swapH":
      return (
        <svg {...common}>
          <path d="M3 5.5 L12 5.5 M12 5.5 L9.7 3.2 M12 5.5 L9.7 7.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 10.5 L4 10.5 M4 10.5 L6.3 8.2 M4 10.5 L6.3 12.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

// 24h Vol / Buys / Sells / Net Vol. block, y 93–133
const Stats24Block: React.FC<{ frame: number }> = ({ frame }) => {
  const s = sampleAt(stats24Table, frame);
  const barW = RW - 4; // 1642 → 1912
  const gap = 3;
  const greenW = Math.round(s.ratio * (barW - gap));
  return (
    <>
      {/* labels — plate ink center y98.5; buys column centers at 1739 (r3) */}
      <div style={{ position: "absolute", left: X0 + 3, top: 93 }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.stats24.vol}</T>
      </div>
      <div style={{ position: "absolute", left: 1739, top: 93, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.stats24.buys}</T>
      </div>
      <div style={{ position: "absolute", left: 1812, top: 93, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.stats24.sells}</T>
      </div>
      <div style={{ position: "absolute", right: 1920 - 1912, top: 93 }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.stats24.net}</T>
      </div>
      {/* values — plate ink center y117; small-text cores probed r3 */}
      <div style={{ position: "absolute", left: X0 + 3, top: 111 }}>
        <T size={13} color={C.dimWhite} weight={600}>{s.vol}</T>
      </div>
      <div style={{ position: "absolute", left: 1740, top: 111, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
        <T size={13} color={C.dimTeal} weight={600}>{s.buysN}/{s.buysUsd}</T>
      </div>
      <div style={{ position: "absolute", left: 1812, top: 111, transform: "translateX(-50%)", whiteSpace: "nowrap" }}>
        <T size={13} color={C.dimPink} weight={600}>{s.sellsN}/{s.sellsUsd}</T>
      </div>
      <div style={{ position: "absolute", right: 1920 - 1912, top: 111 }}>
        <T size={13} color={C.dimTeal} weight={600}>{s.net}</T>
      </div>
      {/* buys/sells ratio bar — plate rows y132-134 (r3) */}
      <div style={{ position: "absolute", left: X0 + 1, top: 132, width: greenW, height: 3, borderRadius: 2, background: C.teal, opacity: 0.62 }} />
      <div
        style={{
          position: "absolute",
          left: X0 + 1 + greenW + gap,
          top: 132,
          width: Math.max(0, barW - greenW - gap),
          height: 3,
          borderRadius: 2,
          background: C.neg,
          opacity: 0.62,
        }}
      />
    </>
  );
};

// Buy / Sell tab pair + dropdown chevron, y 162–190
const BuySellTabs: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: X0, top: 162, width: 242, height: 28, borderRadius: 8, background: "#1F222B" }} />
    <div
      style={{
        position: "absolute",
        left: X0,
        top: 162,
        width: 118,
        height: 28,
        borderRadius: 8,
        background: C.teal,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T size={13} color={C.onTeal} weight={700}>{RAIL.buyTab}</T>
    </div>
    <div style={{ position: "absolute", left: 1803, top: 170, transform: "translateX(-50%)" }}>
      <T size={13} color={C.textMid} weight={600}>{RAIL.sellTab}</T>
    </div>
    <div
      style={{
        position: "absolute",
        left: 1889,
        top: 162,
        width: 26,
        height: 28,
        borderRadius: 8,
        background: "#1F222B",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Glyph kind="chevron" size={11} color={C.textMid} />
    </div>
  </>
);

// Market / Limit / Adv. + wallet chip, y 214–236
const OrderRow: React.FC<{ frame: number }> = ({ frame }) => {
  const buyTotal = sampleAt(buyTotalTable, frame);
  return (
    <>
      <div style={{ position: "absolute", left: X0, top: 215 }}>
        <T size={13} color={C.textHi} weight={600}>{RAIL.orderTabs[0]}</T>
      </div>
      <div style={{ position: "absolute", left: X0, top: 233, width: 46, height: 2, background: C.teal, borderRadius: 1 }} />
      <div style={{ position: "absolute", left: 1710, top: 215 }}>
        <T size={13} color={C.textMid} weight={500}>{RAIL.orderTabs[1]}</T>
      </div>
      <div style={{ position: "absolute", left: 1763, top: 215 }}>
        <T size={13} color={C.textMid} weight={500}>{RAIL.orderTabs[2]}</T>
      </div>
      <Row
        gap={4}
        style={{
          position: "absolute",
          right: 1920 - X1,
          top: 210,
          height: 22,
          padding: "0 6px",
          borderRadius: 6,
          border: `1px solid ${C.popupBorder}`,
        }}
      >
        <Glyph kind="wallet" size={12} color={C.textMid} />
        <T size={12} color={C.text} weight={600}>{POPUP.walletCount}</T>
        <SolBars size={10} color={C.tealText} />
        <T size={12} color={C.text} weight={600}>{buyTotal}</T>
      </Row>
    </>
  );
};

// AMOUNT input + presets + settings + checkbox (live phase), y 252–376
const AmountSection: React.FC = () => (
  <>
    {/* AMOUNT input */}
    <div style={{ position: "absolute", left: X0, top: 252, width: RW, height: 33, borderRadius: 8, background: C.inputBg }}>
      <div style={{ position: "absolute", left: 12, top: 11 }}>
        <T size={12} color={C.textMid} weight={600} style={{ letterSpacing: 0.4 }}>{RAIL.amountLabel}</T>
      </div>
      <div style={{ position: "absolute", left: 71, top: 10 }}>
        <T size={13} color={C.textMid} weight={500}>{RAIL.amountValue}</T>
      </div>
      <div style={{ position: "absolute", right: 11, top: 10 }}>
        <SolBars size={12} color={C.tealText} />
      </div>
    </div>
    {/* preset cells — plate ink center y297 (r3: was 3px low) */}
    <div style={{ position: "absolute", left: X0, top: 285, width: RW, height: 24, borderRadius: 8, background: C.cellBg, display: "flex" }}>
      {RAIL.presets.map((p, i) => (
        <div
          key={p}
          style={{
            width: 61,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderLeft: i > 0 ? `1px solid ${C.popupBorder}` : "none",
          }}
        >
          <T size={13} color={C.railPreset} weight={600}>{p}</T>
        </div>
      ))}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderLeft: `1px solid ${C.popupBorder}`,
        }}
      >
        <Glyph kind="pencil" size={12} color={C.textMid} />
      </div>
    </div>
    {/* settings row: ⇅ 50%  ⛽0.0₃2⚠  🍬0.01⚠  ∅ Off — gas/tip sand (r3) */}
    <Row gap={5} style={{ position: "absolute", left: X0 + 1, top: 322, height: 14 }}>
      <Glyph kind="swapV" size={11} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{RAIL.settings.pct}</T>
      <div style={{ width: 6 }} />
      <Glyph kind="gas" size={12} color={C.sand} />
      <SubNum parts={RAIL.settings.gas} size={11} color={C.sand} />
      <Glyph kind="warn" size={11} color={C.sand} />
      <div style={{ width: 6 }} />
      <Glyph kind="candy" size={12} color={C.sand} />
      <T size={11} color={C.sand} weight={600}>{RAIL.settings.tip}</T>
      <Glyph kind="warn" size={11} color={C.sand} />
      <div style={{ width: 6 }} />
      <Glyph kind="slash" size={11} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{RAIL.settings.off}</T>
    </Row>
    {/* Advanced Trading Strategy checkbox */}
    <Row gap={8} style={{ position: "absolute", left: X0 + 4, top: 361 }}>
      <div style={{ width: 13, height: 13, borderRadius: 3.5, border: `1.4px solid ${C.toastBorder}` }} />
      <T size={12} color={C.textMid} weight={500}>{RAIL.advCheckbox}</T>
    </Row>
  </>
);

// migrating skeleton panel (replaces AmountSection until MIGRATE_UNTIL_F)
const MigratingSection: React.FC = () => (
  <>
    <Skel x={1650} y={255} w={150} h={18} />
    <div style={{ position: "absolute", left: 1897, top: 260, width: 9, height: 9, borderRadius: 5, background: "#4A6FD8" }} />
    {/* dotted transfer row: dim squares + two token badges with »» */}
    {[1655, 1695, 1735].map((x) => (
      <Skel key={x} x={x} y={292} w={12} h={12} r={3} />
    ))}
    <div style={{ position: "absolute", left: 1749, top: 288, width: 19, height: 19, borderRadius: 10, border: "2px solid #57B58E", background: "#10231E", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Glyph kind="pill" size={9} color="#57B58E" />
    </div>
    <div style={{ position: "absolute", left: 1772, top: 293 }}>
      <T size={9} color={C.gold} weight={700}>{"»»"}</T>
    </div>
    <div style={{ position: "absolute", left: 1790, top: 288, width: 19, height: 19, borderRadius: 10, border: "2px solid #C9A227", background: "#231D10" }} />
    {[1835, 1875, 1899].map((x) => (
      <Skel key={x} x={x} y={292} w={12} h={12} r={3} />
    ))}
    {/* migrating message */}
    <div style={{ position: "absolute", left: X0, top: 312, width: RW, textAlign: "center" }}>
      {MIGRATE.message.map((line) => (
        <div key={line} style={{ marginBottom: 6 }}>
          <T size={13} color="#7A7E88" weight={500}>{line}</T>
        </div>
      ))}
    </div>
    <Skel x={1690} y={372} w={140} h={14} />
  </>
);

// big action button (plate ink y418–452 → 34 tall)
const ActionButton: React.FC<{ migrating: boolean }> = ({ migrating }) => (
  <div
    style={{
      position: "absolute",
      left: X0,
      top: 418,
      width: RW,
      height: 34,
      borderRadius: 17,
      background: migrating ? MIGRATE.snipeBg : C.teal,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <T size={15} color={migrating ? MIGRATE.snipeText : C.onTeal} weight={700}>
      {migrating ? MIGRATE.snipeLabel : RAIL.buyButton}
    </T>
  </div>
);

// Bought / Sold / Holding / PnL, y 470–532
const PosStatsRow: React.FC<{ frame: number }> = ({ frame }) => {
  const p = sampleAt(posStatsTable, frame);
  return (
    <>
      <div style={{ position: "absolute", left: 1632, right: 0, top: 470, height: 1, background: C.divider }} />
      <div style={{ position: "absolute", left: 1632, right: 0, top: 532, height: 1, background: C.divider }} />
      {[1697, 1755, 1830].map((x) => (
        <div key={x} style={{ position: "absolute", left: x, top: 480, width: 1, height: 42, background: C.divider }} />
      ))}
      {/* r4 refit from plate blobs (f0900/f1580/f1620, thr-80 column scans):
          labels cap y482-490 (top 482 not 484); values 11.5px not 13 (plate
          "10.54" ink 28px wide, digits y503-511); bought/sold/holding are
          CENTER-aligned columns (centers 1657/1720/1784 — "0" at f1620 sits
          centered, not left); pnl group is left-anchored at bars x1822. */}
      <div style={{ position: "absolute", left: 1657, top: 482, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.statLabels.bought}</T>
      </div>
      <div style={{ position: "absolute", left: 1720, top: 482, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.statLabels.sold}</T>
      </div>
      <div style={{ position: "absolute", left: 1784, top: 482, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.statLabels.holding}</T>
      </div>
      <Row gap={6} style={{ position: "absolute", left: 1873, top: 482, transform: "translateX(-50%)" }}>
        <T size={11} color={C.dimLabel} weight={500}>{RAIL.statLabels.pnl}</T>
        <Glyph kind="infoCircle" size={11} color={C.dimLabel} />
      </Row>
      <Row gap={5} style={{ position: "absolute", left: 1657, top: 501, transform: "translateX(-50%)" }}>
        <SolBars size={11} />
        <T size={11.5} color={C.dimTeal} weight={600}>{p.bought}</T>
      </Row>
      <Row gap={5} style={{ position: "absolute", left: 1720, top: 501, transform: "translateX(-50%)" }}>
        <SolBars size={11} />
        {/* sold reads pink on the plates (f0900 "169.8"), not white */}
        <T size={11.5} color={C.dimPink} weight={600}>{p.sold}</T>
      </Row>
      <Row gap={5} style={{ position: "absolute", left: 1784, top: 501, transform: "translateX(-50%)" }}>
        <SolBars size={11} />
        <T size={11.5} color={C.dimWhite} weight={600}>{p.holding}</T>
      </Row>
      <Row gap={5} style={{ position: "absolute", left: 1822, top: 501, whiteSpace: "nowrap" }}>
        <SolBars size={11} />
        <T size={11.5} color={C.dimTeal} weight={600}>
          {p.pnl} (+{p.pnlPct}%)
        </T>
      </Row>
    </>
  );
};

// PRESET 1 / 2 / 3 tabs, y 537–556
const PresetTabs: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: 1662, top: 539 }}>
      <T size={11} color={C.dimLabel} weight={600}>{RAIL.presetTabs[0]}</T>
    </div>
    <div style={{ position: "absolute", left: 1748, top: 539 }}>
      <T size={11} color={C.dimLabel} weight={600}>{RAIL.presetTabs[1]}</T>
    </div>
    <div
      style={{
        position: "absolute",
        left: 1830,
        top: 535,
        width: 76,
        height: 19,
        borderRadius: 6,
        background: PRESET3_STYLE.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <T size={11} color={PRESET3_STYLE.text} weight={600}>{RAIL.presetTabs[2]}</T>
    </div>
    <div style={{ position: "absolute", left: 1632, right: 0, top: 566, height: 1, background: C.divider }} />
  </>
);

// Token Info header + 2×3 grid + counts row, y 573–800
const GRID_COLS = [1641, 1735, 1829];
const GRID_W = 86;

const GridCell: React.FC<{
  x: number;
  y: number;
  h: number;
  glyph: string;
  value: string;
  valueColor: string;
  label: string;
  valueTop?: number;
  labelTop?: number;
}> = ({ x, y, h, glyph, value, valueColor, label, valueTop = 5, labelTop = 31 }) => (
  <div style={{ position: "absolute", left: x, top: y, width: GRID_W, height: h, borderRadius: 8, background: C.cardBg }}>
    {value === "" ? (
      <div style={{ position: "absolute", left: GRID_W / 2 - 18, top: valueTop + 1, width: 36, height: 10, borderRadius: 4, background: SKEL }} />
    ) : (
      <Row gap={4} style={{ position: "absolute", left: 0, top: valueTop, width: "100%", justifyContent: "center" }}>
        <Glyph kind={glyph} size={12} color={valueColor} />
        <T size={13} color={valueColor} weight={600}>{value}</T>
      </Row>
    )}
    <div style={{ position: "absolute", left: 0, top: labelTop, width: "100%", textAlign: "center" }}>
      <T size={10.5} color={C.dimLabel} weight={500}>{label}</T>
    </div>
  </div>
);

// Cell colors are value-driven on the plates (green = safe, pink = risky):
// f0420 renders snipers 13.95% and LP "???" PINK; f0500 renders snipers 0%
// and LP 100% GREEN. Thresholds per field, "???" counts as risky.
const pct = (v: string) => parseFloat(v.replace("%", "")) || 0;

const TokenInfoSection: React.FC<{ info: TokenInfo }> = ({ info }) => {
  const cells: { glyph: string; v: string; neg: boolean }[] = [
    { glyph: "person", v: info.top10, neg: pct(info.top10) > 20 },
    { glyph: "chef", v: info.dev, neg: pct(info.dev) > 10 },
    { glyph: "target", v: info.snipers, neg: pct(info.snipers) > 5 || info.snipers.includes("?") },
    { glyph: "shield", v: info.insiders, neg: pct(info.insiders) > 5 },
    { glyph: "cluster", v: info.bundlers, neg: pct(info.bundlers) > 10 },
    { glyph: "droplet", v: info.lp, neg: info.lp !== "" && pct(info.lp) < 100 },
  ];
  const counts: { glyph: string; v: string; color: string; label: string }[] = [
    { glyph: "people", v: info.holders, color: C.dimWhite, label: RAIL.countLabels[0] },
    { glyph: "arrowsUpDown", v: info.pro, color: C.dimWhite, label: RAIL.countLabels[1] },
    { glyph: "infoCircle", v: RAIL.dexPaidValue, color: C.tiPink, label: RAIL.countLabels[2] },
  ];
  return (
    <>
      <Row gap={6} style={{ position: "absolute", left: X0, top: 574 }}>
        <T size={13} color={C.text} weight={600}>{RAIL.tokenInfo}</T>
        <Glyph kind="chevron" size={10} color={C.textMid} />
      </Row>
      <div style={{ position: "absolute", left: 1895, top: 573 }}>
        <Glyph kind="refresh" size={13} color={C.textMid} />
      </div>
      {cells.map((c, i) => (
        <GridCell
          key={RAIL.gridLabels[i]}
          x={GRID_COLS[i % 3]}
          y={i < 3 ? 601 : 667}
          h={56}
          glyph={c.glyph}
          value={c.v}
          valueColor={c.neg ? C.tiPink : C.tiTeal}
          label={RAIL.gridLabels[i]}
        />
      ))}
      {counts.map((c, i) => (
        <GridCell
          key={c.label}
          x={GRID_COLS[i]}
          y={748}
          h={52}
          glyph={c.glyph}
          value={c.v}
          valueColor={c.color}
          label={c.label}
          valueTop={9}
          labelTop={34}
        />
      ))}
    </>
  );
};

// CA / DA / deployer boxes (live phase), y 819–917
const AddressSection: React.FC = () => (
  <>
    <div style={{ position: "absolute", left: X0, top: 819, width: RW, height: 26, borderRadius: 6, background: C.cardBg }}>
      <Row gap={6} style={{ position: "absolute", left: 9, top: 7 }}>
        <Glyph kind="doc" size={12} color={C.textMid} />
        <T size={12} color={C.text} weight={500}>{RAIL.ca}</T>
      </Row>
      <div style={{ position: "absolute", right: 9, top: 7 }}>
        <Glyph kind="extLink" size={12} color={C.textMid} />
      </div>
    </div>
    <div style={{ position: "absolute", left: X0, top: 862, width: RW, height: 56, borderRadius: 6, background: C.cardBg }}>
      <Row gap={6} style={{ position: "absolute", left: 9, top: 9 }}>
        <Glyph kind="pill" size={12} color={C.tealText} />
        <T size={12} color={C.text} weight={500}>{RAIL.da}</T>
      </Row>
      <Row gap={9} style={{ position: "absolute", right: 9, top: 9 }}>
        <Glyph kind="eyeSlash" size={12} color={C.textMid} />
        <Glyph kind="search" size={12} color={C.textMid} />
        <Glyph kind="extLink" size={12} color={C.textMid} />
      </Row>
      {/* deployer row */}
      <Row
        gap={4}
        style={{ position: "absolute", left: 7, top: 32, height: 18, padding: "0 7px", borderRadius: 9, background: "#2A2D36" }}
      >
        <Glyph kind="upArrow" size={10} color={C.textMid} />
        <T size={11} color={C.text} weight={500}>{RAIL.deployerRow.addr}</T>
      </Row>
      <Row gap={4} style={{ position: "absolute", left: 107, top: 35 }}>
        <SolBars size={10} color={C.tealText} />
        <T size={12} color={C.text} weight={600}>{RAIL.deployerRow.sol}</T>
      </Row>
      <Row gap={4} style={{ position: "absolute", right: 10, top: 35 }}>
        <Glyph kind="clock" size={11} color={C.textMid} />
        <T size={11} color={C.textMid} weight={500}>{RAIL.deployerRow.age}</T>
      </Row>
    </div>
  </>
);

// Similar Tokens header (+ skeleton row in the migrating phase)
const SimilarTokens: React.FC<{ migrating: boolean }> = ({ migrating }) => {
  const y = migrating ? 878 : 952;
  return (
    <>
      {migrating ? (
        <Row gap={5} style={{ position: "absolute", left: X0, top: 844 }}>
          <T size={12} color={MIGRATE.reusedColor} weight={500}>{MIGRATE.reusedLabel}</T>
          <T size={12} color={MIGRATE.reusedColor} weight={500}>{"›"}</T>
        </Row>
      ) : null}
      <div style={{ position: "absolute", left: 1632, right: 0, top: y - 13, height: 1, background: C.divider }} />
      <Row gap={6} style={{ position: "absolute", left: X0, top: y }}>
        <T size={13} color={C.text} weight={600}>{RAIL.similar}</T>
        <Glyph kind="chevron" size={10} color={C.textMid} />
      </Row>
      <Row gap={5} style={{ position: "absolute", right: 1920 - X1, top: y }}>
        <T size={11} color={C.textMid} weight={600}>{RAIL.similarSort}</T>
        <Glyph kind="swapH" size={11} color={C.textMid} />
      </Row>
      {migrating ? (
        <div style={{ position: "absolute", left: X0, top: 903, width: RW, height: 52, borderRadius: 8, background: C.cardBg }}>
          <Skel x={9} y={8} w={36} h={36} r={6} />
          <Skel x={57} y={11} w={90} h={10} />
          <Skel x={57} y={29} w={60} h={8} />
        </div>
      ) : null}
    </>
  );
};

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------

export const TokenRail: React.FC<{ frame: number }> = ({ frame }) => {
  // plate f0418 shows the LIVE layout; the migrating panel spans ~f420-438
  const migrating = frame >= MIGRATE.fromF && frame <= MIGRATE.untilF;
  const info = sampleAt(tokenInfoTable, frame);
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {/* rail surface */}
      <div
        style={{
          position: "absolute",
          left: 1632,
          top: 84,
          width: 1920 - 1632,
          height: 990 - 84,
          background: C.railBg,
          borderLeft: `1px solid ${C.divider}`,
        }}
      />
      <Stats24Block frame={frame} />
      <BuySellTabs />
      <div style={{ position: "absolute", left: 1632, right: 0, top: 200, height: 1, background: C.divider }} />
      <OrderRow frame={frame} />
      {migrating ? <MigratingSection /> : <AmountSection />}
      <ActionButton migrating={migrating} />
      <PosStatsRow frame={frame} />
      <PresetTabs />
      <TokenInfoSection info={info} />
      {migrating ? null : <AddressSection />}
      <SimilarTokens migrating={migrating} />
    </div>
  );
};
