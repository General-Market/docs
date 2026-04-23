/**
 * WordParticleTransition — text A shatters into particles, particles fly
 * (some past the camera), then converge to form text B.
 *
 * Supports different origin/target positions via fromCenter/toCenter offsets
 * (relative to component center). This lets particles travel across the screen
 * — e.g. from a side panel down to below the webcam.
 *
 * Pure CSS transforms + Remotion interpolate. No GSAP, no Three.js, no Canvas.
 */

import React, { useMemo } from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { noise2D } from "@remotion/noise";
import { measureText } from "@remotion/layout-utils";
import { seededRandom, seededRange } from "../../utils/random";

const CL = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface PhaseTiming {
  holdFrom?: number;
  break?: number;
  travel?: number;
  reform?: number;
  holdTo?: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface WordParticleTransitionProps {
  fromText: string;
  toText: string;
  durationInFrames: number;
  fontFamily: string;
  fontSize: number;
  fontWeight?: number;
  textColor?: string;
  particleColors?: string[];
  fragmentCount?: number;
  seed?: number;
  cameraPassFraction?: number;
  perspective?: number;
  glowEnabled?: boolean;
  phaseTiming?: PhaseTiming;
  /** Offset from component center where fromText originates (px). Default {0,0} */
  fromCenter?: Point;
  /** Offset from component center where toText converges (px). Default {0,0} */
  toCenter?: Point;
  /** Whether to render fromText. Set false if source is already visible elsewhere. */
  renderFromText?: boolean;
  /** When set, fragments render as text labels (e.g. "+12.3%") instead of rectangles.
   *  Function receives fragment id and returns the label string. */
  fragmentLabel?: (id: number) => string;
  /** Font size for text fragments (only used when fragmentLabel is set) */
  fragmentFontSize?: number;
  /** Disable per-fragment rotation (keeps text readable) */
  noRotation?: boolean;
  /** All fragments explode at the same frame (no stagger delay) */
  noStagger?: boolean;
  style?: React.CSSProperties;
}

interface Fragment {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  breakAngle: number;
  breakDistance: number;
  curveStrength: number;
  rotationSpeed: number;
  delay: number;
  reformDelay: number;
  width: number;
  height: number;
  colorIndex: number;
  isCameraPass: boolean;
  zPeak: number;
}

interface Phases {
  holdFromEnd: number;
  breakEnd: number;
  travelEnd: number;
  reformEnd: number;
}

const DEFAULT_COLORS = ["#9fe870", "#34D399", "#10B981", "#059669", "#cdffad"];

// ── Phase computation ──────────────────────────────────────────────────────

function computePhases(dur: number, timing?: PhaseTiming): Phases {
  const hf = timing?.holdFrom ?? 0.08;
  const br = timing?.break ?? 0.22;
  const tr = timing?.travel ?? 0.40;
  const rf = timing?.reform ?? 0.22;
  const ht = timing?.holdTo ?? 0.08;
  const sum = hf + br + tr + rf + ht;
  const scale = dur / sum;

  const holdFrom = Math.round(hf * scale);
  const breakDur = Math.round(br * scale);
  const travelDur = Math.round(tr * scale);
  const reformDur = Math.round(rf * scale);

  return {
    holdFromEnd: holdFrom,
    breakEnd: holdFrom + breakDur,
    travelEnd: holdFrom + breakDur + travelDur,
    reformEnd: holdFrom + breakDur + travelDur + reformDur,
  };
}

// ── Character bounding boxes (centered at 0,0) ────────────────────────────

interface CharBox {
  x: number;
  w: number;
  h: number;
}

function measureCharBoxes(
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
): CharBox[] {
  const flat = text.replace(/\n/g, " ");
  const totalWidth = measureText({
    text: flat,
    fontFamily,
    fontSize,
    fontWeight: String(fontWeight),
  }).width;

  const boxes: CharBox[] = [];
  let xCursor = 0;

  for (const char of flat) {
    const charWidth = measureText({
      text: char,
      fontFamily,
      fontSize,
      fontWeight: String(fontWeight),
    }).width;

    boxes.push({
      x: xCursor - totalWidth / 2 + charWidth / 2,
      w: charWidth,
      h: fontSize,
    });
    xCursor += charWidth;
  }
  return boxes;
}

// ── Fragment generation ────────────────────────────────────────────────────

function generateFragments(
  fromText: string,
  toText: string,
  count: number,
  seed: number,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  cameraPassFraction: number,
  fromCenter: Point,
  toCenter: Point,
  noRotation: boolean,
  noStagger: boolean,
): Fragment[] {
  const fromBoxes = measureCharBoxes(fromText, fontFamily, fontSize, fontWeight);
  const toBoxes = measureCharBoxes(toText, fontFamily, fontSize, fontWeight);

  const fragments: Fragment[] = [];
  const cameraPassCount = Math.floor(count * cameraPassFraction);

  for (let i = 0; i < count; i++) {
    const s = seed + i * 137;
    const r = (n: number) => seededRandom(s + n * 31);

    const fromBox = fromBoxes[i % fromBoxes.length];
    const toBox = toBoxes[i % toBoxes.length];

    // Positions in component-center-relative coordinates
    const fromX = fromCenter.x + fromBox.x + (r(0) - 0.5) * fromBox.w;
    const fromY = fromCenter.y + (r(1) - 0.5) * fromBox.h;
    const toX = toCenter.x + toBox.x + (r(2) - 0.5) * toBox.w;
    const toY = toCenter.y + (r(3) - 0.5) * toBox.h;

    const breakAngle = r(4) * Math.PI * 2;
    const isCameraPass = i < cameraPassCount;

    fragments.push({
      id: i,
      fromX,
      fromY,
      toX,
      toY,
      breakAngle,
      breakDistance: seededRange(s + 500, 500, 1800),
      curveStrength: (r(5) - 0.5) * 700,
      rotationSpeed: noRotation ? 0 : (r(6) - 0.5) * 10,
      delay: noStagger ? 0 : r(7) * 5,
      reformDelay: noStagger ? 0 : r(8) * 5,
      width: seededRange(s + 900, 3, 14),
      height: seededRange(s + 1000, 3, 16),
      colorIndex: Math.floor(r(9) * 100),
      isCameraPass,
      zPeak: isCameraPass
        ? seededRange(s + 1100, 600, 1050)
        : seededRange(s + 1200, -80, 150),
    });
  }

  return fragments;
}

// ── Per-fragment state ─────────────────────────────────────────────────────

interface FragState {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  opacity: number;
  blur: number;
}

function scatteredPos(frag: Fragment) {
  const nx = noise2D("nx" + frag.id, 2, frag.id * 0.1) * 120;
  const ny = noise2D("ny" + frag.id, frag.id * 0.1, 2) * 120;

  return {
    x:
      frag.fromX +
      Math.cos(frag.breakAngle) * frag.breakDistance * 1.25 +
      nx,
    y:
      frag.fromY +
      Math.sin(frag.breakAngle) * frag.breakDistance * 1.15 +
      ny +
      60,
  };
}

function computeFragState(
  frag: Fragment,
  frame: number,
  phases: Phases,
  perspective: number,
): FragState | null {
  if (frame < phases.holdFromEnd) return null;
  if (frame >= phases.reformEnd) return null;

  // ── Break phase ──
  if (frame < phases.breakEnd) {
    const breakDur = phases.breakEnd - phases.holdFromEnd;
    const raw = Math.max(
      0,
      (frame - phases.holdFromEnd - frag.delay) / Math.max(1, breakDur - frag.delay),
    );
    const t = Math.min(1, raw);
    if (t <= 0) return null;

    const eased = 1 - Math.pow(1 - t, 3);

    const travelX = Math.cos(frag.breakAngle) * frag.breakDistance * eased;
    const travelY = Math.sin(frag.breakAngle) * frag.breakDistance * eased;
    const arcPhase = Math.sin(t * Math.PI);
    const perpX = -Math.sin(frag.breakAngle) * frag.curveStrength * arcPhase;
    const perpY = Math.cos(frag.breakAngle) * frag.curveStrength * arcPhase;
    const gravityY = t * t * 60;

    return {
      x: frag.fromX + travelX + perpX,
      y: frag.fromY + travelY + perpY + gravityY,
      z: frag.zPeak * eased * 0.3,
      rotation: frag.rotationSpeed * eased * 360,
      scale: interpolate(t, [0, 0.1, 1], [1.3, 1.1, 0.8], CL),
      opacity: interpolate(t, [0, 0.04, 0.4, 1], [0, 1, 1, 0.9], CL),
      blur: frag.isCameraPass
        ? interpolate(Math.abs(frag.zPeak * eased * 0.3), [0, 300, perspective * 0.6], [0, 1, 8], CL)
        : 0,
    };
  }

  // ── Travel phase ──
  if (frame < phases.travelEnd) {
    const travelDur = phases.travelEnd - phases.breakEnd;
    const t = (frame - phases.breakEnd) / travelDur;

    const breakEnd = scatteredPos(frag);

    // Drift toward toCenter + strong wind noise
    const pullX = (frag.toX - breakEnd.x) * t * 0.4;
    const pullY = (frag.toY - breakEnd.y) * t * 0.4;
    // Multi-octave noise for wind gusts — fast oscillation + slow drift
    const windFast = noise2D("wf" + frag.id, t * 6, frag.id * 0.07) * 140;
    const windSlow = noise2D("ws" + frag.id, t * 1.5, frag.id * 0.13) * 80;
    const nx = windFast + windSlow;
    const ny = noise2D("tny" + frag.id, frag.id * 0.1, t * 5) * 120;
    const gravityY = t * t * 40;

    const x = breakEnd.x + pullX + nx;
    const y = breakEnd.y + pullY + ny + gravityY;

    const zArc = Math.sin(t * Math.PI);
    const z = frag.zPeak * zArc;
    const clampedZ = Math.min(z, perspective - 80);

    let opacity = interpolate(t, [0, 0.5, 1], [0.9, 0.8, 0.75], CL);
    if (frag.isCameraPass) {
      opacity *= interpolate(
        clampedZ,
        [0, perspective * 0.3, perspective * 0.6, perspective * 0.85],
        [1, 1, 0.5, 0],
        CL,
      );
    }

    return {
      x,
      y,
      z: clampedZ,
      rotation: frag.rotationSpeed * (1 + t * 0.4) * 360,
      scale: interpolate(t, [0, 0.5, 1], [0.8, 0.7, 0.6], CL),
      opacity,
      blur: frag.isCameraPass
        ? interpolate(Math.abs(clampedZ), [0, 300, perspective * 0.5], [0, 2, 14], CL)
        : 0,
    };
  }

  // ── Reform phase ──
  {
    const reformDur = phases.reformEnd - phases.travelEnd;
    const raw = Math.max(
      0,
      (frame - phases.travelEnd - frag.reformDelay) / Math.max(1, reformDur - frag.reformDelay),
    );
    const t = Math.min(1, raw);

    // Where the fragment was at end of travel
    const scattered = scatteredPos(frag);
    const pullX = (frag.toX - scattered.x) * 0.4;
    const pullY = (frag.toY - scattered.y) * 0.4;
    const endX = scattered.x + pullX;
    const endY = scattered.y + pullY + 20;

    if (t <= 0) {
      return {
        x: endX,
        y: endY,
        z: 0,
        rotation: frag.rotationSpeed * 1.4 * 360,
        scale: 0.6,
        opacity: 0.7,
        blur: 0,
      };
    }

    const eased = 1 - Math.pow(1 - t, 3);

    return {
      x: endX + (frag.toX - endX) * eased,
      y: endY + (frag.toY - endY) * eased,
      z: frag.zPeak * (1 - eased) * 0.2,
      rotation: frag.rotationSpeed * (1 - eased) * 360,
      scale: interpolate(eased, [0, 0.5, 0.85, 1], [0.6, 0.5, 0.3, 0], CL),
      opacity: interpolate(eased, [0, 0.6, 0.9, 1], [0.75, 0.85, 0.6, 0], CL),
      blur: frag.isCameraPass
        ? interpolate(Math.abs(frag.zPeak * (1 - eased) * 0.2), [0, 150], [0, 2], CL)
        : 0,
    };
  }
}

// ── Component ──────────────────────────────────────────────────────────────

export const WordParticleTransition: React.FC<WordParticleTransitionProps> = ({
  fromText,
  toText,
  durationInFrames,
  fontFamily,
  fontSize,
  fontWeight = 900,
  textColor = "#ffffff",
  particleColors = DEFAULT_COLORS,
  fragmentCount = 200,
  seed = 42,
  cameraPassFraction = 0.12,
  perspective = 1200,
  glowEnabled = true,
  phaseTiming,
  fromCenter = { x: 0, y: 0 },
  toCenter = { x: 0, y: 0 },
  renderFromText = true,
  fragmentLabel,
  fragmentFontSize = 16,
  noRotation = false,
  noStagger = false,
  style,
}) => {
  const frame = useCurrentFrame();

  const phases = useMemo(
    () => computePhases(durationInFrames, phaseTiming),
    [durationInFrames, phaseTiming],
  );

  const fragments = useMemo(
    () =>
      generateFragments(
        fromText, toText, fragmentCount, seed,
        fontFamily, fontSize, fontWeight,
        cameraPassFraction, fromCenter, toCenter,
        noRotation, noStagger,
      ),
    [fromText, toText, fragmentCount, seed, fontFamily, fontSize, fontWeight, cameraPassFraction, fromCenter, toCenter, noRotation, noStagger],
  );

  // fromText opacity
  const breakLen = phases.breakEnd - phases.holdFromEnd;
  const fromOpacity = renderFromText
    ? interpolate(
        frame,
        [0, phases.holdFromEnd, phases.holdFromEnd + Math.max(1, breakLen * 0.4)],
        [1, 1, 0],
        CL,
      )
    : 0;

  // toText opacity
  const reformLen = phases.reformEnd - phases.travelEnd;
  const toFadeStart = phases.travelEnd + reformLen * 0.55;
  const toOpacity = interpolate(
    frame,
    [toFadeStart, phases.reformEnd, durationInFrames],
    [0, 1, 1],
    CL,
  );

  const textStyle: React.CSSProperties = {
    fontFamily,
    fontSize,
    fontWeight,
    color: textColor,
    lineHeight: 0.85,
    whiteSpace: "pre-line",
    textAlign: "center",
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        perspective,
        perspectiveOrigin: "50% 50%",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* fromText at fromCenter */}
      {fromOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${fromCenter.x}px), calc(-50% + ${fromCenter.y}px))`,
            ...textStyle,
            opacity: fromOpacity,
          }}
        >
          {fromText}
        </div>
      )}

      {/* Fragments — origin is component center */}
      {frame >= phases.holdFromEnd && frame < phases.reformEnd && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transformStyle: "preserve-3d",
          }}
        >
          {fragments.map((frag) => {
            const state = computeFragState(frag, frame, phases, perspective);
            if (!state || state.opacity <= 0.01) return null;

            const color = particleColors[frag.colorIndex % particleColors.length];
            const baseTransform = `translate3d(${state.x}px, ${state.y}px, ${state.z}px) rotate(${state.rotation}deg) scale(${state.scale})`;

            if (fragmentLabel) {
              return (
                <span
                  key={frag.id}
                  style={{
                    position: "absolute",
                    fontSize: fragmentFontSize,
                    fontFamily,
                    fontWeight: 700,
                    color,
                    opacity: state.opacity,
                    transform: baseTransform,
                    filter: state.blur > 0.5 ? `blur(${state.blur}px)` : "none",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                  }}
                >
                  {fragmentLabel(frag.id)}
                </span>
              );
            }

            return (
              <div
                key={frag.id}
                style={{
                  position: "absolute",
                  width: frag.width,
                  height: frag.height,
                  borderRadius: Math.min(frag.width, frag.height) > 5 ? 2 : 1,
                  backgroundColor: color,
                  opacity: state.opacity,
                  transform: baseTransform,
                  boxShadow: glowEnabled
                    ? `0 0 ${Math.max(frag.width, frag.height) * 3}px ${color}`
                    : "none",
                  filter: state.blur > 0.5 ? `blur(${state.blur}px)` : "none",
                  pointerEvents: "none",
                }}
              />
            );
          })}
        </div>
      )}

      {/* toText at toCenter */}
      {toOpacity > 0.01 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `translate(calc(-50% + ${toCenter.x}px), calc(-50% + ${toCenter.y}px))`,
            ...textStyle,
            opacity: toOpacity,
          }}
        >
          {toText}
        </div>
      )}
    </div>
  );
};
