import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { measureText } from "@remotion/layout-utils";
import { noise2D } from "@remotion/noise";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import {
  CAP1_AFF_F0, cap1S, cap1Tx, cap1Ty,
  CAP1_L1_INK, CAP1_L2_INK, CAP1_L3_INK,
  BUYS_PAREN_INK,
  OUTRO_TEXT_INK,
  OUTRO_CX_F0, outroCx, outroCy,
  FADE_IN_F0, fadeIn, FADE_OUT_F0, fadeOut,
  sellsEvents, SellsEvent,
} from "./data";
import { TrenchesScreen } from "./ui/TrenchesScreen";
import { TokenLoadScreen } from "./ui/TokenLoadScreen";
import { PulseScreen } from "./ui/PulseScreen";
import { TokenPage } from "./ui/TokenPage";
import { PnlCard } from "./ui/OutroOverlay";
import { BLUR_FROM, BLUR_FULL, BLUR_PX } from "./ui/copy/outro";

export const FPS = 60;
export const DURATION = 2116; // 35.27s — matches reference realist-original.mp4 (59.94fps/2114f)

const { fontFamily: MONT } = loadMontserrat("normal", {
  subsets: ["latin"],
  weights: ["800", "900"],
});
loadMontserrat("italic", { subsets: ["latin"], weights: ["900"] });
// The baked caption-1 quote line is NOT Montserrat: its glyph inks
// (narrow E/L, wide U/H/M, small high quotes) match Poppins.
const { fontFamily: POPPINS } = loadPoppins("normal", {
  subsets: ["latin"],
  weights: ["800", "900"],
});

// ═══════════════════════════════════════════════════════════════
// Base layer: full DOM rebuild of the Axiom Pro trading UI — four
// screens switched on measured frame boundaries (plates in
// public/realist-assets/footage stay on disk as the measurement
// reference only; nothing mounts them). Every visible string lives
// in ui/copy/*; time-varying values in ui/timeline-token.ts.
// The overlay layer draws every caption with per-frame measured
// curves on top (all numbers from data.ts).
// ═══════════════════════════════════════════════════════════════

const LAST_PLATE = 2112;

// ─── Reference clock ───
// The reference runs 59.94fps (60000/1001, 2114 frames); the comp runs
// 60fps over 2116. Every measured boundary/curve/table is indexed in
// PLATE frames (= reference frames, confirmed plate n ≡ ref frame n).
// Both the verify keyframe extraction (first pts ≥ t) and the ffmpeg
// framesync pairing behind video-SSIM show plate ceil(f·1000/1001) at
// comp frame f — so every plate-indexed clock samples there. Drift is
// 0 until f=1001, 1 frame to f=2002, 2 frames after.
const refFrame = (f: number) =>
  Math.min(Math.max(Math.ceil((f * 1000) / 1001), 0), LAST_PLATE);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInCubic = (t: number) => t ** 3;

const at = (arr: number[], f0: number, f: number) => {
  const i = Math.min(Math.max(f - f0, 0), arr.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, arr.length - 1);
  return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
};
const at2 = (arr: number[], f0: number, f: number) => {
  const i = Math.min(Math.max((f - f0) / 2, 0), arr.length - 1);
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, arr.length - 1);
  return arr[lo] + (arr[hi] - arr[lo]) * (i - lo);
};

// global baked luminance fade (in f0-48, out f2032-2112)
const fadeMul = (f: number): number => {
  if (f < 48) return at2(fadeIn, FADE_IN_F0, f);
  if (f >= FADE_OUT_F0) return at2(fadeOut, FADE_OUT_F0, f);
  return 1;
};

// Screen boundaries measured off the plates: Trenches 0–332, token page
// loading (old chrome) 333–391, Pulse 392–417, live token page 418–end.
const ScreenBase: React.FC = () => {
  const f = refFrame(useCurrentFrame());
  const blurP = clamp01((f - BLUR_FROM) / (BLUR_FULL - BLUR_FROM));
  const blur = BLUR_PX * blurP;
  let screen: React.ReactNode;
  if (f <= 332) screen = <TrenchesScreen frame={f} />;
  else if (f <= 391) screen = <TokenLoadScreen frame={f} />;
  else if (f <= 417) screen = <PulseScreen frame={f} />;
  else screen = <TokenPage frame={f} />;
  return (
    <AbsoluteFill
      style={{
        opacity: fadeMul(f),
        filter: blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {screen}
    </AbsoluteFill>
  );
};

// PnL share-card flies in above the blurred UI during the outro.
const OutroCard: React.FC = () => {
  const f = refFrame(useCurrentFrame());
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fadeMul(f) }}>
      <PnlCard frame={f} />
    </div>
  );
};

