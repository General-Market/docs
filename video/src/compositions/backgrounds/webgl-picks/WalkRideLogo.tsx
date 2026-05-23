// "Chevrolet Mobility Month"-style brand-mark reveal.
//
// Three layers, in order:
//   1. Diagonal bands of WALK (top half, sliding left) and RIDE (bottom half,
//      sliding right), both `rotate(6deg) skewY(-11deg)`. Many rows; the rows
//      nearer the centre fade their alpha so the brand mark stays legible.
//   2. The brand mark "M" — a flowing line drawn across the centre via
//      stroke-dashoffset. Built from two real SVG path segments (mPt1, mPt2)
//      taken verbatim from the source. The "M" is used both as a visible
//      stroke and as a clip mask, so the inner Chevrolet wordmark + year
//      appear only inside the M's stroke.
//   3. The wordmark "CHEVROLET 2026" slides in from the right; the words
//      "MOBILITY MONTH" rotate into a ring around the mark.
//
// Opening tl runs over ~2.5s; the remaining ~7.5s holds the final composition
// while WALK / RIDE keep scrolling.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
} from "remotion";

const BG = "#008cb2";
const WALK_FILL = "#0a5265";

// ─── Verbatim path data from the source ─────────────────────────────────────

// First half of the "M" outline.
const M_PT1_D =
  "M3.8 169.28c4.37-19.55 28.3-89 28.3-89s15.69.51 6.95 32.41 1.8 31.38 1.8 31.38 28.81-65.08 29.84-65.08 16.72 2.57 5.14 29.58-20.84 52.99 22.38 58.14";

// Second half of the "M" outline (the looping right side).
const M_PT2_D =
  "M103.47 104.07c-12.21 14.8-15.56 27.4-12.21 34.86s16.72 6.95 22.89-6.17 12.09-30.61 10.03-33.96-15.69-3.09-11.06 9.52 25.72-10.29 25.72-10.29 9 2.06 4.37 14.66-10.03 29.84-4.37 30.1 12.91-10.77 19.32-24.86 9.6-20.88 4.97-21.14-5.25 6.13-3.96 11.28 4.37 13.89 9.77 15.18 21.61 3.34 29.84-7.72 7.97-22.64-4.37-17.75-23.41 21.09-21.35 37.3 28.81 5.92 36.01-7.72c0 0-3.34 6.43.51 11.32s27.2 4.21 25.3-4.09c-2.24-9.77-12.97-15.7-15.7-20.66-2.16-3.94 9.53-22.25 22.3-15.38 6.69 3.6-3.6 19.29-3.09 20";

