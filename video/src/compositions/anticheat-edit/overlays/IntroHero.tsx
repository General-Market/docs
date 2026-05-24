// IntroHero — the behind/around beat on the intro line
// "…trading one billion of volume on perps, option, prediction markets, and
//  meme coins…".
//
// Two figures the viewer should SEE: the number stands behind the speaker, the
// products orbit around him. Built as the behind-subject sandwich, mounted
// ABOVE AntiCheatLayout and gated to this one window:
//
//   1. back   — the billion number + the ring's far-side cards
//   2. cutout — cutout-intro.mov (person alpha), carrying the SAME idle breath
//               as the base head, re-revealing the speaker in front of (1)
//   3. front  — the thumbs-up + the ring's near-side cards
//
// Times are final.mp4 seconds; the whole thing lives in HERO_FROM…+HERO_DUR.

import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { idleCamera } from "../AntiCheatLayout";
import { font } from "../../../common/fonts";
import { IntroCarousel, INTRO_CAROUSEL_DEFAULT } from "./IntroCarousel";

// 10.0s — also the cutout file's --start, so the OffthreadVideo's frame 0 maps
// to final 10.0s with no offset. Keep these locked together.
export const HERO_FROM = 300;
export const HERO_DUR = 168; // → 15.6s

// The billion glyph — giant, so it must be a few characters: "$1B" bleeds off
// the frame the way a hero word does, the room reading through the letters.
const BILLION_TEXT = "$1B";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Where the ring orbits — centred on the head/shoulders so cards are clipped by
// his silhouette as they sweep behind him.
const RING_CX = 0.5; // fraction of width
const RING_CY = 0.48; // fraction of height — at the head/neck

// The carousel starts a touch before the first product word and spirals in.
const CAROUSEL_START = 49; // heroLocal frame (~11.63s)
// Local-to-the-carousel frames where each product faces camera. The first
// doubles as the spiral length. perps 12.16 / options 12.72 / predictions
// 13.20 / meme 14.08 → heroLocal 65/82/96/122 → carouselLocal below.
const WORD_ANCHORS = [16, 33, 47, 73];
const EXPLODE_START = 88;
const EXPLODE_DUR = 22;
const CAROUSEL_END = CAROUSEL_START + EXPLODE_START + EXPLODE_DUR; // 159

export const IntroHero: React.FC = () => {
  const heroLocal = useCurrentFrame();
  const { fps } = useVideoConfig();
  const absSec = (HERO_FROM + heroLocal) / fps;

  // The cutout must ride the exact same breath as the base head beneath it.
  const cam = idleCamera(absSec, fps);
  const headTransform = `scale(${cam.scale}) translate(${cam.px * 100}%, ${cam.py * 100}%)`;

  // Everything in this window is a frame-exact PNG, so nothing can desync. The
  // base AntiCheatLayout video (OffthreadVideo) lags ~1 frame behind in the
  // Studio preview; a frame-exact cutout on top of it left the lagging base
  // person poking past the silhouette — a "double". The fix: cover the base with
  // our OWN room plate (the same frames, frame-locked), then layer graphics and
  // the cutout on top. Single source per pixel → no lag, no double, in preview
  // and render alike. heroLocal 0 maps to f_0001 (= final 10.0s).
  const frameIdx = Math.min(168, Math.max(1, heroLocal + 1));
  const pad = (n: number) => String(n).padStart(4, "0");
  const roomSrc = `anticheat-edit/room-frames/f_${pad(frameIdx)}.png`;
  const cutoutSrc = `anticheat-edit/cutout-frames/f_${pad(Math.min(210, frameIdx))}.png`;

  // ── Billion number — booms in on "billion" (heroLocal 31), holds, recedes ──
  const billPop = spring({
    frame: heroLocal - 18,
    fps,
    config: { damping: 15, mass: 0.8, stiffness: 120 },
    durationInFrames: 20,
  });
  const billScale = interpolate(billPop, [0, 1], [1.16, 1.0]);
  const billOpacity = Math.min(
    interpolate(heroLocal, [18, 27], [0, 1], clamp),
    interpolate(heroLocal, [50, 60], [1, 0], clamp), // cleared before the cards arrive
  );
  const billBlur = interpolate(billPop, [0, 1], [10, 0]);

  const showCarousel =
    heroLocal >= CAROUSEL_START && heroLocal < CAROUSEL_END;
  const carouselLocal = heroLocal - CAROUSEL_START;

  const ringWrap: React.CSSProperties = {
    position: "absolute",
    left: `${RING_CX * 100}%`,
    top: `${RING_CY * 100}%`,
    transform: "translate(-50%, -50%)",
  };

  return (
    <AbsoluteFill>
      {/* ── 0. ROOM PLATE — our own frame-locked copy of the room, covering the
             lagging base video so every visible pixel comes from an exact PNG.
             Carries the head's idle breath so it sits identically to the base. ── */}
      <Img
        src={staticFile(roomSrc)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: headTransform,
          transformOrigin: "center center",
        }}
      />

      {/* ── 1. BACK — billion number + far cards (behind the person) ── */}
      <AbsoluteFill>
        {billOpacity > 0 && (
          <BillionPlate
            text={BILLION_TEXT}
            opacity={billOpacity}
            scale={billScale}
            blur={billBlur}
          />
        )}
        {showCarousel && (
          <div style={ringWrap}>
            <IntroCarousel
              local={carouselLocal}
              wordAnchors={WORD_ANCHORS}
              explodeStart={EXPLODE_START}
              explodeDur={EXPLODE_DUR}
              half="back"
              config={INTRO_CAROUSEL_DEFAULT}
            />
          </div>
        )}
      </AbsoluteFill>

      {/* ── 2. CUTOUT — the speaker, re-revealed in front of the back layer ── */}
      <Img
        src={staticFile(cutoutSrc)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: headTransform,
          transformOrigin: "center center",
        }}
      />

      {/* ── 3. FRONT — near cards (in front of the person) ── */}
      <AbsoluteFill>
        {showCarousel && (
          <div style={ringWrap}>
            <IntroCarousel
              local={carouselLocal}
              wordAnchors={WORD_ANCHORS}
              explodeStart={EXPLODE_START}
              explodeDur={EXPLODE_DUR}
              half="front"
              config={INTRO_CAROUSEL_DEFAULT}
            />
          </div>
        )}
      </AbsoluteFill>

      {/* ── Sound — scoped one-shots from the local (Epidemic-sourced) library.
           Frames are heroLocal (this Sequence's own clock). ── */}
      <IntroHeroSfx />
    </AbsoluteFill>
  );
};

