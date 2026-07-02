import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { clamp } from "./AnomaComposition";

// ═══════════════════════════════════════════════════════════════
// CRX in-app mock cards for the CRX-Anoma cut. Every card is drawn
// in code from the app's own design tokens (app.crxfx.com globals):
// Inter, teal #0fb6ab, Mercury-white surfaces, brass for the lock
// moment, the app's own flag files. Mount windows, fade/blur curves
// and the success-dot expansion are inherited frame-for-frame from
// the measured Anoma reference so the choreography stays identical —
// only the pictures now tell the CRX story.
// ═══════════════════════════════════════════════════════════════

const { fontFamily: INTER } = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
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
const SUCCESS = "#0e7a4a";
const AMBER = "#c77d0a";
const BRASS = "#8a5d12"; // AA text brass (--accent-2)
const BRASS_RING = "rgba(192, 138, 46, 0.32)"; // luminous signal brass ring

const flag = (cc: string) => staticFile(`crx-assets/flags/${cc}.svg`);

// Card slot shared with the Anoma originals: left 504, top 122, 710×472.
const SLOT = { left: 504, top: 122, w: 710, h: 472 };

const label: React.CSSProperties = {
  fontFamily: INTER,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.1,
  color: TER,
  textTransform: "uppercase",
};

const tnum: React.CSSProperties = { fontFeatureSettings: "'tnum'" };

// Element settle: the reference word physics (drop, exponential decay).
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

// ─── shared chrome ───

const CrxMark: React.FC<{ size: number }> = ({ size }) => (
  <svg viewBox="0 0 100 100" width={size} height={size}>
    <defs>
      <linearGradient id="crxMarkV" gradientUnits="userSpaceOnUse" x1="50" y1="8" x2="50" y2="92">
        <stop offset="0" stopColor="#2AD4BB" />
        <stop offset="0.5" stopColor="#1CC8C6" />
        <stop offset="1" stopColor="#19B6DD" />
      </linearGradient>
    </defs>
    <g fill="none" stroke="url(#crxMarkV)" strokeWidth="11" strokeLinecap="round">
      <line x1="50" y1="8" x2="50" y2="92" />
      <line x1="13.6" y1="71" x2="86.4" y2="29" />
      <line x1="13.6" y1="29" x2="86.4" y2="71" />
    </g>
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

const Card: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  blur?: number;
  scale?: number;
  radius?: number;
  bg?: string;
  children: React.ReactNode;
}> = ({ x, y, w, h, opacity, blur = 0, scale = 1, radius = 18, bg = "#fff", children }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        borderRadius: radius,
        backgroundColor: bg,
        border: `1px solid ${BORDER}`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.38), 0 4px 18px rgba(0,0,0,0.22)",
        overflow: "hidden",
        fontFamily: INTER,
        color: INK,
        transform: scale !== 1 ? `scale(${scale.toFixed(4)})` : undefined,
        filter: blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

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

// ─── Scene 3 (f128-207): portfolio overview under "Introducing CRX" ───
// Fade/blur/bar curves lifted from the reference Scene3Dash.
const S3_BARS = { h: [118, 94, 140, 128, 172], months: ["Feb", "Mar", "Apr", "May", "Jun"] };

