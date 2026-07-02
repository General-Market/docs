import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Loop,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";

// ═══════════════════════════════════════════════════════════════
// PROPOSITION — "Zoom-follow, one page one camera".
//
// The whole app.crxfx.com/swap page is drawn ONCE, at full
// fidelity, on a 1600×1000 internal canvas: sandbox banner, nav,
// hedge card, right rail (SIDE / TENOR / MARGIN TOKEN), FAQ fold.
// ONE continuous camera — a single translate+scale on the page
// container, eased on cubic-bezier(0.16,1,0.3,1), settle-then-HOLD
// — frames the beat the copy names:
//   A f7–53   push into the rate wells; forward rate ticks
//             (Indicative), LOCKS at f35 — brass ring + brass pill.
//   B f61–103 glide to the PAIR well; the corridor list opens, the
//             hover ring slides MXN→INR→TRY→BRL, click re-quotes.
//   C f106–153 dive to TENOR (right rail — a frosted veil, derived
//             from the camera's own translate, keeps the copy
//             legible), back to the notional field, type 2,500,000,
//             pull back WIDE as the CTA arms.
// Copy renders in SCREEN space and never zooms with the page.
// Everything derives from useCurrentFrame().
// ═══════════════════════════════════════════════════════════════

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: POPPINS } = loadPoppins("normal", {
  weights: ["300"],
  subsets: ["latin"],
});

// ─── app.crxfx.com tokens (hex-resolved from globals.css) ───
const INK = "#1e1e2a";
const SEC = "#5b5b66";
const TER = "#8a8a96";
const TEAL = "#0fb6ab";
const TEAL_SOFT = "rgba(15, 182, 171, 0.10)";
const TEAL_RING = "rgba(15, 182, 171, 0.28)";
const WELL = "#f2f3f6";
const BG = "#f7f8fa";
const BORDER = "rgba(23, 23, 33, 0.08)";
const HAIR = "rgba(23, 23, 33, 0.07)";
const AMBER = "#c77d0a";
const BRASS = "#8a5d12";
const BRASS_RING = "rgba(192, 138, 46, 0.32)";
const COPY_INK = "#1D1D1F"; // screen-space copy, Apple ink

const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

// Element settle — the reference word physics (drop, exponential decay).
const settle = (
  frame: number,
  start: number,
  drop = 14,
  r = 0.76,
): React.CSSProperties => {
  if (frame < start) return { opacity: 0 };
  const dt = frame - start;
  return {
    transform: `translateY(${(-(drop * Math.pow(r, dt))).toFixed(2)}px)`,
    opacity: Math.min((dt + 1) / 3, 1),
  };
};

const fadeIn = (frame: number, start: number, dur = 3) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp);

const smooth = (t: number) => t * t * (3 - 2 * t);

// Continuous index that walks a list of step frames, easing each hop.
const stepSlide = (frame: number, steps: number[], dur = 4) => {
  let v = 0;
  for (const s of steps) {
    v += smooth(interpolate(frame, [s, s + dur], [0, 1], clamp));
  }
  return v;
};

// ─── shared chrome ───

const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="zfMarkV" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#zfMarkV)" strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
  </svg>
);

const UsdcMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size}>
    <circle cx="16" cy="16" r="16" fill="#2775CA" />
    <path
      d="M20.5 18.6c0-2.1-1.3-2.9-3.9-3.3-1.9-.3-2.3-.8-2.3-1.7 0-.9.7-1.5 2-1.5 1.2 0 1.9.4 2.2 1.4.1.2.2.3.4.3h1c.2 0 .4-.2.4-.4v-.1c-.3-1.5-1.4-2.6-3-2.8V9c0-.2-.2-.4-.4-.4h-1c-.2 0-.4.2-.4.4v1.5c-1.9.3-3.1 1.5-3.1 3.1 0 2 1.2 2.8 3.8 3.2 1.8.3 2.4.7 2.4 1.7s-.9 1.7-2.2 1.7c-1.7 0-2.3-.7-2.5-1.7-.1-.2-.2-.3-.4-.3h-1.1c-.2 0-.4.2-.4.4v.1c.3 1.6 1.3 2.8 3.4 3.1V23c0 .2.2.4.4.4h1c.2 0 .4-.2.4-.4v-1.5c2-.3 3.3-1.6 3.3-3.3z"
      fill="#fff"
    />
    <path
      d="M13 24.4c-3.5-1.3-5.3-5.2-4-8.7.7-1.9 2.2-3.3 4-4 .2-.1.3-.2.3-.5v-.9c0-.2-.1-.4-.3-.4h-.1c-4.3 1.4-6.7 6-5.3 10.3.8 2.5 2.8 4.5 5.3 5.3.2.1.4 0 .4-.2l.1-.1v-.9c0-.2-.2-.4-.4-.5zm6.1-14.5c-.2-.1-.4 0-.4.2l-.1.1v.9c0 .2.2.4.4.5 3.5 1.3 5.3 5.2 4 8.7-.7 1.9-2.2 3.3-4 4-.2.1-.3.2-.3.5v.9c0 .2.1.4.3.4h.1c4.3-1.4 6.7-6 5.3-10.3-.8-2.6-2.8-4.6-5.3-5.4z"
      fill="#fff"
    />
  </svg>
);

const Check: React.FC<{ size: number; color?: string; stroke?: number }> = ({
  size,
  color = "#fff",
  stroke = 12,
}) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <path
      d="M22 52 L42 72 L78 32"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FlagPair: React.FC<{ a: string; b: string; size?: number }> = ({ a, b, size = 24 }) => (
  <div style={{ position: "relative", width: size * 1.65, height: size, flexShrink: 0 }}>
    <Img
      src={flag(a)}
      style={{
        position: "absolute",
        left: 0,
        width: size * 1.33,
        height: size,
        objectFit: "cover",
        borderRadius: 4,
      }}
    />
    <Img
      src={flag(b)}
      style={{
        position: "absolute",
        left: size * 0.62,
        top: 3,
        width: size * 1.05,
        height: size * 0.79,
        objectFit: "cover",
        borderRadius: 3,
        boxShadow: "0 0 0 2px #fff",
      }}
    />
  </div>
);

const CoinDot: React.FC<{ size: number; bg: string; glyph: string }> = ({ size, bg, glyph }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: bg,
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.5,
      fontWeight: 700,
      fontFamily: INTER,
      flexShrink: 0,
    }}
  >
    {glyph}
  </div>
);

const FlaskIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={15} height={15}>
    <path
      d="M9.5 3h5M10.5 3v5.2L5.8 17.5A2 2 0 0 0 7.6 20h8.8a2 2 0 0 0 1.8-2.5L13.5 8.2V3"
      fill="none"
      stroke="#fff"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CalendarIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width={20} height={20}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" fill="none" stroke={TER} strokeWidth="1.7" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke={TER} strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

// ─── cursor: the operator's hand (page-space, zooms with the page) ───
type CursorKey = { f: number; x: number; y: number };

const cursorAt = (frame: number, keys: CursorKey[]) => {
  if (frame <= keys[0].f) return { x: keys[0].x, y: keys[0].y };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame <= b.f) {
      const t = smooth((frame - a.f) / (b.f - a.f));
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  const last = keys[keys.length - 1];
  return { x: last.x, y: last.y };
};

const Cursor: React.FC<{
  frame: number;
  keys: CursorKey[];
  clicks: number[];
  appear: number;
}> = ({ frame, keys, clicks, appear }) => {
  if (frame < appear) return null;
  const { x, y } = cursorAt(frame, keys);
  const op = fadeIn(frame, appear, 4);
  let dip = 1;
  const rings: { p: number; cx: number; cy: number }[] = [];
  for (const c of clicks) {
    if (frame >= c && frame < c + 3) dip = 0.85;
    if (frame >= c && frame < c + 9) {
      const at = cursorAt(c, keys);
      rings.push({ p: (frame - c) / 9, cx: at.x, cy: at.y });
    }
  }
  return (
    <>
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: ring.cx - 14 * ring.p - 3,
            top: ring.cy - 14 * ring.p - 3,
            width: 28 * ring.p + 6,
            height: 28 * ring.p + 6,
            borderRadius: "50%",
            border: "1.6px solid rgba(30,30,42,0.30)",
            opacity: 1 - ring.p,
          }}
        />
      ))}
      <svg
        viewBox="0 0 14 20"
        width={16}
        height={23}
        style={{
          position: "absolute",
          left: x - 1,
          top: y - 1,
          opacity: op,
          transform: `scale(${dip})`,
          transformOrigin: "2px 2px",
          filter: "drop-shadow(0 1.5px 3px rgba(0,0,0,0.28))",
        }}
      >
        <path
          d="M1 1 L1 15.5 L4.6 12.2 L7.2 18.2 L9.9 17 L7.3 11.2 L12.2 10.8 Z"
          fill="#1e1e2a"
          stroke="#fff"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
};