// ─── Fitted text primitive: measured ink box + measureText → scaleX ───
const CAP_RATIO = 0.72; // Montserrat cap-height / fontSize
const CAP_TOP = 0.21; //  em-box top → cap top (calibrated vs plates)

const measureW = (
  text: string, fontSize: number, weight: "800" | "900", italic: boolean, tracking: string,
  font: string = MONT,
) =>
  measureText({
    text, fontFamily: font, fontSize, fontWeight: weight, letterSpacing: tracking,
    additionalStyles: italic ? { fontStyle: "italic" } : undefined,
  }).width;

// ─── Caption 1: per-letter cascade line ───
// Letters land left→right: enter from down-right at ~2.1x scale,
// opacity over 3f, settle 6f ease-out; stagger 0.8f (measured f26-44).
// Exit: per-letter left-first slide + blur + fade (measured f160-206).
const CascadeLine: React.FC<{
  text: string;
  ink: number[]; // [x0,x1,y0,y1] nominal
  color: string;
  glow: string;
  revealAt: number;
  exitAt: number;
  frame: number;
  opacityMul: number;
  tracking?: string;
  weight?: "800" | "900";
  font?: string;
}> = ({ text, ink, color, glow, revealAt, exitAt, frame, opacityMul, tracking = "0.01em", weight = "800", font = MONT }) => {
  const inkW = ink[1] - ink[0];
  const inkH = ink[3] - ink[2];
  const fontSize = inkH / CAP_RATIO;
  const natural = measureW(text, fontSize, weight, false, tracking, font);
  const scaleX = natural > 0 ? inkW / natural : 1;
  return (
    <div
      style={{
        position: "absolute",
        left: ink[0],
        top: ink[2] - CAP_TOP * fontSize,
        whiteSpace: "nowrap",
        fontFamily: font,
        fontWeight: Number(weight),
        fontSize,
        letterSpacing: tracking,
        lineHeight: 1,
        color,
        opacity: opacityMul,
        transform: `scaleX(${scaleX.toFixed(4)})`,
        transformOrigin: "left",
        textShadow: `0 0 9px ${glow}, 0 0 22px ${glow}`,
      }}
    >
      {text.split("").map((ch, i) => {
        // entrance
        const p = clamp01((frame - revealAt - i * 0.8) / 6);
        // exit — leading letters leave first
        const q = clamp01((frame - exitAt - i * 0.9) / 7);
        if (p <= 0 || q >= 1) {
          return (
            <span key={i} style={{ display: "inline-block", opacity: 0 }}>
              {ch === " " ? " " : ch}
            </span>
          );
        }
        const e = easeOutCubic(p);
        const s = 1 + 1.1 * (1 - e);
        const dx = 46 * (1 - e) - 65 * q * q;
        const dy = 64 * (1 - e);
        const blur = q > 0 ? 9 * q : 0;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: clamp01(p * 2) * (1 - clamp01((q - 0.15) / 0.6)),
              transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${s.toFixed(3)})`,
              transformOrigin: "left bottom",
              filter: blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : undefined,
            }}
          >
            {ch === " " ? " " : ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── 1. Caption 1: COIN LAUNCHED / PUMPFUN FLYWHEEL / "PUMPWHEEL" ───
// Rides the baked editor zoom + its own grow-in via the measured
// per-frame affine (data.ts, f26-215).
const Cap1: React.FC = () => {
  const frame = refFrame(useCurrentFrame());
  if (frame < 25 || frame > 212) return null;
  const s = at(cap1S, CAP1_AFF_F0, frame);
  const tx = at(cap1Tx, CAP1_AFF_F0, frame);
  const ty = at(cap1Ty, CAP1_AFF_F0, frame);
  const mul = fadeMul(frame);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(4)})`,
        transformOrigin: "0 0",
      }}
    >
      <CascadeLine
        text="COIN LAUNCHED"
        ink={CAP1_L1_INK}
        color="#ffffff"
        glow="rgba(255,255,255,0.25)"
        revealAt={24}
        exitAt={163}
        frame={frame}
        opacityMul={mul}
      />
      <CascadeLine
        text="PUMPFUN FLYWHEEL"
        ink={CAP1_L2_INK}
        color="#ffffff"
        glow="rgba(255,255,255,0.25)"
        revealAt={28}
        exitAt={173}
        frame={frame}
        opacityMul={mul}
      />
      <CascadeLine
        text={'"PUMPWHEEL"'}
        ink={CAP1_L3_INK}
        tracking="-0.01em"
        weight="800"
        font={POPPINS}
        color="#66ffda"
        glow="rgba(80,255,200,0.3)"
        revealAt={49}
        exitAt={183}
        frame={frame}
        opacityMul={mul}
      />
    </AbsoluteFill>
  );
};

