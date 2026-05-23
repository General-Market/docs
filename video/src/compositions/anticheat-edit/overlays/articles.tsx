// Article-proof overlays for the AntiCheatEdit talk.
//
// At the "proof" beats — the moments Max gestures at the evidence rather than
// explaining a mechanism — the best-illustrating source article flashes in
// over the talking head, the venue name underlined in green and the damning
// phrase struck through in yellow. Same machinery as AntiCheatRigged: a pop
// entry, a highlight reveal, a shockwave off the name. The data charts own the
// explanation beats; these own the proof beats, so the two never collide.
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
import { CameraMotionBlur } from "@remotion/motion-blur";
import { ARTICLE_SHOTS, type ArticleBox, type ArticleShot } from "./article-shots";

type Treatment = "whip" | "punch" | "fullscreen";

export type ArticleSlot = {
  /** final.mp4 seconds. */
  at: number;
  /** seconds on screen. */
  duration: number;
  shot: ArticleShot;
  treatment: Treatment;
  /** Source URL, printed small under the card. */
  source: string;
};

// Per-slug placement: the proof beat (final.mp4 seconds), how long it holds,
// how it enters, and the citation printed beneath. Each beat sits inside the
// mechanism's spoken section and clear of that section's chart window, so the
// article and the chart never share the frame.
const PLACEMENT: Record<
  string,
  { at: number; duration: number; treatment: Treatment; source: string }
> = {
  // Fee-tier section (92.6–161.6s); chart at 106.3.
  "vip-fee-tier": { at: 130, duration: 6, treatment: "punch", source: "binance.com · spot trading fees" },
  // Listing front-running section (204.4–237.4s).
  "listing-frontrun": { at: 214.9, duration: 6, treatment: "whip", source: "sec.gov · press-release 2022-127" },
  // Dealer-flow section (237.4–290.4s); chart at 275.9.
  "order-flow-vis": { at: 255, duration: 6, treatment: "punch", source: "sec.gov · press-release 2023-101" },
  // Order-flow / PFOF section (290.4–320.8s).
  pfof: { at: 308.6, duration: 6, treatment: "punch", source: "sec.gov · press-release 2020-321" },
  // Matching & queue-priority section (354.9–398.1s) — MEV first, then amend-keep.
  "jito-mev": { at: 368, duration: 6, treatment: "whip", source: "github.com · pumpfun-bundler" },
  matching: { at: 388, duration: 6, treatment: "punch", source: "developers.binance.com · amend-keep priority" },
  // Funding-rate section (446.1–464.8s); chart at 460.2.
  funding: { at: 451, duration: 5.5, treatment: "punch", source: "hyperliquid · funding docs" },
  // MM-rebate section (464.8–537.8s); charts at 499.1, 516.8.
  "maker-rebate": { at: 478, duration: 6, treatment: "punch", source: "binance.com · spot LP program" },
  // Liquidation section (537.8s→end); chart at 619.6.
  "adl-visibility": { at: 560, duration: 6, treatment: "whip", source: "coindesk · hyperliquid delists JELLY" },
  // Closing proof beats: the long list, then the Polymarket concentration case.
  "long-list": { at: 736, duration: 6, treatment: "fullscreen", source: "generalmarket.io/anticheat-flags" },
  polymarket: { at: 803.8, duration: 6.5, treatment: "fullscreen", source: "cftc.gov · release 8478-22" },
};

export const ARTICLE_OVERLAYS: ArticleSlot[] = ARTICLE_SHOTS.flatMap((shot) => {
  const p = PLACEMENT[shot.slug];
  if (!p) return [];
  return [{ at: p.at, duration: p.duration, shot, treatment: p.treatment, source: p.source }];
}).sort((a, b) => a.at - b.at);

// ─── Card geometry ────────────────────────────────────────────────────────
// Capture is 1440×1120 (≈1.286:1). Card height fixed; width follows aspect.
const CARD_H = 880;

const cardChrome: React.CSSProperties = {
  position: "relative",
  background: "#ffffff",
  padding: 22,
  borderRadius: 14,
  boxShadow: "0 0 0 1px rgba(10,12,18,0.16), 0 28px 64px rgba(10,12,18,0.34)",
};

const sourceCaptionStyle: React.CSSProperties = {
  marginTop: 14,
  textAlign: "center",
  fontFamily: '"SF Pro Text", Inter, "Helvetica Neue", sans-serif',
  fontSize: 22,
  letterSpacing: "0.04em",
  color: "rgba(255,255,255,0.86)",
  textTransform: "uppercase",
};

