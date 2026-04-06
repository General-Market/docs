import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  AbsoluteFill,
} from "remotion";
import { LightBg, GREEN, sceneFade, srand } from "../shared";

/* ------------------------------------------------------------------ */
/*  Scene 06 — Coin Grid                    (150 frames / 5s)         */
/*                                                                     */
/*  A grid of penny illustrations (heads + tails) with green           */
/*  checkmarks arriving in a diagonal wave, top-left to bottom-right.  */
/* ------------------------------------------------------------------ */

const COLS = 10;
const ROWS = 7;
const COIN_SIZE = 90;
const GAP_X = 110;
const GAP_Y = 110;
const CHECK_SIZE = 18;

/* ---- Penny Heads (Lincoln profile, line-art) ---- */

const PennyHeads: React.FC<{ size: number }> = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* outer rim */}
      <circle cx={50} cy={50} r={47} stroke="#999" strokeWidth={1.8} />
      <circle cx={50} cy={50} r={44} stroke="#bbb" strokeWidth={0.6} />

      {/* IN GOD WE TRUST arc */}
      <path
        id="trustArc"
        d="M 22 25 A 38 38 0 0 1 78 25"
        fill="none"
        stroke="none"
      />
      <text
        fontSize={5.5}
        fill="#999"
        fontFamily="serif"
        letterSpacing={1.5}
      >
        <textPath href="#trustArc" startOffset="50%" textAnchor="middle">
          IN GOD WE TRUST
        </textPath>
      </text>

      {/* Lincoln head — simplified profile silhouette */}
      <g stroke="#888" strokeWidth={1.2} strokeLinecap="round" fill="none">
        {/* head outline */}
        <path d="M 42 72 C 42 72 40 65 40 60 C 40 55 38 52 38 48 C 38 42 40 36 43 33 C 46 30 48 28 50 27 C 52 26 55 27 56 29 C 57 31 58 34 58 38 C 58 40 57 42 56 44" />
        {/* forehead + hair */}
        <path d="M 56 44 C 55 46 53 47 52 46 C 50 44 49 42 48 41 C 47 40 46 40 45 41 C 43 43 42 46 42 48" />
        {/* nose */}
        <path d="M 52 46 C 53 48 54 50 54 52 C 54 53 53 54 52 54" />
        {/* lips + chin */}
        <path d="M 52 54 C 51 55 50 55 49 55 C 48 55 47 56 47 58 C 47 60 48 62 48 64" />
        {/* neck + shoulder */}
        <path d="M 48 64 C 47 66 46 68 42 72" />
        <path d="M 58 38 C 60 42 60 48 60 55 C 60 60 58 65 56 72" />
        {/* collar line */}
        <path d="M 42 72 C 44 70 48 69 52 69 C 54 69 55 70 56 72" />
      </g>

      {/* LIBERTY */}
      <text
        x={24}
        y={64}
        fontSize={6}
        fill="#999"
        fontFamily="serif"
        letterSpacing={0.8}
      >
        LIBERTY
      </text>

      {/* year */}
      <text
        x={62}
        y={72}
        fontSize={6}
        fill="#999"
        fontFamily="serif"
      >
        2026
      </text>
    </svg>
);

/* ---- Penny Tails (Lincoln Memorial, line-art) ---- */

const PennyTails: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* outer rim */}
      <circle cx={50} cy={50} r={47} stroke="#999" strokeWidth={1.8} />
      <circle cx={50} cy={50} r={44} stroke="#bbb" strokeWidth={0.6} />

      {/* UNITED STATES arc */}
      <path
        id="usaArc"
        d="M 18 22 A 40 40 0 0 1 82 22"
        fill="none"
        stroke="none"
      />
      <text fontSize={4.5} fill="#999" fontFamily="serif" letterSpacing={2}>
        <textPath href="#usaArc" startOffset="50%" textAnchor="middle">
          UNITED STATES OF AMERICA
        </textPath>
      </text>

      {/* E PLURIBUS UNUM small */}
      <text
        x={50}
        y={30}
        fontSize={3.5}
        fill="#aaa"
        fontFamily="serif"
        textAnchor="middle"
        letterSpacing={0.5}
      >
        E·PLURIBUS·UNUM
      </text>

      {/* Lincoln Memorial — simplified */}
      <g stroke="#888" strokeWidth={1} strokeLinecap="round" fill="none">
        {/* roof / pediment */}
        <path d="M 32 52 L 50 42 L 68 52" />
        <line x1={32} y1={52} x2={68} y2={52} />
        {/* columns */}
        {[36, 41, 46, 50, 54, 59, 64].map((x) => (
          <line key={x} x1={x} y1={52} x2={x} y2={68} />
        ))}
        {/* base */}
        <rect x={30} y={68} width={40} height={3} rx={0.5} />
        <rect x={28} y={71} width={44} height={2} rx={0.5} />
      </g>

      {/* ONE CENT */}
      <text
        x={50}
        y={82}
        fontSize={7}
        fill="#999"
        fontFamily="serif"
        textAnchor="middle"
        fontWeight="bold"
        letterSpacing={1}
      >
        ONE CENT
      </text>
    </svg>
  );
};

