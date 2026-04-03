// Source: https://github.com/codrops/3DCarousel/
import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Img,
  staticFile,
} from "remotion";

// ── Asset path ──────────────────────────────────────────────────────────────

const ASSET = "compositions/carousel-3d";
const img = (n: number) => staticFile(`${ASSET}/img${n}.webp`);

// ── Data — verbatim from index.html ─────────────────────────────────────────

interface CarouselScene {
  title: string;
  radius: number;
  cardImages: number[];
  gridImages: { img: number; name: string }[];
}

const SCENES: CarouselScene[] = [
  {
    title: "Haute Couture Nights — Paris",
    radius: 500,
    cardImages: [1, 2, 3, 4],
    gridImages: [
      { img: 1, name: "Kai Vega" },
      { img: 2, name: "Riven Juno" },
      { img: 3, name: "Lex Orion" },
      { img: 4, name: "Ash Kairos" },
      { img: 5, name: "Juno Sol" },
      { img: 6, name: "Soren Nyx" },
      { img: 7, name: "Quinn Axon" },
      { img: 8, name: "Zara Voss" },
      { img: 9, name: "Hale B." },
      { img: 10, name: "Gundra Wex" },
      { img: 11, name: "Extra One" },
      { img: 12, name: "Extra Two" },
    ],
  },
  {
    title: "Vogue Evolution — New York City",
    radius: 500,
    cardImages: [13, 14, 15, 16],
    gridImages: [
      { img: 13, name: "Arlo Quinn" },
      { img: 14, name: "Vera Kline" },
      { img: 15, name: "Juno Vale" },
      { img: 16, name: "Ember Dash" },
      { img: 17, name: "Rylee Voss" },
      { img: 18, name: "Harlow Nova" },
      { img: 19, name: "Blake Lune" },
      { img: 22, name: "Zephyr Kade" },
      { img: 21, name: "Indigo Rae" },
      { img: 22, name: "Kairo Jett" },
      { img: 23, name: "Extra One" },
      { img: 24, name: "Extra Two" },
    ],
  },
  {
    title: "Glamour in the Desert — Dubai",
    radius: 500,
    cardImages: [25, 26, 27, 28],
    gridImages: [
      { img: 25, name: "Luca Raine" },
      { img: 26, name: "Rory Vale" },
      { img: 27, name: "Sable Zev" },
      { img: 28, name: "Ellis Nova" },
      { img: 29, name: "Wren Asher" },
      { img: 30, name: "Zane Sky" },
      { img: 31, name: "Rowan Juno" },
      { img: 32, name: "Fenix Blade" },
      { img: 33, name: "Alix Storm" },
      { img: 34, name: "Nova Ray" },
      { img: 35, name: "Extra One" },
      { img: 36, name: "Extra Two" },
    ],
  },
  {
    title: "Chic Couture Runway — Milan",
    radius: 500,
    cardImages: [37, 38, 39, 40],
    gridImages: [
      { img: 37, name: "Aeris Flint" },
      { img: 38, name: "Jett Voss" },
      { img: 39, name: "Caius Storm" },
      { img: 40, name: "Mira Celeste" },
      { img: 41, name: "Liam Ashford" },
      { img: 42, name: "Vega Dawn" },
      { img: 43, name: "Orion Phoenix" },
      { img: 44, name: "Rex Solara" },
      { img: 45, name: "Elara Finch" },
      { img: 46, name: "Zoe Star" },
      { img: 47, name: "Extra One" },
      { img: 48, name: "Extra Two" },
    ],
  },
  {
    title: "Style Showcase — London",
    radius: 650,
    cardImages: [49, 50, 51, 52, 53, 54],
    gridImages: [
      { img: 49, name: "Rylan Ash" },
      { img: 50, name: "Lyra Wren" },
      { img: 51, name: "Axel Orion" },
      { img: 52, name: "Nova Sky" },
      { img: 53, name: "Kael Dray" },
      { img: 54, name: "Vesper Quill" },
      { img: 55, name: "Lira Wilder" },
      { img: 56, name: "Indigo Raye" },
      { img: 57, name: "Juno Storm" },
      { img: 58, name: "Ollie Lune" },
      { img: 59, name: "Extra One" },
      { img: 60, name: "Extra Two" },
    ],
  },
  {
    title: "Future Fashion Forward — Tokyo",
    radius: 500,
    cardImages: [61, 62, 63, 64],
    gridImages: [
      { img: 61, name: "Corin Blaize" },
      { img: 62, name: "Tess Kade" },
      { img: 63, name: "Juno Hale" },
      { img: 64, name: "Coral Vale" },
      { img: 65, name: "Ari Lennox" },
      { img: 66, name: "Ronan Aster" },
      { img: 67, name: "Arius Quill" },
      { img: 68, name: "Rex Ember" },
      { img: 69, name: "Vega Ashford" },
      { img: 70, name: "Finn Fenix" },
      { img: 71, name: "Extra One" },
      { img: 72, name: "Extra Two" },
    ],
  },
];

