import React from "react";
import { loadFont } from "@remotion/google-fonts/Inter";
import { COLORS as C, BOTTOM, DOCK, MIGRATE } from "./copy/token";
import { sampleAt, tokenInfoTable, tradeRowTable } from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, -apple-system, sans-serif`;

// "Dev Tokens" carries no count on the migrating plates (f0420 bare,
// f0900 "(2005)"); switch tied to the measured migrate→live flip (copy).
const DEVTOKENS_COUNT_FROM_F = MIGRATE.devTokensCountFromF;
// skeleton shimmer-bar fill (dim placeholder bars while the table is empty)
const SKEL = "#23262E";

// measured column x positions (plates f0900 / f1650)
const COL_X = { age: 13, type: 276, mc: 541, amount: 811, sol: 1073 } as const;

// Jason dock box (f0900 detail crop: top edge y≈1006, x 1258…1835)
const DOCK_X = 1258;
const DOCK_W = 577;
const DOCK_Y = 1006;

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
  <span style={{ fontSize: size, color, fontWeight: weight, lineHeight: 1, ...style }}>
    {children}
  </span>
);

const Row: React.FC<{ gap?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  gap = 6,
  style,
  children,
}) => <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;

// monochrome SOL "≡" mark, tinted per value
const SolBars: React.FC<{ size?: number; color?: string }> = ({ size = 11, color = C.tealText }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3.5 3 H13 L11.5 5.2 H2 Z" fill={color} />
    <path d="M2 6.9 H11.5 L13 9.1 H3.5 Z" fill={color} />
    <path d="M3.5 10.8 H13 L11.5 13 H2 Z" fill={color} />
  </svg>
);

// tri-color Solana logo (dock "13.010 ≡" reads teal/blue/purple on the plates)
const SolLogo: React.FC<{ size?: number }> = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3.5 3 H13 L11.5 5.2 H2 Z" fill="#41E8B0" />
    <path d="M2 6.9 H11.5 L13 9.1 H3.5 Z" fill="#7A78D8" />
    <path d="M3.5 10.8 H13 L11.5 13 H2 Z" fill="#9B5FE0" />
  </svg>
);

const Glyph: React.FC<{ kind: string; size?: number; color?: string }> = ({
  kind,
  size = 12,
  color = C.textMid,
}) => {
  const sw = 1.4;
  const common = { width: size, height: size, viewBox: "0 0 16 16", style: { display: "block" } };
  switch (kind) {
    case "bolt":
      return (
        <svg {...common}>
          <path d="M9 1.5 L4 9 L7.5 9 L7 14.5 L12 7 L8.5 7 Z" fill={color} />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <path d="M6.5 3.5 L3.5 3.5 L3.5 12.5 L12.5 12.5 L12.5 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 3 L13 3 L13 7 M13 3 L7.8 8.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="9.5" y1="3" x2="9.5" y2="13" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "panelCheck":
      return (
        <svg {...common}>
          <rect x="2.5" y="3" width="11" height="10" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="2.5" y1="6" x2="13.5" y2="6" stroke={color} strokeWidth={sw * 0.8} />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M3 4 L13 4 L9.5 8.5 L9.5 12.5 L6.5 11 L6.5 8.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "filterSolid":
      return (
        <svg {...common}>
          <path d="M3 4 L13 4 L9.5 8.5 L9.5 12.5 L6.5 11 L6.5 8.5 Z" fill={color} />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.6" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="1.4" fill={color} />
        </svg>
      );
    case "backArrow":
      return (
        <svg {...common}>
          <path d="M13 8 L3.5 8 M3.5 8 L7 4.5 M3.5 8 L7 11.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "downArrow":
      return (
        <svg {...common}>
          <path d="M8 3 L8 12.5 M8 12.5 L4.5 9 M8 12.5 L11.5 9" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "swapH":
      return (
        <svg {...common}>
          <path d="M3 5.5 L12 5.5 M12 5.5 L9.7 3.2 M12 5.5 L9.7 7.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13 10.5 L4 10.5 M4 10.5 L6.3 8.2 M4 10.5 L6.3 12.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
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
    case "drag":
      return (
        <svg {...common}>
          <path d="M3 5 H13 M3 8 H13 M3 11 H13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 2 L8 4 M8 12 L8 14 M2 8 L4 8 M12 8 L14 8 M3.8 3.8 L5.2 5.2 M10.8 10.8 L12.2 12.2 M12.2 3.8 L10.8 5.2 M5.2 10.8 L3.8 12.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "extLink":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="10" height="10" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M7 9 L11 5 M8.5 5 L11 5 L11 7.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    default:
      return null;
  }
};

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

// tabs row, text center y≈1002; Trades active
const TabsRow: React.FC<{ frame: number }> = ({ frame }) => {
  const info = sampleAt(tokenInfoTable, frame);
  const holders = info.holders ? `${BOTTOM.tabs[3]} (${info.holders})` : BOTTOM.tabs[3];
  const devTokens =
    frame >= DEVTOKENS_COUNT_FROM_F ? `${BOTTOM.tabs[5]} (${BOTTOM.devTokensCount})` : BOTTOM.tabs[5];
  const tabs: { text: string; x: number; active?: boolean }[] = [
    { text: BOTTOM.tabs[0], x: 13, active: true },
    { text: BOTTOM.tabs[1], x: 84 },
    { text: BOTTOM.tabs[2], x: 173 },
    { text: holders, x: 240 },
    { text: BOTTOM.tabs[4], x: 355 },
    { text: devTokens, x: 458 },
  ];
  return (
    <>
      {tabs.map((t) => (
        <div key={t.text} style={{ position: "absolute", left: t.x, top: 996 }}>
          <T size={13} color={t.active ? C.textHi : C.textMid} weight={t.active ? 600 : 500}>
            {t.text}
          </T>
        </div>
      ))}
      {/* faint active underline (probed f0900 y≈1012, subtle) */}
      <div style={{ position: "absolute", left: 13, top: 1012, width: 42, height: 2, background: C.toastBorder, borderRadius: 1 }} />
    </>
  );
};

// right side of the tabs row: Instant Trade chip + trades-panel strip + glyphs
const TabsRight: React.FC = () => (
  <>
    <Row
      gap={5}
      style={{
        position: "absolute",
        left: 1123,
        top: 991,
        height: 21,
        padding: "0 10px",
        borderRadius: 11,
        border: "1px solid #3D3B66",
      }}
    >
      <Glyph kind="bolt" size={11} color={C.purpleText} />
      <T size={12} color={C.purpleText} weight={600}>{BOTTOM.instantTrade}</T>
    </Row>
    {/* Trades Panel / DEV / TRACKED / YOU strip (mostly covered by the dock) */}
    <Row gap={5} style={{ position: "absolute", left: 1262, top: 995 }}>
      <Glyph kind="panelCheck" size={12} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tradesPanelRow[0]}</T>
    </Row>
    <Row gap={4} style={{ position: "absolute", left: 1380, top: 995 }}>
      <Glyph kind="filter" size={11} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tradesPanelRow[1]}</T>
    </Row>
    <Row gap={4} style={{ position: "absolute", left: 1462, top: 995 }}>
      <Glyph kind="filter" size={11} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tradesPanelRow[2]}</T>
    </Row>
    <Row gap={4} style={{ position: "absolute", left: 1552, top: 995 }}>
      <Glyph kind="target" size={11} color={C.textMid} />
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tradesPanelRow[3]}</T>
    </Row>
    <div style={{ position: "absolute", left: 1605, top: 995 }}>
      <Glyph kind="backArrow" size={12} color={C.textMid} />
    </div>
    {/* far-right share + panel toggle */}
    <div style={{ position: "absolute", left: 1875, top: 995 }}>
      <Glyph kind="share" size={12} color={C.textMid} />
    </div>
    <div style={{ position: "absolute", left: 1900, top: 995 }}>
      <Glyph kind="panel" size={12} color={C.textMid} />
    </div>
  </>
);

// table header, text center y≈1037
const TableHeader: React.FC = () => (
  <>
    {/* plate f0500: Age+arrow x20-43, "/" x51-55, "Time" x64-88 */}
    <Row gap={7} style={{ position: "absolute", left: COL_X.age + 7, top: 1031 }}>
      <T size={12} color={C.textMid} weight={500}>{BOTTOM.tableHead.age}</T>
      <Glyph kind="downArrow" size={10} color={C.textMid} />
      <T size={12} color={C.textMid} weight={500}>/</T>
      <T size={12} color={C.textMid} weight={500}>{BOTTOM.tableHead.time}</T>
    </Row>
    <div style={{ position: "absolute", left: COL_X.type, top: 1031 }}>
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tableHead.type}</T>
    </div>
    <Row gap={4} style={{ position: "absolute", left: COL_X.mc, top: 1031 }}>
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tableHead.mc}</T>
      <Glyph kind="swapH" size={11} color={C.textMid} />
    </Row>
    <div style={{ position: "absolute", left: COL_X.amount, top: 1031 }}>
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tableHead.amount}</T>
    </div>
    <Row gap={4} style={{ position: "absolute", left: COL_X.sol, top: 1031 }}>
      <T size={11} color={C.textMid} weight={500}>{BOTTOM.tableHead.totalSol}</T>
      <Glyph kind="infoCircle" size={11} color={C.textMid} />
    </Row>
    <div style={{ position: "absolute", left: 0, right: 0, top: 1047, height: 1, background: "#20232B" }} />
  </>
);

// first (and only readable) trade row, text center y≈1068
const TradeRowLine: React.FC<{ frame: number }> = ({ frame }) => {
  const row = sampleAt(tradeRowTable, frame);
  if (!row) {
    // shimmer skeleton (f0420: dim bars under Age/Type/MC/Amount)
    return (
      <>
        {[
          { x: COL_X.age, w: 38 },
          { x: COL_X.type, w: 42 },
          { x: COL_X.mc, w: 60 },
          { x: COL_X.amount, w: 58 },
        ].map((b) => (
          <div
            key={b.x}
            style={{ position: "absolute", left: b.x, top: 1062, width: b.w, height: 10, borderRadius: 4, background: SKEL }}
          />
        ))}
      </>
    );
  }
  const sideColor = row.type === "Buy" ? C.pos : C.neg;
  return (
    <>
      <div style={{ position: "absolute", left: COL_X.age, top: 1062 }}>
        <T size={12} color={C.text} weight={500}>{row.age}</T>
      </div>
      <div style={{ position: "absolute", left: COL_X.type, top: 1062 }}>
        <T size={12} color={sideColor} weight={600}>{row.type}</T>
      </div>
      <div style={{ position: "absolute", left: COL_X.mc, top: 1062 }}>
        <T size={12} color={C.text} weight={500}>{row.mc}</T>
      </div>
      <div style={{ position: "absolute", left: COL_X.amount, top: 1062 }}>
        <T size={12} color={C.text} weight={500}>{row.amount}</T>
      </div>
      <Row gap={4} style={{ position: "absolute", left: COL_X.sol, top: 1061 }}>
        <SolBars size={11} color={sideColor} />
        <T size={12} color={sideColor} weight={600}>{row.sol}</T>
      </Row>
    </>
  );
};

// Jason dock, x 1258–1835, y 1006–1080
const JasonDock: React.FC = () => (
  <div
    style={{
      position: "absolute",
      left: DOCK_X,
      top: DOCK_Y,
      width: DOCK_W,
      height: 1080 - DOCK_Y,
      background: C.dockBg,
      border: "1px solid #2A2D38",
      borderBottom: "none",
      borderRadius: "8px 8px 0 0",
    }}
  >
    {/* row 1 — coordinates dock-local (dock origin x 1258, y 1006) */}
    <Row gap={5} style={{ position: "absolute", left: 1272 - DOCK_X, top: 1019 - DOCK_Y }}>
      <Glyph kind="drag" size={12} color={C.purpleText} />
      <T size={12} color={C.purpleText} weight={600}>{DOCK.user}</T>
    </Row>
    <div style={{ position: "absolute", left: 1344 - DOCK_X, top: 1020 - DOCK_Y }}>
      <T size={12} color={C.textMid} weight={500}>{DOCK.tabs[0]}</T>
    </div>
    <div style={{ position: "absolute", left: 1409 - DOCK_X, top: 1020 - DOCK_Y }}>
      <T size={12} color={C.textHi} weight={600}>{DOCK.tabs[1]}</T>
    </div>
    <div style={{ position: "absolute", left: 1449 - DOCK_X, top: 1016 - DOCK_Y, width: 5, height: 5, borderRadius: 3, background: C.neg }} />
    <div style={{ position: "absolute", left: 1461 - DOCK_X, top: 1020 - DOCK_Y }}>
      <T size={12} color={C.textMid} weight={500}>{DOCK.tabs[2]}</T>
    </div>
    <div style={{ position: "absolute", left: 1513 - DOCK_X, top: 1016 - DOCK_Y, width: 5, height: 5, borderRadius: 3, background: C.neg }} />
    <div style={{ position: "absolute", left: 1556 - DOCK_X, top: 1019 - DOCK_Y }}>
      <Glyph kind="gear" size={13} color={C.textMid} />
    </div>
    <div style={{ position: "absolute", left: 1588 - DOCK_X, top: 1019 - DOCK_Y }}>
      <Glyph kind="filterSolid" size={13} color="#6C63D9" />
    </div>
    <div style={{ position: "absolute", left: 1625 - DOCK_X, top: 1020 - DOCK_Y }}>
      <T size={12} color={C.textMid} weight={600}>{DOCK.preset}</T>
    </div>
    <div style={{ position: "absolute", left: 1648 - DOCK_X, top: 1015 - DOCK_Y, width: 1, height: 16, background: C.divider }} />
    <Row gap={4} style={{ position: "absolute", left: 1658 - DOCK_X, top: 1018 - DOCK_Y }}>
      <Glyph kind="bolt" size={12} color={C.textHi} />
      <T size={13} color={C.textHi} weight={700}>{DOCK.bolt}</T>
      <SolLogo size={11} />
    </Row>
    <div style={{ position: "absolute", left: 1733 - DOCK_X, top: 1015 - DOCK_Y, width: 1, height: 16, background: C.divider }} />
    <div style={{ position: "absolute", left: 1763 - DOCK_X, top: 1019 - DOCK_Y }}>
      <Glyph kind="extLink" size={13} color={C.textMid} />
    </div>
    <div style={{ position: "absolute", left: 1803 - DOCK_X, top: 1020 - DOCK_Y }}>
      <Glyph kind="close" size={12} color={C.text} />
    </div>
    {/* row 2 — column heads */}
    <div style={{ position: "absolute", left: 1272 - DOCK_X, top: 1054 - DOCK_Y }}>
      <Glyph kind="gear" size={12} color={C.textMid} />
    </div>
    <div style={{ position: "absolute", left: 1306 - DOCK_X, top: 1055 - DOCK_Y }}>
      <T size={11} color={C.textMid} weight={500}>{DOCK.tableHead[0]}</T>
    </div>
    <div style={{ position: "absolute", left: 1469 - DOCK_X, top: 1055 - DOCK_Y }}>
      <T size={11} color={C.textMid} weight={500}>{DOCK.tableHead[1]}</T>
    </div>
    <Row gap={4} style={{ position: "absolute", left: 1619 - DOCK_X, top: 1054 - DOCK_Y }}>
      <T size={11} color={C.textMid} weight={500}>{DOCK.tableHead[2]}</T>
      <Glyph kind="infoCircle" size={11} color={C.textMid} />
    </Row>
    <div style={{ position: "absolute", left: 1786 - DOCK_X, top: 1055 - DOCK_Y }}>
      <T size={11} color={C.textMid} weight={500}>{DOCK.tableHead[3]}</T>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Band
// ---------------------------------------------------------------------------

export const TokenBottom: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {/* band surface */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 990,
          width: 1920,
          height: 90,
          background: C.panelBg,
          borderTop: `1px solid ${C.divider}`,
        }}
      />
      <TabsRow frame={frame} />
      <TabsRight />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1014, height: 1, background: C.divider }} />
      <TableHeader />
      <TradeRowLine frame={frame} />
      <JasonDock />
    </div>
  );
};