// ─── 2. BUYS 10 SOL / (6K MC) ───
// Pop 1.35x → 1, exp settle τ=8f; entrance blur 8·e^(−t/3.5);
// whole line green until f321, then "10" + asterisks flip white;
// exit f363: shrink-to-center + fade over 13f (all measured).
const BUYS_LINE = "*BUYS 10 SOL*";
const BUYS_FULL_INK = { x0: 616, x1: 1313, y0: 499, y1: 577 };

const Buys: React.FC = () => {
  const frame = refFrame(useCurrentFrame());
  if (frame < 315 || frame > 380) return null;
  const t = frame - 315;
  const s = 1 + 0.35 * Math.exp(-t / 8);
  const op = clamp01((t + 1) / 4);
  const blur = 8 * Math.exp(-t / 3.5);
  const bloom = 1 + 1.2 * Math.exp(-t / 9);
  const q = clamp01((frame - 363) / 13);
  const exitScale = 1 - 0.45 * easeInCubic(q);
  const exitOp = 1 - q;
  if (exitOp <= 0) return null;

  const inkW = BUYS_FULL_INK.x1 - BUYS_FULL_INK.x0;
  const inkH = BUYS_FULL_INK.y1 - BUYS_FULL_INK.y0;
  const fontSize = inkH / CAP_RATIO;
  const natural = measureW(BUYS_LINE, fontSize, "900", false, "0.02em");
  const scaleX = natural > 0 ? inkW / natural : 1;
  const cx = (BUYS_FULL_INK.x0 + BUYS_FULL_INK.x1) / 2;
  const cy = (BUYS_FULL_INK.y0 + BUYS_FULL_INK.y1) / 2;

  const green = "#1cff30";
  const mixed = frame >= 321;
  const gGlow = `0 0 ${(10 * bloom).toFixed(0)}px rgba(40,255,60,0.55), 0 0 ${(26 * bloom).toFixed(0)}px rgba(40,255,60,0.3)`;
  const wGlow = `0 0 ${(10 * bloom).toFixed(0)}px rgba(255,255,255,0.55), 0 0 ${(24 * bloom).toFixed(0)}px rgba(255,255,255,0.3)`;

  // paren
  const pInkW = BUYS_PAREN_INK[1] - BUYS_PAREN_INK[0] - 12;
  const pInkH = 46; // digit cap band inside the paren box
  const pFont = pInkH / CAP_RATIO;
  const pNatural = measureW("(6K MC)", pFont, "900", false, "0.18em");
  const pScaleX = pNatural > 0 ? pInkW / pNatural : 1;
  const pCx = (BUYS_PAREN_INK[0] + BUYS_PAREN_INK[1]) / 2;
  const pCy = (BUYS_PAREN_INK[2] + BUYS_PAREN_INK[3]) / 2;
  const parenOp = clamp01((frame - 318) / 6);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: op * exitOp,
        filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: cx,
          top: cy,
          transform: `translate(-50%, -50%) scale(${(s * exitScale * scaleX).toFixed(4)}, ${(s * exitScale).toFixed(4)})`,
          fontFamily: MONT,
          fontWeight: 900,
          fontSize,
          letterSpacing: "0.02em",
          lineHeight: CAP_RATIO, // box = cap band so centering matches ink
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: mixed ? "#ffffff" : green, textShadow: mixed ? wGlow : gGlow }}>*</span>
        <span style={{ color: green, textShadow: gGlow }}>BUYS </span>
        <span style={{ color: mixed ? "#ffffff" : green, textShadow: mixed ? wGlow : gGlow }}>10</span>
        <span style={{ color: green, textShadow: gGlow }}> SOL</span>
        <span style={{ color: mixed ? "#ffffff" : green, textShadow: mixed ? wGlow : gGlow }}>*</span>
      </div>
      <div
        style={{
          position: "absolute",
          left: pCx,
          top: pCy,
          transform: `translate(-50%, -50%) scale(${(s * exitScale * pScaleX).toFixed(4)}, ${(s * exitScale).toFixed(4)})`,
          fontFamily: MONT,
          fontWeight: 900,
          fontSize: pFont,
          letterSpacing: "0.18em",
          lineHeight: CAP_RATIO,
          whiteSpace: "nowrap",
          color: "#2dd5e5",
          opacity: parenOp,
          textShadow: `0 0 ${(9 * bloom).toFixed(0)}px rgba(60,220,255,0.55), 0 0 ${(22 * bloom).toFixed(0)}px rgba(60,220,255,0.3)`,
        }}
      >
        (6K MC)
      </div>
    </div>
  );
};

