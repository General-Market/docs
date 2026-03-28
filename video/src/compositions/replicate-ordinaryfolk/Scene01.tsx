/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * Kinetic typography on soft pastel background.
 * Sequence: "You've" -> "been experimenting with" -> "Bard" (gradient) ->
 * typewriter "Write" -> "emails" (gradient pill) -> letter scatter ->
 * "Solve problems" (assemble) -> "Brainstorm ideas" (floating words converge)
 *
 * 1280x720, 29fps, 258 frames (~8.9s)
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

const FPS = 29;
const W = 1280;
const H = 720;

// --- Palette ---------------------------------------------------------------
const BG_BASE = "#EDEEF4";
const TEXT_DARK = "#1A1A2E";
const GRADIENT_PURPLE = "#8B5FC0";
const GRADIENT_BLUE = "#5B6FD7";

// --- Helpers ---------------------------------------------------------------
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

function springIn(frame: number, fps: number, delay: number) {
  return spring({
    frame,
    fps,
    delay,
    config: { damping: 28, stiffness: 180 },
  });
}

function springSnappy(frame: number, fps: number, delay: number) {
  return spring({
    frame,
    fps,
    delay,
    config: { damping: 20, stiffness: 200 },
  });
}

function springSmooth(frame: number, fps: number, delay: number) {
  return spring({ frame, fps, delay, config: { damping: 200 } });
}

// Base text size — reference ~48px at 720p. "Bard" ~1.4x larger.
const TEXT_SIZE = 48;
const BARD_SIZE = 78;
const FONT_WEIGHT = 400;

// --- Background ------------------------------------------------------------
// Reference: soft lavender-blue center-left, warm rose in upper-right,
// subtle purple-mauve undertone. Washes drift slowly.
const PastelBackground: React.FC = () => {
  const frame = useCurrentFrame();
  const hueShift = interpolate(frame, [0, 258], [0, 28], clamp);

  // Slow orbital drift
  const x1 = 32 + Math.sin(frame * 0.014) * 15;
  const y1 = 28 + Math.cos(frame * 0.011) * 10;
  const x2 = 74 + Math.sin(frame * 0.012 + 2) * 12;
  const y2 = 24 + Math.cos(frame * 0.016 + 1) * 8;
  const x3 = 50 + Math.sin(frame * 0.009 + 4) * 8;
  const y3 = 55 + Math.cos(frame * 0.008 + 3) * 6;

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(ellipse 90% 70% at ${x1}% ${y1}%, hsla(${222 + hueShift}, 45%, 90%, 0.85), transparent),
          radial-gradient(ellipse 70% 55% at ${x2}% ${y2}%, hsla(${330 + hueShift}, 32%, 91%, 0.6), transparent),
          radial-gradient(ellipse 100% 80% at ${x3}% ${y3}%, hsla(${268 + hueShift}, 20%, 93%, 0.4), transparent),
          ${BG_BASE}
        `,
      }}
    />
  );
};

// --- Centered text container -----------------------------------------------
// Text sits slightly below dead center — ~53% from top
const CENTER_Y = "53%";

const CenterText: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      top: CENTER_Y,
      left: "50%",
      transform: "translate(-50%, -50%)",
      fontFamily,
      fontSize: TEXT_SIZE,
      fontWeight: FONT_WEIGHT,
      color: TEXT_DARK,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </div>
);

// --- Phase 1: "You've" (frames 0-14) --------------------------------------
const PhaseYouve: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = springIn(frame, fps, 0);
  const opacity = interpolate(progress, [0, 1], [0, 1], clamp);
  const y = interpolate(progress, [0, 1], [14, 0], clamp);

  return (
    <CenterText
      style={{
        opacity,
        transform: `translate(-50%, calc(-50% + ${y}px))`,
        top: CENTER_Y,
      }}
    >
      You{"\u2019"}ve
    </CenterText>
  );
};

// --- Phase 2: "You've been experimenting with" (frames 12-54) --------------
const PhaseExperimenting: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = ["You\u2019ve", "been", "experimenting", "with"];
  const delays = [0, 3, 6, 16];

  return (
    <CenterText style={{ display: "flex", gap: 14 }}>
      {words.map((word, i) => {
        const prog = springIn(frame, fps, delays[i]);
        const opacity = interpolate(prog, [0, 1], [0, 1], clamp);
        const y = interpolate(prog, [0, 1], [18, 0], clamp);

        if (word === "experimenting") {
          return (
            <span key={i} style={{ display: "inline-flex" }}>
              {word.split("").map((ch, ci) => {
                const letterDelay = delays[i] + ci * 0.8;
                const lp = springIn(frame, fps, letterDelay);
                const lo = interpolate(lp, [0, 1], [0, 1], clamp);
                // Letters scatter above AND below the line
                const dir = ci % 2 === 0 ? 1 : -1;
                const ly = interpolate(
                  lp,
                  [0, 1],
                  [dir * (35 + (ci % 3) * 22), 0],
                  clamp,
                );
                const lx = interpolate(lp, [0, 1], [(ci - 6) * 10, 0], clamp);
                // Blue-purple tint during assembly (reference frame_002/003)
                const purpleMix = interpolate(lp, [0.1, 0.8], [0.85, 0], clamp);
                const letterColor =
                  purpleMix > 0
                    ? `rgba(${0x5b}, ${0x4f}, ${0xd0}, ${purpleMix})`
                    : undefined;
                return (
                  <span
                    key={ci}
                    style={{
                      display: "inline-block",
                      opacity: lo,
                      transform: `translate(${lx}px, ${ly}px)`,
                      color: letterColor || TEXT_DARK,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        }
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${y}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </CenterText>
  );
};

// --- Phase 3: "Bard" with gradient text (frames 55-84) ---------------------
// Reference: "B" rose-coral, "ar" mauve-purple, "d" blue-violet.
// Thin weight (300). Gradient angle rotates slowly.
const PhaseBardFull: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const prog = springSnappy(frame, fps, 0);
  const opacity = interpolate(prog, [0, 1], [0, 1], clamp);
  const scale = interpolate(prog, [0, 1], [0.92, 1], clamp);
  const gradAngle = interpolate(frame, [0, 29], [100, 210], clamp);
  // Warm coral-pink -> hot magenta -> rich purple -> cool blue-violet
  const gradient = `linear-gradient(${gradAngle}deg, #E85070, #D03888, #9538B8, #6248D0)`;

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        fontFamily,
        fontSize: BARD_SIZE,
        fontWeight: 300,
        opacity,
        background: gradient,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        whiteSpace: "nowrap",
        letterSpacing: "-0.5px",
      }}
    >
      Bard
    </div>
  );
};

