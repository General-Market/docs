// Source: https://github.com/codrops/OneElementScroll
//
// Codrops "One Element Scroll" — a single image element morphs across 6 layout
// positions via GSAP Flip as the page scrolls. Ported to Remotion: frame replaces
// scroll, interpolate() replaces ScrollTrigger scrub, manual position keyframes
// replace Flip.fit().
//
// Sections in the original:
//   1. content--initial  — full-screen hero (the ONE element lives here at start)
//   2. content--center   — centered portrait with overlay title "Seraph Kamos"
//   3. content--column   — 5-column grid, ONE element sits in the middle
//   4. content--lines    — text rows with inline images, ONE element in first row
//   5. content--sides    — left image + right text, ONE element is the left image
//   6. content--center-tall — centered portrait with large overlay text
//   7. content--grid     — 3x3 image grid, ONE element in center cell

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
  staticFile,
} from "remotion";

// ── Assets ──────────────────────────────────────────────────────────────────

const ASSET_DIR = "compositions/one-element-scroll";
const img = (name: string) => staticFile(`${ASSET_DIR}/${name}`);

// All 14 images from the original repo
const IMAGES = {
  main: img("main.jpg"),
  1: img("1.jpg"),
  2: img("2.jpg"),
  3: img("3.jpg"),
  4: img("4.jpg"),
  5: img("5.jpg"),
  6: img("6.jpg"),
  7: img("7.jpg"),
  8: img("8.jpg"),
  9: img("9.jpg"),
  10: img("10.jpg"),
  11: img("11.jpg"),
  12: img("12.jpg"),
  13: img("13.jpg"),
  noise: img("noise.png"),
};

// ── Color palette from original CSS ─────────────────────────────────────────

const COLORS = {
  bg: "rgb(234, 234, 234)",
  text: "#503717",
  link: "#b19162",
  title: "#000",
  gradient1: "rgba(234, 234, 234, 0.8)",
  gradient2: "rgba(229, 134, 27, 0.3)",
};

// ── Typography ──────────────────────────────────────────────────────────────
// Original uses "harpagan" (font-alt) and "capitana" (body).
// We approximate with system serifs and sans-serifs.

const FONT_ALT: React.CSSProperties = {
  fontFamily: '"Georgia", "Times New Roman", serif',
  fontWeight: 500,
};

const FONT_BODY: React.CSSProperties = {
  fontFamily: '"Helvetica Neue", "Arial", sans-serif',
  fontWeight: 400,
};

// ── Easing helpers ──────────────────────────────────────────────────────────

const sineInOut = Easing.inOut(Easing.sin);
const sineOut = Easing.out(Easing.sin);

// ── Layout constants (1920x1080 canvas) ─────────────────────────────────────

const W = 1920;
const H = 1080;

// The "ONE element" keyframes — where it morphs to at each step.
// Each step: { x, y, w, h } in absolute canvas coordinates.
// Derived from the original CSS layout positions of [data-step] elements.

interface FlipKeyframe {
  x: number;
  y: number;
  w: number;
  h: number;
  borderRadius?: number;
}

const FLIP_STEPS: FlipKeyframe[] = [
  // Step 0: Hero — full screen
  { x: 0, y: 0, w: W, h: H },
  // Step 1: content--center — centered portrait (aspect 0.8, height 38vh)
  { x: W / 2 - 164, y: H / 2 - 205, w: 328, h: 410 },
  // Step 2: content--column — middle of 5 columns
  { x: W / 2 - 75, y: H / 2 - 100, w: 150, h: 188 },
  // Step 3: content--lines — inline image in first text row
  { x: W / 2 - 80, y: H / 2 - 30, w: 160, h: 65 },
  // Step 4: content--sides — left half image
  { x: 0, y: H * 0.25, w: W * 0.4, h: H * 0.5 },
  // Step 5: content--center-tall — centered portrait
  { x: W / 2 - 130, y: H * 0.2, w: 260, h: 324 },
  // Step 6: content--grid — center cell of 3x3
  { x: W / 3, y: H / 3, w: W / 3, h: H / 3 },
];

// ── Section frame ranges (480 total) ────────────────────────────────────────
// 7 steps = 6 transitions + initial hold + final hold

// Frame budget per section (approximate):
// Hold hero (0-30), morph to center (30-90), hold center, morph to column (90-150),
// morph to lines (150-210), morph to sides (210-270), morph to center-tall (270-340),
// morph to grid (340-420), hold grid (420-480)

const SECTION_FRAMES = [
  { start: 0, end: 40 },     // Hold hero
  { start: 40, end: 100 },   // Morph hero -> center
  { start: 100, end: 160 },  // Morph center -> column
  { start: 160, end: 220 },  // Morph column -> lines
  { start: 220, end: 290 },  // Morph lines -> sides
  { start: 290, end: 360 },  // Morph sides -> center-tall
  { start: 360, end: 430 },  // Morph center-tall -> grid
  { start: 430, end: 480 },  // Hold grid
];

// ── Interpolation helper ────────────────────────────────────────────────────

