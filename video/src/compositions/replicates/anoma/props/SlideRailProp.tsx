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
// SLIDE RAIL — panes in a viewport (proposition for the CRX-Anoma
// cut, beats 4–5: "Access rate locks" → "In Any Corridor" → "At
// your preferred date and notional").
//
// One full-fidelity swap page (app.crxfx.com/swap: amber sandbox
// banner, white nav, "Open a hedge" card, right rail) is built at
// page scale. Three PANES ride a horizontal rail inside a fixed
// rounded viewport; each pane is a purposeful crop of that page at
// real app density. The rail slides hard between beats — panes move
// 100% of the distance, the page inside them ~92%, so mid-slide the
// content lags the frame (parallax depth) and the crop briefly
// reveals the page beyond the settled framing (the right rail edge
// shows during the slides — the page is bigger than the window).
// No cross-fades; the slide carries the energy. App state is ONE
// continuous clock across all panes: the rate locked in pane 1 is
// still locked when pane 3 arms the CTA.
// ═══════════════════════════════════════════════════════════════

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
const { fontFamily: POPPINS } = loadPoppins("normal", {
  weights: ["300"],
  subsets: ["latin"],
});

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

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
const AMBER = "#c77d0a";
const BRASS = "#8a5d12"; // AA text brass (--accent-2)
const BRASS_RING = "rgba(192, 138, 46, 0.32)"; // luminous signal brass ring
const COPY_INK = "#1D1D1F";

const CARD_SHADOW =
  "0 14px 42px rgba(28, 28, 35, 0.18), 0 3px 12px rgba(28, 28, 35, 0.10)";

const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

const label: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: 11.5,
  fontWeight: 600,
  letterSpacing: 1.1,
  color: TER,
  textTransform: "uppercase",
};

const tnum: React.CSSProperties = { fontFeatureSettings: "'tnum'" };

// ─── shared physics (inherited from the CRX card family) ───
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

const stepSlide = (frame: number, steps: number[], dur = 4) => {
  let v = 0;
  for (const s of steps) {
    v += smooth(interpolate(frame, [s, s + dur], [0, 1], clamp));
  }
  return v;
};

// ─── shared marks ───
const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="crxSlideMark" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#crxSlideMark)" strokeWidth="11" strokeLinecap="round">
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

// ─── cursor: the operator's hand (page coordinates) ───
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
        width={15}
        height={21}
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

// ═══ the one clock: story state ═══
const CORRIDORS = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos", rate: "17.5104", spot: "17.499" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees", rate: "84.212", spot: "84.155" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira", rate: "38.905", spot: "38.822" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais", rate: "5.4310", spot: "5.418" },
];

const LOCK_AT = 35; // pane 1 — the forward rate goes firm
const PANEL_AT = 64; // pane 2 — corridor dropdown opens
const HOVER_STEPS = [74, 80, 86]; // hover ring hops after landing on row 0 at f70
const SELECT_AT = 93; // click makes USD/BRL the pair
const TENOR_AT = 112; // pane 3 — Jun 30, 2027 lands
const FOCUS_AT = 120; // notional field takes focus
const TYPE_START = 124;
const NOTIONAL_STR = "2,500,000";
const TYPE_END = TYPE_START + (NOTIONAL_STR.length - 1) * 2; // f140
const ARM_AT = 144; // CTA arms: "Request quotes"

const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087", "17.5104"];
const SPOT_FLICK = ["1", "3", "0", "4", "2", "5"];

