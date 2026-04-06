// Source: https://github.com/codrops/ParticleEffectsButtons/
//
// Original by Luis Manuel (Codrops, 2018). A particle dissolution system for
// buttons: on click, the button slides away while canvas-2D particles burst
// from the dissolution edge. Particles drift at random angles with sinusoidal
// oscillation, fading as they age. Each particle has random size, speed, angle,
// and a sine-wave counter that produces organic motion.
//
// Remotion adaptation: useCurrentFrame() drives 3 dissolution events across
// 360 frames at 60fps. Canvas 2D — no Three.js, no anime.js. The particle
// physics are a direct port of the original's updateParticles/renderParticles
// loop with addParticle's exact parameter structure.

import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

// ── Types ported from particles.js ─────────────────────────────────────────

interface Particle {
  startX: number;
  startY: number;
  x: number;
  y: number;
  color: string;
  angle: number;
  counter: number;
  increase: number;
  life: number;
  death: number;
  speed: number;
  size: number;
}

type ParticleType = "circle" | "triangle" | "rectangle";
type ParticleStyle = "fill" | "stroke";
type Direction = "left" | "right" | "top" | "bottom";

interface ButtonConfig {
  label: string;
  bgColor: string;
  textColor: string;
  borderRadius: number;
  border: string;
  particleColor: string | (() => string);
  particleType: ParticleType;
  particleStyle: ParticleStyle;
  direction: Direction;
  duration: number; // in frames
  size: number | (() => number);
  speed: number | (() => number);
  particlesAmountCoefficient: number;
  oscillationCoefficient: number;
  easing: (t: number) => number;
  gradient?: string;
  padding: string;
  // Timeline: frame at which dissolution begins
  triggerFrame: number;
}

// ── Seeded random — deterministic across renders ───────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function rand(value: number, rng: () => number): number {
  return rng() * value - value / 2;
}

// ── Resolve value (function or constant) — matches original's is.fnc pattern ─

function resolve<T>(v: T | (() => T)): T {
  return typeof v === "function" ? (v as () => T)() : v;
}

// ── Easing functions matching anime.js names ───────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function easeInExpo(t: number): number {
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
}

// ── Button configurations — 3 styles from the original demo ────────────────

const BUTTONS: ButtonConfig[] = [
  // Theme 1: "Send" — dark button, circle particles, dissolves left
  {
    label: "Send",
    bgColor: "#121019",
    textColor: "#fff",
    borderRadius: 5,
    border: "none",
    particleColor: "#121019",
    particleType: "circle",
    particleStyle: "fill",
    direction: "left",
    duration: 60, // 1s at 60fps
    size: () => Math.floor(Math.random() * 3) + 1,
    speed: () => Math.random() * 4 - 2,
    particlesAmountCoefficient: 3,
    oscillationCoefficient: 20,
    easing: easeInOutCubic,
    padding: "24px 48px",
    triggerFrame: 30,
  },
  // Theme 7: "Subscribe" — rectangle stroke particles, right direction
  {
    label: "Subscribe",
    bgColor: "#e2405b",
    textColor: "#e9e9e9",
    borderRadius: 0,
    border: "none",
    particleColor: "#e87084",
    particleType: "rectangle",
    particleStyle: "stroke",
    direction: "right",
    duration: 36, // 600ms
    size: 15,
    speed: () => Math.random() * 4 - 2,
    particlesAmountCoefficient: 2,
    oscillationCoefficient: 5,
    easing: easeOutQuart,
    padding: "28px 72px",
    triggerFrame: 140,
  },
  // Theme 5: "Refresh" — small circle particles, high density, slow dissolve
  {
    label: "Refresh",
    bgColor: "#003ff1",
    textColor: "#fff",
    borderRadius: 5,
    border: "none",
    particleColor: "#003ff1",
    particleType: "circle",
    particleStyle: "fill",
    direction: "left",
    duration: 78, // 1.3s
    size: 3,
    speed: 1,
    particlesAmountCoefficient: 10,
    oscillationCoefficient: 1,
    easing: easeInExpo,
    padding: "16px 32px",
    triggerFrame: 240,
  },
];

// ── Canvas padding — matches original default ──────────────────────────────

const CANVAS_PADDING = 150;

// ── Deterministic particle generation for a single button dissolution ──────

