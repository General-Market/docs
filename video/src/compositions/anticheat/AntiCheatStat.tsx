import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { font, monoFont } from "../../common/fonts";
import { FPS, H, W, colors, toFrames } from "./theme";
import { DotGrid, DotGridVignette } from "./DotGrid";
import { IdleZoom } from "./vibe";
import { VIDEO_BEATS } from "./beats";

const { fontFamily: caveatFont } = loadCaveat("normal", {
  subsets: ["latin"],
  weights: ["700"],
});

// Two compositions live in this file:
//   AntiCheatStat — scapegoat lineup → 0.01%/70% then hard-cut to 99.9%/30%
//   AntiCheatBars — the carousel of categories
// The Stat scene opens on a four-card lineup. Each suspect wipes in
// from a vertical line one at a time, with a clear beat between cards
// so the eye registers each face. Once all four are present, the row
// holds, then wipes back to lines in the same staggered direction.
// Same wipe vocabulary as the EmberTypewriter flip in the stat itself.
//
// First card delayed past the Rigged→Stat snap-zoom-intense transition
// (16f) so the entries aren't eaten by the blur peak.
const SG_FIRST_CARD_AT = 14;
const SG_CARD_STAGGER = 18;
const SG_CARD_ENTER = 6;
const SG_HOLD_FRAMES = 28;
const SG_CARD_EXIT = 5;
const SG_EXIT_STAGGER = 3;
const SCAPEGOATS_COUNT = 4;
const SG_LAST_IN_AT =
  SG_FIRST_CARD_AT + (SCAPEGOATS_COUNT - 1) * SG_CARD_STAGGER + SG_CARD_ENTER;
const SG_EXIT_AT = SG_LAST_IN_AT + SG_HOLD_FRAMES;
const SG_LAST_OUT_AT =
  SG_EXIT_AT + (SCAPEGOATS_COUNT - 1) * SG_EXIT_STAGGER + SG_CARD_EXIT;
const SG_OUTRO = 2;
const SCAPEGOATS_FRAMES = SG_LAST_OUT_AT + SG_OUTRO;
const STAT_BEAT_FRAMES = 145;
const STAT_FRAMES = SCAPEGOATS_FRAMES + STAT_BEAT_FRAMES;
const BARS_FRAMES = 129;
// Hard-cut flip from 0.01%/take/70% to 99.9%/get/30% on the second beat
// of the stat section (scene-local frame SCAPEGOATS_FRAMES + 56).
const STAT_FLIP_AT = 56;

export const AntiCheatStat: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={STAT_FRAMES} from={1} to={1.04}>
        <DotGrid />
        <ScapegoatLineup />
        <Sequence from={SCAPEGOATS_FRAMES}>
          <StatPanel />
          <StatAnnotations />
          <StatFootnote />
        </Sequence>
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Scapegoat lineup — who to blame, before the stat says otherwise ─────
//
// Four wanted-poster cards lined up across the frame. Each suspect is
// either personally convicted of finance crimes or runs a firm that
// has been formally sanctioned for the relevant practice. Justin Sun
// (SEC charges 2023 for market manipulation of TRX/BTT including wash
// trading, settled 2024), Ken Griffin (Citadel — repeated SEC/FINRA
// settlements over order handling and front-running of retail flow),
// Jamie Dimon (JPMorgan — $920M DOJ + CFTC + SEC settlement for
// orderbook spoofing across precious metals and Treasuries),
// Martha Stewart (convicted 2004 in the ImClone insider-trading
// affair). Same scapegoat mechanism, four different sanctions.
//
// Attribution lives in anticheat-imgs/CREDITS.md.

type Scapegoat = {
  label: [string, string];
  charge: string;
  imageSrc: string;
  imagePosition?: string;
};

const SCAPEGOATS: Scapegoat[] = [
  {
    label: ["liquidation", "hunters"],
    charge: "triggers your stops",
    imageSrc: "anticheat-imgs/scapegoat-sun.jpg",
    imagePosition: "center 18%",
  },
  {
    label: ["front", "runners"],
    charge: "moves before you",
    imageSrc: "anticheat-imgs/scapegoat-griffin.jpg",
    imagePosition: "center 18%",
  },
  {
    label: ["orderbook", "spoofers"],
    charge: "fakes the signal",
    imageSrc: "anticheat-imgs/scapegoat-dimon.jpg",
    imagePosition: "center 22%",
  },
  {
    label: ["insider", "traders"],
    charge: "knows the news first",
    imageSrc: "anticheat-imgs/scapegoat-stewart.jpg",
    imagePosition: "center 22%",
  },
];

const SCAPEGOAT_HEADLINE = "Who to blame";

// Background giant word vocabulary — one verb per scapegoat, shown
// behind everything in the lower tier of the frame as the Bars-scene
// BackgroundWord vocabulary (SF Pro Display 900, accent blue, ~10%).
const SG_MARQUEE_TEXTS: readonly string[] = [
  "liquidated",
  "front-run",
  "spoofed",
  "leaked",
];

// Card geometry — four-up row, sized to fit inside the 1920-wide
// frame with healthy gaps. Tile sized to match the Bars carousel
// card vocabulary so the visual rhyme holds. The background marquee
// lives at scene level (ScapegoatBackgroundMarquee), independent of
// the card grid — the cards just sit on top.
const SG_CARD_W = 340;
const SG_CARD_H = 460;
const SG_CARD_GAP = 60;
const SG_GRID_W = SCAPEGOATS_COUNT * SG_CARD_W +
  (SCAPEGOATS_COUNT - 1) * SG_CARD_GAP;
const SG_GRID_LEFT = (W - SG_GRID_W) / 2;
// Centred vertically under the headline (which sits at y≈156 and ends
// near y≈288). 360 keeps the original card position, with bands
// flowing above the headline and below the cards.
const SG_GRID_TOP = 360;

const expoOutEase = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * Math.max(0, Math.min(1, t)));

