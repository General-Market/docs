import React, { useEffect, useRef } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
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
} from "./silkField";
import { PHASE_CORR_T, PHASE_CORR_X, PHASE_CORR_Y } from "./silkPhaseCorr";
import {
  PathAsset,
  badge,
  word,
  usdRing,
  usdText,
  dTop,
  dLeft,
  dRight,
  dBottom,
  anchWord,
} from "./paths";
import {
  CURVE_STEP,
  SOLID_BADGE,
  PEAK_BADGE,
  SOLID_WORD,
  PEAK_WORD,
  SOLID_USDRING,
  PEAK_USDRING,
  SOLID_USDTEXT,
  PEAK_USDTEXT,
  SOLID_ANCH,
  PEAK_ANCH,
  SOLID_DIATOP,
  PEAK_DIATOP,
  SOLID_DIALEFT,
  PEAK_DIALEFT,
  SOLID_DIARIGHT,
  PEAK_DIARIGHT,
  SOLID_DIABOTTOM,
  PEAK_DIABOTTOM,
} from "./apparitionCurves";

// Ethena × Anchorage Digital (USDtb) partnership announcement replica.
// Source: 1280x720 @ 29.97fps, 290 frames, single scene. Every visual asset
// is rebuilt — logos as potrace'd vector paths, background as a procedural
// halftone-dash silk field. Elements materialize through a halftone dissolve
// (stipple overlay saturating into solid vector), timed to per-element
// OpenCV-measured darkness curves; global fade-out f259-289.

export const FPS = 29.97;
export const DURATION = 290;
const W = 1280;
const H = 720;

const BG = "#fcfcfc";
const INK = "#060606";
const BADGE_FILL = "#232323";

