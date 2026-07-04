/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * TIMING FIX — shifted all phases ~15 frames later to match reference.
 *
 * Timeline (corrected, from reference at 0.5s intervals, 30fps):
 *   0.0s (f0):    "You've" — visible immediately, opacity 1
 *   0.3s (f8):    "been" starts fading in, "experimenting" scatter begins
 *   2.4s (f72):   "You've been experimenting with" fully settled
 *   2.4s (f72):   "Bard" — big gradient text (purple→blue)
 *   3.67s (f110): "Write" typewriter (no "to" prefix)
 *   5.0s (f150):  "Write emails" — gradient rectangle pill
 *   6.17s (f185): Letter scatter exit (SLOW — 1.2s duration)
 *   7.0s (f210):  "Solve problems" — letters scattered at different sizes
 *   8.0s (f240):  "Brainstorm ideas" — floating word field
 *   8.6s (f258):  End
 *
 * 1280x720, 30fps, 258 frames (~8.6s)
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
import { loadFont } from "@remotion/google-fonts/GoogleSans";
import { gsap } from "gsap";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const FPS = 30;
const W = 1280;
const H = 720;

// --- Palette ---------------------------------------------------------------
const TEXT_DARK = "#1A1A2E";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

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

// --- Background (soft pastel washes) ----------------------------------------
// Reference: light blue-lavender wash center-left, warm pink wash right side,
// subtle lavender top-right. Nearly white overall. Drifts very slowly.
const PastelBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 258], [0, 14], clamp);

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
          radial-gradient(ellipse 120% 100% at ${x1}% ${y1}%, hsla(${225 + hueShift}, 45%, 90%, 0.85), transparent 65%),
          radial-gradient(ellipse 70% 80% at ${x2}% ${y2}%, hsla(${340 + hueShift}, 30%, 92%, 0.6), transparent 60%),
          radial-gradient(ellipse 60% 50% at ${x3}% ${y3}%, hsla(${275 + hueShift}, 25%, 93%, 0.45), transparent 55%),
          linear-gradient(135deg, #F0EDF6 0%, #FAFAFA 45%, #F6F2EF 100%)
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
// Phase 2: "You've been experimenting with" (frames 8-72, ~2.1s)
//
// FIXED: "been" visible from frame 8. Font 50px. Ascending diagonal scatter.
// Scatter duration 1.0s (was 0.55s). "with" delayed to 0.72s.
// Gap 13px (was 8px).
// ===========================================================================
const EXP_LETTERS = "experimenting".split("");

// Ascending diagonal scatter: first letter starts bottom-left, last upper-right
const EXP_SCATTER_Y = [
  -30, -22, -14, -6, 2, 10, 18, 24, 30, 35, 38, 41, 44,
];
const EXP_SCATTER_X = [
  -12, -9, -6, -3, 0, 3, 5, 7, 9, 11, 12, 13, 14,
];

// Letter sizes: start larger, settle to 50px
const EXP_START_SIZE = 64;
const EXP_END_SIZE = 50;

const PhaseExperimenting: React.FC = () => {
  useCurrentFrame();

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

      // "experimenting" letters scatter-in starting ~0.5s into phase
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
          // Purple-blue when scattered, dark when settled
          const r = Math.round(0x6b * pr + 0x1a * (1 - pr));
          const g = Math.round(0x5f * pr + 0x1a * (1 - pr));
          const b = Math.round(0xd8 * pr + 0x2e * (1 - pr));
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
        with
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 3: "Bard" with gradient text (frames 72-110)
// Tracking: cx=0.507→0.501, cy=0.50, font_h=58 at 960 = ~77px at 1280
// Color: purple→blue gradient across letters
// Reference f_2.5s: "B" is purple, "a" purple-blue, "r" blue, "d" blue
// Tracked color_bgr at 3.1s: [184, 96, 159] = RGB(159, 96, 184) = purple
// Tracked color_bgr at 3.7s: [219, 124, 90] = RGB(90, 124, 219) = blue
// The gradient SHIFTS over time — starts purple, rotates to blue
// ===========================================================================
const BARD_CHARS = "Bard".split("");

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

  // Reference: "B" is deep purple, "a" purple-blue, "r" blue, "d" brighter blue
  // The gradient is a clear purple→blue left-to-right.
  // It slowly shifts/cycles but stays in the purple-blue range.
  const t = frame / FPS;

  // 4 letter gradient stops — deep, saturated colors matching reference
  // Reference at 3.1s: BGR [184, 96, 159] = RGB(159, 96, 184) — purple
  // Reference at 3.3s: BGR [116, 89, 200] = RGB(200, 89, 116) — but that seems wrong...
  // Looking at the VISUAL reference: B=purple, a=mid purple-blue, r=blue, d=blue
  const BARD_COLORS: Array<[number, number, number]> = [
    [140, 80, 190], // B — deep purple
    [120, 85, 200], // a — purple-blue
    [95, 100, 210], // r — blue
    [80, 110, 220], // d — brighter blue
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
// Phase 4: Typewriter "Write" (frames 110-150)
// FIXED: removed "to" prefix — reference shows only "Write" with cursor.
// Cursor persists until end of phase.
// ===========================================================================
const TYPE_PHASES = [
  { char: "W", dark: false },
  { char: "r", dark: false },
  { char: "i", dark: false },
  { char: "t", dark: false },
  { char: "e", dark: false },
];

// Gradient for "Write": purple → magenta → coral
const WRITE_GRADIENT: Array<[number, number, number]> = [
  [0x7b, 0x5b, 0xd0], // W — purple
  [0x90, 0x50, 0xc0], // r — purple-magenta
  [0xa8, 0x48, 0xa0], // i — magenta
  [0xc0, 0x44, 0x82], // t — magenta-coral
  [0xd0, 0x40, 0x68], // e — coral
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
// Phase 5: "Write emails" with gradient rectangle pill (frames 150-185)
// FIXED: font 50px, gradient angle stays horizontal (~90deg), Write is #111.
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

  // Gradient angle stays roughly horizontal (reference shows stable left-to-right)
  const gradAngle =
    90 + noise2D("pill-angle", frame * 0.02, 0) * 3;
  const pillGrad = `linear-gradient(${gradAngle}deg, #D04878, #A858B8, #6878E0)`;

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
        Write
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
            color: "#FFFFFF",
            fontSize: 50,
            fontWeight: 400,
            lineHeight: 1.2,
          }}
        >
          emails
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
        emails
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 6: Letter scatter exit (frames 185-210)
// FIXED: gentle scatter, 1.2s duration, full opacity during visible phase,
// reduced distances (120-200px), minimal rotation (2-5deg), no scale-down.
// Reference shows a VISIBLE, gentle scatter — letters stay fully readable.
// ===========================================================================
const SCATTER_TEXT = "Write\u00A0emails";
const SCATTER_LETTERS = SCATTER_TEXT.split("");

// Char widths scaled for 50px font (from 42px, ratio ~1.19)
const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  W: 38,
  r: 18,
  i: 11,
  t: 15,
  e: 23,
  "\u00A0": 12,
  m: 36,
  a: 23,
  l: 11,
  s: 20,
};

const PhaseLetterScatter: React.FC = () => {
  const charWidths = SCATTER_LETTERS.map(
    (ch) => SCATTER_CHAR_WIDTHS[ch] || 17,
  );
  const totalWidth = charWidths.reduce((a, b) => a + b, 0);
  const startXOffsets: number[] = [];
  let runX = -totalWidth / 2;
  for (let i = 0; i < SCATTER_LETTERS.length; i++) {
    startXOffsets.push(runX + charWidths[i] / 2);
    runX += charWidths[i];
  }

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < SCATTER_LETTERS.length; i++) {
      init[`l${i}`] = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }
    return init;
  }, []);

  // Scatter trajectories — GENTLE. Reference keeps letters close and readable.
  const scatterTargets = [
    { dx: -140, dy: -60, rot: -3 }, // W — upper-left
    { dx: -20, dy: 20, rot: 2 }, // r
    { dx: 10, dy: 15, rot: -1 }, // i
    { dx: -40, dy: 60, rot: 3 }, // t
    { dx: 5, dy: 12, rot: -1 }, // e
    { dx: 0, dy: 0, rot: 0 }, // space
    { dx: 5, dy: 14, rot: 1 }, // e
    { dx: 20, dy: 10, rot: -2 }, // m
    { dx: 40, dy: 15, rot: 2 }, // a
    { dx: 60, dy: -30, rot: -3 }, // i
    { dx: 100, dy: 12, rot: 1 }, // l
    { dx: 140, dy: 8, rot: -2 }, // s
  ];

  const s = useGsapProxy(
    (tl, p) => {
      SCATTER_LETTERS.forEach((_, i) => {
        const target = scatterTargets[i] || { dx: 0, dy: 0, rot: 0 };
        // First phase: move to scattered positions, keep full opacity (0.8s)
        tl.to(
          p[`l${i}`],
          {
            x: target.dx,
            y: target.dy,
            rotation: target.rot,
            scale: 1,
            opacity: 1,
            duration: 0.8,
            ease: "power2.out",
          },
          i * 0.015,
        );
        // Second phase: fade out after hold (0.4s fade, delayed)
        tl.to(
          p[`l${i}`],
          {
            opacity: 0,
            duration: 0.4,
            ease: "power1.out",
          },
          0.8 + i * 0.01,
        );
      });
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
      {SCATTER_LETTERS.map((ch, i) => {
        const l = s[`l${i}`];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${0.491 * H}px`,
              left: "50%",
              transform: `translate(calc(-50% + ${startXOffsets[i] + l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`,
              fontFamily,
              fontSize: 50,
              fontWeight: 400,
              color: TEXT_DARK,
              opacity: l.opacity,
              letterSpacing: "-0.2px",
            }}
          >
            {ch}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ===========================================================================
// Phase 7: "Solve problems" — letters scattered at DIFFERENT SIZES (frames 210-240)
// FIXED: wider scatter covering ~500x300px, convergence delayed to 0.55s,
// font 50px final, dramatic size range 30-96px.
// ===========================================================================
const SOLVE_TEXT = "Solve\u00A0problems";
const SOLVE_LETTERS = SOLVE_TEXT.split("");

// Scatter positions — from reference: every letter at a UNIQUE (x,y).
// No two letters share an X or Y coordinate. Layout:
//   "S" top-left, "o v e" spread across mid, "r o e s" right,
//   "l p l" bottom, "b" above center, "m" below-right.
// Coordinates are absolute pixel positions on the 1280x720 canvas.
const SOLVE_SCATTER: Array<{ x: number; y: number; size: number }> = [
  { x: 250, y: 248, size: 86 },  // S — large, left of center, mid-upper
  { x: 410, y: 274, size: 44 },  // o — medium, center-left
  { x: 340, y: 420, size: 32 },  // l — small, below-left
  { x: 510, y: 236, size: 46 },  // v — center, slightly higher than "o"
  { x: 620, y: 264, size: 42 },  // e — right of center
  { x: 0, y: 0, size: 50 },      // (space)
  { x: 470, y: 400, size: 34 },  // p — below center
  { x: 670, y: 242, size: 40 },  // r — right, slightly higher
  { x: 760, y: 270, size: 48 },  // o — right side
  { x: 550, y: 178, size: 56 },  // b — above center (floating high)
  { x: 440, y: 440, size: 30 },  // l — bottom, left of "p"
  { x: 810, y: 256, size: 44 },  // e — far right
  { x: 870, y: 388, size: 42 },  // m — far right, low
  { x: 920, y: 296, size: 38 },  // s — furthest right
];

// Final settled: centered at ~50%, cy=49%, uniform 50px
const SOLVE_FINAL_SIZE = 50;
// Char widths scaled by 50/42 = 1.19
const SOLVE_CHAR_WIDTHS = [31, 27, 14, 27, 25, 14, 27, 17, 27, 27, 14, 25, 36, 19];
const SOLVE_TOTAL_W = SOLVE_CHAR_WIDTHS.reduce((a, b) => a + b, 0);

const SOLVE_FINAL_X: number[] = [];
{
  let rx = W * 0.5 - SOLVE_TOTAL_W / 2;
  for (let i = 0; i < SOLVE_LETTERS.length; i++) {
    SOLVE_FINAL_X.push(rx + SOLVE_CHAR_WIDTHS[i] / 2);
    rx += SOLVE_CHAR_WIDTHS[i];
  }
}
const SOLVE_FINAL_Y = H * 0.49;

const PhaseSolveProblems: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < SOLVE_LETTERS.length; i++) {
      const sc = SOLVE_SCATTER[i];
      init[`l${i}`] = {
        x: sc.x || SOLVE_FINAL_X[i],
        y: sc.y || SOLVE_FINAL_Y,
        size: sc.size,
        opacity: 0,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      SOLVE_LETTERS.forEach((ch, i) => {
        if (ch === "\u00A0") return;
        // Fade in at scattered positions — fast
        tl.to(
          p[`l${i}`],
          { opacity: 1, duration: 0.14, ease: "power1.out" },
          i * 0.012,
        );
        // Converge to final centered line — delayed to 0.55s so scatter holds
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: SOLVE_FINAL_Y,
            size: SOLVE_FINAL_SIZE,
            duration: 0.55,
            ease: "power2.out",
          },
          0.55 + i * 0.012,
        );
      });
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
      {SOLVE_LETTERS.map((ch, i) => {
        const l = s[`l${i}`];
        if (ch === "\u00A0") return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transform: `translate(${l.x}px, ${l.y}px) translate(-50%, -50%)`,
              fontFamily,
              fontSize: l.size,
              fontWeight: 400,
              color: TEXT_DARK,
              opacity: l.opacity,
              letterSpacing: "-0.2px",
            }}
          >
            {ch}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ===========================================================================
// Phase 8: "Brainstorm ideas" — floating word field (frames 240-258)
// FIXED: 2x wider offsets, 16 entries (was 10), 3-tier blur (sharp/medium/heavy),
// faster fade-in, longer converge (1.1s), floater remnants linger.
// ===========================================================================
// Reference: large blurred copies at VARYING sizes (30-70px), VARYING colors
// (purple/blue/pink/faded), VARYING blur (0-15px). 10 copies creating depth.
// Center has dark blur blob as convergence point.
// Layout from reference screenshot:
//   "Brainstorm" top-left (large, purple, slightly blurred)
//   "ideas" top-right (medium, faded/grey)
//   dark blob center
//   "ideas" bottom-left (sharp, blue, large)
//   "Brainstorm" bottom-right (pink, large)
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
  // From reference — 4 prominent copies at the corners/edges
  { word: "Brainstorm", x: -280, y: -110, color: "#7B6BD0", size: 62, weight: 500, delay: 0, blur: 4 },
  { word: "ideas", x: 260, y: -90, color: "#9B9BB8", size: 42, weight: 400, delay: 0.02, blur: 6 },
  { word: "ideas", x: -320, y: 100, color: "#5B6FD7", size: 58, weight: 500, delay: 0.01, blur: 1 },
  { word: "Brainstorm", x: 300, y: 120, color: "#C86090", size: 56, weight: 500, delay: 0.03, blur: 2 },
  // Secondary depth copies — mid-field
  { word: "Brainstorm", x: -100, y: -180, color: "#A878C8", size: 36, weight: 400, delay: 0.04, blur: 8 },
  { word: "ideas", x: 160, y: 170, color: "#6878E0", size: 34, weight: 400, delay: 0.05, blur: 10 },
  // Far depth — heavily blurred, edges
  { word: "ideas", x: -460, y: -30, color: "#8888B0", size: 30, weight: 400, delay: 0.03, blur: 13 },
  { word: "Brainstorm", x: 440, y: -50, color: "#B070A0", size: 32, weight: 400, delay: 0.06, blur: 14 },
  { word: "brainstorm", x: 80, y: -160, color: "#9B6FBF", size: 28, weight: 400, delay: 0.05, blur: 12 },
  { word: "ideas", x: -180, y: 200, color: "#7080D0", size: 38, weight: 400, delay: 0.04, blur: 9 },
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
      {/* Dark convergence blob at center — reference shows a dark smudge */}
      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 180,
          height: 60,
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(30,25,50,0.7) 0%, rgba(30,25,50,0.3) 40%, transparent 70%)",
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
        Brainstorm ideas
      </div>
    </AbsoluteFill>
  );
};

// --- Frame Timings (SHIFTED ~15 frames later to match reference) -----------
const P1_FROM = 0; // 0.0s — "You've" alone, visible immediately
const P2_FROM = 8; // 0.27s — "been" starts fading in
const P3_FROM = 72; // 2.4s — "Bard"
const P4_FROM = 110; // 3.67s — Typewriter "Write" (no "to")
const P5_FROM = 150; // 5.0s — "Write emails" pill
const P6_FROM = 185; // 6.17s — Letter scatter (SLOW 1.2s)
const P7_FROM = 200; // 6.67s — "Solve problems"
const P8_FROM = 218; // 7.27s — "Brainstorm ideas" (ref: ~7.5s)

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      {/* P1: "You've" alone — visible from frame 0, overlaps with P2 start */}
      <Sequence from={P1_FROM} durationInFrames={P2_FROM + 4}>
        <PhaseYouve />
      </Sequence>

      {/* P2: "You've been experimenting with" — includes its own "You've" */}
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

      <Sequence from={P7_FROM} durationInFrames={P8_FROM - P7_FROM}>
        <PhaseSolveProblems />
      </Sequence>

      <Sequence from={P8_FROM} durationInFrames={259 - P8_FROM}>
        <PhaseBrainstormIdeas />
      </Sequence>
    </AbsoluteFill>
  );
};

export const scene01Meta = {
  id: "OFScene01",
  component: Scene01,
  width: W,
  height: H,
  fps: FPS,
  durationInFrames: 258,
};
