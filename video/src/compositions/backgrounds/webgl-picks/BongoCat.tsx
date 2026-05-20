// The source was a bongo cat. ScrollTrigger was never the heart of this one —
// GSAP loops were. The frame clock now keeps the cadence.

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

const BG = "#1a1e2d";
const GREEN = "#a5ea9b";
const PINK = "#ff61d8";
const BLUE = "#569cfa";
const ORANGE = "#ffcc81";
const CYAN = "#7ed1e2";

const NOTE_COLORS = [GREEN, PINK, BLUE, ORANGE, CYAN];

// Common stroke props for all shapes
const S = {
  fill: BG,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 4,
};

const TERMINAL_LINES: ReadonlyArray<[number, number, number, number]> = [
  [260.2, 92.3, 212.2, 88.7],
  [197.3, 87.5, 145.2, 83.5],
  [251, 104.2, 223.4, 101.8],
  [209.4, 100.5, 154.4, 95.6],
  [256.4, 117.9, 227.5, 114.7],
  [215.9, 113.4, 183.5, 109.8],
  [169.1, 108.2, 142.9, 105.3],
  [275.4, 132.8, 249.4, 129.6],
  [234.4, 127.8, 197.3, 123.3],
  [185.6, 121.9, 149.1, 117.5],
  [261, 144.6, 244.5, 142.5],
  [235.5, 141.3, 214.9, 138.7],
  [203.4, 137.2, 180.4, 134.3],
  [169.3, 132.9, 155.1, 131.1],
  [264.7, 158.3, 221.9, 152.1],
  [208.2, 150.1, 191.7, 147.7],
  [291.3, 174.3, 268.8, 170.9],
  [257.8, 169.2, 226.5, 164.4],
  [217.3, 163, 185, 158.1],
  [173.8, 156.4, 152.9, 153.2],
  [278.5, 185.6, 257.3, 182.2],
  [243.8, 179.9, 230.3, 177.7],
  [216.5, 175.8, 196.7, 172.5],
  // The last three lines in the source have x1/y1 and x2/y2 written backwards.
  // Swap them so the dashoffset math draws in the same direction as the rest.
  [262.1, 196.1, 280.5, 199.2],
  [213.8, 187.9, 251.1, 194.2],
  [180.8, 182.3, 202.7, 186],
];

// Approximate centroid of each music note for transform pivot
const NOTE_CENTERS_RIGHT: ReadonlyArray<[number, number]> = [
  [365, 70],
  [362, 70],
  [372, 60],
  [368, 58],
];

const NOTE_CENTERS_LEFT: ReadonlyArray<[number, number]> = [
  [629, 150],
  [625, 140],
  [630, 135],
  [628, 140],
];

const NOTE_CYCLE = 2.0; // seconds
const NOTE_STAGGER = 0.5; // seconds per note within the group of 4

type NoteTransform = {
  alpha: number;
  scale: number;
  dx: number;
  dy: number;
  rot: number;
  color: string;
};

function computeNote(
  noteId: number,
  side: "L" | "R",
  frameSec: number,
): NoteTransform {
  const offset = noteId * NOTE_STAGGER + (side === "L" ? 0.25 : 0);
  const tRaw = frameSec - offset;
  const cycleNumber = Math.floor(tRaw / NOTE_CYCLE);
  const t = ((tRaw % NOTE_CYCLE) + NOTE_CYCLE) % NOTE_CYCLE;
  const p = t / NOTE_CYCLE; // 0..1

  // Deterministic seed for this (note, cycle) pair
  const seed = noteId * 7 + cycleNumber * 11 + (side === "L" ? 3 : 0);
  const colorIdx = ((seed % NOTE_COLORS.length) + NOTE_COLORS.length) %
    NOTE_COLORS.length;
  const color = NOTE_COLORS[colorIdx];

  // Direction of drift alternates with cycle and note id
  const signX = ((seed >> 1) & 1) === 0 ? 1 : -1;
  const signR = (seed & 1) === 0 ? 1 : -1;

  // Magnitude varies slightly per seed: 40..60 for x, 20..30 for rotation
  const magX = 40 + ((seed * 13) % 20);
  const magR = 20 + ((seed * 17) % 10);

  // Alpha curve: 0 → 1 around p=0.3, back to 0 at p=1
  const alpha = p < 0.3
    ? p / 0.3
    : Math.max(0, 1 - (p - 0.3) / 0.7);

  const scale = p; // 0 → 1 linear
  const dx = signX * magX * p;
  const dy = -210 * p;
  const rot = signR * magR * p;

  return { alpha, scale, dx, dy, rot, color };
}

