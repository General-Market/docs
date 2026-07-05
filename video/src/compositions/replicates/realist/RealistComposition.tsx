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
import { BLUR_TABLE } from "./ui/copy/outro";

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
  weights: ["700", "800", "900"],
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
// Measured outro blur (BLUR_TABLE, copy/outro.ts): lerp between rows.
const blurPxAt = (f: number): number => {
  if (f <= BLUR_TABLE[0][0]) return 0;
  const last = BLUR_TABLE[BLUR_TABLE.length - 1];
  if (f >= last[0]) return last[1];
  for (let i = 1; i < BLUR_TABLE.length; i++) {
    if (f <= BLUR_TABLE[i][0]) {
      const [f0, b0] = BLUR_TABLE[i - 1];
      const [f1, b1] = BLUR_TABLE[i];
      return b0 + ((b1 - b0) * (f - f0)) / (f1 - f0);
    }
  }
  return last[1];
};

const ScreenBase: React.FC = () => {
  const f = refFrame(useCurrentFrame());
  const blur = blurPxAt(f);
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
  text: string, fontSize: number, weight: "700" | "800" | "900", italic: boolean, tracking: string,
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
  weight?: "700" | "800" | "900";
  font?: string;
  // r4: glyph-shaped blurred underlayer — the baked halo carries ~1.8x
  // the render's ink mass and r3b proved a textShadow alpha boost only
  // LOWERS SSIM; one blurred duplicate of the whole line (same cascade
  // state) under the crisp layer closes the halo without per-letter
  // filter cost.
  bloom?: { blur: number; opacity: number };
}> = ({ text, ink, color, glow, revealAt, exitAt, frame, opacityMul, tracking = "0.01em", weight = "800", font = MONT, bloom }) => {
  const inkW = ink[1] - ink[0];
  const inkH = ink[3] - ink[2];
  const fontSize = inkH / CAP_RATIO;
  const natural = measureW(text, fontSize, weight, false, tracking, font);
  const scaleX = natural > 0 ? inkW / natural : 1;
  const line = (extra: React.CSSProperties) => (
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
        ...extra,
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
  if (!bloom) return line({});
  return (
    <>
      {line({ filter: `blur(${bloom.blur}px)`, opacity: opacityMul * bloom.opacity })}
      {line({})}
    </>
  );
};

// ─── 1. Caption 1: COIN LAUNCHED / PUMPFUN FLYWHEEL / "PUMPWHEEL" ───
// Rides the baked editor zoom + its own grow-in via the measured
// per-frame affine (data.ts, f26-215).
const CAP1_BLOOM = { blur: 30, opacity: 0.4 };

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
        bloom={CAP1_BLOOM}
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
        bloom={CAP1_BLOOM}
      />
      {/* r3b adjudication (A/B stills at f110, ink-crop SSIM + diff
          composites): straight-quote 800/-0.01em fit = 0.598, the
          curly-quote 700/0.02em refit = 0.486, curly 800 = 0.475 —
          the curly glyphs shrink the fitted word and misalign every
          letter stroke, costing more than the quote shape gains. The
          plate DOES show curly quotes (small, 28px, floating y799-822);
          revisit only as separately-positioned glyphs, never inside
          the fitted string. Remaining head residual is glow halo. */}
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
        bloom={CAP1_BLOOM}
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

// ─── Sparkle (flanks every SELLS caption) ───
// r3: the plate glyph (f0899 x~700 y~617 zoomed 3x) is an 8-spoke
// ASTERISK — eight rounded petals around a bright hub with a soft round
// halo — not a 4-point star. Drawn as 4 crossing stadium bars at 45°.
const Sparkle: React.FC<{
  cx: number; cy: number; size: number; seed: number; frame: number; opacity: number;
}> = ({ cx, cy, size, seed, frame, opacity }) => {
  const rot = noise2D(`spark-r-${seed}`, frame * 0.02, seed) * 8;
  const sc = 1 + noise2D(`spark-s-${seed}`, frame * 0.03, seed) * 0.1;
  const r = size / 2;
  const w = size * 0.14; // spoke half-width
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
        filter: "drop-shadow(0 0 8px rgba(255,255,255,0.7)) drop-shadow(0 0 20px rgba(255,255,255,0.4))",
      }}
    >
      <g transform={`translate(${size} ${size})`} fill="#ffffff">
        {[0, 45, 90, 135].map((a) => (
          <rect
            key={a}
            x={-w}
            y={-r}
            width={w * 2}
            height={r * 2}
            rx={w}
            transform={`rotate(${a})`}
          />
        ))}
        <circle r={size * 0.2} />
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
// glow spread re-fitted r2: plate halo ink area ~1.7x the r1 shadows
// (f0486 red n=32k vs attempt 17.5k) — third, wider bloom layer added
// r3 bloom re-fit: saturated-red mask (r>140,g<70) over plates reads
// 30-55k px per caption vs 21-33k in the r2 attempt — the plate halo is
// SATURATED near the glyphs, not translucent. A tight high-alpha layer
// added under the wide ones closes the ink-mass gap.
const RED = "#ee0011";
const RED_GLOW = "0 0 5px rgba(238,0,17,0.95), 0 0 14px rgba(255,0,30,0.75), 0 0 32px rgba(255,0,30,0.4), 0 0 58px rgba(255,0,30,0.2)";
const BLUE = "#41b8e0";
const BLUE_GLOW = "0 0 5px rgba(65,184,224,0.9), 0 0 12px rgba(62,184,255,0.65), 0 0 28px rgba(62,184,255,0.36), 0 0 50px rgba(62,184,255,0.18)";