// ─── 4-point sparkle star (flanks every SELLS caption) ───
const Sparkle: React.FC<{
  cx: number; cy: number; size: number; seed: number; frame: number; opacity: number;
}> = ({ cx, cy, size, seed, frame, opacity }) => {
  const rot = noise2D(`spark-r-${seed}`, frame * 0.02, seed) * 8;
  const sc = 1 + noise2D(`spark-s-${seed}`, frame * 0.03, seed) * 0.1;
  const r = size / 2;
  const w = size * 0.13;
  const path = `M 0 ${-r} C ${w} ${-w} ${w} ${-w} ${r} 0 C ${w} ${w} ${w} ${w} 0 ${r} C ${-w} ${w} ${-w} ${w} ${-r} 0 C ${-w} ${-w} ${-w} ${-w} 0 ${-r} Z`;
  return (
    <svg
      width={size * 2}
      height={size * 2}
      style={{
        position: "absolute",
        left: cx - size,
        top: cy - size,
        opacity,
        transform: `rotate(${rot.toFixed(1)}deg) scale(${sc.toFixed(3)})`,
        filter: "drop-shadow(0 0 7px rgba(255,255,255,0.6)) drop-shadow(0 0 16px rgba(255,255,255,0.35))",
      }}
    >
      <g transform={`translate(${size} ${size})`}>
        <path d={path} fill="#ffffff" />
      </g>
    </svg>
  );
};

// ─── 3. SELLS caption engine (33 measured events) ───
// Entrance: scale 1+0.31·e^(−t/5.8) about center, opacity ~2f,
// blur 7·e^(−t/3.5) (fitted on event 1, f470-492).
// Push-down: rest cy → ~712, p = 1−e^(−t/τ), τ=5.3 (A) / 2.2 (B),
// from the measured per-event pushAt; pushed caption fades
// pushAt+9..+21 (A) / +5..+19 (B). Solo fade: 16f from fadeAt.
const RED = "#ee0011";
const RED_GLOW = "0 0 10px rgba(255,0,30,0.55), 0 0 26px rgba(255,0,30,0.32)";
const BLUE = "#41b8e0";
const BLUE_GLOW = "0 0 8px rgba(62,184,255,0.55), 0 0 22px rgba(62,184,255,0.3)";

// A-paren re-measured against baked digit glyphs (event 1 f487, event 2
// f530-550): digit cap band centers on 610 (not 632) at cap height ~49
// (not 44); the baked ink midline is 960 — parenCx offsets the fitted
// line's trailing letter-spacing bias (~7px left at 0.18em tracking).
const STYLE_GEO = {
  A: { cx: 960, inkH: 62, cy: 537, parenCx: 967, parenCy: 610, parenInkH: 49, sparkPad: 35, sparkSize: 44 },
  B: { cx: 964, inkH: 80, cy: 540, parenCx: 964, parenCy: 0, parenInkH: 0, sparkPad: 35, sparkSize: 38 },
  F: { cx: 960, inkH: 62, cy: 533, parenCx: 960, parenCy: 630, parenInkH: 48, sparkPad: 35, sparkSize: 44 },
} as const;