function lerpKeyframe(
  frame: number,
  fromStep: number,
  toStep: number,
  startFrame: number,
  endFrame: number
): FlipKeyframe {
  const a = FLIP_STEPS[fromStep];
  const b = FLIP_STEPS[toStep];
  const t = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineInOut,
  });
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function getOneElementRect(frame: number): FlipKeyframe {
  // Hold hero
  if (frame <= SECTION_FRAMES[0].end) return FLIP_STEPS[0];
  // Morph hero -> center
  if (frame <= SECTION_FRAMES[1].end)
    return lerpKeyframe(frame, 0, 1, SECTION_FRAMES[1].start, SECTION_FRAMES[1].end);
  // Morph center -> column
  if (frame <= SECTION_FRAMES[2].end)
    return lerpKeyframe(frame, 1, 2, SECTION_FRAMES[2].start, SECTION_FRAMES[2].end);
  // Morph column -> lines
  if (frame <= SECTION_FRAMES[3].end)
    return lerpKeyframe(frame, 2, 3, SECTION_FRAMES[3].start, SECTION_FRAMES[3].end);
  // Morph lines -> sides
  if (frame <= SECTION_FRAMES[4].end)
    return lerpKeyframe(frame, 3, 4, SECTION_FRAMES[4].start, SECTION_FRAMES[4].end);
  // Morph sides -> center-tall
  if (frame <= SECTION_FRAMES[5].end)
    return lerpKeyframe(frame, 4, 5, SECTION_FRAMES[5].start, SECTION_FRAMES[5].end);
  // Morph center-tall -> grid
  if (frame <= SECTION_FRAMES[6].end)
    return lerpKeyframe(frame, 5, 6, SECTION_FRAMES[6].start, SECTION_FRAMES[6].end);
  // Hold grid
  return FLIP_STEPS[6];
}

// ── Sub-components ──────────────────────────────────────────────────────────

// The ONE element — the single image that morphs everywhere
const OneElement: React.FC<{ frame: number }> = ({ frame }) => {
  const rect = getOneElementRect(frame);

  // Brightness filter: starts at 80%, goes to 100% during first morph
  const brightness = interpolate(frame, [0, 100], [80, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        backgroundImage: `url(${IMAGES.main})`,
        backgroundSize: "cover",
        backgroundPosition: "50% 50%",
        filter: `brightness(${brightness}%)`,
        zIndex: 10,
        willChange: "transform",
      }}
    />
  );
};

// Title "Seraph Kamos" — appears during center section with span sliding
const HeroTitle: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [50, 70, 130, 150], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Seraph" slides from left, "Kamos" from right
  const seraphX = interpolate(frame, [40, 90], [-150, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineOut,
  });

  const kamosX = interpolate(frame, [40, 90], [150, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 20,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    >
      <span
        style={{
          ...FONT_ALT,
          fontSize: 160,
          lineHeight: 0.9,
          textTransform: "uppercase",
          color: COLORS.title,
          transform: `translateX(${seraphX}px)`,
        }}
      >
        Seraph
      </span>
      <span
        style={{
          ...FONT_ALT,
          fontSize: 160,
          lineHeight: 0.9,
          textTransform: "uppercase",
          color: COLORS.title,
          transform: `translateX(${kamosX}px)`,
        }}
      >
        Kamos
      </span>
    </div>
  );
};

// 5-column image row — appears during column section
const ColumnImages: React.FC<{ frame: number }> = ({ frame }) => {
  const columnImgs = [IMAGES[1], IMAGES[2], null, IMAGES[3], IMAGES[4]];
  const opacity = interpolate(frame, [90, 110, 160, 175], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 40,
        zIndex: 5,
        opacity,
      }}
    >
      {columnImgs.map((src, i) => {
        if (!src) return <div key={i} style={{ width: 150, height: 188 }} />;

        // Parallax: outer images move more
        const middleIndex = 2;
        const intensity = Math.abs(i - middleIndex) * 30;
        const parallaxY = interpolate(frame, [90, 170], [intensity, -intensity], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        // Scale-in animation
        const scale = interpolate(frame, [95 + i * 5, 115 + i * 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        const imgOpacity = interpolate(frame, [95 + i * 5, 115 + i * 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              width: 150,
              height: 188,
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "50% 50%",
              transform: `translateY(${parallaxY}px) scale(${scale})`,
              opacity: imgOpacity,
              filter: `brightness(${interpolate(scale, [0, 1], [180, 100])}%) saturate(${interpolate(scale, [0, 1], [0, 100])}%)`,
            }}
          />
        );
      })}
    </div>
  );
};

