/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * DEEP REFINEMENT — frame-matched to 17-frame reference set at 0.5s intervals.
 *
 * Timeline (from reference frames, 30fps):
 *   0.0s (f0):    "You've" — visible immediately, opacity 1
 *   0.27s (f8):   "been" starts, "experimenting" diagonal scatter
 *   2.4s (f72):   "Bard" — large gradient text, purple→blue, ~10 frames
 *   2.73s (f82):  Typewriter starts — "to" typed first (dark), then "Write" (gradient)
 *   4.0s (f120):  "Write emails" — gradient pill
 *   5.0s (f150):  "Write emails" dark text (pill faded)
 *   5.33s (f160): Letter scatter exit
 *   6.0s (f180):  "Solve problems" — letters at varying sizes, scattered
 *   6.5s (f195):  "Solve problems" settled
 *   7.0s (f210):  "Brainstorm ideas" — floating word cloud
 *   8.0s (f240):  "Brainstorm ideas" with remnants
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

// Reference is 960x540. Our canvas is 1280x720. Scale = 1.333
const S = 1280 / 960; // 1.333

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
// Reference: very soft lavender center-left, warm pink right side, nearly white.
// The blobs are LARGE and SUBTLE — they breathe, they do not announce.
const PastelBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 258], [0, 14], clamp);

  const x1 = 30 + noise2D("bg1x", frame * 0.003, 0) * 8;
  const y1 = 45 + noise2D("bg1y", 0, frame * 0.002) * 6;
  const x2 = 82 + noise2D("bg2x", frame * 0.002, 1.5) * 6;
  const y2 = 28 + noise2D("bg2y", 1.5, frame * 0.003) * 5;
  const x3 = 68 + noise2D("bg3x", frame * 0.002, 3.0) * 5;
  const y3 = 22 + noise2D("bg3y", 3.0, frame * 0.002) * 4;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 130% 110% at ${x1}% ${y1}%, hsla(${228 + hueShift}, 45%, 89%, 0.8), transparent 55%),
          radial-gradient(ellipse 100% 90% at ${x2}% ${y2}%, hsla(${345 + hueShift}, 32%, 91%, 0.6), transparent 50%),
          radial-gradient(ellipse 85% 65% at ${x3}% ${y3}%, hsla(${270 + hueShift}, 28%, 92%, 0.45), transparent 48%),
          linear-gradient(135deg, #EEEAF5 0%, #F9F9FB 40%, #F5F0ED 100%)
        `,
      }}
    />
  );
};

// Font sizes: tracking shows 30px bounding height at 960 for body text,
// 58px for "Bard". CSS font-size ≈ bounding_height / 0.71 * scale
const BODY_FONT = Math.round(44 * S); // ~59px — calibrated to reference
const BARD_FONT = Math.round(82 * S); // ~109px — matches 58px bbox at 960

// ===========================================================================
// Phase 1: "You've"  (frames 0-8)
// Visible at opacity 1 from frame 0. Centered. Gentle drift.
// ===========================================================================
const PhaseYouve: React.FC = () => {
  const frame = useCurrentFrame();
  // Tracking: cx_norm slides from 0.524 to 0.493 over ~0.3s (9 frames)
  const xNorm = interpolate(frame, [0, 9], [0.524, 0.493], clamp);

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.4926 * H}px`,
        left: `${xNorm * W}px`,
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontSize: BODY_FONT,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        letterSpacing: "-0.3px",
      }}
    >
      You{"\u2019"}ve
    </div>
  );
};

// ===========================================================================
// Phase 2: "You've been experimenting with" (frames 8-72)
//
// "been" fades in by frame 15. "experimenting" letters scatter along an
// ASCENDING DIAGONAL — first letter bottom-left, last letter top-right.
// Each letter at 50-64px, purple-tinted, settling to dark over ~1.2s.
// "with" appears at ~0.9s into phase. The whole phrase shifts left as it grows.
// ===========================================================================
const EXP_LETTERS = "experimenting".split("");