// ── Easing helpers (matching GSAP easing names from original) ───────────────

function sineInOut(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function power2InOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function power3(t: number): number {
  return t * t * t;
}

function expoOut(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

// ── Carousel cell transforms — verbatim from getCarouselCellTransforms ──────

function getCellTransforms(
  count: number,
  radius: number
): { rotateY: number; translateZ: number }[] {
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    rotateY: i * step,
    translateZ: radius,
  }));
}

// ── Constants — from base.css ───────────────────────────────────────────────

const CAROUSEL_W = 400;
const CAROUSEL_H = 500;
const CELL_W = 350;
const CELL_H = 420;
const PERSPECTIVE = 900;
const BORDER_RADIUS = 4;

// ── Timeline structure ──────────────────────────────────────────────────────
// 600 frames total at 60fps = 10 seconds.
// We show 3 full carousel scenes (the most visually distinct ones).
// Each scene: carousel rotates in (scroll phase), then explodes into preview
// grid, then grid exits.
//
// Scene 1 (Paris, 4 cards):        frames 0–189    (3.15s)
//   - Carousel scroll:             0–109            rotateY 0→-180
//   - Carousel explode + grid in:  110–159
//   - Grid hold + exit:            160–189
//
// Scene 2 (London, 6 cards):       frames 190–389   (3.33s)
//   - Carousel spiral in:          190–219
//   - Carousel scroll:             220–319           rotateY 0→-180
//   - Carousel explode + grid in:  320–369
//   - Grid hold + exit:            370–389
//
// Scene 3 (Tokyo, 4 cards):        frames 390–599   (3.5s)
//   - Carousel spiral in:          390–419
//   - Carousel scroll:             420–539           rotateY 0→-180
//   - Carousel explode + grid in:  540–579
//   - Grid hold + exit:            580–599

interface SceneTimeline {
  sceneIndex: number;
  start: number;
  spiralIn: [number, number]; // [start, end] — entry spiral (skipped for first)
  scroll: [number, number]; // scroll phase
  explode: [number, number]; // carousel explode + grid entrance
  gridHold: [number, number]; // grid visible + exit
}

const TIMELINE: SceneTimeline[] = [
  {
    sceneIndex: 0,
    start: 0,
    spiralIn: [0, 0],
    scroll: [0, 109],
    explode: [110, 159],
    gridHold: [160, 189],
  },
  {
    sceneIndex: 4,
    start: 190,
    spiralIn: [190, 219],
    scroll: [220, 319],
    explode: [320, 369],
    gridHold: [370, 389],
  },
  {
    sceneIndex: 5,
    start: 390,
    spiralIn: [390, 419],
    scroll: [420, 539],
    explode: [540, 579],
    gridHold: [580, 599],
  },
];

// ── Card face component ─────────────────────────────────────────────────────

const CardFace: React.FC<{
  imgIndex: number;
  isBack?: boolean;
}> = ({ imgIndex, isBack }) => (
  <div
    style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      transform: isBack ? "rotateY(180deg)" : undefined,
      borderRadius: BORDER_RADIUS,
      overflow: "hidden",
    }}
  >
    <Img
      src={img(imgIndex)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
      }}
    />
  </div>
);

// ── Single carousel card (cell + card + front/back) ─────────────────────────

const CarouselCard: React.FC<{
  imgIndex: number;
  cellRotateY: number;
  cellTranslateZ: number;
  cardRotateZ: number;
  brightness: number;
  opacity: number;
}> = ({
  imgIndex,
  cellRotateY,
  cellTranslateZ,
  cardRotateZ,
  brightness,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      width: CELL_W,
      height: CELL_H,
      left: 0,
      top: 0,
      transformStyle: "preserve-3d",
      transform: `rotateY(${cellRotateY}deg) translateZ(${cellTranslateZ}px)`,
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        transformStyle: "preserve-3d",
        transform: `rotateZ(${cardRotateZ}deg)`,
        filter: `brightness(${brightness}%)`,
        opacity,
      }}
    >
      <CardFace imgIndex={imgIndex} />
      <CardFace imgIndex={imgIndex} isBack />
    </div>
  </div>
);