// The big fill shape that is masked by the M. Only the pixels overlapping the
// M's stroke become visible — this is what makes the Chevrolet wordmark sit
// "inside" the brand mark's outline.
const M_FILL_D =
  "M248.26 98.16c-8.44-12.6-29.17-1.95-33.96 9.26-2.57 6.07-.51 10.29 4.17 14.41 2.42 2.06 13.89 7.72 5.5 10.14-3.7 1.08-9.57.57-12.4-2.21-2.06-2.06-1.44-3.09-1.59-5.66-.05-.72.36-1.44-.77-1.23-5.61 5.97-23.67 19.96-25.98 4.63 10.7-.51 25.21-9.67 27.63-20.48 1.8-7.82-1.44-13.84-9.88-14.51-12.24-.93-22.84 9.47-28.81 19.09l-4.12 7.72c-.93-.15-1.8-.93-1.8-1.8 0-1.03 3.24-8.33 3.76-10.65 1.03-4.48 2.32-9.72-2.57-12.19-9.26-4.63-12.55 6.89-12.04 14.1.15 2.06 1.29 4.84.98 6.53-.41 2.06-6.69 12.66-8.23 14.92-.46.67-2.88 3.96-3.24 3.96-1.08-.67 7.51-26.91 4.84-33.65-1.44-3.6-6.89-5.66-10.5-6.43l-11.58 7.2c1.03-10.44-9.41-10.55-15.95-5.4-5.5 4.42-7.46 13.68-2.06 18.93 1.13 1.08 3.24 1.23 2.98 3.04a79 79 0 0 1-5.35 11.16c-1.65 2.73-6.64 10.08-9 3.91-1.9-4.89 1.54-13.89 3.6-18.62.41-1.03 1.65-2.21 1.85-3.24.31-1.44-.51-4.89-.26-7 .46-4.32 3.34-7.51 6.17-10.55-17.85 4.42-29.17 27.16-27.27 44.5.67 6.38 5.4 12.55 12.04 13.17 18.42 1.65 30.35-20.37 31.74-36.27l10.5-9.05c.57.21.21 1.23.1 1.7-1.13 7.82-3.76 15.54-4.84 23.41-1.13 8.08-3.34 22.23 9.26 20.06 8.9-1.54 18.01-19.81 22.23-27.16l2.78 1.9c-2.16 8.18-1.49 20.22 7.51 23.87 12.45 5.04 21.81-3.91 30.1-11.83.51 14.2 21.2 14.92 30.51 9.16 7.82-4.89 11.01-15.23 4.99-22.84-2.88-3.6-11.99-7.87-11.83-12.3.15-3.6 5.76-8.39 9.26-9.05.62.67-5.97 8.59-1.54 13.12 1.03 1.03 8.64 5.09 9.26 4.37 0-7.2 8.49-15.02 3.81-22.12m-57.31 8.52c6.69-7.72 9.47-2.37 4.32 4.84a24 24 0 0 1-11.06 8.23 34.5 34.5 0 0 1 6.69-13.12m-72.55-.26c-6.28.87-4.17-7.2-.21-7.15 3.4.1.67 5.5.21 7.2m-74.59 15.38 24.18-51.45c8.18 2.21 21.61 6.48 20.06 17.18-2.78 16.31-15.79 39.87-13.79 56.08 1.39 11.52 14.61 19.7 25.67 16.77-5.56 15.95-19.29 13.38-30.1 4.12-21.56-18.47-6.69-46.82.77-68.42-.77.1-5.92 9.88-7.97 13.89a308 308 0 0 0-10.14 20.73c-3.09 7.05-6.17 14.25-6.84 21.97-6.84-2.42-15.33-4.63-17.13-12.71s5.56-43.37 5.56-43.37c-6.74 20.12-14.97 40.33-19.4 61.12-.62 2.73-1.29 5.5-1.18 8.33C8.31 165.55.9 162.2.07 156.49c-.77-6.17 4.48-19.4 6.69-25.72 7-20.12 15.69-39.72 22.07-60.14 8.49 2.57 20.42 5.35 21.09 15.95.77 11.37-4.63 24.08-6.17 35.29";

// "2026" — taken verbatim from the source.
const YEAR_D =
  "M282.91 112.58H266l6.71-7.43a39 39 0 0 0 1.92-2.26q.78-1 1.23-1.76.88-1.44.88-2.95 0-.83-.41-1.32a1.4 1.4 0 0 0-1.13-.49q-1.59 0-1.59 2.48v.32l.02.44h-6.44l-.03-.74q0-3.07 2.29-5.04 2.31-1.98 5.9-1.98c3.59 0 4.2.62 5.66 1.87a5.9 5.9 0 0 1 2.21 4.79q0 2.37-1.51 4.62-.76 1.12-1.98 2.35a31 31 0 0 1-2.95 2.59q1.5-.1 3.01-.13 1.52-.04 3.11-.04zm21.76-10.05q0 4.77-2.29 7.6a7.6 7.6 0 0 1-6.16 2.81q-4.18 0-6.55-2.84-2.36-2.82-2.36-7.89 0-4.78 2.36-7.57 2.37-2.8 6.39-2.8c4.02 0 4.82.95 6.33 2.84q2.28 2.84 2.28 7.85m-6.56-.04q0-5.9-2.15-5.9c-2.15 0-2.13 1.76-2.13 5.28q0 6.3 2.08 6.3 1.13 0 1.66-1.38t.53-4.31";