export const BongoCat: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sec = frame / fps;

  // ── Paw alternation ──────────────────────────────────────────────────────
  // pawT cycles through 0..0.38 every (0.38 / 1.6) seconds.
  const pawT = (sec * 1.6) % 0.38;
  const phaseA = pawT < 0.19;

  const leftUpOpacity = phaseA ? 1 : 0;
  const leftDownOpacity = phaseA ? 0 : 1;
  const rightUpOpacity = phaseA ? 0 : 1;
  const rightDownOpacity = phaseA ? 1 : 0;

  // ── Terminal code line draw ──────────────────────────────────────────────
  const TERMINAL_CYCLE = TERMINAL_LINES.length * 0.1; // 2.6s
  const lineProgress = (i: number): number => {
    const offset = i * 0.1;
    const t = (((sec - offset) % TERMINAL_CYCLE) + TERMINAL_CYCLE) %
      TERMINAL_CYCLE;
    return Math.max(0, Math.min(1, t / 0.1));
  };

  // ── Note transforms (4 right, 4 left) ────────────────────────────────────
  const noteR = NOTE_CENTERS_RIGHT.map((_, i) => computeNote(i, "R", sec));
  const noteL = NOTE_CENTERS_LEFT.map((_, i) => computeNote(i, "L", sec));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <svg
        viewBox="0 0 783.55 354.91"
        style={{ width: "80%", height: "auto" }}
      >
        <g id="bongo-cat">
          {/* ── Head + face + right headphone ─────────────────────────── */}
          <g className="head">
            <path
              {...S}
              stroke={ORANGE}
              d="M280.4,221l383.8,62.6a171.4,171.4,0,0,0-9.2-40.5,174,174,0,0,0-28.7-50.5,163.3,163.3,0,0,0,3.2-73.8c-11.6-1.9-42,14.2-44.5,17.5-19.6-24-88.5-52.7-153.7-48.1A78.8,78.8,0,0,0,398,67.1c-9.8,2.9-19,29.7-19.4,33.7a320,320,0,0,0-31.7,23.6c-14,11.8-28.9,24.4-42.5,44.3A173,173,0,0,0,280.4,221Z"
            />
            <path
              {...S}
              stroke={ORANGE}
              d="M396.6,178.6c.4.9,2.7,6.5,8.5,8.4s13.4-1.2,17.2-7.9c-.9,7.5,3.8,14.3,10.4,16a14.4,14.4,0,0,0,15-5.7"
            />
            <path
              {...S}
              stroke={ORANGE}
              d="M474,179.2a6.6,6.6,0,0,0-4.9,3.6,6,6,0,0,0,1.5,7.3,6,6,0,0,0,7.9-1c2.3-2.6,2-7,.2-8s-5.9,1.6-5.7,3.5,1.9,2.8,3.2,2.3,1.1-2.2,1.1-2.3"
            />
            <path
              {...S}
              stroke={ORANGE}
              d="M365.4,168.9c0,.3-.8,3.6,1.5,6a5.9,5.9,0,0,0,7.2,1.4,6.1,6.1,0,0,0,2.2-7.7c-1.5-3.1-5.7-4.5-7.3-3.2s-.8,6,1,6.6,3.3-.7,3.3-2.1-1.5-1.8-1.6-1.9"
            />
            <g className="headphone headphone-right">
              <g className="speaker">
                {/* nth-child(1) → cyan */}
                <path
                  {...S}
                  stroke={CYAN}
                  d="M400.7,80.2c-14.1-20.8-40.2.3-50.7,15-8.7,12.2-9.7,30.3,2.8,37.3,5.4-9,11.8-15.6,21-26.2A214.1,214.1,0,0,1,400.7,80.2Z"
                />
                {/* nth-child(2) → blue */}
                <path
                  {...S}
                  stroke={BLUE}
                  d="M381.5,79.4c-6.6-7.5-9.6-5.8-12.3-5.5-16.3,1.3-32,20.3-27.8,33.9a21.8,21.8,0,0,0,5.9,8.5c1.7-2.6,3.5-5.1,5.4-7.7A150.7,150.7,0,0,1,381.5,79.4Z"
                />
                {/* nth-child(3) → green */}
                <path
                  {...S}
                  stroke={GREEN}
                  d="M367.3,77.8a13.1,13.1,0,0,0-5.1-1.8c-8.5-.9-18.7,7.5-18.4,16.1a12.8,12.8,0,0,0,2.6,7c3.1-3.3,6.3-6.8,9.6-10.2S363.6,81.3,367.3,77.8Z"
                />
              </g>
              <path
                className="band"
                fill="none"
                stroke={GREEN}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M515,40.6c-15.9-4.6-57-14.1-104,2.3a166.9,166.9,0,0,0-60.9,37.3"
              />
            </g>
          </g>

          {/* ── Music notes — right side ──────────────────────────────── */}
          <g className="music music-right">
            {[0, 1, 2, 3].map((i) => {
              const n = noteR[i];
              const [cx, cy] = NOTE_CENTERS_RIGHT[i];
              const transform =
                `translate(${cx + n.dx} ${cy + n.dy}) ` +
                `rotate(${n.rot}) scale(${n.scale}) ` +
                `translate(${-cx} ${-cy})`;
              const stroke = n.color;
              const noteProps = {
                fill: BG,
                stroke,
                strokeWidth: 4,
                strokeLinecap: "round" as const,
                strokeLinejoin: "round" as const,
              };
              return (
                <g
                  key={i}
                  className="note"
                  transform={transform}
                  opacity={n.alpha}
                >
                  {i === 0 && (
                    <g>
                      <path
                        {...noteProps}
                        d="M368.5,46.5c.5,2.1,1.2,3.5,3.8,6.3s5.1,4.3,6.5,7.2a11.1,11.1,0,0,1,.7,2,10.5,10.5,0,0,1-.7,6.5"
                      />
                      <path
                        {...noteProps}
                        d="M368.5,46.5a20.8,20.8,0,0,0,2.4,11.7c2.3,4.4,5,5.4,6.8,9.5a17.5,17.5,0,0,1,.4,11"
                      />
                      <line
                        {...noteProps}
                        x1={368.5}
                        y1={47.7}
                        x2={368.5}
                        y2={92.8}
                      />
                      <path
                        {...noteProps}
                        d="M368.5,92.8c.1-3.1-4.7-6.3-9-6.3s-8.7,2.7-8.7,5.8,4.8,5.7,8.7,5.8S368.3,95.8,368.5,92.8Z"
                      />
                    </g>
                  )}
                  {i === 1 && (
                    <g>
                      <polyline
                        {...noteProps}
                        points="350 81.7 350 43.5 382.7 50.7 382.7 89.5"
                      />
                      <path
                        {...noteProps}
                        d="M350,82.3c0-3.1-4.5-5.7-8.2-5.9s-9.3,2.8-9.2,6,4.7,5.7,8.6,5.7S349.9,85.5,350,82.3Z"
                      />
                      <path
                        {...noteProps}
                        d="M382.7,89.9c0-3.1-4.4-5.7-8.2-5.8s-9.3,2.7-9.2,5.9,4.7,5.7,8.7,5.7S382.7,93.1,382.7,89.9Z"
                      />
                    </g>
                  )}
                  {i === 2 && (
                    <>
                      <polyline
                        {...noteProps}
                        points="388.2 73.6 388.2 34.6 354.9 42.6 354.9 82.4"
                      />
                      <path
                        {...noteProps}
                        d="M388.2,74.1c0-3-4.4-5.6-8.1-5.8s-9.2,2.8-9.1,6,4.6,5.6,8.6,5.6S388.2,77.3,388.2,74.1Z"
                      />
                      <path
                        {...noteProps}
                        d="M354.9,81.9c0-3.1-4.4-5.7-8.2-5.9s-9.3,2.8-9.2,6,4.7,5.7,8.7,5.7S354.9,85.1,354.9,81.9Z"
                      />
                      <line
                        {...noteProps}
                        x1={354.9}
                        y1={48.4}
                        x2={388.2}
                        y2={40.3}
                      />
                      <line
                        {...noteProps}
                        x1={354.9}
                        y1={54.6}
                        x2={388.2}
                        y2={47}
                      />
                    </>
                  )}
                  {i === 3 && (
                    <g>
                      <path
                        {...noteProps}
                        d="M371.8,79.5c0-3.1-4.5-5.8-8.3-5.9s-9.3,2.8-9.2,6,4.7,5.7,8.7,5.7S371.8,82.7,371.8,79.5Z"
                      />
                      <line
                        {...noteProps}
                        x1={371.8}
                        y1={79.5}
                        x2={371.8}
                        y2={33.3}
                      />
                      <path
                        {...noteProps}
                        d="M371.8,33.4a26.6,26.6,0,0,0,3.6,7.8c3.7,5.7,7.6,7,8.8,11.6.5,1.7.7,4.4-.9,8.3"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* ── Table ─────────────────────────────────────────────────── */}
          <g className="table">
            <polygon
              {...S}
              stroke={GREEN}
              points="25.3 158.5 783.2 293 513 354.9 25.3 158.5"
            />
            <line
              x1={25.3}
              y1={158.5}
              x2={783.2}
              y2={293}
              fill="none"
              stroke={GREEN}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {/* ── Laptop base ───────────────────────────────────────────── */}
          <polygon
            {...S}
            stroke={PINK}
            className="laptop-base"
            points="103.2 263.6 258.9 219.3 636.5 294.4 452.1 339 103.2 263.6"
          />

          {/* ── Laptop keyboard ───────────────────────────────────────── */}
          <g className="laptop-keyboard">
            {[
              "369.6 265.6 255.3 244.3 255.5 243.5 264.7 241.9 380.9 262.3 380.8 263.1 369.6 265.6",
              "235.9 256.4 219.8 253.2 219.9 252.5 228.7 251 245.3 253.4 245.1 254.2 235.9 256.4",
              "473.1 303.7 248.4 258.9 248.6 258.1 257.7 256.6 486.2 300.4 486 301.3 473.1 303.7",
              "410.3 300.2 202.7 257.5 202.9 256.8 211.4 255.3 422.4 297.1 422.2 298 410.3 300.2",
              "448.5 308.1 427 303.7 427.3 302.8 439.2 301.4 461.2 304.9 461 305.8 448.5 308.1",
              "200.1 264.7 186 261.7 186.2 261 194.5 259.5 208.9 261.8 208.8 262.5 200.1 264.7",
              "221.1 269.1 206.6 266.1 206.8 265.3 215.4 263.9 230.3 266.2 230.1 267 221.1 269.1",
              "361.4 298.9 230 271 230.2 270.3 239.2 268.9 372.7 295.9 372.5 296.7 361.4 298.9",
              "442.8 279.2 383.7 268.2 383.9 267.3 395.1 265.7 455.4 275.9 455.2 276.7 442.8 279.2",
              "524.6 294.4 458.6 282.1 458.8 281.2 471.3 279.7 538.6 291 538.4 291.9 524.6 294.4",
              "424.7 312.4 374.6 301.7 374.8 300.9 385.9 299.5 437 309.3 436.8 310.2 424.7 312.4",
              "409.1 277.3 397.6 278.8 397.4 279.6 498.4 299.1 511.8 296.7 512 295.8 409.1 277.3",
              "394.2 274.5 394.4 273.6 246.7 246.5 237.7 248.1 237.5 248.8 382.8 276.8 394.2 274.5",
            ].map((points, i) => (
              <polygon
                key={i}
                fill={BG}
                stroke={BLUE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
            ))}
          </g>

          {/* ── Right paw (sits in front of keyboard) ────────────────── */}
          <g className="paw paw-right">
            <path
              {...S}
              stroke={ORANGE}
              className="down"
              opacity={rightDownOpacity}
              d="M289.1,181.7c-12.1,9.8-20.6,20.7-20.7,32.1-.2,9,3.8,20.4,13.3,25.2s20.1.6,29.6-3.4c13.4-5.7,23.9-14.6,29.4-21.5"
            />
            <g className="up" opacity={rightUpOpacity}>
              <path
                {...S}
                stroke={ORANGE}
                d="M327.3,170c-.4-1.4-6.3-18.8-23.5-23.5-.8-.2-18.6-4.7-28.9,6.3-8.4,9.1-6,22.5-4.6,30.2a54.3,54.3,0,0,0,8.1,19.9"
              />
              <g className="pads">
                <path
                  {...S}
                  stroke={PINK}
                  d="M297.2,154.8c1-.5,2.7-.1,3,.6s-1.4,2.4-2.6,2.1a1.6,1.6,0,0,1-1.1-1.2A1.6,1.6,0,0,1,297.2,154.8Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M285.8,159.4c.3-.4,1-1.1,1.7-.8s.9,1.4.8,2.2-1.8,2.1-2.5,1.5S285.2,160.4,285.8,159.4Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M276.9,171c.5-.4,2.7-.3,3.2.6s-.6,1.8-1.4,1.8S276.2,171.6,276.9,171Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M296.4,168.6c2.3-.9,6.4,6.3,7.6,9s-5.2,4.5-7.4,6-5.1-6.1-5.9-8.3S293.7,169.8,296.4,168.6Z"
                />
              </g>
            </g>
          </g>

          {/* ── Terminal frame + animated code ───────────────────────── */}
          <polygon
            {...S}
            stroke={BLUE}
            className="terminal-frame"
            points="93.8 63.3 284.1 73 335.9 230.5 146.2 197.6 93.8 63.3"
          />
          <g className="terminal-code">
            {TERMINAL_LINES.map(([x1, y1, x2, y2], i) => {
              const p = lineProgress(i);
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  fill={BG}
                  stroke={CYAN}
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={60}
                  strokeDashoffset={60 * (1 - p)}
                />
              );
            })}
          </g>

          {/* ── Laptop cover (sits over terminal in the source order) ─ */}
          <polygon
            fill="none"
            stroke={PINK}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="laptop-cover"
            points="103.2 263.6 452.1 339 360.8 12.4 2 2 103.2 263.6"
          />

          {/* ── Left paw ─────────────────────────────────────────────── */}
          <g className="paw paw-left">
            <g className="up" opacity={leftUpOpacity}>
              <path
                {...S}
                stroke={ORANGE}
                d="M586.6,208.8c-.6-2.3-4.2-15.6-17.2-22.2-2.7-1.3-12.8-6.4-23.6-1.8s-14.6,16.5-14.8,18.4c-1.2,9-.7,18.4,2.4,26.1,2.4,6,7.5,17.2,9.7,20.2"
              />
              <g className="pads">
                <path
                  {...S}
                  stroke={PINK}
                  d="M561.4,194.9a2.7,2.7,0,0,1,3,.5c.4,1-1.4,2.4-2.6,2.2a1.5,1.5,0,0,1-1.1-1.3A1.2,1.2,0,0,1,561.4,194.9Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M550.7,200.4c.4-.5,1.1-1.1,1.7-.8a2,2,0,0,1,.8,2.2c-.3,1.2-1.8,2-2.5,1.5S550.1,201.3,550.7,200.4Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M541.1,211.1c.5-.4,2.7-.4,3.2.5s-.6,1.8-1.5,1.9S540.4,211.6,541.1,211.1Z"
                />
                <path
                  {...S}
                  stroke={PINK}
                  d="M560.6,209.2c2.3-.9,6.4,6.3,7.6,9s-5.3,4.5-7.4,6-5.1-6-5.9-8.3S557.9,210.4,560.6,209.2Z"
                />
              </g>
            </g>
            <path
              {...S}
              stroke={ORANGE}
              className="down"
              opacity={leftDownOpacity}
              d="M534.1,231.4c-19.7,6-32.9,18.4-34.2,29.1a30.1,30.1,0,0,0,1.7,14.1,24.8,24.8,0,0,0,6.1,8.8c6,5.1,16.8,4,38-3.9a288.7,288.7,0,0,0,46.5-22.1"
            />
          </g>

          {/* ── Left headphone ───────────────────────────────────────── */}
          <g className="headphone headphone-left">
            <g className="speaker">
              {/* nth-child(1) → cyan */}
              <path
                {...S}
                stroke={CYAN}
                d="M609.5,137.3c-17.1,6.3-20.7,51.4-4.5,67.3,1.4,1.5,5.5,5.5,11.3,5.9,8.2.5,14.5-6.3,16.9-8.9,10.1-11,11.5-27.5,8.1-40.1-1.4-4.8-3.9-14-12.7-19.9C627.4,140.8,617.7,134.3,609.5,137.3Z"
              />
              {/* nth-child(2) → blue */}
              <path
                {...S}
                stroke={BLUE}
                d="M626.5,196.1c2.7-.4,5.9-2.6,9.3-6,6.6-6.6,6.8-16.6,5.8-24s-4.2-16.1-11.3-19.7a18.7,18.7,0,0,0-10.9-1.9C614,149.3,615.3,192.6,626.5,196.1Z"
              />
              {/* nth-child(3) → green */}
              <path
                {...S}
                stroke={GREEN}
                d="M631.6,151c-4.5,3.3-.5,27.1,3.8,28.2s6.9-6.6,6.2-13.1S637.4,153.5,631.6,151Z"
              />
            </g>
            <path
              className="band"
              fill="none"
              stroke={GREEN}
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M638.9,157.7c-4-16.8-25.9-61.9-75.3-95.3A155.5,155.5,0,0,0,515,40.6"
            />
          </g>

          {/* ── Music notes — left side ──────────────────────────────── */}
          <g className="music music-left">
            {[0, 1, 2, 3].map((i) => {
              const n = noteL[i];
              const [cx, cy] = NOTE_CENTERS_LEFT[i];
              const transform =
                `translate(${cx + n.dx} ${cy + n.dy}) ` +
                `rotate(${n.rot}) scale(${n.scale}) ` +
                `translate(${-cx} ${-cy})`;
              const stroke = n.color;
              const noteProps = {
                fill: BG,
                stroke,
                strokeWidth: 4,
                strokeLinecap: "round" as const,
                strokeLinejoin: "round" as const,
              };
              return (
                <g
                  key={i}
                  className="note"
                  transform={transform}
                  opacity={n.alpha}
                >
                  {i === 0 && (
                    <g>
                      <path
                        {...noteProps}
                        d="M633.3,119.9c.6,2,1.3,3.5,3.8,6.3s5.2,4.3,6.5,7.2a6.9,6.9,0,0,1,.7,1.9,10.2,10.2,0,0,1-.7,6.6"
                      />
                      <path
                        {...noteProps}
                        d="M633.3,119.9a23,23,0,0,0,2.4,11.7c2.4,4.3,5.1,5.4,6.8,9.5a16.9,16.9,0,0,1,.5,11"
                      />
                      <line
                        {...noteProps}
                        x1={633.3}
                        y1={121.1}
                        x2={633.3}
                        y2={166.2}
                      />
                      <path
                        {...noteProps}
                        d="M633.3,166.2c.2-3.2-4.6-6.3-8.9-6.3s-8.7,2.6-8.7,5.7,4.7,5.7,8.7,5.8S633.1,169.2,633.3,166.2Z"
                      />
                    </g>
                  )}
                  {i === 1 && (
                    <g>
                      <polyline
                        {...noteProps}
                        points="614.8 155 614.8 116.8 647.5 124 647.5 162.9"
                      />
                      <path
                        {...noteProps}
                        d="M614.8,155.7c0-3.1-4.4-5.7-8.2-5.9s-9.2,2.8-9.2,6,4.7,5.6,8.7,5.6S614.8,158.8,614.8,155.7Z"
                      />
                      <path
                        {...noteProps}
                        d="M647.5,163.3c.1-3.1-4.4-5.7-8.2-5.9s-9.2,2.8-9.1,6,4.7,5.7,8.6,5.7S647.5,166.5,647.5,163.3Z"
                      />
                    </g>
                  )}
                  {i === 2 && (
                    <>
                      <polyline
                        {...noteProps}
                        points="646.5 148.5 646.5 109.4 613.2 117.4 613.2 157.2"
                      />
                      <path
                        {...noteProps}
                        d="M646.5,149c0-3.1-4.4-5.7-8.1-5.8s-9.2,2.7-9.1,5.9,4.7,5.6,8.6,5.6S646.5,152.1,646.5,149Z"
                      />
                      <path
                        {...noteProps}
                        d="M613.2,156.7c.1-3.1-4.4-5.7-8.2-5.8s-9.3,2.7-9.2,6,4.7,5.6,8.7,5.6S613.2,159.9,613.2,156.7Z"
                      />
                      <line
                        {...noteProps}
                        x1={613.2}
                        y1={123.2}
                        x2={646.5}
                        y2={115.1}
                      />
                      <line
                        {...noteProps}
                        x1={613.2}
                        y1={129.4}
                        x2={646.5}
                        y2={121.8}
                      />
                    </>
                  )}
                  {i === 3 && (
                    <g>
                      <path
                        {...noteProps}
                        d="M636.6,152.9c0-3.2-4.4-5.8-8.2-5.9s-9.3,2.8-9.3,6,4.8,5.7,8.7,5.7S636.6,156.1,636.6,152.9Z"
                      />
                      <line
                        {...noteProps}
                        x1={636.6}
                        y1={152.9}
                        x2={636.6}
                        y2={106.6}
                      />
                      <path
                        {...noteProps}
                        d="M636.6,106.8a33.2,33.2,0,0,0,3.6,7.8c3.8,5.7,7.6,6.9,8.9,11.5a13.3,13.3,0,0,1-.9,8.4"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
