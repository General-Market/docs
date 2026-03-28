/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * Kinetic typography on soft pastel background.
 * Sequence: "You've" -> "been experimenting with" -> "Bard" (gradient) ->
 * typewriter "Write" -> "emails" (gradient pill) -> letter scatter ->
 * "Solve problems" (assemble) -> "Brainstorm ideas" (floating words converge)
 *
 * GSAP REWRITE v3: Pure proxy-object animation. GSAP computes values,
 * React renders them as inline styles. Deterministic per-frame output.
 *
 * Easings from tracking data: power1.out, power2.out, expo.out, back.out(1.7).
 *
 * 1280x720, 29fps, 258 frames (~8.9s)
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

const _FPS = 29;
const W = 1280;
const H = 720;

// --- Palette ---------------------------------------------------------------
const BG_BASE = "#EDEEF4";
const TEXT_DARK = "#1A1A2E";
const TEXT_SIZE = 34;
const BARD_SIZE = 58;
const FONT_WEIGHT = 400;
const CENTER_Y = "53%";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// ===========================================================================
// GSAP Proxy Engine
// Build a timeline that tweens plain objects. Seek to frame time. Read values.
// ===========================================================================
type ProxyState = Record<string, number>;

function useGsapProxy(
  buildTimeline: (tl: gsap.core.Timeline, proxies: Record<string, ProxyState>) => void,
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

// --- Background (CSS-only, no GSAP needed) ---------------------------------
const PastelBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 258], [0, 28], clamp);

  const x1 = 32 + noise2D("bg1x", frame * 0.008, 0) * 18;
  const y1 = 28 + noise2D("bg1y", 0, frame * 0.006) * 12;
  const x2 = 74 + noise2D("bg2x", frame * 0.007, 1.5) * 14;
  const y2 = 24 + noise2D("bg2y", 1.5, frame * 0.009) * 10;
  const x3 = 50 + noise2D("bg3x", frame * 0.005, 3.0) * 10;
  const y3 = 55 + noise2D("bg3y", 3.0, frame * 0.004) * 8;

  const roseIntensity = interpolate(frame, [120, 200], [0.6, 0.75], clamp);

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 90% 70% at ${x1}% ${y1}%, hsla(${222 + hueShift}, 45%, 90%, 0.85), transparent),
          radial-gradient(ellipse 70% 55% at ${x2}% ${y2}%, hsla(${330 + hueShift}, 32%, 91%, ${roseIntensity}), transparent),
          radial-gradient(ellipse 100% 80% at ${x3}% ${y3}%, hsla(${268 + hueShift}, 20%, 93%, 0.4), transparent),
          ${BG_BASE}
        `,
      }}
    />
  );
};

// --- Shared center style ---------------------------------------------------
const centerStyle: React.CSSProperties = {
  position: "absolute",
  top: CENTER_Y,
  left: "50%",
  transform: "translate(-50%, -50%)",
  fontFamily,
  fontSize: TEXT_SIZE,
  fontWeight: FONT_WEIGHT,
  color: TEXT_DARK,
  whiteSpace: "nowrap",
};

// ===========================================================================
// Phase 1: "You've"
// Tracking: x: 31 -> 0, opacity: 0 -> 1, dur 0.19s, ease power1.out
// ===========================================================================
const P1_FROM = 0;
const PhaseYouve: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(p.main, { x: 31, opacity: 0 }, { x: 0, opacity: 1, duration: 0.19, ease: "power1.out" });
    },
    { main: { x: 31, opacity: 0 } },
  );

  return (
    <div
      style={{
        ...centerStyle,
        opacity: s.main.opacity,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%)`,
      }}
    >
      You{"\u2019"}ve
    </div>
  );
};

// ===========================================================================
// Phase 2: "You've been experimenting with"
// Words slide in. "experimenting" has per-letter settle from slight displacement.
// Purple tint fades to dark as letters land.
// ===========================================================================
const P2_FROM = 15;