const ScapegoatLineup: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame >= SCAPEGOATS_FRAMES) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Background giant word — Bars-scene vocabulary, lower tier.
          One verb at a time, tied to whichever scapegoat is current. */}
      <ScapegoatBackgroundWord frame={frame} />
      <ScapegoatHeadline frame={frame} />
      <div
        style={{
          position: "absolute",
          left: SG_GRID_LEFT,
          top: SG_GRID_TOP,
          width: SG_GRID_W,
          height: SG_CARD_H,
          display: "flex",
          gap: SG_CARD_GAP,
          alignItems: "center",
        }}
      >
        {SCAPEGOATS.map((s, i) => (
          <ScapegoatColumn
            key={s.label.join("-")}
            scapegoat={s}
            index={i}
            frame={frame}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// Background giant word — same vocabulary as the Bars scene's
// BackgroundWord: SF Pro Display 900, accent blue, ~10% opacity,
// letter-spacing −0.05em. One word at a time, the verb tied to the
// card that's currently the focal point. Sits in the LOWER TIER of
// the frame (y≈82%) so the cards keep the middle.
const SG_BG_WORD_PEAK_OPACITY = 0.12;
const SG_BG_WORD_CENTER_Y_PCT = 0.82;
const SG_BG_WORD_FADE = 8; // crossfade between verbs, in frames

const ScapegoatBackgroundWord: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {SCAPEGOATS.map((_, i) => {
        const verb = SG_MARQUEE_TEXTS[i];
        const enterStart = SG_FIRST_CARD_AT + i * SG_CARD_STAGGER;
        const nextEnterStart =
          i < SCAPEGOATS.length - 1
            ? SG_FIRST_CARD_AT + (i + 1) * SG_CARD_STAGGER
            : SG_EXIT_AT + i * SG_EXIT_STAGGER + SG_CARD_EXIT;

        // Fade in when this card enters, fade out when the next one
        // enters (or when the last one starts exiting).
        const op = interpolate(
          frame,
          [
            enterStart,
            enterStart + SG_BG_WORD_FADE,
            nextEnterStart - SG_BG_WORD_FADE,
            nextEnterStart,
          ],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        if (op < 0.005) return null;

        return (
          <div
            key={verb}
            style={{
              position: "absolute",
              left: "50%",
              top: `${(SG_BG_WORD_CENTER_Y_PCT * 100).toFixed(2)}%`,
              transform: "translate(-50%, -50%)",
              fontFamily: font,
              fontSize: fitBgWordFontSize(verb),
              fontWeight: 900,
              letterSpacing: "-0.05em",
              color: colors.accent,
              opacity: op * SG_BG_WORD_PEAK_OPACITY,
              whiteSpace: "nowrap",
              lineHeight: 1,
              willChange: "opacity",
            }}
          >
            {verb}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const ScapegoatHeadline: React.FC<{ frame: number }> = ({ frame }) => {
  // Headline fades in fast under the first card and rides the whole
  // slot. No exit lift — the stat scene's snap-zoom-out handles departure.
  const enterT = Math.max(0, Math.min(1, frame / 6));
  const eased = expoOutEase(enterT);
  const y = (1 - eased) * 18;
  const blur = (1 - eased) * 6;
  const exitT = Math.max(
    0,
    Math.min(1, (frame - (SCAPEGOATS_FRAMES - 6)) / 5),
  );
  const exitFade = 1 - exitT;

  return (
    <div
      style={{
        position: "absolute",
        top: 156,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 132,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: colors.fg,
        lineHeight: 1.0,
        opacity: eased * exitFade,
        transform: `translateY(${y.toFixed(2)}px)`,
        filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
      }}
    >
      {SCAPEGOAT_HEADLINE}
    </div>
  );
};

// One piece. Full-bleed Girardian image fills the card; a dark
// gradient veil rises from the bottom and the typography sits inside
// the same surface. Top and bottom marquee bands carry the crime in
// verb form, scrolling in a direction picked per card (1→right, 2→left,
// 3→left, 4→right). The column — bands + body — fades in together
// with a soft scale + drift + blur. No scaleX wipe; the motion now
// settles like a wave instead of snapping like a typewriter.

// Smooth in/out for the whole column: scale 0.92→1, translateY 22→0,
// opacity 0→1, blur 8→0. Easing tuned so the card glides in and pulls
// out without the scaleX squeeze that used to look like a glitch.
type ColumnAnim = {
  opacity: number;
  scale: number;
  translateY: number;
  blur: number;
};

const computeColumnAnim = (
  frame: number,
  enterStart: number,
  exitStart: number,
): ColumnAnim | null => {
  if (frame < enterStart) return null;
  if (frame < enterStart + SG_CARD_ENTER) {
    const t = (frame - enterStart) / SG_CARD_ENTER;
    const eased = expoOutEase(t);
    return {
      opacity: Math.min(1, t * 1.6),
      scale: 0.92 + 0.08 * eased,
      translateY: (1 - eased) * 22,
      blur: (1 - eased) * 8,
    };
  }
  if (frame < exitStart) {
    return { opacity: 1, scale: 1, translateY: 0, blur: 0 };
  }
  if (frame < exitStart + SG_CARD_EXIT) {
    const t = (frame - exitStart) / SG_CARD_EXIT;
    // smootherStep — symmetric ease-in-out, no jolt at start or end
    const eased = t * t * t * (t * (t * 6 - 15) + 10);
    return {
      opacity: 1 - eased,
      scale: 1 - 0.04 * eased,
      translateY: -eased * 14,
      blur: eased * 6,
    };
  }
  return null;
};

const ScapegoatColumn: React.FC<{
  scapegoat: Scapegoat;
  index: number;
  frame: number;
}> = ({ scapegoat, index, frame }) => {
  const enterStart = SG_FIRST_CARD_AT + index * SG_CARD_STAGGER;
  const exitStart = SG_EXIT_AT + index * SG_EXIT_STAGGER;
  const anim = computeColumnAnim(frame, enterStart, exitStart);
  if (!anim || anim.opacity <= 0.001) return null;

  return (
    <div
      style={{
        flex: "0 0 auto",
        position: "relative",
        width: SG_CARD_W,
        height: SG_CARD_H,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: anim.opacity,
        transform: `translateY(${anim.translateY.toFixed(2)}px) scale(${anim.scale.toFixed(3)})`,
        transformOrigin: "center center",
        filter: anim.blur > 0.05 ? `blur(${anim.blur.toFixed(2)}px)` : undefined,
        willChange: "transform, opacity, filter",
      }}
    >
      {/* Foreground card body — opaque, floats over the full-frame
          background marquee that lives in ScapegoatBackgroundMarquee. */}
      <ScapegoatCardBody scapegoat={scapegoat} index={index} />
    </div>
  );
};


const ScapegoatCardBody: React.FC<{
  scapegoat: Scapegoat;
  index: number;
}> = ({ scapegoat, index }) => {
  const bookingNumber = `#${String(index + 1).padStart(2, "0")}`;

  return (
    <div
      style={{
        width: SG_CARD_W,
        height: SG_CARD_H,
        borderRadius: 18,
        background: "#0A0A0A",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.06) inset, 0 32px 64px rgba(8, 14, 28, 0.30), 0 10px 20px rgba(8, 14, 28, 0.18)",
        border: "1px solid rgba(8, 14, 28, 0.55)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Full-bleed mug-shot image. Raw <img> on purpose — Remotion's
          <Img> suspends the entire preview while it loads, blanking the
          studio. Images are prefetched on mount so the file is warm by
          the time the card scales in. */}
      <img
        src={staticFile(scapegoat.imageSrc)}
        alt=""
        draggable={false}
        decoding="sync"
        loading="eager"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: scapegoat.imagePosition ?? "center",
          display: "block",
          // Bleach the colour out so the four periods sit on the same
          // tonal axis — antique paint and engraved line read as one
          // family instead of four loose scraps.
          filter: "grayscale(0.55) sepia(0.18) contrast(1.06) brightness(0.92)",
        }}
      />

      {/* Veil — bottom gradient holds the booking text in one frame. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(8, 14, 28, 0.55) 0%, rgba(8, 14, 28, 0.05) 18%, rgba(8, 14, 28, 0.05) 42%, rgba(8, 14, 28, 0.78) 78%, rgba(8, 14, 28, 0.94) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Booking number sticker — top-left, painted onto the same surface. */}
      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          padding: "5px 11px",
          background: "rgba(255, 255, 255, 0.92)",
          color: "#0A0A0A",
          fontFamily: monoFont,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          borderRadius: 4,
        }}
      >
        {bookingNumber} · suspect
      </div>

      {/* Suspect name + charge — overlaid on the veil. */}
      <div
        style={{
          position: "absolute",
          left: 24,
          right: 24,
          bottom: 26,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 42,
            fontWeight: 800,
            letterSpacing: "-0.022em",
            color: "#FFFFFF",
            lineHeight: 0.98,
            textShadow: "0 2px 12px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div>{scapegoat.label[0]}</div>
          <div style={{ color: "#FFFFFF" }}>{scapegoat.label[1]}</div>
        </div>
        <div
          style={{
            fontFamily: monoFont,
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.78)",
            lineHeight: 1.3,
            textShadow: "0 1px 6px rgba(0, 0, 0, 0.55)",
          }}
        >
          {scapegoat.charge}
        </div>
      </div>
    </div>
  );
};

// Hand-drawn arrows annotating the two phases of StatPanel.
//   "Not You" → swoops up from below to point at "0.04%" (Phase 1).
//                Appears at scene-local frame 13 (= 18s absolute,
//                Stat starts at frame 527). Holds until the wipe at 50.
//   "You"     → swoops down from above to point at "99.96%" (Phase 2).
//                Appears at scene-local frame 73 (= 20s absolute) and
//                holds through the snap-zoom-out.
//
// Each annotation paints itself on in a fast cascade: body curve strokes
// on first, then the two arrowhead wings stroke on with a one-frame
// stagger, then the Caveat label wipes in left-to-right like
// handwriting. ~16 frames end-to-end (≈ 0.5s).
const StatAnnotations: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1 — "Not You"
  const NY_APPEAR = 13;
  const NY_BODY_END = 21;
  const NY_WING1_START = 19;
  const NY_WING1_END = 22;
  const NY_WING2_START = 21;
  const NY_WING2_END = 24;
  const NY_LABEL_START = 24;
  const NY_LABEL_END = 30;
  const NY_FADE_OUT = 50;

  const notYouFade = interpolate(
    frame,
    [NY_FADE_OUT - 4, NY_FADE_OUT],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notYouBodyDraw = interpolate(
    frame,
    [NY_APPEAR, NY_BODY_END],
    [800, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notYouWing1 = interpolate(
    frame,
    [NY_WING1_START, NY_WING1_END],
    [50, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notYouWing2 = interpolate(
    frame,
    [NY_WING2_START, NY_WING2_END],
    [50, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const notYouLabelClip = interpolate(
    frame,
    [NY_LABEL_START, NY_LABEL_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Phase 2 — "You"
  const Y_APPEAR = 73;
  const Y_BODY_END = 81;
  const Y_WING1_START = 79;
  const Y_WING1_END = 82;
  const Y_WING2_START = 81;
  const Y_WING2_END = 84;
  const Y_LABEL_START = 84;
  const Y_LABEL_END = 90;

  const youBodyDraw = interpolate(
    frame,
    [Y_APPEAR, Y_BODY_END],
    [800, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const youWing1 = interpolate(
    frame,
    [Y_WING1_START, Y_WING1_END],
    [50, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const youWing2 = interpolate(
    frame,
    [Y_WING2_START, Y_WING2_END],
    [50, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const youLabelClip = interpolate(
    frame,
    [Y_LABEL_START, Y_LABEL_END],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const ink = colors.accent;
  const stroke = 7;
  const wingDash = 50;
  const showNotYou = frame >= NY_APPEAR && frame <= NY_FADE_OUT;
  const showYou = frame >= Y_APPEAR;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <clipPath id="ny-label-clip" clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width={notYouLabelClip} height="1" />
          </clipPath>
          <clipPath id="y-label-clip" clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width={youLabelClip} height="1" />
          </clipPath>
        </defs>

        {/* "Not You" — sweeps up from lower-right to point at 0.04% */}
        {showNotYou && (
          <g opacity={notYouFade}>
            <path
              d="M 600 800 C 545 760 505 705 470 660 C 450 638 435 622 420 608"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={800}
              strokeDashoffset={notYouBodyDraw}
            />
            <path
              d="M 420 608 L 451 622"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={wingDash}
              strokeDashoffset={notYouWing1}
            />
            <path
              d="M 420 608 L 432 640"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={wingDash}
              strokeDashoffset={notYouWing2}
            />
            <g transform="rotate(-3 520 855)">
              <text
                x={520}
                y={870}
                clipPath="url(#ny-label-clip)"
                fontFamily={caveatFont}
                fontSize={104}
                fontWeight={700}
                fill={ink}
              >
                Them
              </text>
            </g>
          </g>
        )}

        {/* "You" — sweeps down from upper-right to point at 99.96% */}
        {showYou && (
          <g>
            <path
              d="M 620 290 C 555 330 510 375 470 420 C 450 442 438 460 430 478"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={800}
              strokeDashoffset={youBodyDraw}
            />
            <path
              d="M 430 478 L 462 462"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={wingDash}
              strokeDashoffset={youWing1}
            />
            <path
              d="M 430 478 L 442 446"
              stroke={ink}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={wingDash}
              strokeDashoffset={youWing2}
            />
            <g transform="rotate(-3 560 230)">
              <text
                x={560}
                y={245}
                clipPath="url(#y-label-clip)"
                fontFamily={caveatFont}
                fontSize={120}
                fontWeight={700}
                fill={ink}
              >
                You
              </text>
            </g>
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};

// Polymarket profit-distribution citation. Fades in early and holds — the
// asterisks on both phases of the typewriter point here.
const StatFootnote: React.FC = () => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [10, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [10, 28], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: font,
        fontSize: 18,
        fontWeight: 400,
        letterSpacing: "-0.005em",
        color: colors.dim,
        lineHeight: 1.35,
        maxWidth: 1320,
        margin: "0 auto",
        opacity: op,
        transform: `translateY(${y.toFixed(2)}px)`,
      }}
    >
      *Polymarket trader profit distribution, 2024. Top 0.04% captured ~$3.7B in profits while 70% of traders lost money. Sources: CryptoNews, Yellow.com, Yahoo Finance.
    </div>
  );
};

export const AntiCheatBars: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg, fontFamily: font }}>
      <IdleZoom durationInFrames={BARS_FRAMES} from={1} to={1.025}>
        <DotGrid />
        <ExtractionBars />
        <DotGridVignette intensity={0.22} />
      </IdleZoom>
    </AbsoluteFill>
  );
};

// ─── Stat panel: Ember-style typewriter, two phases ──────────────────────────
// Phase 1 (0–50)  types "0.01% take 70%", wipes out before the flip.
// Phase 2 (51+)   types "99.9% get 30%" on beat 2 and holds to the
//                 snap-zoom-out at the scene tail.

const ROSE = [254, 186, 189] as const;

const easeIn = (t: number, power: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), power);

const EmberTypewriter: React.FC<{
  text: string;
  typeStart: number;
  typeEnd: number;
  wipeStart?: number;
  wipeEnd?: number;
  fontSize?: number;
  endColor?: string;
  typePower?: number;
  align?: "center" | "bottom-right";
}> = ({
  text,
  typeStart,
  typeEnd,
  wipeStart,
  wipeEnd,
  fontSize = 168,
  endColor = colors.fg,
  typePower = 2.8,
  align = "center",
}) => {
  const frame = useCurrentFrame();
  const len = text.length;
  const hasWipe = wipeStart !== undefined && wipeEnd !== undefined;
  const wipeS = wipeStart ?? typeEnd + 1;
  const wipeE = wipeEnd ?? wipeS + 1;

  if (frame < typeStart || (hasWipe && frame > wipeE)) return null;

  let visibleStart = 0;
  let visibleEnd = 0;
  let phase: "typing" | "hold" | "wiping" = "hold";

  if (frame < typeEnd) {
    phase = "typing";
    const t = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
    visibleEnd = Math.min(len, Math.max(1, Math.round(len * easeIn(t, typePower))));
  } else if (!hasWipe || frame < wipeS) {
    phase = "hold";
    visibleEnd = len;
  } else {
    phase = "wiping";
    const t = (frame - wipeS) / Math.max(1, wipeE - wipeS);
    const removed = Math.min(len, Math.round(len * easeIn(t, 2)));
    visibleStart = removed;
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  const containerStyle: React.CSSProperties =
    align === "bottom-right"
      ? {
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          padding: "0 120px 110px 0",
        }
      : { display: "flex", justifyContent: "center", alignItems: "center" };

  return (
    <AbsoluteFill style={containerStyle}>
      <div
        style={{
          fontFamily: font,
          fontSize,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          whiteSpace: "nowrap",
          color: endColor,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;

          if (phase === "typing") {
            const currentT = (frame - typeStart) / Math.max(1, typeEnd - typeStart);
            const charThreshold = i / len;
            const age =
              (easeIn(currentT, typePower) - charThreshold) *
              Math.max(1, typeEnd - typeStart);
            const colorT = interpolate(age, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const r = Math.round(interpolate(colorT, [0, 1], [ROSE[0], 10]));
            const g = Math.round(interpolate(colorT, [0, 1], [ROSE[1], 10]));
            const b = Math.round(interpolate(colorT, [0, 1], [ROSE[2], 12]));
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
                {display}
              </span>
            );
          }

          if (phase === "wiping") {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 2], [0.18, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const display = ch === " " ? " " : ch;
            return (
              <span key={i} style={{ color: endColor, opacity: op }}>
                {display}
              </span>
            );
          }

          const display = ch === " " ? " " : ch;
          return (
            <span key={i} style={{ color: endColor }}>
              {display}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const StatPanel: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* Phase 1 — types in by beat 1, wipes out into the flip */}
      <EmberTypewriter
        text="0.04% rig the table take 70%*"
        typeStart={0}
        typeEnd={28}
        wipeStart={STAT_FLIP_AT - 6}
        wipeEnd={STAT_FLIP_AT}
        fontSize={120}
        endColor={colors.fg}
      />

      {/* Phase 2 — flips on beat 2, types in by beat 3, holds to snap-zoom */}
      <EmberTypewriter
        text="99.96% battle royale for 30%*"
        typeStart={STAT_FLIP_AT}
        typeEnd={STAT_FLIP_AT + 28}
        fontSize={120}
        endColor={colors.fg}
      />
    </AbsoluteFill>
  );
};

// ─── Extraction bars (retired) — data inherited by the carousel cards ────────
//
// The horizontal bar chart used to live here. We dropped it; the same
// percentages now live on the carousel cards (see CATEGORIES below).
// REVEAL_AT used to give a 0.4s beat before the carousel appeared. Set to
// 0 so frame 0 is already in action — no blank intro.
const REVEAL_AT = 0;

// Flanking hero words. "Extracted" sits on the left of the ring,
// "From You" on the right; together with the rotating cards they read
// as a single sentence: EXTRACTED [cards] FROM YOU.

// Flanking hero word entrance — slide-in + char cascade
const SIDE_WORD_ENTER_STAGGER = toFrames(0.045);
const SIDE_WORD_ENTER_FADE = toFrames(0.45);
const SIDE_WORD_LEFT_DELAY = toFrames(0.0);
const SIDE_WORD_RIGHT_DELAY = toFrames(0.18);

// 3D rotating ring of category cards — Carousel3D ported, Apple-light.
// Each card carries the bar-chart datum it replaces: category name + the
// % extracted by unfair trading. White surface, near-black type, accent
// blue %, soft drop shadow. Same data as the old bar chart, prouder form.
type Category = { label: string; pct: number };
const CATEGORIES: Category[] = [
  { label: "perps", pct: 80 },
  { label: "options", pct: 90 },
  { label: "predictions", pct: 71 },
  { label: "launchpads", pct: 87 },
];

// Carousel3D ported (WebGLPicks 5:30 Paris scene). Four cards on a 3D
// ring. Each card carries TWO faces — front + back at rotateY(180°),
// both rendering the same content — so the rotation never hides a
// datum. backfaceVisibility hides the inert side of each face; the
// double-render keeps every category readable from any angle.
const CARD_W = 380;
const CARD_H = 500;
const CAROUSEL_W = 400;
const CAROUSEL_H = 540;
const CAROUSEL_RADIUS = 540;
const CAROUSEL_PERSPECTIVE = 1100;

// Phases — Carousel3D Paris timing, scaled to fit our budget.
//   Spiral-in       — rotateY -720→0, Z -1500→-540, expoOut
//   Scroll          — rotateY 0→-180, ring rotateX/Z tilt ±3°,
//                     card rotateZ 10→-10, brightness 200→100
//   Hold            — beat
//   Explode         — rotateX 0→90, rotateY adds -360, Z plunges -1800
//                     then surges +1500, rotateZ +270, opacity past 0.8
const CAROUSEL_SPIRAL_IN = toFrames(0.55);
const CAROUSEL_SCROLL = toFrames(1.95);
const CAROUSEL_EXPLODE = toFrames(0.95);
const CAROUSEL_ENTRY_FULL = CAROUSEL_SPIRAL_IN + CAROUSEL_SCROLL;
// Hold derived so explode ends on the hard cut to Rigged.
const CAROUSEL_HOLD = BARS_FRAMES - REVEAL_AT - CAROUSEL_ENTRY_FULL - CAROUSEL_EXPLODE;

// Hold the headline alongside the carousel hold; the explode begins after.
const TOUCHED_EXIT_AT = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;

// Per-letter wave-out for the headline — TextTrail hide() pattern. The
// letters drift outward from center while the carousel explodes.
const LETTER_EXIT_STAGGER = 1.4;
const LETTER_EXIT_FADE = toFrames(0.34);
const LETTER_EXIT_DRIFT = 22;

// Below-carousel headline. Words enter staggered, exit on the wave.
const TOUCHED_WORDS = ["on", "every", "markets", "you", "trade"];
const TOUCHED_WORD_STAGGER = toFrames(0.07);
const TOUCHED_WORD_FADE = toFrames(0.28);

const expoOut = (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));
const expoIn = (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10));
const power2InOut = (t: number): number =>
  t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const sineInOut = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2;

// ─── Music-driven angular modulation ────────────────────────────────────────
// One card-face per music beat. Each segment between two real beats in
// VIDEO_BEATS rotates the ring exactly −90° — the next card snaps to face
// the viewer on every kick. Within a segment the speed is modulated:
// frozen on the beat (slowest), peak in the middle. Position is the
// closed-form integral of ω(t) = ω̄·(1 − A·cos 2π t/N) so the segment
// always lands cleanly on −90° regardless of segment length variance.
//
// Bars opens at absolute video frame 236 (Hook 254 − transition 18). The
// rotation phase begins at scene-local frame REVEAL_AT + CAROUSEL_SPIRAL_IN
// = 29, i.e. absolute frame 265. The four beats following that (frames
// 281, 307, 333, 359 → scene-local 45, 71, 97, 123) deliver options →
// predictions → launchpads → perps in one card-per-beat lockstep.
const BARS_ABS_START = 236;
const CAROUSEL_DEG_PER_BEAT = -360 / CATEGORIES.length; // −90° (one card)
const CAROUSEL_SPEED_AMPLITUDE = 1.0;                   // freeze on beat,
                                                        // 2× speed mid-beat

// The same rotation phase the carousel runs. Pulled out so the
// big background word can read which card faces the camera without
// having to listen back through the React tree.
const computeContinuousRotY = (local: number): number => {
  const rotationStartAbs = BARS_ABS_START + REVEAL_AT + CAROUSEL_SPIRAL_IN;
  const absFrame = BARS_ABS_START + REVEAL_AT + local;
  if (absFrame < rotationStartAbs) return 0;

  const anchors: number[] = [rotationStartAbs];
  for (const b of VIDEO_BEATS) {
    if (b > rotationStartAbs) anchors.push(b);
  }

  let segIdx = anchors.length - 1;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (absFrame >= anchors[i] && absFrame < anchors[i + 1]) {
      segIdx = i;
      break;
    }
  }

  const segStart = anchors[segIdx];
  const segLen =
    segIdx < anchors.length - 1 ? anchors[segIdx + 1] - segStart : 26;

  const phase = Math.max(0, Math.min(1, (absFrame - segStart) / segLen));
  const A = CAROUSEL_SPEED_AMPLITUDE;
  const positionInSegment =
    CAROUSEL_DEG_PER_BEAT * phase -
    ((CAROUSEL_DEG_PER_BEAT * A) / (2 * Math.PI)) *
      Math.sin(2 * Math.PI * phase);

  return CAROUSEL_DEG_PER_BEAT * segIdx + positionInSegment;
};

// The bars + caption are gone. The scene is now the carousel + flanking
// hero words ("Extracted" / "From You") + a single headline below.
const ExtractionBars: React.FC = () => (
  <AbsoluteFill>
    <TouchedLine />
  </AbsoluteFill>
);

const TouchedLine: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - REVEAL_AT;

  if (local < 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Giant background word — names the category currently facing the
          camera. Rendered first so every other element sits on top. */}
      <BackgroundWord local={local} />

      {/* Hero word — left flank */}
      <SideHeroWord
        text="Extracted"
        side="left"
        delay={SIDE_WORD_LEFT_DELAY}
        local={local}
      />

      {/* Carousel — centered */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CategoryCarousel local={local} />
      </div>

      {/* Hero word — right flank */}
      <SideHeroWord
        text="From You"
        side="right"
        delay={SIDE_WORD_RIGHT_DELAY}
        local={local}
      />

      {/* Headline below the ring */}
      <div
        style={{
          position: "absolute",
          zIndex: 20,
          top: "84%",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <TouchedHeadline local={local} />
      </div>
    </AbsoluteFill>
  );
};

// ─── Giant background word — names the facing card ────────────────────────
//
// Four overlapping words, one per category. Opacity follows the ring's
// rotation — the card facing the camera gets ~10% alpha; siblings fade
// to zero by the halfway angle. Fades in alongside the carousel's
// spiral, fades out when the explode begins. Sits behind every other
// element so it reads as a ghost label, never as foreground type.

const BG_WORD_PEAK_OPACITY = 0.10;
const BG_WORD_FONT_SIZE = 460;
const BG_WORD_FADE_IN = toFrames(0.35);
// Sit the word in the upper tier of the frame rather than dead-centre.
// Anchored on the word's vertical mid-line so the bottom of the
// letterforms tucks just above the carousel's top edge.
const BG_WORD_CENTER_Y_PCT = 0.22;
// Cap each word's rendered width so longer labels (predictions,
// launchpads) shrink to fit instead of bleeding past the frame edges.
// Em-advance measured against the actual SF Pro Display weight 900
// render: ~0.60 em average per glyph, even with −0.05em tracking.
// A small over-estimate just buys extra side margin.
const BG_WORD_MAX_WIDTH = W * 0.9;
const BG_WORD_EM_ADVANCE = 0.62;
const fitBgWordFontSize = (label: string): number => {
  const widthCap = BG_WORD_MAX_WIDTH / (label.length * BG_WORD_EM_ADVANCE);
  return Math.min(BG_WORD_FONT_SIZE, widthCap);
};

const BackgroundWord: React.FC<{ local: number }> = ({ local }) => {
  if (local < 0) return null;

  const rotY = computeContinuousRotY(local);
  // Card i faces the camera when ring.rotateY + i*90° ≡ 0 (mod 360),
  // i.e. when i*90° ≡ −ring.rotateY (mod 360).
  const facingAngle = (((-rotY) % 360) + 360) % 360;

  const fadeIn = Math.max(
    0,
    Math.min(1, (local - CAROUSEL_SPIRAL_IN) / BG_WORD_FADE_IN),
  );
  const explodeStart = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;
  const explodeT = Math.max(
    0,
    Math.min(1, (local - explodeStart) / CAROUSEL_EXPLODE),
  );
  const envelope = fadeIn * (1 - explodeT);
  if (envelope <= 0) return null;

  const step = 360 / CATEGORIES.length;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {CATEGORIES.map((cat, i) => {
        const cardAngle = i * step;
        let delta = Math.abs(facingAngle - cardAngle);
        if (delta > 180) delta = 360 - delta;
        // 0° → fully on, half-step away → silent.
        const t = Math.max(0, 1 - delta / (step / 2));
        const eased = t * t * (3 - 2 * t);
        const op = envelope * eased * BG_WORD_PEAK_OPACITY;
        if (op < 0.001) return null;
        const scale = 0.985 + eased * 0.03;
        return (
          <div
            key={cat.label}
            style={{
              position: "absolute",
              left: "50%",
              top: `${(BG_WORD_CENTER_Y_PCT * 100).toFixed(2)}%`,
              transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})`,
              fontFamily: font,
              fontSize: fitBgWordFontSize(cat.label),
              fontWeight: 900,
              letterSpacing: "-0.05em",
              color: colors.accent,
              opacity: op,
              whiteSpace: "nowrap",
              lineHeight: 1,
              willChange: "opacity, transform",
            }}
          >
            {cat.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// ─── Below-carousel headline — "every markets you trade" ───────────────────
//
// Words fade in staggered (existing entrance vocabulary), then on exit
// each glyph waits its turn (stagger by distance from center) and rides
// outward + fades. TextTrail hide() pattern, single line.

const TouchedHeadline: React.FC<{ local: number }> = ({ local }) => {
  const exitLocal = local - TOUCHED_EXIT_AT;

  type Glyph = { ch: string; isSpace: boolean; wordIdx: number };
  const glyphs: Glyph[] = [];
  TOUCHED_WORDS.forEach((word, wi) => {
    if (wi > 0) glyphs.push({ ch: " ", isSpace: true, wordIdx: wi });
    for (const ch of word) glyphs.push({ ch, isSpace: false, wordIdx: wi });
  });

  const center = (glyphs.length - 1) / 2;

  return (
    <div
      style={{
        textAlign: "center",
        fontFamily: font,
        fontSize: 84,
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: colors.fg,
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {glyphs.map((g, i) => {
        const wLocal = local - g.wordIdx * TOUCHED_WORD_STAGGER;
        const enterOp = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        const enterY = interpolate(
          wLocal,
          [0, TOUCHED_WORD_FADE],
          [22, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        const dist = Math.abs(i - center);
        const exitStart = dist * LETTER_EXIT_STAGGER;
        const exitT = Math.max(
          0,
          Math.min(1, (exitLocal - exitStart) / LETTER_EXIT_FADE),
        );
        const exitEased = expoIn(exitT);
        const sign = i < center ? -1 : 1;
        const exitX = sign * dist * LETTER_EXIT_DRIFT * exitEased;
        const exitY = -exitEased * 16;
        const exitOp = 1 - exitT;
        const exitScale = 1 - exitEased * 0.18;

        if (g.isSpace) {
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
              {" "}
            </span>
          );
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: enterOp * exitOp,
              transform: `translate3d(${exitX.toFixed(2)}px, ${(enterY + exitY).toFixed(2)}px, 0) scale(${exitScale.toFixed(3)})`,
              willChange: "transform, opacity",
            }}
          >
            {g.ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── Side hero words — flanking the carousel ────────────────────────────────
//
// "EXTRACTED" left, "FROM YOU" right. SF Pro Display, weight 800,
// near-black, tight letter-spacing. Each glyph cascades in: slight
// rise + fade with a short stagger across characters. Both words ride
// out via the same letter-wave-out as the headline below.

const SideHeroWord: React.FC<{
  text: string;
  side: "left" | "right";
  delay: number;
  local: number;
}> = ({ text, side, delay, local }) => {
  const exitLocal = local - TOUCHED_EXIT_AT;
  const chars = Array.from(text);
  const center = (chars.length - 1) / 2;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        [side]: 80,
        transform: "translateY(-50%)",
        fontFamily: font,
        fontSize: 168,
        fontWeight: 800,
        letterSpacing: "-0.045em",
        color: colors.fg,
        lineHeight: 0.95,
        whiteSpace: "nowrap",
      }}
    >
      {chars.map((ch, i) => {
        // Entry — char-by-char cascade
        const enterStart = delay + i * SIDE_WORD_ENTER_STAGGER;
        const enterT = Math.max(
          0,
          Math.min(1, (local - enterStart) / SIDE_WORD_ENTER_FADE),
        );
        const enterEased = expoOut(enterT);
        const enterY = (1 - enterEased) * 26;
        const enterOp = enterEased;
        const enterBlur = (1 - enterEased) * 8;

        // Exit — letter wave outward (TextTrail hide pattern)
        const dist = Math.abs(i - center);
        const exitStart = dist * LETTER_EXIT_STAGGER;
        const exitT = Math.max(
          0,
          Math.min(1, (exitLocal - exitStart) / LETTER_EXIT_FADE),
        );
        const exitEased = expoIn(exitT);
        // Push outward from word's center (same as headline)
        const sign = i < center ? -1 : 1;
        const exitX = sign * dist * LETTER_EXIT_DRIFT * exitEased;
        const exitOp = 1 - exitT;
        const exitScale = 1 - exitEased * 0.18;

        if (ch === " ") {
          return (
            <span key={i} style={{ display: "inline-block", whiteSpace: "pre" }}>
              {" "}
            </span>
          );
        }

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              opacity: enterOp * exitOp,
              transform: `translate3d(${exitX.toFixed(2)}px, ${enterY.toFixed(2)}px, 0) scale(${exitScale.toFixed(3)})`,
              filter: enterBlur > 0.05 ? `blur(${enterBlur.toFixed(2)}px)` : undefined,
              willChange: "transform, opacity, filter",
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

// ─── Category carousel — Carousel3D 3D ring, double-sided cards ──────────────
//
// Spiral-in → continuous rotation → explode. The ring never stops:
// once the spiral lands, rotation accrues at a constant velocity and
// keeps accruing through what used to be a "hold" and through the
// explode. The explode adds its own extra spin on top, so the camera
// catches a ring that is *still turning* as it tips forward and rushes
// past. No frozen frame, no dead beat.
//
// Each cell carries front + back faces (Codrops trick) — the back face
// is rendered with rotateY(180deg) inside the cell, so when the cell
// rotates to face away, the back face's content presents itself. With
// backfaceVisibility: hidden on each face, exactly one side ever paints.
// All four cards are always readable, including launchpads.

const CategoryCarousel: React.FC<{ local: number }> = ({ local }) => {
  // Spiral-in (frames 0…CAROUSEL_SPIRAL_IN)
  const spiralT = Math.max(0, Math.min(1, local / CAROUSEL_SPIRAL_IN));
  const spiralEased = expoOut(spiralT);
  const spiralZ = interpolate(spiralEased, [0, 1], [-1500, -CAROUSEL_RADIUS - 60]);
  const spiralRotYAdd = interpolate(spiralEased, [0, 1], [-720, 0]);
  const spiralOpacity = spiralT;

  // Continuous rotation — beat-locked. Each segment between two real
  // beats in VIDEO_BEATS rotates the ring exactly one card-width
  // (−90°). Within a segment the speed is modulated so the ring
  // freezes momentarily on each beat and peaks halfway between beats:
  //   ω(t) = ω̄ · (1 − A · cos 2π t/N),   ω̄ = −90° / N
  // Integrated:
  //   pos(t) = ω̄·t  −  (ω̄·A·N / 2π) · sin 2π t/N
  // So pos(0) = 0 and pos(N) = −90° regardless of the actual segment
  // length N (which varies a bit between beats — the music is human,
  // not a metronome).
  const rotationFrames = Math.max(0, local - CAROUSEL_SPIRAL_IN);
  const continuousRotY = computeContinuousRotY(local);

  // Tilt + card-tilt are still tied to a normalized scroll progress so
  // they peak around the original scroll-end and ease through.
  const scrollT01 = Math.max(0, Math.min(1, rotationFrames / CAROUSEL_SCROLL));
  const tiltT = sineInOut(scrollT01);
  const ringRotX = interpolate(tiltT, [0, 1], [3, -3]);
  const ringRotZ = interpolate(tiltT, [0, 1], [3, -3]);
  const cardTiltZ = interpolate(scrollT01, [0, 1], [10, -10]);

  // Explode (frames CAROUSEL_ENTRY_FULL+HOLD…end)
  const explodeStart = CAROUSEL_ENTRY_FULL + CAROUSEL_HOLD;
  const explodeT = Math.max(
    0,
    Math.min(1, (local - explodeStart) / CAROUSEL_EXPLODE),
  );
  const explodeEased = power2InOut(explodeT);
  const explodeRotX = interpolate(explodeEased, [0, 0.4, 1], [0, 90, 90]);
  // Explode adds an extra full spin on top of the continuous rotation —
  // the ring's already-turning energy carries straight into the camera.
  const explodeRotYAdd = interpolate(explodeEased, [0, 1], [0, -360]);
  const explodeZ = interpolate(
    explodeEased,
    [0, 0.3, 1],
    [-CAROUSEL_RADIUS - 60, -1800, 1500],
  );
  const explodeRotZAdd = interpolate(explodeEased, [0.3, 1], [0, 270], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardOpacity =
    explodeT > 0.8 ? interpolate(explodeT, [0.8, 1], [1, 0]) : 1;

  const finalZ = local < explodeStart ? spiralZ : explodeZ;
  const finalRotY = continuousRotY + spiralRotYAdd + explodeRotYAdd;
  const finalRotX = ringRotX + explodeRotX;
  const finalRotZ = ringRotZ + explodeRotZAdd;

  const step = 360 / CATEGORIES.length;

  return (
    <div
      style={{
        width: CAROUSEL_W,
        height: CAROUSEL_H,
        perspective: CAROUSEL_PERSPECTIVE,
        opacity: spiralOpacity,
        position: "relative",
      }}
    >
      {/* Soft scrim — lifts the carousel off the dot grid behind. */}
      <div
        style={{
          position: "absolute",
          inset: "-80px -240px",
          borderRadius: 96,
          background:
            "radial-gradient(ellipse at center, rgba(8, 14, 28, 0.08) 0%, rgba(8, 14, 28, 0) 65%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: `translateZ(${finalZ.toFixed(1)}px) rotateY(${finalRotY.toFixed(2)}deg) rotateX(${finalRotX.toFixed(2)}deg) rotateZ(${finalRotZ.toFixed(2)}deg)`,
          willChange: "transform",
        }}
      >
        {CATEGORIES.map((cat, i) => (
          <CarouselCell
            key={cat.label}
            cat={cat}
            cellRotateY={i * step}
            cardRotateZ={cardTiltZ}
            cardOpacity={cardOpacity}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Carousel cell — Codrops double-sided trick ──────────────────────────────
//
// Each cell has its own rotateY+translateZ (its slot on the ring). Inside
// the cell, two CardFaces: a front face and a back face rotated 180° on Y.
// Both render the same Apple-light category content. backfaceVisibility
// hidden on each face: only the side facing the camera ever paints. The
// content is therefore always visible from any angle of the cell.

const CarouselCell: React.FC<{
  cat: Category;
  cellRotateY: number;
  cardRotateZ: number;
  cardOpacity: number;
}> = ({ cat, cellRotateY, cardRotateZ, cardOpacity }) => (
  <div
    style={{
      position: "absolute",
      width: CARD_W,
      height: CARD_H,
      left: (CAROUSEL_W - CARD_W) / 2,
      top: (CAROUSEL_H - CARD_H) / 2,
      transformStyle: "preserve-3d",
      transform: `rotateY(${cellRotateY}deg) translateZ(${CAROUSEL_RADIUS}px)`,
    }}
  >
    {/*
     * No `filter` on a 3D ancestor — `filter` creates a stacking
     * context that flattens descendants in WebKit/Blink, which is what
     * was eating the launchpads card. Tilt + opacity only.
     */}
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        transformStyle: "preserve-3d",
        transform: `rotateZ(${cardRotateZ}deg)`,
        opacity: cardOpacity,
      }}
    >
      <CardFace cat={cat} />
      <CardFace cat={cat} isBack />
    </div>
  </div>
);

const CardFace: React.FC<{ cat: Category; isBack?: boolean }> = ({
  cat,
  isBack,
}) => (
  <div
    style={{
      position: "absolute",
      width: "100%",
      height: "100%",
      backfaceVisibility: "hidden",
      transform: isBack ? "rotateY(180deg)" : undefined,
      borderRadius: 24,
      background: colors.surface,
      boxShadow:
        "0 1px 0 rgba(255,255,255,0.6) inset, 0 32px 64px rgba(8, 14, 28, 0.22), 0 10px 20px rgba(8, 14, 28, 0.12)",
      border: `1px solid ${colors.rule}`,
      overflow: "hidden",
    }}
  >
    <CardSurface cat={cat} />
  </div>
);

// ─── Apple-light card — white surface, near-black type, accent % ────────────

const CardSurface: React.FC<{ cat: Category }> = ({ cat }) => (
  <div style={{ position: "relative", width: "100%", height: "100%" }}>

    {/* Top eyebrow */}
    <div
      style={{
        position: "absolute",
        top: 28,
        left: 30,
        fontFamily: monoFont,
        fontSize: 17,
        fontWeight: 500,
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      market
    </div>

    {/* Category name */}
    <div
      style={{
        position: "absolute",
        top: 78,
        left: 30,
        right: 30,
        fontFamily: font,
        fontSize: 60,
        fontWeight: 800,
        letterSpacing: "-0.022em",
        color: colors.fg,
        lineHeight: 1.0,
      }}
    >
      {cat.label}
    </div>

    {/* Big percentage */}
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 30,
        bottom: 80,
        fontFamily: font,
        fontSize: 156,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        color: colors.accent,
        lineHeight: 0.92,
        fontVariantNumeric: "tabular-nums",
        textAlign: "left",
      }}
    >
      {cat.pct}
      <span
        style={{
          fontSize: 88,
          color: colors.accent,
          marginLeft: 2,
          letterSpacing: "-0.02em",
        }}
      >
        %
      </span>
    </div>

    {/* Caption */}
    <div
      style={{
        position: "absolute",
        left: 30,
        right: 30,
        bottom: 30,
        fontFamily: monoFont,
        fontSize: 16,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: colors.dim,
      }}
    >
      extracted by unfair trading
    </div>
  </div>
);

export const antiCheatStatMeta = {
  id: "AntiCheatStat",
  component: AntiCheatStat,
  durationInFrames: STAT_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};

export const antiCheatBarsMeta = {
  id: "AntiCheatBars",
  component: AntiCheatBars,
  durationInFrames: BARS_FRAMES,
  fps: FPS,
  width: W,
  height: H,
};