// A-paren re-measured against baked digit glyphs (event 1 f487, event 2
// f530-550): digit cap band centers on 610 (not 632) at cap height ~49
// (not 44); the baked ink midline is 960 — parenCx offsets the fitted
// line's trailing letter-spacing bias (~7px left at 0.18em tracking).
const STYLE_GEO = {
  A: { cx: 960, inkH: 62, cy: 537, parenCx: 967, parenCy: 610, parenInkH: 49, sparkPad: 35, sparkSize: 44 },
  // B re-measured r4 (core glyph mask r>220,g<60 on plate f1200 vs a
  // render): plate cap band y 503-565 (height ~61, center 534); the old
  // inkH 80 / cy 540 drew the glyphs 30% too tall and 6px low — the
  // width still matched only because scaleX squeezes to mainW.
  B: { cx: 964, inkH: 61, cy: 534, parenCx: 964, parenCy: 0, parenInkH: 0, sparkPad: 35, sparkSize: 38 },
  // F re-measured r4 with CORE masks (red r>220,g<60 / blue b>200,r<130,
  // g>130; plates 1620+1635 vs a render): red glyph band rows 501-567
  // center 534 (render sat at 536), col-span center 960.5 (render 958 —
  // the 0.03em trailing-tracking bias). Blue glyph rows center 609 both
  // plates (r3b's 602 came from the glow-wide mask polluted by a second
  // blue band at y 450-472); blue col-span center 960 stable while the
  // render sat at 953.5 — parenCx carries the 0.18em trailing bias like
  // style A's 967. Plate col spans pulse frame-to-frame, widths kept.
  F: { cx: 962, inkH: 62, cy: 534, parenCx: 966, parenCy: 609, parenInkH: 48, sparkPad: 35, sparkSize: 44 },
} as const;