// ═══════════════════════════════ story ═══════════════════════════════

// Beat A — forward rate ticks f8–34, LOCKS at f35.
const LOCK_AT = 35;
const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087"];
const PT_TICKS = ["+0.0090", "+0.0113", "+0.0101", "+0.0119", "+0.0096"];
const SPOT_FLICK = ["1", "3", "0", "4", "2", "5"];

// Beat B — corridor picker.
const CORRIDORS = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais" },
];
const DD_OPEN = 66;
const HOVER_STEPS = [76, 84, 92];
const SELECT_AT = 96; // click on USD/BRL
const REQUOTE = 98; // page re-quotes

// Beat C — tenor swap, notional typing, CTA arms.
const TENOR_SWAP = 117;
const NOTIONAL_FOCUS = 134;
const TYPE_START = 136;
const NOTIONAL = "2,500,000";
const ARM_AT = 149;

const typedChars = (frame: number) =>
  frame < TYPE_START
    ? 0
    : Math.min(Math.floor((frame - TYPE_START) / 1.5) + 1, NOTIONAL.length);

const CURSOR_KEYS: CursorKey[] = [
  { f: 56, x: 730, y: 490 },
  { f: 63, x: 800, y: 474 }, // "Change ⌄" on the pair row
  { f: 66, x: 800, y: 474 },
  { f: 70, x: 520, y: 569 }, // dropdown row 0
  { f: 74, x: 520, y: 569 },
  { f: 78, x: 520, y: 627 }, // row 1
  { f: 82, x: 520, y: 627 },
  { f: 86, x: 520, y: 685 }, // row 2
  { f: 90, x: 520, y: 685 },
  { f: 94, x: 520, y: 743 }, // row 3 — USD/BRL
  { f: 98, x: 520, y: 743 },
  { f: 105, x: 950, y: 610 },
  { f: 112, x: 1360, y: 468 }, // tenor well
  { f: 124, x: 1360, y: 468 },
  { f: 132, x: 480, y: 322 }, // notional field
  { f: 136, x: 480, y: 322 },
  { f: 141, x: 700, y: 430 }, // rests aside while it types
  { f: 146, x: 660, y: 560 },
  { f: 152, x: 536, y: 700 }, // drifts toward the armed CTA
];
const CURSOR_CLICKS = [66, SELECT_AT, 115, NOTIONAL_FOCUS];

// ═══════════════════════════════ camera ═══════════════════════════════
// screen = page × s + (tx, ty). Holds are dead still — no breathing.
type Cam = { s: number; tx: number; ty: number };

const K_WIDE: Cam = { s: 0.62, tx: 144, ty: 50 }; // whole page over the wave
const K_RATE: Cam = { s: 1.0, tx: 385, ty: -186 }; // beat A — rate wells
const K_PAIR: Cam = { s: 0.84, tx: 515, ty: -115 }; // beat B — pair + dropdown
const K_TENOR: Cam = { s: 1.15, tx: -458, ty: -164 }; // beat C1 — right rail
const K_NOTIONAL: Cam = { s: 0.93, tx: 440, ty: 60 }; // beat C2 — notional field
const K_END: Cam = { s: 0.52, tx: 440, ty: 100 }; // pull-back, page right of copy

const CAM_KEYS: [number, Cam][] = [
  [0, K_WIDE],
  [6, K_WIDE],
  [20, K_RATE],
  [54, K_RATE],
  [66, K_PAIR],
  [103, K_PAIR],
  [114, K_TENOR],
  [124, K_TENOR],
  [134, K_NOTIONAL],
  [145, K_NOTIONAL],
  [153, K_END],
];

