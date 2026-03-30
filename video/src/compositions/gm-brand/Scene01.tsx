/**
 * Scene 01 — General Market brand kinetic text intro
 *
 * TIMING FIX — shifted all phases ~15 frames later to match reference.
 *
 * Timeline (corrected, from reference at 0.5s intervals, 30fps):
 *   0.0s (f0):    "You've" — visible immediately, opacity 1
 *   0.3s (f8):    "been" starts fading in, "trading" scatter begins
 *   2.4s (f72):   "You've been trading on" fully settled
 *   2.4s (f72):   "GM" — big gradient text (green→dark green)
 *   3.67s (f110): "Build" typewriter (no "to" prefix)
 *   5.0s (f150):  "Build portfolios" — gradient rectangle pill
 *   6.17s (f185): Letter scatter → reassemble (Y→pause→X→pause→Y → "Predict markets")
 *   8.17s (f245): "Capture alpha" — floating word field
 *   9.5s  (f285): End
 *
 * 1280x720, 30fps, 285 frames (~9.5s)
 */
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
  useVideoConfig,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { gsap } from "gsap";
import { GM } from "./theme";

const fontFamily = GM.fontSans;

const FPS = 30;
const W = 1280;
const H = 720;

// Canvas is 1280x720 but reference is 960x540. Scale factor:
const SCALE = 720 / 540; // 1.333

// --- Palette (General Market brand kit) ------------------------------------
const BG_BASE = GM.greenLight;
const TEXT_DARK = GM.textPrimary;

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// Seeded pseudo-random for deterministic scatter positions
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ===========================================================================
// GSAP Proxy Engine
// ===========================================================================
type ProxyState = Record<string, number>;

function useGsapProxy(
  buildTimeline: (
    tl: gsap.core.Timeline,
    proxies: Record<string, ProxyState>,
  ) => void,
  proxyKeys: Record<string, ProxyState>,
): Record<string, ProxyState> {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const { tl, proxies } = useMemo(() => {
    const p: Record<string, ProxyState> = {};
    for (const [k, v] of Object.entries(proxyKeys)) {
      p[k] = { ...v };
    }
    const timeline = gsap.timeline({ paused: true });
    buildTimeline(timeline, p);
    return { tl: timeline, proxies: p };
  }, []);

  tl.seek(frame / fps);

  const snapshot: Record<string, ProxyState> = {};
  for (const [k, v] of Object.entries(proxies)) {
    snapshot[k] = { ...v };
  }
  return snapshot;
}

// --- Background (soft green/white washes) -----------------------------------
// GM brand: light green wash center-left, subtle mint wash right side,
// nearly white overall. Drifts very slowly.
const PastelBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 285], [0, 14], clamp);

  const x1 = 30 + noise2D("bg1x", frame * 0.004, 0) * 10;
  const y1 = 45 + noise2D("bg1y", 0, frame * 0.003) * 8;
  const x2 = 82 + noise2D("bg2x", frame * 0.003, 1.5) * 8;
  const y2 = 28 + noise2D("bg2y", 1.5, frame * 0.004) * 6;
  const x3 = 68 + noise2D("bg3x", frame * 0.003, 3.0) * 6;
  const y3 = 22 + noise2D("bg3y", 3.0, frame * 0.002) * 5;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 120% 100% at ${x1}% ${y1}%, hsla(${152 + hueShift}, 40%, 90%, 0.85), transparent 65%),
          radial-gradient(ellipse 70% 80% at ${x2}% ${y2}%, hsla(${145 + hueShift}, 35%, 93%, 0.6), transparent 60%),
          radial-gradient(ellipse 60% 50% at ${x3}% ${y3}%, hsla(${160 + hueShift}, 25%, 95%, 0.45), transparent 55%),
          linear-gradient(135deg, ${GM.greenLight} 0%, #FAFAFA 45%, ${GM.greenMint} 100%)
        `,
      }}
    />
  );
};

// ===========================================================================
// Phase 1: "You've"  (frames 0-25)
// FIXED: visible at opacity 1 from frame 0. Font 50px. Gentle drift left.
// ===========================================================================
const PhaseYouve: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Starts fully visible, just a gentle slide from slightly right
      tl.fromTo(
        p.main,
        { x: 20, opacity: 1 },
        { x: 0, opacity: 1, duration: 0.5, ease: "power1.out" },
      );
    },
    { main: { x: 20, opacity: 1 } },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.493 * H}px`,
        left: `${0.50 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%)`,
        fontFamily,
        fontSize: 50,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        opacity: s.main.opacity,
        letterSpacing: "-0.3px",
      }}
    >
      You{"\u2019"}ve
    </div>
  );
};