// Ascending diagonal: first letter lower-left, last upper-right.
// Reference at 1.0s shows moderate vertical spread — letters scattered
// along ascending diagonal, compact grouping.
const EXP_SCATTER_Y = [
  35, 27, 18, 10, 3, -4, -12, -20, -28, -35, -42, -48, -54,
];
const EXP_SCATTER_X = [
  -18, -12, -8, -4, 0, 4, 8, 12, 15, 18, 20, 22, 24,
];

// Wave amplitude for settled letters — very subtle undulation matching reference
const EXP_WAVE_AMP = 6; // subtle vertical shift — reference shows barely visible
const EXP_WAVE_SPEED = 0.08; // frames per cycle unit
const EXP_WAVE_SPREAD = 0.40; // phase offset per letter

const EXP_START_SIZE = Math.round(46 * S); // ~61 scattered — matches tracking fh 46
const EXP_END_SIZE = BODY_FONT; // settled to body size

const PhaseExperimenting: React.FC = () => {
  const frame = useCurrentFrame();

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      been: { opacity: 0 },
      with_: { opacity: 0 },
      expText: { opacity: 0 }, // the properly-rendered "experimenting" text
      // Phrase center X — shifts left as it grows
      phraseX: { v: 0.50 * W },
    };
    for (let i = 0; i < EXP_LETTERS.length; i++) {
      init[`l${i}`] = {
        x: EXP_SCATTER_X[i] * 2.0,
        y: EXP_SCATTER_Y[i] * 1.1,
        opacity: 0,
        size: EXP_START_SIZE,
        purple: 1,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      // "been" fades in at start of phase
      tl.to(p.been, { opacity: 1, duration: 0.2, ease: "power1.out" }, 0.0);

      // Phrase shifts left as it grows
      tl.to(p.phraseX, { v: 0.47 * W, duration: 0.3, ease: "power1.out" }, 0.2);
      tl.to(p.phraseX, { v: 0.41 * W, duration: 0.5, ease: "power2.out" }, 0.8);

      // Scatter letters appear at ~0.5s
      for (let i = 0; i < EXP_LETTERS.length; i++) {
        tl.to(
          p[`l${i}`],
          { opacity: 1, duration: 0.08, ease: "power1.out" },
          0.45 + i * 0.012,
        );
        // Letters settle AND fade out — as they settle, the real text fades in
        tl.to(
          p[`l${i}`],
          {
            x: 0, y: 0, size: EXP_END_SIZE, purple: 0, opacity: 0,
            duration: 0.6, ease: "power2.out",
          },
          0.55 + i * 0.015,
        );
      }

      // Real "experimenting" text fades in as scatter letters settle
      tl.to(p.expText, { opacity: 1, duration: 0.4, ease: "power1.out" }, 0.75);

      // "with" appears at ~1.1s into phase
      tl.to(p.with_, { opacity: 1, duration: 0.25, ease: "power1.out" }, 1.1);
    },
    proxyInit,
  );

  // Absolute positioning using tracking data
  const youveX = s.phraseX.v;
  const cy = 0.4926 * H;

  // Word widths at BODY_FONT (estimated for Google Sans 400)
  const WORD_GAP = Math.round(12 * S);
  // "been" sits to the right of "You've" with a word gap
  // Tracking: been is ~107px right of You've center at 960 (at time 0.6s)
  const BEEN_OFFSET = Math.round(107 * S); // 143px at 1280

  // "experimenting" settled positions — per-character widths for proper kerning
  // e-x-p-e-r-i-m-e-n-t-i-n-g at Google Sans 400
  // Google Sans 400 approximate char widths relative to font-size (tightened)
  const EXP_CHAR_WIDTHS = [0.48, 0.48, 0.50, 0.48, 0.30, 0.20, 0.68, 0.48, 0.50, 0.26, 0.20, 0.50, 0.44].map(
    (w) => Math.round(BODY_FONT * w),
  );
  const EXP_START = youveX + BEEN_OFFSET + Math.round(55 * S) + WORD_GAP;

  // Cumulative X offsets for each letter of "experimenting"
  const EXP_CUM_X: number[] = [];
  {
    let rx = 0;
    for (let i = 0; i < EXP_CHAR_WIDTHS.length; i++) {
      EXP_CUM_X.push(rx);
      rx += EXP_CHAR_WIDTHS[i];
    }
  }
  const EXP_TOTAL_W = EXP_CUM_X[EXP_CUM_X.length - 1] + EXP_CHAR_WIDTHS[EXP_CHAR_WIDTHS.length - 1];

  // "with" — tracking shows delta from You've to with is ~284px at 960 (~379 at 1280)
  // at settled state. Plus the experimenting word between them.
  const WITH_OFFSET = youveX + Math.round(420 * S);

  return (
    <AbsoluteFill>
      {/* You've */}
      <div
        style={{
          position: "absolute",
          top: cy,
          left: youveX,
          transform: "translate(-50%, -50%)",
          fontFamily,
          fontSize: BODY_FONT,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          letterSpacing: "-0.3px",
        }}
      >
        You{"\u2019"}ve
      </div>

      {/* been */}
      <div
        style={{
          position: "absolute",
          top: cy,
          left: youveX + BEEN_OFFSET,
          transform: "translate(-50%, -50%)",
          fontFamily,
          fontSize: BODY_FONT,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          opacity: s.been.opacity,
          letterSpacing: "-0.3px",
        }}
      >
        been
      </div>

      {/* experimenting letters */}
      {EXP_LETTERS.map((ch, i) => {
        const l = s[`l${i}`];
        const pr = Math.max(0, Math.min(1, l.purple));
        const r = Math.round(0x6b * pr + 0x1a * (1 - pr));
        const g = Math.round(0x5f * pr + 0x1a * (1 - pr));
        const b = Math.round(0xd8 * pr + 0x2e * (1 - pr));
        // Settled position = center of each character's allocated width
        const settledX = EXP_START + (EXP_CUM_X[i] || 0) + (EXP_CHAR_WIDTHS[i] || 0) / 2;
        return (
          <div
            key={`exp${i}`}
            style={{
              position: "absolute",
              top: cy,
              left: settledX,
              transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y + Math.sin(i * 0.8) * 40 * (1 - pr)}px))`,
              fontFamily,
              fontSize: l.size,
              fontWeight: 400,
              color: `rgb(${r}, ${g}, ${b})`,
              opacity: l.opacity,
              lineHeight: 1,
              letterSpacing: "-0.3px",
            }}
          >
            {ch}
          </div>
        );
      })}

      {/* with */}
      <div
        style={{
          position: "absolute",
          top: cy,
          left: WITH_OFFSET,
          transform: "translate(-50%, -50%)",
          fontFamily,
          fontSize: BODY_FONT,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          opacity: s.with_.opacity,
          letterSpacing: "-0.3px",
        }}
      >
        with
      </div>
    </AbsoluteFill>
  );
};

// ===========================================================================
// Phase 3: "Bard" with gradient text (frames 72-82)
//
// LARGE — 120px at 1280. Deep purple→blue gradient. Near-instant appear.
// Lasts only ~10 frames (0.33s). Then gone.
// ===========================================================================
const BARD_CHARS = "Bard".split("");

const PhaseBard: React.FC = () => {
  const frame = useCurrentFrame();

  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.main,
        { opacity: 0, scale: 0.96 },
        { opacity: 1, scale: 1, duration: 0.08, ease: "power2.out" },
      );
    },
    { main: { opacity: 0, scale: 0.96 } },
  );

  const t = frame / FPS;

  // Deep saturated purple→blue gradient per letter — matches reference f_2.5s
  const BARD_COLORS: Array<[number, number, number]> = [
    [120, 55, 190], // B — vivid purple
    [100, 65, 200], // a — purple-blue
    [75, 80, 215],  // r — blue
    [55, 95, 230],  // d — bright blue
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.50 * H}px`,
        left: `${0.50 * W}px`,
        transform: `translate(-50%, -50%) scale(${s.main.scale})`,
        fontFamily,
        fontSize: BARD_FONT,
        fontWeight: 400,
        letterSpacing: "-2px",
        opacity: s.main.opacity,
        whiteSpace: "nowrap",
        display: "inline-flex",
      }}
    >
      {BARD_CHARS.map((ch, i) => {
        const base = BARD_COLORS[i];
        const shift = Math.sin(t * 0.8 + i * 0.5) * 10;
        const r = Math.round(Math.max(0, Math.min(255, base[0] + shift)));
        const g = Math.round(Math.max(0, Math.min(255, base[1] + shift * 0.4)));
        const b = Math.round(Math.max(0, Math.min(255, base[2] - shift * 0.2)));
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
// Phase 4: Typewriter "to Write" (frames 82-120)
//
// Reference at 3.0s shows "to" with cursor. At 3.5s shows "W" being typed.
// At 4.0s shows "Write" complete with cursor.
// "to" typed FIRST in dark, then "Write" in gradient purple→coral.
// "to" fades out after Write is complete.
// ===========================================================================
const TYPE_CHARS = [
  { char: "t", dark: true },
  { char: "o", dark: true },
  { char: " ", dark: true },
  { char: "W", dark: false },
  { char: "r", dark: false },
  { char: "i", dark: false },
  { char: "t", dark: false },
  { char: "e", dark: false },
];

// Gradient for "Write" letters (indices 3-7): purple → magenta → coral
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
      toFade: { opacity: 1 },
    };
    for (let i = 0; i < TYPE_CHARS.length; i++) {
      init[`c${i}`] = { visible: 0 };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      // Type "to " — reference shows "to|" at 3.0s (0.27s into phase)
      tl.to(p[`c0`], { visible: 1, duration: 0.001 }, 0.06); // t
      tl.to(p[`c1`], { visible: 1, duration: 0.001 }, 0.15); // o
      // "to" fades out AS Write begins — reference shows only "W" at 3.5s
      tl.to(
        p.toFade,
        { opacity: 0, duration: 0.12, ease: "power1.out" },
        0.48,
      );
      tl.to(p[`c2`], { visible: 1, duration: 0.001 }, 0.30); // space
      // Type "Write" — slower. Reference: "W" at 3.5s (0.77s), "Write" at 4.0s (1.27s)
      tl.to(p[`c3`], { visible: 1, duration: 0.001 }, 0.55); // W
      tl.to(p[`c4`], { visible: 1, duration: 0.001 }, 0.82); // r — delayed so 3.5s shows W only
      tl.to(p[`c5`], { visible: 1, duration: 0.001 }, 0.95); // i
      tl.to(p[`c6`], { visible: 1, duration: 0.001 }, 1.05); // t
      tl.to(p[`c7`], { visible: 1, duration: 0.001 }, 1.15); // e
      // Cursor persists briefly
      tl.to(
        p.cursor,
        { opacity: 0, duration: 0.1, ease: "power2.out" },
        1.22,
      );
    },
    proxyInit,
  );

  let visibleCount = 0;
  for (let i = 0; i < TYPE_CHARS.length; i++) {
    if (s[`c${i}`].visible > 0.5) visibleCount = i + 1;
  }

  const allTyped = visibleCount >= TYPE_CHARS.length;
  const blinkOn = Math.floor(frame / 5) % 2 === 0;
  const cursorOpacity = allTyped
    ? s.cursor.opacity
    : visibleCount > 0
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
        fontSize: BODY_FONT,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        letterSpacing: "-0.3px",
      }}
    >
      {TYPE_CHARS.slice(0, visibleCount).map((phase, i) => {
        if (phase.char === " ") {
          return <span key={i} style={{ width: 8, opacity: phase.dark ? s.toFade.opacity : 1 }}>&nbsp;</span>;
        }
        if (phase.dark) {
          // "to" letters — dark, fade out after Write complete
          return (
            <span
              key={i}
              style={{
                color: TEXT_DARK,
                opacity: s.toFade.opacity,
              }}
            >
              {phase.char}
            </span>
          );
        }
        // "Write" letters — gradient
        const gi = i - 3; // index into WRITE_GRADIENT (0-4)
        const c = WRITE_GRADIENT[gi] || [0x7b, 0x5b, 0xd0];
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
          height: BODY_FONT * 0.85,
          backgroundColor: TEXT_DARK,
          marginLeft: 2,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};

// ===========================================================================
// Phase 5: "Write emails" with gradient pill (frames 120-155)
//
// Reference at 4.5s: "Write" dark + "emails" in gradient pill (pink→purple→blue).
// At 5.0s: both dark, pill gone. Large text.
// ===========================================================================
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();

  const s = useGsapProxy(
    (tl, p) => {
      // "Write" SLIDES IN from below — translateY 30→0, additive to existing text
      tl.fromTo(
        p.write,
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" },
        0,
      );
      // Pill bounces in
      tl.fromTo(
        p.pill,
        { x: 25, y: 6, scale: 0.85, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.4,
          ease: "back.out(1.7)",
        },
        0.08,
      );
      // Pill fades → dark text
      tl.to(
        p.pill,
        { opacity: 0, duration: 0.2, ease: "power1.out" },
        0.75,
      );
      tl.fromTo(
        p.emailsDark,
        { opacity: 0 },
        { opacity: 1, duration: 0.2, ease: "power1.out" },
        0.75,
      );
    },
    {
      write: { y: 30, opacity: 0 },
      pill: { x: 25, y: 6, scale: 0.85, opacity: 0 },
      emailsDark: { opacity: 0 },
    },
  );

  const gradAngle = 90 + noise2D("pill-angle", frame * 0.02, 0) * 3;
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
        gap: Math.round(8 * S),
        letterSpacing: "-0.3px",
      }}
    >
      <span
        style={{
          fontSize: BODY_FONT,
          color: "#111111",
          opacity: s.write.opacity,
          transform: `translateY(${s.write.y}px)`,
        }}
      >
        Write
      </span>
      {/* emails — pill and dark text stacked */}
      <span style={{ position: "relative", display: "inline-block" }}>
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
              padding: `${Math.round(6 * S)}px ${Math.round(14 * S)}px`,
              borderRadius: Math.round(5 * S),
              color: "#FFFFFF",
              fontSize: BODY_FONT,
              fontWeight: 400,
              lineHeight: 1.2,
            }}
          >
            emails
          </span>
        </span>
        {/* Dark text version — overlaps pill position */}
        <span
          style={{
            position: "absolute",
            left: Math.round(14 * S),
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: BODY_FONT,
            opacity: s.emailsDark.opacity,
            color: TEXT_DARK,
          }}
        >
          emails
        </span>
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 6: Letter scatter exit (frames 155-180)
//
// Reference at 5.5s: letters of "Write emails" scattered visibly — "W" upper-left,
// "t" lower, "a" upper-right, "s" far right. Letters are LARGE, clearly readable.
// Gentle scatter, no extreme rotation or scale-down.
// ===========================================================================
const SCATTER_TEXT = "Write\u00A0emails";
const SCATTER_LETTERS = SCATTER_TEXT.split("");