// Text lines section — "Natural [img] Garments", "Crafted with [img] love", etc.
const TextLines: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [155, 170, 220, 235], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const lines = [
    { left: "Natural", right: "Garments", img: null },
    { left: "Crafted with", right: "love", img: IMAGES[5] },
    { left: "with", right: "respect", img: IMAGES[4] },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        zIndex: 5,
        opacity,
      }}
    >
      {lines.map((line, i) => {
        const leftX = interpolate(frame, [160 + i * 8, 200 + i * 8], [-150, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });
        const rightX = interpolate(frame, [160 + i * 8, 200 + i * 8], [150, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        const imgScale = line.img
          ? interpolate(frame, [165 + i * 8, 195 + i * 8], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: sineOut,
            })
          : 1;

        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              ...FONT_ALT,
              fontSize: 72,
              lineHeight: 1.1,
              textTransform: "uppercase",
              color: COLORS.title,
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ transform: `translateX(${leftX}px)` }}>
              {line.left}
            </span>
            {line.img ? (
              <div
                style={{
                  width: 180,
                  height: 52,
                  backgroundImage: `url(${line.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "50% 50%",
                  transform: `scale(${imgScale})`,
                  flexShrink: 0,
                }}
              />
            ) : (
              // First row: the ONE element occupies this spot (data-step)
              <div style={{ width: 160, height: 52 }} />
            )}
            <span style={{ transform: `translateX(${rightX}px)` }}>
              {line.right}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// Side layout: left image + right text paragraph
const SidesSection: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [220, 240, 290, 305], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text parallax: starts 250px below, moves to -250px above
  const textY = interpolate(frame, [220, 290], [250, -250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineOut,
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "grid",
        gridTemplateColumns: "40% 1fr",
        alignItems: "center",
        zIndex: 5,
        opacity,
      }}
    >
      {/* Left: the ONE element occupies this area */}
      <div />
      {/* Right: text */}
      <div
        style={{
          ...FONT_BODY,
          fontSize: 20,
          lineHeight: 1.6,
          color: COLORS.text,
          padding: "0 60px",
          maxWidth: 500,
          transform: `translateY(${textY}px)`,
        }}
      >
        <p>
          <strong>Welcome to Seraph Kamos</strong> where time meets the eternal.
          We believe in crafting more than garments — we create connections.
          Connections to the earth, to human hands, and to the moments that
          matter.
        </p>
      </div>
    </div>
  );
};

// Center-tall section: centered image + large overlay text
const CenterTallSection: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [290, 310, 365, 380], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 5,
        opacity,
        padding: "0 120px",
      }}
    >
      <p
        style={{
          ...FONT_BODY,
          fontSize: 36,
          lineHeight: 1.5,
          color: COLORS.text,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        We honor the hands that touch every thread, partnering with artisans and
        communities to ensure fairness, respect, and dignity at every step.
      </p>
    </div>
  );
};

// 3x3 image grid — final section
const GridSection: React.FC<{ frame: number }> = ({ frame }) => {
  const opacity = interpolate(frame, [360, 380, 470, 480], [0, 1, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid images: positions match original (center is the ONE element)
  const gridImgs = [
    IMAGES[13], null,       IMAGES[12],
    IMAGES[9],  IMAGES[7],  IMAGES[11],
    IMAGES[8],  IMAGES[10], IMAGES[6],
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: -W * 0.1,
        width: W * 1.2,
        height: H,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gridTemplateRows: "repeat(3, 1fr)",
        gap: 12,
        zIndex: 5,
        opacity,
      }}
    >
      {gridImgs.map((src, i) => {
        if (!src) {
          // Center cell: the ONE element fills this
          return <div key={i} />;
        }

        const stagger = i * 4;
        const scale = interpolate(frame, [370 + stagger, 400 + stagger], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });
        const cellOpacity = interpolate(
          frame,
          [370 + stagger, 400 + stagger],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        const bright = interpolate(scale, [0, 1], [180, 100]);
        const sat = interpolate(scale, [0, 1], [0, 100]);

        return (
          <div
            key={i}
            style={{
              width: "100%",
              height: "100%",
              backgroundImage: `url(${src})`,
              backgroundSize: "cover",
              backgroundPosition: "50% 50%",
              transform: `scale(${scale})`,
              opacity: cellOpacity,
              filter: `brightness(${bright}%) saturate(${sat}%)`,
            }}
          />
        );
      })}
    </div>
  );
};

// ── Main composition ────────────────────────────────────────────────────────

export const OneElementScroll: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        backgroundImage: `url(${IMAGES.noise}), radial-gradient(ellipse at top, ${COLORS.gradient1}, transparent), radial-gradient(ellipse at bottom, ${COLORS.gradient2}, transparent)`,
        backgroundSize: "180px, 100%, 200%",
        overflow: "hidden",
        ...FONT_BODY,
        color: COLORS.text,
      }}
    >
      {/* Static section backgrounds / decorations */}
      <ColumnImages frame={frame} />
      <TextLines frame={frame} />
      <SidesSection frame={frame} />
      <CenterTallSection frame={frame} />
      <GridSection frame={frame} />
      <HeroTitle frame={frame} />

      {/* THE one element — always on top, morphing across all positions */}
      <OneElement frame={frame} />

      {/* Frame header — from original */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 100,
          textTransform: "uppercase",
          fontSize: 11,
          letterSpacing: 1,
          color: COLORS.text,
          opacity: interpolate(frame, [0, 30, 40, 60], [0, 0, 1, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        One Element Scroll
      </div>
    </AbsoluteFill>
  );
};