function generateDissolutionParticles(
  config: ButtonConfig,
  buttonRect: { x: number; y: number; width: number; height: number },
  masterSeed: number,
): Particle[] {
  const rng = seededRandom(masterSeed);
  const particles: Particle[] = [];
  const frames = config.duration;
  const isHorizontal =
    config.direction === "left" || config.direction === "right";

  // Walk through the dissolution progress, spawning particles at each step
  // This replicates addParticles() being called each frame by anime.js update
  const steps = frames;
  let lastProgress = 0;

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const progress = config.easing(t);
    const progressDiff = progress - lastProgress;
    lastProgress = progress;

    if (progressDiff <= 0) continue;

    // Spawn position — from the dissolution edge
    const progressValue =
      (isHorizontal ? buttonRect.width : buttonRect.height) * progress +
      progressDiff * 100;

    let baseX = CANVAS_PADDING;
    let baseY = CANVAS_PADDING;

    if (isHorizontal) {
      baseX +=
        config.direction === "left"
          ? progressValue
          : buttonRect.width - progressValue;
    } else {
      baseY +=
        config.direction === "top"
          ? progressValue
          : buttonRect.height - progressValue;
    }

    // Number of particles — matches original formula
    const count = Math.floor(
      config.particlesAmountCoefficient * (progressDiff * 100 + 1),
    );

    for (let i = 0; i < count; i++) {
      const speed = resolve(config.speed);
      const color = resolve(config.particleColor);
      const size = resolve(config.size);

      // Provide rng-driven randomness for position spread
      const spreadX = isHorizontal ? 0 : buttonRect.width * rng();
      const spreadY = isHorizontal ? buttonRect.height * rng() : 0;

      particles.push({
        startX: baseX + spreadX,
        startY: baseY + spreadY,
        x: 0,
        y: 0,
        color,
        angle: rand(360, rng),
        counter: 0,
        increase: (Math.PI * 2) / 100,
        life: 0,
        death: frames - 20 + rng() * 40,
        speed: speed < 0 ? speed : Math.abs(speed) * (rng() > 0.5 ? 1 : -1),
        size,
      });
    }

    // Advance existing particles by one step (they were born at `step`)
    // Set their birth step so we can compute their state at any frame
    for (let p = particles.length - count; p < particles.length; p++) {
      if (p >= 0) {
        (particles[p] as any)._birthStep = step;
      }
    }
  }

  return particles;
}

// ── Compute particle state at a given frame offset from trigger ─────────────

function particleStateAtFrame(
  p: Particle & { _birthStep?: number },
  frameOffset: number,
  oscillationCoefficient: number,
): { x: number; y: number; alpha: number; alive: boolean } {
  const birthStep = p._birthStep ?? 0;
  const age = frameOffset - birthStep;

  if (age < 0 || age > p.death) {
    return { x: 0, y: 0, alpha: 0, alive: false };
  }

  const x = p.speed * age;
  const counter = age;
  const y = oscillationCoefficient * Math.sin(counter * p.increase);
  const alpha = 1 - age / p.death;

  return { x, y, alpha, alive: true };
}

// ── Render particles to an offscreen canvas (called per-frame) ─────────────

