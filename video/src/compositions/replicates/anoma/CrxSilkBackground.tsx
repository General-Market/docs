import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, interpolate } from "remotion";
import {
  SILK_KX,
  SILK_KY,
  SILK_MKX,
  SILK_MKY,
  SILK_COLS,
  SILK_ROWS,
  SILK_KEYFRAMES,
  SILK_COEFS,
  SILK_MODE_COEFS,
  SILK_DITHER,
  SILK_PHASE_T,
  SILK_PHASE_X,
  SILK_PHASE_Y,
} from "../ethena/silkField";
import { PHASE_CORR_T, PHASE_CORR_X, PHASE_CORR_Y } from "../ethena/silkPhaseCorr";

// ═══════════════════════════════════════════════════════════════
// CRX silk background — the Ethena × Anchorage halftone-dash silk
// field, borrowed whole and re-dressed for the CRX-Anoma cut:
//
//   • recolored. The reference paper is near-white; here it is the CRX
//     water — a top-to-foot teal→sage wash sampled from the bridge.xyz
//     hero, held out of pure white. Dots re-inked deep teal so the
//     weave reads as shadow in the cloth.
//   • re-resolved. The DCT field is re-evaluated at the composition's
//     own pixel lattice, crisp at output resolution, any width/height,
//     no 720p raster upscaled. The reference softening blur is dropped.
//   • made to flow. The reference cloth barely stirs over its 290
//     frames; stretched across a 969-frame cut it looks frozen. Two
//     independent motions fix that: the keyframe darkness morph is
//     ping-ponged so it never lands on its last frame, and the whole
//     field is scrolled by a continuous offset baked into the DCT
//     sample position. The DCT-III reconstruction is even-periodic
//     with period 2N, so a linear scroll traces the cloth forward,
//     reflects at the boundary and returns — a seamless tide-drift with
//     smooth turnarounds, for free. The two rates beat against each
//     other so the surface never repeats to the eye.
//
// The math is the reference's: 2D-DCT darkness + within-cell mode
// (sharp-dot ↔ soft-streak) fields, a frozen dither residual, the
// measured lattice phase-drift. Only the lattice, colours and motion
// change.
// ═══════════════════════════════════════════════════════════════

const SILK_LAST = SILK_KEYFRAMES[SILK_KEYFRAMES.length - 1]; // 289
const CUT_LAST = 968; // CRX-Anoma DURATION - 1

// Motion. Scroll is measured in field cells; the DCT reflects every N
// cells, so N cells of travel is one there-and-back. ~3.5 horizontal
// reflections and ~2 vertical over the cut give a live, unhurried swell.
const SCROLL_X = (SILK_COLS * 3.5) / CUT_LAST;
const SCROLL_Y = (SILK_ROWS * 2.0) / CUT_LAST;
// The darkness morph ping-pongs ~1.5 round trips across the cut.
const MORPH_TRIPS = 1.5;

// Vertical teal→sage wash, sampled from the wave (12-band vertical mean
// of bridge-wave.mp4 @2s), compressed to hold out of white.
const WASH_STOPS: Array<[number, string]> = [
  [0.0, "#46bfa8"],
  [0.12, "#37b795"],
  [0.34, "#6bb79c"],
  [0.58, "#8bbcac"],
  [0.8, "#a6ccbe"],
  [1.0, "#bcd9cd"],
];

const DOT_RGB: [number, number, number] = [30, 68, 58];

// ---------------------------------------------------------- reference constants
const REF_PITCH = 9;
const DOT_T = 0.05;
const MU_SHARP = 0.22;
const MU_SOFT = 0.06;
const DOT_H = 4.0;
const DOT_W = 2.8;
const CXY = 4.3;
const SOFT_SX = 1.9;
const ALPHA_G = 1.3;
const ALPHA_B = -0.017;
const N_SPRITES = 6;

// A triangle wave in [0, span], smooth-cornered enough for cloth: t is
// unbounded, folds at every `span`.
const pingpong = (t: number, span: number): number => {
  const m = ((t % (2 * span)) + 2 * span) % (2 * span);
  return m <= span ? m : 2 * span - m;
};

// DCT-III basis evaluated at `samples` points across the N-wide domain,
// shifted by `offset` cells. samples===N, offset===0 reproduces the
// reference exactly; a growing offset scrolls the reconstruction.
const basisAt = (
  K: number,
  N: number,
  samples: number,
  offset: number,
): Float64Array[] => {
  const t: Float64Array[] = [];
  for (let k = 0; k < K; k++) {
    const a = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    const row = new Float64Array(samples);
    for (let s = 0; s < samples; s++) {
      const x = (s * N) / samples + offset;
      row[s] = a * Math.cos((Math.PI * (2 * x + 1) * k) / (2 * N));
    }
    t.push(row);
  }
  return t;
};

