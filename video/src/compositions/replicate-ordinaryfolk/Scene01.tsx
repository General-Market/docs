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

// Canvas is 1280x720 but reference is 960x540. Scale factor:
const SCALE = 720 / 540; // 1.333

// --- Palette ---------------------------------------------------------------
const BG_BASE = "#F0EDF5";
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
// Phase 1: "You've"  (frames 0-17, ~0.57s)
// Tracking: starts cx=0.524 cy=0.493, slides to cx=0.493 cy=0.493
// Font ~30px at 960x540 = ~40px at 1280x720
// Quick slide from right, power1.out
// ===========================================================================
const PhaseYouve: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      // Tracking: starts at cx_norm=0.524 at t=0, reaches 0.493 by t=0.3s
      // At 1280: 0.524*1280=670, 0.493*1280=631 → delta=39px rightward
      // Fade in is very fast — nearly instant. The word is visible at frame 0.
      tl.fromTo(
        p.main,
        { x: 39, opacity: 0.6 },
        { x: 0, opacity: 1, duration: 0.25, ease: "power1.out" },
      );
    },
    { main: { x: 39, opacity: 0.6 } },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.493 * H}px`,
        left: `${0.493 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%)`,
        fontFamily,
        fontSize: 42,
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
// Phase 2: "You've been experimenting with" (frames 15-74, ~2s)
//
// Tracking data timeline:
//   0.0s: "You've" visible, drifts left
//   0.6s: "been" appears to the right, pair centered ~50%
//   1.2s: Big leftward shift — You've+been move left to make room
//   1.7s: "with" appears at cx=0.766
//   1.9s: "experimenting" letters start appearing (big, scattered, purple)
//   2.0-2.5s: Letters settle down to baseline, colors go dark
//
// The phrase "You've been experimenting with" is laid out left-to-right.
// "experimenting" letters start scattered vertically and in purple,
// then settle to baseline in dark color.
//
// Note: In the reference, the full phrase drifts LEFT over time as more
// words are added, keeping the visual center roughly at 50%.
// ===========================================================================
const EXP_LETTERS = "experimenting".split("");

// Reference f_1s.png shows letters scattered along a diagonal trajectory
// from lower-left to upper-right. Each letter at a DIFFERENT vertical position.
// The word flows upward like a wave. Letters are in purple/blue tones initially.
//
// At 1280x720, the scatter goes from about x=-60,y=20 for "e" to x=180,y=-80 for "g"
// relative to the word's natural inline position.
const EXP_SCATTER_Y = [
  15, -10, 5, -25, -15, -35, -20, -40, -30, -55, -25, -45, -65,
];
const EXP_SCATTER_X = [
  -8, -4, 0, 6, 4, 12, 8, 16, 12, 22, 16, 24, 28,
];

// Letter sizes: start ~80% larger than final, settle down
const EXP_START_SIZE = 56;
const EXP_END_SIZE = 42;

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
      // Phase starts at P2_FROM. Timeline is relative to Sequence start.
      // 0.0s = frame 15 of composition

      // "been" fades in (at ~0.1s into this phase = 0.6s absolute)
      tl.to(
        p.been,
        { opacity: 1, duration: 0.25, ease: "power1.out" },
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
        // Letters settle: x, y go to 0, size goes to normal, purple fades
        tl.to(
          p[`l${i}`],
          {
            x: 0,
            y: 0,
            size: EXP_END_SIZE,
            purple: 0,
            duration: 0.7,
            ease: "power2.out",
          },
          0.55 + i * 0.03,
        );
      }

      // "with" appears at ~0.6s into phase
      tl.to(
        p.with_,
        { opacity: 1, duration: 0.2, ease: "power1.out" },
        0.55,
      );

      // Whole phrase shifts left as it grows
      // At start: "You've been" is near center
      // By end: full phrase has shifted left so center stays ~50%
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
        gap: 8,
        letterSpacing: "-0.2px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: 42,
          opacity: s.youve.opacity,
        }}
      >
        You{"\u2019"}ve
      </span>
      <span
        style={{
          display: "inline-block",
          fontSize: 42,
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
          fontSize: 42,
          opacity: s.with_.opacity,
        }}
      >
        with
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 3: "Bard" with gradient text (frames 75-104, ~1s)
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
        fontSize: 78,
        fontWeight: 400,
        letterSpacing: "-1px",
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
// Phase 4: Typewriter "to Write" (frames 105-134, ~1s)
// Reference f_3.5s: "to|" centered, dark text + blinking cursor
// Reference f_4s: "Write|" in gradient (purple→coral)
//
// Tracking data:
//   "to" first at 4.2s → but relative to scene start this is ~3.5s
//   "W" typed at ~3.75s, "Wr" at ~4.0s, etc.
//
// The typewriter types character by character.
// "to " is dark text, "Write" is gradient purple→magenta→coral.
// Cursor is a thin black vertical bar that blinks.
// ===========================================================================
const TYPE_PHASES = [
  { char: "t", dark: true },
  { char: "o", dark: true },
  { char: " ", dark: true },
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
      // Type "to " quickly, then pause, then type "Write" slower
      // "to" appears fast
      tl.to(p[`c0`], { visible: 1, duration: 0.001 }, 0.05);
      tl.to(p[`c1`], { visible: 1, duration: 0.001 }, 0.13);
      tl.to(p[`c2`], { visible: 1, duration: 0.001 }, 0.20); // space
      // Brief pause, then "Write"
      tl.to(p[`c3`], { visible: 1, duration: 0.001 }, 0.38); // W
      tl.to(p[`c4`], { visible: 1, duration: 0.001 }, 0.50); // r
      tl.to(p[`c5`], { visible: 1, duration: 0.001 }, 0.58); // i
      tl.to(p[`c6`], { visible: 1, duration: 0.001 }, 0.65); // t
      tl.to(p[`c7`], { visible: 1, duration: 0.001 }, 0.73); // e
      // Cursor fades after typing completes
      tl.to(
        p.cursor,
        { opacity: 0, duration: 0.12, ease: "power2.out" },
        0.88,
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
        fontSize: 42,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        letterSpacing: "-0.2px",
      }}
    >
      {TYPE_PHASES.slice(0, visibleCount).map((phase, i) => {
        if (phase.char === " ") {
          return (
            <span key={i} style={{ color: TEXT_DARK }}>
              {"\u00A0"}
            </span>
          );
        }
        if (phase.dark) {
          return (
            <span key={i} style={{ color: TEXT_DARK }}>
              {phase.char}
            </span>
          );
        }
        // Gradient letter for "Write"
        const gradIdx = i - 3; // offset past "to "
        const c = WRITE_GRADIENT[gradIdx] || [0x7b, 0x5b, 0xd0];
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
          height: 42 * 0.88,
          backgroundColor: TEXT_DARK,
          marginLeft: 2,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};

// ===========================================================================
// Phase 5: "Write emails" with gradient rectangle pill (frames 130-164)
// Tracking: "Write" cx=0.438, "emails" cx=0.577, both at cy=0.491
// "Write" is dark/black text. "emails" is white text inside a
// gradient rectangle pill (pink→purple→blue).
//
// Reference f_4.5s: "Write" dark + "emails" in vibrant gradient rect
// Reference f_5.0s: Same but "Write emails" fully dark — pill dissolved
//
// The pill bounces in with back.out easing.
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

  // Gradient angle on the pill shifts over time
  const gradAngle =
    interpolate(frame, [0, 40], [130, 200], clamp) +
    noise2D("pill-angle", frame * 0.02, 0) * 5;
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
          fontSize: 42,
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
            fontSize: 42,
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
          fontSize: 42,
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
// Phase 6: Letter scatter exit (frames 158-177)
// Letters of "Write emails" explode outward from inline positions.
// Reference f_5.5s: letters scattered at various positions and sizes.
// Each letter gets an independent trajectory, rotation, scale.
// ===========================================================================
const SCATTER_TEXT = "Write\u00A0emails";
const SCATTER_LETTERS = SCATTER_TEXT.split("");

const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  W: 32,
  r: 15,
  i: 9,
  t: 13,
  e: 19,
  "\u00A0": 10,
  m: 30,
  a: 19,
  l: 9,
  s: 17,
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

  // Scatter trajectories from reference f_5.5s
  // W goes up-left, r down-right, i up, t down, e right, etc.
  const scatterTargets = [
    { dx: -280, dy: -120, rot: -15 }, // W
    { dx: -40, dy: 40, rot: 8 }, // r
    { dx: 20, dy: 30, rot: -5 }, // i
    { dx: -80, dy: 120, rot: 12 }, // t
    { dx: 10, dy: 25, rot: -3 }, // e
    { dx: 0, dy: 0, rot: 0 }, // space
    { dx: 10, dy: 28, rot: 5 }, // e
    { dx: 40, dy: 20, rot: -8 }, // m
    { dx: 80, dy: 30, rot: 10 }, // a
    { dx: 120, dy: -60, rot: -12 }, // i
    { dx: 200, dy: 25, rot: 6 }, // l
    { dx: 280, dy: 15, rot: -10 }, // s
  ];

  const s = useGsapProxy(
    (tl, p) => {
      SCATTER_LETTERS.forEach((_, i) => {
        const target = scatterTargets[i] || { dx: 0, dy: 0, rot: 0 };
        tl.to(
          p[`l${i}`],
          {
            x: target.dx,
            y: target.dy,
            rotation: target.rot,
            scale: 0.6 + Math.random() * 0.4,
            opacity: 0,
            duration: 0.5,
            ease: "expo.out",
          },
          i * 0.015,
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
              fontSize: 42,
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
// Phase 7: "Solve problems" — letters scattered at DIFFERENT SIZES (frames 171-210)
//
// Reference f_6s: Letters are at various positions and SIZES across the frame.
//   "S" large upper-left, "o" medium, "l" small lower-left, etc.
//   They converge to a centered uniform line.
//
// Reference f_6.5s: Nearly settled, all same size centered.
//
// Tracking data for final position:
//   "Solve" cx=0.39-0.41, cy=0.49, font=31-35px
//   "problems" cx=0.55, cy=0.50, font=36px
//   At 1280: Solve at ~x=512, problems at ~x=710
//
// Scatter positions from reference f_6s (scaled to 1280x720):
// ===========================================================================
const SOLVE_TEXT = "Solve\u00A0problems";
const SOLVE_LETTERS = SOLVE_TEXT.split("");

// Scatter positions from reference f_6s analysis (at 1280x720)
const SOLVE_SCATTER: Array<{ x: number; y: number; size: number }> = [
  { x: 380, y: 260, size: 68 }, // S — large, left of center
  { x: 450, y: 260, size: 48 }, // o — medium
  { x: 490, y: 260, size: 42 }, // l — smaller
  { x: 510, y: 260, size: 44 }, // v — medium
  { x: 540, y: 260, size: 42 }, // e — medium
  { x: 0, y: 0, size: 42 }, // (space)
  { x: 570, y: 260, size: 48 }, // p — medium
  { x: 620, y: 265, size: 42 }, // r — small
  { x: 660, y: 350, size: 46 }, // o — off-center
  { x: 700, y: 240, size: 44 }, // b — up
  { x: 620, y: 340, size: 42 }, // l — down
  { x: 760, y: 260, size: 44 }, // e — right
  { x: 830, y: 340, size: 46 }, // m — far right, down
  { x: 890, y: 260, size: 42 }, // s — far right
];

// Final settled: centered at ~50%, cy=49%, uniform 42px
const SOLVE_FINAL_SIZE = 42;
const SOLVE_CHAR_WIDTHS = [26, 23, 12, 23, 21, 12, 23, 14, 23, 23, 12, 21, 30, 16];
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
        // Fade in at scattered positions
        tl.to(
          p[`l${i}`],
          { opacity: 1, duration: 0.18, ease: "power1.out" },
          i * 0.015,
        );
        // Converge to final centered line
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: SOLVE_FINAL_Y,
            size: SOLVE_FINAL_SIZE,
            duration: 0.65,
            ease: "power2.out",
          },
          0.15 + i * 0.012,
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
// Phase 8: "Brainstorm ideas" — floating word field (frames 207-258)
//
// Reference f_7s + f_7.5s: Multiple instances of "Brainstorm" and "ideas"
// scattered across the frame at different sizes, colors, and opacities.
// Colors: blue-purple for "ideas", pink-coral for "Brainstorm"
// Some are blurred, creating depth.
//
// Reference f_8s: Centered "Brainstorm ideas" in dark text with a few
// ghost words still fading.
//
// Key detail from reference: words are MUCH larger and spread wider than
// current implementation. "ideas" in blue at top-left is ~40px bold.
// "Brainstorm" in pink at bottom-right is ~40px.
// ===========================================================================
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
  // From reference f_7s and f_7.5s positions (at 1280x720)
  {
    word: "ideas",
    x: -380,
    y: -100,
    color: "#5B6FD7",
    size: 42,
    weight: 700,
    delay: 0,
    blur: 2,
  },
  {
    word: "Brainstorm",
    x: 60,
    y: -120,
    color: "#9B6FBF",
    size: 36,
    weight: 500,
    delay: 0.04,
    blur: 1,
  },
  {
    word: "ideas",
    x: 260,
    y: -90,
    color: "#D44E7A80",
    size: 28,
    weight: 500,
    delay: 0.08,
    blur: 3,
  },
  {
    word: "Brainstorm",
    x: -100,
    y: -30,
    color: "#8B5FC060",
    size: 22,
    weight: 400,
    delay: 0.05,
    blur: 4,
  },
  {
    word: "ideas",
    x: 0,
    y: 20,
    color: "#5B6FD7",
    size: 38,
    weight: 700,
    delay: 0.02,
    blur: 0,
  },
  {
    word: "Brainstorm",
    x: 280,
    y: 40,
    color: "#D44E7A",
    size: 40,
    weight: 500,
    delay: 0.06,
    blur: 1,
  },
  {
    word: "ideas",
    x: -200,
    y: 60,
    color: "#6878E080",
    size: 24,
    weight: 400,
    delay: 0.1,
    blur: 3,
  },
  {
    word: "Brainstorm",
    x: -350,
    y: 120,
    color: "#D44E7A60",
    size: 36,
    weight: 500,
    delay: 0.12,
    blur: 2,
  },
  {
    word: "ideas",
    x: 180,
    y: 100,
    color: "#5B6FD740",
    size: 20,
    weight: 400,
    delay: 0.15,
    blur: 5,
  },
  {
    word: "Brainstorm",
    x: -180,
    y: -160,
    color: "#B86CC840",
    size: 18,
    weight: 400,
    delay: 0.18,
    blur: 4,
  },
];

const PhaseBrainstormIdeas: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      final: { opacity: 0, scale: 0.96 },
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
      // Floaters fade in
      FLOATERS.forEach((f, i) => {
        tl.to(
          p[`g${i}`],
          {
            opacity: i < 6 ? 0.8 : 0.45,
            duration: 0.3,
            ease: "power1.out",
          },
          f.delay,
        );
      });
      // Floaters drift inward and fade
      FLOATERS.forEach((f, i) => {
        tl.to(
          p[`g${i}`],
          {
            x: f.x * 0.2,
            y: f.y * 0.2,
            opacity: 0,
            duration: 0.9,
            ease: "power1.inOut",
          },
          0.5 + f.delay * 0.3,
        );
      });
      // Final centered text
      tl.to(
        p.final,
        { opacity: 1, scale: 1, duration: 0.5, ease: "power2.out" },
        0.7,
      );
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
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
          fontSize: 42,
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

// --- Frame Timings ----------------------------------------------------------
// Reference timeline (from dense frames + tracking data):
//   "You've" appears at 0.0s, "been" at 0.5s, "experimenting" at 1.0s
//   Full phrase settled by 2.0s, fades ~2.3s
//   "Bard" at 2.5s, holds to ~3.3s
//   "to|" typewriter at 3.5s, "Write" typed by 4.0s
//   "Write emails" pill at 4.5s, settled at 5.0s
//   Scatter at 5.3s
//   "Solve problems" at 5.7s, settled by 6.5s
//   "Brainstorm ideas" at 7.0s, final by 8.0s
const P1_FROM = 0; // 0.0s — "You've" alone
const P2_FROM = 14; // 0.47s — transitions to "You've been experimenting with"
const P3_FROM = 72; // 2.4s — "Bard"
const P4_FROM = 103; // 3.43s — Typewriter "to Write"
const P5_FROM = 133; // 4.43s — "Write emails" pill
const P6_FROM = 160; // 5.33s — Letter scatter
const P7_FROM = 172; // 5.73s — "Solve problems"
const P8_FROM = 207; // 6.9s — "Brainstorm ideas"

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      {/* P1: "You've" alone — ends right when P2 starts */}
      <Sequence from={P1_FROM} durationInFrames={P2_FROM}>
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

      <Sequence from={P5_FROM} durationInFrames={P6_FROM - P5_FROM + 4}>
        <PhaseWriteEmails />
      </Sequence>

      <Sequence from={P6_FROM} durationInFrames={P7_FROM - P6_FROM + 4}>
        <PhaseLetterScatter />
      </Sequence>

      <Sequence from={P7_FROM} durationInFrames={P8_FROM - P7_FROM}>
        <PhaseSolveProblems />
      </Sequence>

      <Sequence from={P8_FROM} durationInFrames={258 - P8_FROM}>
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
