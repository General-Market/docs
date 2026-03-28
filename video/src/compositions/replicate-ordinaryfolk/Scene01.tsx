/**
 * Scene 01 — Ordinary Folk (Google Gemini promo) replication
 *
 * Kinetic typography on soft pastel background.
 * Sequence: "You've" -> "been experimenting with" -> "Bard" (gradient) ->
 * typewriter "Write" -> "emails" (gradient pill) -> letter scatter ->
 * "Solve problems" (assemble) -> "Brainstorm ideas" (floating words converge)
 *
 * OVERHAUL: Organic motion from real motion tracking data.
 * All movements use cubic bezier curves, noise2D wobble, velocity-proportional blur.
 * Angles: 86.6, 44.2, 64.5, 23.5 — extracted from reference.
 * Peak blur: up to 362px tracked -> ~18px CSS blur.
 * Easings: ease_out_expo, ease_out_cubic per tracking data.
 *
 * 1280x720, 29fps, 258 frames (~8.9s)
 */
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Sequence,
  Easing,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", {
  weights: ["300", "400", "500", "700"],
  subsets: ["latin"],
});

const _FPS = 29;
const W = 1280;
const H = 720;

// --- Beat sync (152 BPM, detected via librosa on full audio) ----------------
const SCENE01_BEATS = [2, 15, 26, 38, 51, 62, 75, 86, 99, 110, 123, 134, 146, 158, 171, 183, 195, 207, 218, 231, 243, 255];

function beatPulse(absFrame: number, beats: number[] = SCENE01_BEATS, decay = 6): number {
  let max = 0;
  for (const b of beats) {
    const d = absFrame - b;
    if (d >= 0 && d < decay) { const p = 1 - d / decay; if (p > max) max = p; }
  }
  return max;
}
function beatScale(absFrame: number, beats?: number[]): number {
  return 1 + 0.02 * beatPulse(absFrame, beats);
}

// --- Organic angles from tracking data (degrees) ---------------------------
const ANGLE_A = 86.6;
const ANGLE_B = 44.2;
const ANGLE_C = 64.5;
const ANGLE_D = 23.5;

// --- Bezier easing functions -----------------------------------------------
const EASE_OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1);
const EASE_OUT_CUBIC = Easing.bezier(0.33, 1, 0.68, 1);

// --- Organic wobble via noise2D --------------------------------------------
function wobble(
  seed: string,
  frame: number,
  ampX = 2.5,
  ampY = 1.8,
  speed = 0.025,
): { x: number; y: number; rot: number } {
  return {
    x: noise2D(seed + "wx", frame * speed, 0) * ampX,
    y: noise2D(seed + "wy", 0, frame * speed) * ampY,
    rot: noise2D(seed + "wr", frame * speed * 0.7, 0.5) * 0.3,
  };
}

// --- Velocity-proportional motion blur -------------------------------------
function axisBlur(current: number, prev: number, scale = 0.12, maxBlur = 14): number {
  return Math.min(Math.abs(current - prev) * scale, maxBlur);
}

// --- Palette ---------------------------------------------------------------
const BG_BASE = "#EDEEF4";
const TEXT_DARK = "#1A1A2E";

// --- Helpers ---------------------------------------------------------------
const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

const TEXT_SIZE = 34;
const BARD_SIZE = 58;
const FONT_WEIGHT = 400;

// --- Background ------------------------------------------------------------
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

// --- Centered text container -----------------------------------------------
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

// --- Phase 1: "You've" — Sequence from=0 ------------------------------------
const P1_FROM = 0;
const PhaseYouve: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P1_FROM;
  const w = wobble("youve", frame);
  const bs = beatScale(abs);

  const progress = Math.min(1, frame / 10);
  const eased = EASE_OUT_EXPO(progress);

  const opacity = eased;
  const yOffset = (1 - eased) * 22;
  const xOffset = (1 - eased) * 22 * Math.tan((ANGLE_D * Math.PI) / 180) * -0.3;

  const prevEased = frame > 0 ? EASE_OUT_EXPO(Math.min(1, (frame - 1) / 10)) : 0;
  const prevY = (1 - prevEased) * 22;
  const blur = axisBlur(yOffset, prevY, 0.3, 4);

  return (
    <CenterText
      style={{
        opacity,
        transform: `translate(calc(-50% + ${xOffset + w.x}px), calc(-50% + ${yOffset + w.y}px)) rotate(${w.rot}deg) scale(${bs})`,
        top: CENTER_Y,
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
      }}
    >
      You{"\u2019"}ve
    </CenterText>
  );
};