/* ---- Green Checkmark ---- */

const Checkmark: React.FC<{ size: number; scale: number; opacity: number }> = ({
  size,
  scale,
  opacity,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    style={{
      position: "absolute",
      bottom: -4,
      right: -4,
      transform: `scale(${scale})`,
      opacity,
      transformOrigin: "center",
    }}
  >
    <path
      d="M4 12.5 L9.5 18 L20 6"
      stroke={GREEN}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ---- Green Plus ---- */

const PlusIcon: React.FC<{
  size: number;
  scale: number;
  opacity: number;
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}> = ({ size, scale, opacity, ...pos }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 20 20"
    fill="none"
    style={{
      position: "absolute",
      ...pos,
      transform: `scale(${scale})`,
      opacity,
      transformOrigin: "center",
    }}
  >
    <line x1={10} y1={3} x2={10} y2={17} stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
    <line x1={3} y1={10} x2={17} y2={10} stroke={GREEN} strokeWidth={3} strokeLinecap="round" />
  </svg>
);

/* ---- Main Scene ---- */

export const Scene06_CoinGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fade = sceneFade(frame, 150);

  // Grid dimensions
  const gridW = (COLS - 1) * GAP_X + COIN_SIZE;
  const gridH = (ROWS - 1) * GAP_Y + COIN_SIZE;
  const offsetX = (1920 - gridW) / 2;
  const offsetY = (1080 - gridH) / 2;

  // Build cells
  const cells: {
    col: number;
    row: number;
    isHeads: boolean;
    waveDelay: number;
  }[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const seed = row * COLS + col;
      // ~70% heads, ~30% tails — mirrors the reference
      const isHeads = srand(seed * 7 + 3) > 0.3;
      // diagonal wave: delay proportional to col + row
      const waveDelay = (col + row) * 3.5;
      cells.push({ col, row, isHeads, waveDelay });
    }
  }

  // Initial zoom: start slightly zoomed-in on center, pull out
  const zoomProgress = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    delay: 0,
    config: { damping: 30, stiffness: 60 },
  });
  const gridScale = 1.25 - 0.25 * zoomProgress;
  const gridOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <LightBg />
      <div
        style={{
          position: "absolute",
          left: offsetX,
          top: offsetY,
          width: gridW,
          height: gridH,
          transform: `scale(${gridScale})`,
          transformOrigin: "center center",
          opacity: gridOpacity,
        }}
      >
        {cells.map(({ col, row, isHeads, waveDelay }, i) => {
          const x = col * GAP_X;
          const y = row * GAP_Y;

          // Checkmark spring — starts after grid is mostly visible
          const checkFrame = 25 + waveDelay;
          const checkSpring = spring({
            frame: frame - checkFrame,
            fps,
            from: 0,
            to: 1,
            config: { damping: 10, stiffness: 180, mass: 0.6 },
          });
          const checkScale = frame >= checkFrame ? checkSpring : 0;
          const checkOpacity = frame >= checkFrame ? Math.min(checkSpring * 2, 1) : 0;

          // Plus icons — appear slightly before checkmarks
          const plusFrame = 18 + waveDelay;
          const plusSpring = spring({
            frame: frame - plusFrame,
            fps,
            from: 0,
            to: 1,
            config: { damping: 12, stiffness: 200, mass: 0.5 },
          });
          const plusScale = frame >= plusFrame ? plusSpring : 0;
          const plusOpacity = frame >= plusFrame ? Math.min(plusSpring * 2, 1) : 0;

          // Subtle coin entrance stagger
          const coinDelay = (col + row) * 1.2;
          const coinSpring = spring({
            frame: frame - coinDelay,
            fps,
            from: 0,
            to: 1,
            config: { damping: 18, stiffness: 140 },
          });
          const coinScale = frame >= coinDelay ? coinSpring : 0;

          // Deterministic plus placement — only ~40% of coins get a plus
          const hasPlus = srand(i * 13 + 7) > 0.6;
          const plusOnTop = srand(i * 19 + 11) > 0.5;

          return (
            <div
              key={`${col}-${row}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: COIN_SIZE,
                height: COIN_SIZE,
                transform: `scale(${coinScale})`,
                transformOrigin: "center",
              }}
            >
              {isHeads ? (
                <PennyHeads size={COIN_SIZE} />
              ) : (
                <PennyTails size={COIN_SIZE} />
              )}

              {/* Green checkmark — bottom-right */}
              <Checkmark
                size={CHECK_SIZE}
                scale={checkScale}
                opacity={checkOpacity}
              />

              {/* Green plus — top-right or bottom-left */}
              {hasPlus && (
                <PlusIcon
                  size={14}
                  scale={plusScale}
                  opacity={plusOpacity}
                  {...(plusOnTop
                    ? { top: -6, right: -6 }
                    : { bottom: -6, left: -6 })}
                />
              )}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
