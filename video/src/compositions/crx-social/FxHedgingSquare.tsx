/**
 * FxHedgingSquare — 1080² LinkedIn loop, 5s.
 *
 * Layers: raw drone LANDSCAPE plate (cover) → live 3D MacBook (static,
 * centered, daylight-sky-lit) → white headline in the Apple display stack.
 * The MacBook is the MODERN M3 16" (2024) model — thin bezels, top notch,
 * no Touch Bar (model="modern" on MacbookWithScreen; CC-BY jackbaeten).
 *
 * The screen PLAYS A REAL TRADE now, in the CRX-Anoma film's grammar: the
 * FxScreenSequence comp (full-bleed /swap page, animated cursor, char-by-char
 * 250,000, "Request quotes", three dealer rates cascading in with the best one
 * ringed) is pre-rendered to public/fx-screenseq/f{0..149}.png and drawn
 * frame-exact into the 2560×1600 screen canvas. All 150 PNGs are preloaded
 * under one delayRender handle; the story's timing table lives in
 * FxScreenSequence.tsx (SEQ).
 *
 * The lid opens 3/4 → fully over frames 0–45 (easeOut), then rests at
 * fully-open — which already faces the near-level camera.
 *
 * Camera is near-level: slightly above eye line, ~8° of downward tilt, so
 * the screen reads close to face-on and the deck is only a shallow
 * foreshortened strip. Laptop holds ~75% of frame width with the
 * lake/clouds visible around it; the headline sits in the sky above.
 *
 * MacbookHeroStill (below) is a bonus single-frame variant, static-filled.
 */
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  delayRender,
  continueRender,
} from "remotion";
import {
  MacbookWithScreen,
  type CameraView,
  type ScreenRenderer,
} from "../vision/vs/MacbookWithScreen";
import * as THREE from "three";

// ── assets ──
const LANDSCAPE = "crx-assets/broll-bg-cut.mp4"; // 1920×1080 raw drone plate
const SWAP_EMPTY = "crx-swap-hd-empty.png"; // 3360×2100 dpr-2 — notional "0.0"
const SWAP_FILLED = "crx-swap-hd-filled.png"; // 3360×2100 dpr-2 — 250,000 + collateral row
const SCREENSEQ_DIR = "fx-screenseq"; // pre-rendered FxScreenSequence PNGs

const FPS = 30;
const LOOP_FRAMES = 150; // 5s
const SEQ_FRAMES = 150; // fx-screenseq/f{0..149}.png

// Background window: start ~4s in (bright lake, gentle cloud drift, no lead-in).
const BG_START = 120;

// ── lid choreography ── 3/4-open → fully open across the first 1.5s, easeOut.
// LID_END rests at exactly fully-open: with the near-level camera the
// authored open pose (screen leaning back ~22°) already faces the lens
// (~14° off-normal); the old past-open overshoot served the retired
// plongeant camera.
const LID_START_T = 0.75;
const LID_OPEN_FRAMES = 45;
const LID_END = 1.0;

const PAGE_BG = "#f6f7f9"; // shown until the sequence is decoded

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

// ── near-level camera ── the plongeant angle is retired: looking down made
// the deck dominate and the thin machine read as a thick slab. This view sits
// slightly above eye line — 8° of downward tilt — so the screen is close to
// face-on and fully legible while the deck/keyboard shows only as a shallow
// foreshortened strip. Solved numerically (projection of the measured GLB
// corners through the 50° camera), then verified on stills: laptop ≈75% of
// frame width (~812px), lid top ~y329 (clear of the headline in the sky),
// base bottom ~y847 (lake visible below), deck strip ~160px.
const HERO_VIEW: CameraView = {
  pos: new THREE.Vector3(3.0, 4.08, -11.45),
  target: new THREE.Vector3(3.0, 1.9, 4.09),
  zoom: 1.0,
};

// ── image preload (headless-render safe) ──
// The handle clears two RAFs after the loaded image COMMITS, not in onload:
// a new image re-renders the 3D screen canvas, and if this handle is the last
// one standing the headless screenshot fires immediately — racing the GL
// redraw of the re-committed scene (captured blank, laptop missing).
function usePreloadedImage(src: string): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [handle] = useState(() => delayRender(`preload ${src}`));
  useEffect(() => {
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () => continueRender(handle);
    image.src = src;
  }, [src, handle]);
  useEffect(() => {
    if (!img) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => continueRender(handle));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [img, handle]);
  return img;
}

// ── sequence preload (headless-render safe) ──
// All 150 screen frames under ONE delayRender handle. Same race discipline as
// usePreloadedImage: the handle clears two RAFs after the loaded set COMMITS,
// so the headless screenshot never beats the GL redraw of the new texture.
function usePreloadedSequence(
  dir: string,
  count: number,
): HTMLImageElement[] | null {
  const [imgs, setImgs] = useState<HTMLImageElement[] | null>(null);
  const [handle] = useState(() => delayRender(`preload ${dir} sequence`));
  useEffect(() => {
    let cancelled = false;
    let loaded = 0;
    const arr: HTMLImageElement[] = new Array(count);
    for (let i = 0; i < count; i++) {
      const image = new Image();
      image.onload = () => {
        loaded++;
        if (!cancelled && loaded === count) setImgs(arr);
      };
      image.onerror = () => continueRender(handle);
      image.src = staticFile(`${dir}/f${i}.png`);
      arr[i] = image;
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dir, count, handle]);
  useEffect(() => {
    if (!imgs) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => continueRender(handle));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [imgs, handle]);
  return imgs;
}

// Cover-fit: fill the panel canvas without stretching the UI. The modern
// MacBook's screen canvas matches the physical panel aspect (~1.545) while
// the pre-rendered UI frames are 16:10 (1.6) — an aspect-preserving cover
// crop (~1.7% off each side) beats a 3.5% squeeze of every circle and glyph.
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  w: number,
  h: number,
) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// ── 2021+ panel signature ── the UI draws through a rounded-top mask with a
// black chin band below it, so bezel, notch, and screen merge into ONE black
// glass panel. Measured on Apple's own M3 press photo (front-on, lit screen):
// black chin ≈5.0% of screen height, content corner radius ≈2–2.5% of screen
// width, bottom corners square. The GLB's glass supplies ~1.8% of chin on its
// own; the band tops it up. The UI keeps its exact cover-fit geometry — the
// mask hides, it never reflows (the notch/nav-bar registration must not move).
const BEZEL_BLACK = "#0a0a0c";
const CORNER_R_FRAC = 0.025; // × canvas width — top corners only
const CHIN_FRAC = 0.034; // × canvas height — extra black below the UI

