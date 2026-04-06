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
//   7. content--grid     — 3x3 image grid, ONE element in top-center cell

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

// Grid constants for the final grid section (matches CSS: width 120%, left -10%, gap 1rem)
const GRID_W = W * 1.2;       // 2304
const GRID_LEFT = -W * 0.1;   // -192
const GRID_GAP = 16;           // 1rem
const GRID_CELL_W = (GRID_W - 2 * GRID_GAP) / 3;   // ~757
const GRID_CELL_H = (H - 2 * GRID_GAP) / 3;         // ~349

// Lines section: font-size clamp(2rem,12vw,6rem) at 1920px = 96px
// Image: height 0.725em = 69.6px, aspect-ratio 16/9 → width ~124px
const LINES_IMG_H = Math.round(0.725 * 96);  // 70
const LINES_IMG_W = Math.round(LINES_IMG_H * (16 / 9)); // 124

// Center-tall: height 30vh, aspect-ratio 0.8, padding-top 20vh
const CT_IMG_H = Math.round(H * 0.3);  // 324
const CT_IMG_W = Math.round(CT_IMG_H * 0.8); // 259
const CT_PAD_TOP = Math.round(H * 0.2); // 216
// Text block ~175px tall, gap 1.5rem = 24px. Total content = 324+24+175 = 523
// Available after padding = 1080-216 = 864. Centered: top = 216 + (864-523)/2 ≈ 387
const CT_CONTENT_H = CT_IMG_H + 24 + 175;
const CT_AVAIL = H - CT_PAD_TOP;
const CT_IMG_Y = CT_PAD_TOP + Math.round((CT_AVAIL - CT_CONTENT_H) / 2);

const FLIP_STEPS: FlipKeyframe[] = [
  // Step 0: Hero — full screen
  { x: 0, y: 0, w: W, h: H },
  // Step 1: content--center — centered portrait (height 38vh, aspect-ratio 0.8)
  { x: W / 2 - 164, y: H / 2 - 205, w: 328, h: 410 },
  // Step 2: content--column — middle of 5 columns (max-width 150px, aspect-ratio 0.8)
  { x: W / 2 - 75, y: Math.round((H - 188) / 2), w: 150, h: 188 },
  // Step 3: content--lines — inline image in first text row (0.725em at 96px, 16:9)
  { x: W / 2 - Math.round(LINES_IMG_W / 2), y: H / 2 - Math.round(LINES_IMG_H / 2), w: LINES_IMG_W, h: LINES_IMG_H },
  // Step 4: content--sides — left image (grid-template-columns 40% 1fr, height 50vh)
  { x: 0, y: H * 0.25, w: W * 0.4, h: H * 0.5 },
  // Step 5: content--center-tall — centered portrait (30vh, aspect 0.8, padding-top 20vh)
  { x: W / 2 - Math.round(CT_IMG_W / 2), y: CT_IMG_Y, w: CT_IMG_W, h: CT_IMG_H },
  // Step 6: content--grid — TOP-CENTER cell (row 0, col 1) of 3x3
  { x: GRID_LEFT + GRID_CELL_W + GRID_GAP, y: 0, w: Math.round(GRID_CELL_W), h: Math.round(GRID_CELL_H) },
];

// ── Section frame ranges (480 total) ────────────────────────────────────────
// 6 morphs + 7 holds = 13 sections. Each morph is ~52 frames, each hold ~24 frames.
// Original GSAP timeline: 6 Flip.fit() calls each with duration 1, separated by
// +=0.5 gaps. Total = 8.5 units. The gaps create brief holds at each landed
// position before the next morph begins — essential to the original's rhythm.
const SECTION_FRAMES = [
  { start: 0, end: 30 },     // Hold hero
  { start: 30, end: 82 },    // Morph hero -> center
  { start: 82, end: 106 },   // Hold center
  { start: 106, end: 158 },  // Morph center -> column
  { start: 158, end: 182 },  // Hold column
  { start: 182, end: 234 },  // Morph column -> lines
  { start: 234, end: 258 },  // Hold lines
  { start: 258, end: 310 },  // Morph lines -> sides
  { start: 310, end: 334 },  // Hold sides
  { start: 334, end: 386 },  // Morph sides -> center-tall
  { start: 386, end: 410 },  // Hold center-tall
  { start: 410, end: 462 },  // Morph center-tall -> grid
  { start: 462, end: 480 },  // Hold grid
];

// ── Interpolation helper ────────────────────────────────────────────────────

function lerpKeyframe(
  frame: number,
  fromStep: number,
  toStep: number,
  startFrame: number,
  endFrame: number,
  easing: (t: number) => number = sineInOut
): FlipKeyframe {
  const a = FLIP_STEPS[fromStep];
  const b = FLIP_STEPS[toStep];
  const t = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    w: a.w + (b.w - a.w) * t,
    h: a.h + (b.h - a.h) * t,
  };
}