const idct2 = (
  coefs: Float64Array,
  kxN: number,
  kyN: number,
  cosX: Float64Array[],
  cosY: Float64Array[],
  nCols: number,
  nRows: number,
): Float32Array => {
  const A = new Float64Array(kyN * nCols);
  for (let ky = 0; ky < kyN; ky++) {
    for (let i = 0; i < nCols; i++) {
      let s = 0;
      for (let kx = 0; kx < kxN; kx++) s += coefs[ky * kxN + kx] * cosX[kx][i];
      A[ky * nCols + i] = s;
    }
  }
  const field = new Float32Array(nRows * nCols);
  for (let j = 0; j < nRows; j++) {
    for (let i = 0; i < nCols; i++) {
      let s = 0;
      for (let ky = 0; ky < kyN; ky++) s += A[ky * nCols + i] * cosY[ky][j];
      field[j * nCols + i] = s;
    }
  }
  return field;
};

const lerpCoefs = (
  table: number[][],
  frame: number,
  kxN: number,
  kyN: number,
): Float64Array => {
  const last = SILK_KEYFRAMES.length - 1;
  let k1 = 0;
  while (k1 < last && SILK_KEYFRAMES[k1 + 1] <= frame) k1++;
  const k2 = Math.min(k1 + 1, last);
  const f1 = SILK_KEYFRAMES[k1];
  const f2 = SILK_KEYFRAMES[k2];
  const mix = f2 > f1 ? Math.min(1, Math.max(0, (frame - f1) / (f2 - f1))) : 0;
  const c1 = table[k1];
  const c2 = table[k2];
  const nc = kxN * kyN;
  const c = new Float64Array(nc);
  for (let i = 0; i < nc; i++) c[i] = c1[i] * (1 - mix) + c2[i] * mix;
  return c;
};

// Sprite alpha maps, geometry scaled to the render pitch so the dot keeps
// its reference proportion at any resolution.
const buildSpriteMaps = (pitch: number): Float32Array[] => {
  const S = pitch / REF_PITCH;
  const P = Math.max(3, Math.round(pitch));
  const dotH = DOT_H * S;
  const dotW = DOT_W * S;
  const cxy = CXY * S;
  const softSx = SOFT_SX * S;
  const maps: Float32Array[] = [];
  for (let k = 0; k < N_SPRITES; k++) {
    const f = k / (N_SPRITES - 1);
    const hgt = dotH + (P - dotH) * (1 - f);
    const blur = softSx * (1 - f);
    let tile = new Float32Array(P * P);
    const y0 = cxy - hgt / 2;
    const y1 = cxy + hgt / 2;
    const x0 = cxy - dotW / 2;
    const x1 = cxy + dotW / 2;
    for (let y = 0; y < P; y++) {
      const fy = Math.min(1, Math.max(0, Math.min(y + 1, y1) - Math.max(y, y0)));
      for (let x = 0; x < P; x++) {
        const fx = Math.min(1, Math.max(0, Math.min(x + 1, x1) - Math.max(x, x0)));
        tile[y * P + x] = fy * fx;
      }
    }
    if (blur > 0.15) {
      const rad = Math.ceil(blur * 3);
      const kern: number[] = [];
      let ks = 0;
      for (let t = -rad; t <= rad; t++) {
        const v = Math.exp(-(t * t) / (2 * blur * blur));
        kern.push(v);
        ks += v;
      }
      for (let t = 0; t < kern.length; t++) kern[t] /= ks;
      const pass = (src: Float32Array, horiz: boolean) => {
        const out = new Float32Array(P * P);
        for (let y = 0; y < P; y++) {
          for (let x = 0; x < P; x++) {
            let s = 0;
            for (let t = -rad; t <= rad; t++) {
              const xx = horiz ? x + t : x;
              const yy = horiz ? y : y + t;
              if (xx < 0 || xx >= P || yy < 0 || yy >= P) continue;
              s += src[yy * P + xx] * kern[t + rad];
            }
            out[y * P + x] = s;
          }
        }
        return out;
      };
      tile = pass(pass(tile, true), false);
    }
    let mx = 0;
    for (let i = 0; i < tile.length; i++) mx = Math.max(mx, tile[i]);
    for (let i = 0; i < tile.length; i++) tile[i] /= mx;
    maps.push(tile);
  }
  return maps;
};

const phaseAt = (frame: number, arr: number[], ts: number[]): number => {
  if (frame <= ts[0]) return arr[0];
  if (frame >= ts[ts.length - 1]) return arr[arr.length - 1];
  let i = 0;
  while (i < ts.length - 2 && ts[i + 1] <= frame) i++;
  const f = (frame - ts[i]) / (ts[i + 1] - ts[i]);
  return arr[i] * (1 - f) + arr[i + 1] * f;
};

