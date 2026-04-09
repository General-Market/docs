import React, { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { FPS } from "../theme";

// -- Types ------------------------------------------------------------------

type ShapeType = "circle" | "rect" | "polygon";

interface ShapeInstance {
  type: ShapeType;
  filled: boolean;
  offsetX: number;
  offsetY: number;
  targetX: number;
  targetY: number;
  targetScale: number;
  targetRotate: number;
  seed: number;
}

interface TitleEntry {
  word: string;
  /** Seconds when the title appears */
  at: number;
  /** How long it holds fully visible (seconds) */
  hold: number;
  /** Accent color for shapes */
  accent: string;
}

// -- Configuration ----------------------------------------------------------

const TITLES: TitleEntry[] = [
  { word: "LIQUIDITY", at: 48.64, hold: 4, accent: "#00C853" },
  { word: "SETTLEMENT", at: 89.84, hold: 4, accent: "#6366f1" },
  { word: "PRIVACY", at: 161.4, hold: 4, accent: "#14b8a6" },
  { word: "EDGE", at: 194.04, hold: 4, accent: "#fbbf24" },
  { word: "SOURCES", at: 247.44, hold: 4, accent: "#f97316" },
];

const FONT_SIZE = 72;
const LETTER_SPACING = -2;
const SHAPES_PER_LETTER = 4;
const SHAPE_SPREAD = 120;

// Animation durations in frames
const ENTER_FRAMES = 18;
const HOLD_EXTRA = 6; // extra frames after hold before fade begins
const EXIT_FRAMES = 12;

// -- Seeded random ----------------------------------------------------------

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

function seededPick<T>(seed: number, arr: T[]): T {
  return arr[Math.floor(seededRange(seed, 0, arr.length))];
}

// -- Easing -----------------------------------------------------------------

const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t);

const easeOutElastic = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
};

// -- Shape generation -------------------------------------------------------

function generateLetterShapes(
  titleIndex: number,
  letterIndex: number,
): ShapeInstance[] {
  const shapes: ShapeInstance[] = [];
  const baseSeed = titleIndex * 10000 + letterIndex * 100;
  const types: ShapeType[] = ["circle", "rect", "polygon"];

  for (let i = 0; i < SHAPES_PER_LETTER; i++) {
    const s = baseSeed + i;
    shapes.push({
      type: seededPick(s, types),
      filled: seededRandom(s + 1) > 0.4,
      offsetX: seededRange(s + 2, -8, 8),
      offsetY: seededRange(s + 3, -8, 8),
      targetX: seededRange(s + 4, -SHAPE_SPREAD, SHAPE_SPREAD),
      targetY: seededRange(s + 5, -SHAPE_SPREAD, SHAPE_SPREAD),
      targetScale: seededRange(s + 6, 0.15, 0.6),
      targetRotate: seededRange(s + 7, -90, 90),
      seed: s,
    });
  }
  return shapes;
}

// -- SVG Shape --------------------------------------------------------------