// --- Phase 4: Typewriter "Write" + cursor (frames 85-119) ------------------
// Reference: cursor appears alone first, then letters type in one by one.
// Cursor blinks slowly (~4 frames on, 4 off). Text has subtle purple gradient.
const PhaseTypewriter: React.FC = () => {
  const frame = useCurrentFrame();
  const text = "Write";
  // Cursor appears at frame 0; first char at frame 3
  const charsVisible = Math.min(
    text.length,
    Math.max(0, Math.floor((frame - 2) / 3)),
  );
  const partial = text.slice(0, charsVisible);

  // Cursor: solid while typing (chars appearing), blinks when idle.
  // After all chars typed, cursor fades out.
  const isTyping = charsVisible > 0 && charsVisible < text.length;
  const isWaiting = charsVisible === 0; // cursor alone, blinking
  const isDone = charsVisible >= text.length;
  const blinkPhase = frame % 10;
  const blinkOn = blinkPhase < 6;
  const cursorOpacity = isDone ? 0 : isTyping ? 1 : blinkOn ? 1 : 0;

  const hasText = charsVisible > 0;

  // Purple-to-rose gradient on typed text (more saturated for visibility)
  const gradAngle = interpolate(frame, [0, 36], [140, 240], clamp);
  const typeGrad = `linear-gradient(${gradAngle}deg, #7048C0, #A04090, #C84070)`;

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontSize: TEXT_SIZE,
        fontWeight: FONT_WEIGHT,
        display: "flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {hasText && (
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

// --- Phase 5: "Write emails" with gradient pill (frames 120-154) -----------
// Reference: pill has rounded corners (~6px), gradient pink -> purple -> blue.
// "Write" is plain dark text. "emails" is white on gradient pill.
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const writeIn = springSmooth(frame, fps, 0);
  const emailsIn = springSnappy(frame, fps, 4);
  const writeOpacity = interpolate(writeIn, [0, 1], [0, 1], clamp);
  const emailsOpacity = interpolate(emailsIn, [0, 1], [0, 1], clamp);
  const emailsScale = interpolate(emailsIn, [0, 1], [0.88, 1], clamp);

  // Gradient pill: pink -> purple -> blue, rotating angle
  const gradAngle = interpolate(frame, [0, 34], [90, 220], clamp);
  const pillGrad = `linear-gradient(${gradAngle}deg, #D04870, #A858B8, #6878E0)`;

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontFamily,
        fontSize: TEXT_SIZE,
        fontWeight: FONT_WEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 12,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: TEXT_DARK, opacity: writeOpacity }}>Write</span>
      <span
        style={{
          display: "inline-block",
          opacity: emailsOpacity,
          transform: `scale(${emailsScale})`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            background: pillGrad,
            padding: "8px 20px",
            borderRadius: 6,
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

// --- Phase 6: Letter scatter (exit transition) -----------------------------
// Reference: letters scatter with GRAVITY bias ("t" drops downward).
// Dramatic size variation. Letters spread wide across viewport.
const SCATTER_SIZES: Record<string, number> = {
  S: 96,
  o: 52,
  l: 36,
  v: 48,
  e: 44,
  " ": 48,
  p: 56,
  r: 40,
  b: 60,
  m: 52,
  s: 38,
  W: 80,
  i: 36,
  t: 42,
};

const PhaseLetterScatter: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const letters = text.replace(/ /g, "\u00A0").split("");

  return (
    <AbsoluteFill>
      {letters.map((ch, i) => {
        const seed = i * 137.5;
        // Wider radial scatter + stronger gravity bias
        const radialX = Math.cos(seed) * (300 + (i % 5) * 65);
        const radialY = Math.sin(seed) * (140 + (i % 3) * 50);
        const gravityBias = 50 + (i % 4) * 30;
        const targetX = radialX;
        const targetY = radialY + gravityBias;
        const targetRot = (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 10);

        const prog = springIn(frame, fps, i * 0.35);
        const x = interpolate(prog, [0, 1], [0, targetX], clamp);
        const y = interpolate(prog, [0, 1], [0, targetY], clamp);
        const rot = interpolate(prog, [0, 1], [0, targetRot], clamp);
        const opacity = interpolate(prog, [0, 0.65, 1], [1, 0.5, 0], clamp);

        const letterSize = SCATTER_SIZES[ch] || TEXT_SIZE;
        const sizeScale = interpolate(
          prog,
          [0, 0.4, 1],
          [1, letterSize / TEXT_SIZE, letterSize / TEXT_SIZE],
          clamp,
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rot}deg) scale(${sizeScale})`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity,
            }}
          >
            {ch}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Phase 7: "Solve problems" assembles from scattered letters ------------
// Reference: letters start scattered at varied sizes, then converge into a
// readable centered line. Each letter has a unique scatter origin.
const SOLVE_SCATTER = [
  // S o l v e [space] p r o b l e m s
  { x: -350, y: -120, size: 96 },
  { x: -140, y: -40, size: 48 },
  { x: -420, y: 100, size: 36 },
  { x: 120, y: -100, size: 44 },
  { x: -80, y: -30, size: 42 },
  { x: 0, y: 0, size: 48 },
  { x: -60, y: 60, size: 56 },
  { x: -160, y: -20, size: 40 },
  { x: 80, y: 40, size: 52 },
  { x: 250, y: -80, size: 60 },
  { x: 180, y: -30, size: 38 },
  { x: 300, y: -40, size: 50 },
  { x: 280, y: 80, size: 48 },
  { x: 420, y: 20, size: 40 },
];

// Per-character widths at TEXT_SIZE (48px) Plus Jakarta Sans 400.
// "Solve problems" = S o l v e [space] p r o b l e m s
// Measured against reference frame_014 — total ~370px.
const SOLVE_CHAR_WIDTHS = [32, 28, 14, 28, 26, 16, 28, 18, 28, 28, 14, 26, 38, 18];
const SOLVE_TOTAL_W = SOLVE_CHAR_WIDTHS.reduce((a, b) => a + b, 0);

const PhaseSolveProblems: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const text = "Solve problems";
  const letters = text.replace(/ /g, "\u00A0").split("");

  const assembleStart = 8;

  // Pre-compute final X offset for each letter (centered)
  let runningX = -SOLVE_TOTAL_W / 2;
  const finalX = SOLVE_CHAR_WIDTHS.map((w) => {
    const cx = runningX + w / 2;
    runningX += w;
    return cx;
  });

  return (
    <AbsoluteFill>
      {letters.map((ch, i) => {
        const scatter = SOLVE_SCATTER[i] || { x: 0, y: 0, size: 48 };
        const prog = springSnappy(frame, fps, assembleStart + i * 0.3);
        const x = interpolate(prog, [0, 1], [scatter.x, finalX[i]], clamp);
        const y = interpolate(prog, [0, 1], [scatter.y, 0], clamp);
        const sizeScale = interpolate(
          prog,
          [0, 1],
          [scatter.size / TEXT_SIZE, 1],
          clamp,
        );

        const fadeIn = interpolate(
          frame,
          [i * 0.3, i * 0.3 + 4],
          [0, 1],
          clamp,
        );

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${sizeScale})`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity: fadeIn,
            }}
          >
            {ch}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Phase 8: "Brainstorm ideas" -- floating pastel words converge ---------
// Reference: multiple copies at varied sizes/colors/weights float and converge.
const PhaseBrainstormIdeas: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const floaters = [
    {
      word: "Brainstorm",
      x: -260,
      y: -90,
      color: "#D44E7A",
      size: 38,
      weight: 500,
      delay: 0,
    },
    {
      word: "ideas",
      x: 240,
      y: 70,
      color: GRADIENT_BLUE,
      size: 44,
      weight: 500,
      delay: 2,
    },
    {
      word: "Brainstorm",
      x: 220,
      y: -50,
      color: GRADIENT_PURPLE,
      size: 32,
      weight: 400,
      delay: 1,
    },
    {
      word: "ideas",
      x: -190,
      y: 110,
      color: "#6070D8",
      size: 36,
      weight: 500,
      delay: 3,
    },
    {
      word: "ideas",
      x: -90,
      y: -130,
      color: "#9B5FC880",
      size: 28,
      weight: 400,
      delay: 4,
    },
    {
      word: "Brainstorm",
      x: 110,
      y: 140,
      color: "#D44E7A80",
      size: 26,
      weight: 400,
      delay: 2,
    },
    {
      word: "Brainstorm",
      x: -330,
      y: 35,
      color: "#D44E7A50",
      size: 22,
      weight: 300,
      delay: 5,
    },
    {
      word: "ideas",
      x: 320,
      y: -35,
      color: "#5B6FD750",
      size: 22,
      weight: 300,
      delay: 6,
    },
    // Extra small floaters for density
    {
      word: "Brainstorm",
      x: -150,
      y: 170,
      color: "#B86CC840",
      size: 18,
      weight: 300,
      delay: 3,
    },
    {
      word: "ideas",
      x: 160,
      y: -160,
      color: "#6878E040",
      size: 18,
      weight: 300,
      delay: 5,
    },
  ];

  const converge = springSmooth(frame, fps, 22);

  return (
    <>
      {floaters.map((f, i) => {
        const fadeIn = interpolate(
          frame,
          [f.delay, f.delay + 8],
          [0, 0.85],
          clamp,
        );
        const fadeOut = interpolate(frame, [26, 42], [1, 0], clamp);
        const floatX = f.x + Math.sin(frame * 0.05 + i * 1.5) * 10;
        const floatY = f.y + Math.cos(frame * 0.04 + i * 2.2) * 8;
        const cx = interpolate(converge, [0, 1], [floatX, 0], clamp);
        const cy = interpolate(converge, [0, 1], [floatY, 0], clamp);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${cx}px), calc(-50% + ${cy}px))`,
              fontFamily,
              fontSize: f.size,
              fontWeight: f.weight,
              color: f.color,
              opacity: fadeIn * fadeOut,
              whiteSpace: "nowrap",
            }}
          >
            {f.word}
          </div>
        );
      })}

      {/* Final converged text */}
      <div
        style={{
          position: "absolute",
          top: CENTER_Y,
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily,
          fontSize: TEXT_SIZE,
          fontWeight: FONT_WEIGHT,
          color: TEXT_DARK,
          opacity: interpolate(converge, [0, 1], [0, 1], clamp),
          whiteSpace: "nowrap",
        }}
      >
        Brainstorm ideas
      </div>
    </>
  );
};

// --- Composition -----------------------------------------------------------
export const Scene01: React.FC = () => {
  return (
    <AbsoluteFill style={{ fontFamily }}>
      <PastelBackground />

      {/* Phase 1: "You've" alone */}
      <Sequence from={0} durationInFrames={10}>
        <PhaseYouve />
      </Sequence>

      {/* Phase 2: "You've been experimenting with" */}
      <Sequence from={10} durationInFrames={44}>
        <PhaseExperimenting />
      </Sequence>

      {/* Phase 3: "Bard" gradient */}
      <Sequence from={54} durationInFrames={30}>
        <PhaseBardFull />
      </Sequence>

      {/* Phase 4: Typewriter "Write" + cursor */}
      <Sequence from={84} durationInFrames={36}>
        <PhaseTypewriter />
      </Sequence>

      {/* Phase 5: "Write emails" with gradient pill */}
      <Sequence from={120} durationInFrames={35}>
        <PhaseWriteEmails />
      </Sequence>

      {/* Phase 6: Letter scatter — overlaps with phase 7 start */}
      <Sequence from={155} durationInFrames={22}>
        <PhaseLetterScatter text="Write emails" />
      </Sequence>

      {/* Phase 7: "Solve problems" assembles */}
      <Sequence from={170} durationInFrames={40}>
        <PhaseSolveProblems />
      </Sequence>

      {/* Phase 8: "Brainstorm ideas" — floating words converge */}
      <Sequence from={210} durationInFrames={48}>
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