function drawPanelMasked(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  paint: () => void,
) {
  ctx.fillStyle = BEZEL_BLACK;
  ctx.fillRect(0, 0, w, h);
  const r = Math.round(w * CORNER_R_FRAC);
  const chin = Math.round(h * CHIN_FRAC);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h - chin, [r, r, 0, 0]);
  ctx.clip();
  ctx.fillStyle = PAGE_BG;
  ctx.fillRect(0, 0, w, h);
  paint();
  ctx.restore();
}

// ── screen renderer ── the pre-rendered trade sequence, frame-exact.
function makeSequenceRenderer(imgs: HTMLImageElement[] | null): ScreenRenderer {
  return (ctx, frame, w, h) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawPanelMasked(ctx, w, h, () => {
      if (!imgs) return;
      const idx = Math.min(Math.max(Math.round(frame), 0), imgs.length - 1);
      const img = imgs[idx];
      if (img && img.complete && img.naturalWidth > 0) {
        drawCover(ctx, img, w, h);
      }
    });
  };
}

// Static filled viewport — for the single-frame hero still.
function makeStaticFilledRenderer(
  empty: HTMLImageElement | null,
  filled: HTMLImageElement | null,
): ScreenRenderer {
  return (ctx, _frame, w, h) => {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    drawPanelMasked(ctx, w, h, () => {
      const img = filled ?? empty;
      if (!img || !img.complete || img.naturalWidth === 0) return;
      drawCover(ctx, img, w, h);
    });
  };
}

// ── type ── Apple display stack (docs/apple-style-table.md).
const APPLE_STACK =
  '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif';

// ═══════════════════════════════════════════════════════════════════════
// FxHedgingSquare — the 5s square loop
// ═══════════════════════════════════════════════════════════════════════

export const FxHedgingSquare: React.FC = () => {
  const frame = useCurrentFrame();
  const seq = usePreloadedSequence(SCREENSEQ_DIR, SEQ_FRAMES);
  const renderScreen = makeSequenceRenderer(seq);

  // The lid is the motion: 3/4-open → past-open over frames 0–45, then still.
  const lidT =
    LID_START_T +
    (LID_END - LID_START_T) * easeOutCubic(clamp01(frame / LID_OPEN_FRAMES));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Landscape plate — cover-crop the 16:9 drone footage into the square. */}
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(LANDSCAPE)}
          startFrom={BG_START}
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>

      {/* Static, daylight-lit MacBook rendered live (lid opens, screen fills). */}
      <AbsoluteFill
        style={{
          filter: "drop-shadow(0px 30px 44px rgba(0,0,0,0.32))",
        }}
      >
        <MacbookWithScreen
          renderScreen={renderScreen}
          customView={HERO_VIEW}
          lidT={lidT}
          transparent
          showContactShadow={false}
          daylight
          model="modern"
        />
      </AbsoluteFill>

      {/* Headline. */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-start",
          paddingTop: 58,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: APPLE_STACK,
              fontWeight: 700,
              fontSize: 74,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              color: "#ffffff",
              textShadow: "0 2px 24px rgba(0,0,0,0.35)",
            }}
          >
            Fx Hedging Made Easy
          </div>
          <div
            style={{
              fontFamily: APPLE_STACK,
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: "0.01em",
              marginTop: 10,
              color: "rgba(255,255,255,0.78)",
              textShadow: "0 2px 24px rgba(0,0,0,0.35)",
            }}
          >
            app.crxfx.com
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const fxHedgingSquareMeta = {
  id: "FxHedgingSquare",
  component: FxHedgingSquare,
  width: 1080,
  height: 1080,
  fps: FPS,
  durationInFrames: LOOP_FRAMES,
};

// ═══════════════════════════════════════════════════════════════════════
// MacbookHeroStill — single daylight frame (bonus; not used by the loop)
// ═══════════════════════════════════════════════════════════════════════
export const MacbookHeroStill: React.FC = () => {
  const empty = usePreloadedImage(staticFile(SWAP_EMPTY));
  const filled = usePreloadedImage(staticFile(SWAP_FILLED));
  const renderScreen = makeStaticFilledRenderer(empty, filled);
  return (
    <MacbookWithScreen
      renderScreen={renderScreen}
      customView={HERO_VIEW}
      lidT={1}
      transparent
      showContactShadow={false}
      daylight
      model="modern"
    />
  );
};

export const macbookHeroStillMeta = {
  id: "MacbookHeroStill",
  component: MacbookHeroStill,
  width: 1600,
  height: 1600,
  fps: FPS,
  durationInFrames: 1,
};