const CURSOR_KEYS: CursorKey[] = [
  { f: 56, x: 690, y: 470 },
  { f: 61, x: 735, y: 403 }, // "Change ⌄" on the pair row
  { f: 64, x: 735, y: 403 },
  { f: 68, x: 480, y: 450 }, // into the dropdown
  { f: 71, x: 430, y: 474 }, // row 0 (USD/MXN)
  { f: 74, x: 430, y: 474 },
  { f: 78, x: 430, y: 522 }, // row 1
  { f: 80, x: 430, y: 522 },
  { f: 84, x: 430, y: 570 }, // row 2
  { f: 86, x: 430, y: 570 },
  { f: 90, x: 430, y: 618 }, // row 3 (USD/BRL) — click selects
  { f: 95, x: 430, y: 618 },
  { f: 102, x: 460, y: 560 },
  { f: 109, x: 330, y: 497 }, // tenor well
  { f: 114, x: 330, y: 497 },
  { f: 118, x: 290, y: 267 }, // notional field
  { f: 121, x: 290, y: 267 },
  { f: 127, x: 545, y: 307 }, // rest aside while it types
  { f: 143, x: 483, y: 613 }, // CTA
  { f: 153, x: 483, y: 613 },
];
const CURSOR_CLICKS = [62, 92, 112, 120];

// ═══ the full-fidelity swap page (page coordinates, 1440 wide) ═══
const PAGE = { w: 1440, h: 790 };
const CARD = { x: 160, y: 150, w: 645, h: 516 };

