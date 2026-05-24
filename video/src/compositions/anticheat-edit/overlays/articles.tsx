// Article-proof overlays for the AntiCheatEdit talk.
//
// At the "proof" beats — the moments Max gestures at the evidence rather than
// explaining a mechanism — the best-illustrating source article flashes in
// full-bleed over the talking head, zoomed hard onto the damning phrase so it
// reads in a second, every key phrase struck through in yellow. The data
// charts own the explanation beats; these own the proof beats, so the two
// never collide.
//
// Placement seconds are final.mp4 time, calibrated against the 13 baked title
// cards (scripts/talking-head-edit/article_times.py). Screenshots + highlight
// boxes are produced by 07_article_shots.mjs into ./article-shots.ts.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { ARTICLE_SHOTS, type ArticleBox, type ArticleShot } from "./article-shots";

type Treatment = "whip" | "punch" | "fullscreen";

const W = 1920;
const H = 1080;
// The captures are 1440×1120; rendered at frame width the image is this tall.
const IMG_AR = 1120 / 1440;

// Vertical pan timing (frames @ 30fps): dwell on the article's top so the
// masthead reads, then glide down to the highlighted phrase. Top first, proof
// second — the article never opens mid-page.
const PAN_HOLD = 16; // frames held on the masthead before the pan starts
const PAN_LEN = 44; // frames of the top→phrase glide (~1.5s)

export type ArticleSlot = {
  /** final.mp4 seconds. */
  at: number;
  /** seconds on screen. */
  duration: number;
  shot: ArticleShot;
  treatment: Treatment;
  /** How hard to zoom onto the key phrase. */
  zoom: number;
  /** Source URL, printed in a dark pill at the bottom. */
  source: string;
};

// Placement is keyed by TIME, not by shot — so a page can appear more than
// once. Each beat sits inside its spoken section and clear of that section's
// chart window, so the proof and the chart never share the frame. `shot` names
// the captured page (article-shots.ts). zoom is the *destination* scale the pan
// settles at — moderate (~1.6×) on the receipts so the phrase reads without
// burying the masthead; the page-wide shots stay wider since the whole page is
// the point. Our own site (gm-*) is b-roll, not a receipt: wide, no yellow.
type Placement = {
  /** which captured page (article-shots.ts slug) to draw */
  shot: string;
  at: number;
  duration: number;
  treatment: Treatment;
  zoom: number;
  source: string;
};

const PLACEMENTS: Placement[] = [
  // Our blog — "if you want to read more about it, we made a blog" (0:70).
  { shot: "gm-flags", at: 68.8, duration: 2.6, treatment: "fullscreen", zoom: 1.12, source: "generalmarket.io/anticheat-flags" },

  { shot: "vip-fee-tier", at: 110.657, duration: 6, treatment: "punch", zoom: 1.6, source: "binance.com · spot trading fees" },
  { shot: "listing-frontrun", at: 160.479, duration: 6, treatment: "whip", zoom: 1.6, source: "sec.gov · press-release 2022-127" },
  { shot: "order-flow-vis", at: 191.685, duration: 6, treatment: "punch", zoom: 1.6, source: "sec.gov · press-release 2023-101" },
  { shot: "pfof", at: 242.363, duration: 6, treatment: "punch", zoom: 1.6, source: "sec.gov · press-release 2020-321" },
  { shot: "jito-mev", at: 302.69, duration: 6, treatment: "whip", zoom: 1.6, source: "helius.dev · solana mev" },
  { shot: "matching", at: 312.877, duration: 6, treatment: "punch", zoom: 1.6, source: "developers.binance.com · amend-keep priority" },
  { shot: "funding", at: 373.4, duration: 4.5, treatment: "punch", zoom: 1.6, source: "hyperliquid · funding docs" },
  { shot: "maker-rebate", at: 404.6, duration: 6, treatment: "punch", zoom: 1.55, source: "binance.com · spot LP program" },
  { shot: "adl-visibility", at: 455.194, duration: 6, treatment: "whip", zoom: 1.6, source: "coindesk · hyperliquid delists JELLY" },

  // The solution — "with general market, we create the first financial instrument" (8:11).
  { shot: "gm-home", at: 491.3, duration: 6, treatment: "fullscreen", zoom: 1.08, source: "generalmarket.io" },

  { shot: "long-list", at: 556.419, duration: 6, treatment: "fullscreen", zoom: 1.2, source: "generalmarket.io/anticheat-flags" },
  { shot: "polymarket", at: 599.869, duration: 6.5, treatment: "fullscreen", zoom: 1.45, source: "cftc.gov · release 8478-22" },

  // The CTA — "you can join our Discord to know more" (10:29).
  { shot: "gm-home", at: 629.4, duration: 4.6, treatment: "fullscreen", zoom: 1.08, source: "generalmarket.io · discord" },
];

