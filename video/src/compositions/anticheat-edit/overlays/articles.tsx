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

// Per-slug placement: the proof beat (final.mp4 seconds), hold, entry, zoom,
// and citation. Each beat sits inside the mechanism's spoken section and clear
// of that section's chart window, so the article and the chart never share the
// frame. zoom is tuned per shot — headline phrases read at ~2.8×, the page-wide
// "long list" stays wider.
const PLACEMENT: Record<
  string,
  { at: number; duration: number; treatment: Treatment; zoom: number; source: string }
> = {
  "vip-fee-tier": { at: 130, duration: 6, treatment: "punch", zoom: 2.8, source: "binance.com · spot trading fees" },
  "listing-frontrun": { at: 214.9, duration: 6, treatment: "whip", zoom: 2.8, source: "sec.gov · press-release 2022-127" },
  "order-flow-vis": { at: 255, duration: 6, treatment: "punch", zoom: 2.8, source: "sec.gov · press-release 2023-101" },
  pfof: { at: 308.6, duration: 6, treatment: "punch", zoom: 2.8, source: "sec.gov · press-release 2020-321" },
  "jito-mev": { at: 368, duration: 6, treatment: "whip", zoom: 2.8, source: "helius.dev · solana mev" },
  matching: { at: 388, duration: 6, treatment: "punch", zoom: 2.8, source: "developers.binance.com · amend-keep priority" },
  funding: { at: 451, duration: 5.5, treatment: "punch", zoom: 2.8, source: "hyperliquid · funding docs" },
  "maker-rebate": { at: 478, duration: 6, treatment: "punch", zoom: 2.6, source: "binance.com · spot LP program" },
  "adl-visibility": { at: 560, duration: 6, treatment: "whip", zoom: 2.8, source: "coindesk · hyperliquid delists JELLY" },
  // Wider — the whole list is the point, not one phrase.
  "long-list": { at: 736, duration: 6, treatment: "fullscreen", zoom: 1.5, source: "generalmarket.io/anticheat-flags" },
  polymarket: { at: 803.8, duration: 6.5, treatment: "fullscreen", zoom: 2.6, source: "cftc.gov · release 8478-22" },
};

export const ARTICLE_OVERLAYS: ArticleSlot[] = ARTICLE_SHOTS.flatMap((shot) => {
  const p = PLACEMENT[shot.slug];
  if (!p) return [];
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

  // Entry + a slow continuous push for life. Zoom eases from a touch tighter
  // (punch) or settles from the same (whip/fullscreen), then drifts up 4%.
  const entryZoom =
    treatment === "punch"
      ? interpolate(frame, [0, 7], [zoom * 1.12, zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, 8], [zoom * 1.05, zoom], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.04], { extrapolateRight: "clamp" });
  const Z = entryZoom * drift;

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
  // Centre the phrase, then clamp so the image always covers the frame — no
  // dark gap when the phrase sits near an edge. slideX rides on top for the
  // whip entry only.
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const left = clamp(W / 2 - fx * imgW, W - imgW, 0) + slideX;
  const top = clamp(H / 2 - fy * imgH, H - imgH, 0);
  const reveal = Math.max(0, Math.min(1, (frame - 6) / 9));

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
        <ShockwaveRing centerXPct={fx} centerYPct={fy} fireAt={treatment === "punch" ? 4 : 8} />
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