// "MOBILITY MONTH" letters arranged around the M. Each path is one glyph;
// rendered in source order they spiral around the centre of the brand mark.
const MOBILITY_MONTH_LETTERS: string[] = [
  "m175.5 51.87-11.38-25.3 5.85-3.92 12.67 9.06-3.6-15.14 5.85-3.92 19.09 20.13-5.88 3.94-10.73-11.76 3.41 16.67-2.35 1.58-13.86-9.66 6.81 14.39z",
  "M193.62 30.78q-3.51-4.13-3.65-8.84-.14-4.72 3.42-7.74t8.18-2.93q4.72.13 8.23 4.27 3.5 4.13 3.65 8.85.14 4.72-3.43 7.74-3.56 3.02-8.18 2.92-4.71-.13-8.22-4.27m8.06-13.59q-2.05 1.74-2.18 4-.13 2.27 1.79 4.53 1.95 2.3 4.21 2.45 2.27.16 4.32-1.58t2.18-4q.13-2.26-1.83-4.57-1.91-2.25-4.17-2.4-2.27-.16-4.32 1.57",
  "m225.71 8.41 9.4-2.62q3.49-.97 5.46-.4 1.97.58 2.66 3.04.46 1.65-.13 3.07-.59 1.43-2.1 2.41 4.85.36 5.97 4.36.79 2.81-.51 4.97-1.31 2.15-4.92 3.16l-10.14 2.82zm10.59 5.31q1.36-.38 1.83-1.16.47-.79.19-1.78-.27-.96-1.13-1.31-.85-.35-2.18.02l-3.27.91 1.31 4.7zm2.1 8.45q1.55-.44 2.07-1.32t.21-2-.61-1.47q-.41-.6-1.04-.77-.62-.18-1.99.2l-3.7 1.03 1.44 5.18z",
  "M252.06 1.83l5.99-.83 2.93 21.04-5.99.83z",
  "m264.81 0 6.04-.07.22 17.13 8.66-.11.07 4.97-14.7.18z",
  "m292.27 24.32-5.81-1.36 3.92-16.69-5.32-1.25 1.14-4.85 16.46 3.87-1.14 4.85-5.32-1.25z",
  "m301.5 27.04 7.13-19.74 5.74 2.07-7.13 19.75z",
  "m331.36 14.66-7.84 13.6 8.86 5.11-2.49 4.32-13.96-8.06 10.34-17.92z",
  // The "M O N T H" block — placed mirrored on the right arc of the M:
  "m163.41 78.7-13.13-12.36 4.6-1.59 11.6 5.39-2.46-12.36 4.62-1.6 4.95 17.46-4.74 1.64-7.8-3.6 1.65 8.42z",
  "M178.74 60.06q-4.74-1.18-7.36-4.62-2.63-3.44-1.99-7.81.65-4.37 4.74-6.32 4.1-1.96 8.83-.79 4.74 1.17 7.35 4.62 2.61 3.44 1.96 7.83-.66 4.39-4.74 6.32-4.08 1.95-8.79.77m1.07-13.61q-2.34.78-2.84 2.74-.5 1.97 1.13 4.13 1.66 2.21 4.01 2.79 2.36.59 4.7-.19 2.33-.78 2.84-2.75.51-1.96-1.16-4.18-1.63-2.16-3.98-2.74-2.36-.58-4.7.2",
  "m210.94 53.86-5.62-1.13 1.62-15.99-7.62 14.55-5.32-1.06 4.32-21.31 5.62 1.13-1.62 15.99 7.62-14.55 5.32 1.07z",
  "m231.49 47.94-5.96-.42 1.51-21.27 5.96.42z",
  "M249.69 51.66q-4.86-.59-7.91-3.6t-2.49-7.4q.56-4.4 4.34-6.84 3.79-2.45 8.65-1.86 4.85.6 7.91 3.61 3.05 3 2.49 7.42-.56 4.41-4.35 6.85-3.78 2.43-8.64 1.83m1.79-13.52q-2.27.99-2.59 2.99-.31 1.99 1.49 4.01 1.83 2.04 4.21 2.43 2.39.4 4.66-.59 2.27-.99 2.58-2.99.32-1.99-1.51-4.04-1.81-2.02-4.19-2.41t-4.65.6",
];

// ─── Component ──────────────────────────────────────────────────────────────

/** One scrolling row of WALK or RIDE text, tiled horizontally. */
const TiledText: React.FC<{
  word: string;
  scrollPx: number;
  y: number;
  faded: number;
  fill: string;
}> = ({ word, scrollPx, y, faded, fill }) => {
  const TILES = 12;
  const ADVANCE = 320; // px between tile starts at this font size
  return (
    <g transform={`translate(${scrollPx} ${y})`} opacity={faded}>
      {Array.from({ length: TILES }).map((_, i) => (
        <text
          key={i}
          x={i * ADVANCE - ADVANCE * 2}
          y={0}
          fill={fill}
          fontFamily='"Helvetica Neue", "Arial Black", Helvetica, Arial, sans-serif'
          fontWeight={900}
          fontSize={100}
          letterSpacing={6}
        >
          {word}
        </text>
      ))}
    </g>
  );
};