export const CrxScene3Dash: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 128 || frame >= 208) return null;
  const opacity =
    interpolate(frame, [127, 152], [0, 1], clamp) *
    interpolate(frame, [203, 207], [1, 0], clamp);
  const p = interpolate(
    frame,
    [137, 140, 150, 160, 170, 180, 190, 200, 203],
    [0, 0.21, 0.29, 0.41, 0.57, 0.72, 0.87, 0.97, 1],
    clamp,
  );
  const blurIn = interpolate(frame, [128, 158], [3.5, 0], clamp);
  const blurOut = interpolate(frame, [203, 207], [0, 6], clamp);
  return (
    <Card
      x={SLOT.left}
      y={SLOT.top + 1}
      w={SLOT.w}
      h={SLOT.h - 2}
      opacity={opacity}
      blur={Math.max(blurIn, blurOut)}
    >
      <div style={{ position: "absolute", inset: 0, padding: 30 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <CrxMark size={20} />
            <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Portfolio</span>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: AMBER,
              backgroundColor: "rgba(199,125,10,0.10)",
              borderRadius: 980,
              padding: "4px 11px",
            }}
          >
            Sandbox
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div style={label}>Total value</div>
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1, marginTop: 6, ...tnum }}>
            $30,440<span style={{ color: TER, fontSize: 24 }}>.00</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 500, color: SUCCESS, marginTop: 4, ...tnum }}>
            +$1,240 unrealized
          </div>
        </div>

        {[
          ["Available", "$12,180.00"],
          ["Margin in use", "$8,260.00"],
          ["Margin ratio", "22%"],
        ].map(([k, v], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 30,
              top: 248 + i * 52,
              width: 290,
              height: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${HAIR}`,
            }}
          >
            <span style={{ fontSize: 13.5, color: SEC }}>{k}</span>
            <span style={{ fontSize: 14, fontWeight: 500, ...tnum }}>{v}</span>
          </div>
        ))}

        <div style={{ position: "absolute", left: 372, top: 226, ...label }}>Hedged notional</div>
        <div
          style={{
            position: "absolute",
            left: 372,
            top: 404,
            width: 308,
            height: 1,
            backgroundColor: HAIR,
          }}
        />
        {S3_BARS.h.map((h, i) => {
          const bh = h * p;
          return (
            <React.Fragment key={i}>
              {bh >= 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: 376 + i * 62,
                    top: 404 - bh,
                    width: 34,
                    height: bh,
                    backgroundColor: TEAL,
                    borderRadius: "6px 6px 0 0",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: 376 + i * 62,
                  top: 412,
                  width: 34,
                  textAlign: "center",
                  fontSize: 10.5,
                  color: TER,
                }}
              >
                {S3_BARS.months[i]}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </Card>
  );
};

// ─── Scene 4 (f205-357): "Open a hedge" in three beats ───
// A: the forward rate ticks live, then LOCKS (brass — the app reserves
//    brass for the instant a rate becomes binding).
// B: the corridor list opens; the highlight walks it; the pair follows.
// C: tenor picks Jun 2027, the notional types itself, the CTA arms.
const CORRIDORS: { a: string; b: string; pair: string; sub: string; rate: string }[] = [
  { a: "us", b: "mx", pair: "USD/MXN", sub: "Dollars / Mexican pesos", rate: "17.5104" },
  { a: "us", b: "in", pair: "USD/INR", sub: "Dollars / Indian rupees", rate: "84.212" },
  { a: "us", b: "tr", pair: "USD/TRY", sub: "Dollars / Turkish lira", rate: "38.905" },
  { a: "us", b: "br", pair: "USD/BRL", sub: "Dollars / Brazilian reais", rate: "5.4310" },
];
const CORRIDOR_STEPS = [266, 276, 286, 296]; // highlight walk, one per row

const RATE_TICKS = ["17.5081", "17.5104", "17.5092", "17.5110", "17.5087", "17.5104"];

const NOTIONAL = "2,500,000";

export const CrxScene4Hedge: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 205 || frame >= 358) return null;
  const opacity = interpolate(frame, [204, 207], [0, 1], clamp);
  // Reference zoom beat f206-216 → scale settle.
  const scale = 1 + 0.045 * Math.pow(0.74, Math.max(0, frame - 206));

  // Which corridor the pair well shows.
  let corridor = 0;
  for (let i = 0; i < CORRIDOR_STEPS.length; i++) {
    if (frame >= CORRIDOR_STEPS[i]) corridor = i;
  }
  const cor = CORRIDORS[frame < CORRIDOR_STEPS[0] ? 0 : corridor];
  const pairSwap = frame < CORRIDOR_STEPS[0] ? 1 : fadeIn(frame, CORRIDOR_STEPS[corridor], 2);

  // Beat A — rate ticks f219-239, locks at f240.
  const locked = frame >= 240;
  const rate =
    frame < 219
      ? RATE_TICKS[0]
      : locked || corridor > 0
        ? cor.rate
        : RATE_TICKS[Math.floor((frame - 219) / 4) % RATE_TICKS.length];
  const lockPulse =
    interpolate(frame, [240, 243], [0, 1], clamp) * interpolate(frame, [252, 262], [1, 0], clamp);

  // Beat B — corridor dropdown f264-308.
  const panelIn = fadeIn(frame, 264, 3) * interpolate(frame, [303, 307], [1, 0], clamp);
  const panelOpen = frame >= 264 && frame < 308;

  // Beat C — tenor swap f313/f322, notional types f326+, CTA arms f346.
  const tenor =
    frame < 313
      ? ["Aug 1, 2026", "30 days from today"]
      : frame < 322
        ? ["Sep 30, 2026", "90 days from today"]
        : ["Jun 30, 2027", "363 days from today"];
  const tenorFocus =
    interpolate(frame, [311, 314], [0, 1], clamp) * interpolate(frame, [330, 336], [1, 0], clamp);
  const typedChars = frame < 326 ? 0 : Math.min(Math.floor((frame - 326) / 2) + 1, NOTIONAL.length);
  const notionalTyped = NOTIONAL.slice(0, typedChars);
  const armed = frame >= 346;
  const ctaPulse = 1 + 0.02 * Math.pow(0.7, Math.max(0, frame - 346));

  return (
    <Card
      x={SLOT.left}
      y={SLOT.top - 2}
      w={SLOT.w}
      h={SLOT.h + 3}
      opacity={opacity}
      scale={scale}
    >
      <div style={{ position: "absolute", inset: 0, padding: "24px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: TER, fontSize: 18, lineHeight: 1 }}>‹</span>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Open a hedge</span>
        </div>

        {/* Forward notional well */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 62,
            width: 654,
            height: 108,
            backgroundColor: WELL,
            borderRadius: 14,
            padding: "14px 18px",
          }}
        >
          <div style={label}>Forward notional</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 600,
                letterSpacing: -0.8,
                marginTop: 4,
                color: typedChars > 0 ? INK : TER,
                ...tnum,
              }}
            >
              {typedChars > 0 ? notionalTyped : "0.0"}
              {typedChars > 0 && typedChars < NOTIONAL.length && (
                <span style={{ color: TEAL }}>|</span>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                backgroundColor: "#fff",
                border: `1px solid ${BORDER}`,
                borderRadius: 980,
                padding: "6px 13px 6px 7px",
              }}
            >
              <div
                style={{
                  width: 21,
                  height: 21,
                  borderRadius: 11,
                  backgroundColor: "#2775CA",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                $
              </div>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>USDC</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL }} />
            <span style={{ fontSize: 12, color: SEC, ...tnum }}>
              Spot price {corridor === 3 ? "5.4188" : corridor === 0 ? "17.4991" : cor.rate}{" "}
              {cor.pair.slice(4)}
            </span>
          </div>
        </div>

        {/* Pair well */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 182,
            width: 654,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 14,
            padding: "10px 18px",
          }}
        >
          <div style={label}>Pair</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 5,
              opacity: pairSwap,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <FlagPair a={cor.a} b={cor.b} />
              <div>
                <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: 1.15 }}>{cor.pair}</div>
                <div style={{ fontSize: 11.5, color: TER }}>{cor.sub}</div>
              </div>
            </div>
            <span style={{ fontSize: 13, color: SEC }}>Change ⌄</span>
          </div>
        </div>

        {/* Tenor + forward rate wells */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 268,
            width: 320,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 14,
            padding: "10px 18px",
            boxShadow: tenorFocus > 0 ? `0 0 0 3px rgba(15,182,171,${(0.28 * tenorFocus).toFixed(3)})` : undefined,
          }}
        >
          <div style={label}>Tenor</div>
          <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 5, lineHeight: 1.15, ...tnum }}>
            {tenor[0]}
          </div>
          <div style={{ fontSize: 11.5, color: TER }}>{tenor[1]}</div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 362,
            top: 268,
            width: 320,
            height: 74,
            backgroundColor: WELL,
            borderRadius: 14,
            padding: "10px 18px",
            boxShadow: lockPulse > 0 ? `0 0 0 3px ${BRASS_RING}` : undefined,
            outline: lockPulse > 0 ? `1.5px solid rgba(192,138,46,${lockPulse.toFixed(2)})` : undefined,
          }}
        >
          <div style={label}>Forward rate</div>
          <div style={{ fontSize: 15.5, fontWeight: 600, marginTop: 5, lineHeight: 1.15, ...tnum }}>
            {rate}
          </div>
          <div style={{ fontSize: 11.5, color: TER }}>{cor.pair.slice(4)} per USD</div>
          {frame >= 242 && (
            <div
              style={{
                position: "absolute",
                right: 14,
                top: 24,
                display: "flex",
                alignItems: "center",
                gap: 5,
                backgroundColor: "rgba(192,138,46,0.12)",
                borderRadius: 980,
                padding: "4px 10px",
                ...settle(frame, 242, 12, 0.74),
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
              <span style={{ fontSize: 11.5, fontWeight: 600, color: BRASS }}>
                Locked · firm 120s
              </span>
            </div>
          )}
        </div>

        {/* CTA */}
        <div
          style={{
            position: "absolute",
            left: 28,
            top: 358,
            width: 654,
            height: 52,
            borderRadius: 14,
            backgroundColor: armed ? TEAL : "#a9e4de",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15.5,
            fontWeight: 600,
            color: "#fff",
            transform: `scale(${ctaPulse.toFixed(4)})`,
          }}
        >
          {armed ? "Request quotes" : "Enter an amount"}
        </div>

        <div
          style={{
            position: "absolute",
            left: 0,
            width: 710,
            top: 425,
            textAlign: "center",
            fontSize: 12,
            color: SEC,
            ...tnum,
          }}
        >
          Convert {cor.pair.slice(4)} → USD on {tenor[0]} at the locked rate
        </div>

        {/* Corridor dropdown — floats over the lower wells during beat B */}
        {panelOpen && panelIn > 0 && (
          <div
            style={{
              position: "absolute",
              left: 28,
              top: 262,
              width: 654,
              borderRadius: 14,
              backgroundColor: "#fff",
              border: `1px solid ${BORDER}`,
              boxShadow: "0 18px 44px rgba(28,28,35,0.16), 0 2px 8px rgba(28,28,35,0.08)",
              padding: 8,
              opacity: panelIn,
              transform: `scaleY(${(0.96 + 0.04 * panelIn).toFixed(3)})`,
              transformOrigin: "center top",
            }}
          >
            {CORRIDORS.map((c, i) => {
              const active = corridor === i && frame >= CORRIDOR_STEPS[0];
              return (
                <div
                  key={c.pair}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    height: 44,
                    padding: "0 12px",
                    borderRadius: 10,
                    backgroundColor: active ? TEAL_SOFT : "transparent",
                    boxShadow: active ? `inset 0 0 0 1.5px ${TEAL_RING}` : undefined,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                    <FlagPair a={c.a} b={c.b} size={19} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{c.pair}</span>
                    <span style={{ fontSize: 12, color: TER }}>{c.sub}</span>
                  </div>
                  {active && <Check size={16} color={TEAL} stroke={14} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Scene 8 (f464-576): compliance onboarding under "Onboard in days" ───
// Sub-states crossfade on the reference OB_CHAIN frames; the success
// dot expands on the exact measured curve, teal instead of lime.
type ObRow = { k: string; v: string; state?: "pending" | "done" | "run" };

const OB_STATES: { at: number; step: number; rows: ObRow[] }[] = [
  {
    at: 463,
    step: 0,
    rows: [
      { k: "Legal entity", v: "—", state: "pending" },
      { k: "LEI", v: "—", state: "pending" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 471,
    step: 0,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "—", state: "pending" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 491,
    step: 0,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "—", state: "pending" },
    ],
  },
  {
    at: 495,
    step: 1,
    rows: [
      { k: "Legal entity", v: "Acme Treasury Ltd", state: "done" },
      { k: "LEI", v: "5493 00K2 T4YQ 12BC 7A91", state: "done" },
      { k: "Jurisdiction", v: "United Kingdom", state: "done" },
    ],
  },
  {
    at: 507,
    step: 1,
    rows: [
      { k: "KYB documents", v: "Received", state: "done" },
      { k: "Sanctions screening", v: "Running…", state: "run" },
      { k: "Beneficial owners", v: "Verifying…", state: "run" },
    ],
  },
  {
    at: 533,
    step: 2,
    rows: [
      { k: "KYB documents", v: "Verified", state: "done" },
      { k: "Sanctions screening", v: "Clear", state: "done" },
      { k: "Custody wallet", v: "0x12B7…0D1F whitelisted", state: "done" },
    ],
  },
];

const OB_STEPS = ["Entity", "Verification", "Wallet"];

const ObFace: React.FC<{ step: number; rows: ObRow[] }> = ({ step, rows }) => (
  <div style={{ position: "absolute", inset: 0, padding: "26px 30px", backgroundColor: "#fff" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Compliance</span>
      <span style={{ fontSize: 12, color: TER }}>Institutional onboarding</span>
    </div>

    {/* stepper */}
    <div style={{ position: "absolute", left: 30, top: 76, width: 650 }}>
      {[0, 1].map((i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: 24 + i * 271 + 24,
            top: 11,
            width: 271 - 48 + 24,
            height: 2,
            backgroundColor: step > i ? TEAL : "#e4e5ea",
          }}
        />
      ))}
      {OB_STEPS.map((s, i) => {
        const done = step > i;
        const active = step === i;
        return (
          <div key={s} style={{ position: "absolute", left: i * 271, width: 108, textAlign: "center" }}>
            <div
              style={{
                width: 24,
                height: 24,
                margin: "0 auto",
                borderRadius: 12,
                backgroundColor: done || active ? TEAL : "#fff",
                border: done || active ? "none" : "2px solid #e4e5ea",
                boxShadow: active ? `0 0 0 4px ${TEAL_RING}` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {done ? (
                <Check size={13} stroke={16} />
              ) : (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: active ? "#fff" : TER,
                    fontFamily: INTER,
                  }}
                >
                  {i + 1}
                </span>
              )}
            </div>
            <div
              style={{
                marginTop: 7,
                fontSize: 11.5,
                fontWeight: active || done ? 600 : 500,
                color: active || done ? INK : TER,
              }}
            >
              {s}
            </div>
          </div>
        );
      })}
    </div>

    {/* rows */}
    {rows.map((r, i) => (
      <div
        key={r.k}
        style={{
          position: "absolute",
          left: 30,
          top: 172 + i * 60,
          width: 650,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderTop: `1px solid ${HAIR}`,
        }}
      >
        <span style={{ fontSize: 14, color: SEC }}>{r.k}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {r.state === "done" && r.v !== "Received" && (
            <div
              style={{
                width: 17,
                height: 17,
                borderRadius: 9,
                backgroundColor: SUCCESS,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Check size={10} stroke={18} />
            </div>
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: r.state === "pending" ? 400 : 500,
              color: r.state === "pending" ? TER : r.state === "run" ? SEC : INK,
              ...tnum,
            }}
          >
            {r.v}
          </span>
        </div>
      </div>
    ))}

    <div style={{ position: "absolute", left: 30, bottom: 22, fontSize: 12, color: TER }}>
      Onboard once — trade with every dealer on the network.
    </div>
  </div>
);

export const CrxScene8Onboard: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 464 || frame >= 577) return null;
  const cardOpacity = interpolate(frame, [571, 576], [1, 0], clamp);
  if (cardOpacity <= 0) return null;
  // Success dot: the reference expansion curve, teal.
  const dotD = interpolate(
    frame,
    [541, 544, 547, 551, 552, 553, 554, 555, 556],
    [12, 44, 42, 42, 114, 168, 241, 260, 266],
    clamp,
  );
  const dotR = frame < 551 ? dotD / 2 : interpolate(frame, [551, 556], [dotD / 2, 16], clamp);
  const successOp = interpolate(frame, [552, 556], [0, 1], clamp);
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w} h={SLOT.h + 5} opacity={cardOpacity}>
      {OB_STATES.map(({ at, step, rows }, i) => {
        const op = fadeIn(frame, at, 3);
        if (op <= 0) return null;
        // Only render the topmost fully-visible face plus the one fading in.
        const next = OB_STATES[i + 1];
        if (next && frame >= next.at + 3) return null;
        return (
          <div key={at} style={{ position: "absolute", inset: 0, opacity: op }}>
            <ObFace step={step} rows={rows} />
          </div>
        );
      })}
      {frame >= 541 && successOp < 1 && (
        <div
          style={{
            position: "absolute",
            left: 349 - dotD / 2,
            top: 257 - dotD / 2,
            width: dotD,
            height: dotD,
            borderRadius: dotR,
            backgroundColor: TEAL,
          }}
        />
      )}
      {successOp > 0 && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "#fff", opacity: successOp }}>
          <div
            style={{
              position: "absolute",
              left: 349 - 37,
              top: 168,
              width: 74,
              height: 74,
              borderRadius: 37,
              backgroundColor: TEAL,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check size={40} stroke={13} />
          </div>
          <div
            style={{
              position: "absolute",
              top: 262,
              width: "100%",
              textAlign: "center",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: -0.5,
              color: INK,
              fontFamily: INTER,
            }}
          >
            Verified
          </div>
          <div
            style={{
              position: "absolute",
              top: 300,
              width: "100%",
              textAlign: "center",
              fontSize: 14.5,
              color: SEC,
              fontFamily: INTER,
            }}
          >
            Ready to trade on CRX
          </div>
        </div>
      )}
    </Card>
  );
};

// ─── Scene 9 (f571-665): RFQ — quotes from multiple dealers ───
// Reference beats kept: A skeleton f571 → B rates land f584 (hard) →
// best-rate highlight f594. The card continues the story: USD/BRL,
// $2.5M, Jun 30 2027 — exactly what scene 4 configured.
const DEALERS = [
  { name: "Dealer 1", sub: "Tier-1 bank", rate: "5.4335" },
  { name: "Dealer 2", sub: "Global FX desk", rate: "5.4298" },
  { name: "Dealer 3", sub: "Regional specialist", rate: "5.4319" },
];
const BEST = 1;

export const CrxScene9Dealers: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 571 || frame >= 666) return null;
  const rated = frame >= 584;
  const highlighted = frame >= 594;
  const countdown = rated ? Math.max(120 - Math.floor((frame - 584) / 30), 117) : 120;
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w + 1} h={SLOT.h} opacity={1}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>
            Request for quote
          </span>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: rated ? BRASS : TER,
              backgroundColor: rated ? "rgba(192,138,46,0.12)" : WELL,
              borderRadius: 980,
              padding: "4px 11px",
              ...tnum,
            }}
          >
            {rated ? `Firm · ${countdown}s` : "Quoting…"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {[
            <span key="p" style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <FlagPair a="us" b="br" size={16} />
              <span>USD/BRL</span>
            </span>,
            <span key="n">$2,500,000</span>,
            <span key="d">Jun 30, 2027</span>,
          ].map((chip, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: WELL,
                borderRadius: 980,
                padding: "6px 13px",
                fontSize: 12.5,
                fontWeight: 600,
                color: INK,
                ...tnum,
              }}
            >
              {chip}
            </div>
          ))}
        </div>

        {DEALERS.map((d, i) => {
          const isBest = i === BEST;
          const dim = highlighted && !isBest ? 0.55 : 1;
          const shimmer = 0.5 + 0.16 * Math.sin((frame + i * 9) / 3.2);
          return (
            <div
              key={d.name}
              style={{
                position: "absolute",
                left: 30,
                top: 146 + i * 84,
                width: 651,
                height: 72,
                borderRadius: 14,
                backgroundColor: highlighted && isBest ? TEAL_SOFT : WELL,
                boxShadow: highlighted && isBest ? `inset 0 0 0 2px ${TEAL}` : undefined,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 20px",
                opacity: dim,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    backgroundColor: "#e7e9ee",
                    color: SEC,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  D{i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: TER }}>{d.sub}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                {highlighted && isBest && (
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: "#fff",
                      backgroundColor: TEAL,
                      borderRadius: 980,
                      padding: "4px 11px",
                      ...settle(frame, 594, 10, 0.74),
                    }}
                  >
                    Best rate
                  </div>
                )}
                {rated ? (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.3, ...tnum }}>
                      {d.rate}
                    </div>
                    <div style={{ fontSize: 11.5, color: TER }}>BRL per USD</div>
                  </div>
                ) : (
                  <div
                    style={{
                      width: 86,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: "#e2e4ea",
                      opacity: shimmer,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 30, bottom: 20, fontSize: 12, color: TER }}>
          One request — the whole dealer network answers.
        </div>
      </div>
    </Card>
  );
};

// ─── Scene 10 (f641-722): compliance checklist under "Comply with confidence" ───
// Crossfades over the RFQ card on the reference curve; checks tick in
// across the reference bar-growth window.
const COMPLY_ROWS = [
  { at: 665, k: "KYB", v: "Verified" },
  { at: 679, k: "Sanctions screening", v: "Clear — 0 hits" },
  { at: 693, k: "Travel rule", v: "Enabled" },
  { at: 706, k: "Audit export", v: "CSV · PDF ready" },
];

export const CrxScene10Comply: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 641 || frame >= 723) return null;
  const opacity =
    interpolate(frame, [641, 666], [0, 1], clamp) *
    interpolate(frame, [716, 722], [1, 0], clamp);
  return (
    <Card x={SLOT.left} y={SLOT.top} w={SLOT.w} h={SLOT.h} opacity={opacity}>
      <div style={{ position: "absolute", inset: 0, padding: "26px 30px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Compliance</span>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: SUCCESS,
              backgroundColor: "rgba(14,122,74,0.10)",
              borderRadius: 980,
              padding: "4px 11px",
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: SUCCESS }} />
            All clear
          </div>
        </div>

        {COMPLY_ROWS.map(({ at, k, v }, i) => {
          const on = frame >= at;
          const pop = on ? 1 + 0.18 * Math.pow(0.68, frame - at) : 1;
          const rowOp = fadeIn(frame, at - 4, 4);
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                left: 30,
                top: 92 + i * 74,
                width: 650,
                height: 74,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: `1px solid ${HAIR}`,
                opacity: rowOp,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    backgroundColor: on ? SUCCESS : "#e4e5ea",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${pop.toFixed(3)})`,
                  }}
                >
                  {on && <Check size={14} stroke={16} />}
                </div>
                <span style={{ fontSize: 15.5, fontWeight: 600 }}>{k}</span>
              </div>
              <span style={{ fontSize: 13.5, color: on ? SEC : TER, ...tnum }}>{v}</span>
            </div>
          );
        })}

        <div style={{ position: "absolute", left: 30, bottom: 24, fontSize: 12, color: TER }}>
          Every trade screened on-chain, continuously.
        </div>
      </div>
    </Card>
  );
};