const SHOT_BY_SLUG: Record<string, ArticleShot> = Object.fromEntries(
  ARTICLE_SHOTS.map((s) => [s.slug, s]),
);

export const ARTICLE_OVERLAYS: ArticleSlot[] = PLACEMENTS.flatMap((p) => {
  const shot = SHOT_BY_SLUG[p.shot];
  if (!shot) return [];
  return [{ at: p.at, duration: p.duration, shot, treatment: p.treatment, zoom: p.zoom, source: p.source }];
}).sort((a, b) => a.at - b.at);

// All boxes worth striking in yellow: the phrases plus the venue name, deduped.
const yellowBoxes = (shot: ArticleShot): ArticleBox[] => {
  const all = [...shot.highlights];
  if (shot.nameBox && !all.some((b) => Math.abs(b.x - shot.nameBox!.x) < 0.004 && Math.abs(b.y - shot.nameBox!.y) < 0.004)) {
    all.push(shot.nameBox);
  }
  return all;
};

// The phrase the camera flies to: first highlight, else the name, else a point
// a third of the way down (good for a page hero / chart).
const focusBox = (shot: ArticleShot): ArticleBox =>
  shot.highlights[0] ?? shot.nameBox ?? { x: 0.5, y: 0.32, w: 0, h: 0 };