export const WalkRideLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const seconds = frame / fps;
  const totalSeconds = durationInFrames / fps;

  // ─── Scrolling rows ────────────────────────────────────────────────────────
  // Each row scrolls at ~80px/s. WALK moves left, RIDE moves right.
  const ROW_ADVANCE = 320; // must match TiledText ADVANCE
  const walkScroll = -((seconds * 80) % ROW_ADVANCE);
  const rideScroll = (seconds * 80) % ROW_ADVANCE;

  // ─── Opening timeline (in seconds, scaled to 0..1 against totalSeconds) ─
  // Helper to interpolate by absolute seconds.
  const at = (a: number, b: number, easing?: (n: number) => number) =>
    interpolate(seconds, [a, b], [0, 1], {
      easing,
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Row alpha fade-up (rows nearer the centre stay brighter)
  const walkRowAlpha = at(0, 1.2);
  const rideRowAlpha = at(0, 1.2);

  // Logo slide: scaleX 2 → 1 over 1.5s; translateX 150 → 0 over 2.2s
  const logoScaleX = interpolate(seconds, [0, 1.5], [2, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const logoTx = interpolate(seconds, [0, 2.2], [150, 0], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // M stroke draws via stroke-dashoffset.
  // mPt1: 0 → 0.55s. mPt2: 0.6 → 1.4s.
  const mPt1Length = 420;
  const mPt2Length = 720;
  const mPt1Draw = interpolate(seconds, [0, 0.55], [0, 1], {
    easing: Easing.bezier(0.4, 0, 0.6, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mPt2Draw = interpolate(seconds, [0.6, 1.4], [0, 1], {
    easing: Easing.bezier(0.4, 0, 0.6, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mPt1Dashoffset = mPt1Length * (1 - mPt1Draw);
  const mPt2Dashoffset = mPt2Length * (1 - mPt2Draw);

  // mPt1 stroke-width animates 6 → 20 over 0 → 0.6s.
  const mPt1Width = interpolate(seconds, [0, 0.6], [6, 20], {
    easing: Easing.bezier(0.4, 0, 0.6, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mPt2Width = 20;

  // "CHEVROLET" letters (chs): fade-in + slide-in by 15px over 0.6 → 1.0s,
  // staggered per letter at 0.04s.
  const chevroletText = "CHEVROLET";
  const chsLetters = chevroletText.split("");

  // Year fades in over 1.0 → 1.6s.
  const yearOpacity = at(1.0, 1.6);

  // mobility-month group rotates 120 → 0° around (242, 113) over 0.2 → 2.0s.
  const mmRotate = interpolate(seconds, [0.2, 2.0], [120, 0], {
    easing: Easing.bezier(0.4, 0, 0.6, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Per-letter mobility-month fade with 0.09s stagger.
  const mmLetterOpacity = (i: number) =>
    interpolate(
      seconds,
      [0.2 + i * 0.09, 0.5 + i * 0.09],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

  const chevroletLetterOpacity = (i: number) =>
    interpolate(
      seconds,
      [0.6 + i * 0.04, 1.0 + i * 0.04],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );
  const chevroletLetterX = (i: number) =>
    interpolate(
      seconds,
      [0.6 + i * 0.04, 1.6 + i * 0.04],
      [15, 0],
      {
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    );

  // Hold final composition past 2.5s — nothing further animates except the
  // scrolling rows.
  void totalSeconds;

  // ─── Layout constants ──────────────────────────────────────────────────────
  const ROWS = 12;
  const ROW_SPACING = 90; // px between rows in source y-units

  return (
    <AbsoluteFill style={{ background: BG, overflow: "hidden" }}>
      {/* ── WALK rows (top half) ─────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          top: -120,
          height: "60%",
          transform: "rotate(6deg) skewY(-11deg) scale(1.05)",
          transformOrigin: "center",
          overflow: "visible",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="-200 -100 2000 800"
          preserveAspectRatio="xMidYMax slice"
          overflow="visible"
        >
          {Array.from({ length: ROWS }).map((_, i) => {
            // Rows nearer the centre (high i) fade out: opacity = 1 - i/ROWS,
            // then multiplied by the overall row-fade-in.
            const alpha = (1 - i / ROWS) * walkRowAlpha;
            return (
              <TiledText
                key={i}
                word="WALK"
                scrollPx={walkScroll + (i % 2 === 0 ? 0 : -60)}
                y={i * ROW_SPACING + 100}
                faded={alpha}
                fill={WALK_FILL}
              />
            );
          })}
        </svg>
      </div>

      {/* ── RIDE rows (bottom half) ──────────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          top: "50%",
          height: "60%",
          transform: "rotate(6deg) skewY(-11deg) scale(1.05)",
          transformOrigin: "center",
          overflow: "visible",
        }}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="-200 -100 2000 800"
          preserveAspectRatio="xMidYMin slice"
          overflow="visible"
        >
          {Array.from({ length: ROWS }).map((_, i) => {
            // Rows nearer the centre (low i) fade out; far from centre (high i) bright.
            const alpha = ((i + 1) / ROWS) * rideRowAlpha;
            return (
              <TiledText
                key={i}
                word="RIDE"
                scrollPx={rideScroll + (i % 2 === 0 ? 0 : 60)}
                y={i * ROW_SPACING + 100}
                faded={alpha}
                fill={WALK_FILL}
              />
            );
          })}
        </svg>
      </div>

      {/* ── Brand mark (centred over both halves) ────────────────────────── */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: "90%",
          margin: "0 auto",
          aspectRatio: "360 / 230",
          maxWidth: 1600,
          zIndex: 10,
        }}
      >
        <svg
          viewBox="0 0 360 230"
          width="100%"
          height="100%"
          overflow="visible"
          style={{ overflow: "visible" }}
        >
          {/* Mask: draws the M outline as a stroke; the masked fill below
              will only show where this stroke is opaque. */}
          <defs>
            <mask id="walkride-m-mask" maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width="360" height="230" fill="black" />
              <path
                d={M_PT1_D}
                fill="none"
                stroke="white"
                strokeWidth={mPt1Width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={mPt1Length}
                strokeDashoffset={mPt1Dashoffset}
              />
              <path
                d={M_PT2_D}
                fill="none"
                stroke="white"
                strokeWidth={mPt2Width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={mPt2Length}
                strokeDashoffset={mPt2Dashoffset}
              />
            </mask>
          </defs>

          {/* Logo slide-in group: scales x and translates from the right. */}
          <g
            transform={`translate(${logoTx} 0) scale(${logoScaleX} 1)`}
            style={{ transformOrigin: "180px 115px" }}
          >
            {/* The masked Chevrolet fill — visible only inside the M stroke. */}
            <path
              d={M_FILL_D}
              fill="#fff"
              mask="url(#walkride-m-mask)"
            />

            {/* Visible M stroke (in addition to the mask, so the M itself is
                rendered, not just used as a window). */}
            <path
              d={M_PT1_D}
              fill="none"
              stroke="#fff"
              strokeWidth={mPt1Width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={mPt1Length}
              strokeDashoffset={mPt1Dashoffset}
            />
            <path
              d={M_PT2_D}
              fill="none"
              stroke="#fff"
              strokeWidth={mPt2Width}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={mPt2Length}
              strokeDashoffset={mPt2Dashoffset}
            />

            {/* "CHEVROLET" letters — fade + slide in, staggered. */}
            <g className="chs">
              {chsLetters.map((letter, i) => (
                <text
                  key={i}
                  x={250 + i * 8}
                  y={90}
                  fill="#fff"
                  fontFamily='"Helvetica Neue", "Arial Black", sans-serif'
                  fontWeight={900}
                  fontSize={11}
                  letterSpacing={0.4}
                  opacity={chevroletLetterOpacity(i)}
                  transform={`translate(${chevroletLetterX(i)} 0)`}
                >
                  {letter}
                </text>
              ))}
            </g>

            {/* Year "2026" — fade in. */}
            <path d={YEAR_D} fill="#fff" opacity={yearOpacity} />
          </g>

          {/* "MOBILITY MONTH" letters — rotate as a group, fade per letter. */}
          <g
            className="mobility-month"
            style={{
              transformOrigin: "242px 113px",
              transform: `rotate(${mmRotate}deg)`,
            }}
            fill="#fff"
          >
            {MOBILITY_MONTH_LETTERS.map((d, i) => (
              <path key={i} d={d} opacity={mmLetterOpacity(i)} />
            ))}
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  );
};