// Does a highlight coincide with the name box? (avoid double-painting)
const sameBox = (a: ArticleBox, b?: ArticleBox) =>
  !!b && Math.abs(a.x - b.x) < 0.004 && Math.abs(a.y - b.y) < 0.004;

// ─── The article card (image + highlight layers) ───────────────────────────

const ArticleCard: React.FC<{ shot: ArticleShot; reveal: number }> = ({ shot, reveal }) => {
  const yellow = shot.highlights.filter((h) => !sameBox(h, shot.nameBox));
  return (
    // inline-block so the wrapper shrinks to the image's rendered width —
    // the highlight layers position in % of THIS box, so it must equal the
    // image or every box drifts sideways.
    <div style={{ position: "relative", display: "inline-block", lineHeight: 0 }}>
      <img
        src={staticFile(shot.image)}
        alt=""
        draggable={false}
        decoding="sync"
        loading="eager"
        style={{
          height: CARD_H,
          width: "auto",
          objectFit: "contain",
          display: "block",
          borderRadius: 4,
        }}
      />
      <YellowHighlightLayer highlights={yellow} reveal={reveal} />
      {shot.nameBox && <GreenUnderline box={shot.nameBox} reveal={reveal} />}
    </div>
  );
};

// ─── Treatments ─────────────────────────────────────────────────────────────