// ── Carousel assembly ───────────────────────────────────────────────────────

const Carousel: React.FC<{
  scene: CarouselScene;
  rotationY: number;
  rotationX: number;
  rotationZ: number;
  translateZ: number;
  yPercent: number;
  cardRotateZ: number;
  brightness: number;
  cardOpacity: number;
  explodeRotationZ: number;
}> = ({
  scene,
  rotationY,
  rotationX,
  rotationZ,
  translateZ,
  yPercent,
  cardRotateZ,
  brightness,
  cardOpacity,
  explodeRotationZ,
}) => {
  const transforms = useMemo(
    () => getCellTransforms(scene.cardImages.length, scene.radius),
    [scene]
  );

  return (
    <div
      style={{
        position: "absolute",
        width: CAROUSEL_W,
        height: CAROUSEL_H,
        top: "50%",
        left: "50%",
        marginTop: -CAROUSEL_H / 2,
        marginLeft: -CAROUSEL_W / 2,
        transformStyle: "preserve-3d",
        willChange: "transform",
        transform: `translateZ(${translateZ}px) translateY(${yPercent}%) rotateY(${rotationY}deg) rotateX(${rotationX}deg) rotateZ(${rotationZ + explodeRotationZ}deg)`,
      }}
    >
      {scene.cardImages.map((imgIdx, i) => (
        <CarouselCard
          key={imgIdx}
          imgIndex={imgIdx}
          cellRotateY={transforms[i].rotateY}
          cellTranslateZ={transforms[i].translateZ}
          cardRotateZ={cardRotateZ}
          brightness={brightness}
          opacity={cardOpacity}
        />
      ))}
    </div>
  );
};

// ── Title with character-level animation (SplitText port) ───────────────────

