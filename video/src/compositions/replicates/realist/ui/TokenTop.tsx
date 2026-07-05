import React from "react";
import { Img, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { COLORS as C, NAV, TICKER, HEADER, TOASTS } from "./copy/token";
import {
  sampleAt,
  balanceTable,
  mcTable,
  priceFromMc,
  ageTable,
  viewsTable,
  liqTable,
  gfpTable,
  toastTable,
  posStatsTable,
} from "./timeline-token";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const FONT = `${fontFamily}, -apple-system, sans-serif`;

// All probed colors live in copy/token.ts COLORS (promoted r2).

// ─── Text / row primitives (local re-declarations, TrenchesScreen idiom) ──
const T: React.FC<{
  size: number;
  color: string;
  weight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}> = ({ size, color, weight = 400, style, children }) => (
  <span style={{ fontSize: size, color, fontWeight: weight, lineHeight: 1, whiteSpace: "nowrap", ...style }}>
    {children}
  </span>
);

const Row: React.FC<{ gap?: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  gap = 6,
  style,
  children,
}) => <div style={{ display: "flex", alignItems: "center", gap, ...style }}>{children}</div>;

// ─── Glyph vocabulary ───────────────────────────────────────────────────
const Glyph: React.FC<{ kind: string; size?: number; color?: string; sw?: number }> = ({
  kind,
  size = 13,
  color = C.textMid,
  sw = 1.4,
}) => {
  const common = { width: size, height: size, viewBox: "0 0 16 16", style: { display: "block" as const } };
  switch (kind) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="7" cy="7" r="4.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="10.5" y1="10.5" x2="14" y2="14" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <line x1="4" y1="4" x2="12" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <line x1="12" y1="4" x2="4" y2="12" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="M4.5 6.5 L8 10 L11.5 6.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M9 1.5 L4 9 L7.5 9 L7 14.5 L12 7 L8.5 7 Z" fill={color} />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path d="M8 2.5 L9.6 6.2 L13.5 6.5 L10.5 9 L11.5 13 L8 10.8 L4.5 13 L5.5 9 L2.5 6.5 L6.4 6.2 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
        </svg>
      );
    case "starFill":
      return (
        <svg {...common}>
          <path d="M8 2 L9.8 6 L14 6.4 L10.8 9.2 L11.9 13.5 L8 11.1 L4.1 13.5 L5.2 9.2 L2 6.4 L6.2 6 Z" fill={color} />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M8 2.5 C5.5 2.5 4.5 4.5 4.5 6.5 L4.5 9 L3.5 11.5 L12.5 11.5 L11.5 9 L11.5 6.5 C11.5 4.5 10.5 2.5 8 2.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M6.8 13 A1.3 1.3 0 0 0 9.2 13" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "wallet":
      return (
        <svg {...common}>
          <rect x="2" y="4" width="12" height="9" rx="2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M10 8 L14 8" stroke={color} strokeWidth={sw} />
          <circle cx="11" cy="8.5" r="0.9" fill={color} />
        </svg>
      );
    case "gear":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="2.2" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 2 L8 4 M8 12 L8 14 M2 8 L4 8 M12 8 L14 8 M3.8 3.8 L5.2 5.2 M10.8 10.8 L12.2 12.2 M12.2 3.8 L10.8 5.2 M5.2 10.8 L3.8 12.2" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "trend":
      return (
        <svg {...common}>
          <path d="M2.5 12.5 L6 8 L9 10 L13.5 4.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M8 5 L8 8 L10.5 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M6.5 9.5 L9.5 6.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M7 5.5 L8.7 3.8 a2.6 2.6 0 0 1 3.7 3.7 L10.7 9.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <path d="M9 10.5 L7.3 12.2 a2.6 2.6 0 0 1 -3.7 -3.7 L5.3 6.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "eye":
      return (
        <svg {...common}>
          <path d="M2 8 C3.5 5 5.5 3.8 8 3.8 C10.5 3.8 12.5 5 14 8 C12.5 11 10.5 12.2 8 12.2 C5.5 12.2 3.5 11 2 8 Z" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="8" cy="8" r="2" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "copyDoc":
      return (
        <svg {...common}>
          <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M4.5 10.5 L3.5 10.5 A1 1 0 0 1 2.5 9.5 L2.5 3.5 A1 1 0 0 1 3.5 2.5 L8.5 2.5 A1 1 0 0 1 9.5 3.5 L9.5 4.5" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "shareNodes":
      return (
        <svg {...common}>
          <circle cx="12" cy="3.8" r="1.9" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="4" cy="8" r="1.9" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="12" cy="12.2" r="1.9" fill="none" stroke={color} strokeWidth={sw} />
          <path d="M5.8 7.1 L10.2 4.7 M5.8 8.9 L10.2 11.3" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M8 10 L8 2.8 M5.2 5.2 L8 2.5 L10.8 5.2" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 9.5 L3 12.5 A1 1 0 0 0 4 13.5 L12 13.5 A1 1 0 0 0 13 12.5 L13 9.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "trophy":
      return (
        <svg {...common}>
          <path d="M5 2.5 L11 2.5 L11 7 A3 3 0 0 1 5 7 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M5 3.8 L3 3.8 A2 2 0 0 0 5.2 6.6 M11 3.8 L13 3.8 A2 2 0 0 1 10.8 6.6" fill="none" stroke={color} strokeWidth={sw * 0.9} />
          <path d="M8 10 L8 12 M5.8 13.5 L10.2 13.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M9.5 2.5 L13.5 6.5 L11 7.5 L10.5 10.5 L5.5 5.5 L8.5 5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <line x1="7.5" y1="8.5" x2="3.5" y2="12.5" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...common}>
          <path d="M2.5 6.5 L2.5 9.5 L4.5 9.5 L11.5 12.5 L11.5 3.5 L4.5 6.5 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <path d="M12.8 6 A2.5 2.5 0 0 1 12.8 10" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "sliders":
      return (
        <svg {...common}>
          <path d="M3 4.5 H13 M3 8 H13 M3 11.5 H13" stroke={color} strokeWidth={sw} strokeLinecap="round" />
          <circle cx="6" cy="4.5" r="1.4" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="10.5" cy="8" r="1.4" fill="none" stroke={color} strokeWidth={sw} />
          <circle cx="6" cy="11.5" r="1.4" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "dollarCircle":
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="5.8" fill="none" stroke={color} strokeWidth={sw} />
          <text x="8" y="11" textAnchor="middle" fontSize="8" fontWeight={600} fill={color}>
            $
          </text>
        </svg>
      );
    case "arrowsUpDown":
      return (
        <svg {...common}>
          <path d="M5.5 13 L5.5 3.5 M3.5 5.5 L5.5 3.2 L7.5 5.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10.5 3 L10.5 12.5 M8.5 10.5 L10.5 12.8 L12.5 10.5" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "shieldBell":
      return (
        <svg {...common}>
          <path d="M8 1.8 L13.5 3.8 L13.5 8 C13.5 11.5 11.2 13.5 8 14.5 C4.8 13.5 2.5 11.5 2.5 8 L2.5 3.8 Z" fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" />
          <circle cx="8" cy="7.8" r="2" fill="none" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "panel":
      return (
        <svg {...common}>
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" fill="none" stroke={color} strokeWidth={sw} />
          <line x1="2.5" y1="6.5" x2="13.5" y2="6.5" stroke={color} strokeWidth={sw} />
        </svg>
      );
    case "refresh":
      return (
        <svg {...common}>
          <path d="M13 8 A5 5 0 1 1 11.5 4.5 M11.5 2 L11.5 4.8 L8.8 4.8" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" />
        </svg>
      );
    case "walletSq":
      return (
        <svg {...common}>
          <rect x="2.5" y="3" width="11" height="10" rx="2" fill={color} />
          <rect x="9" y="6.8" width="4.5" height="2.4" rx="1.2" fill="#1A1D24" />
        </svg>
      );
    default:
      return null;
  }
};

// Solana tri-bar mark (multi-color).
const SolanaBars: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
    <path d="M3.5 3.5 H12 L10.5 5.5 H2 Z" fill="#41E8B0" />
    <path d="M2 7 H10.5 L12 9 H3.5 Z" fill="#7A78D8" />
    <path d="M3.5 10.5 H12 L10.5 12.5 H2 Z" fill="#9B5FE0" />
  </svg>
);

// 8-spoke loading spinner; deterministic rotation from the frame.
const Spinner: React.FC<{ frame: number; size?: number }> = ({ frame, size = 16 }) => {
  const step = Math.floor(frame / 3) % 8;
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ display: "block" }}>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const o = 0.25 + 0.75 * (((i - step + 8) % 8) / 8);
        return (
          <line
            key={i}
            x1={8 + 3.2 * Math.cos(a)}
            y1={8 + 3.2 * Math.sin(a)}
            x2={8 + 6.5 * Math.cos(a)}
            y2={8 + 6.5 * Math.sin(a)}
            stroke="#9DA0A8"
            strokeWidth={1.6}
            strokeLinecap="round"
            opacity={o}
          />
        );
      })}
    </svg>
  );
};