function getOneElementRect(frame: number): FlipKeyframe {
  // [0] Hold hero
  if (frame <= SECTION_FRAMES[0].end) return FLIP_STEPS[0];
  // [1] Morph hero -> center (original: ease 'none')
  if (frame <= SECTION_FRAMES[1].end)
    return lerpKeyframe(frame, 0, 1, SECTION_FRAMES[1].start, SECTION_FRAMES[1].end, (t) => t);
  // [2] Hold center
  if (frame <= SECTION_FRAMES[2].end) return FLIP_STEPS[1];
  // [3] Morph center -> column
  if (frame <= SECTION_FRAMES[3].end)
    return lerpKeyframe(frame, 1, 2, SECTION_FRAMES[3].start, SECTION_FRAMES[3].end);
  // [4] Hold column
  if (frame <= SECTION_FRAMES[4].end) return FLIP_STEPS[2];
  // [5] Morph column -> lines
  if (frame <= SECTION_FRAMES[5].end)
    return lerpKeyframe(frame, 2, 3, SECTION_FRAMES[5].start, SECTION_FRAMES[5].end);
  // [6] Hold lines
  if (frame <= SECTION_FRAMES[6].end) return FLIP_STEPS[3];
  // [7] Morph lines -> sides
  if (frame <= SECTION_FRAMES[7].end)
    return lerpKeyframe(frame, 3, 4, SECTION_FRAMES[7].start, SECTION_FRAMES[7].end);
  // [8] Hold sides
  if (frame <= SECTION_FRAMES[8].end) return FLIP_STEPS[4];
  // [9] Morph sides -> center-tall
  if (frame <= SECTION_FRAMES[9].end)
    return lerpKeyframe(frame, 4, 5, SECTION_FRAMES[9].start, SECTION_FRAMES[9].end);
  // [10] Hold center-tall
  if (frame <= SECTION_FRAMES[10].end) return FLIP_STEPS[5];
  // [11] Morph center-tall -> grid
  if (frame <= SECTION_FRAMES[11].end)
    return lerpKeyframe(frame, 5, 6, SECTION_FRAMES[11].start, SECTION_FRAMES[11].end);
  // [12] Hold grid
  return FLIP_STEPS[6];
}

// ── Sub-components ──────────────────────────────────────────────────────────

// The ONE element — the single image that morphs everywhere
const OneElement: React.FC<{ frame: number }> = ({ frame }) => {
  const rect = getOneElementRect(frame);

  // Brightness filter: starts at 80%, goes to 100% over the first morph region
  const brightness = interpolate(frame, [0, 82], [80, 100], {
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
  // Visible during center section: fade in during morph, hold, fade out as column morph begins
  const opacity = interpolate(frame, [40, 60, 106, 130], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Seraph" slides from left, "Kamos" from right — during hero->center morph
  const seraphX = interpolate(frame, [30, 82], [-150, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: sineOut,
  });

  const kamosX = interpolate(frame, [30, 82], [150, 0], {
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
  // Visible during column section (morph 106-158, hold 158-182)
  const opacity = interpolate(frame, [106, 125, 182, 200], [0, 1, 1, 0], {
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
        gap: 32,
        zIndex: 5,
        opacity,
      }}
    >
      {columnImgs.map((src, i) => {
        if (!src) return <div key={i} style={{ width: 150, height: 188 }} />;

        // Parallax: outer images move more
        const middleIndex = 2;
        const intensity = Math.abs(i - middleIndex) * 75;
        const parallaxY = interpolate(frame, [106, 195], [intensity, -intensity], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        // Scale-in animation
        const scale = interpolate(frame, [110 + i * 5, 130 + i * 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        const imgOpacity = interpolate(frame, [110 + i * 5, 130 + i * 5], [0, 1], {
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
  // Visible during lines section (morph 182-234, hold 234-258)
  const opacity = interpolate(frame, [182, 200, 258, 278], [0, 1, 1, 0], {
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
        const leftX = interpolate(frame, [185 + i * 8, 225 + i * 8], [-150, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });
        const rightX = interpolate(frame, [185 + i * 8, 225 + i * 8], [150, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });

        const imgScale = line.img
          ? interpolate(frame, [190 + i * 8, 220 + i * 8], [0, 1], {
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
              gap: 10,
              ...FONT_ALT,
              fontSize: 96,
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
                  width: LINES_IMG_W,
                  height: LINES_IMG_H,
                  backgroundImage: `url(${line.img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "50% 50%",
                  transform: `scale(${imgScale})`,
                  flexShrink: 0,
                }}
              />
            ) : (
              // First row: the ONE element occupies this spot (data-step)
              <div style={{ width: LINES_IMG_W, height: LINES_IMG_H }} />
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
  // Visible during sides section (morph 258-310, hold 310-334)
  const opacity = interpolate(frame, [258, 278, 334, 355], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Text parallax: starts 250px below, moves to -250px above
  const textY = interpolate(frame, [258, 334], [250, -250], {
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
  // Visible during center-tall section (morph 334-386, hold 386-410)
  const opacity = interpolate(frame, [334, 355, 410, 430], [0, 1, 1, 0], {
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
        paddingTop: CT_PAD_TOP,
        paddingLeft: 120,
        paddingRight: 120,
      }}
    >
      <p
        style={{
          ...FONT_BODY,
          fontSize: 32,
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
  // Visible during grid section (morph 410-462, hold 462-480)
  const opacity = interpolate(frame, [410, 430, 475, 480], [0, 1, 1, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Grid images: positions match original HTML (top-center is the ONE element)
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
        gap: GRID_GAP,
        zIndex: 5,
        opacity,
      }}
    >
      {gridImgs.map((src, i) => {
        if (!src) {
          // Top-center cell: the ONE element fills this
          return <div key={i} />;
        }

        const stagger = i * 4;
        const scale = interpolate(frame, [415 + stagger, 445 + stagger], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: sineOut,
        });
        const cellOpacity = interpolate(
          frame,
          [415 + stagger, 445 + stagger],
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
          opacity: interpolate(frame, [0, 20, 30, 50], [0, 0, 1, 1], {
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