const ArticleFlash: React.FC<{ slot: ArticleSlot; durationInFrames: number }> = ({
  slot,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { shot, treatment, source } = slot;

  // Tail fade so the card leaves cleanly.
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (treatment === "fullscreen") {
    return <FullscreenFlash shot={shot} source={source} fadeOut={fadeOut} />;
  }
  if (treatment === "whip") {
    return <WhipFlash shot={shot} source={source} fadeOut={fadeOut} />;
  }
  return <PunchFlash shot={shot} source={source} fadeOut={fadeOut} />;
};

const cardWrap = (fadeOut: number): React.CSSProperties => ({
  position: "absolute",
  inset: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  opacity: fadeOut,
});

const nameCenter = (shot: ArticleShot) => {
  const b = shot.nameBox ?? shot.highlights[0];
  return b ? { cx: b.x + b.w / 2, cy: b.y + b.h / 2 } : { cx: 0.5, cy: 0.4 };
};

const PunchFlash: React.FC<{ shot: ArticleShot; source: string; fadeOut: number }> = ({
  shot,
  source,
  fadeOut,
}) => {
  const frame = useCurrentFrame();
  const punchT = Math.max(0, Math.min(1, frame / 4));
  const punchScale = interpolate(punchT, [0, 1], [1.05, 1]);
  const dolly = interpolate(frame, [4, 130], [1.0, 1.12], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(punchT, [0, 1], [0.3, 1]);
  const reveal = Math.max(0, Math.min(1, (frame - 6) / 8));
  const { cx, cy } = nameCenter(shot);
  return (
    <AbsoluteFill style={cardWrap(fadeOut)}>
      <div
        style={{
          ...cardChrome,
          transform: `rotate(-1deg) scale(${punchScale * dolly})`,
          transformOrigin: `${cx * 100}% ${cy * 100}%`,
          opacity,
        }}
      >
        <ArticleCard shot={shot} reveal={reveal} />
        <ShockwaveRing centerXPct={cx} centerYPct={cy} fireAt={4} />
      </div>
      <div style={{ ...sourceCaptionStyle, opacity }}>{source}</div>
    </AbsoluteFill>
  );
};

const WhipFlash: React.FC<{ shot: ArticleShot; source: string; fadeOut: number }> = ({
  shot,
  source,
  fadeOut,
}) => {
  const frame = useCurrentFrame();
  const whipT = Math.max(0, Math.min(1, frame / 8));
  const eased = 1 - Math.pow(1 - whipT, 3);
  const tx = (1 - eased) * -2200;
  const overshoot = interpolate(frame, [8, 11, 14], [60, -14, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cssBlur = interpolate(frame, [0, 6, 9], [10, 4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const dolly = interpolate(frame, [14, 130], [1.0, 1.1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const skew = frame < 8 ? -6 : 0;
  const rotate = frame < 8 ? 0 : -1.2;
  const reveal = Math.max(0, Math.min(1, (frame - 9) / 9));
  const { cx, cy } = nameCenter(shot);
  return (
    <AbsoluteFill style={cardWrap(fadeOut)}>
      <CameraMotionBlur shutterAngle={150} samples={2}>
        <div
          style={{
            ...cardChrome,
            transform: `translateX(${tx + overshoot}px) skewX(${skew}deg) rotate(${rotate}deg) scale(${dolly})`,
            transformOrigin: `${cx * 100}% ${cy * 100}%`,
            opacity,
            filter: `blur(${cssBlur}px)`,
          }}
        >
          <ArticleCard shot={shot} reveal={reveal} />
          <ShockwaveRing centerXPct={cx} centerYPct={cy} fireAt={9} />
        </div>
      </CameraMotionBlur>
      <div style={{ ...sourceCaptionStyle, opacity }}>{source}</div>
    </AbsoluteFill>
  );
};

const FullscreenFlash: React.FC<{ shot: ArticleShot; source: string; fadeOut: number }> = ({
  shot,
  source,
  fadeOut,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 10, 160], [1.1, 1.02, 1.14], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reveal = Math.max(0, Math.min(1, (frame - 5) / 10));
  const { cx, cy } = nameCenter(shot);
  return (
    <AbsoluteFill
      style={{
        background: "#0a0c12",
        overflow: "hidden",
        opacity: Math.min(opacity, fadeOut),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 1500,
          transform: `scale(${scale})`,
          transformOrigin: `${cx * 100}% ${cy * 100}%`,
        }}
      >
        <img
          src={staticFile(shot.image)}
          alt=""
          draggable={false}
          decoding="sync"
          loading="eager"
          style={{ width: "100%", height: "auto", display: "block", borderRadius: 6 }}
        />
        <YellowHighlightLayer
          highlights={shot.highlights.filter((h) => !sameBox(h, shot.nameBox))}
          reveal={reveal}
        />
        {shot.nameBox && <GreenUnderline box={shot.nameBox} reveal={reveal} />}
        <ShockwaveRing centerXPct={cx} centerYPct={cy} fireAt={5} />
      </div>
      <div style={{ ...sourceCaptionStyle, opacity }}>{source}</div>
    </AbsoluteFill>
  );
};

// ─── Shockwave ring (port of AntiCheatRigged) ───────────────────────────────

const ShockwaveRing: React.FC<{
  centerXPct: number;
  centerYPct: number;
  fireAt: number;
}> = ({ centerXPct, centerYPct, fireAt }) => {
  const frame = useCurrentFrame();
  const local = frame - fireAt;
  const duration = 12;
  if (local < 0 || local > duration) return null;
  const progress = interpolate(local, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const radius = progress * 900;
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
        border: `3px solid rgba(255,255,255,${opacity * 0.6})`,
        boxShadow: `0 0 30px rgba(255,255,255,${opacity * 0.3})`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 6,
      }}
    />
  );
};

// ─── Green name underline (marker stroke, reveal-wiped) ─────────────────────

const GreenUnderline: React.FC<{ box: ArticleBox; reveal: number }> = ({ box, reveal }) => {
  const local = Math.max(0, Math.min(1, reveal));
  const overshootX = 0.006;
  const overshootW = 0.012;
  const padY = box.h * 0.22;
  const top = box.y - padY;
  const heightPct = box.h + padY * 2;
  const common: React.CSSProperties = {
    position: "absolute",
    left: `${(box.x - overshootX) * 100}%`,
    top: `${top * 100}%`,
    width: `${(box.w + overshootW) * local * 100}%`,
    height: `${heightPct * 100}%`,
    borderRadius: 3,
    transform: "skewX(-5deg) rotate(-0.8deg)",
    transformOrigin: "left center",
    pointerEvents: "none",
  };
  return (
    <>
      <div
        style={{
          ...common,
          background:
            "linear-gradient(180deg, rgba(82,255,162,0.55) 0%, rgba(34,217,122,0.74) 50%, rgba(82,255,162,0.55) 100%)",
          mixBlendMode: "multiply",
        }}
      />
      <div
        style={{
          ...common,
          background:
            "linear-gradient(180deg, rgba(82,255,162,0.45) 0%, rgba(34,217,122,0.55) 50%, rgba(82,255,162,0.45) 100%)",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
};

// ─── Yellow highlighter (port of AntiCheatRigged) ───────────────────────────

const YellowHighlightLayer: React.FC<{ highlights: ArticleBox[]; reveal: number }> = ({
  highlights,
  reveal,
}) => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
    {highlights.map((h, idx) => {
      const stagger = idx * 0.14;
      const local = Math.max(
        0,
        Math.min(1, (reveal - stagger) / Math.max(0.01, 1 - stagger)),
      );
      const overshootX = 0.006;
      const overshootW = 0.012;
      const padY = h.h * 0.22;
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
                "linear-gradient(180deg, rgba(255,241,82,0.55) 0%, rgba(255,224,38,0.72) 50%, rgba(255,241,82,0.55) 100%)",
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
              height: `${Math.max(0.006, h.h * 0.22) * 100}%`,
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