const AnimatedTitle: React.FC<{
  text: string;
  charOpacity: number;
}> = ({ text, charOpacity }) => (
  <h2
    style={{
      position: "relative",
      zIndex: 10,
      margin: 0,
      fontFamily: "'forma-djr-mono', monospace",
      textTransform: "uppercase",
      color: "#fff",
      fontSize: 18,
      letterSpacing: "0.05em",
    }}
  >
    <span style={{ display: "inline-block" }}>
      {text.split("").map((char, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            opacity: interpolate(
              charOpacity,
              [i / text.length, (i + 1) / text.length],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            transformStyle: "preserve-3d",
            transformOrigin: "50% 0%",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  </h2>
);

// ── Preview grid item with 3D entrance/exit ─────────────────────────────────

const GRID_COLS = 6;
const GRID_GAP = 12;

const GridItem: React.FC<{
  imgIndex: number;
  name: string;
  index: number;
  progress: number; // 0 = hidden, 1 = fully visible
  containerW: number;
  containerH: number;
}> = ({ imgIndex, name, index, progress, containerW, containerH }) => {
  const col = index % GRID_COLS;
  const row = Math.floor(index / GRID_COLS);
  const itemW = (containerW - (GRID_COLS - 1) * GRID_GAP) / GRID_COLS;
  const aspect = 4 / 5;
  const itemH = itemW / aspect;
  const x = col * (itemW + GRID_GAP);
  const y = row * (itemH + GRID_GAP + 16);

  const centerX = containerW / 2;
  const centerY = containerH / 2;
  const elCenterX = x + itemW / 2;
  const elCenterY = y + itemH / 2;
  const dx = centerX - elCenterX;
  const dy = centerY - elCenterY;
  const dist = Math.hypot(dx, dy);
  const maxDist = Math.hypot(containerW / 2, containerH / 2);
  const norm = maxDist ? dist / maxDist : 0;

  // Distance-based stagger: closer items appear first (original uses 1 - norm for "in")
  const stagger = (1 - norm) * 0.6;
  const itemProgress = interpolate(progress, [stagger, stagger + 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const scale = interpolate(itemProgress, [0, 1], [0.5, 1]);
  const opacity = itemProgress;
  const z = interpolate(itemProgress, [0, 1], [-3500, 0]);
  const yOffset = interpolate(itemProgress, [0, 1], [dy * 0.5, 0]);
  const rotY = dx < 0 ? interpolate(itemProgress, [0, 1], [100, 0]) : interpolate(itemProgress, [0, 1], [-100, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: itemW,
        transformStyle: "preserve-3d",
        transform: `translateY(${yOffset}px) translateZ(${z}px) rotateY(${rotY}deg) scale(${scale})`,
        opacity,
        overflow: "hidden",
        borderRadius: BORDER_RADIUS,
      }}
    >
      <Img
        src={img(imgIndex)}
        style={{
          width: "100%",
          aspectRatio: "4/5",
          objectFit: "cover",
          display: "block",
        }}
      />
      <h3
        style={{
          fontSize: 10,
          fontWeight: 400,
          margin: "4px 0 0",
          fontFamily: "'forma-djr-mono', monospace",
          textTransform: "uppercase",
          color: "#fff",
          letterSpacing: "0.03em",
        }}
      >
        {name}
      </h3>
    </div>
  );
};

// ── Preview grid ────────────────────────────────────────────────────────────

const PreviewGrid: React.FC<{
  scene: CarouselScene;
  progress: number; // 0–1 entrance, stays 1, then used for exit too
}> = ({ scene, progress }) => {
  const gridW = 1920 * 0.7; // 70% of viewport — original uses padding: 0 15vw
  const gridH = 1080 * 0.7;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: gridW,
        height: gridH,
        marginTop: -gridH / 2,
        marginLeft: -gridW / 2,
        perspective: PERSPECTIVE,
      }}
    >
      {/* Title + Close */}
      <div
        style={{
          display: "flex",
          width: "100%",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 16,
          opacity: progress,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily: "'forma-djr-mono', monospace",
            textTransform: "uppercase",
            color: "#fff",
            fontSize: 16,
            letterSpacing: "0.05em",
          }}
        >
          {scene.title}
        </h2>
        <span
          style={{
            fontFamily: "'forma-djr-mono', monospace",
            textTransform: "uppercase",
            color: "#fff",
            fontSize: 14,
            opacity: 0.6,
          }}
        >
          Close &times;
        </span>
      </div>
      {/* Grid */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: gridH - 40,
          perspective: PERSPECTIVE,
        }}
      >
        {scene.gridImages.map((item, i) => (
          <GridItem
            key={item.img}
            imgIndex={item.img}
            name={item.name}
            index={i}

            progress={progress}
            containerW={gridW}
            containerH={gridH - 40}
          />
        ))}
      </div>
    </div>
  );
};

// ── Phase renderer for one timeline segment ─────────────────────────────────

const ScenePhase: React.FC<{
  timeline: SceneTimeline;
  frame: number;
}> = ({ timeline, frame }) => {
  const scene = SCENES[timeline.sceneIndex];
  const isEven = timeline.sceneIndex % 2 === 1;

  // ── Spiral-in phase ───────────────────────────────────────────────
  const [spiralStart, spiralEnd] = timeline.spiralIn;
  const hasSpiralIn = spiralEnd > spiralStart;
  const spiralProgress = hasSpiralIn
    ? interpolate(frame, [spiralStart, spiralEnd], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;
  const spiralEased = expoOut(spiralProgress);

  // ── Scroll phase — matches createScrollAnimation exactly ──────────
  const [scrollStart, scrollEnd] = timeline.scroll;
  const scrollProgress = interpolate(frame, [scrollStart, scrollEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // rotateY: 0 → -180 (with initial 45deg offset for even scenes)
  const baseY = isEven ? 45 : 0;
  const scrollRotY = interpolate(scrollProgress, [0, 1], [baseY, baseY - 180]);
  // rotateX: 3 → -3, rotateZ: 3 → -3 (sine.inOut)
  const tiltProgress = sineInOut(scrollProgress);
  const scrollRotX = interpolate(tiltProgress, [0, 1], [3, -3]);
  const scrollRotZ = interpolate(tiltProgress, [0, 1], [3, -3]);
  // Card rotateZ: 10 → -10
  const cardRotZ = interpolate(scrollProgress, [0, 1], [10, -10]);
  // Brightness: 250% → 80% (power3 easing)
  const brightEased = power3(scrollProgress);
  const brightness = interpolate(brightEased, [0, 1], [250, 80]);

  // ── Explode phase — matches activatePreviewFromCarousel ───────────
  const [explodeStart, explodeEnd] = timeline.explode;
  const explodeProgress = interpolate(
    frame,
    [explodeStart, explodeEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const explodeEased = power2InOut(explodeProgress);

  // Carousel goes: rotationX → 90, rotationY → -360, z → -2000, then z → 1500, rotationZ → 270
  const explodeRotX = interpolate(explodeEased, [0, 0.4, 1], [0, 90, 90]);
  const explodeRotYAdd = interpolate(
    explodeEased,
    [0, 1],
    [0, -360 - (baseY - 180)]
  );
  const explodeZ1 = interpolate(explodeEased, [0, 0.3, 1], [-550, -2000, 1500]);
  const explodeRotZAdd = interpolate(explodeEased, [0.3, 1], [0, 270], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Title character opacity
  const titleCharOpacity =
    frame < explodeStart
      ? interpolate(frame, [scrollStart, scrollStart + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : interpolate(explodeProgress, [0, 0.3], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  // ── Grid phase ────────────────────────────────────────────────────
  const [gridHoldStart, gridHoldEnd] = timeline.gridHold;
  const gridEntranceProgress = interpolate(
    frame,
    [explodeStart + (explodeEnd - explodeStart) * 0.6, explodeEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const gridExitProgress = interpolate(
    frame,
    [gridHoldStart, gridHoldEnd],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const gridProgress =
    frame < gridHoldStart
      ? gridEntranceProgress
      : gridExitProgress;

  // Determine visibility
  const showCarousel = frame < explodeEnd;
  const showGrid = frame >= explodeStart + (explodeEnd - explodeStart) * 0.5;

  // ── Spiral-in entry values ────────────────────────────────────────
  const entryZ = hasSpiralIn
    ? interpolate(spiralEased, [0, 1], [-1500, -550])
    : -550;
  const entryYPercent = hasSpiralIn
    ? interpolate(spiralEased, [0, 1], [300, 0])
    : 0;
  const entryRotYAdd = hasSpiralIn
    ? interpolate(spiralEased, [0, 1], [-720, 0])
    : 0;
  const entryCardOpacity = hasSpiralIn
    ? interpolate(spiralEased, [0, 1], [0, 1])
    : 1;

  // ── Compose final values ──────────────────────────────────────────
  const finalRotY =
    frame < explodeStart
      ? scrollRotY + entryRotYAdd
      : scrollRotY + explodeRotYAdd;
  const finalRotX =
    frame < explodeStart ? scrollRotX : scrollRotX + explodeRotX;
  const finalRotZ = frame < explodeStart ? scrollRotZ : scrollRotZ;
  const finalZ = frame < explodeStart ? entryZ : explodeZ1;
  const finalYPercent = frame < explodeStart ? entryYPercent : 0;
  const finalExplodeRotZ = frame < explodeStart ? 0 : explodeRotZAdd;
  const finalCardOpacity =
    frame < spiralEnd ? entryCardOpacity : explodeProgress > 0.8 ? 0 : 1;

  return (
    <>
      {showCarousel && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            perspective: PERSPECTIVE,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <AnimatedTitle text={scene.title} charOpacity={titleCharOpacity} />
          <Carousel
            scene={scene}
            rotationY={finalRotY}
            rotationX={finalRotX}
            rotationZ={finalRotZ}
            translateZ={finalZ}
            yPercent={finalYPercent}
            cardRotateZ={cardRotZ}
            brightness={brightness}
            cardOpacity={finalCardOpacity}
            explodeRotationZ={finalExplodeRotZ}
          />
        </div>
      )}
      {showGrid && (
        <PreviewGrid scene={scene} progress={gridProgress} />
      )}
    </>
  );
};

// ── Main composition ────────────────────────────────────────────────────────

export const Carousel3D: React.FC = () => {
  const frame = useCurrentFrame();
  // Determine which timeline segment is active
  const activeTimeline = TIMELINE.find((_tl, i) => {
    const next = TIMELINE[i + 1];
    if (!next) return true;
    return frame < next.start;
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0f0e0e",
        fontFamily: "'forma-djr-mono', sans-serif",
        textTransform: "uppercase",
        overflow: "hidden",
      }}
    >
      {/* Fixed frame header — verbatim from original */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: 8,
          zIndex: 1000,
          pointerEvents: "none",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h1
            style={{
              fontSize: 14,
              fontWeight: 400,
              margin: 0,
              color: "#fff",
              fontFamily: "'forma-djr-mono', monospace",
              textTransform: "uppercase",
            }}
          >
            On-Scroll 3D Carousel
          </h1>
          <div style={{ display: "flex", gap: 16 }}>
            {["#3d", "#carousel", "#page-transition"].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 12,
                  color: "#fff",
                  fontFamily: "'forma-djr-mono', monospace",
                  textTransform: "uppercase",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
          {["Article", "Code", "All demos"].map((link) => (
            <span
              key={link}
              style={{
                fontSize: 12,
                color: "#fff",
                fontFamily: "'forma-djr-mono', monospace",
                textTransform: "uppercase",
              }}
            >
              {link}
            </span>
          ))}
        </div>
      </div>

      {/* Active scene */}
      {activeTimeline && (
        <ScenePhase timeline={activeTimeline} frame={frame} />
      )}
    </AbsoluteFill>
  );
};