// ===========================================================================
// Phase 2: "You've been trading on" (frames 8-72, ~2.1s)
//
// FIXED: "been" visible from frame 8. Font 50px. Ascending diagonal scatter.
// Scatter duration 1.0s (was 0.55s). "on" delayed to 0.72s.
// Gap 13px (was 8px).
// ===========================================================================
const EXP_LETTERS = "trading".split("");

// Ascending diagonal scatter: first letter starts bottom-left, last upper-right
const EXP_SCATTER_Y = [
  -30, -18, -6, 6, 18, 30, 40,
];
const EXP_SCATTER_X = [
  -12, -7, -2, 3, 7, 11, 14,
];

// Letter sizes: start larger, settle to 50px
const EXP_START_SIZE = 64;
const EXP_END_SIZE = 50;

const PhaseExperimenting: React.FC = () => {
  const frame = useCurrentFrame();

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      // "You've" starts at its P1 final position, shifts left as phrase grows
      youve: { opacity: 1 },
      been: { opacity: 0 },
      with_: { opacity: 0 },
      // Overall phrase x offset — the whole phrase shifts left as it grows
      phraseX: { v: 0 },
    };
    for (let i = 0; i < EXP_LETTERS.length; i++) {
      init[`l${i}`] = {
        x: EXP_SCATTER_X[i] * 2.5,
        y: EXP_SCATTER_Y[i],
        opacity: 0,
        size: EXP_START_SIZE,
        purple: 1,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      // Phase starts at P2_FROM (frame 8). Timeline is relative to Sequence start.

      // "been" fades in immediately (visible by ~0.25s = frame 15 absolute)
      tl.to(
        p.been,
        { opacity: 1, duration: 0.2, ease: "power1.out" },
        0.0,
      );

      // "trading" letters scatter-in starting ~0.5s into phase
      for (let i = 0; i < EXP_LETTERS.length; i++) {
        tl.to(
          p[`l${i}`],
          {
            opacity: 1,
            duration: 0.15,
            ease: "power1.out",
          },
          0.5 + i * 0.025,
        );
        // Letters settle: x, y go to 0, size normalizes, purple fades
        // Duration 1.0s (was 0.7s) — reference shows scatter lingering until ~1.5s
        tl.to(
          p[`l${i}`],
          {
            x: 0,
            y: 0,
            size: EXP_END_SIZE,
            purple: 0,
            duration: 1.0,
            ease: "power2.out",
          },
          0.55 + i * 0.03,
        );
      }

      // "with" appears at ~0.72s into phase (delayed from 0.55s)
      tl.to(
        p.with_,
        { opacity: 1, duration: 0.2, ease: "power1.out" },
        0.72,
      );

      // Whole phrase shifts left as it grows
      tl.to(
        p.phraseX,
        { v: -60, duration: 1.2, ease: "power1.out" },
        0.4,
      );
    },
    proxyInit,
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.493 * H}px`,
        left: "50%",
        transform: `translate(calc(-50% + ${s.phraseX.v}px), -50%)`,
        fontFamily,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "baseline",
        gap: 13,
        letterSpacing: "-0.2px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: 50,
          opacity: s.youve.opacity,
        }}
      >
        You{"\u2019"}ve
      </span>
      <span
        style={{
          display: "inline-block",
          fontSize: 50,
          opacity: s.been.opacity,
        }}
      >
        been
      </span>
      <span style={{ display: "inline-flex", alignItems: "baseline" }}>
        {EXP_LETTERS.map((ch, i) => {
          const l = s[`l${i}`];
          const pr = Math.max(0, Math.min(1, l.purple));
          // GM green when scattered, dark when settled
          const r = Math.round(0x00 * pr + 0x1a * (1 - pr));
          const g = Math.round(0xa3 * pr + 0x1a * (1 - pr));
          const b = Math.round(0x6c * pr + 0x1a * (1 - pr));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: l.opacity,
                transform: `translate(${l.x}px, ${l.y}px)`,
                color: `rgb(${r}, ${g}, ${b})`,
                fontSize: l.size,
                lineHeight: 1,
              }}
            >
              {ch}
            </span>
          );
        })}
      </span>
      <span
        style={{
          display: "inline-block",
          fontSize: 50,
          opacity: s.with_.opacity,
        }}
      >
        on
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 3: "GM" with gradient text (frames 72-110)
// Color: green→dark green gradient across letters
// ===========================================================================
const BARD_CHARS = "GM".split("");

const PhaseBard: React.FC = () => {
  const frame = useCurrentFrame();

  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.main,
        { x: 6, opacity: 0, scale: 0.94 },
        { x: 0, opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
      );
    },
    { main: { x: 6, opacity: 0, scale: 0.94 } },
  );

  const t = frame / FPS;

  // 2 letter gradient stops — GM brand greens
  const BARD_COLORS: Array<[number, number, number]> = [
    [0, 163, 108], // G — primary green #00A36C
    [0, 138, 90],  // M — dark green #008A5A
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.50 * H}px`,
        left: `${0.50 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%) scale(${s.main.scale})`,
        fontFamily,
        fontSize: 105,
        fontWeight: 400,
        letterSpacing: "-1.5px",
        opacity: s.main.opacity,
        whiteSpace: "nowrap",
        display: "inline-flex",
      }}
    >
      {BARD_CHARS.map((ch, i) => {
        const base = BARD_COLORS[i];
        // Subtle slow shift
        const shift = Math.sin(t * 0.6 + i * 0.4) * 12;
        const r = Math.round(Math.max(0, Math.min(255, base[0] + shift)));
        const g = Math.round(Math.max(0, Math.min(255, base[1] + shift * 0.5)));
        const b = Math.round(Math.max(0, Math.min(255, base[2] - shift * 0.3)));
        return (
          <span key={i} style={{ color: `rgb(${r}, ${g}, ${b})` }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ===========================================================================
// Phase 4: Typewriter "Build" (frames 110-150)
// Cursor persists until end of phase.
// ===========================================================================
const TYPE_PHASES = [
  { char: "B", dark: false },
  { char: "u", dark: false },
  { char: "i", dark: false },
  { char: "l", dark: false },
  { char: "d", dark: false },
];

// Gradient for "Build": GM greens → accent red
const WRITE_GRADIENT: Array<[number, number, number]> = [
  [0x00, 0xa3, 0x6c], // B — primary green
  [0x00, 0x8a, 0x5a], // u — dark green
  [0x16, 0xa3, 0x4a], // i — status up green
  [0x00, 0x8a, 0x5a], // l — dark green
  [0x00, 0xa3, 0x6c], // d — primary green
];

const PhaseTypewriter: React.FC = () => {
  const frame = useCurrentFrame();

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      cursor: { opacity: 1 },
    };
    for (let i = 0; i < TYPE_PHASES.length; i++) {
      init[`c${i}`] = { visible: 0 };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      // Type "Write" — one char at a time with slight acceleration
      tl.to(p[`c0`], { visible: 1, duration: 0.001 }, 0.15); // W
      tl.to(p[`c1`], { visible: 1, duration: 0.001 }, 0.30); // r
      tl.to(p[`c2`], { visible: 1, duration: 0.001 }, 0.42); // i
      tl.to(p[`c3`], { visible: 1, duration: 0.001 }, 0.52); // t
      tl.to(p[`c4`], { visible: 1, duration: 0.001 }, 0.62); // e
      // Cursor persists until late in phase (was 0.88, now 1.2)
      tl.to(
        p.cursor,
        { opacity: 0, duration: 0.12, ease: "power2.out" },
        1.1,
      );
    },
    proxyInit,
  );

  let visibleCount = 0;
  for (let i = 0; i < TYPE_PHASES.length; i++) {
    if (s[`c${i}`].visible > 0.5) visibleCount = i + 1;
  }

  const isTyping = visibleCount > 0 && visibleCount < TYPE_PHASES.length;
  const isDone = visibleCount >= TYPE_PHASES.length;
  const blinkOn = Math.floor(frame / 5) % 2 === 0;
  const cursorOpacity = isDone
    ? s.cursor.opacity
    : isTyping
      ? 1
      : blinkOn
        ? 1
        : 0;

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.50 * H}px`,
        left: `${0.50 * W}px`,
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontSize: 50,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        letterSpacing: "-0.2px",
      }}
    >
      {TYPE_PHASES.slice(0, visibleCount).map((phase, i) => {
        // All letters are gradient "Write" — no dark prefix
        const c = WRITE_GRADIENT[i] || [0x7b, 0x5b, 0xd0];
        return (
          <span key={i} style={{ color: `rgb(${c[0]}, ${c[1]}, ${c[2]})` }}>
            {phase.char}
          </span>
        );
      })}
      <span
        style={{
          display: "inline-block",
          width: 2.5,
          height: 50 * 0.88,
          backgroundColor: TEXT_DARK,
          marginLeft: 2,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};

// ===========================================================================
// Phase 5: "Build portfolios" with gradient rectangle pill (frames 150-185)
// FIXED: font 50px, gradient angle stays horizontal (~90deg), Build is #111.
// ===========================================================================
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();

  const s = useGsapProxy(
    (tl, p) => {
      // "Write" slides up slightly
      tl.fromTo(
        p.write,
        { y: 6, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" },
        0,
      );
      // Pill bounces in from an angle
      tl.fromTo(
        p.pill,
        { x: 30, y: 8, scale: 0.82, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.45,
          ease: "back.out(1.7)",
        },
        0.12,
      );
      // After ~0.8s, pill fades and "emails" becomes dark text
      tl.to(
        p.pill,
        { opacity: 0, duration: 0.25, ease: "power1.out" },
        0.85,
      );
      tl.fromTo(
        p.emailsDark,
        { opacity: 0 },
        { opacity: 1, duration: 0.25, ease: "power1.out" },
        0.85,
      );
    },
    {
      write: { y: 6, opacity: 0 },
      pill: { x: 30, y: 8, scale: 0.82, opacity: 0 },
      emailsDark: { opacity: 0 },
    },
  );

  // Gradient angle stays roughly horizontal
  const gradAngle =
    90 + noise2D("pill-angle", frame * 0.02, 0) * 3;
  const pillGrad = `linear-gradient(${gradAngle}deg, ${GM.green}, ${GM.greenDark}, ${GM.greenStatus})`;

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.491 * H}px`,
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 10,
        letterSpacing: "-0.2px",
      }}
    >
      <span
        style={{
          fontSize: 50,
          color: "#111111",
          opacity: s.write.opacity,
          transform: `translateY(${s.write.y}px)`,
        }}
      >
        Build
      </span>
      {/* Gradient pill version */}
      <span
        style={{
          display: "inline-block",
          opacity: s.pill.opacity,
          transform: `translate(${s.pill.x}px, ${s.pill.y}px) scale(${s.pill.scale})`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            background: pillGrad,
            padding: "6px 14px",
            borderRadius: 4,
            color: GM.textInverse,
            fontSize: 50,
            fontWeight: 400,
            lineHeight: 1.2,
          }}
        >
          portfolios
        </span>
      </span>
      {/* Dark text version (fades in as pill fades out) */}
      <span
        style={{
          fontSize: 50,
          opacity: s.emailsDark.opacity,
          position: s.pill.opacity > 0.01 ? "absolute" : "relative",
          left: s.pill.opacity > 0.01 ? "auto" : undefined,
          visibility: s.emailsDark.opacity > 0.01 ? "visible" : "hidden",
        }}
      >
        portfolios
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 6: Letter scatter → reassemble into "Predict markets"
// Stepped motion: Y axis (10f) → pause (5f) → X axis (10f) → pause (5f) → Y axis (10f)
// Then letters reassemble into "Predict markets" centered text.
// Total phase: ~60 frames (2s)
// ===========================================================================
const SCATTER_TEXT = "Build\u00A0portfolios";
const SCATTER_LETTERS = SCATTER_TEXT.split("");

// Target text for reassembly
const PREDICT_TEXT = "Predict\u00A0markets";
const PREDICT_LETTERS = PREDICT_TEXT.split("");

// Char widths scaled for 50px font
const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  B: 32, u: 26, i: 11, l: 11, d: 26,
  "\u00A0": 12,
  p: 26, o: 27, r: 18, t: 15, f: 15, s: 20,
};