// ─── Scene 12 (f769-848): the app, full width, under "CRX Sandbox is Live." ───
// Amber sandbox banner + nav + portfolio. Bars grow on the reference
// curve; the Portfolio tab pill lands on the reference pill beat.
const S12 = { left: 83, top: 291, w: 1114, h: 429 };
const S12_BARS = { h: [72, 55, 84, 78, 106], months: ["Feb", "Mar", "Apr", "May", "Jun"] };
const S12_TABS = ["Swap", "Transfer", "Portfolio", "Compliance"];

const POSITIONS = [
  { at: 792, a: "us", b: "br", pair: "USD/BRL", side: "Long", notional: "$2.5M", pnl: "+$1,240", health: 0.86 },
  { at: 801, a: "us", b: "mx", pair: "USD/MXN", side: "Short", notional: "$1.0M", pnl: "+$310", health: 0.72 },
];

export const CrxScene12App: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < 769 || frame >= 849) return null;
  const opacity =
    interpolate(frame, [769, 793], [0, 1], clamp) *
    interpolate(frame, [845, 848], [1, 0], clamp);
  if (opacity <= 0) return null;
  const p = interpolate(
    frame,
    [783, 789, 803, 813, 823, 833, 841, 846],
    [0, 0.12, 0.26, 0.46, 0.66, 0.82, 0.96, 1],
    clamp,
  );
  const pillOn = interpolate(frame, [810, 817], [0, 1], clamp);
  return (
    <Card x={S12.left} y={S12.top} w={S12.w} h={S12.h} opacity={opacity} radius={16} bg={BG}>
      {/* sandbox banner */}
      <div
        style={{
          position: "absolute",
          top: 0,
          width: "100%",
          height: 27,
          backgroundColor: AMBER,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11.5,
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
          top: 27,
          width: "100%",
          height: 48,
          backgroundColor: "#fff",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          padding: "0 26px",
        }}
      >
        <CrxMark size={19} />
        <span style={{ fontSize: 15.5, fontWeight: 700, letterSpacing: -0.6, marginLeft: 8 }}>
          CRX
        </span>
        <div style={{ display: "flex", gap: 4, marginLeft: 40 }}>
          {S12_TABS.map((t) => {
            const active = t === "Portfolio";
            return (
              <div
                key={t}
                style={{
                  position: "relative",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? INK : SEC,
                  padding: "6px 13px",
                }}
              >
                {active && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: 9,
                      backgroundColor: "#eef0f3",
                      opacity: pillOn,
                    }}
                  />
                )}
                <span style={{ position: "relative" }}>{t}</span>
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginLeft: "auto",
            backgroundColor: TEAL,
            color: "#fff",
            fontSize: 12.5,
            fontWeight: 600,
            borderRadius: 980,
            padding: "8px 16px",
          }}
        >
          Connect wallet
        </div>
      </div>

      {/* balance card */}
      <div
        style={{
          position: "absolute",
          left: 26,
          top: 99,
          width: 300,
          height: 300,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: "20px 22px",
        }}
      >
        <div style={label}>Total value</div>
        <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: -0.8, marginTop: 5, ...tnum }}>
          $30,440<span style={{ color: TER, fontSize: 18 }}>.00</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: SUCCESS, marginTop: 3, ...tnum }}>
          +$1,550 unrealized
        </div>
        {[
          ["Available", "$12,180.00"],
          ["Margin in use", "$8,260.00"],
          ["Margin ratio", "22%"],
        ].map(([k, v], i) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: 22,
              top: 138 + i * 48,
              width: 256,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${HAIR}`,
            }}
          >
            <span style={{ fontSize: 12.5, color: SEC }}>{k}</span>
            <span style={{ fontSize: 13, fontWeight: 500, ...tnum }}>{v}</span>
          </div>
        ))}
      </div>

      {/* hedged notional chart */}
      <div
        style={{
          position: "absolute",
          left: 342,
          top: 99,
          width: 400,
          height: 300,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: "20px 22px",
        }}
      >
        <div style={label}>Hedged notional</div>
        <div
          style={{ position: "absolute", left: 22, top: 246, width: 356, height: 1, backgroundColor: HAIR }}
        />
        {S12_BARS.h.map((h, i) => {
          const bh = h * p;
          return (
            <React.Fragment key={i}>
              {bh >= 1 && (
                <div
                  style={{
                    position: "absolute",
                    left: 34 + i * 70,
                    top: 246 - bh,
                    width: 36,
                    height: bh,
                    backgroundColor: TEAL,
                    borderRadius: "6px 6px 0 0",
                  }}
                />
              )}
              <div
                style={{
                  position: "absolute",
                  left: 34 + i * 70,
                  top: 254,
                  width: 36,
                  textAlign: "center",
                  fontSize: 10.5,
                  color: TER,
                }}
              >
                {S12_BARS.months[i]}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* positions */}
      <div
        style={{
          position: "absolute",
          left: 758,
          top: 99,
          width: 330,
          height: 300,
          backgroundColor: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: "20px 22px",
        }}
      >
        <div style={label}>Positions</div>
        {POSITIONS.map((pos, i) => {
          const op = fadeIn(frame, pos.at, 4);
          return (
            <div
              key={pos.pair}
              style={{
                position: "absolute",
                left: 22,
                top: 52 + i * 96,
                width: 286,
                height: 96,
                borderBottom: i === 0 ? `1px solid ${HAIR}` : undefined,
                opacity: op,
                paddingTop: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <FlagPair a={pos.a} b={pos.b} size={17} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{pos.pair}</span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: pos.side === "Long" ? SUCCESS : SEC,
                      backgroundColor: pos.side === "Long" ? "rgba(14,122,74,0.10)" : WELL,
                      borderRadius: 980,
                      padding: "2px 8px",
                    }}
                  >
                    {pos.side}
                  </span>
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: SUCCESS, ...tnum }}>
                  {pos.pnl}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 10,
                }}
              >
                <span style={{ fontSize: 12, color: TER, ...tnum }}>{pos.notional} notional</span>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>Healthy</span>
                  <div style={{ width: 56, height: 5, borderRadius: 3, backgroundColor: "#e4e5ea" }}>
                    <div
                      style={{
                        width: 56 * pos.health * Math.min(1, op * 1.2),
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: TEAL,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// Convenience wrapper: all six scenes in reference z-order.
export const CrxAppScenes: React.FC<{ frame: number }> = ({ frame }) => (
  <AbsoluteFill>
    <CrxScene3Dash frame={frame} />
    <CrxScene4Hedge frame={frame} />
    <CrxScene8Onboard frame={frame} />
    <CrxScene9Dealers frame={frame} />
    <CrxScene10Comply frame={frame} />
    <CrxScene12App frame={frame} />
  </AbsoluteFill>
);