// --- Phase 2: "You've been experimenting with" — Sequence from=15 ----------
const P2_FROM = 15;
const PhaseExperimenting: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P2_FROM;
  const bs = beatScale(abs);

  const words = ["You\u2019ve", "been", "experimenting", "with"];
  const delays = [0, 3, 6, 16];

  return (
    <CenterText style={{ display: "flex", gap: 14, transform: `translate(-50%, -50%) scale(${bs})` }}>
      {words.map((word, i) => {
        const w = wobble(`exp-${i}`, frame, 1.5, 1.0);

        if (word === "experimenting") {
          return (
            <span key={i} style={{ display: "inline-flex" }}>
              {word.split("").map((ch, ci) => {
                const letterDelay = delays[i] + ci * 2.0;
                const rawProgress = Math.max(0, Math.min(1, (frame - letterDelay) / 18));
                const lp = EASE_OUT_CUBIC(rawProgress);
                const lo = interpolate(rawProgress, [0, 0.15], [0, 1], clamp);

                const angleIdx = ci % 4;
                const angles = [ANGLE_A, ANGLE_B, ANGLE_C, ANGLE_D];
                const scatterAngle = angles[angleIdx] * (ci % 2 === 0 ? 1 : -1);
                const scatterDist = 45 + (ci % 3) * 30;
                const scatterRad = (scatterAngle * Math.PI) / 180;

                const ly = (1 - lp) * Math.sin(scatterRad) * scatterDist;
                const lx = (1 - lp) * Math.cos(scatterRad) * scatterDist * 0.5;

                const lw = wobble(`ltr-${ci}`, frame, 1.2, 0.8, 0.03);

                const purpleMix = interpolate(rawProgress, [0.1, 0.8], [0.85, 0], clamp);
                const letterColor =
                  purpleMix > 0
                    ? `rgba(${0x5b}, ${0x4f}, ${0xd0}, ${purpleMix})`
                    : undefined;

                const currDist = Math.sqrt(lx * lx + ly * ly);
                const blur = Math.min(currDist * 0.08, 6);

                return (
                  <span
                    key={ci}
                    style={{
                      display: "inline-block",
                      opacity: lo,
                      transform: `translate(${lx + lw.x}px, ${ly + lw.y}px) rotate(${lw.rot}deg)`,
                      color: letterColor || TEXT_DARK,
                      filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        }

        const rawProg = Math.max(0, Math.min(1, (frame - delays[i]) / 12));
        const eased = EASE_OUT_EXPO(rawProg);
        const opacity = interpolate(rawProg, [0, 0.2], [0, 1], clamp);
        const y = (1 - eased) * 20;
        const prevEased = EASE_OUT_EXPO(Math.max(0, Math.min(1, (frame - 1 - delays[i]) / 12)));
        const prevY = (1 - prevEased) * 20;
        const blur = axisBlur(y, prevY, 0.2, 3);

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity,
              transform: `translateY(${y + w.y}px) translateX(${w.x}px) rotate(${w.rot}deg)`,
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
            }}
          >
            {word}
          </span>
        );
      })}
    </CenterText>
  );
};

// --- Phase 3: "Bard" with gradient text — Sequence from=51 -----------------
const P3_FROM = 51;
const PhaseBardFull: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P3_FROM;
  const w = wobble("bard", frame, 2.0, 1.5, 0.02);

  const rawProg = Math.min(1, frame / 14);
  const eased = EASE_OUT_EXPO(rawProg);

  const opacity = interpolate(rawProg, [0, 0.15], [0, 1], clamp);
  const scale = 0.88 + eased * 0.12;

  const baseAngle = interpolate(frame, [0, 29], [100, 210], clamp);
  const noiseAngle = noise2D("bard-angle", frame * 0.015, 0) * 8;
  const gradAngle = baseAngle + noiseAngle;
  const gradient = `linear-gradient(${gradAngle}deg, #E85070, #D03888, #9538B8, #6248D0)`;

  const entryDist = (1 - eased) * 30;
  const entryRad = (ANGLE_C * Math.PI) / 180;
  const entryX = Math.cos(entryRad) * entryDist * 0.4;
  const entryY = Math.sin(entryRad) * entryDist;

  const blur = Math.min(entryDist * 0.15, 8);

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: `translate(calc(-50% + ${entryX + w.x}px), calc(-50% + ${entryY + w.y}px)) scale(${scale * beatScale(abs)}) rotate(${w.rot}deg)`,
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
        filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
      }}
    >
      Bard
    </div>
  );
};