const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  W: Math.round(38 * S),
  r: Math.round(18 * S),
  i: Math.round(11 * S),
  t: Math.round(15 * S),
  e: Math.round(23 * S),
  "\u00A0": Math.round(12 * S),
  m: Math.round(36 * S),
  a: Math.round(23 * S),
  l: Math.round(11 * S),
  s: Math.round(20 * S),
};

const PhaseLetterScatter: React.FC = () => {
  const charWidths = SCATTER_LETTERS.map(
    (ch) => SCATTER_CHAR_WIDTHS[ch] || Math.round(17 * S),
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

  // Scatter targets: reference at 5.5s shows dramatic spread
  // W upper-left, r left, i/t drop down, e/m near center, a upper-right, s far right
  const scatterTargets = [
    { dx: -220, dy: -100, rot: -4 },   // W — upper-left big move
    { dx: -160, dy: 20, rot: 2 },      // r — left
    { dx: -40, dy: 15, rot: -1 },      // i
    { dx: -80, dy: 90, rot: 3 },       // t — drops down
    { dx: 10, dy: 10, rot: -1 },       // e
    { dx: 0, dy: 0, rot: 0 },          // space
    { dx: 10, dy: 15, rot: 1 },        // e
    { dx: 40, dy: 10, rot: -2 },       // m
    { dx: 90, dy: -80, rot: 2 },       // a — rises up-right
    { dx: 100, dy: 12, rot: -3 },      // i
    { dx: 130, dy: 15, rot: 1 },       // l
    { dx: 200, dy: -30, rot: -2 },     // s — far right
  ];

  const s = useGsapProxy(
    (tl, p) => {
      SCATTER_LETTERS.forEach((_, i) => {
        const target = scatterTargets[i] || { dx: 0, dy: 0, rot: 0 };
        // Quick scatter out with tiny stagger
        tl.to(
          p[`l${i}`],
          {
            x: target.dx,
            y: target.dy,
            rotation: target.rot,
            duration: 0.5,
            ease: "power2.out",
          },
          i * 0.015,
        );
        // Fade out toward end of phase
        tl.to(
          p[`l${i}`],
          { opacity: 0, duration: 0.25, ease: "power1.out" },
          0.5 + i * 0.01,
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
              fontSize: BODY_FONT,
              fontWeight: 400,
              color: TEXT_DARK,
              opacity: l.opacity,
              letterSpacing: "-0.3px",
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
// Phase 7: "Solve problems" — letters at VARYING SIZES, scattered (frames 180-210)
//
// Reference at 6.0s: every letter at a unique (x,y) with DIFFERENT SIZE.
// "S" large upper-left, "o" "v" "e" spread mid, "b" floating high,
// "p" "l" bottom, "m" lower-right. ALL visible immediately.
// At 6.5s: all converged to centered "Solve problems" in uniform size.
// ===========================================================================
const SOLVE_TEXT = "Solve\u00A0problems";
const SOLVE_LETTERS = SOLVE_TEXT.split("");

// Positions at 1280x720, matching reference proportions
const SOLVE_SCATTER: Array<{ x: number; y: number; size: number }> = [
  { x: 280, y: 240, size: Math.round(86 * S) },   // S — large, left
  { x: 440, y: 270, size: Math.round(44 * S) },   // o
  { x: 360, y: 410, size: Math.round(32 * S) },   // l — bottom-left
  { x: 540, y: 230, size: Math.round(46 * S) },   // v
  { x: 660, y: 260, size: Math.round(42 * S) },   // e
  { x: 0, y: 0, size: BODY_FONT },                 // (space)
  { x: 500, y: 400, size: Math.round(34 * S) },   // p — below center
  { x: 720, y: 238, size: Math.round(40 * S) },   // r
  { x: 800, y: 270, size: Math.round(48 * S) },   // o — right side
  { x: 580, y: 175, size: Math.round(56 * S) },   // b — floating high
  { x: 460, y: 440, size: Math.round(30 * S) },   // l — bottom
  { x: 860, y: 252, size: Math.round(44 * S) },   // e — far right
  { x: 920, y: 385, size: Math.round(42 * S) },   // m — far right, low
  { x: 970, y: 290, size: Math.round(38 * S) },   // s — furthest right
];

const SOLVE_FINAL_SIZE = BODY_FONT;
const SOLVE_CHAR_WIDTHS = [
  Math.round(31 * S), Math.round(27 * S), Math.round(14 * S),
  Math.round(27 * S), Math.round(25 * S), Math.round(14 * S),
  Math.round(27 * S), Math.round(17 * S), Math.round(27 * S),
  Math.round(27 * S), Math.round(14 * S), Math.round(25 * S),
  Math.round(36 * S), Math.round(19 * S),
];
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
  // Axis-locked convergence: each letter moves ONE axis at a time
  // Segment 1: X (0.15s) → pause 0.08s → Segment 2: Y (0.12s) → pause 0.06s → Segment 3: X final (0.1s)
  // Staggered 3-5 frames per letter
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < SOLVE_LETTERS.length; i++) {
      const sc = SOLVE_SCATTER[i];
      init[`l${i}`] = {
        x: sc.x || SOLVE_FINAL_X[i],
        y: sc.y || SOLVE_FINAL_Y,
        size: sc.size,
        opacity: 1, // VISIBLE from frame 0 — no fade-in
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      SOLVE_LETTERS.forEach((ch, i) => {
        if (ch === "\u00A0") return;
        // All converge quickly — must settle by 0.4s so f_6.5s shows settled text
        // Tiny stagger per letter, fast convergence
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: SOLVE_FINAL_Y,
            size: SOLVE_FINAL_SIZE,
            duration: 0.28,
            ease: "power2.out",
          },
          0.08 + i * 0.008,
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
              letterSpacing: "-0.3px",
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
// Phase 8: "Brainstorm ideas" — floating word cloud (frames 210-258)
//
// Reference at 7.0s: blurred copies of "Brainstorm" and "ideas" at varying
// sizes, colors (purple/blue/pink), blur levels, creating depth.
// Center has dark convergence blob.
// At 7.5s: converging inward. At 8.0s: "Brainstorm ideas" centered with
// some faded remnants still visible.
// ===========================================================================
// Gentle floating word cloud — words at various positions with depth-of-field blur.
// NOT a camera fly-through. Words drift inward and fade as final text emerges.
const FLOATERS: Array<{
  word: string;
  x: number; y: number; // offset from center
  color: string;
  size: number;
  blur: number;
  weight: number;
}> = [
  // Reference f_7s/7.5s: scattered "Brainstorm" and "ideas" copies
  { word: "ideas", x: -380, y: -100, color: "#7080D8", size: Math.round(32 * S), blur: 1, weight: 700 },
  { word: "Brainstorm", x: 80, y: -80, color: "#7B6BD0", size: Math.round(24 * S), blur: 2, weight: 500 },
  { word: "ideas", x: 280, y: -90, color: "#C06888", size: Math.round(20 * S), blur: 3, weight: 400 },
  { word: "ideas", x: -60, y: 30, color: "#5B6FD7", size: Math.round(36 * S), blur: 0, weight: 700 },
  { word: "Brainstorm", x: 200, y: 60, color: "#B06898", size: Math.round(28 * S), blur: 1, weight: 500 },
  { word: "brainstorm", x: -60, y: 120, color: "#8888B8", size: Math.round(18 * S), blur: 2, weight: 400 },
  { word: "Brainstorm", x: -350, y: 140, color: "#6878D8", size: Math.round(22 * S), blur: 3, weight: 400 },
  { word: "ideas", x: 320, y: 100, color: "#9B70C0", size: Math.round(16 * S), blur: 4, weight: 400 },
];

const PhaseBrainstormIdeas: React.FC = () => {
  const frame = useCurrentFrame();
  const totalFrames = 258 - P8_FROM; // 48 frames = 1.6s

  // Floaters drift inward and fade over the phase
  const convergence = interpolate(frame, [0, totalFrames * 0.7], [0, 1], clamp);
  const floaterFade = interpolate(frame, [totalFrames * 0.3, totalFrames * 0.7], [0.6, 0], clamp);

  // Final text fades in during second half — DARK text
  const finalOpacity = interpolate(frame, [totalFrames * 0.35, totalFrames * 0.6], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {FLOATERS.map((f, i) => {
        // Drift toward center
        const x = f.x * (1 - convergence * 0.6);
        const y = f.y * (1 - convergence * 0.6);
        // Gentle float
        const floatX = noise2D(`bfx${i}`, frame * 0.015, i) * 8;
        const floatY = noise2D(`bfy${i}`, i, frame * 0.012) * 6;
        const blurPx = Math.max(0, f.blur - convergence * 2);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${0.49 * H}px`,
              left: "50%",
              transform: `translate(calc(-50% + ${x + floatX}px), calc(-50% + ${y + floatY}px))`,
              fontFamily,
              fontSize: f.size,
              fontWeight: f.weight,
              color: f.color,
              whiteSpace: "nowrap",
              opacity: floaterFade,
              filter: blurPx > 0.5 ? `blur(${Math.round(blurPx)}px)` : undefined,
            }}
          >
            {f.word}
          </div>
        );
      })}

      {/* Final centered "Brainstorm ideas" — DARK text, matching reference at 8.0s */}
      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily,
          fontSize: BODY_FONT,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          opacity: finalOpacity,
          letterSpacing: "-0.3px",
        }}
      >
        Brainstorm ideas
      </div>
    </AbsoluteFill>
  );
};

// --- Frame Timings (CORRECTED to match reference frame-by-frame) -----------
const P1_FROM = 0;    // 0.0s — "You've"
const P2_FROM = 8;    // 0.27s — "been" + scatter
const P3_FROM = 72;   // 2.4s — "Bard" (short: ~10 frames)
const P4_FROM = 82;   // 2.73s — Typewriter "to Write"
const P5_FROM = 120;  // 4.0s — "Write emails" pill
const P6_FROM = 155;  // 5.17s — Letter scatter
const P7_FROM = 180;  // 6.0s — "Solve problems" scattered
const P8_FROM = 210;  // 7.0s — "Brainstorm ideas" cloud

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      {/* P1: "You've" alone — frames 0-11 (overlaps briefly with P2) */}
      <Sequence from={P1_FROM} durationInFrames={P2_FROM + 4}>
        <PhaseYouve />
      </Sequence>

      {/* P2: "You've been experimenting with" */}
      <Sequence from={P2_FROM} durationInFrames={P3_FROM - P2_FROM}>
        <PhaseExperimenting />
      </Sequence>

      {/* P3: "Bard" — short, ~10 frames */}
      <Sequence from={P3_FROM} durationInFrames={P4_FROM - P3_FROM}>
        <PhaseBard />
      </Sequence>

      {/* P4: Typewriter "to Write" — extends 3 frames into P5 for overlap */}
      <Sequence from={P4_FROM} durationInFrames={P5_FROM - P4_FROM + 3}>
        <PhaseTypewriter />
      </Sequence>

      {/* P5: "Write emails" pill → dark */}
      <Sequence from={P5_FROM} durationInFrames={P6_FROM - P5_FROM}>
        <PhaseWriteEmails />
      </Sequence>

      {/* P6: Letter scatter exit */}
      <Sequence from={P6_FROM} durationInFrames={P7_FROM - P6_FROM}>
        <PhaseLetterScatter />
      </Sequence>

      {/* P7: "Solve problems" scattered → settled */}
      <Sequence from={P7_FROM} durationInFrames={P8_FROM - P7_FROM}>
        <PhaseSolveProblems />
      </Sequence>

      {/* P8: "Brainstorm ideas" cloud → settled */}
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