function renderParticlesToCanvas(
  ctx: CanvasRenderingContext2D,
  particles: (Particle & { _birthStep?: number })[],
  frameOffset: number,
  config: ButtonConfig,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  for (const p of particles) {
    const state = particleStateAtFrame(
      p,
      frameOffset,
      config.oscillationCoefficient,
    );
    if (!state.alive || state.alpha <= 0) continue;

    ctx.save();
    ctx.translate(p.startX, p.startY);
    ctx.rotate((p.angle * Math.PI) / 180);
    ctx.globalAlpha = Math.max(0, Math.min(1, state.alpha));
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;
    ctx.beginPath();

    if (config.particleType === "circle") {
      ctx.arc(state.x, state.y, p.size, 0, 2 * Math.PI);
    } else if (config.particleType === "triangle") {
      ctx.moveTo(state.x, state.y);
      ctx.lineTo(state.x + p.size, state.y + p.size);
      ctx.lineTo(state.x + p.size, state.y - p.size);
    } else if (config.particleType === "rectangle") {
      ctx.rect(state.x, state.y, p.size, p.size);
    }

    if (config.particleStyle === "fill") {
      ctx.fill();
    } else {
      ctx.closePath();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Single button + particle system component ──────────────────────────────

const BUTTON_FONT_SIZE = 18;
const BUTTON_FONT = `600 ${BUTTON_FONT_SIZE}px Montserrat, Helvetica, Arial, sans-serif`;

interface ButtonSceneProps {
  config: ButtonConfig;
  x: number;
  y: number;
  buttonWidth: number;
  buttonHeight: number;
  frame: number;
  seed: number;
}

const ButtonScene: React.FC<ButtonSceneProps> = ({
  config,
  x,
  y,
  buttonWidth,
  buttonHeight,
  frame,
  seed,
}) => {
  const frameOffset = frame - config.triggerFrame;
  const isHorizontal =
    config.direction === "left" || config.direction === "right";

  // Dissolution progress: 0 → 1 over config.duration
  const progress = useMemo(() => {
    if (frameOffset < 0) return 0;
    if (frameOffset >= config.duration) return 1;
    return config.easing(frameOffset / config.duration);
  }, [frameOffset, config]);

  // Button slide transform — matches original addTransforms()
  const translateValue = useMemo(() => {
    if (frameOffset < 0) return 0;
    const raw = progress * 100;
    return config.direction === "left" || config.direction === "top"
      ? raw
      : -raw;
  }, [frameOffset, progress, config.direction]);

  // Generate all particles deterministically
  const particles = useMemo(
    () =>
      generateDissolutionParticles(
        config,
        { x: 0, y: 0, width: buttonWidth, height: buttonHeight },
        seed,
      ),
    [config, buttonWidth, buttonHeight, seed],
  );

  // Render particles to data URL
  const canvasWidth = buttonWidth + CANVAS_PADDING * 2;
  const canvasHeight = buttonHeight + CANVAS_PADDING * 2;

  const particleDataUrl = useMemo(() => {
    if (frameOffset < 0 || frameOffset > config.duration + 60) return null;

    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    renderParticlesToCanvas(
      ctx,
      particles,
      frameOffset,
      config,
      canvasWidth,
      canvasHeight,
    );

    return canvas.toDataURL();
  }, [frameOffset, particles, config, canvasWidth, canvasHeight]);

  // Button visibility — hidden after dissolution completes
  const buttonVisible = progress < 1;
  const buttonOpacity = buttonVisible ? 1 : 0;

  // Wrapper transform (button slides one way, content slides opposite)
  const wrapperTransform = isHorizontal
    ? `translateX(${translateValue}%)`
    : `translateY(${translateValue}%)`;

  const contentTransform = isHorizontal
    ? `translateX(${-translateValue}%)`
    : `translateY(${-translateValue}%)`;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
      }}
    >
      {/* Particle canvas overlay — centered on button */}
      {particleDataUrl && (
        <img
          src={particleDataUrl}
          style={{
            position: "absolute",
            left: -CANVAS_PADDING,
            top: -CANVAS_PADDING,
            width: canvasWidth,
            height: canvasHeight,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Button wrapper — slides away during dissolution */}
      <div
        style={{
          overflow: "hidden",
          willChange: "transform",
          transform: wrapperTransform,
          opacity: buttonOpacity,
        }}
      >
        <div
          style={{
            background: config.gradient || config.bgColor,
            color: config.textColor,
            borderRadius: config.borderRadius,
            border: config.border,
            padding: config.padding,
            font: BUTTON_FONT,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            userSelect: "none",
            willChange: "transform",
            transform: contentTransform,
          }}
        >
          {config.label}
        </div>
      </div>
    </div>
  );
};

// ── Cursor animation — a ghost cursor clicks each button ───────────────────

const CursorOverlay: React.FC<{
  frame: number;
  buttonPositions: { x: number; y: number; w: number; h: number }[];
}> = ({ frame, buttonPositions }) => {
  // Cursor moves to each button before its trigger frame
  const cursorSize = 20;

  // Determine which button the cursor is heading toward
  const triggerFrames = BUTTONS.map((b) => b.triggerFrame);

  let targetIdx = 0;
  for (let i = 0; i < triggerFrames.length; i++) {
    if (frame < triggerFrames[i] + 10) {
      targetIdx = i;
      break;
    }
    if (i === triggerFrames.length - 1) targetIdx = i;
  }

  const target = buttonPositions[targetIdx];
  const targetX = target.x + target.w / 2;
  const targetY = target.y + target.h / 2;

  // Cursor starts off-screen left, moves to each button
  const prevTrigger = targetIdx > 0 ? triggerFrames[targetIdx - 1] + 20 : 0;
  const arrivalFrame = triggerFrames[targetIdx] - 5;

  const cursorX = interpolate(
    frame,
    [prevTrigger, arrivalFrame],
    [
      targetIdx === 0 ? -40 : buttonPositions[targetIdx - 1].x + buttonPositions[targetIdx - 1].w / 2,
      targetX,
    ],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  const cursorY = interpolate(
    frame,
    [prevTrigger, arrivalFrame],
    [
      targetIdx === 0 ? buttonPositions[0].y + buttonPositions[0].h / 2 : buttonPositions[targetIdx - 1].y + buttonPositions[targetIdx - 1].h / 2,
      targetY,
    ],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  // Click flash at trigger frame
  const isClicking =
    frame >= triggerFrames[targetIdx] &&
    frame < triggerFrames[targetIdx] + 8;

  const clickScale = isClicking
    ? interpolate(
        frame,
        [triggerFrames[targetIdx], triggerFrames[targetIdx] + 8],
        [0.7, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      )
    : 1;

  // Hide cursor after last dissolution completes
  const lastEnd =
    triggerFrames[triggerFrames.length - 1] +
    BUTTONS[BUTTONS.length - 1].duration +
    30;
  if (frame > lastEnd) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: cursorX - cursorSize / 2,
        top: cursorY - cursorSize / 2,
        width: cursorSize,
        height: cursorSize,
        pointerEvents: "none",
        zIndex: 100,
        transform: `scale(${clickScale})`,
      }}
    >
      {/* Cursor arrow — CSS triangle */}
      <svg
        width={cursorSize}
        height={cursorSize}
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.4))" }}
      >
        <path
          d="M5 3L5 21L10 16L16 21L12 10L19 10L5 3Z"
          fill="#fff"
          stroke="#000"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Click ripple */}
      {isClicking && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 40,
            height: 40,
            marginLeft: -20,
            marginTop: -20,
            borderRadius: "50%",
            border: "2px solid rgba(255,255,255,0.6)",
            opacity: interpolate(
              frame,
              [triggerFrames[targetIdx], triggerFrames[targetIdx] + 8],
              [0.8, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            ),
            transform: `scale(${interpolate(
              frame,
              [triggerFrames[targetIdx], triggerFrames[targetIdx] + 8],
              [0.3, 1.5],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )})`,
          }}
        />
      )}
    </div>
  );
};