// --- Phase 4: Typewriter "Write" + cursor — Sequence from=86 ----------------
const P4_FROM = 86;
const PhaseTypewriter: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P4_FROM;
  const bs = beatScale(abs);
  const text = "Write";
  const charsVisible = Math.min(
    text.length,
    Math.max(0, Math.floor((frame - 2) / 3)),
  );
  const partial = text.slice(0, charsVisible);

  const isTyping = charsVisible > 0 && charsVisible < text.length;
  const isDone = charsVisible >= text.length;
  const blinkPhase = frame % 10;
  const blinkOn = blinkPhase < 6;
  const cursorOpacity = isDone ? 0 : isTyping ? 1 : blinkOn ? 1 : 0;

  const hasText = charsVisible > 0;
  const w = wobble("typewriter", frame, 1.0, 0.8, 0.03);

  const gradAngle = interpolate(frame, [0, 36], [140, 240], clamp);
  const typeGrad = `linear-gradient(${gradAngle}deg, #7048C0, #A04090, #C84070)`;

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: `translate(calc(-50% + ${w.x}px), calc(-50% + ${w.y}px)) rotate(${w.rot}deg) scale(${bs})`,
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
          transform: `translateY(${noise2D("cursor-y", frame * 0.08, 0) * 0.5}px)`,
        }}
      />
    </div>
  );
};