// Hero SFX — riser into the number, a deep slam under "billion", the ring's
// spiral whoosh, a snap on each product word, a swoosh on the explode. Cold and
// weighty, never coin-cartoon. `from` is in heroLocal frames.
type HeroHit = { from: number; file: string; gain: number; dur: number };
const HERO_SFX: HeroHit[] = [
  { from: 2, file: "sfx/riser-cinematic-build.mp3", gain: 0.3, dur: 1.4 },
  { from: 30, file: "sfx/drop-sub-impact.mp3", gain: 0.42, dur: 3 }, // billion
  { from: 30, file: "sfx/hit-deep-sub.mp3", gain: 0.3, dur: 2.4 },
  { from: 30, file: "sfx/money-jackpot.mp3", gain: 0.16, dur: 2 },
  { from: 49, file: "sfx/whoosh-spin-fast.mp3", gain: 0.3, dur: 1.2 }, // spiral
  { from: 65, file: "sfx/text-snap-in.mp3", gain: 0.22, dur: 0.6 }, // perps
  { from: 82, file: "sfx/text-snap-in.mp3", gain: 0.22, dur: 0.6 }, // options
  { from: 96, file: "sfx/text-snap-in.mp3", gain: 0.22, dur: 0.6 }, // predictions
  { from: 122, file: "sfx/text-snap-in.mp3", gain: 0.22, dur: 0.6 }, // meme coins
  { from: 137, file: "sfx/transition-swoosh.mp3", gain: 0.26, dur: 1 }, // explode
];

const IntroHeroSfx: React.FC = () => (
  <>
    {HERO_SFX.map((h, i) => {
      const dur = Math.max(1, Math.round(h.dur * 30));
      const fadeOut = Math.min(12, Math.round(dur * 0.3));
      return (
        <Sequence
          key={`${h.file}-${i}`}
          from={Math.max(0, h.from)}
          durationInFrames={dur}
          layout="none"
        >
          <Audio
            src={staticFile(h.file)}
            volume={(f) =>
              interpolate(
                f,
                [0, dur - fadeOut, dur],
                [h.gain, h.gain, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            }
          />
        </Sequence>
      );
    })}
  </>
);

// The hero glyph — colossal, bleeding off the frame, translucent Base blue so
// the room reads through the letters and the speaker stands small in front of
// it. The reference is a giant frosted title; on this cream wall a see-through
// blue tint carries it where frosted white would vanish.
const BillionPlate: React.FC<{
  text: string;
  opacity: number;
  scale: number;
  blur: number;
}> = ({ text, opacity, scale, blur }) => (
  <AbsoluteFill
    style={{
      alignItems: "center",
      justifyContent: "center",
      opacity,
    }}
  >
    <div
      style={{
        fontFamily: font,
        fontSize: 1300,
        fontWeight: 800,
        letterSpacing: "-0.05em",
        color: "rgba(0, 82, 255, 0.5)",
        lineHeight: 0.78,
        whiteSpace: "nowrap",
        transform: `scale(${scale.toFixed(4)})`,
        filter: blur > 0.1 ? `blur(${blur.toFixed(1)}px)` : undefined,
      }}
    >
      {text}
    </div>
  </AbsoluteFill>
);