// Char widths for "Predict markets" at 50px
const PREDICT_CHAR_WIDTHS: Record<string, number> = {
  P: 32, r: 18, e: 25, d: 26, i: 11, c: 22, t: 15,
  "\u00A0": 14,
  m: 36, a: 23, k: 26, s: 20,
};

// Scatter targets — where each "Build portfolios" letter drifts to via stepped motion
// Format: { dy1, dx, dy2 } — Y move 1, X move, Y move 2
const SCATTER_STEPS = [
  { dy1: -50, dx: -120, dy2: -30 },  // B
  { dy1: 40, dx: -60, dy2: 20 },     // u
  { dy1: -30, dx: 30, dy2: 15 },     // i
  { dy1: 60, dx: -40, dy2: -20 },    // l
  { dy1: -20, dx: 50, dy2: 35 },     // d
  { dy1: 0, dx: 0, dy2: 0 },         // space
  { dy1: -45, dx: -30, dy2: -25 },   // p
  { dy1: 35, dx: 60, dy2: 10 },      // o
  { dy1: -55, dx: 40, dy2: 20 },     // r
  { dy1: 50, dx: -20, dy2: -40 },    // t
  { dy1: -25, dx: 70, dy2: 30 },     // f
  { dy1: 40, dx: 80, dy2: -15 },     // o
  { dy1: -60, dx: -50, dy2: 25 },    // l
  { dy1: 30, dx: 90, dy2: -10 },     // i
  { dy1: -35, dx: 100, dy2: 20 },    // o
  { dy1: 45, dx: 110, dy2: -30 },    // s
];