// --- Phase 5: "Write emails" with gradient pill — Sequence from=123 --------
const P5_FROM = 123;
const PhaseWriteEmails: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P5_FROM;
  const bs = beatScale(abs);
  const w = wobble("write-emails", frame, 1.5, 1.2, 0.025);

  const writeRaw = Math.min(1, frame / 10);
  const writeEased = EASE_OUT_EXPO(writeRaw);
  const writeOpacity = interpolate(writeRaw, [0, 0.2], [0, 1], clamp);

  const emailsRaw = Math.max(0, Math.min(1, (frame - 4) / 12));
  const emailsEased = EASE_OUT_CUBIC(emailsRaw);
  const emailsOpacity = interpolate(emailsRaw, [0, 0.15], [0, 1], clamp);
  const emailsScale = 0.85 + emailsEased * 0.15;

  const pillEntryDist = (1 - emailsEased) * 40;
  const pillRad = (ANGLE_B * Math.PI) / 180;
  const pillOffX = Math.cos(pillRad) * pillEntryDist;
  const pillOffY = Math.sin(pillRad) * pillEntryDist * 0.3;

  const pillBlur = Math.min(pillEntryDist * 0.1, 5);

  const gradAngle = interpolate(frame, [0, 34], [90, 220], clamp) + noise2D("pill-angle", frame * 0.02, 0) * 6;
  const pillGrad = `linear-gradient(${gradAngle}deg, #D04870, #A858B8, #6878E0)`;

  return (
    <div
      style={{
        position: "absolute",
        top: CENTER_Y,
        left: "50%",
        transform: `translate(calc(-50% + ${w.x}px), calc(-50% + ${w.y}px)) rotate(${w.rot}deg) scale(${bs})`,
        fontFamily,
        fontSize: TEXT_SIZE,
        fontWeight: FONT_WEIGHT,
        display: "flex",
        alignItems: "center",
        gap: 12,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          color: TEXT_DARK,
          opacity: writeOpacity,
          transform: `translateY(${(1 - writeEased) * 8}px)`,
        }}
      >
        Write
      </span>
      <span
        style={{
          display: "inline-block",
          opacity: emailsOpacity,
          transform: `translate(${pillOffX}px, ${pillOffY}px) scale(${emailsScale})`,
          filter: pillBlur > 0.4 ? `blur(${pillBlur}px)` : undefined,
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
const SCATTER_SIZES: Record<string, number> = {
  S: 96, o: 52, l: 36, v: 48, e: 44, " ": 48,
  p: 56, r: 40, b: 60, m: 52, s: 38,
  W: 80, i: 36, t: 42,
};

const PhaseLetterScatter: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const letters = text.replace(/ /g, "\u00A0").split("");

  return (
    <AbsoluteFill>
      {letters.map((ch, i) => {
        const angles = [ANGLE_A, ANGLE_B, ANGLE_C, ANGLE_D];
        const baseAngle = angles[i % 4] * (i % 2 === 0 ? 1 : -1);
        const scatterRad = (baseAngle * Math.PI) / 180;
        const scatterDist = 280 + (i % 5) * 60;

        const gravityBias = 40 + (i % 4) * 25;
        const targetX = Math.cos(scatterRad) * scatterDist;
        const targetY = Math.sin(scatterRad) * (scatterDist * 0.5) + gravityBias;
        const targetRot = (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 10);

        const delay = i * 0.35;
        const rawProg = Math.max(0, Math.min(1, (frame - delay) / 16));
        const prog = EASE_OUT_EXPO(rawProg);

        const x = prog * targetX;
        const y = prog * targetY;
        const rot = prog * targetRot;
        const opacity = interpolate(prog, [0, 0.65, 1], [1, 0.5, 0], clamp);

        const letterSize = SCATTER_SIZES[ch] || TEXT_SIZE;
        const sizeScale = interpolate(
          prog,
          [0, 0.4, 1],
          [1, letterSize / TEXT_SIZE, letterSize / TEXT_SIZE],
          clamp,
        );

        const w = wobble(`scatter-${i}`, frame, 4, 3, 0.04);

        // Massive velocity blur during fast scatter
        const prevRawProg = Math.max(0, Math.min(1, (frame - 1 - delay) / 16));
        const prevProg = EASE_OUT_EXPO(prevRawProg);
        const prevX = prevProg * targetX;
        const prevY = prevProg * targetY;
        const dx = x - prevX;
        const dy = y - prevY;
        const vel = Math.sqrt(dx * dx + dy * dy);
        const blur = Math.min(vel * 0.5, 16);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${x + w.x}px), calc(-50% + ${y + w.y}px)) rotate(${rot + w.rot}deg) scale(${sizeScale})`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity,
              filter: blur > 0.5 ? `blur(${blur}px)` : undefined,
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
const SOLVE_SCATTER = [
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

const SOLVE_CHAR_WIDTHS = [32, 28, 14, 28, 26, 16, 28, 18, 28, 28, 14, 26, 38, 18];
const SOLVE_TOTAL_W = SOLVE_CHAR_WIDTHS.reduce((a, b) => a + b, 0);

const P7_FROM = 171;
const PhaseSolveProblems: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P7_FROM;
  const bs = beatScale(abs);
  const text = "Solve problems";
  const letters = text.replace(/ /g, "\u00A0").split("");

  const assembleStart = 8;

  let runningX = -SOLVE_TOTAL_W / 2;
  const finalX = SOLVE_CHAR_WIDTHS.map((cw) => {
    const cx = runningX + cw / 2;
    runningX += cw;
    return cx;
  });

  return (
    <AbsoluteFill>
      {letters.map((ch, i) => {
        const scatter = SOLVE_SCATTER[i] || { x: 0, y: 0, size: 48 };
        const delay = assembleStart + i * 0.3;

        const rawProg = Math.max(0, Math.min(1, (frame - delay) / 18));
        const prog = EASE_OUT_CUBIC(rawProg);

        const x = scatter.x + (finalX[i] - scatter.x) * prog;
        const y = scatter.y + (0 - scatter.y) * prog;
        const sizeScale = (scatter.size / TEXT_SIZE) + (1 - scatter.size / TEXT_SIZE) * prog;

        const fadeIn = interpolate(frame, [i * 0.3, i * 0.3 + 4], [0, 1], clamp);

        const wobbleAmp = 3 * (1 - prog);
        const w = wobble(`solve-${i}`, frame, wobbleAmp, wobbleAmp * 0.7, 0.03);

        const remainDist = Math.sqrt((finalX[i] - x) ** 2 + y ** 2);
        const blur = Math.min(remainDist * 0.02, 6);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${x + w.x}px), calc(-50% + ${y + w.y}px)) scale(${sizeScale * bs}) rotate(${w.rot}deg)`,
              fontFamily,
              fontSize: TEXT_SIZE,
              fontWeight: FONT_WEIGHT,
              color: TEXT_DARK,
              opacity: fadeIn,
              filter: blur > 0.4 ? `blur(${blur}px)` : undefined,
            }}
          >
            {ch}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// --- Phase 8: "Brainstorm ideas" — Sequence from=207 -----------------------
const P8_FROM = 207;
const PhaseBrainstormIdeas: React.FC = () => {
  const frame = useCurrentFrame();
  const abs = frame + P8_FROM;
  const bs = beatScale(abs);

  const floaters = [
    { word: "Brainstorm", x: -260, y: -90, color: "#D44E7A", size: 38, weight: 500, delay: 0 },
    { word: "ideas", x: 240, y: 70, color: "#5B6FD7", size: 44, weight: 500, delay: 2 },
    { word: "Brainstorm", x: 220, y: -50, color: "#8B5FC0", size: 32, weight: 400, delay: 1 },
    { word: "ideas", x: -190, y: 110, color: "#6070D8", size: 36, weight: 500, delay: 3 },
    { word: "ideas", x: -90, y: -130, color: "#9B5FC880", size: 28, weight: 400, delay: 4 },
    { word: "Brainstorm", x: 110, y: 140, color: "#D44E7A80", size: 26, weight: 400, delay: 2 },
    { word: "Brainstorm", x: -330, y: 35, color: "#D44E7A50", size: 22, weight: 300, delay: 5 },
    { word: "ideas", x: 320, y: -35, color: "#5B6FD750", size: 22, weight: 300, delay: 6 },
    { word: "Brainstorm", x: -150, y: 170, color: "#B86CC840", size: 18, weight: 300, delay: 3 },
    { word: "ideas", x: 160, y: -160, color: "#6878E040", size: 18, weight: 300, delay: 5 },
  ];

  const convergeRaw = Math.max(0, Math.min(1, (frame - 14) / 20));
  const converge = EASE_OUT_CUBIC(convergeRaw);

  const finalW = wobble("bs-final", frame, 1.2, 0.8);

  return (
    <>
      {floaters.map((f, i) => {
        const fadeIn = interpolate(frame, [f.delay, f.delay + 8], [0, 0.85], clamp);
        const fadeOut = interpolate(frame, [16, 30], [1, 0], clamp);

        const floatX = f.x + noise2D(`bsf-${i}x`, frame * 0.03, i * 1.5) * 14;
        const floatY = f.y + noise2D(`bsf-${i}y`, i * 2.2, frame * 0.025) * 10;

        const cx = floatX + (0 - floatX) * converge;
        const cy = floatY + (0 - floatY) * converge;

        const w = wobble(`bs-${i}`, frame, 2.5, 1.8, 0.035);

        const speed = Math.sqrt(floatX * floatX + floatY * floatY) * (1 - converge);
        const blur = Math.min(speed * 0.005, 4);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: CENTER_Y,
              left: "50%",
              transform: `translate(calc(-50% + ${cx + w.x}px), calc(-50% + ${cy + w.y}px)) rotate(${w.rot}deg)`,
              fontFamily,
              fontSize: f.size,
              fontWeight: f.weight,
              color: f.color,
              opacity: fadeIn * fadeOut,
              whiteSpace: "nowrap",
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
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
          transform: `translate(calc(-50% + ${finalW.x}px), calc(-50% + ${finalW.y}px)) scale(${bs})`,
          fontFamily,
          fontSize: TEXT_SIZE,
          fontWeight: FONT_WEIGHT,
          color: TEXT_DARK,
          opacity: converge,
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

      {/* Beat-synced: phases nudged ±3 frames to nearest audio beat */}
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