const cameraAt = (frame: number): Cam => {
  if (frame <= CAM_KEYS[0][0]) return CAM_KEYS[0][1];
  for (let i = 0; i < CAM_KEYS.length - 1; i++) {
    const [fa, a] = CAM_KEYS[i];
    const [fb, b] = CAM_KEYS[i + 1];
    if (frame <= fb) {
      if (a === b) return a;
      const t = EASE((frame - fa) / (fb - fa));
      return {
        s: a.s + (b.s - a.s) * t,
        tx: a.tx + (b.tx - a.tx) * t,
        ty: a.ty + (b.ty - a.ty) * t,
      };
    }
  }
  return CAM_KEYS[CAM_KEYS.length - 1][1];
};

// ═══════════════════════════════ the page ═══════════════════════════════

const PAGE_W = 1600;
const PAGE_H = 1000;

const label: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1.2,
  color: TER,
  textTransform: "uppercase",
};

const tnum: React.CSSProperties = { fontFeatureSettings: "'tnum'" };

const NAV_TABS = ["Swap", "Transfer", "Portfolio", "Compliance"];

const SwapPage: React.FC<{ frame: number }> = ({ frame }) => {
  // story state
  const requoted = frame >= REQUOTE;
  const ccy = requoted ? "BRL" : "MXN";
  const cor = CORRIDORS[requoted ? 3 : 0];
  const locked = frame >= LOCK_AT;
  const tick =
    frame < 8 ? 0 : Math.floor((frame - 8) / 4) % RATE_TICKS.length;
  const rate = requoted ? "5.4310" : locked ? "17.5104" : RATE_TICKS[tick];
  const pts = requoted ? "+0.0128" : locked ? "+0.0113" : PT_TICKS[tick];
  const spot =
    (requoted ? "5.418" : "17.499") +
    SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];
  const lockPulse =
    interpolate(frame, [LOCK_AT, LOCK_AT + 3], [0, 1], clamp) *
    interpolate(frame, [50, 60], [1, 0], clamp);
  const reQuote = requoted ? settle(frame, REQUOTE, 9, 0.74) : {};

  // beat B — dropdown
  const panelOpen = frame >= DD_OPEN && frame < REQUOTE + 5;
  const panelIn =
    fadeIn(frame, DD_OPEN, 3) * interpolate(frame, [REQUOTE, REQUOTE + 4], [1, 0], clamp);
  const hoverIdx = stepSlide(frame, HOVER_STEPS, 4);
  const hoverOp = fadeIn(frame, 70, 3);
  const selIdx = frame < SELECT_AT ? 0 : 3;

  // beat C — tenor + notional
  const tenor =
    frame < TENOR_SWAP
      ? ["Aug 1, 2026", "30 days from today"]
      : ["Jun 30, 2027", "363 days from today"];
  const tenorSwap = frame >= TENOR_SWAP ? settle(frame, TENOR_SWAP, 8, 0.74) : {};
  const tenorFocus =
    interpolate(frame, [113, 116], [0, 1], clamp) *
    interpolate(frame, [126, 132], [1, 0], clamp);
  const focused = frame >= NOTIONAL_FOCUS;
  const typed = typedChars(frame);
  const typing = typed > 0 && typed < NOTIONAL.length;
  const caretOn = focused && (typing || Math.floor(frame / 8) % 2 === 0);
  const armed = frame >= ARM_AT;
  const ctaSettle = armed ? settle(frame, ARM_AT, 6, 0.72) : {};

  return (
    <div
      style={{
        position: "absolute",
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: BG,
        borderRadius: 18,
        overflow: "hidden",
        fontFamily: INTER,
        color: INK,
        boxShadow: "0 30px 80px rgba(20,20,30,0.30), 0 6px 24px rgba(20,20,30,0.14)",
      }}
    >
      {/* ── sandbox banner ── */}
      <div
        style={{
          position: "absolute",
          top: 0,
          width: "100%",
          height: 40,
          backgroundColor: AMBER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          fontSize: 15,
          fontWeight: 500,
          color: "#fff",
        }}
      >
        <FlaskIcon />
        Sandbox — Base Sepolia testnet. No real funds at risk.
      </div>

      {/* ── nav ── */}
      <div
        style={{
          position: "absolute",
          top: 40,
          width: "100%",
          height: 72,
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 150,
            top: 0,
            height: 72,
            display: "flex",
            alignItems: "center",
            gap: 11,
          }}
        >
          <CrxMark size={30} />
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.8 }}>CRX</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 330,
            top: 0,
            height: 72,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {NAV_TABS.map((t) => {
            const active = t === "Swap";
            return (
              <div
                key={t}
                style={{
                  fontSize: 15.5,
                  fontWeight: active ? 600 : 500,
                  color: active ? INK : SEC,
                  padding: "9px 17px",
                  borderRadius: 10,
                  backgroundColor: active ? "#eef0f3" : undefined,
                }}
              >
                {t}
                {!active && <span style={{ color: TER, marginLeft: 6, fontSize: 13 }}>⌄</span>}
              </div>
            );
          })}
        </div>
        <div
          style={{
            position: "absolute",
            right: 150,
            top: 16,
            height: 40,
            display: "flex",
            alignItems: "center",
            backgroundColor: TEAL,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 980,
            padding: "0 24px",
          }}
        >
          Connect wallet
        </div>
      </div>

      {/* ── hedge card ── */}
      <div
        style={{
          position: "absolute",
          left: 180,
          top: 190,
          width: 712,
          height: 552,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 212,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ color: TER, fontSize: 22, lineHeight: 1 }}>‹</span>
        <span style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.4 }}>Open a hedge</span>
      </div>

      {/* forward notional well */}
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 256,
          width: 652,
          height: 132,
          backgroundColor: WELL,
          borderRadius: 16,
          boxShadow: focused ? `0 0 0 3px ${TEAL_RING}` : undefined,
        }}
      >
        <div style={{ position: "absolute", left: 20, top: 18, fontSize: 14, color: SEC }}>
          Forward notional
        </div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 40,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: -1,
            color: typed > 0 ? INK : TER,
            ...tnum,
          }}
        >
          {typed > 0 ? NOTIONAL.slice(0, typed) : focused ? "" : "0.0"}
          {caretOn && <span style={{ color: TEAL, fontWeight: 400, marginLeft: 1 }}>|</span>}
        </div>
        <div
          style={{
            position: "absolute",
            right: 18,
            top: 46,
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#fff",
            border: `1px solid ${BORDER}`,
            borderRadius: 980,
            padding: "7px 15px 7px 8px",
          }}
        >
          <UsdcMark size={26} />
          <span style={{ fontSize: 15.5, fontWeight: 600 }}>USDC</span>
        </div>
        <div
          style={{
            position: "absolute",
            left: 20,
            top: 98,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: TEAL }} />
          <span style={{ fontSize: 14, color: SEC, ...tnum }}>
            Spot price {spot} {ccy}
          </span>
        </div>
      </div>

      {/* pair well */}
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 404,
          width: 652,
          height: 118,
          backgroundColor: WELL,
          borderRadius: 16,
        }}
      >
        <div style={{ position: "absolute", left: 20, top: 14, ...label }}>Pair</div>
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 42,
            width: 620,
            height: 62,
            backgroundColor: "#fff",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            padding: "0 18px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14, ...reQuote }}>
            <FlagPair a={cor.a} b={cor.b} size={30} />
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.15 }}>{cor.pair}</div>
              <div style={{ fontSize: 13, color: TER }}>{cor.sub}</div>
            </div>
          </div>
          <span style={{ fontSize: 14, color: SEC }}>Change ⌄</span>
        </div>
      </div>

      {/* forward points + forward rate wells */}
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 538,
          width: 316,
          height: 96,
          backgroundColor: WELL,
          borderRadius: 16,
        }}
      >
        <div style={{ position: "absolute", left: 18, top: 13, ...label, fontSize: 12 }}>
          Forward points
        </div>
        <div style={{ position: "absolute", left: 18, top: 38, ...reQuote }}>
          <div style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.15, ...tnum }}>{pts}</div>
          <div style={{ fontSize: 12, color: TER, marginTop: 2 }}>vs spot</div>
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 546,
          top: 538,
          width: 316,
          height: 96,
          backgroundColor: WELL,
          borderRadius: 16,
          boxShadow:
            lockPulse > 0
              ? `0 0 0 4px rgba(192,138,46,${(0.32 * lockPulse).toFixed(3)})${
                  locked ? `, inset 0 0 0 1.5px ${BRASS_RING}` : ""
                }`
              : locked
                ? `inset 0 0 0 1.5px ${BRASS_RING}`
                : undefined,
        }}
      >
        <div style={{ position: "absolute", left: 18, top: 13, ...label, fontSize: 12 }}>
          Forward rate
        </div>
        <div style={{ position: "absolute", left: 18, top: 38, ...(requoted ? reQuote : locked ? settle(frame, LOCK_AT, 8, 0.74) : {}) }}>
          <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, ...tnum }}>{rate}</div>
          <div style={{ fontSize: 12, color: TER, marginTop: 2, ...tnum }}>{ccy} per USD</div>
        </div>
        {!locked ? (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 11,
              fontSize: 12.5,
              fontWeight: 600,
              color: TER,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER}`,
              borderRadius: 980,
              padding: "4px 11px",
              opacity: 0.75 + 0.25 * Math.sin(frame / 3),
            }}
          >
            Indicative
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              right: 12,
              top: 11,
              display: "flex",
              alignItems: "center",
              gap: 6,
              backgroundColor: "rgba(192,138,46,0.12)",
              borderRadius: 980,
              padding: "4px 11px",
              ...settle(frame, LOCK_AT, 12, 0.74),
            }}
          >
            <svg viewBox="0 0 24 24" width={12} height={12}>
              <path
                d="M7 10V7a5 5 0 0 1 10 0v3"
                fill="none"
                stroke={BRASS}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <rect x="5" y="10" width="14" height="10" rx="2.4" fill={BRASS} />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: BRASS }}>
              Locked · firm 120s
            </span>
          </div>
        )}
      </div>

      {/* hint line */}
      <div
        style={{
          position: "absolute",
          left: 180,
          width: 712,
          top: 648,
          textAlign: "center",
          fontSize: 13.5,
          color: SEC,
          ...tnum,
        }}
      >
        Convert {ccy} → USD on {tenor[0]} at the locked rate
      </div>

      {/* CTA */}
      <div
        style={{
          position: "absolute",
          left: 210,
          top: 676,
          width: 652,
          height: 54,
          borderRadius: 14,
          backgroundColor: armed ? TEAL : "#a9e4de",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16.5,
          fontWeight: 600,
          color: "#fff",
        }}
      >
        <span style={{ ...ctaSettle }}>{armed ? "Request quotes" : "Enter an amount"}</span>
      </div>

      {/* ── right rail ── */}
      {/* SIDE */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 190,
          width: 500,
          height: 176,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 22, top: 18, ...label }}>Side</div>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 46,
            width: 456,
            height: 52,
            borderRadius: 12,
            backgroundColor: "rgba(15,182,171,0.04)",
            boxShadow: `inset 0 0 0 1.5px ${TEAL}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 600, color: TEAL }}>Buy / Long</span>
          <Check size={18} color={TEAL} stroke={14} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 108,
            width: 456,
            height: 52,
            borderRadius: 12,
            backgroundColor: WELL,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          <span style={{ fontSize: 15.5, fontWeight: 500 }}>Sell / Short</span>
        </div>
      </div>

      {/* TENOR */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 390,
          width: 500,
          height: 132,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 22, top: 18, ...label }}>Tenor</div>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 46,
            width: 456,
            height: 66,
            borderRadius: 12,
            backgroundColor: WELL,
            display: "flex",
            alignItems: "center",
            gap: 13,
            padding: "0 16px",
            boxShadow:
              tenorFocus > 0
                ? `0 0 0 3px rgba(15,182,171,${(0.28 * tenorFocus).toFixed(3)})`
                : undefined,
          }}
        >
          <CalendarIcon />
          <div style={{ flex: 1, ...tenorSwap }}>
            <div style={{ fontSize: 16.5, fontWeight: 600, lineHeight: 1.15, ...tnum }}>
              {tenor[0]}
            </div>
            <div style={{ fontSize: 13, color: TER }}>{tenor[1]}</div>
          </div>
          <span style={{ fontSize: 15, color: TER }}>⌄</span>
        </div>
      </div>

      {/* MARGIN TOKEN */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 546,
          width: 500,
          height: 196,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 22, top: 18, ...label }}>Margin token</div>
        {[
          { n: "USDC", s: "USD Coin", sel: true, icon: <UsdcMark size={30} /> },
          { n: "USDT", s: "Tether", sel: false, icon: <CoinDot size={30} bg="#26A17B" glyph="₮" /> },
          { n: "aUSD", s: "Agora Dollar", sel: false, icon: <CoinDot size={30} bg="#c39a35" glyph="a" /> },
          { n: "EURC", s: "Euro Coin", sel: false, icon: <CoinDot size={30} bg="#2775CA" glyph="€" /> },
        ].map((tk, i) => (
          <div
            key={tk.n}
            style={{
              position: "absolute",
              left: 22 + (i % 2) * 234,
              top: 46 + Math.floor(i / 2) * 64,
              width: 222,
              height: 56,
              borderRadius: 12,
              backgroundColor: tk.sel ? "#fff" : WELL,
              boxShadow: tk.sel ? `inset 0 0 0 1.5px ${TEAL}` : undefined,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 12px",
            }}
          >
            {tk.icon}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.15 }}>{tk.n}</div>
              <div style={{ fontSize: 11.5, color: TER }}>{tk.s}</div>
            </div>
            {tk.sel && <Check size={16} color={TEAL} stroke={14} />}
          </div>
        ))}
      </div>

      {/* ── FAQ fold (clipped by the canvas, like the live page) ── */}
      <div
        style={{
          position: "absolute",
          left: 418,
          top: 800,
          width: 763,
          height: 260,
          backgroundColor: "#f0f1f4",
          borderRadius: 24,
        }}
      >
        <div style={{ position: "absolute", left: 46, top: 38, fontSize: 24, fontWeight: 700 }}>
          FAQ
        </div>
        <div
          style={{
            position: "absolute",
            left: 46,
            top: 86,
            width: 670,
            height: 150,
            backgroundColor: "#fff",
            borderRadius: 16,
            padding: "22px 26px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 17, fontWeight: 600 }}>What is CRX?</span>
            <span style={{ fontSize: 14, color: TER }}>⌃</span>
          </div>
          <div style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.55, color: SEC }}>
            CRX is a network for institutional FX hedging, settled on-chain. You onboard once,
            request custom contracts, and reach every dealer on the network.
          </div>
        </div>
      </div>

      {/* ── corridor dropdown — floats over the wells during beat B ── */}
      {panelOpen && panelIn > 0 && (
        <div
          style={{
            position: "absolute",
            left: 210,
            top: 532,
            width: 652,
            borderRadius: 16,
            backgroundColor: "#fff",
            border: `1px solid ${BORDER}`,
            boxShadow: "0 18px 44px rgba(28,28,35,0.16), 0 2px 8px rgba(28,28,35,0.08)",
            padding: 8,
            opacity: panelIn,
            transform: `scaleY(${(0.96 + 0.04 * panelIn).toFixed(3)})`,
            transformOrigin: "center top",
          }}
        >
          {hoverOp > 0 && (
            <div
              style={{
                position: "absolute",
                left: 8,
                top: 8 + 58 * hoverIdx,
                width: 636,
                height: 58,
                borderRadius: 12,
                backgroundColor: TEAL_SOFT,
                boxShadow: `inset 0 0 0 1.5px ${TEAL_RING}`,
                opacity: hoverOp,
              }}
            />
          )}
          {CORRIDORS.map((c, i) => (
            <div
              key={c.pair}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                height: 58,
                padding: "0 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <FlagPair a={c.a} b={c.b} size={24} />
                <span style={{ fontSize: 16, fontWeight: 600 }}>{c.pair}</span>
                <span style={{ fontSize: 13.5, color: TER }}>{c.sub}</span>
              </div>
              {selIdx === i && <Check size={17} color={TEAL} stroke={14} />}
            </div>
          ))}
        </div>
      )}

      <Cursor frame={frame} keys={CURSOR_KEYS} clicks={CURSOR_CLICKS} appear={56} />

      {/* hairline under the nav content, matching the live page fold */}
      <div
        style={{ position: "absolute", left: 0, top: 111, width: "100%", height: 1, backgroundColor: HAIR }}
      />
    </div>
  );
};