const FittedLine: React.FC<{
  text: string; cx: number; cy: number; inkW: number; inkH: number;
  color: string; glow: string; tracking: string;
  scaleMul: number;
  compactParens?: boolean;
}> = ({ text, cx, cy, inkW, inkH, color, glow, tracking, scaleMul, compactParens }) => {
  const fontSize = inkH / CAP_RATIO;
  const natural = measureW(text, fontSize, "900", false, tracking);
  const scaleX = natural > 0 ? inkW / natural : 1;
  const body = compactParens
    ? text.split("").map((ch, i) =>
        ch === "(" || ch === ")" ? (
          <span key={i} style={{ display: "inline-block", transform: "scaleY(0.64) translateY(-5%)" }}>{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )
    : text;
  return (
    <div
      style={{
        position: "absolute",
        left: cx,
        top: cy,
        transform: `translate(-50%, -50%) scale(${(scaleMul * scaleX).toFixed(4)}, ${scaleMul.toFixed(4)})`,
        fontFamily: MONT,
        fontWeight: 900,
        fontSize,
        letterSpacing: tracking,
        lineHeight: CAP_RATIO,
        whiteSpace: "nowrap",
        color,
        textShadow: glow,
      }}
    >
      {body}
    </div>
  );
};

const SellsCaption: React.FC<{ ev: SellsEvent; frame: number }> = ({ ev, frame }) => {
  const t = frame - ev.f;
  if (t < 0) return null;
  const geo = STYLE_GEO[ev.style];
  // pop
  const s = 1 + 0.31 * Math.exp(-t / 5.8);
  let op = clamp01((t + 1.5) / 2);
  const blur = 7 * Math.exp(-t / 3.5);
  // push by successor (measured pushAt)
  let dy = 0;
  let dyParen = 0;
  let parenShrink = 1;
  if (ev.pushAt !== null) {
    const tau = ev.style === "A" ? 5.3 : 2.2;
    const tp = frame - ev.pushAt;
    if (tp > 0) {
      dy = (712 - geo.cy) * (1 - Math.exp(-tp / tau));
      // the baked paren line travels farther and slightly slower than
      // the main (measured on event 1, f495-512: D=179, τ=5.55), and
      // the pushed block collapses its pop and shrinks to ~0.95
      dyParen = 179 * (1 - Math.exp(-tp / 5.55)) - dy;
      parenShrink = 1 - 0.049 * (1 - Math.exp(-tp / 1.8));
      const fadeFrom = ev.pushAt + (ev.style === "A" ? 9 : 5);
      op *= 1 - clamp01((frame - fadeFrom) / (ev.style === "A" ? 12 : 14));
    }
  } else if (ev.fadeAt !== null) {
    op *= 1 - clamp01((frame - ev.fadeAt) / 16);
  }
  if (op <= 0) return null;

  const sparkGap = ev.mainW / 2 + geo.sparkPad;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: op,
        transform: `translateY(${dy.toFixed(1)}px)`,
        filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {ev.style === "F" && (
        <FittedLine
          text="($40969)"
          cx={geo.cx} cy={472} inkW={436} inkH={44}
          color="#d8dde6"
          glow="0 0 8px rgba(215,222,232,0.5), 0 0 20px rgba(215,222,232,0.3)"
          tracking="0.1em"
          scaleMul={s}
        />
      )}
      <FittedLine
        text={ev.main}
        cx={geo.cx} cy={geo.cy} inkW={ev.mainW} inkH={geo.inkH}
        color={RED} glow={RED_GLOW} tracking="0.03em"
        scaleMul={s}
      />
      <Sparkle cx={geo.cx - sparkGap} cy={geo.cy} size={geo.sparkSize} seed={ev.f} frame={frame} opacity={op} />
      <Sparkle cx={geo.cx + sparkGap} cy={geo.cy} size={geo.sparkSize} seed={ev.f + 1} frame={frame} opacity={op} />
      {ev.paren && ev.parenW && t >= 2 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: clamp01((t - 2) / 3),
            transform: `translateY(${dyParen.toFixed(1)}px)`,
          }}
        >
          {/* paren line lands ~3f after the main and pops harder:
              s = 1 + 0.6·e^(−(t−3)/8) (measured on event 2) */}
          <FittedLine
            text={ev.paren}
            cx={geo.parenCx} cy={geo.parenCy} inkW={ev.parenW} inkH={geo.parenInkH}
            color={BLUE} glow={BLUE_GLOW} tracking="0.18em"
            scaleMul={(1 + 0.6 * Math.exp(-Math.max(t - 3, 0) / 8)) * parenShrink}
            compactParens={ev.style === "F"}
          />
        </div>
      )}
    </div>
  );
};