const PhaseLetterScatter: React.FC = () => {
  const frame = useCurrentFrame();

  // Source letter layout (centered "Build portfolios")
  const srcWidths = SCATTER_LETTERS.map((ch) => SCATTER_CHAR_WIDTHS[ch] || 17);
  const srcTotalW = srcWidths.reduce((a, b) => a + b, 0);
  const srcOffsets: number[] = [];
  let srcRun = -srcTotalW / 2;
  for (let i = 0; i < SCATTER_LETTERS.length; i++) {
    srcOffsets.push(srcRun + srcWidths[i] / 2);
    srcRun += srcWidths[i];
  }

  // Target letter layout (centered "Predict markets")
  const tgtWidths = PREDICT_LETTERS.map((ch) => PREDICT_CHAR_WIDTHS[ch] || 17);
  const tgtTotalW = tgtWidths.reduce((a, b) => a + b, 0);
  const tgtOffsets: number[] = [];
  let tgtRun = -tgtTotalW / 2;
  for (let i = 0; i < PREDICT_LETTERS.length; i++) {
    tgtOffsets.push(tgtRun + tgtWidths[i] / 2);
    tgtRun += tgtWidths[i];
  }

  // Timeline (frames, local to this Sequence):
  // 0-10:  Y axis move (step 1)
  // 10-15: pause
  // 15-25: X axis move (step 2)
  // 25-30: pause
  // 30-40: Y axis move (step 3) — letters now at scattered positions
  // 40-44: hold at scattered positions
  // 44-56: reassemble into "Predict markets" — crossfade letters + converge
  // 56-60: settled "Predict markets"

  // Compute per-letter positions
  const letterElements = useMemo(() => {
    const elements: Array<{
      ch: string;
      x: number;
      y: number;
      opacity: number;
      size: number;
    }> = [];

    // Source letters (scattering out)
    for (let i = 0; i < SCATTER_LETTERS.length; i++) {
      const step = SCATTER_STEPS[i] || { dy1: 0, dx: 0, dy2: 0 };

      // Stepped motion — Y, pause, X, pause, Y
      let dx = 0;
      let dy = 0;

      // Step 1: Y axis (frames 0-10)
      const yProg1 = interpolate(frame, [0, 10], [0, 1], clamp);
      const yEased1 = 1 - Math.pow(1 - yProg1, 2);
      dy += step.dy1 * yEased1;

      // Step 2: X axis (frames 15-25)
      const xProg = interpolate(frame, [15, 25], [0, 1], clamp);
      const xEased = 1 - Math.pow(1 - xProg, 2);
      dx += step.dx * xEased;

      // Step 3: Y axis (frames 30-40)
      const yProg2 = interpolate(frame, [30, 40], [0, 1], clamp);
      const yEased2 = 1 - Math.pow(1 - yProg2, 2);
      dy += step.dy2 * yEased2;

      // Fade out during reassembly (frames 44-50)
      const srcOpacity = interpolate(frame, [44, 50], [1, 0], clamp);

      elements.push({
        ch: SCATTER_LETTERS[i],
        x: srcOffsets[i] + dx,
        y: dy,
        opacity: srcOpacity,
        size: 50,
      });
    }

    // Target letters (assembling in) — "Predict markets"
    for (let i = 0; i < PREDICT_LETTERS.length; i++) {
      if (PREDICT_LETTERS[i] === "\u00A0") continue;

      // Appear scattered, then converge (frames 44-56)
      const appearProg = interpolate(frame, [44, 48], [0, 1], clamp);
      const convergeProg = interpolate(frame, [46, 56], [0, 1], clamp);
      const convEased = 1 - Math.pow(1 - convergeProg, 2.5);

      // Each target letter starts from a scattered position
      const scatterSeed = i * 137 + 42;
      const scatterX = (seededRandom(scatterSeed) - 0.5) * 400;
      const scatterY = (seededRandom(scatterSeed + 1) - 0.5) * 200;
      const scatterSize = 30 + seededRandom(scatterSeed + 2) * 56; // 30-86

      const tx = scatterX + (tgtOffsets[i] - scatterX) * convEased;
      const ty = scatterY + (0 - scatterY) * convEased;
      const tSize = scatterSize + (50 - scatterSize) * convEased;

      elements.push({
        ch: PREDICT_LETTERS[i],
        x: tx,
        y: ty,
        opacity: appearProg,
        size: tSize,
      });
    }

    return elements;
  }, [frame]);

  return (
    <AbsoluteFill>
      {letterElements.map((el, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${0.491 * H}px`,
            left: "50%",
            transform: `translate(calc(-50% + ${el.x}px), calc(-50% + ${el.y}px))`,
            fontFamily,
            fontSize: el.size,
            fontWeight: 400,
            color: TEXT_DARK,
            opacity: el.opacity,
            letterSpacing: "-0.2px",
          }}
        >
          {el.ch}
        </div>
      ))}
    </AbsoluteFill>
  );
};

// ===========================================================================
// Phase 8: "Capture alpha" — floating word field (frames 240-258)
// Large blurred copies at VARYING sizes, VARYING greens, VARYING blur.
// Center has dark blur blob as convergence point.
const FLOATERS: Array<{
  word: string;
  x: number;
  y: number;
  color: string;
  size: number;
  weight: number;
  delay: number;
  blur: number;
}> = [
  // 4 prominent copies at the corners/edges
  { word: "Capture", x: -280, y: -110, color: GM.green, size: 62, weight: 500, delay: 0, blur: 4 },
  { word: "alpha", x: 260, y: -90, color: GM.textSecondary, size: 42, weight: 400, delay: 0.02, blur: 6 },
  { word: "alpha", x: -320, y: 100, color: GM.greenStatus, size: 58, weight: 500, delay: 0.01, blur: 1 },
  { word: "Capture", x: 300, y: 120, color: GM.red, size: 56, weight: 500, delay: 0.03, blur: 2 },
  // Secondary depth copies — mid-field
  { word: "Capture", x: -100, y: -180, color: GM.greenDark, size: 36, weight: 400, delay: 0.04, blur: 8 },
  { word: "alpha", x: 160, y: 170, color: GM.greenStatus, size: 34, weight: 400, delay: 0.05, blur: 10 },
  // Far depth — heavily blurred, edges
  { word: "alpha", x: -460, y: -30, color: GM.textSecondary, size: 30, weight: 400, delay: 0.03, blur: 13 },
  { word: "Capture", x: 440, y: -50, color: GM.greenDark, size: 32, weight: 400, delay: 0.06, blur: 14 },
  { word: "capture", x: 80, y: -160, color: GM.green, size: 28, weight: 400, delay: 0.05, blur: 12 },
  { word: "alpha", x: -180, y: 200, color: GM.greenStatus, size: 38, weight: 400, delay: 0.04, blur: 9 },
];

const PhaseBrainstormIdeas: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      final: { opacity: 0, scale: 0.96 },
      blob: { opacity: 0 },
    };
    for (let i = 0; i < FLOATERS.length; i++) {
      init[`g${i}`] = {
        x: FLOATERS[i].x,
        y: FLOATERS[i].y,
        opacity: 0,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      // Dark center blob fades in immediately
      tl.to(
        p.blob,
        { opacity: 0.55, duration: 0.2, ease: "power1.out" },
        0,
      );
      // Floaters fade in FAST (0.15s) — cloud should be visible almost immediately
      FLOATERS.forEach((f, i) => {
        tl.to(
          p[`g${i}`],
          {
            opacity: i < 4 ? 0.9 : 0.6,
            duration: 0.15,
            ease: "power1.out",
          },
          f.delay,
        );
      });
      // Floaters drift inward and fade — 0.8s, starts at 0.25s
      FLOATERS.forEach((f, i) => {
        tl.to(
          p[`g${i}`],
          {
            x: f.x * 0.12,
            y: f.y * 0.12,
            opacity: 0,
            duration: 0.8,
            ease: "power1.inOut",
          },
          0.25 + f.delay * 0.15,
        );
      });
      // Blob fades with floaters
      tl.to(
        p.blob,
        { opacity: 0, duration: 0.5, ease: "power1.inOut" },
        0.4,
      );
      // Final centered text appears
      tl.to(
        p.final,
        { opacity: 1, scale: 1, duration: 0.35, ease: "power2.out" },
        0.35,
      );
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
      {/* Dark convergence blob at center */}
      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 180,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,80,50,0.7) 0%, rgba(0,80,50,0.3) 40%, transparent 70%)",
          filter: "blur(18px)",
          opacity: s.blob.opacity,
        }}
      />

      {FLOATERS.map((f, i) => {
        const g = s[`g${i}`];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${0.49 * H}px`,
              left: "50%",
              transform: `translate(calc(-50% + ${g.x}px), calc(-50% + ${g.y}px))`,
              fontFamily,
              fontSize: f.size,
              fontWeight: f.weight,
              color: f.color,
              whiteSpace: "nowrap",
              opacity: g.opacity,
              filter: f.blur > 0 ? `blur(${f.blur}px)` : undefined,
            }}
          >
            {f.word}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: `translate(-50%, -50%) scale(${s.final.scale})`,
          fontFamily,
          fontSize: 50,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          opacity: s.final.opacity,
          letterSpacing: "-0.2px",
        }}
      >
        Capture alpha
      </div>
    </AbsoluteFill>
  );
};