// r5: glyph-shaped blurred UNDERLAYERS for the SELLS halos — the r4
// caption-1 technique ported. Ink-mass census at 11 settled probes
// (work/r5/glow/notes.md): the plate halo is WIDE and DIM — the red
// mid band (r 70-140) carries 1.9-2.7x the render's mass and lum 60-100
// 1.5-3x, while the render's bright core OVERSHOOTS 2-4x (lum150p).
// textShadow cannot make that shape (r3b: alpha boost 0.584 vs 0.598
// baseline); a blurred duplicate of the fitted line under the crisp
// layer can. It must ride the same wrappers (dy, scaleMul, fadeMain/
// fadeParen) or every push double-ghosts. (blur, opacity) swept per
// style/color on caption-crop SSIM; sweep table in work/r5/glow/notes.md.
type Bloom = { blur: number; opacity: number } | null;
type SellsBloomMap = Record<"A" | "B" | "F", { red: Bloom; blue: Bloom }>;
const SELLS_BLOOM: SellsBloomMap = process.env.REMOTION_GLOW_SWEEP
  ? (JSON.parse(process.env.REMOTION_GLOW_SWEEP) as SellsBloomMap)
  : {
      // red sweep (f480, crop SSIM vs baseline 0.8332): (30,.25) .8355 ·
      // (45,.35) .8368 · (30,.4) .8381 · (20,.5) .8399 · (30,.55) .8405 ·
      // (25,.6) .8412 · (30,.7) .8422 · (30,.85) .8434 but overshoots
      // plate red_sat (31.1k vs 29.0k) and regresses B1045 r2c4 below
      // baseline — (30,.7) is the mass-converged winner (A620 sat 27.3k
      // vs plate 27.6k, mid 15.2k vs 15.3k), all cells >= baseline at
      // A480/620/715, B1045/1180, F1605/1620, guards f900/1268/1513 up.
      A: { red: { blur: 30, opacity: 0.7 }, blue: null },
      B: { red: { blur: 30, opacity: 0.7 }, blue: null },
      F: { red: { blur: 30, opacity: 0.7 }, blue: null },
    };

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
  const bloom = SELLS_BLOOM[ev.style];
  // pop — r3: entrance frames re-anchored 2f earlier (first visible ink
  // on the plates, red-mask sweep of all 33 events); the r2 pop fit was
  // taken at old-f (= t=2 now), so a re-solves to keep s(t=2)=1.33.
  const s = 1 + 0.42 * Math.exp(-t / 8);
  const op = clamp01((t + 0.5) / 2.5);
  const blur = 12 * Math.exp(-t / 3.5);
  // push by successor (measured pushAt)
  let dy = 0;
  let dyParen = 0;
  let parenShrink = 1;
  // r3 fade split: on the plates the paren line outlives the main by
  // ~6f (ev604 pushed: red gone f652, blue gone f659; F event: red gone
  // f1650, blue gone f1657) — main and paren fade on separate clocks.
  let fadeMain = 1;
  let fadeParen = 1;
  if (ev.pushAt !== null && ev.slide) {
    // un-pushed slide-out (ev925): plate red-mask f940-970 shows an
    // S-curve (slow start), NOT the exponential push — dy measured
    // 24/53/83/131/151/168/177px at t=2/4/6/8/10/12/15; both lines
    // fade together f961-967 (blue mass tracks red, no +6f outlive).
    const tp = frame - ev.pushAt;
    if (tp > 0) {
      const SLIDE: [number, number][] = [[0, 0], [2, 24], [4, 53], [6, 83], [8, 131], [10, 151], [12, 168], [15, 177]];
      let d = 177;
      for (let i = 1; i < SLIDE.length; i++) {
        if (tp <= SLIDE[i][0]) {
          const [t0, d0] = SLIDE[i - 1];
          const [t1, d1] = SLIDE[i];
          d = d0 + ((d1 - d0) * (tp - t0)) / (t1 - t0);
          break;
        }
      }
      dy = d;
      dyParen = 0; // paren rides with the main
      parenShrink = 1 - 0.049 * (1 - Math.exp(-tp / 1.8));
      fadeMain = 1 - clamp01((frame - (ev.pushAt + 13)) / 6);
      fadeParen = 1 - clamp01((frame - (ev.pushAt + 14)) / 5);
    }
  } else if (ev.pushAt !== null && ev.style === "A") {
    // r3b: red-mask sweeps of ev848 (f866-882) and ev873 (f896-914) show
    // the A-push BEGINS ~3f before the recorded pushAt (the same
    // detection-lag bias the entrance re-anchor corrected) and follows
    // an S-curve, not the exponential — measured dy from true start:
    // ev848 t1:13 t3:36 t5:129 t9:168 · ev873 t2.5:68 t4.5:104 t10:171.
    // The old exp(τ5.3) from pushAt left the main ~50px high for
    // several frames of every push (double-ghost in the f900 diff).
    const tpe = frame - (ev.pushAt - 3);
    if (tpe > 0) {
      const TAB: [number, number][] = [[0, 0], [1, 10], [2, 30], [3, 60], [4, 95], [5, 125], [6, 145], [8, 165], [10, 173], [12, 177]];
      const S = (tt: number): number => {
        if (tt >= 12) return 177;
        for (let i = 1; i < TAB.length; i++) {
          if (tt <= TAB[i][0]) {
            const [t0, d0] = TAB[i - 1];
            const [t1, d1] = TAB[i];
            return d0 + ((d1 - d0) * (tt - t0)) / (t1 - t0);
          }
        }
        return 177;
      };
      // rest y of the pushed main measured 714-715 across events
      dy = ((715 - geo.cy) / 177) * S(tpe);
      // paren travels 170 total (settled pushed paren cy 780), lagging
      // the main ~1f; the pushed block shrinks to ~0.95
      dyParen = (170 / 177) * S(Math.max(tpe - 1, 0)) - dy;
      parenShrink = 1 - 0.049 * (1 - Math.exp(-tpe / 1.8));
      const fadeFrom = ev.pushAt + 9;
      fadeMain = 1 - clamp01((frame - fadeFrom) / 14);
      // r3b: +6/dur was measured on ev604, but ev902's ghost paren is
      // gone by ~f948 on the plates (blue-mass residual < 0.3k) while
      // +6/14 kept it visible at f950 — tightened to +5/12.
      fadeParen = 1 - clamp01((frame - fadeFrom - 5) / 12);
    }
  } else if (ev.pushAt !== null && ev.pushDy && ev.pushStart !== undefined) {
    // B-style push — r4: measured per-event dy tables (red-mask blob
    // tracking of all 12 pushed B events, bpush_track.py). True motion
    // start runs 2-9f before the recorded pushAt, and the curve is
    // two-phase: a slow creep (2-13f, length varies per event) then a
    // ~4f fast transit into a shared soft landing (...129, 140.5,
    // 149.5, 156, 161, 165.5, 170, 173, 175, 176.5, 178, ~180). The
    // old exp(τ2.2) from pushAt was never measured — it overshot every
    // mid-push frame (92px low at plate 1335, ev1301's 13f creep).
    // Fade: red-mass decay begins at the frame dy crosses ~176.5
    // (exact ±1f on all 12 events), mass 1.0→0.28 over 9f → linear 13f.
    const tp = frame - ev.pushStart;
    if (tp > 0) {
      const tab = ev.pushDy;
      dy = tab[Math.min(tp, tab.length - 1)];
      let settleIdx = tab.findIndex((v) => v >= 176.5);
      if (settleIdx < 0) settleIdx = tab.length - 1;
      fadeMain = 1 - clamp01((frame - (ev.pushStart + settleIdx)) / 13);
      fadeParen = fadeMain;
    }
  } else if (ev.pushAt !== null) {
    // fallback for a pushed event without a measured table (none today)
    const tp = frame - ev.pushAt;
    if (tp > 0) {
      dy = (715 - geo.cy) * (1 - Math.exp(-tp / 2.2));
      const fadeFrom = ev.pushAt + 5;
      fadeMain = 1 - clamp01((frame - fadeFrom) / 18);
      fadeParen = fadeMain;
    }
  } else if (ev.fadeAt !== null) {
    // solo decay measured 8-13f on the plates (ev634/ev1514/ev1553/ev1595)
    fadeMain = 1 - clamp01((frame - ev.fadeAt) / 12);
    fadeParen =
      ev.style === "F"
        ? 1 - clamp01((frame - ev.fadeAt - 9) / 10) // blue plateau till fadeAt+9, gone +19 (f1650-1658)
        : 1 - clamp01((frame - ev.fadeAt - 6) / 12);
  }
  if (op <= 0 || (fadeMain <= 0 && fadeParen <= 0)) return null;

  const sparkGap = ev.mainW / 2 + geo.sparkPad;
  // F paren materialises late: blue-mask ramp on plates f1595-1604 is
  // flat until t≈5, saturating t≈7-9 (not the regular t=2 entry).
  const parenT0 = ev.style === "F" ? 5 : 2;
  const parenOp =
    ev.style === "F" ? clamp01((t - 5) / 4) : clamp01((t - 1.5) / 5);

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
        // r3: the plate white line is soft and half-transparent for its
        // whole life (saturated-white mask peaks 1.4k px vs 12k when
        // drawn crisp) — standing 2.5px blur at 0.55 opacity.
        // r3b geometry re-measured (white-mask f1610/f1620): ink band
        // y 498-535 → cy 517 (was 472, 45px high), x 612-1307 → ~660
        // wide net of glow bleed (was 436), band height ~37.
        <div style={{ position: "absolute", inset: 0, opacity: 0.55 * fadeMain, filter: "blur(2.5px)" }}>
          <FittedLine
            text="($40969)"
            cx={geo.cx} cy={517} inkW={660} inkH={38}
            color="#d8dde6"
            glow="0 0 8px rgba(215,222,232,0.5), 0 0 20px rgba(215,222,232,0.3)"
            tracking="0.1em"
            scaleMul={s}
          />
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, opacity: fadeMain }}>
        {bloom.red && (
          <div style={{ position: "absolute", inset: 0, opacity: bloom.red.opacity, filter: `blur(${bloom.red.blur}px)` }}>
            <FittedLine
              text={ev.main}
              cx={geo.cx} cy={geo.cy} inkW={ev.mainW} inkH={geo.inkH}
              color={RED} glow={RED_GLOW} tracking="0.03em"
              scaleMul={s}
            />
          </div>
        )}
        <FittedLine
          text={ev.main}
          cx={geo.cx} cy={geo.cy} inkW={ev.mainW} inkH={geo.inkH}
          color={RED} glow={RED_GLOW} tracking="0.03em"
          scaleMul={s}
        />
        <Sparkle cx={geo.cx - sparkGap} cy={geo.cy} size={geo.sparkSize} seed={ev.f} frame={frame} opacity={op * fadeMain} />
        <Sparkle cx={geo.cx + sparkGap} cy={geo.cy} size={geo.sparkSize} seed={ev.f + 1} frame={frame} opacity={op * fadeMain} />
      </div>
      {ev.paren && ev.parenW && t >= parenT0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: parenOp * fadeParen,
            transform: `translateY(${dyParen.toFixed(1)}px)`,
          }}
        >
          {/* paren line materialises already ~2.1x and shrinks in:
              plate f0502-0510 widths 830/722/648/550 → s = 1 + 1.45·e^(−t/7) */}
          {bloom.blue && (
            <div style={{ position: "absolute", inset: 0, opacity: bloom.blue.opacity, filter: `blur(${bloom.blue.blur}px)` }}>
              <FittedLine
                text={ev.paren}
                cx={geo.parenCx} cy={geo.parenCy} inkW={ev.parenW} inkH={geo.parenInkH}
                color={BLUE} glow={BLUE_GLOW} tracking="0.18em"
                scaleMul={(1 + 1.45 * Math.exp(-t / 7)) * parenShrink}
                compactParens={ev.style === "F"}
              />
            </div>
          )}
          <FittedLine
            text={ev.paren}
            cx={geo.parenCx} cy={geo.parenCy} inkW={ev.parenW} inkH={geo.parenInkH}
            color={BLUE} glow={BLUE_GLOW} tracking="0.18em"
            scaleMul={(1 + 1.45 * Math.exp(-t / 7)) * parenShrink}
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
    const end = ev.pushAt !== null ? ev.pushAt + 33 : ev.fadeAt !== null ? ev.fadeAt + 20 : ev.f + 80;
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