type Static = {
  pitch: number;
  nCols: number;
  nRows: number;
  sprites: HTMLCanvasElement[];
};

// The lattice + sprite canvases depend only on output size — build once.
// The DCT basis now depends on the per-frame scroll, so it is rebuilt each
// frame in the effect (cheap next to the reconstruction itself).
const buildStatic = (width: number, height: number): Static => {
  const pitch = width / SILK_COLS; // reference horizontal cell density
  const nCols = Math.ceil(width / pitch) + 1;
  const nRows = Math.ceil(height / pitch) + 1;
  const maps = buildSpriteMaps(pitch);
  const P = Math.max(3, Math.round(pitch));
  const sprites = maps.map((map) => {
    const c = document.createElement("canvas");
    c.width = P;
    c.height = P;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(P, P);
    for (let i = 0; i < map.length; i++) {
      img.data[i * 4] = DOT_RGB[0];
      img.data[i * 4 + 1] = DOT_RGB[1];
      img.data[i * 4 + 2] = DOT_RGB[2];
      img.data[i * 4 + 3] = Math.round(map[i] * 255);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
  return { pitch, nCols, nRows, sprites };
};

export const CrxSilkBackground: React.FC<{
  frame: number;
  width: number;
  height: number;
  /** black wash pulled in for the end lockup (comp-frame window) */
  blackFade?: [number, number];
}> = ({ frame, width, height, blackFade = [851, 864] }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const stat = useMemo(() => buildStatic(width, height), [width, height]);

  // Ping-pong the darkness morph across the whole cut so it never freezes
  // on its last keyframe.
  const sf = pingpong((frame / CUT_LAST) * SILK_LAST * MORPH_TRIPS, SILK_LAST);
  // Continuous scroll offsets (field cells); the DCT's even extension folds
  // them into a seamless tide-drift.
  const offX = SCROLL_X * frame;
  const offY = SCROLL_Y * frame;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { pitch, nCols, nRows, sprites } = stat;

    const cosX = basisAt(SILK_KX, SILK_COLS, nCols, offX);
    const cosY = basisAt(SILK_KY, SILK_ROWS, nRows, offY);
    const mcosX = basisAt(SILK_MKX, SILK_COLS, nCols, offX);
    const mcosY = basisAt(SILK_MKY, SILK_ROWS, nRows, offY);

    const dark = idct2(
      lerpCoefs(SILK_COEFS, sf, SILK_KX, SILK_KY),
      SILK_KX,
      SILK_KY,
      cosX,
      cosY,
      nCols,
      nRows,
    );
    const mode = idct2(
      lerpCoefs(SILK_MODE_COEFS, sf, SILK_MKX, SILK_MKY),
      SILK_MKX,
      SILK_MKY,
      mcosX,
      mcosY,
      nCols,
      nRows,
    );

    const S = pitch / REF_PITCH;
    const dx =
      (((phaseAt(sf, SILK_PHASE_X, SILK_PHASE_T) % 9) + 9) % 9 -
        CXY +
        phaseAt(sf, PHASE_CORR_X, PHASE_CORR_T)) *
      S;
    const dy =
      (((phaseAt(sf, SILK_PHASE_Y, SILK_PHASE_T) % 9) + 9) % 9 -
        CXY +
        phaseAt(sf, PHASE_CORR_Y, PHASE_CORR_T)) *
      S;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    for (const [stop, col] of WASH_STOPS) grad.addColorStop(stop, col);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    for (let j = 0; j < nRows; j++) {
      const oj = Math.min(SILK_ROWS - 1, Math.round((j * SILK_ROWS) / nRows));
      for (let i = 0; i < nCols; i++) {
        const oi = Math.min(SILK_COLS - 1, Math.round((i * SILK_COLS) / nCols));
        const idx = j * nCols + i;
        const s = dark[idx] + SILK_DITHER[oj * SILK_COLS + oi];
        if (s < DOT_T) continue;
        const alpha = Math.min(0.95, Math.max(0, ALPHA_G * s + ALPHA_B));
        if (alpha <= 0.005) continue;
        const f = (mode[idx] - MU_SOFT) / (MU_SHARP - MU_SOFT);
        const k = Math.round(Math.min(1, Math.max(0, f)) * (N_SPRITES - 1));
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprites[k], i * pitch + dx, j * pitch + dy);
      }
    }
    ctx.globalAlpha = 1;
  }, [sf, offX, offY, stat, width, height]);

  const black = interpolate(frame, blackFade, [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <canvas
        ref={ref}
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0, width, height }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 100% at 50% 45%, rgba(0,0,0,0) 62%, rgba(0,0,0,0.08) 100%)",
        }}
      />
      {black > 0 && (
        <AbsoluteFill style={{ backgroundColor: "#000", opacity: black }} />
      )}
    </AbsoluteFill>
  );
};
