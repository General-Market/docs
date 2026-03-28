/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * FULL REWRITE from tracking data + reference frames.
 * Kinetic typography on soft pastel background.
 *
 * Phases (frame ranges at 30fps, 258 frames total):
 *   P1 (0-14):     "You've" — fade/slide in, centered, ~30px
 *   P2 (15-51):    "You've been experimenting with" — per-letter settle
 *   P3 (51-85):    "Bard" — gradient coral->purple, centered ~58px
 *   P4 (86-122):   Typewriter "Write" with cursor, gradient text
 *   P5 (123-157):  "Write emails" — "emails" in gradient rectangle
 *   P6 (158-177):  Letter scatter exit (Write emails disintegrates)
 *   P7 (171-207):  "Solve problems" — letters scattered at different sizes, converge
 *   P8 (207-258):  "Brainstorm ideas" — floating word field converges
 *
 * 1280x720, 30fps, 258 frames (~8.6s)
 *
 * GSAP proxy-object animation. No DOM targeting. Deterministic per-frame.
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
const BG_BASE = "#EDEEF4";
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

// --- Background (CSS radial gradients + noise drift) -----------------------
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

// ===========================================================================
// Phase 1: "You've"
// Tracking: cx=52%, cy=49%, font ~30px
// Slide from right (x offset ~31px), fade in. power1.out, 0.19s
// ===========================================================================
const PhaseYouve: React.FC = () => {
  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.main,
        { x: 31, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.19, ease: "power1.out" },
      );
    },
    { main: { x: 31, opacity: 0 } },
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.49 * H}px`,
        left: `${0.52 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%)`,
        fontFamily,
        fontSize: 30,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        opacity: s.main.opacity,
      }}
    >
      You{"\u2019"}ve
    </div>
  );
};

// ===========================================================================
// Phase 2: "You've been experimenting with"
// Tracking: "been" cx=57% cy=49% 30px, "experimenting" cx=58% cy=49% 61px
// Words slide in. "experimenting" letters settle from scattered positions
// with purple->dark color transition.
// ===========================================================================
const EXP_LETTERS = "experimenting".split("");
const EXP_SETTLE_Y = [
  -18, 14, -16, 22, -12, 18, -24, 15, -17, 20, -14, 16, -20,
];
const EXP_SETTLE_X = [3, -4, 2, 3, -2, 4, -3, 1, 3, -5, 2, 3, -2];

const PhaseExperimenting: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {
      youve: { x: 20, opacity: 1 },
      been: { x: 50, opacity: 0 },
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
      tl.to(
        p.youve,
        { x: 0, duration: 0.28, ease: "power1.out" },
        0,
      );
      tl.to(
        p.been,
        { x: 0, opacity: 1, duration: 0.34, ease: "power1.out" },
        0.05,
      );

      for (let i = 0; i < EXP_LETTERS.length; i++) {
        tl.to(
          p[`l${i}`],
          {
            x: 0,
            y: 0,
            opacity: 1,
            purple: 0,
            duration: 0.55,
            ease: "power2.out",
          },
          0.12 + i * 0.035,
        );
      }

      tl.to(
        p.with_,
        { scale: 1, opacity: 1, duration: 0.19, ease: "power1.out" },
        0.48,
      );
    },
    proxyInit,
  );

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.49 * H}px`,
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
      }}
    >
      <span
        style={{
          display: "inline-block",
          fontSize: 30,
          opacity: s.youve.opacity,
          transform: `translateX(${s.youve.x}px)`,
        }}
      >
        You{"\u2019"}ve
      </span>
      <span
        style={{
          display: "inline-block",
          fontSize: 30,
          opacity: s.been.opacity,
          transform: `translateX(${s.been.x}px)`,
        }}
      >
        been
      </span>
      <span style={{ display: "inline-flex", fontSize: 30 }}>
        {EXP_LETTERS.map((ch, i) => {
          const l = s[`l${i}`];
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
          fontSize: 30,
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
// Tracking: cx=51%, cy=50%, font ~58px
// Gradient coral->purple, rotating angle
// x:8->0, opacity:0->1, scale 0.88->1, dur 0.48s, power2.out
// ===========================================================================
const PhaseBard: React.FC = () => {
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

  const baseAngle = interpolate(frame, [0, 30], [100, 210], clamp);
  const noiseAngle = noise2D("bard-angle", frame * 0.015, 0) * 8;
  const gradAngle = baseAngle + noiseAngle;
  const gradient = `linear-gradient(${gradAngle}deg, #E04868, #D046A0, #8B5CF6, #5B78E8)`;

  return (
    <div
      style={{
        position: "absolute",
        top: `${0.50 * H}px`,
        left: `${0.51 * W}px`,
        transform: `translate(calc(-50% + ${s.main.x}px), -50%) scale(${s.main.scale})`,
        fontFamily,
        fontSize: 58,
        fontWeight: 400,
        letterSpacing: "-0.5px",
        opacity: s.main.opacity,
        background: gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        whiteSpace: "nowrap",
      }}
    >
      Bard
    </div>
  );
};

// ===========================================================================
// Phase 4: Typewriter "Write" + cursor
// Tracking: cx=49%, cy=49%, font ~41px
// Letters revealed one-by-one. Gradient purple text. Cursor blinks then fades.
// ===========================================================================
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
        tl.to(
          p[`c${i}`],
          { visible: 1, duration: 0.001, ease: "none" },
          0.07 + i * 0.1,
        );
      }
      tl.to(
        p.cursor,
        { opacity: 0, duration: 0.1, ease: "power2.out" },
        0.48,
      );
    },
    proxyInit,
  );

  const gradAngle = interpolate(frame, [0, 36], [140, 240], clamp);
  const typeGrad = `linear-gradient(${gradAngle}deg, #7048C0, #A04090, #C84070)`;

  let visibleCount = 0;
  for (let i = 0; i < WRITE_CHARS.length; i++) {
    if (s[`c${i}`].visible > 0.5) visibleCount = i + 1;
  }
  const partial = "Write".slice(0, visibleCount);

  const isTyping = visibleCount > 0 && visibleCount < WRITE_CHARS.length;
  const isDone = visibleCount >= WRITE_CHARS.length;
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
        top: `${0.49 * H}px`,
        left: `${0.49 * W}px`,
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontSize: 41,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
      }}
    >
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
          width: 2.5,
          height: 41 * 0.88,
          backgroundColor: TEXT_DARK,
          marginLeft: 2,
          opacity: cursorOpacity,
        }}
      />
    </div>
  );
};