// Status dot: teal check / amber warn / pink error (colors measured on plates;
// note the brief's guess was swapped — s4/tc are TEAL checks, partials are AMBER).
const StatusDot: React.FC<{ kind: "check" | "warn" | "error" }> = ({ kind }) => {
  if (kind === "check") {
    return (
      <svg width={18} height={18} viewBox="0 0 16 16" style={{ display: "block" }}>
        <circle cx="8" cy="8" r="7" fill={C.checkTeal} />
        <path d="M4.8 8 L7 10.2 L11.2 5.8" fill="none" stroke="#FFFFFF" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  const fill = kind === "warn" ? C.warnAmber : C.neg;
  const mark = kind === "warn" ? "#1A1D24" : "#FFFFFF";
  return (
    <svg width={18} height={18} viewBox="0 0 16 16" style={{ display: "block" }}>
      <circle cx="8" cy="8" r="7" fill={fill} />
      <rect x="7.2" y="3.8" width="1.6" height="5.2" rx="0.8" fill={mark} />
      <rect x="7.2" y="10.4" width="1.6" height="1.6" rx="0.8" fill={mark} />
    </svg>
  );
};

// Axiom triangle logomark: white triangle split into three bands.
const AxiomMark: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" style={{ display: "block" }}>
    <path d="M14 3 L18.2 10 L9.8 10 Z" fill="#FFFFFF" />
    <path d="M8.6 12 L19.4 12 L21.8 16 L6.2 16 Z" fill="#FFFFFF" />
    <path d="M5 18 L23 18 L26 23 L2 23 Z" fill="#FFFFFF" />
  </svg>
);

// ─── Toast DSL ──────────────────────────────────────────────────────────
type ParsedToast =
  | { kind: "attempt"; text: string }
  | { kind: "simple"; dot: "check" | "warn" | "error"; text: string; wide?: boolean }
  | { kind: "card"; name: string; verb: string; token: string; amt: string; mc: string };

const parseToast = (tok: string): ParsedToast | null => {
  if (tok.startsWith("c:")) {
    const p = tok.split(":");
    if (p.length < 6) return null;
    return { kind: "card", name: p[1], verb: p[2], token: p[3], amt: p[4], mc: p[5] };
  }
  const attempt = tok.match(/^a(\d+)$/);
  if (attempt) return { kind: "attempt", text: TOASTS.attempting(Number(attempt[1])) };
  if (tok === "s4") return { kind: "simple", dot: "check", text: TOASTS.succeeded4 };
  if (tok === "tc") return { kind: "simple", dot: "check", text: TOASTS.confirmed };
  const partial = tok.match(/^p([234])$/);
  if (partial) return { kind: "simple", dot: "warn", text: TOASTS.partial(Number(partial[1])) };
  const missing = tok.match(/^m([123])$/);
  if (missing) return { kind: "simple", dot: "error", text: TOASTS.missing(Number(missing[1])) };
  if (tok === "ffc") return { kind: "simple", dot: "error", text: TOASTS.failConsumed };
  if (tok === "ffa") return { kind: "simple", dot: "error", text: TOASTS.failAllInput, wide: true };
  if (tok === "ffi") return { kind: "simple", dot: "error", text: TOASTS.failInsufficient };
  if (tok === "fft") return { kind: "simple", dot: "error", text: TOASTS.failTimeout };
  if (tok === "fft2") return { kind: "simple", dot: "error", text: TOASTS.failTimeout2 };
  if (tok === "ne") return { kind: "simple", dot: "error", text: TOASTS.notEnough };
  return null;
};

// Card avatar sprite: ethan cards carry the sender's avatar; the rest show
// the token image (verified f0430 / f0500 / f0900 / f1650).
const cardAvatar = (name: string, token: string): string => {
  if (name.startsWith("ethan")) return "realist-assets/ui/av-ethan.png";
  if (token === "eight") return "realist-assets/ui/tok-eight.png";
  if (token === "TST") return "realist-assets/ui/tok-tst.png";
  return "realist-assets/ui/pump-avatar.png"; // Pumpwheel + default
};

// Stack metrics re-measured r5 on SETTLED plates only (dot/✕/spinner blob
// centers + fill-edge scans; f0861/0910/0930/1020/1280/1630). The law
// reproduces every settled plate to ≤0.5px:
//   · every box CENTER-ANCHORED at cx 959.5 (5 toast kinds agree ±0.3)
//   · std box 35 tall, slot-1 top 18.8, std→std pitch 56.5
//   · cards 51 tall (f0930 box 71→122, f1630 14.4→65.5), slot-1 top 14.4
//   · gaps: std→card 17.2, card→std 14.5, card→card ≈9 (only mid-anim samples)
// r3's "top y14 / cards 47 / 65 pitch" was fit on mid-animation plates
// (f0465/0470/0485 are 2-8f into a re-flow; tops compress there).
const STACK_CX = 959.5;
const TOAST_H = 35;
const CARD_H = 51;
const TOP_STD = 18.8;
const TOP_CARD = 14.4;
const GAP_SS = 21.5;
const GAP_SC = 17.2;
const GAP_CS = 14.5;
const GAP_CC = 9;

const ToastRow: React.FC<{ toast: ParsedToast; y: number; frame: number }> = ({ toast, y, frame }) => {
  const shell: React.CSSProperties = {
    position: "absolute",
    left: STACK_CX,
    top: y,
    transform: "translateX(-50%)",
    background: C.toastBg,
    border: `1px solid ${C.toastBorder}`,
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
  };
  if (toast.kind === "card") {
    const sell = toast.verb.includes("sold");
    const accent = sell ? C.neg : C.verbGreen;
    const amtColor = sell ? C.neg : C.tealText;
    // Card internals measured r5 (f0930/f1630 + f0470 class maps): name row
    // center = top+14.6, amt row 21 lower (rows gap 9); pink dot AND close ✕
    // ride the NAME ROW line (plate ✕ cy 28.5 vs name 29 on f1630), not the
    // box center; width is content-driven (jsol card is only 239 wide on the
    // plate — a 300 minWidth broke it).
    return (
      <div style={{ ...shell, height: CARD_H, padding: "0 12px 0 8px", gap: 10 }}>
        {/* avatar carries two badge chips (coin + age) on its bottom-left (r3) */}
        <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
          <Img
            src={staticFile(cardAvatar(toast.name, toast.token))}
            style={{ width: 36, height: 36, borderRadius: 6, display: "block" }}
          />
          <div style={{ position: "absolute", left: -4, bottom: -3, width: 13, height: 13, borderRadius: 6.5, background: "#C9A227", border: "1.5px solid #14161C", boxSizing: "border-box" }} />
          <div style={{ position: "absolute", left: 7, bottom: -3, width: 13, height: 13, borderRadius: 6.5, background: "#22252C", border: "1.5px solid #14161C", boxSizing: "border-box" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
          <Row gap={5}>
            {toast.name === "samsrep" ? (
              <Glyph kind="starFill" size={12} color={C.gold} />
            ) : (
              <Glyph kind="walletSq" size={11} color="#6E727D" />
            )}
            <T size={13} color={C.textHi} weight={600}>
              {toast.name}
            </T>
            <T size={13} color={accent} weight={500}>
              {toast.verb}
            </T>
            <T size={13} color={C.textHi} weight={600}>
              {toast.token}
            </T>
          </Row>
          <Row gap={4}>
            <SolanaBars size={11} />
            <T size={12.5} color={amtColor} weight={600}>
              {toast.amt}
            </T>
            <T size={12.5} color={C.textDim} weight={500}>
              {TOASTS.cardAt}
            </T>
            <T size={12.5} color={C.textMid} weight={500}>
              {toast.mc} {TOASTS.cardMcSuffix}
            </T>
          </Row>
        </div>
        <div style={{ width: 11, height: 11, borderRadius: 5.5, background: C.neg, flexShrink: 0, alignSelf: "flex-start", marginTop: 9 }} />
        <div style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Glyph kind="close" size={13} color={C.textMid} />
        </div>
      </div>
    );
  }
  if (toast.kind === "attempt") {
    // Attempting toasts carry no close ✕ on the plates.
    return (
      <div style={{ ...shell, height: TOAST_H, padding: "0 12px", gap: 10 }}>
        <Spinner frame={frame} size={16} />
        <T size={12.4} color={C.textHi} weight={500}>
          {toast.text}
        </T>
      </div>
    );
  }
  // All simple-toast text is ~12.4px on the plates (r5: plate ink widths are
  // 0.95-0.97× our old 13px on m- AND p-toasts; r4 had already fitted the
  // ffa band at 12.4). The old ffa-only −4/+3 offset died with the measured
  // law — f1630's ffa sits on the uniform slot grid, centered like the rest.
  return (
    <div style={{ ...shell, height: TOAST_H, padding: "0 12px", gap: 10 }}>
      <StatusDot kind={toast.dot} />
      <T size={12.4} color={C.textHi} weight={500}>
        {toast.text}
      </T>
      <div style={{ width: 4 }} />
      <Glyph kind="close" size={14} color={C.textMid} />
    </div>
  );
};

// ─── Ticker strip ───────────────────────────────────────────────────────
// Item icon left edges re-anchored r2 so LABEL starts hit the plate ink
// (f0500/f0420 blob scan: labels at 146/376/601/820/1056/1254/1455/1648).
const TICKER_X = [123, 352, 578, 797, 1033, 1231, 1432, 1624];

const TickerIcon: React.FC<{ icon: string }> = ({ icon }) => {
  if (icon === "spax" || icon === "neta") {
    return (
      <Img
        src={staticFile(`realist-assets/ui/tick-${icon}.png`)}
        style={{ width: 17, height: 17, borderRadius: icon === "spax" ? 8.5 : 4, display: "block" }}
      />
    );
  }
  // plate placeholder icons are barely brighter than the strip bg
  return (
    <div style={{ width: 16, height: 16, borderRadius: 4, background: "#252831", overflow: "hidden" }}>
      <div style={{ width: 8, height: 8, margin: "4px auto", borderRadius: 2, background: "#1A1D24" }} />
    </div>
  );
};

// ─── Header column (label above value) ─────────────────────────────────
const HeaderCol: React.FC<{ x: number; label: string; children: React.ReactNode }> = ({ x, label, children }) => (
  <div style={{ position: "absolute", left: x, top: 9 }}>
    <T size={10.5} color={C.textMid} weight={500}>
      {label}
    </T>
    <Row gap={4} style={{ marginTop: 7 }}>
      {children}
    </Row>
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────
export const TokenTop: React.FC<{ frame: number }> = ({ frame }) => {
  const balance = sampleAt(balanceTable, frame);
  const mc = sampleAt(mcTable, frame);
  const price = priceFromMc(mc);
  const age = sampleAt(ageTable, frame);
  const views = sampleAt(viewsTable, frame);
  const liq = sampleAt(liqTable, frame);
  const gfp = sampleAt(gfpTable, frame);
  const toasts = sampleAt(toastTable, frame);
  const pnlPct = sampleAt(posStatsTable, frame).pnlPct;

  // Toast stack vertical layout — measured pairwise law (r5, settled plates):
  // slot-1 top is 18.8 for std toasts, 14.4 for cards; the gap below a toast
  // depends on both neighbours (std→std 21.5 · std→card 17.2 · card→std 14.5
  // · card→card 9). Validated ≤0.5px on f0861/0910/0930/1020/1280/1630.
  const placed: { toast: ParsedToast; y: number }[] = [];
  let prevCard: boolean | null = null;
  let prevBottom = 0;
  for (const tok of toasts) {
    const parsed = parseToast(tok);
    if (!parsed) continue;
    const isCard = parsed.kind === "card";
    const top =
      prevCard === null
        ? isCard
          ? TOP_CARD
          : TOP_STD
        : prevBottom + (prevCard ? (isCard ? GAP_CC : GAP_CS) : isCard ? GAP_SC : GAP_SS);
    placed.push({ toast: parsed, y: top });
    prevBottom = top + (isCard ? CARD_H : TOAST_H);
    prevCard = isCard;
  }

  return (
    <div style={{ position: "absolute", inset: 0, fontFamily: FONT }}>
      {/* ═══ Top nav bar (y 0–56) ═══ */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 1920, height: 56, background: C.navBg }}>
        {/* brand */}
        <div style={{ position: "absolute", left: 24, top: 15 }}>
          <AxiomMark size={27} />
        </div>
        <Row gap={6} style={{ position: "absolute", left: 57, top: 0, height: 56 }}>
          <T size={23} color="#FFFFFF" weight={700} style={{ letterSpacing: 0.5 }}>
            {NAV.brand}
          </T>
          <T size={15} color={C.textMid} weight={500}>
            {NAV.brandSuffix}
          </T>
        </Row>
        {/* links — x positions measured f0500 (±3px) */}
        {NAV.links.map((label, i) => (
          <div key={label} style={{ position: "absolute", left: [180, 263, 328, 410, 507, 567, 636, 721][i], top: 0, height: 56, display: "flex", alignItems: "center" }}>
            <T size={13.5} color={C.text} weight={600}>
              {label}
            </T>
          </div>
        ))}
        {/* search field */}
        <div
          style={{
            position: "absolute",
            left: 1148,
            top: 14,
            width: 192,
            height: 28,
            borderRadius: 8,
            background: C.searchBg,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 8px 0 10px",
            boxSizing: "border-box",
          }}
        >
          <Glyph kind="search" size={14} color={C.textMid} />
          <T size={12} color={C.textDim} weight={400} style={{ flex: 1, overflow: "hidden" }}>
            {NAV.searchPlaceholder}
          </T>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: `1px solid ${C.toastBorder}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <T size={10} color={C.textMid} weight={500}>
              {NAV.searchHint}
            </T>
          </div>
        </div>
        {/* SOL dropdown pill */}
        <Row
          gap={6}
          style={{
            position: "absolute",
            left: 1363,
            top: 13,
            height: 30,
            borderRadius: 8,
            background: C.solPillBg,
            padding: "0 10px",
            boxSizing: "border-box",
          }}
        >
          <SolanaBars size={13} />
          <T size={13} color={C.textHi} weight={600}>
            {NAV.solLabel}
          </T>
          <Glyph kind="chevron" size={12} color={C.textMid} />
        </Row>
        {/* Deposit — r4 re-measure (f0500/f0900/f1050): bright purple stadium
            x1467-1543 y11.5-42 with DARK navy bold label, not white-on-dim;
            the fill carries a slight vertical falloff on every plate */}
        <div
          style={{
            position: "absolute",
            left: 1467,
            top: 12,
            width: 76,
            height: 30,
            borderRadius: 15,
            background: `linear-gradient(180deg, ${C.depositTop} 0%, ${C.depositBot} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T size={13.5} color={C.depositInk} weight={700}>
            {NAV.deposit}
          </T>
        </div>
        {/* star / bell circular buttons */}
        {[1553, 1599].map((x, i) => (
          <div
            key={x}
            style={{
              position: "absolute",
              left: x,
              top: 11,
              width: 34,
              height: 34,
              borderRadius: 17,
              background: C.circleBtnBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* r4: plate glyph cores are near-white (#E7E8EC star, #EFF2F7
                bell) with a heavier stroke than the default 1.4 */}
            <Glyph kind={i === 0 ? "star" : "bell"} size={16} color={C.textHi} sw={1.8} />
          </div>
        ))}
        {/* wallet chip: balance + globe/0 */}
        <Row
          gap={6}
          style={{
            position: "absolute",
            left: 1648,
            top: 12,
            height: 32,
            borderRadius: 16,
            background: C.walletChipBg,
            padding: "0 12px",
            boxSizing: "border-box",
          }}
        >
          <Glyph kind="wallet" size={15} color={C.textMid} />
          <SolanaBars size={12} />
          <T size={14} color={C.textHi} weight={600}>
            {balance}
          </T>
          <div style={{ position: "relative", width: 18, height: 18, marginLeft: 4 }}>
            <div style={{ width: 18, height: 18, borderRadius: 9, background: "#2E5AA8" }} />
            <div style={{ position: "absolute", right: -1, top: -1, width: 7, height: 7, borderRadius: 3.5, background: "#41E8B0" }} />
          </div>
          <T size={13} color={C.textHi} weight={600}>
            {NAV.zeroChip}
          </T>
          <Glyph kind="chevron" size={12} color={C.textMid} />
        </Row>
        {/* avatars far right */}
        <Img
          src={staticFile("realist-assets/ui/wallet-avatar.png")}
          style={{ position: "absolute", left: 1833, top: 14, width: 28, height: 28, borderRadius: 14, display: "block" }}
        />
        <div
          style={{
            position: "absolute",
            left: 1874,
            top: 11,
            width: 34,
            height: 34,
            borderRadius: 17,
            background: C.walletChipBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* second "avatar": person + gear settings button */}
          <svg width={16} height={16} viewBox="0 0 16 16" style={{ display: "block" }}>
            <circle cx="7" cy="5.5" r="2.4" fill="none" stroke={C.text} strokeWidth={1.4} />
            <path d="M3 13.5 C3.5 10.5 5.2 9.5 7 9.5 C8 9.5 8.8 9.8 9.5 10.3" fill="none" stroke={C.text} strokeWidth={1.4} strokeLinecap="round" />
            <circle cx="11.8" cy="11.8" r="1.6" fill="none" stroke={C.text} strokeWidth={1.2} />
            <path d="M11.8 9.4 L11.8 10.2 M11.8 13.4 L11.8 14.2 M9.4 11.8 L10.2 11.8 M13.4 11.8 L14.2 11.8" stroke={C.text} strokeWidth={1.2} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* ═══ Ticker strip (y 56–90) ═══ */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 56,
          width: 1920,
          height: 34,
          background: C.tickerBg,
          borderTop: "1px solid #232833",
          borderBottom: "1px solid #232833",
          boxSizing: "border-box",
        }}
      >
        {/* far-left controls: gear · star · trend */}
        <Row gap={0} style={{ position: "absolute", left: 18, top: 0, height: 32 }}>
          <Glyph kind="gear" size={16} color={C.textDim} />
          <div style={{ width: 1, height: 16, background: "#2A2E38", margin: "0 10px" }} />
          <Glyph kind="star" size={16} color={C.textDim} />
          <div style={{ width: 12 }} />
          <Glyph kind="trend" size={16} color={C.textDim} />
          <div style={{ width: 1, height: 16, background: "#2A2E38", marginLeft: 10 }} />
        </Row>
        {TICKER.items.map((item, i) => (
          <Row key={i} gap={7} style={{ position: "absolute", left: TICKER_X[i], top: 0, height: 32 }}>
            <TickerIcon icon={item.icon} />
            {/* label/chip fonts fitted to plate ink widths (f0500 blobs):
                label w73 vs 87 at 13px → 11; chip num w47 vs 55 → 11.
                Labels are DIM on the plates, the SOL figure brighter (r3). */}
            <T size={11} color={C.tickerLabel} weight={600}>
              {item.label}
            </T>
            <Row
              gap={4}
              style={{ background: C.chipBg, borderRadius: 5, padding: "3px 7px", marginLeft: 5 }}
            >
              <Glyph kind="bolt" size={10} color="#8C7BFA" />
              <T size={11} color={C.tickerSol} weight={500}>
                {item.sol}
              </T>
            </Row>
          </Row>
        ))}
      </div>

      {/* ═══ Token header row (y 90–150) ═══
          Width stops at the rail divider (1632): a full-width surface here
          buried the rail's 24h stats block (r2 fix, plate f0500). */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 90,
          width: 1632,
          height: 60,
          background: C.panelBg,
          borderBottom: "1px solid #232833",
          boxSizing: "border-box",
        }}
      >
        {/* avatar (sprite carries the gold ring + badge) */}
        <Img
          src={staticFile("realist-assets/ui/pump-avatar.png")}
          style={{ position: "absolute", left: 11, top: 6, width: 38, height: 38, borderRadius: 8, display: "block" }}
        />
        {/* name row — fonts fitted to plate ink (f0500: name w80, subtitle
            starts x138 i.e. 4px after the name) */}
        <Row gap={3} style={{ position: "absolute", left: 54, top: 8 }}>
          <T size={14.5} color={C.textHi} weight={600}>
            {HEADER.name}
          </T>
          <T size={13} color={C.textMid} weight={400}>
            {HEADER.subtitle}
          </T>
          <Glyph kind="copyDoc" size={13} color={C.textDim} />
          <Glyph kind="shareNodes" size={13} color={C.textDim} />
          <Glyph kind="star" size={14} color={C.textDim} />
        </Row>
        {/* meta row: age · link · search · views (plate: link 75, search 97,
            views 120-155 → tighter gaps, 11.5px text) */}
        <Row gap={8} style={{ position: "absolute", left: 54, top: 31 }}>
          <Row gap={3}>
            <Glyph kind="clock" size={11} color={C.pos} />
            <T size={13} color={C.pos} weight={600}>
              {age}
            </T>
          </Row>
          <Glyph kind="link" size={13} color={C.textDim} />
          <Glyph kind="search" size={13} color={C.textDim} />
          <Row gap={4}>
            <Glyph kind="eye" size={13} color={C.textDim} />
            <T size={13} color={C.textMid} weight={500}>
              {views}
            </T>
          </Row>
        </Row>
        {/* big MC — renders near-white on every plate (not teal); plate ink
            x345-398 y98-124 → 19px, center y111 */}
        <div style={{ position: "absolute", left: 346, top: 0, height: 42, display: "flex", alignItems: "center" }}>
          <T size={19} color={C.mcWhite} weight={600}>
            {mc}
          </T>
        </div>
        {/* columns */}
        <HeaderCol x={422} label={HEADER.cols.price}>
          <T size={12} color={C.textHi} weight={600}>
            {price ? (
              <>
                $0.0
                <span style={{ fontSize: 8.5, verticalAlign: "-2px" }}>{price.zeros}</span>
                {price.digit}
              </>
            ) : (
              "-"
            )}
          </T>
        </HeaderCol>
        <HeaderCol x={482} label={HEADER.cols.liquidity}>
          <T size={12} color={C.textHi} weight={600}>
            {liq}
          </T>
        </HeaderCol>
        <HeaderCol x={548} label={HEADER.cols.supply}>
          <T size={12} color={C.textHi} weight={600}>
            {HEADER.supplyValue}
          </T>
          <Glyph kind="refresh" size={11} color={C.textDim} />
        </HeaderCol>
        <HeaderCol x={606} label={HEADER.cols.fees}>
          <SolanaBars size={11} />
          <T size={12} color={C.textHi} weight={600}>
            {gfp}
          </T>
        </HeaderCol>
        {/* trophy chip */}
        <Row gap={4} style={{ position: "absolute", left: 708, top: 30 }}>
          <Glyph kind="trophy" size={14} color={C.gold} />
          <T size={12.5} color={C.textHi} weight={600}>
            {HEADER.trophyCount}
          </T>
        </Row>
        {/* Share PnL */}
        <Row gap={6} style={{ position: "absolute", left: 756, top: 30 }}>
          <Glyph kind="upload" size={15} color={C.tealText} />
          <T size={14} color={C.tealText} weight={600}>
            {HEADER.sharePnl}
          </T>
        </Row>
        {/* pinned PnL cluster — r5 fine map of f1280 (x700-960, y106-136):
            after the pin the plate shows ONLY a green pnl chip, text right-
            anchored at x≈928 rows 118-126 (f0861/f1280/f1630 agree). No
            megaphone, no avatar, no chevron — the old wallet-avatar here
            rendered as a stray white disc the plates never had. The chip
            first appears at plate 505 (occluded at the f0500 anchor). */}
        <Row gap={10} style={{ position: "absolute", left: 836, top: 30 }}>
          <Glyph kind="pin" size={14} color={C.tealText} />
        </Row>
        {frame >= 505 && pnlPct > 0 && (
          <div
            style={{
              position: "absolute",
              left: 933,
              top: 24,
              transform: "translateX(-100%)",
              background: "#12242E",
              borderRadius: 4,
              padding: "3px 5px",
            }}
          >
            <T size={9.5} color={C.pos} weight={600}>
              +{pnlPct}%
            </T>
          </div>
        )}
        {/* right icon cluster + Alert + panel (plate icons y100-112 → top 22) */}
        <Row gap={0} style={{ position: "absolute", left: 1382, top: 22 }}>
          <Glyph kind="gear" size={15} color={C.textMid} />
          <div style={{ width: 21 }} />
          <Glyph kind="sliders" size={15} color={C.textMid} />
          <div style={{ width: 19 }} />
          <Glyph kind="dollarCircle" size={15} color={C.textMid} />
          <div style={{ width: 21 }} />
          <Glyph kind="arrowsUpDown" size={15} color={C.textMid} />
          <div style={{ width: 25 }} />
          <Glyph kind="shieldBell" size={15} color={C.text} />
          <div style={{ width: 6 }} />
          <T size={13} color={C.text} weight={500}>
            {HEADER.alert}
          </T>
          <div style={{ width: 20 }} />
          <Glyph kind="panel" size={15} color={C.textMid} />
        </Row>
        {/* divider before the right rail */}
        <div style={{ position: "absolute", left: 1630, top: 0, width: 1, height: 60, background: "#232833" }} />
      </div>

      {/* ═══ Toast stack (top-center, above everything) ═══ */}
      {placed.map(({ toast, y }, i) => (
        <ToastRow key={i} toast={toast} y={y} frame={frame} />
      ))}
    </div>
  );
};
