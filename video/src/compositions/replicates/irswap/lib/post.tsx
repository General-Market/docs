// Composition-wide film response, measured from the reference:
// 1. EdgeFeather — the ref carries a fixed edge vignette (NOT radial):
//    top −32 luma levels at the edge easing to 0 by ~90px in, left −26,
//    right −29, bottom edge clean with corner-local blobs (~−33 at the
//    extreme pixel). Corner values are max-of-edges, not a product.
//    Constant across every scene (measured f600/f1200/f2500/f4400:
//    ref corners 219.4-220.2 in all four).
// 2. Grain — animated soft grain, ~2px blobs (h264-smoothed 1px noise),
//    mid-tone high-pass std ≈0.25 decoded, ~0 on pure paper white. An
//    overlay-blended mid-grey noise tile reproduces the white-attenuation
//    naturally. The tile is deterministic (seeded PRNG — render workers
//    must agree) and shifts per frame.

import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";

const W = 854;
const H = 480;

// Weights (0..1) of a DARKEN-toward-220 feather:
//   out = (1−w)·in + w·min(in, 220)
// (a grey-220 image under mix-blend-mode 'darken'). Chosen over the two
// pure models by full-render A/B: black-alpha multiplicative crushed the
// bright corner content Community/Chart2 carry mid-dive (ref keeps those
// corners at 235-245), while an unconditional grey-mix washed the outro's
// teal board toward 220. Darken-to-220 reproduces both: paper corners
// land at the measured 219-220 patch means, sub-220 content passes
// through untouched. Corner pooling (not a thin fringe) matches the
// measured 80x80 patch means; edge-mid targets T/L/R ≈ 232/240/237.5.
type Prof = [number, number][];
const TOP: Prof = [[0, 0.97], [40, 0.65], [80, 0.35], [120, 0.08], [160, 0]];
const LEFT: Prof = [[0, 0.79], [40, 0.38], [80, 0.16], [130, 0]];
const RIGHT: Prof = [[0, 0.88], [40, 0.42], [80, 0.17], [120, 0]];
const CORNER_PLATEAU = 90;
const CORNER_END = 200;
const GREY = 220;

// NEGATIVE A/B (round 7 — do not retry as-is): the community eye-hold
// f4920-5240 measures a LEFT-side lift of this wash in the ref (TL corner
// 243-244 uncapped paper vs our capped ~220 → att−ref −23; BL −12..−20;
// top-left band −14; TR pinned at the 219.4 void all along). A zone-masked
// weight lift (top-left 0.65 / bottom-left 0.55, ramps 4912-4945 in,
// 5228-5242 out) fixed every band mean to ±3 levels and LOST SSIM at all
// three gates (4950 .7091→.7051, 5100 .7555→.7538, 5200 .7403→.7388):
// at high luma SSIM's mean term barely notices a 24-level offset (~0.995)
// while lifting the cap exposes our corner content's structure against the
// ref's flat wash — the feather was hiding misplaced ink. Only worth
// retrying AFTER the community corner content itself matches structurally.
const prof = (rows: Prof, d: number): number => {
  if (d <= rows[0][0]) return rows[0][1];
  for (let i = 0; i < rows.length - 1; i++) {
    if (d <= rows[i + 1][0]) {
      const t = (d - rows[i][0]) / (rows[i + 1][0] - rows[i][0]);
      return rows[i][1] + (rows[i + 1][1] - rows[i][1]) * t;
    }
  }
  return 0;
};

export const EdgeFeather: React.FC = () => {
  const url = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const wTop = prof(TOP, y);
      for (let x = 0; x < W; x++) {
        let w = Math.max(wTop, prof(LEFT, x), prof(RIGHT, W - 1 - x));
        const rc = Math.min(
          Math.hypot(x, y),
          Math.hypot(W - 1 - x, y),
          Math.hypot(x, H - 1 - y),
          Math.hypot(W - 1 - x, H - 1 - y),
        );
        if (rc < CORNER_END) {
          const cw = rc <= CORNER_PLATEAU ? 1 : 1 - (rc - CORNER_PLATEAU) / (CORNER_END - CORNER_PLATEAU);
          w = Math.max(w, cw);
        }
        const i = (y * W + x) * 4;
        img.data[i] = GREY;
        img.data[i + 1] = GREY;
        img.data[i + 2] = GREY;
        img.data[i + 3] = Math.min(255, Math.round(w * 255));
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, []);
  if (!url) return null;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundSize: "100% 100%",
        mixBlendMode: "darken",
        pointerEvents: "none",
      }}
    />
  );
};

const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// `amp` = tile luma std in 0-255 levels around mid-grey. Overlay blending
// scales the visible swing by 2·(1−base): ~0.27 at the 220 mid-tones,
// ~0.02 on paper white.
// amp 3: post-encode ≈0.11 on paper (ref 0.24) — amp 6 hit the ref level
// on paper but quadrupled the mid-tone swing (overlay blending peaks at
// mid-luma) and cost the settled teal card ~0.01 SSIM. Under-grain is the
// smaller error: h264 crushes ref grain on mid-tones to ~0.5 anyway.
export const Grain: React.FC<{ frame: number; amp?: number }> = ({ frame, amp = 3 }) => {
  const url = useMemo(() => {
    const N = 128;
    const c = document.createElement("canvas");
    c.width = N;
    c.height = N;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    const rnd = mulberry32(0x1c0ffee);
    const img = ctx.createImageData(N, N);
    const k = amp * 2.449; // triangular dist std = k/sqrt(6)
    for (let i = 0; i < N * N; i++) {
      const v = Math.max(0, Math.min(255, Math.round(128 + (rnd() + rnd() - 1) * k)));
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL();
  }, [amp]);
  if (!url) return null;
  const ox = (frame * 97) % 256;
  const oy = (frame * 61) % 256;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url(${url})`,
        backgroundSize: "256px 256px", // 128 tile at 2x → ~2px soft blobs
        backgroundPosition: `${ox}px ${oy}px`,
        mixBlendMode: "overlay",
        pointerEvents: "none",
      }}
    />
  );
};