// --- Frame Timings (SHIFTED ~15 frames later to match reference) -----------
const P1_FROM = 0; // 0.0s — "You've" alone, visible immediately
const P2_FROM = 8; // 0.27s — "been" starts fading in
const P3_FROM = 72; // 2.4s — "GM"
const P4_FROM = 110; // 3.67s — Typewriter "Build"
const P5_FROM = 150; // 5.0s — "Build portfolios" pill
const P6_FROM = 185; // 6.17s — Letter scatter → reassemble (Y→pause→X→pause→Y)
const P7_FROM = 245; // 8.17s — "Capture alpha" (was P8)
// P6 now spans 60 frames and includes "Predict markets" reassembly

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      {/* P1: "You've" alone — visible from frame 0, overlaps with P2 start */}
      <Sequence from={P1_FROM} durationInFrames={P2_FROM + 4}>
        <PhaseYouve />
      </Sequence>

      {/* P2: "You've been trading on" — includes its own "You've" */}
      <Sequence from={P2_FROM} durationInFrames={P3_FROM - P2_FROM}>
        <PhaseExperimenting />
      </Sequence>

      <Sequence from={P3_FROM} durationInFrames={P4_FROM - P3_FROM}>
        <PhaseBard />
      </Sequence>

      <Sequence from={P4_FROM} durationInFrames={P5_FROM - P4_FROM}>
        <PhaseTypewriter />
      </Sequence>

      <Sequence from={P5_FROM} durationInFrames={P6_FROM - P5_FROM}>
        <PhaseWriteEmails />
      </Sequence>

      <Sequence from={P6_FROM} durationInFrames={P7_FROM - P6_FROM}>
        <PhaseLetterScatter />
      </Sequence>

      <Sequence from={P7_FROM} durationInFrames={285 - P7_FROM}>
        <PhaseBrainstormIdeas />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "GMScene01",
  component: Scene01,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: 285,
};