// ===========================================================================
// Phase 5: "Write emails" with gradient rectangle
// Tracking: "Write" cx=49% 41px; "emails" cx=57% 43px
// "emails" in gradient-filled RECTANGLE. back.out(1.7) on pill.
// ===========================================================================
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();
  const pillRad = (44.2 * Math.PI) / 180;
  const pillStartX = Math.cos(pillRad) * 40;
  const pillStartY = Math.sin(pillRad) * 12;

  const s = useGsapProxy(
    (tl, p) => {
      tl.fromTo(
        p.write,
        { y: 8, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.34, ease: "power2.out" },
        0,
      );
      tl.fromTo(
        p.pill,
        { x: pillStartX, y: pillStartY, scale: 0.85, opacity: 0 },
        {
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.41,
          ease: "back.out(1.7)",
        },
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
    <div
      style={{
        position: "absolute",
        top: `${0.49 * H}px`,
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontWeight: 400,
        color: TEXT_DARK,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 41,
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
            padding: "8px 14px",
            borderRadius: 3,
            color: "#FFFFFF",
            fontSize: 43,
            fontWeight: 400,
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
// Phase 6: Letter scatter (exit from "Write emails")
// Letters explode outward from inline positions. expo.out easing.
// ===========================================================================
const SCATTER_CHAR_WIDTHS: Record<string, number> = {
  W: 30,
  r: 14,
  i: 8,
  t: 12,
  e: 18,
  "\u00A0": 10,
  m: 28,
  a: 18,
  l: 8,
  s: 16,
};

const PhaseLetterScatter: React.FC<{ text: string }> = ({ text }) => {
  const letters = text.replace(/ /g, "\u00A0").split("");

  const charWidths = letters.map((ch) => SCATTER_CHAR_WIDTHS[ch] || 16);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const scatterAngles = [86.6, 44.2, 64.5, 23.5];

  const s = useGsapProxy(
    (tl, p) => {
      letters.forEach((_, i) => {
        const angle = scatterAngles[i % 4] * (i % 2 === 0 ? 1 : -1);
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
              top: `${0.49 * H}px`,
              left: "50%",
              transform: `translate(calc(-50% + ${startXOffsets[i] + l.x}px), calc(-50% + ${l.y}px)) rotate(${l.rotation}deg) scale(${l.scale})`,
              fontFamily,
              fontSize: 41,
              fontWeight: 400,
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
// Phase 7: "Solve problems" — letters scattered at DIFFERENT SIZES, converge
//
// Reference frame_012: each letter at a DIFFERENT font size scattered across
// the entire frame. They converge to a uniform line at center.
//
// Scatter positions: absolute px on 1280x720 canvas from frame_012.
// Final: "Solve problems" centered at ~50% x, 49% y, ~40px uniform.
// ===========================================================================
const SOLVE_TEXT = "Solve\u00A0problems";
const SOLVE_LETTERS = SOLVE_TEXT.split("");

// Scatter: absolute pixel positions and sizes from reference frame_012
const SOLVE_SCATTER: Array<{ x: number; y: number; size: number }> = [
  { x: 130, y: 140, size: 96 }, // S
  { x: 230, y: 200, size: 48 }, // o
  { x: 70, y: 380, size: 36 }, // l
  { x: 285, y: 100, size: 44 }, // v
  { x: 260, y: 225, size: 42 }, // e
  { x: 0, y: 0, size: 40 }, // (space)
  { x: 310, y: 310, size: 56 }, // p
  { x: 215, y: 210, size: 40 }, // r
  { x: 390, y: 265, size: 52 }, // o
  { x: 430, y: 140, size: 60 }, // b
  { x: 370, y: 275, size: 38 }, // l
  { x: 490, y: 210, size: 50 }, // e
  { x: 510, y: 315, size: 48 }, // m
  { x: 710, y: 220, size: 40 }, // s
];

// Final settled layout — compute char positions for centered text
const SOLVE_FINAL_SIZE = 44;
const SOLVE_CHAR_W = [24, 22, 11, 22, 20, 11, 22, 13, 22, 22, 11, 20, 29, 15];
const SOLVE_TOTAL_W = SOLVE_CHAR_W.reduce((a, b) => a + b, 0);
const SOLVE_FINAL_CX = W * 0.5;
const SOLVE_FINAL_CY = H * 0.49;

const SOLVE_FINAL_X: number[] = [];
{
  let rx = SOLVE_FINAL_CX - SOLVE_TOTAL_W / 2;
  for (let i = 0; i < SOLVE_LETTERS.length; i++) {
    SOLVE_FINAL_X.push(rx + SOLVE_CHAR_W[i] / 2);
    rx += SOLVE_CHAR_W[i];
  }
}

const PhaseSolveProblems: React.FC = () => {
  const proxyInit = useMemo(() => {
    const init: Record<string, ProxyState> = {};
    for (let i = 0; i < SOLVE_LETTERS.length; i++) {
      const sc = SOLVE_SCATTER[i];
      init[`l${i}`] = {
        x: sc.x,
        y: sc.y,
        size: sc.size,
        opacity: 0,
      };
    }
    return init;
  }, []);

  const s = useGsapProxy(
    (tl, p) => {
      SOLVE_LETTERS.forEach((_, i) => {
        // Fade in at scattered positions
        tl.to(
          p[`l${i}`],
          { opacity: 1, duration: 0.14, ease: "power1.out" },
          i * 0.01,
        );
        // Converge to final centered line with uniform size
        tl.to(
          p[`l${i}`],
          {
            x: SOLVE_FINAL_X[i],
            y: SOLVE_FINAL_CY,
            size: SOLVE_FINAL_SIZE,
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
// Phase 8: "Brainstorm ideas" — floating word field
// Reference: scattered "Brainstorm" and "ideas" in different sizes/colors,
// converging toward center. Final text appears centered.
// ===========================================================================
const FLOATERS: Array<{
  word: string;
  x: number;
  y: number;
  color: string;
  size: number;
  weight: number;
  delay: number;
}> = [
  {
    word: "Brainstorm",
    x: -220,
    y: -100,
    color: "#D44E7A",
    size: 38,
    weight: 500,
    delay: 0,
  },
  {
    word: "ideas",
    x: 200,
    y: -60,
    color: "#5B6FD7",
    size: 32,
    weight: 500,
    delay: 0.07,
  },
  {
    word: "Brainstorm",
    x: 0,
    y: -20,
    color: "#8B5FC080",
    size: 26,
    weight: 400,
    delay: 0.03,
  },
  {
    word: "ideas",
    x: -280,
    y: 30,
    color: "#5B6FD7",
    size: 44,
    weight: 700,
    delay: 0.1,
  },
  {
    word: "Brainstorm",
    x: 240,
    y: 50,
    color: "#D44E7A80",
    size: 36,
    weight: 500,
    delay: 0.14,
  },
  {
    word: "ideas",
    x: -100,
    y: -140,
    color: "#9B5FC860",
    size: 28,
    weight: 400,
    delay: 0.07,
  },
  {
    word: "Brainstorm",
    x: -320,
    y: 120,
    color: "#D44E7A40",
    size: 22,
    weight: 400,
    delay: 0.17,
  },
  {
    word: "ideas",
    x: 300,
    y: -120,
    color: "#5B6FD740",
    size: 22,
    weight: 400,
    delay: 0.21,
  },
  {
    word: "Brainstorm",
    x: -160,
    y: 160,
    color: "#B86CC840",
    size: 18,
    weight: 400,
    delay: 0.1,
  },
  {
    word: "ideas",
    x: 180,
    y: 150,
    color: "#6878E040",
    size: 18,
    weight: 400,
    delay: 0.17,
  },
];

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
      // Floaters fade in at scattered positions
      FLOATERS.forEach((f, i) => {
        tl.to(
          p[`g${i}`],
          { opacity: 0.85, duration: 0.28, ease: "power1.out" },
          f.delay,
        );
      });
      // Converge to center and fade out
      FLOATERS.forEach((_, i) => {
        tl.to(
          p[`g${i}`],
          { x: 0, y: 0, opacity: 0, duration: 0.69, ease: "power2.out" },
          0.48,
        );
      });
      // Final centered text fades in
      tl.to(
        p.final,
        { opacity: 1, scale: 1, duration: 0.69, ease: "power2.out" },
        0.48,
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
          fontSize: 40,
          fontWeight: 400,
          color: TEXT_DARK,
          whiteSpace: "nowrap",
          opacity: s.final.opacity,
        }}
      >
        Brainstorm ideas
      </div>
    </AbsoluteFill>
  );
};

// --- Frame Timings -----------------------------------------------------------
const P1_FROM = 0;
const P2_FROM = 15;
const P3_FROM = 51;
const P4_FROM = 86;
const P5_FROM = 122;
const P6_FROM = 158;
const P7_FROM = 171;
const P8_FROM = 207;

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
        <PhaseBard />
      </Sequence>

      <Sequence from={P4_FROM} durationInFrames={38}>
        <PhaseTypewriter />
      </Sequence>

      <Sequence from={P5_FROM} durationInFrames={36}>
        <PhaseWriteEmails />
      </Sequence>

      <Sequence from={P6_FROM} durationInFrames={20}>
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
  fps: FPS,
  durationInFrames: 258,
};