const Sells: React.FC = () => {
  const frame = refFrame(useCurrentFrame());
  if (frame < 466 || frame > 1668) return null;
  const active: React.ReactNode[] = [];
  for (const ev of sellsEvents) {
    const end = ev.pushAt !== null ? ev.pushAt + 26 : ev.fadeAt !== null ? ev.fadeAt + 18 : ev.f + 80;
    if (frame >= ev.f && frame <= end) {
      active.push(<SellsCaption key={ev.f} ev={ev} frame={frame} />);
    }
  }
  return <AbsoluteFill>{active}</AbsoluteFill>;
};

// ─── 5. Outro: X logo + RREALIST typewriter (f1826-2106) ───
// Logo drops in from ~85px above along the measured track (data.ts),
// letters rise from ~42px below, landing every ~3.5f (measured);
// the whole lockup rides the global fade-out.
const LETTER_LAND = [1838, 1841, 1844, 1847, 1850, 1853, 1856, 1860];
const OUTRO_TEXT = "RREALIST";

// X logomark (two notched crossing strokes)
const XMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
    <path
      d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z"
      fill="#ffffff"
    />
  </svg>
);

const Outro: React.FC = () => {
  const frame = refFrame(useCurrentFrame());
  if (frame < 1828 || frame > 2106) return null;
  const mul = fadeMul(frame);
  const logoCx = (frame <= 1884 ? at(outroCx, OUTRO_CX_F0, frame) : 687) - 2.5;
  const logoCy = (frame <= 1884 ? at(outroCy, OUTRO_CX_F0, frame) : 540) + 12;
  const logoIn = clamp01((frame - 1828) / 6);
  const logoScale = 0.4 + 0.6 * easeOutCubic(logoIn);
  const R = 52;

  const inkW = OUTRO_TEXT_INK[1] - OUTRO_TEXT_INK[0];
  const inkH = 64;
  const fontSize = inkH / CAP_RATIO;
  const natural = measureW(OUTRO_TEXT, fontSize, "800", false, "0.01em");
  const scaleX = natural > 0 ? inkW / natural : 1;
  const textLeft = logoCx + (OUTRO_TEXT_INK[0] - 684.5); // measured gap logo-center → text x0
  const textTop = 552 - inkH / 2 - CAP_TOP * fontSize;

  const coral = "#f15669";
  const glow = "0 0 7px rgba(250,80,110,0.5), 0 0 18px rgba(250,80,110,0.3)";
  return (
    <div style={{ position: "absolute", inset: 0, opacity: mul }}>
      <div
        style={{
          position: "absolute",
          left: logoCx - R,
          top: logoCy - R,
          width: R * 2,
          height: R * 2,
          borderRadius: "50%",
          background: "#f25a6c",
          opacity: logoIn,
          transform: `scale(${logoScale.toFixed(3)})`,
          boxShadow: "0 0 9px rgba(250,80,110,0.5), 0 0 22px rgba(250,80,110,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <XMark size={60} />
      </div>
      <div
        style={{
          position: "absolute",
          left: textLeft,
          top: textTop,
          fontFamily: MONT,
          fontWeight: 800,
          fontSize,
          letterSpacing: "0.01em",
          lineHeight: 1,
          whiteSpace: "nowrap",
          transform: `scaleX(${scaleX.toFixed(4)})`,
          transformOrigin: "left",
          color: coral,
          textShadow: glow,
        }}
      >
        {OUTRO_TEXT.split("").map((ch, i) => {
          const p = clamp01((frame - LETTER_LAND[i]) / 8);
          if (p <= 0) return <span key={i} style={{ display: "inline-block", opacity: 0 }}>{ch}</span>;
          const e = easeOutCubic(p);
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: clamp01(p * 2),
                transform: `translateY(${(42 * (1 - e)).toFixed(1)}px) scale(${(1.15 - 0.15 * e).toFixed(3)})`,
                transformOrigin: "left bottom",
              }}
            >
              {ch}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ─── Master ───
export const RealistComposition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      <ScreenBase />
      <OutroCard />
      <Cap1 />
      <Buys />
      <Sells />
      <Outro />
    </AbsoluteFill>
  );
};

export const realistReplicateMeta = {
  id: "Realist-Replicate",
  component: RealistComposition,
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: DURATION,
};
