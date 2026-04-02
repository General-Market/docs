// Source: https://tympanus.net/Development/DecorativeLetterAnimations/
import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';

// ── Types ────────────────────────────────────────────────────────────────────

type ShapeType = 'circle' | 'rect' | 'polygon';

interface ShapeInstance {
  type: ShapeType;
  color: string;
  filled: boolean;
  strokeWidth: number;
  // Position relative to letter center (0,0)
  offsetX: number;
  offsetY: number;
  // Random targets for animation
  targetX: number;
  targetY: number;
  targetScale: number;
  targetRotate: number;
  seed: number;
}

interface SlideEffect {
  word: string;
  bgColor: string;
  fontFamily: string;
  fontWeight: number;
  textTransform: 'none' | 'uppercase' | 'lowercase';
  fontSize: number; // vw-ish units mapped to pixels
  letterSpacing: number;
  textColor: string;
  shapeColors: string[];
  shapeTypes: ShapeType[];
  shapeFill: boolean;
  shapeStrokeWidth: number;
  shapesOnTop: boolean;
  totalShapes: number;
  // Animation config
  showLetterEasing: (t: number) => number;
  showLetterDuration: number; // frames
  showLetterStagger: number; // frames per letter
  showLetterTransform: 'translateY' | 'scale' | 'translateYAlt' | 'rotate';
  showShapeDuration: number;
  showShapeStagger: number;
  showShapeSpread: number; // how far shapes travel
  hideLetterDuration: number;
  hideLetterStagger: number;
  // Special per-letter color overrides
  letterColorOverrides?: Record<number, string>;
}

// ── Seeded random ────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

function seededRange(seed: number, min: number, max: number): number {
  return min + seededRandom(seed) * (max - min);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRange(seed, min, max + 1));
}

function seededPick<T>(seed: number, arr: T[]): T {
  return arr[seededInt(seed, 0, arr.length - 1)];
}

// ── Easing helpers ───────────────────────────────────────────────────────────

const easeOutElastic = (t: number): number => {
  if (t === 0 || t === 1) return t;
  const p = 0.3;
  const s = p / 4;
  return Math.pow(2, -10 * t) * Math.sin(((t - s) * (2 * Math.PI)) / p) + 1;
};

const easeOutExpo = (t: number): number => {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};

const easeInExpo = (t: number): number => {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
};

const easeInOutExpo = (t: number): number => {
  if (t === 0) return 0;
  if (t === 1) return 1;
  if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2;
  return (2 - Math.pow(2, -20 * t + 10)) / 2;
};

// ── Slide definitions ────────────────────────────────────────────────────────