const SwapPage: React.FC<{ frame: number }> = ({ frame }) => {
  const cor = CORRIDORS[frame < SELECT_AT ? 0 : 3];
  const reQuote = frame >= SELECT_AT ? settle(frame, SELECT_AT, 9, 0.74) : {};

  // Pane 1 — the rate ticks (Indicative), then locks at f35.
  const locked = frame >= LOCK_AT;
  const rate = locked ? cor.rate : RATE_TICKS[Math.floor(frame / 4) % RATE_TICKS.length];
  const lockPulse =
    interpolate(frame, [LOCK_AT, LOCK_AT + 3], [0, 1], clamp) *
    interpolate(frame, [47, 57], [1, 0], clamp);
  const spot = cor.spot + SPOT_FLICK[Math.floor(frame / 5) % SPOT_FLICK.length];

  // Pane 2 — corridor dropdown.
  const panelOpen = frame >= PANEL_AT && frame < 100;
  const panelIn = fadeIn(frame, PANEL_AT, 3) * interpolate(frame, [95, 99], [1, 0], clamp);
  const hoverIdx = stepSlide(frame, HOVER_STEPS, 4);
  const hoverOp = fadeIn(frame, 70, 3);
  const selIdx = frame < SELECT_AT ? 0 : 3;

  // Pane 3 — tenor, notional, CTA.
  const tenor =
    frame < TENOR_AT
      ? ["Aug 1, 2026", "30 days from today"]
      : ["Jun 30, 2027", "363 days from today"];
  const tenorSwap = frame >= TENOR_AT ? settle(frame, TENOR_AT, 8, 0.74) : {};
  const tenorFocus =
    interpolate(frame, [110, 113], [0, 1], clamp) * interpolate(frame, [122, 128], [1, 0], clamp);
  const focused = frame >= FOCUS_AT;
  const typedChars =
    frame < TYPE_START
      ? 0
      : Math.min(Math.floor((frame - TYPE_START) / 2) + 1, NOTIONAL_STR.length);
  const typing = typedChars > 0 && typedChars < NOTIONAL_STR.length;
  const caretOn = focused && (typing || Math.floor(frame / 8) % 2 === 0);
  const armed = frame >= ARM_AT;
  const ctaSettle = armed ? settle(frame, ARM_AT, 6, 0.72) : {};

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: PAGE.w,
        height: PAGE.h,
        backgroundColor: BG,
        fontFamily: INTER,
        color: INK,
      }}
    >
      {/* sandbox banner */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: PAGE.w,
          height: 36,
          backgroundColor: AMBER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 13,
          fontWeight: 500,
          color: "#fff",
        }}
      >
        Sandbox — Base Sepolia testnet. No real funds at risk.
      </div>

      {/* nav */}
      <div
        style={{
          position: "absolute",
          top: 36,
          left: 0,
          width: PAGE.w,
          height: 66,
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          padding: "0 60px",
        }}
      >
        <CrxMark size={22} />
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: -0.6, marginLeft: 9 }}>
          CRX
        </span>
        <div style={{ display: "flex", gap: 6, marginLeft: 56 }}>
          {["Swap", "Transfer", "Portfolio", "Compliance"].map((t) => {
            const active = t === "Swap";
            return (
              <div
                key={t}
                style={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active ? INK : SEC,
                  padding: "7px 14px",
                  borderRadius: 10,
                  backgroundColor: active ? "#eef0f3" : undefined,
                }}
              >
                {t}
                {!active && <span style={{ color: TER, marginLeft: 5, fontSize: 11 }}>⌄</span>}
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginLeft: "auto",
            backgroundColor: TEAL,
            color: "#fff",
            fontSize: 13.5,
            fontWeight: 600,
            borderRadius: 980,
            padding: "10px 19px",
          }}
        >
          Connect wallet
        </div>
      </div>

      {/* ── "Open a hedge" card ── */}
      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          backgroundColor: "#fff",
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 26, top: 22, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: TER, fontSize: 19, lineHeight: 1 }}>‹</span>
          <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: -0.3 }}>Open a hedge</span>
        </div>

        {/* forward notional well */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 62,
            width: 593,
            height: 118,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "14px 18px",
            boxShadow: focused && frame < TYPE_END + 8 ? `0 0 0 3px ${TEAL_RING}` : undefined,
          }}
        >
          <div style={label}>Forward notional</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: -0.8,
                marginTop: 3,
                color: typedChars > 0 ? INK : TER,
                ...tnum,
              }}
            >
              {typedChars > 0 ? NOTIONAL_STR.slice(0, typedChars) : focused ? "" : "0.0"}
              {caretOn && <span style={{ color: TEAL, fontWeight: 400, marginLeft: 1 }}>|</span>}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "6px 14px 6px 8px",
              }}
            >
              <UsdcMark size={22} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>USDC</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
            <span style={{ fontSize: 12.5, color: SEC, ...tnum }}>
              Spot price {spot} {cor.pair.slice(4)}
            </span>
          </div>
        </div>

        {/* pair well */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 196,
            width: 593,
            height: 88,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "12px 16px",
          }}
        >
          <div style={label}>Pair</div>
          <div
            style={{
              marginTop: 8,
              height: 46,
              backgroundColor: "#fff",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, ...reQuote }}>
              <FlagPair a={cor.a} b={cor.b} />
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.15 }}>{cor.pair}</div>
                <div style={{ fontSize: 12, color: TER }}>{cor.sub}</div>
              </div>
            </div>
            <span style={{ fontSize: 13, color: SEC }}>Change ⌄</span>
          </div>
        </div>

        {/* tenor + forward rate wells */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 300,
            width: 288,
            height: 88,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "12px 16px",
            boxShadow:
              tenorFocus > 0
                ? `0 0 0 3px rgba(15,182,171,${(0.28 * tenorFocus).toFixed(3)})`
                : undefined,
          }}
        >
          <div style={label}>Tenor</div>
          <div style={{ ...tenorSwap }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, lineHeight: 1.15, ...tnum }}>
              {tenor[0]}
            </div>
            <div style={{ fontSize: 12, color: TER }}>{tenor[1]}</div>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 331,
            top: 300,
            width: 288,
            height: 88,
            backgroundColor: WELL,
            borderRadius: 16,
            padding: "12px 16px",
            boxShadow: lockPulse > 0 ? `0 0 0 3px ${BRASS_RING}` : undefined,
            outline:
              lockPulse > 0 ? `1.5px solid rgba(192,138,46,${lockPulse.toFixed(2)})` : undefined,
          }}
        >
          <div style={label}>Forward rate</div>
          <div style={{ ...(frame >= SELECT_AT ? reQuote : {}) }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 6, lineHeight: 1.15, ...tnum }}>
              {rate}
            </div>
            <div style={{ fontSize: 12, color: TER }}>{cor.pair.slice(4)} per USD</div>
          </div>
          {!locked ? (
            <div
              style={{
                position: "absolute",
                right: 12,
                top: 10,
                fontSize: 11.5,
                fontWeight: 600,
                color: TER,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "3px 10px",
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
                top: 10,
                display: "flex",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(192,138,46,0.12)",
                borderRadius: 980,
                padding: "4px 10px",
                ...settle(frame, LOCK_AT, 12, 0.74),
              }}
            >
              <svg viewBox="0 0 24 24" width={11} height={11}>
                <path
                  d="M7 10V7a5 5 0 0 1 10 0v3"
                  fill="none"
                  stroke={BRASS}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <rect x="5" y="10" width="14" height="10" rx="2.4" fill={BRASS} />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, color: BRASS }}>
                Locked · firm 120s
              </span>
            </div>
          )}
        </div>

        {/* convert line */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 404,
            width: CARD.w,
            textAlign: "center",
            fontSize: 12.5,
            color: SEC,
            ...tnum,
          }}
        >
          Convert {cor.pair.slice(4)} → USD on {tenor[0]} at the locked rate
        </div>

        {/* CTA */}
        <div
          style={{
            position: "absolute",
            left: 26,
            top: 434,
            width: 593,
            height: 56,
            borderRadius: 14,
            backgroundColor: armed ? TEAL : "#a9e4de",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15.5,
            fontWeight: 600,
            color: "#fff",
          }}
        >
          <span style={{ ...ctaSettle }}>{armed ? "Request quotes" : "Enter an amount"}</span>
        </div>
      </div>

      {/* ── right rail: SIDE ── */}
      <div
        style={{
          position: "absolute",
          left: 825,
          top: 150,
          width: 455,
          height: 168,
          backgroundColor: "#fff",
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 22, top: 20, ...label }}>Side</div>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 46,
            width: 411,
            height: 48,
            borderRadius: 12,
            backgroundColor: "rgba(15,182,171,0.07)",
            boxShadow: `inset 0 0 0 1.5px ${TEAL_RING}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 600, color: TEAL }}>Buy / Long</span>
          <Check size={16} color={TEAL} stroke={14} />
        </div>
        <div
          style={{
            position: "absolute",
            left: 22,
            top: 102,
            width: 411,
            height: 48,
            borderRadius: 12,
            backgroundColor: WELL,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
          }}
        >
          <span style={{ fontSize: 14.5, fontWeight: 500 }}>Sell / Short</span>
        </div>
      </div>

      {/* ── right rail: MARGIN TOKEN ── */}
      <div
        style={{
          position: "absolute",
          left: 825,
          top: 338,
          width: 455,
          height: 190,
          backgroundColor: "#fff",
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          boxShadow: "0 10px 30px rgba(28,28,35,0.06)",
        }}
      >
        <div style={{ position: "absolute", left: 22, top: 20, ...label }}>Margin token</div>
        {[
          { name: "USDC", sub: "USD Coin", c: "", g: "", sel: true },
          { name: "USDT", sub: "Tether", c: "#26A17B", g: "₮", sel: false },
          { name: "aUSD", sub: "Agora Dollar", c: "#C09A4E", g: "A", sel: false },
          { name: "EURC", sub: "Euro Coin", c: "#2775CA", g: "€", sel: false },
        ].map((t, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <div
              key={t.name}
              style={{
                position: "absolute",
                left: 22 + col * 212,
                top: 46 + row * 66,
                width: 199,
                height: 56,
                borderRadius: 12,
                backgroundColor: t.sel ? "rgba(15,182,171,0.07)" : WELL,
                boxShadow: t.sel ? `inset 0 0 0 1.5px ${TEAL_RING}` : undefined,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0 12px",
              }}
            >
              {t.sel ? (
                <UsdcMark size={26} />
              ) : (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: t.c,
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {t.g}
                </div>
              )}
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: TER }}>{t.sub}</div>
              </div>
              {t.sel && (
                <div style={{ marginLeft: "auto" }}>
                  <Check size={15} color={TEAL} stroke={14} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FAQ band below the fold — a hint of the page continuing */}
      <div
        style={{
          position: "absolute",
          left: 380,
          top: 720,
          width: 680,
          height: 60,
          backgroundColor: "#fff",
          borderRadius: 16,
          border: `1px solid ${BORDER}`,
        }}
      >
        <div style={{ position: "absolute", left: 28, top: 18, fontSize: 18, fontWeight: 700 }}>
          FAQ
        </div>
      </div>

      {/* ── corridor dropdown — floats over the lower wells ── */}
      {panelOpen && panelIn > 0 && (
        <div
          style={{
            position: "absolute",
            left: CARD.x + 26,
            top: 442,
            width: 593,
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
                top: 8 + 48 * hoverIdx,
                width: 577,
                height: 48,
                borderRadius: 10,
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
                height: 48,
                padding: "0 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <FlagPair a={c.a} b={c.b} size={21} />
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{c.pair}</span>
                <span style={{ fontSize: 12.5, color: TER }}>{c.sub}</span>
              </div>
              {selIdx === i && <Check size={16} color={TEAL} stroke={14} />}
            </div>
          ))}
        </div>
      )}

      <Cursor frame={frame} keys={CURSOR_KEYS} clicks={CURSOR_CLICKS} appear={56} />
    </div>
  );
};

// ═══ the rail: three crops of the page in one fixed viewport ═══
const VP = { left: 504, top: 115, w: 730, h: 486, r: 20 };
const GUTTER = 16;
const STEP = VP.w + GUTTER;

// Each pane is a purposeful crop: scale ≈ real app density, x0/y0 =
// page coords of the viewport's top-left when settled.
const CROPS = [
  { s: 1.153, x0: 166, y0: 285 }, // pane 1 — tenor + forward-rate wells
  { s: 1.14, x0: 168, y0: 312 }, // pane 2 — pair well + corridor dropdown
  { s: 1.03, x0: 108, y0: 198 }, // pane 3 — notional, tenor, CTA
];

const SLIDE_STARTS = [49, 96];
const SLIDE_EASE = Easing.bezier(0.87, 0, 0.13, 1);

// Hard slide: ~14 frames on the master curve, ≤6px overshoot, settle.
const slidePx = (frame: number, start: number, dist: number) => {
  const main = interpolate(frame, [start, start + 13], [0, dist + 6], {
    ...clamp,
    easing: SLIDE_EASE,
  });
  const back = interpolate(frame, [start + 13, start + 19], [0, 6], {
    ...clamp,
    easing: Easing.out(Easing.quad),
  });
  return main - back;
};

const Viewport: React.FC<{ frame: number }> = ({ frame }) => {
  const railX = SLIDE_STARTS.reduce((acc, s) => acc + slidePx(frame, s, STEP), 0);
  return (
    <div
      style={{
        position: "absolute",
        left: VP.left,
        top: VP.top,
        width: VP.w,
        height: VP.h,
        borderRadius: VP.r,
        overflow: "hidden",
        backgroundColor: "#dfe2e9", // the rail groove, seen in the gutter
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: STEP * CROPS.length,
          height: VP.h,
          transform: `translateX(${(-railX).toFixed(2)}px)`,
        }}
      >
        {CROPS.map((c, i) => {
          const screenX = i * STEP - railX;
          if (screenX > VP.w + 40 || screenX + VP.w < -40) return null;
          // Panes move 100% of the distance; the page inside ~92%.
          const par = 0.08 * Math.max(-STEP, Math.min(STEP, railX - i * STEP));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: i * STEP,
                top: 0,
                width: VP.w,
                height: VP.h,
                overflow: "hidden",
                backgroundColor: BG,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: PAGE.w,
                  height: PAGE.h,
                  transformOrigin: "0 0",
                  transform: `translate(${(-c.x0 * c.s + par).toFixed(2)}px, ${(
                    -c.y0 * c.s
                  ).toFixed(2)}px) scale(${c.s})`,
                }}
              >
                <SwapPage frame={frame} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── progress hint: three dots under the viewport ───
const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);

const ProgressDots: React.FC<{ frame: number }> = ({ frame }) => {
  const railX = SLIDE_STARTS.reduce((acc, s) => acc + slidePx(frame, s, STEP), 0);
  const p = railX / STEP; // 0 → 2, continuous
  return (
    <div
      style={{
        position: "absolute",
        left: VP.left + VP.w / 2,
        top: VP.top + VP.h + 15,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 7,
      }}
    >
      {CROPS.map((_, i) => {
        const t = Math.max(0, 1 - Math.abs(p - i) * 1.6);
        return (
          <div
            key={i}
            style={{
              width: 6 + 16 * t,
              height: 6,
              borderRadius: 3,
              backgroundColor: `rgba(${mix(29, 15, t)},${mix(29, 182, t)},${mix(31, 171, t)},${(
                0.3 +
                0.7 * t
              ).toFixed(2)})`,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── copy: left column, master text engine physics ───
type WordSpec = { t: string; f: number };
type LineSpec = { words: WordSpec[]; x: number; capTop: number; cut?: number };

const COPY_FS = 55.6;
const CAP_OFFSET = 0.065;

const COPY_LINES: LineSpec[] = [
  { words: [{ t: "Access", f: 7 }], x: 71, capTop: 291, cut: 53 },
  { words: [{ t: "rate", f: 11 }, { t: "locks", f: 15 }], x: 71, capTop: 355, cut: 53 },
  {
    words: [{ t: "In", f: 61 }, { t: "Any", f: 65 }, { t: "Corridor", f: 69 }],
    x: 88,
    capTop: 330,
    cut: 103,
  },
  { words: [{ t: "At", f: 106 }, { t: "your", f: 110 }], x: 77, capTop: 275 },
  { words: [{ t: "preferred", f: 114 }], x: 77, capTop: 339 },
  { words: [{ t: "date", f: 118 }], x: 75, capTop: 396 },
  { words: [{ t: "and", f: 121 }, { t: "notional", f: 125 }], x: 75, capTop: 460 },
];

const wordDrop = (frame: number, start: number): React.CSSProperties => {
  if (frame < start) return { opacity: 0 };
  const off = 53 * Math.pow(0.74, frame - start);
  return { transform: `translateY(${(-off).toFixed(2)}px)`, opacity: 1 };
};

const CopyLine: React.FC<LineSpec & { frame: number }> = ({ words, x, capTop, cut, frame }) => {
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
      {words.map((w, i) => (
        <span
          key={i}
          style={{ display: "inline-block", whiteSpace: "pre", ...wordDrop(frame, w.f) }}
        >
          {w.t + (i < words.length - 1 ? " " : "")}
        </span>
      ))}
    </div>
  );
};

// ═══ composition ═══
export const SlideRailProp: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Loop durationInFrames={540}>
        <OffthreadVideo
          muted
          src={staticFile("crx-assets/bridge-wave.mp4")}
          style={{ position: "absolute", width: 1280, height: 720, objectFit: "cover" }}
        />
      </Loop>
      {COPY_LINES.map((l, i) => (
        <CopyLine key={i} {...l} frame={frame} />
      ))}
      <Viewport frame={frame} />
      <ProgressDots frame={frame} />
    </AbsoluteFill>
  );
};

export const slideRailPropMeta = {
  id: "CRX-Anoma-Prop-Slide",
  component: SlideRailProp,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 153,
};