const ArticleFlash: React.FC<{ slot: ArticleSlot; durationInFrames: number }> = ({
  slot,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { shot, treatment, zoom } = slot;
  const boxes = yellowBoxes(shot);
  const focus = focusBox(shot);

  // Entry settles from a touch tighter; the vertical pan now carries the motion,
  // so there's no separate zoom drift.
  const Z =
    treatment === "punch"
      ? interpolate(frame, [0, 7], [zoom * 1.08, zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, 8], [zoom * 1.04, zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Whip slides in from the right; others just fade.
  const slideX =
    treatment === "whip"
      ? interpolate(frame, [0, 9], [520, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) })
      : 0;
  const opacity = Math.min(
    interpolate(frame, [0, treatment === "fullscreen" ? 7 : 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );

  const imgW = W * Z;
  const imgH = imgW * IMG_AR;
  const fx = focus.x + focus.w / 2;
  const fy = focus.y + focus.h / 2;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Horizontal: centre the phrase, clamped so the image always covers the frame
  // (no dark gutter). slideX rides on top for the whip entry only.
  const left = clamp(W / 2 - fx * imgW, W - imgW, 0) + slideX;

  // Vertical PAN: open flush with the article's top (topTop = 0 — masthead and
  // headline read first), then glide down so the phrase lands at 60% of the
  // frame. A phrase that already sits high needs no pan (both ends clamp to 0).
  const topTop = 0;
  const topPhrase = clamp(H * 0.6 - fy * imgH, H - imgH, 0);
  const panP = interpolate(frame, [PAN_HOLD, PAN_HOLD + PAN_LEN], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const top = topTop + (topPhrase - topTop) * panP;

  // The strike + ring land as the pan settles on the phrase. When there's no
  // pan (phrase already at the top) they fire early so the proof isn't held back.
  const hasPan = Math.abs(topPhrase - topTop) > 24;
  const arriveAt = hasPan ? PAN_HOLD + PAN_LEN - 8 : 6;
  const reveal = Math.max(0, Math.min(1, (frame - arriveAt) / 11));

  return (
    <AbsoluteFill style={{ overflow: "hidden", opacity, backgroundColor: "#0a0c12" }}>
      <div style={{ position: "absolute", left, top, width: imgW, height: imgH }}>
        <img
          src={staticFile(shot.image)}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
          style={{ width: imgW, height: imgH, display: "block" }}
        />
        <YellowHighlightLayer highlights={boxes} reveal={reveal} />
        {/* The strike-ring is a "gotcha" — only fire it where there's a phrase
            to strike. Our own pages (no highlights) reveal clean. */}
        {boxes.length > 0 && (
          <ShockwaveRing centerXPct={fx} centerYPct={fy} fireAt={arriveAt + 2} />
        )}
      </div>
      <SourcePill text={slot.source} opacity={opacity} />
    </AbsoluteFill>
  );
};

const SourcePill: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => (
  <div
    style={{
      position: "absolute",
      bottom: 54,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "12px 26px",
      borderRadius: 980,
      background: "rgba(10,12,18,0.82)",
      backdropFilter: "saturate(160%) blur(8px)",
      WebkitBackdropFilter: "saturate(160%) blur(8px)",
      fontFamily: '"SF Pro Text", Inter, "Helvetica Neue", sans-serif',
      fontSize: 24,
      letterSpacing: "0.04em",
      color: "rgba(255,255,255,0.94)",
      textTransform: "uppercase",
      opacity,
      whiteSpace: "nowrap",
    }}
  >
    {text}
  </div>
);

// ─── Shockwave ring ─────────────────────────────────────────────────────────

const ShockwaveRing: React.FC<{ centerXPct: number; centerYPct: number; fireAt: number }> = ({
  centerXPct,
  centerYPct,
  fireAt,
}) => {
  const frame = useCurrentFrame();
  const local = frame - fireAt;
  const duration = 12;
  if (local < 0 || local > duration) return null;
  const progress = interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const radius = progress * 700;
  const opacity = interpolate(local, [0, 2, duration], [0, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: `${centerXPct * 100}%`,
        top: `${centerYPct * 100}%`,
        width: radius * 2,
        height: radius * 2,
        borderRadius: "50%",
        border: `3px solid rgba(255,224,38,${opacity * 0.65})`,
        boxShadow: `0 0 30px rgba(255,224,38,${opacity * 0.35})`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 6,
      }}
    />
  );
};

// ─── Yellow highlighter — all phrases struck in yellow, reveal-wiped ─────────

const YellowHighlightLayer: React.FC<{ highlights: ArticleBox[]; reveal: number }> = ({
  highlights,
  reveal,
}) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    {highlights.map((h, idx) => {
      const stagger = idx * 0.12;
      const local = Math.max(0, Math.min(1, (reveal - stagger) / Math.max(0.01, 1 - stagger)));
      const overshootX = 0.006;
      const overshootW = 0.012;
      const padY = h.h * 0.24;
      const top = h.y - padY;
      const heightPct = h.h + padY * 2;
      const body: React.CSSProperties = {
        position: "absolute",
        left: `${(h.x - overshootX) * 100}%`,
        top: `${top * 100}%`,
        width: `${(h.w + overshootW) * local * 100}%`,
        height: `${heightPct * 100}%`,
        borderRadius: 3,
        transform: "skewX(-5deg) rotate(-0.8deg)",
        transformOrigin: "left center",
      };
      return (
        <React.Fragment key={idx}>
          <div
            style={{
              ...body,
              background:
                "linear-gradient(180deg, rgba(255,241,82,0.55) 0%, rgba(255,224,38,0.74) 50%, rgba(255,241,82,0.55) 100%)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            style={{
              ...body,
              background:
                "linear-gradient(180deg, rgba(255,241,82,0.45) 0%, rgba(255,224,38,0.55) 50%, rgba(255,241,82,0.45) 100%)",
              mixBlendMode: "screen",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${(h.x - overshootX * 0.6) * 100}%`,
              top: `${(h.y + h.h * 0.92) * 100}%`,
              width: `${(h.w + overshootW * 0.6) * local * 100}%`,
              height: `${Math.max(0.006, h.h * 0.2) * 100}%`,
              background: "#ff2b44",
              borderRadius: 2,
              transform: "skewX(-3deg) rotate(-0.4deg)",
              transformOrigin: "left center",
              boxShadow: "0 0 6px rgba(255,43,68,0.45)",
            }}
          />
        </React.Fragment>
      );
    })}
  </div>
);

export { ArticleFlash };