const SvgShape: React.FC<{
  shape: ShapeInstance;
  progress: number;
  opacity: number;
  accent: string;
  charWidth: number;
  charHeight: number;
}> = ({ shape, progress, opacity, accent, charWidth, charHeight }) => {
  const x = interpolate(progress, [0, 1], [shape.offsetX, shape.targetX]);
  const y = interpolate(progress, [0, 1], [shape.offsetY, shape.targetY]);
  const scale = interpolate(progress, [0, 1], [0.2, shape.targetScale]);
  const rotate = interpolate(progress, [0, 1], [0, shape.targetRotate]);

  const transform = `translate(${x}, ${y}) scale(${scale}) rotate(${rotate})`;
  const fill = shape.filled ? accent : "none";
  const stroke = shape.filled ? "none" : accent;
  const strokeWidth = shape.filled ? 0 : 2;

  if (shape.type === "circle") {
    const r = charWidth * seededRange(shape.seed + 10, 0.15, 0.4);
    return (
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  if (shape.type === "rect") {
    const w = charWidth * seededRange(shape.seed + 10, 0.1, 0.5);
    const h = charHeight * seededRange(shape.seed + 11, 0.1, 0.5);
    return (
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  // Polygon (triangle)
  const triSize = charWidth * 0.35;
  const points = `0,${-triSize} ${triSize * 0.866},${triSize * 0.5} ${-triSize * 0.866},${triSize * 0.5}`;
  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      transform={transform}
    />
  );
};

// -- Animated letter with shapes --------------------------------------------

const AnimatedLetter: React.FC<{
  char: string;
  index: number;
  total: number;
  titleIndex: number;
  accent: string;
  enterProgress: number;
  shapeProgress: number;
  fadeOpacity: number;
}> = ({
  char,
  index,
  total,
  titleIndex,
  accent,
  enterProgress,
  shapeProgress,
  fadeOpacity,
}) => {
  const shapes = useMemo(
    () => generateLetterShapes(titleIndex, index),
    [titleIndex, index],
  );

  // Stagger per letter: center-out pattern
  const stagger = Math.abs(total / 2 - index) * 0.12;
  const letterStart = stagger;
  const letterEnd = stagger + 0.6;

  const rawT = interpolate(enterProgress, [letterStart, letterEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const letterT = easeOutElastic(rawT);

  // Letter slides in from above
  const yOffset = interpolate(letterT, [0, 1], [-100, 0]);
  const letterOpacity = interpolate(letterT, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Shape scatter timing — slightly after letter
  const shapeStagger = index * 0.08;
  const shapeStart = shapeStagger;
  const shapeEnd = shapeStagger + 0.7;

  const rawShapeT = interpolate(
    shapeProgress,
    [shapeStart, Math.min(shapeEnd, 1)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const shapeT = easeOutExpo(rawShapeT);

  // Shapes: fade in quickly, then fade out as they scatter
  let shapeOpacity = 0;
  if (rawShapeT < 0.15) {
    shapeOpacity = interpolate(rawShapeT, [0, 0.15], [0, 0.85]);
  } else {
    shapeOpacity = interpolate(rawShapeT, [0.15, 1], [0.85, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const charWidth = FONT_SIZE * 0.6;
  const charHeight = FONT_SIZE * 0.85;

  return (
    <span
      style={{
        display: "inline-block",
        position: "relative",
        whiteSpace: "pre",
        transform: `translateY(${yOffset}%)`,
        opacity: letterOpacity * fadeOpacity,
        color: "#fff",
        willChange: "transform, opacity",
      }}
    >
      {/* Shape SVG layer */}
      <svg
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: SHAPE_SPREAD * 2 + charWidth,
          height: SHAPE_SPREAD * 2 + charHeight,
          overflow: "visible",
          pointerEvents: "none",
          zIndex: 0,
        }}
        viewBox={`${-(SHAPE_SPREAD + charWidth / 2)} ${-(SHAPE_SPREAD + charHeight / 2)} ${SHAPE_SPREAD * 2 + charWidth} ${SHAPE_SPREAD * 2 + charHeight}`}
      >
        {shapes.map((shape, si) => {
          const perShapeOffset = si * 0.06;
          const adjustedT = Math.max(0, Math.min(1, shapeT - perShapeOffset));
          const adjustedOpacity =
            shapeOpacity *
            interpolate(si, [0, shapes.length - 1], [1, 0.5], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          return (
            <SvgShape
              key={si}
              shape={shape}
              progress={adjustedT}
              opacity={adjustedOpacity * fadeOpacity}
              accent={accent}
              charWidth={charWidth}
              charHeight={charHeight}
            />
          );
        })}
      </svg>
      <span style={{ position: "relative", zIndex: 1 }}>{char}</span>
    </span>
  );
};

// -- Single decorated title -------------------------------------------------

const DecoratedTitle: React.FC<{
  title: TitleEntry;
  titleIndex: number;
}> = ({ title, titleIndex }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = Math.round(title.hold * fps);

  // Phase calculation
  let enterProgress = 0;
  let shapeProgress = 0;
  let fadeOpacity = 1;

  if (frame < ENTER_FRAMES) {
    // Entering
    enterProgress = frame / ENTER_FRAMES;
    shapeProgress = frame / (ENTER_FRAMES + 6); // shapes start during enter
  } else if (frame < ENTER_FRAMES + holdFrames + HOLD_EXTRA) {
    // Holding
    enterProgress = 1;
    shapeProgress = Math.min(
      1,
      (frame - ENTER_FRAMES * 0.3) / (ENTER_FRAMES + 6),
    );
  } else {
    // Fading out
    enterProgress = 1;
    shapeProgress = 1;
    const fadeFrame = frame - (ENTER_FRAMES + holdFrames + HOLD_EXTRA);
    fadeOpacity = interpolate(fadeFrame, [0, EXIT_FRAMES], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const letters = title.word.split("");

  // Backdrop spring
  const backdropScale = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
  });
  const backdropOpacity = fadeOpacity * 0.85;

  return (
    <AbsoluteFill>
      {/* Semi-transparent dark backdrop — upper third */}
      <div
        style={{
          position: "absolute",
          top: "8%",
          left: "50%",
          transform: `translateX(-50%) scaleX(${backdropScale})`,
          transformOrigin: "center center",
          background: "rgba(10, 10, 10, 0.82)",
          borderRadius: 16,
          padding: "28px 56px",
          opacity: backdropOpacity,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Accent bar top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "15%",
            right: "15%",
            height: 3,
            background: title.accent,
            borderRadius: 2,
            opacity: fadeOpacity,
          }}
        />

        <h2
          style={{
            fontFamily: font,
            fontWeight: 900,
            fontSize: FONT_SIZE,
            color: "#fff",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            letterSpacing: LETTER_SPACING,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {letters.map((char, i) => (
            <AnimatedLetter
              key={i}
              char={char}
              index={i}
              total={letters.length}
              titleIndex={titleIndex}
              accent={title.accent}
              enterProgress={enterProgress}
              shapeProgress={shapeProgress}
              fadeOpacity={fadeOpacity}
            />
          ))}
        </h2>
      </div>
    </AbsoluteFill>
  );
};

// -- Main overlay (full duration) -------------------------------------------

export const LetterDecorationsTitle: React.FC = () => {
  return (
    <AbsoluteFill>
      {TITLES.map((title, i) => {
        const startFrame = Math.round(title.at * FPS);
        const holdFrames = Math.round(title.hold * FPS);
        const totalFrames =
          ENTER_FRAMES + holdFrames + HOLD_EXTRA + EXIT_FRAMES;

        return (
          <React.Fragment key={i}>
            <Sequence from={startFrame} durationInFrames={totalFrames}>
              <DecoratedTitle title={title} titleIndex={i} />
            </Sequence>

            {/* SFX — text-appear-blip on each title */}
            <Sequence from={startFrame} durationInFrames={60}>
              <Audio
                src={staticFile("sfx/text-appear-blip.mp3")}
                volume={0.6}
              />
            </Sequence>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};