// ---------------------------------------------------------- measured curves
// Apparition curves live in apparitionCurves.ts (auto-generated): per element,
// SOLID_* = normalized darkness of glyph pixels between lattice dots (drives
// the solid vector layer), PEAK_* = darkness at lattice dot centers (peak
// minus solid drives the stipple overlay). Sampled every CURVE_STEP frames.
const sampleRamp = (frame: number, arr: number[], step: number, start = 0) => {
  const p = (frame - start) / step;
  if (p <= 0) return arr[0];
  if (p >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(p);
  const f = p - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
};

// ---------------------------------------------------------- silk background
// The reference background is a flowing silk/cloth field rendered as a
// halftone of small marks on a 9px lattice. Three fitted parameter sets
// drive the procedural render (no source raster is mounted):
//   darkness — 48x27 2D-DCT keyframes of per-cell halftone darkness
//   dither   — static per-cell residual (the frozen stipple pattern)
//   mode     — 24x14 2D-DCT keyframes of within-cell vertical contrast:
//              1 = sharp discrete dot, 0 = soft depth-of-field streak
// plus the measured lattice phase-drift curves. Per cell, a sprite is
// picked along the sharp-dot -> soft-streak axis and stamped at the
// measured phase with alpha from the darkness mapping.
const PITCH = 9;
const DOT_T = 0.05; // visibility threshold (cell darkness)
const MU_SHARP = 0.22; // mode >= this -> fully sharp dot
const MU_SOFT = 0.06; // mode <= this -> fully soft streak
const DOT_H = 4.0;
const DOT_W = 2.8;
const CXY = 4.3; // dot center inside the 9px tile
const SOFT_SX = 1.9; // gaussian sigma of the streak profile
const ALPHA_G = 1.3;
const ALPHA_B = -0.017;
const N_SPRITES = 6;

// DCT-III basis tables (ortho normalization)
const basis = (K: number, N: number): number[][] => {
  const t: number[][] = [];
  for (let k = 0; k < K; k++) {
    const a = k === 0 ? Math.sqrt(1 / N) : Math.sqrt(2 / N);
    t.push(
      Array.from({ length: N }, (_, n) =>
        a * Math.cos((Math.PI * (2 * n + 1) * k) / (2 * N)),
      ),
    );
  }
  return t;
};
const COS_X = basis(SILK_KX, SILK_COLS);
const COS_Y = basis(SILK_KY, SILK_ROWS);
const MCOS_X = basis(SILK_MKX, SILK_COLS);
const MCOS_Y = basis(SILK_MKY, SILK_ROWS);

const idct2 = (
  coefs: Float64Array,
  kxN: number,
  kyN: number,
  cosX: number[][],
  cosY: number[][],
): Float32Array => {
  const A = new Float64Array(kyN * SILK_COLS);
  for (let ky = 0; ky < kyN; ky++) {
    for (let i = 0; i < SILK_COLS; i++) {
      let s = 0;
      for (let kx = 0; kx < kxN; kx++) {
        s += coefs[ky * kxN + kx] * cosX[kx][i];
      }
      A[ky * SILK_COLS + i] = s;
    }
  }
  const field = new Float32Array(SILK_ROWS * SILK_COLS);
  for (let j = 0; j < SILK_ROWS; j++) {
    for (let i = 0; i < SILK_COLS; i++) {
      let s = 0;
      for (let ky = 0; ky < kyN; ky++) {
        s += A[ky * SILK_COLS + i] * cosY[ky][j];
      }
      field[j * SILK_COLS + i] = s;
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

// Sprite alpha maps: level N_SPRITES-1 = sharp dot ... level 0 = soft streak.
// Same math as the fitting mock: box coverage, gaussian blur, peak-normalize.
const buildSpriteMaps = (): Float32Array[] => {
  const maps: Float32Array[] = [];
  for (let k = 0; k < N_SPRITES; k++) {
    const f = k / (N_SPRITES - 1); // 1 = sharp
    const hgt = DOT_H + (PITCH - DOT_H) * (1 - f);
    const blur = SOFT_SX * (1 - f);
    let tile = new Float32Array(PITCH * PITCH);
    const y0 = CXY - hgt / 2;
    const y1 = CXY + hgt / 2;
    const x0 = CXY - DOT_W / 2;
    const x1 = CXY + DOT_W / 2;
    for (let y = 0; y < PITCH; y++) {
      const fy = Math.min(1, Math.max(0, Math.min(y + 1, y1) - Math.max(y, y0)));
      for (let x = 0; x < PITCH; x++) {
        const fx = Math.min(1, Math.max(0, Math.min(x + 1, x1) - Math.max(x, x0)));
        tile[y * PITCH + x] = fy * fx;
      }
    }
    if (blur > 0.15) {
      // separable gaussian
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
        const out = new Float32Array(PITCH * PITCH);
        for (let y = 0; y < PITCH; y++) {
          for (let x = 0; x < PITCH; x++) {
            let s = 0;
            for (let t = -rad; t <= rad; t++) {
              const xx = horiz ? x + t : x;
              const yy = horiz ? y : y + t;
              if (xx < 0 || xx >= PITCH || yy < 0 || yy >= PITCH) continue;
              s += src[yy * PITCH + xx] * kern[t + rad];
            }
            out[y * PITCH + x] = s;
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
const SPRITE_MAPS = buildSpriteMaps();

let spriteCanvases: HTMLCanvasElement[] | null = null;
const getSprites = (): HTMLCanvasElement[] => {
  if (spriteCanvases) return spriteCanvases;
  spriteCanvases = SPRITE_MAPS.map((map) => {
    const c = document.createElement("canvas");
    c.width = PITCH;
    c.height = PITCH;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(PITCH, PITCH);
    for (let i = 0; i < map.length; i++) {
      img.data[i * 4] = 72;
      img.data[i * 4 + 1] = 76;
      img.data[i * 4 + 2] = 82;
      img.data[i * 4 + 3] = Math.round(map[i] * 255);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  });
  return spriteCanvases;
};

const phaseAt = (frame: number, arr: number[]): number => {
  const ts = SILK_PHASE_T;
  if (frame <= ts[0]) return arr[0];
  if (frame >= ts[ts.length - 1]) return arr[arr.length - 1];
  let i = 0;
  while (i < ts.length - 2 && ts[i + 1] <= frame) i++;
  const f = (frame - ts[i]) / (ts[i + 1] - ts[i]);
  return arr[i] * (1 - f) + arr[i + 1] * f;
};

// Interpolate the measured lattice phase-drift correction over PHASE_CORR_T.
const corrAt = (frame: number, arr: number[]): number => {
  const ts = PHASE_CORR_T;
  if (frame <= ts[0]) return arr[0];
  if (frame >= ts[ts.length - 1]) return arr[arr.length - 1];
  let i = 0;
  while (i < ts.length - 2 && ts[i + 1] <= frame) i++;
  const f = (frame - ts[i]) / (ts[i + 1] - ts[i]);
  return arr[i] * (1 - f) + arr[i + 1] * f;
};

const SilkHalftone: React.FC<{ frame: number }> = ({ frame }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dark = idct2(
      lerpCoefs(SILK_COEFS, frame, SILK_KX, SILK_KY),
      SILK_KX,
      SILK_KY,
      COS_X,
      COS_Y,
    );
    const mode = idct2(
      lerpCoefs(SILK_MODE_COEFS, frame, SILK_MKX, SILK_MKY),
      SILK_MKX,
      SILK_MKY,
      MCOS_X,
      MCOS_Y,
    );
    const dx = Math.round(
      ((phaseAt(frame, SILK_PHASE_X) % 9) + 9) % 9 - CXY +
        corrAt(frame, PHASE_CORR_X),
    );
    const dy = Math.round(
      ((phaseAt(frame, SILK_PHASE_Y) % 9) + 9) % 9 - CXY +
        corrAt(frame, PHASE_CORR_Y),
    );
    const sprites = getSprites();
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    for (let j = 0; j < SILK_ROWS; j++) {
      for (let i = 0; i < SILK_COLS; i++) {
        const idx = j * SILK_COLS + i;
        const s = dark[idx] + SILK_DITHER[idx];
        if (s < DOT_T) continue;
        const alpha = Math.min(0.95, Math.max(0, ALPHA_G * s + ALPHA_B));
        if (alpha <= 0.005) continue;
        const f = (mode[idx] - MU_SOFT) / (MU_SHARP - MU_SOFT);
        const k = Math.round(Math.min(1, Math.max(0, f)) * (N_SPRITES - 1));
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprites[k], i * PITCH + dx, j * PITCH + dy);
      }
    }
    ctx.globalAlpha = 1;
  }, [frame]);
  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      style={{ position: "absolute", left: 0, top: 0, width: W, height: H }}
    />
  );
};

// ------------------------------------------------------------- vector art
// Halftone dissolve, measured: a solid vector copy driven by the valley
// darkness curve, plus a stipple copy (3x3px dots on the 9px lattice at the
// measured mid-reveal phase) carrying the peak-minus-valley remainder —
// letterforms materialize as lattice dots before saturating to solid ink.
// Lattice dot center at mid-reveal (f40): phase (6.6, 6.2) px, tile units 4x.
const STIP_CX = 6.6 * 4;
const STIP_CY = 6.2 * 4;
const STIP_R = 6; // 3px dot -> 12 tile units
const Vec: React.FC<{
  p: PathAsset;
  solid: number;
  stipple: number;
  fadeOut: number;
  fill?: string;
}> = ({ p, solid, stipple, fadeOut, fill = INK }) => {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  if ((solid <= 0 && stipple <= 0) || fadeOut <= 0) return null;
  // pattern aligned to the global 9px grid (viewBox units are 4x comp px)
  const offX = ((9 - (p.x % 9)) % 9) * 4;
  const offY = ((9 - (p.y % 9)) % 9) * 4;
  return (
    <svg
      viewBox={`0 0 ${p.vw} ${p.vh}`}
      style={{
        position: "absolute",
        left: p.x,
        top: p.y,
        width: p.w,
        height: p.h,
        opacity: fadeOut,
      }}
    >
      <defs>
        <pattern
          id={`dash${uid}`}
          x={offX}
          y={offY}
          width={36}
          height={36}
          patternUnits="userSpaceOnUse"
        >
          <rect
            x={(STIP_CX - STIP_R + 36) % 36}
            y={(STIP_CY - STIP_R + 36) % 36}
            width={STIP_R * 2}
            height={STIP_R * 2}
            fill={fill}
          />
        </pattern>
      </defs>
      <g transform={p.tf}>
        <path d={p.d} fill={fill} opacity={Math.min(1, solid)} />
        {stipple > 0.005 ? (
          <path d={p.d} fill={`url(#dash${uid})`} opacity={Math.min(1, stipple)} />
        ) : null}
      </g>
    </svg>
  );
};

// ------------------------------------------------------------ composition
export const EthenaComposition: React.FC<{ frameOffset?: number }> = ({
  frameOffset = 0,
}) => {
  const frame = useCurrentFrame() + frameOffset;

  const fadeOut = interpolate(frame, [259, 289], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const layer = (solidArr: number[], peakArr: number[]) => {
    const solid = sampleRamp(frame, solidArr, CURVE_STEP);
    const peak = sampleRamp(frame, peakArr, CURVE_STEP);
    return { solid, stipple: Math.max(0, peak - solid) };
  };
  const lBadge = layer(SOLID_BADGE, PEAK_BADGE);
  const lWord = layer(SOLID_WORD, PEAK_WORD);
  const lUsdRing = layer(SOLID_USDRING, PEAK_USDRING);
  const lUsdText = layer(SOLID_USDTEXT, PEAK_USDTEXT);
  const lAnch = layer(SOLID_ANCH, PEAK_ANCH);
  const lDiaTop = layer(SOLID_DIATOP, PEAK_DIATOP);
  const lDiaLeft = layer(SOLID_DIALEFT, PEAK_DIALEFT);
  const lDiaRight = layer(SOLID_DIARIGHT, PEAK_DIARIGHT);
  const lDiaBottom = layer(SOLID_DIABOTTOM, PEAK_DIABOTTOM);

  // Divider: near-black 2px line, triangular alpha profile (measured peak
  // plateau y340-360, tips y~237/475), grows from center f52->f78.
  const divGrow = interpolate(
    frame,
    [52, 54, 58, 66, 70, 74, 78],
    [0, 0.53, 0.62, 0.7, 0.85, 0.94, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const divOpacity =
    interpolate(frame, [52, 60], [0, 0.93], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) * fadeOut;

  return (
    // The reference is a compression-softened real video: its halftone dots
    // carry a finite point-spread that the crisp procedural render lacks. A
    // matched ~1.2px gaussian brings the replica's dot PSF onto the source's
    // (measured SSIM-optimal across bg/reveal/settled/fadeout phases).
    <AbsoluteFill style={{ backgroundColor: BG, filter: "blur(1.2px)" }}>
      <SilkHalftone frame={frame} />
      {/* divider */}
      {divGrow > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 639,
            top: 237,
            width: 2,
            height: 238,
            transform: `scaleY(${divGrow})`,
            transformOrigin: "center",
            opacity: divOpacity,
            background:
              "linear-gradient(to bottom, rgba(13,13,13,0) 0%, rgba(13,13,13,1) 43%, rgba(13,13,13,1) 52%, rgba(13,13,13,0) 100%)",
          }}
        />
      ) : null}
      {/* USDtb white token disc behind the ring */}
      <div
        style={{
          position: "absolute",
          left: 264 - 33,
          top: 411.5 - 33,
          width: 66,
          height: 66,
          borderRadius: "50%",
          background: "#f0f0f0",
          boxShadow: "0 0 5px rgba(0,0,0,0.10), inset 0 0 0 1.5px #e6e6e6",
          opacity: Math.pow(lUsdRing.solid, 1.5) * fadeOut,
        }}
      />
      <Vec p={badge} solid={lBadge.solid} stipple={lBadge.stipple} fadeOut={fadeOut} fill={BADGE_FILL} />
      <Vec p={word} solid={lWord.solid} stipple={lWord.stipple} fadeOut={fadeOut} />
      <Vec p={usdRing} solid={lUsdRing.solid} stipple={lUsdRing.stipple} fadeOut={fadeOut} />
      <Vec p={usdText} solid={lUsdText.solid} stipple={lUsdText.stipple} fadeOut={fadeOut} />
      <Vec p={dTop} solid={lDiaTop.solid} stipple={lDiaTop.stipple} fadeOut={fadeOut} />
      <Vec p={dLeft} solid={lDiaLeft.solid} stipple={lDiaLeft.stipple} fadeOut={fadeOut} />
      <Vec p={dRight} solid={lDiaRight.solid} stipple={lDiaRight.stipple} fadeOut={fadeOut} />
      <Vec p={dBottom} solid={lDiaBottom.solid} stipple={lDiaBottom.stipple} fadeOut={fadeOut} />
      <Vec p={anchWord} solid={lAnch.solid} stipple={lAnch.stipple} fadeOut={fadeOut} />
    </AbsoluteFill>
  );
};

export const ethenaReplicateMeta = {
  id: "Ethena-Replicate",
  component: EthenaComposition,
  durationInFrames: DURATION,
  fps: FPS,
  width: W,
  height: H,
};