const EXP_LETTERS = "experimenting".split("");
const EXP_SETTLE_Y = [-12, 8, -10, 14, -8, 11, -15, 9, -11, 13, -9, 10, -13];
const EXP_SETTLE_X = [1, -2, 0, 1, -1, 2, -1, 0, 1, -2, 0, 1, -1];

const PhaseExperimenting: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      youve: { x: 40, opacity: 0 },
      been: { x: 60, opacity: 0 },
      with_: { scale: 0.81, opacity: 0 },
    };
    for (let i = 0; i < EXP_LETTERS.length; i++) {
      init[`l${i}`] = {
        x: EXP_SETTLE_X[i] || 0,
        y: EXP_SETTLE_Y[i] || 0,
        opacity: 0,
        purple: 0.7,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      tl.to(p.youve, { x: 0, opacity: 1, duration: 0.41, ease: "power1.out" }, 0);
      tl.to(p.been, { x: 0, opacity: 1, duration: 0.41, ease: "power1.out" }, 0.1);

      for (let i = 0; i < EXP_LETTERS.length; i++) {
        tl.to(
          p[`l${i}`],
          { x: 0, y: 0, opacity: 1, purple: 0, duration: 0.48, ease: "power2.out" },
          0.21 + i * 0.04,
        );
      }

      tl.to(p.with_, { scale: 1, opacity: 1, duration: 0.19, ease: "power1.out" }, 0.55);
    },
    proxyInit,
  );

  return (
    <div style={{ ...centerStyle, display: "flex", gap: 14 }}>
      <span style={{ display: "inline-block", opacity: s.youve.opacity, transform: `translateX(${s.youve.x}px)` }}>
        You{"\u2019"}ve
      </span>
      <span style={{ display: "inline-block", opacity: s.been.opacity, transform: `translateX(${s.been.x}px)` }}>
        been
      </span>
      <span style={{ display: "inline-flex" }}>
        {EXP_LETTERS.map((ch, i) => {
          const l = s[`l${i}`];
          // Blend from purple (#5B4FD0) to dark (#1A1A2E) based on purple value
          const pr = Math.max(0, Math.min(1, l.purple));
          const r = Math.round(0x5b * pr + 0x1a * (1 - pr));
          const g = Math.round(0x4f * pr + 0x1a * (1 - pr));
          const b = Math.round(0xd0 * pr + 0x2e * (1 - pr));
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: l.opacity,
                transform: `translate(${l.x}px, ${l.y}px)`,
                color: `rgb(${r}, ${g}, ${b})`,
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
          opacity: s.with_.opacity,
          transform: `scale(${s.with_.scale})`,
        }}
      >
        with
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 3: "Bard" with gradient text
// Tracking: x:8->0, opacity:0->1, scale 0.88->1, dur 0.48s, power2.out
// ===========================================================================
const P3_FROM = 51;
const PhaseBardFull: React.FC = () => {
  const frame = useCurrentFrame();

  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.main,
        { x: 8, opacity: 0, scale: 0.88 },
        { x: 0, opacity: 1, scale: 1, duration: 0.48, ease: "power2.out" },
      );
    },
    { main: { x: 8, opacity: 0, scale: 0.88 } },
  );

  const baseAngle = interpolate(frame, [0, 29], [100, 210], clamp);
  const noiseAngle = noise2D("bard-angle", frame * 0.015, 0) * 8;
  const gradAngle = baseAngle + noiseAngle;
  const gradient = `linear-gradient(${gradAngle}deg, #E85070, #D03888, #9538B8, #6248D0)`;

  return (
    <div
      style={{
        ...centerStyle,
        fontSize: BARD_SIZE,
        opacity: s.main.opacity,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%) scale(${s.main.scale})`,
        background: gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        letterSpacing: "-0.5px",
      }}
    >
      Bard
    </div>
  );
};

// ===========================================================================
// Phase 4: Typewriter "Write" + cursor
// Letters revealed sequentially. Cursor blinks then fades.
// ===========================================================================
const P4_FROM = 86;
const WRITE_CHARS = "Write".split("");

const PhaseTypewriter: React.FC = () => {
  const frame = useCurrentFrame();

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      cursor: { opacity: 1 },
    };
    for (let i = 0; i < WRITE_CHARS.length; i++) {
      init[`c${i}`] = { visible: 0 };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      for (let i = 0; i < WRITE_CHARS.length; i++) {
        tl.to(p[`c${i}`], { visible: 1, duration: 0.001, ease: "none" }, 0.07 + i * 0.1);
      }
      tl.to(p.cursor, { opacity: 0, duration: 0.15, ease: "power1.out" }, 0.6);
    },
    proxyInit,
  );

  const gradAngle = interpolate(frame, [0, 36], [140, 240], clamp);
  const typeGrad = `linear-gradient(${gradAngle}deg, #7048C0, #A04090, #C84070)`;

  // Count visible chars
  let visibleCount = 0;
  for (let i = 0; i < WRITE_CHARS.length; i++) {
    if (s[`c${i}`].visible > 0.5) visibleCount = i + 1;
  }
  const partial = "Write".slice(0, visibleCount);

  // Cursor: blinks before typing, solid during, fades after
  const isTyping = visibleCount > 0 && visibleCount < WRITE_CHARS.length;
  const isDone = visibleCount >= WRITE_CHARS.length;
  const blinkOn = Math.floor(frame / 5) % 2 === 0;
  const cursorOpacity = isDone ? s.cursor.opacity : isTyping ? 1 : blinkOn ? 1 : 0;

  return (
    <div style={{ ...centerStyle, display: "flex", alignItems: "center" }}>
      {partial.length > 0 && (
        <span
          style={{
            background: typeGrad,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {partial}
        </span>
      )}
      <span
        style={{
          display: "inline-block",
          width: 2,
          height: TEXT_SIZE * 0.82,
          backgroundColor: TEXT_DARK,
          marginLeft: 2,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};

// ===========================================================================
// Phase 5: "Write emails" with gradient pill
// "Write" fades in, "emails" pill slides in from angle 44.2deg with back.out
// ===========================================================================
const P5_FROM = 123;
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();
  const pillRad = (44.2 * Math.PI) / 180;
  const pillStartX = Math.cos(pillRad) * 40;
  const pillStartY = Math.sin(pillRad) * 12;

  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(p.write, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, ease: "power2.out" }, 0);
      tl.fromTo(
        p.pill,
        { x: pillStartX, y: pillStartY, scale: 0.85, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: 0.41, ease: "back.out(1.7)" },
        0.14,
      );
    },
    {
      write: { y: 8, opacity: 0 },
      pill: { x: pillStartX, y: pillStartY, scale: 0.85, opacity: 0 },
    },
  );

  const gradAngle =
    interpolate(frame, [0, 34], [90, 220], clamp) +
    noise2D("pill-angle", frame * 0.02, 0) * 6;
  const pillGrad = `linear-gradient(${gradAngle}deg, #D04870, #A858B8, #6878E0)`;

  return (
    <div style={{ ...centerStyle, display: "flex", alignItems: "center", gap: 12 }}>
      <span
        style={{
          color: TEXT_DARK,
          opacity: s.write.opacity,
          transform: `translateY(${s.write.y}px)`,
        }}
      >
        Write
      </span>
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
            padding: "6px 10px",
            borderRadius: 3,
            color: "#FFFFFF",
            fontWeight: FONT_WEIGHT,
            lineHeight: 1.15,
          }}
        >
          emails
        </span>
      </span>
    </div>
  );
};

// ===========================================================================
// Phase 6: Letter scatter (exit transition)
// Letters of "Write emails" start at their inline positions and explode outward.
// Approximate character widths for initial x offsets.
// ===========================================================================
const SCATTER_ANGLES = [86.6, 44.2, 64.5, 23.5];
const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  W: 26, r: 12, i: 8, t: 10, e: 16, "\u00A0": 10, m: 24, a: 16, l: 8, s: 14,
};