// ═══════════════════════════════ copy (screen space) ═══════════════════════════════

type W = { t: string; f: number };
const COPY_FS = 55.6;
const CAP_OFFSET = 0.065;

const COPY_LINES: { words: W[]; x: number; capTop: number; cut?: number }[] = [
  { words: [{ t: "Access", f: 7 }], x: 71, capTop: 291, cut: 53 },
  { words: [{ t: "rate", f: 11 }, { t: "locks", f: 15 }], x: 71, capTop: 355, cut: 53 },
  { words: [{ t: "In", f: 61 }, { t: "Any", f: 65 }, { t: "Corridor", f: 69 }], x: 88, capTop: 330, cut: 103 },
  { words: [{ t: "At", f: 106 }, { t: "your", f: 110 }], x: 77, capTop: 275 },
  { words: [{ t: "preferred", f: 114 }], x: 77, capTop: 339 },
  { words: [{ t: "date", f: 118 }], x: 75, capTop: 396 },
  { words: [{ t: "and", f: 121 }, { t: "notional", f: 125 }], x: 75, capTop: 460 },
];

const CopyLine: React.FC<{
  words: W[];
  x: number;
  capTop: number;
  cut?: number;
  frame: number;
}> = ({ words, x, capTop, cut, frame }) => {
  if (frame < words[0].f) return null;
  if (cut !== undefined && frame >= cut) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: capTop - CAP_OFFSET * COPY_FS,
        fontFamily: POPPINS,
        fontWeight: 300,
        fontSize: COPY_FS,
        lineHeight: 1,
        color: COPY_INK,
        whiteSpace: "pre",
        filter: "blur(0.4px)",
        opacity: 0.97,
      }}
    >
      {words.map((w, i) => {
        if (frame < w.f) {
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: 0 }}>
              {w.t + (i < words.length - 1 ? " " : "")}
            </span>
          );
        }
        const dt = frame - w.f;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              transform: `translateY(${(-53 * Math.pow(0.74, dt)).toFixed(2)}px)`,
            }}
          >
            {w.t + (i < words.length - 1 ? " " : "")}
          </span>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════ composition ═══════════════════════════════