const SLIDES: SlideEffect[] = [
  // 1. Eurhythmic — Josefin Sans, blue bg, colorful shapes, elastic letters
  {
    word: 'Eurhythmic',
    bgColor: '#4cabef',
    fontFamily: "'Josefin Sans', sans-serif",
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 160,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#6435ea', '#295ddc', '#9fd7ff', '#d65380', '#0228f7', '#242627'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: false,
    totalShapes: 10,
    showLetterEasing: easeOutElastic,
    showLetterDuration: 24,
    showLetterStagger: 1.2,
    showLetterTransform: 'translateY',
    showShapeDuration: 10,
    showShapeStagger: 1,
    showShapeSpread: 200,
    hideLetterDuration: 24,
    hideLetterStagger: 1.2,
  },
  // 2. Aquarius — Arbutus Slab, deep blue bg, blue circle outlines
  {
    word: 'Aquarius',
    bgColor: '#0406e6',
    fontFamily: "'Arbutus Slab', serif",
    fontWeight: 400,
    textTransform: 'none',
    fontSize: 170,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#0671e6'],
    shapeTypes: ['circle'],
    shapeFill: false,
    shapeStrokeWidth: 3,
    shapesOnTop: false,
    totalShapes: 10,
    showLetterEasing: easeOutElastic,
    showLetterDuration: 24,
    showLetterStagger: 1.8,
    showLetterTransform: 'translateY',
    showShapeDuration: 21,
    showShapeStagger: 1.8,
    showShapeSpread: 100,
    hideLetterDuration: 10,
    hideLetterStagger: 0.8,
  },
  // 3. Lycanthropy — Questrial, dark bg, black shapes, alternating Y entry
  {
    word: 'Lycanthropy',
    bgColor: '#272526',
    fontFamily: "'Questrial', sans-serif",
    fontWeight: 400,
    textTransform: 'none',
    fontSize: 150,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#111'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: false,
    totalShapes: 10,
    showLetterEasing: easeOutExpo,
    showLetterDuration: 15,
    showLetterStagger: 1.8,
    showLetterTransform: 'translateYAlt',
    showShapeDuration: 60,
    showShapeStagger: 0.6,
    showShapeSpread: 300,
    hideLetterDuration: 6,
    hideLetterStagger: 0.6,
  },
  // 4. Wonderland — Poppins, grey bg, colorful filled shapes on top
  {
    word: 'Wonderland',
    bgColor: '#b9b9b9',
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 800,
    textTransform: 'none',
    fontSize: 160,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#ec4747', '#5447ec', '#ecb447', '#a847ec', '#635f65'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: true,
    totalShapes: 20,
    showLetterEasing: easeInOutExpo,
    showLetterDuration: 12,
    showLetterStagger: 1.8,
    showLetterTransform: 'translateY',
    showShapeDuration: 12,
    showShapeStagger: 0.6,
    showShapeSpread: 400,
    hideLetterDuration: 6,
    hideLetterStagger: 0.6,
  },
  // 5. Screenager — Bungee Outline, purple bg, colorful stroke shapes on top
  {
    word: 'Screenager',
    bgColor: '#5900ce',
    fontFamily: "'Bungee Outline', cursive",
    fontWeight: 400,
    textTransform: 'none',
    fontSize: 155,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#ec4747', '#5447ec', '#ecb447', '#a847ec', '#635f65'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: false,
    shapeStrokeWidth: 4,
    shapesOnTop: true,
    totalShapes: 30,
    showLetterEasing: easeInExpo,
    showLetterDuration: 10,
    showLetterStagger: 3,
    showLetterTransform: 'translateY',
    showShapeDuration: 12,
    showShapeStagger: 0.15,
    showShapeSpread: 150,
    hideLetterDuration: 10,
    hideLetterStagger: 0.6,
  },
  // 6. Callipygian — Hammersmith One, near-black bg, grey/white/red shapes
  {
    word: 'Callipygian',
    bgColor: '#1b1a1a',
    fontFamily: "'Hammersmith One', sans-serif",
    fontWeight: 400,
    textTransform: 'none',
    fontSize: 148,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#fff', '#dedede', '#8c8c8c', '#545454', '#000', '#dc2e2e'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: false,
    totalShapes: 10,
    showLetterEasing: easeInExpo,
    showLetterDuration: 12,
    showLetterStagger: 1.8,
    showLetterTransform: 'scale',
    showShapeDuration: 21,
    showShapeStagger: 1.2,
    showShapeSpread: 400,
    hideLetterDuration: 6,
    hideLetterStagger: 0.6,
    letterColorOverrides: { 4: '#dc2e2e', 8: '#dc2e2e' }, // 'p' and 'a' in red
  },
  // 7. Eviternity — Volkhov, red bg, red/black/white stroke shapes
  {
    word: 'Eviternity',
    bgColor: '#bf2525',
    fontFamily: "'Volkhov', serif",
    fontWeight: 700,
    textTransform: 'none',
    fontSize: 155,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['red', '#000', '#fff'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: false,
    shapeStrokeWidth: 10,
    shapesOnTop: false,
    totalShapes: 10,
    showLetterEasing: easeOutExpo,
    showLetterDuration: 12,
    showLetterStagger: 1.8,
    showLetterTransform: 'translateYAlt',
    showShapeDuration: 15,
    showShapeStagger: 0.9,
    showShapeSpread: 200,
    hideLetterDuration: 8,
    hideLetterStagger: 0.6,
  },
  // 8. Jumbuck — Josefin Sans lowercase, light bg, colorful shapes on top, elastic
  {
    word: 'Jumbuck',
    bgColor: '#d6d1d1',
    fontFamily: "'Josefin Sans', sans-serif",
    fontWeight: 700,
    textTransform: 'lowercase',
    fontSize: 170,
    letterSpacing: -8,
    textColor: '#0800ff',
    shapeColors: ['#35c394', '#9985ee', '#f54665', '#4718f5', '#f5aa18'],
    shapeTypes: ['circle', 'rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: true,
    totalShapes: 10,
    showLetterEasing: easeOutElastic,
    showLetterDuration: 12,
    showLetterStagger: 2.4,
    showLetterTransform: 'rotate',
    showShapeDuration: 60,
    showShapeStagger: 0.6,
    showShapeSpread: 250,
    hideLetterDuration: 10,
    hideLetterStagger: 0.9,
  },
  // 9. Babooner — Montserrat Alternates, black bg, pink/blue/purple shapes
  {
    word: 'Babooner',
    bgColor: '#000000',
    fontFamily: "'Montserrat Alternates', serif",
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 145,
    letterSpacing: 0,
    textColor: '#fff',
    shapeColors: ['#FD74FF', '#3771FC', '#7C5CE4', '#542A95', '#ACC7FE'],
    shapeTypes: ['rect', 'polygon'],
    shapeFill: true,
    shapeStrokeWidth: 1,
    shapesOnTop: false,
    totalShapes: 1,
    showLetterEasing: easeInOutExpo,
    showLetterDuration: 24,
    showLetterStagger: 0,
    showLetterTransform: 'translateY',
    showShapeDuration: 60,
    showShapeStagger: 0.6,
    showShapeSpread: 300,
    hideLetterDuration: 24,
    hideLetterStagger: 0,
  },
];

const SLIDE_COUNT = SLIDES.length;
// Each slide gets ~33 frames visible (300 / 9), with transition overlap
const TRANSITION_FRAMES = 6;

// ── Google Fonts (loaded as @font-face) ──────────────────────────────────────

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Montserrat+Alternates:wght@700&family=Volkhov:wght@700&family=Hammersmith+One&family=Arbutus+Slab&family=Poppins:wght@800&family=Questrial&family=Bungee+Outline&family=Josefin+Sans:wght@700&display=swap');`;

// ── Generate shapes per letter ───────────────────────────────────────────────

function generateLetterShapes(
  slideIndex: number,
  letterIndex: number,
  slide: SlideEffect
): ShapeInstance[] {
  const shapes: ShapeInstance[] = [];
  const baseSeed = slideIndex * 10000 + letterIndex * 100;

  for (let i = 0; i < slide.totalShapes; i++) {
    const s = baseSeed + i;
    shapes.push({
      type: seededPick(s, slide.shapeTypes),
      color: seededPick(s + 1, slide.shapeColors),
      filled: slide.shapeFill,
      strokeWidth: slide.shapeStrokeWidth,
      offsetX: seededRange(s + 2, -10, 10),
      offsetY: seededRange(s + 3, -10, 10),
      targetX: seededRange(s + 4, -slide.showShapeSpread, slide.showShapeSpread),
      targetY: seededRange(s + 5, -slide.showShapeSpread, slide.showShapeSpread),
      targetScale: seededRange(s + 6, 0.15, 0.7),
      targetRotate: seededRange(s + 7, -90, 90),
      seed: s,
    });
  }
  return shapes;
}

// ── SVG Shape component ──────────────────────────────────────────────────────

const SvgShape: React.FC<{
  shape: ShapeInstance;
  progress: number; // 0 → 1 for show animation
  opacity: number;
  letterCenterX: number;
  letterCenterY: number;
  letterWidth: number;
  letterHeight: number;
}> = ({ shape, progress, opacity, letterCenterX, letterCenterY, letterWidth, letterHeight }) => {
  const x = letterCenterX + interpolate(progress, [0, 1], [shape.offsetX, shape.targetX]);
  const y = letterCenterY + interpolate(progress, [0, 1], [shape.offsetY, shape.targetY]);
  const scale = interpolate(progress, [0, 1], [0.2, shape.targetScale]);
  const rotate = interpolate(progress, [0, 1], [0, shape.targetRotate]);

  const transform = `translate(${x}, ${y}) scale(${scale}) rotate(${rotate})`;
  const fillAttr = shape.filled ? shape.color : 'none';
  const strokeAttr = shape.filled ? 'none' : shape.color;

  const r = letterWidth * 0.5;
  const w = letterWidth * seededRange(shape.seed + 10, 0.3, 0.8);
  const h = letterHeight * seededRange(shape.seed + 11, 0.3, 0.8);

  if (shape.type === 'circle') {
    return (
      <circle
        cx={0}
        cy={0}
        r={r}
        fill={fillAttr}
        stroke={strokeAttr}
        strokeWidth={shape.strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  if (shape.type === 'rect') {
    return (
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={fillAttr}
        stroke={strokeAttr}
        strokeWidth={shape.strokeWidth}
        opacity={opacity}
        transform={transform}
      />
    );
  }

  // polygon (triangle)
  const triSize = letterWidth * 0.5;
  const points = `0,${-triSize} ${triSize * 0.866},${triSize * 0.5} ${-triSize * 0.866},${triSize * 0.5}`;
  return (
    <polygon
      points={points}
      fill={fillAttr}
      stroke={strokeAttr}
      strokeWidth={shape.strokeWidth}
      opacity={opacity}
      transform={transform}
    />
  );
};

// ── Single letter with shapes ────────────────────────────────────────────────

const AnimatedLetter: React.FC<{
  char: string;
  index: number;
  total: number;
  slide: SlideEffect;
  slideIndex: number;
  showProgress: number; // 0..1 for the whole slide
  hideProgress: number; // 0..1 for hide phase
  phase: 'show' | 'visible' | 'hide';
}> = ({ char, index, total, slide, slideIndex, showProgress, hideProgress, phase }) => {
  const shapes = useMemo(
    () => generateLetterShapes(slideIndex, index, slide),
    [slideIndex, index, slide]
  );

  // Letter animation timing (staggered)
  const letterDelay = index * slide.showLetterStagger;
  const totalLetterFrames = slide.showLetterDuration + (total - 1) * slide.showLetterStagger;
  const letterStart = letterDelay / Math.max(totalLetterFrames, 1);
  const letterEnd = (letterDelay + slide.showLetterDuration) / Math.max(totalLetterFrames, 1);

  let letterT = 0;
  if (phase === 'show') {
    const raw = interpolate(showProgress, [letterStart, letterEnd], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    letterT = slide.showLetterEasing(raw);
  } else if (phase === 'visible') {
    letterT = 1;
  } else {
    // hide
    const hideDelay = index * slide.hideLetterStagger;
    const totalHideFrames = slide.hideLetterDuration + (total - 1) * slide.hideLetterStagger;
    const hStart = hideDelay / Math.max(totalHideFrames, 1);
    const hEnd = (hideDelay + slide.hideLetterDuration) / Math.max(totalHideFrames, 1);
    const raw = interpolate(hideProgress, [hStart, hEnd], [1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    letterT = raw;
  }

  // Letter transform
  let letterTransform = '';
  let letterOpacity = letterT;

  if (slide.showLetterTransform === 'translateY') {
    const yOffset = interpolate(letterT, [0, 1], [100, 0]);
    letterTransform = `translateY(${yOffset}%)`;
    letterOpacity = letterT;
  } else if (slide.showLetterTransform === 'translateYAlt') {
    // Alternating direction per letter index
    const direction = index % 2 === 0 ? -1 : 1;
    const yOffset = interpolate(letterT, [0, 1], [direction * 350, 0]);
    letterTransform = `translateY(${yOffset}px)`;
    letterOpacity = letterT > 0.05 ? 1 : 0;
  } else if (slide.showLetterTransform === 'scale') {
    const s = interpolate(letterT, [0, 1], [0, 1]);
    letterTransform = `scale(${s})`;
  } else if (slide.showLetterTransform === 'rotate') {
    // Alternating entry direction + rotation (effect 8)
    const direction = index % 2 === 0 ? -1 : 1;
    const yOffset = interpolate(letterT, [0, 1], [direction * 80, 0]);
    const rot = interpolate(letterT, [0, 1], [90, 0]);
    letterTransform = `translateY(${yOffset}%) rotate(${rot}deg)`;
  }

  // Shape animation timing
  const shapeDelay = index * slide.showShapeStagger;
  const totalShapeFrames = slide.showShapeDuration + (total - 1) * slide.showShapeStagger;
  const shapeStart = shapeDelay / Math.max(totalShapeFrames, 1);
  const shapeEnd = (shapeDelay + slide.showShapeDuration) / Math.max(totalShapeFrames, 1);

  let shapeT = 0;
  let shapeOpacity = 0;
  if (phase === 'show' || phase === 'visible') {
    const raw = interpolate(showProgress, [shapeStart, Math.min(shapeEnd, 1)], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    shapeT = easeOutExpo(raw);
    // Shapes fade in then out
    if (raw < 0.1) {
      shapeOpacity = interpolate(raw, [0, 0.1], [0, 0.8]);
    } else {
      shapeOpacity = interpolate(raw, [0.1, 1], [0.8, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }
  }

  // Approximate letter metrics for shape positioning
  const charWidth = slide.fontSize * 0.6;
  const charHeight = slide.fontSize * 0.85;
  const letterColor =
    slide.letterColorOverrides && slide.letterColorOverrides[index]
      ? slide.letterColorOverrides[index]
      : slide.textColor;

  return (
    <span
      style={{
        display: 'inline-block',
        position: 'relative',
        whiteSpace: 'pre',
        transform: letterTransform,
        opacity: letterOpacity,
        color: letterColor,
        willChange: 'transform, opacity',
      }}
    >
      {/* SVG shapes behind letter (or on top if shapesOnTop) */}
      <svg
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: slide.showShapeSpread * 2 + charWidth,
          height: slide.showShapeSpread * 2 + charHeight,
          overflow: 'visible',
          pointerEvents: 'none',
          zIndex: slide.shapesOnTop ? 2 : 0,
        }}
        viewBox={`${-(slide.showShapeSpread + charWidth / 2)} ${-(slide.showShapeSpread + charHeight / 2)} ${slide.showShapeSpread * 2 + charWidth} ${slide.showShapeSpread * 2 + charHeight}`}
      >
        {shapes.map((shape, si) => {
          // Per-shape stagger within the letter
          const perShapeOffset = si * 0.05;
          const adjustedT = Math.max(0, Math.min(1, shapeT - perShapeOffset));
          const adjustedOpacity = Math.max(
            0,
            shapeOpacity * interpolate(si, [0, shapes.length - 1], [1, 0.4])
          );
          return (
            <SvgShape
              key={si}
              shape={shape}
              progress={adjustedT}
              opacity={adjustedOpacity}
              letterCenterX={0}
              letterCenterY={0}
              letterWidth={charWidth}
              letterHeight={charHeight}
            />
          );
        })}
      </svg>
      <span style={{ position: 'relative', zIndex: 1 }}>{char}</span>
    </span>
  );
};

// ── Single slide ─────────────────────────────────────────────────────────────

const Slide: React.FC<{
  slide: SlideEffect;
  slideIndex: number;
  showProgress: number;
  hideProgress: number;
  bgTranslateY: number;
  phase: 'show' | 'visible' | 'hide';
  visible: boolean;
}> = ({ slide, slideIndex, showProgress, hideProgress, bgTranslateY, phase, visible }) => {
  const letters = useMemo(() => {
    const txt =
      slide.textTransform === 'uppercase'
        ? slide.word.toUpperCase()
        : slide.textTransform === 'lowercase'
          ? slide.word.toLowerCase()
          : slide.word;
    return txt.split('');
  }, [slide.word, slide.textTransform]);

  if (!visible) return null;

  return (
    <AbsoluteFill>
      {/* Background with slide transition */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          backgroundColor: slide.bgColor,
          transform: `translateY(${bgTranslateY}%)`,
          willChange: 'transform',
        }}
      />
      {/* Word */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <h2
          style={{
            fontFamily: slide.fontFamily,
            fontWeight: slide.fontWeight,
            fontSize: slide.fontSize,
            color: slide.textColor,
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            letterSpacing: slide.letterSpacing,
            userSelect: 'none',
            cursor: 'default',
            lineHeight: 1,
          }}
        >
          {letters.map((char, i) => (
            <AnimatedLetter
              key={i}
              char={char}
              index={i}
              total={letters.length}
              slide={slide}
              slideIndex={slideIndex}
              showProgress={showProgress}
              hideProgress={hideProgress}
              phase={phase}
            />
          ))}
        </h2>
      </div>
    </AbsoluteFill>
  );
};

// ── Main composition ─────────────────────────────────────────────────────────

export const LetterDecorations: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // Total frames available per slide
  const totalSlideDuration = durationInFrames / SLIDE_COUNT;
  const showDuration = totalSlideDuration * 0.35;
  const holdDuration = totalSlideDuration * 0.35;
  const hideDuration = totalSlideDuration * 0.3;

  return (
    <AbsoluteFill style={{ backgroundColor: '#101010', overflow: 'hidden' }}>
      <style>{FONT_IMPORT}</style>

      {SLIDES.map((slide, i) => {
        const slideStart = i * totalSlideDuration;
        const slideEnd = slideStart + totalSlideDuration;
        const localFrame = frame - slideStart;

        // Determine if this slide is visible (with some overlap for transitions)
        const isVisible = frame >= slideStart - TRANSITION_FRAMES && frame < slideEnd + TRANSITION_FRAMES;
        if (!isVisible) return null;

        // Phase determination
        let phase: 'show' | 'visible' | 'hide' = 'show';
        let showProgress = 0;
        let hideProgress = 0;
        let bgTranslateY = 0;

        if (localFrame < showDuration) {
          phase = 'show';
          showProgress = Math.max(0, Math.min(1, localFrame / showDuration));
        } else if (localFrame < showDuration + holdDuration) {
          phase = 'visible';
          showProgress = 1;
        } else {
          phase = 'hide';
          showProgress = 1;
          hideProgress = Math.max(
            0,
            Math.min(1, (localFrame - showDuration - holdDuration) / hideDuration)
          );
        }

        // Background slide transition (incoming from below for "next")
        if (localFrame < 0) {
          bgTranslateY = 100;
        } else if (phase === 'hide') {
          bgTranslateY = interpolate(
            easeOutExpo(hideProgress),
            [0, 1],
            [0, -100]
          );
        }

        return (
          <Slide
            key={i}
            slide={slide}
            slideIndex={i}
            showProgress={showProgress}
            hideProgress={hideProgress}
            bgTranslateY={bgTranslateY}
            phase={phase}
            visible
          />
        );
      })}

      {/* Header overlay */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 50,
          zIndex: 10000,
          color: '#fff',
          fontFamily: "'Franklin Gothic Medium', 'Helvetica Neue', Helvetica, Arial, sans-serif",
          fontSize: 22,
          fontWeight: 400,
          opacity: 0.7,
        }}
      >
        Decorative Letter Animations
      </div>

      {/* Navigation arrows (decorative, matching original) */}
      <div
        style={{
          position: 'absolute',
          bottom: 50,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 40,
          zIndex: 10000,
        }}
      >
        <svg
          viewBox="0 0 90 64"
          width={36}
          height={26}
          fill="#fff"
          opacity={0.5}
        >
          <path d="M88.148 30.124H6.404L33.208 3.32a1.877 1.877 0 0 0 0-2.652 1.877 1.877 0 0 0-2.652 0L.552 30.67a1.942 1.942 0 0 0-.409.612 1.86 1.86 0 0 0 0 1.432c.094.233.233.44.41.612L30.555 63.33c.367.368.847.552 1.328.552.48 0 .96-.184 1.327-.548a1.877 1.877 0 0 0 0-2.652L6.404 33.874h81.743a1.876 1.876 0 0 0 0-3.75z" />
        </svg>
        <svg
          viewBox="0 0 90 64"
          width={36}
          height={26}
          fill="#fff"
          opacity={0.5}
          style={{ transform: 'rotate(180deg)' }}
        >
          <path d="M88.148 30.124H6.404L33.208 3.32a1.877 1.877 0 0 0 0-2.652 1.877 1.877 0 0 0-2.652 0L.552 30.67a1.942 1.942 0 0 0-.409.612 1.86 1.86 0 0 0 0 1.432c.094.233.233.44.41.612L30.555 63.33c.367.368.847.552 1.328.552.48 0 .96-.184 1.327-.548a1.877 1.877 0 0 0 0-2.652L6.404 33.874h81.743a1.876 1.876 0 0 0 0-3.75z" />
        </svg>
      </div>

      {/* Slide counter */}
      <div
        style={{
          position: 'absolute',
          bottom: 55,
          right: 50,
          zIndex: 10000,
          color: '#fff',
          fontFamily: "'Franklin Gothic Medium', sans-serif",
          fontSize: 16,
          opacity: 0.4,
        }}
      >
        {Math.min(Math.floor(frame / totalSlideDuration) + 1, SLIDE_COUNT)} / {SLIDE_COUNT}
      </div>
    </AbsoluteFill>
  );
};
