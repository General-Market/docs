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
          radial-gradient(ellipse 140% 120% at ${x1}% ${y1}%, hsla(${225 + hueShift}, 40%, 91%, 0.7), transparent 60%),
          radial-gradient(ellipse 90% 100% at ${x2}% ${y2}%, hsla(${340 + hueShift}, 28%, 93%, 0.5), transparent 55%),
          radial-gradient(ellipse 80% 60% at ${x3}% ${y3}%, hsla(${275 + hueShift}, 22%, 94%, 0.35), transparent 50%),
          linear-gradient(135deg, #F2EFF7 0%, #FBFBFB 45%, #F7F3F0 100%)
        `,
      }}
    />
  );
};

// Font sizes: reference at 960 uses ~50px body text, ~105px for "Bard"
// At 1280 that scales to ~67px body, ~140px for "Bard"
const BODY_FONT = Math.round(50 * S); // 67
const BARD_FONT = Math.round(105 * S); // 140

// ===========================================================================
// Phase 1: "You've"  (frames 0-8)
// Visible at opacity 1 from frame 0. Centered. Gentle drift.
// ===========================================================================
const PhaseYouve: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.main,
        { x: 15, opacity: 1 },
        { x: 0, opacity: 1, duration: 0.4, ease: "power1.out" },
      );
    },
    { main: { x: 15, opacity: 1 } },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.493 * H}px`,
        left: `${0.52 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%)`,
        fontFamily,
        fontSize: BODY_FONT,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        opacity: s.main.opacity,
        letterSpacing: "-0.5px",
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
// Reference at 1.0s shows DRAMATIC vertical spread — letters scattered
// from well below baseline to well above.
const EXP_SCATTER_Y = [
  55, 42, 28, 16, 5, -6, -18, -30, -42, -52, -60, -68, -76,
];
const EXP_SCATTER_X = [
  -28, -20, -14, -7, 0, 6, 12, 17, 22, 26, 29, 32, 35,
];

// Wave amplitude for settled letters — dramatic roller-coaster displacement
const EXP_WAVE_AMP = 40; // 30-50px range, use 40 as strong midpoint
const EXP_WAVE_SPEED = 0.12; // frames per cycle unit
const EXP_WAVE_SPREAD = 0.55; // phase offset per letter

const EXP_START_SIZE = Math.round(58 * S); // ~77 scattered
const EXP_END_SIZE = BODY_FONT; // 60 settled

const PhaseExperimenting: React.FC = () => {
  const frame = useCurrentFrame();
  // Compute per-letter wave Y offset — dramatic roller-coaster sine wave
  // Wave grows in strength as letters settle (scatter → settled)
  const waveYOffsets = useMemo(() => new Array(EXP_LETTERS.length).fill(0), []);
  for (let i = 0; i < EXP_LETTERS.length; i++) {
    // Wave phase = time-based + letter-offset
    const wavePhase = frame * EXP_WAVE_SPEED + i * EXP_WAVE_SPREAD;
    waveYOffsets[i] = Math.sin(wavePhase) * EXP_WAVE_AMP;
  }

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      youve: { opacity: 1 },
      been: { opacity: 0 },
      with_: { opacity: 0 },
      phraseX: { v: 0 },
    };
    for (let i = 0; i < EXP_LETTERS.length; i++) {
      init[`l${i}`] = {
        x: EXP_SCATTER_X[i] * 3.0,
        y: EXP_SCATTER_Y[i] * 1.2,
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
      tl.to(
        p.been,
        { opacity: 1, duration: 0.18, ease: "power1.out" },
        0.0,
      );

      // "experimenting" letters scatter-in starting ~0.4s into phase
      for (let i = 0; i < EXP_LETTERS.length; i++) {
        tl.to(
          p[`l${i}`],
          {
            opacity: 1,
            duration: 0.12,
            ease: "power1.out",
          },
          0.4 + i * 0.02,
        );
        // Letters settle: 1.2s duration — scatter LINGERS visibly
        tl.to(
          p[`l${i}`],
          {
            x: 0,
            y: 0,
            size: EXP_END_SIZE,
            purple: 0,
            duration: 1.2,
            ease: "power2.out",
          },
          0.5 + i * 0.025,
        );
      }

      // "with" appears later (~0.9s into phase)
      tl.to(
        p.with_,
        { opacity: 1, duration: 0.2, ease: "power1.out" },
        0.9,
      );

      // Phrase shifts left as it expands
      tl.to(
        p.phraseX,
        { v: -70, duration: 1.4, ease: "power1.out" },
        0.3,
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
        gap: Math.round(10 * S),
        letterSpacing: "-0.3px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: BODY_FONT,
          opacity: s.youve.opacity,
        }}
      >
        You{"\u2019"}ve
      </span>
      <span
        style={{
          display: "inline-block",
          fontSize: BODY_FONT,
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
                transform: `translate(${l.x}px, ${l.y + waveYOffsets[i] * (1 - pr)}px)`,
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
          fontSize: BODY_FONT,
          opacity: s.with_.opacity,
        }}
      >
        with
      </span>
    </div>
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

  // Deep saturated purple→blue gradient per letter
  const BARD_COLORS: Array<[number, number, number]> = [
    [130, 60, 200], // B — vivid purple
    [110, 70, 210], // a — purple-blue
    [85, 85, 220],  // r — blue
    [65, 100, 235], // d — bright blue
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
      // "to" fades out AFTER Write is well underway (no deletion, clean progression)
      tl.to(
        p.toFade,
        { opacity: 0, duration: 0.25, ease: "power1.out" },
        0.80,
      );
      tl.to(p[`c2`], { visible: 1, duration: 0.001 }, 0.30); // space
      // Type "Write" — slower. Reference: "W" at 3.5s (0.77s), "Write" at 4.0s (1.27s)
      tl.to(p[`c3`], { visible: 1, duration: 0.001 }, 0.55); // W
      tl.to(p[`c4`], { visible: 1, duration: 0.001 }, 0.72); // r
      tl.to(p[`c5`], { visible: 1, duration: 0.001 }, 0.86); // i
      tl.to(p[`c6`], { visible: 1, duration: 0.001 }, 0.98); // t
      tl.to(p[`c7`], { visible: 1, duration: 0.001 }, 1.08); // e
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
      // "Write" appears
      tl.fromTo(
        p.write,
        { y: 6, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.25, ease: "power2.out" },
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
      write: { y: 6, opacity: 0 },
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

  // Scatter targets matching reference at 5.5s — visible, spread pattern
  const scatterTargets = [
    { dx: -180, dy: -80, rot: -3 },  // W — upper-left (big move)
    { dx: -30, dy: 25, rot: 2 },     // r
    { dx: 15, dy: 18, rot: -1 },     // i
    { dx: -50, dy: 80, rot: 3 },     // t — drops down
    { dx: 8, dy: 15, rot: -1 },      // e
    { dx: 0, dy: 0, rot: 0 },        // space
    { dx: 8, dy: 18, rot: 1 },       // e
    { dx: 30, dy: 12, rot: -2 },     // m
    { dx: 55, dy: -50, rot: 2 },     // a — rises up
    { dx: 80, dy: 15, rot: -3 },     // i
    { dx: 120, dy: 15, rot: 1 },     // l
    { dx: 170, dy: -20, rot: -2 },   // s — far right
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
            scale: 1,
            opacity: 1,
            duration: 0.65,
            ease: "power2.out",
          },
          i * 0.012,
        );
        tl.to(
          p[`l${i}`],
          {
            opacity: 0,
            duration: 0.3,
            ease: "power1.out",
          },
          0.6 + i * 0.008,
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
  // Snake movement: each letter moves in axis-locked segments
  // X→pause→Y→pause→X, staggered start per letter (3-5 frame offset)
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
        // All letters converge simultaneously with tiny stagger
        // Total time: 0.15s delay + 0.30s duration = settles by 0.45s
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: SOLVE_FINAL_Y,
            size: SOLVE_FINAL_SIZE,
            duration: 0.30,
            ease: "power2.out",
          },
          0.15 + i * 0.005,
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
// Asteroid field: each floater has a Z-depth. Camera flies forward through Z.
// Near words (low Z) blur and fly past edges. Far words (high Z) sharpen as we approach.
const FLOATERS: Array<{
  word: string;
  x: number;  // offset from center in px
  y: number;
  z: number;  // depth: 0 = camera plane, positive = further away
  color: string;
  baseSize: number;
  weight: number;
}> = [
  // Near field — will fly past quickly, blur out
  { word: "Brainstorm", x: -280, y: 140, z: 0.15, color: "#4B6FD7", baseSize: Math.round(90 * S), weight: 500 },
  { word: "ideas", x: 320, y: -80, z: 0.2, color: "#C86090", baseSize: Math.round(70 * S), weight: 500 },
  { word: "ideas", x: -400, y: -40, z: 0.25, color: "#9B9BB8", baseSize: Math.round(55 * S), weight: 400 },
  // Mid field
  { word: "Brainstorm", x: 180, y: 100, z: 0.45, color: "#7B6BD0", baseSize: Math.round(50 * S), weight: 400 },
  { word: "ideas", x: -150, y: -120, z: 0.5, color: "#6878E0", baseSize: Math.round(48 * S), weight: 500 },
  { word: "brainstorm", x: 80, y: 180, z: 0.55, color: "#B070A0", baseSize: Math.round(44 * S), weight: 400 },
  // Far field — the destination. "Brainstorm ideas" sharpens as we fly toward it
  { word: "Brainstorm", x: -40, y: -30, z: 0.8, color: "#5B6FD7", baseSize: Math.round(42 * S), weight: 500 },
  { word: "ideas", x: 60, y: 20, z: 0.82, color: "#7080D0", baseSize: Math.round(40 * S), weight: 500 },
  { word: "Brainstorm", x: -200, y: 200, z: 0.35, color: "#8888B0", baseSize: Math.round(36 * S), weight: 400 },
  { word: "ideas", x: 260, y: -160, z: 0.3, color: "#9B6FBF", baseSize: Math.round(38 * S), weight: 400 },
];

const PhaseBrainstormIdeas: React.FC = () => {
  const frame = useCurrentFrame();
  const totalFrames = 258 - P8_FROM; // 48 frames = 1.6s
  // Camera Z progress: 0 → 1 over the phase. Eases in for acceleration feel.
  const zProgress = interpolate(frame, [0, totalFrames], [0, 1], clamp);
  // Accelerating camera — slow start, fast end
  const cameraZ = zProgress * zProgress * 1.2;

  // Final text fades in during last 30% of the phase
  const finalOpacity = interpolate(frame, [totalFrames * 0.55, totalFrames * 0.75], [0, 1], clamp);
  const finalScale = interpolate(frame, [totalFrames * 0.55, totalFrames * 0.75], [0.92, 1], clamp);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Dark convergence blob — destination point */}
      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: Math.round(180 * S),
          height: Math.round(60 * S),
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(30,25,50,0.6) 0%, rgba(30,25,50,0.2) 40%, transparent 70%)",
          filter: `blur(${Math.round(18 * S)}px)`,
          opacity: interpolate(cameraZ, [0, 0.6], [0.5, 0], clamp),
        }}
      />

      {FLOATERS.map((f, i) => {
        // Apparent depth = f.z - cameraZ. When negative, word is BEHIND camera.
        const apparentDepth = f.z - cameraZ;

        // If behind camera, don't render
        if (apparentDepth < -0.05) return null;

        // Perspective projection: closer = larger & more offset from center
        const depthFactor = apparentDepth <= 0.01 ? 30 : 1 / Math.max(0.02, apparentDepth);
        const projectedScale = Math.min(depthFactor, 12); // cap to avoid infinity

        // Position flies outward as words pass camera (parallax)
        const projX = f.x * projectedScale * 0.4;
        const projY = f.y * projectedScale * 0.4;

        // Blur: near words blur heavily (flew past), far words stay sharp
        // Words at camera plane (apparentDepth ~0) get max blur
        const blurAmount = apparentDepth < 0.15
          ? interpolate(apparentDepth, [-0.05, 0.15], [18, 8], clamp)
          : apparentDepth > 0.6
            ? interpolate(apparentDepth, [0.6, 1.0], [0, 2], clamp)
            : interpolate(apparentDepth, [0.15, 0.6], [8, 0], clamp);

        // Opacity: fade out when very close (flew past), visible in mid-far field
        const opacity = apparentDepth < 0.08
          ? interpolate(apparentDepth, [-0.05, 0.08], [0, 0.7], clamp)
          : apparentDepth < 0.3
            ? interpolate(apparentDepth, [0.08, 0.3], [0.7, 0.9], clamp)
            : 0.85;

        const renderedSize = f.baseSize * Math.min(projectedScale * 0.6, 4);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `${0.49 * H}px`,
              left: "50%",
              transform: `translate(calc(-50% + ${projX}px), calc(-50% + ${projY}px))`,
              fontFamily,
              fontSize: renderedSize,
              fontWeight: f.weight,
              color: f.color,
              whiteSpace: "nowrap",
              opacity,
              filter: blurAmount > 0.5 ? `blur(${Math.round(blurAmount)}px)` : undefined,
            }}
          >
            {f.word}
          </div>
        );
      })}

      {/* Final centered "Brainstorm ideas" — emerges as camera reaches destination */}
      <div
        style={{
          position: "absolute",
          top: `${0.49 * H}px`,
          left: "50%",
          transform: `translate(-50%, -50%) scale(${finalScale})`,
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