const PhaseLetterScatter: React.FC<{ text: string }> = ({ text }) => {
  const letters = text.replace(/ /g, "\u00A0").split("");

  // Calculate starting x offsets (centered)
  const charWidths = letters.map((ch) => SCATTER_CHAR_WIDTHS[ch] || 14);
  const totalWidth = charWidths.reduce((a, b) => a + b, 0);
  const startXOffsets: number[] = [];
  let runX = -totalWidth / 2;
  for (let i = 0; i < letters.length; i++) {
    startXOffsets.push(runX + charWidths[i] / 2);
    runX += charWidths[i];
  }

  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < letters.length; i++) {
      init[`l${i}`] = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };
    }
    return init;
  }, [text]);

  const s = useGsapProxy(
    (tl, p) => {
      letters.forEach((_, i) => {
        const angle = SCATTER_ANGLES[i % 4] * (i % 2 === 0 ? 1 : -1);
        const rad = (angle * Math.PI) / 180;
        const dist = 280 + (i % 5) * 60;
        const gravityBias = 40 + (i % 4) * 25;

        tl.to(
          p[`l${i}`],
          {
            x: Math.cos(rad) * dist,
            y: Math.sin(rad) * (dist * 0.5) + gravityBias,
            rotation: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 10),
            scale: 0.3,
            opacity: 0,
            duration: 0.55,
            ease: "expo.out",
          },
          i * 0.012,
        );
      });
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
      {letters.map((ch, i) => {
        const l = s[`l${i}`];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${startXOffsets[i] + l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity: l.opacity,
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
// Phase 7: "Solve problems" — letters assemble from scattered positions
// Each char starts at a random scattered position and converges to its final
// inline position. Character widths approximate a proper layout.
// ===========================================================================
const SOLVE_SCATTER = [
  { x: -350, y: -120, size: 96 },  // S
  { x: -140, y: -40, size: 48 },   // o
  { x: -420, y: 100, size: 36 },   // l
  { x: 120, y: -100, size: 44 },   // v
  { x: -80, y: -30, size: 42 },    // e
  { x: 0, y: 0, size: 48 },        // (space)
  { x: -60, y: 60, size: 56 },     // p
  { x: -160, y: -20, size: 40 },   // r
  { x: 80, y: 40, size: 52 },      // o
  { x: 250, y: -80, size: 60 },    // b
  { x: 180, y: -30, size: 38 },    // l
  { x: 300, y: -40, size: 50 },    // e
  { x: 280, y: 80, size: 48 },     // m
  { x: 420, y: 20, size: 40 },     // s
];

const SOLVE_TEXT = "Solve\u00A0problems";
const SOLVE_LETTERS = SOLVE_TEXT.split("");
const SOLVE_CHAR_W = [20, 18, 9, 18, 16, 10, 18, 11, 18, 18, 9, 16, 24, 12];
const SOLVE_TOTAL_W = SOLVE_CHAR_W.reduce((a, b) => a + b, 0);

// Compute final x positions (centered)
const SOLVE_FINAL_X: number[] = [];
{
  let rx = -SOLVE_TOTAL_W / 2;
  for (let i = 0; i < SOLVE_LETTERS.length; i++) {
    SOLVE_FINAL_X.push(rx + SOLVE_CHAR_W[i] / 2);
    rx += SOLVE_CHAR_W[i];
  }
}

const P7_FROM = 171;
const PhaseSolveProblems: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < SOLVE_LETTERS.length; i++) {
      const scatter = SOLVE_SCATTER[i] || { x: 0, y: 0, size: 48 };
      init[`l${i}`] = {
        x: scatter.x,
        y: scatter.y,
        scale: scatter.size / TEXT_SIZE,
        opacity: 0,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      SOLVE_LETTERS.forEach((_, i) => {
        // Fade in while scattered
        tl.to(p[`l${i}`], { opacity: 1, duration: 0.14, ease: "power1.out" }, i * 0.01);
        // Converge to final position
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: 0,
            scale: 1,
            duration: 0.62,
            ease: i === 0 ? "expo.out" : "power2.out",
          },
          0.28 + i * 0.01,
        );
      });
    },
    proxyInit,
  );

  return (
    <AbsoluteFill>
      {SOLVE_LETTERS.map((ch, i) => {
        const l = s[`l${i}`];
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${l.x}px), calc(-50% + ${l.y}px)) scale(${l.scale})`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity: l.opacity,
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
// Phase 8: "Brainstorm ideas" — floating word field converges
// Ghost words appear scattered, converge to center, final text fades in
// ===========================================================================
const FLOATERS = [
  { word: "Brainstorm", x: -260, y: -90, color: "#D44E7A", size: 38, weight: 500, delay: 0 },
  { word: "ideas", x: 240, y: 70, color: "#5B6FD7", size: 44, weight: 500, delay: 0.07 },
  { word: "Brainstorm", x: 220, y: -50, color: "#8B5FC0", size: 32, weight: 400, delay: 0.03 },
  { word: "ideas", x: -190, y: 110, color: "#6070D8", size: 36, weight: 500, delay: 0.1 },
  { word: "ideas", x: -90, y: -130, color: "#9B5FC880", size: 28, weight: 400, delay: 0.14 },
  { word: "Brainstorm", x: 110, y: 140, color: "#D44E7A80", size: 26, weight: 400, delay: 0.07 },
  { word: "Brainstorm", x: -330, y: 35, color: "#D44E7A50", size: 22, weight: 400, delay: 0.17 },
  { word: "ideas", x: 320, y: -35, color: "#5B6FD750", size: 22, weight: 400, delay: 0.21 },
  { word: "Brainstorm", x: -150, y: 170, color: "#B86CC840", size: 18, weight: 400, delay: 0.1 },
  { word: "ideas", x: 160, y: -160, color: "#6878E040", size: 18, weight: 400, delay: 0.17 },
];

const P8_FROM = 207;
const PhaseBrainstormIdeas: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      final: { opacity: 0, scale: 0.95 },
    };
    for (let i = 0; i < FLOATERS.length; i++) {
      init[`g${i}`] = { x: FLOATERS[i].x, y: FLOATERS[i].y, opacity: 0 };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      FLOATERS.forEach((f, i) => {
        tl.to(p[`g${i}`], { opacity: 0.85, duration: 0.28, ease: "power1.out" }, f.delay);
        tl.to(
          p[`g${i}`],
          { x: 0, y: 0, opacity: 0, duration: 0.69, ease: "power2.out" },
          0.48,
        );
      });
      tl.to(p.final, { opacity: 1, scale: 1, duration: 0.69, ease: "power2.out" }, 0.48);
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
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${g.x}px), calc(-50% + ${g.y}px))`,
              fontFamily,
              fontSize: f.size,
              fontWeight: f.weight,
              color: f.color,
              whiteSpace: "nowrap",
              opacity: g.opacity,
            }}
          >
            {f.word}
          </div>
        );
      })}

      <div
        style={{
          ...centerStyle,
          opacity: s.final.opacity,
          transform: `translate(-50%, -50%) scale(${s.final.scale})`,
        }}
      >
        Brainstorm ideas
      </div>
    </AbsoluteFill>
  );
};

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      <Sequence from={P1_FROM} durationInFrames={15}>
        <PhaseYouve />
      </Sequence>

      <Sequence from={P2_FROM} durationInFrames={37}>
        <PhaseExperimenting />
      </Sequence>

      <Sequence from={P3_FROM} durationInFrames={35}>
        <PhaseBardFull />
      </Sequence>

      <Sequence from={P4_FROM} durationInFrames={36}>
        <PhaseTypewriter />
      </Sequence>

      <Sequence from={P5_FROM} durationInFrames={35}>
        <PhaseWriteEmails />
      </Sequence>

      <Sequence from={158} durationInFrames={20}>
        <PhaseLetterScatter text="Write emails" />
      </Sequence>

      <Sequence from={P7_FROM} durationInFrames={37}>
        <PhaseSolveProblems />
      </Sequence>

      <Sequence from={P8_FROM} durationInFrames={51}>
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
  fps: _FPS,
  durationInFrames: 258,
};
