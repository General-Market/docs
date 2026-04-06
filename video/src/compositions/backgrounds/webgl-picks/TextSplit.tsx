// Source: https://codepen.io/hexagoncircle/full/MWgbqON
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

/**
 * 1:1 reproduction of hexagoncircle's "Animated Verbs" CodePen.
 *
 * Original: 6 full-viewport snap sections, each with a single verb whose
 * characters are split by Splitting.js and animated via CSS keyframes.
 * Per-character --char-index drives stagger delays. Font: Lexend Deca 700.
 *
 * Here: scroll is mapped to frame progress. Each section occupies 1/6 of the
 * total duration (50 frames). Within each section, the character animations
 * loop continuously, driven by useCurrentFrame() and interpolate().
 */

// ── Section data — word, modifier class, background color ─────────────────

interface VerbSection {
  word: string;
  color: string;
  type: "jump" | "float" | "jog" | "flip" | "twirl" | "fall";
}

const SECTIONS: VerbSection[] = [
  { word: "jumping", color: "#f9ca24", type: "jump" },
  { word: "floating", color: "#3498db", type: "float" },
  { word: "jogging", color: "#ff7979", type: "jog" },
  { word: "flipping", color: "#1abc9c", type: "flip" },
  { word: "twirling", color: "#e74c3c", type: "twirl" },
  { word: "falling", color: "#f8c291", type: "fall" },
];


// ── Cubic-bezier helper ──────────────────────────────────────────────────
// Attempt to solve the cubic bezier for t given x, using Newton-Raphson.
// CSS cubic-bezier(x1, y1, x2, y2) maps input time to output progress.

function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Bernstein basis for the x(t) and y(t) parametric curves
    const sampleCurveX = (s: number) =>
      ((1 - 3 * x2 + 3 * x1) * s + (3 * x2 - 6 * x1)) * s + 3 * x1 * s;
    const sampleCurveY = (s: number) =>
      ((1 - 3 * y2 + 3 * y1) * s + (3 * y2 - 6 * y1)) * s + 3 * y1 * s;
    const sampleCurveDerivativeX = (s: number) =>
      (3 * (1 - 3 * x2 + 3 * x1)) * s * s +
      2 * (3 * x2 - 6 * x1) * s +
      3 * x1;

    // Newton-Raphson to find parameter s where x(s) = t
    let s = t;
    for (let i = 0; i < 8; i++) {
      const currentX = sampleCurveX(s) - t;
      if (Math.abs(currentX) < 1e-6) break;
      const dx = sampleCurveDerivativeX(s);
      if (Math.abs(dx) < 1e-6) break;
      s -= currentX / dx;
    }
    return sampleCurveY(s);
  };
}

// The easing used by jump and fall: cubic-bezier(0.165, 0.44, 0.64, 1)
const jumpFallEasing = cubicBezier(0.165, 0.44, 0.64, 1);

// ── Animation functions — each returns a CSS transform string ──────────────
// All accept:
//   charIndex: the character's position in the word (0-based)
//   sectionFrame: how many frames into this section we are (0..49)
//   fps: frames per second from video config