export const ZoomFollowProp: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);

  // Frosted veil under the copy — derived from the camera itself: it
  // rises exactly when the page's left edge dives past the copy column
  // (the tenor framing), and dissolves as the camera returns. Gated to
  // beat C so beats A/B keep their copy on open water.
  const veil =
    interpolate(cam.tx, [340, 430], [1, 0], clamp) *
    interpolate(frame, [103, 108], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0c10" }}>
      <Loop durationInFrames={540}>
        <OffthreadVideo
          muted
          src={staticFile("crx-assets/bridge-wave.mp4")}
          style={{ position: "absolute", width: 1280, height: 720, objectFit: "cover" }}
        />
      </Loop>

      {/* the page under the one camera */}
      <div
        style={{
          position: "absolute",
          width: PAGE_W,
          height: PAGE_H,
          transform: `translate(${cam.tx.toFixed(2)}px, ${cam.ty.toFixed(2)}px) scale(${cam.s.toFixed(4)})`,
          transformOrigin: "0 0",
        }}
      >
        <SwapPage frame={frame} />
      </div>

      {/* frosted veil (screen space, left column) */}
      {veil > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 640,
            height: 720,
            opacity: veil,
            backgroundColor: "rgba(246,248,250,0.9)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            maskImage: "linear-gradient(90deg, #000 0%, #000 55%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(90deg, #000 0%, #000 55%, transparent 100%)",
          }}
        />
      )}

      {/* copy — screen space, never zooms with the page */}
      {COPY_LINES.map((l, i) => (
        <CopyLine key={i} {...l} frame={frame} />
      ))}
    </AbsoluteFill>
  );
};

export const zoomFollowPropMeta = {
  id: "CRX-Anoma-Prop-Zoom",
  component: ZoomFollowProp,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 153,
};