// ── Background gradients — one per button, matching original themes ────────

const GRADIENTS = [
  "linear-gradient(120deg, #a8edea 0%, #fed6e3 100%)", // theme-1
  "linear-gradient(-20deg, #f794a4 0%, #fdd6bd 100%)", // theme-7
  "linear-gradient(120deg, #baedff 0%, #07a2da 100%)", // theme-5
];

// ── Main composition ───────────────────────────────────────────────────────

export const ParticleButtons: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Layout: 3 buttons stacked vertically, centered
  const buttonWidth = 260;
  const buttonHeight = 64;
  const gap = 100;
  const totalHeight = BUTTONS.length * buttonHeight + (BUTTONS.length - 1) * gap;
  const startY = (height - totalHeight) / 2;

  const buttonPositions = BUTTONS.map((_, i) => ({
    x: (width - buttonWidth) / 2,
    y: startY + i * (buttonHeight + gap),
    w: buttonWidth,
    h: buttonHeight,
  }));

  // Background gradient transitions based on which button is active
  const bgIndex = frame < 140 ? 0 : frame < 240 ? 1 : 2;
  const bgOpacity = interpolate(
    frame,
    [0, 15, 135, 145, 235, 245],
    [0, 1, 1, 1, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Title fade
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // End card fade
  const endFade = interpolate(frame, [330, 355], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: GRADIENTS[bgIndex],
        opacity: bgOpacity,
        fontFamily: "Montserrat, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: startY - 80,
          width: "100%",
          textAlign: "center",
          fontSize: 14,
          fontWeight: 600,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.4)",
          opacity: titleOpacity,
        }}
      >
        Particle Effects for Buttons
      </div>

      {/* Buttons */}
      {BUTTONS.map((config, i) => (
        <ButtonScene
          key={config.label}
          config={config}
          x={buttonPositions[i].x}
          y={buttonPositions[i].y}
          buttonWidth={buttonWidth}
          buttonHeight={buttonHeight}
          frame={frame}
          seed={42 + i * 1337}
        />
      ))}

      {/* Cursor */}
      <CursorOverlay frame={frame} buttonPositions={buttonPositions} />

      {/* End card — all dissolved */}
      {endFade > 0 && (
        <div
          style={{
            position: "absolute",
            bottom: 80,
            width: "100%",
            textAlign: "center",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "2px",
            textTransform: "uppercase",
            color: "rgba(0,0,0,0.35)",
            opacity: endFade,
          }}
        >
          codrops / ParticleEffectsButtons
        </div>
      )}
    </AbsoluteFill>
  );
};