function animateFall(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 600ms, --del: charIndex * -0.05s, --tf: cubic-bezier(0.165, 0.44, 0.64, 1)
  const durationMs = 600;
  const delayMs = charIndex * -50; // -0.05s
  const durationFrames = (durationMs / 1000) * fps;

  // Effective time with negative delay (shifts animation forward)
  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  const cycleProgress =
    ((effectiveFrame % durationFrames) + durationFrames) % durationFrames;
  const t = jumpFallEasing(cycleProgress / durationFrames);

  // Keyframes: 0% rotateY(-25), 25% translateY(2%) rotateY(25),
  //            50% rotateY(-25), 75% translateY(4%) rotateY(25), 100% rotateY(-25)
  const rotateY = interpolate(
    t,
    [0, 0.25, 0.5, 0.75, 1],
    [-25, 25, -25, 25, -25],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const translateYPct = interpolate(
    t,
    [0, 0.25, 0.5, 0.75, 1],
    [0, 2, 0, 4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return `translateY(${translateYPct}%) rotateY(${rotateY}deg)`;
}

function animateFlip(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 4000ms, --del: charIndex * 0.075s, --tf: linear
  const durationMs = 4000;
  const delayMs = charIndex * 75;
  const durationFrames = (durationMs / 1000) * fps;

  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  const cycleProgress =
    ((effectiveFrame % durationFrames) + durationFrames) % durationFrames;
  const t = cycleProgress / durationFrames;

  // Keyframes: 5% 1turn, 10% 2turn, 20% 3turn, 40% 4turn, 70-100% 5turn
  // This is a decelerating multi-rotation: fast at start, slow at end
  const turns = interpolate(
    t,
    [0, 0.05, 0.1, 0.2, 0.4, 0.7, 1],
    [0, 1, 2, 3, 4, 5, 5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return `rotateX(${turns * 360}deg)`;
}

function animateFloat(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 2200ms, --del: charIndex * -0.5s, --tf: ease-in-out, --dir: alternate
  // Even chars use "float", odd chars use "float-alt"
  const durationMs = 2200;
  const delayMs = charIndex * -500;
  const durationFrames = (durationMs / 1000) * fps;
  const isAlt = charIndex % 2 === 1;

  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  // Alternating direction: ping-pong
  const fullCycles = effectiveFrame / durationFrames;
  const cycleIndex = Math.floor(Math.abs(fullCycles));
  const rawT =
    ((Math.abs(effectiveFrame) % durationFrames) + durationFrames) %
    durationFrames;
  let t = rawT / durationFrames;

  // Alternate: reverse on odd cycles
  if (cycleIndex % 2 === 1) {
    t = 1 - t;
  }

  // Apply ease-in-out
  const eased = Easing.inOut(Easing.ease)(t);

  if (isAlt) {
    // float-alt: from translate(0%, -5%) rotate(-1deg) to translate(2%, 10%) rotate(3deg)
    const tx = interpolate(eased, [0, 1], [0, 2]);
    const ty = interpolate(eased, [0, 1], [-5, 10]);
    const rot = interpolate(eased, [0, 1], [-1, 3]);
    return `translate(${tx}%, ${ty}%) rotate(${rot}deg)`;
  }
  // float: from translate(2%, -10%) rotate(-1deg) to translate(-2%, 5%) rotate(3deg)
  const tx = interpolate(eased, [0, 1], [2, -2]);
  const ty = interpolate(eased, [0, 1], [-10, 5]);
  const rot = interpolate(eased, [0, 1], [-1, 3]);
  return `translate(${tx}%, ${ty}%) rotate(${rot}deg)`;
}

function animateJog(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 500ms, --del: charIndex * -0.025s, --tf: linear
  const durationMs = 500;
  const delayMs = charIndex * -25;
  const durationFrames = (durationMs / 1000) * fps;

  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  const cycleProgress =
    ((effectiveFrame % durationFrames) + durationFrames) % durationFrames;
  const t = cycleProgress / durationFrames;

  // 0% translate(0,0) rotate(5), 25% translate(5%,-5%) rotate(10),
  // 50% translate(5%,0) rotate(15), 75% translate(10%,-5%) rotate(10),
  // 100% translate(0,0) rotate(5)
  const tx = interpolate(t, [0, 0.25, 0.5, 0.75, 1], [0, 5, 5, 10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ty = interpolate(t, [0, 0.25, 0.5, 0.75, 1], [0, -5, 0, -5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rot = interpolate(t, [0, 0.25, 0.5, 0.75, 1], [5, 10, 15, 10, 5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return `translate(${tx}%, ${ty}%) rotate(${rot}deg)`;
}

function animateJump(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 800ms, --del: charIndex * 0.075s, --tf: cubic-bezier(0.165, 0.44, 0.64, 1)
  const durationMs = 800;
  const delayMs = charIndex * 75;
  const durationFrames = (durationMs / 1000) * fps;

  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  const cycleProgress =
    ((effectiveFrame % durationFrames) + durationFrames) % durationFrames;
  const t = jumpFallEasing(cycleProgress / durationFrames);

  // 0% identity, 20% translateY(2%) scaleY(0.9), 40% translateY(-100%) scaleY(1.2),
  // 50% translateY(10%) scaleY(0.8), 70% translateY(-5%) scaleY(1), 80-100% identity
  const ty = interpolate(
    t,
    [0, 0.2, 0.4, 0.5, 0.7, 0.8, 1],
    [0, 2, -100, 10, -5, 0, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const sy = interpolate(
    t,
    [0, 0.2, 0.4, 0.5, 0.7, 0.8, 1],
    [1, 0.9, 1.2, 0.8, 1, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return `translateY(${ty}%) scaleY(${sy})`;
}

function animateTwirl(charIndex: number, sectionFrame: number, fps: number) {
  // --dur: 6000ms, --del: charIndex * 0.025s, --tf: linear
  const durationMs = 6000;
  const delayMs = charIndex * 25;
  const durationFrames = (durationMs / 1000) * fps;

  const effectiveFrame = sectionFrame - (delayMs / 1000) * fps;
  const cycleProgress =
    ((effectiveFrame % durationFrames) + durationFrames) % durationFrames;
  const t = cycleProgress / durationFrames;

  // 2.5% 1turn, 5% 2turn, 10% 3turn, 20% 4turn, 40% 5turn, 70-100% 6turn
  const turns = interpolate(
    t,
    [0, 0.025, 0.05, 0.1, 0.2, 0.4, 0.7, 1],
    [0, 1, 2, 3, 4, 5, 6, 6],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return `rotateY(${turns * 360}deg)`;
}

// ── Dispatcher ────────────────────────────────────────────────────────────

function getCharTransform(
  type: VerbSection["type"],
  charIndex: number,
  sectionFrame: number,
  fps: number,
): string {
  switch (type) {
    case "fall":
      return animateFall(charIndex, sectionFrame, fps);
    case "flip":
      return animateFlip(charIndex, sectionFrame, fps);
    case "float":
      return animateFloat(charIndex, sectionFrame, fps);
    case "jog":
      return animateJog(charIndex, sectionFrame, fps);
    case "jump":
      return animateJump(charIndex, sectionFrame, fps);
    case "twirl":
      return animateTwirl(charIndex, sectionFrame, fps);
  }
}

// ── Single character span ─────────────────────────────────────────────────

const AnimatedChar: React.FC<{
  char: string;
  charIndex: number;
  sectionFrame: number;
  type: VerbSection["type"];
  fps: number;
}> = ({ char, charIndex, sectionFrame, type, fps }) => {
  const transform = getCharTransform(type, charIndex, sectionFrame, fps);

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        transformOrigin: "50% 100%",
        transform,
        zIndex: 1,
      }}
    >
      {char}
    </span>
  );
};

// ── Single section ────────────────────────────────────────────────────────

const VerbSectionView: React.FC<{
  section: VerbSection;
  sectionFrame: number;
  scrollOffset: number;
  width: number;
  height: number;
  fps: number;
}> = ({ section, sectionFrame, scrollOffset, width, height, fps }) => {
  const chars = section.word.split("");

  // Font size: original uses calc(1rem + 15vmin). At 1920x1080,
  // vmin = 10.8, so 15vmin = 162. Plus 1rem (~16px) = ~178px.
  const vmin = Math.min(width, height) / 100;
  const fontSize = 16 + 15 * vmin;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        transform: `translateY(${-scrollOffset}px)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: section.color,
        fontFamily: '"Lexend Deca", sans-serif',
        fontWeight: 700,
        fontSize,
        overflow: "hidden",
        perspective: 1000,
        color: "black",
      }}
    >
      {chars.map((c, i) => (
        <AnimatedChar
          key={i}
          char={c}
          charIndex={i}
          sectionFrame={sectionFrame}
          type={section.type}
          fps={fps}
        />
      ))}
    </div>
  );
};

// ── Main composition ──────────────────────────────────────────────────────

export const TextSplit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  // Scroll progress: 0 at frame 0, 1 at the last frame.
  // This simulates the vertical scroll through 6 snap sections.
  const scrollProgress = frame / (durationInFrames - 1);

  // Total scrollable height: 6 sections * viewport height.
  // We scroll from section 0 (top) through section 5 (bottom).
  const totalScrollHeight = SECTIONS.length * height;
  const scrollY = scrollProgress * (totalScrollHeight - height);

  // Determine which section is currently visible (or transitioning between)
  const sectionIndex = Math.min(
    SECTIONS.length - 1,
    Math.floor(scrollY / height),
  );

  // Render the current section and the next (for smooth scroll transitions)
  const visibleSections: number[] = [sectionIndex];
  if (sectionIndex < SECTIONS.length - 1) {
    visibleSections.push(sectionIndex + 1);
  }

  // Section-local frame: cycles continuously for the animation loops.
  // We use the global frame so animations keep running smoothly.
  const globalSectionFrame = frame;

  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: "#000" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Lexend+Deca:wght@700&display=swap"
        rel="stylesheet"
      />
      {visibleSections.map((idx) => {
        const section = SECTIONS[idx];
        const sectionTop = idx * height;
        const scrollOffset = scrollY - sectionTop;

        return (
          <VerbSectionView
            key={idx}
            section={section}
            sectionFrame={globalSectionFrame}
            scrollOffset={scrollOffset}
            width={width}
            height={height}
            fps={fps}
          />
        );
      })}
    </AbsoluteFill>
  );
};
