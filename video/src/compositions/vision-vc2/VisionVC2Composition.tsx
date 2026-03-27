/**
 * VisionVC2 — "Unless." whiteboard scene
 *
 * Left:  "Unless." anchored.
 * Right: Photos ACCUMULATE (stack on each other as they arrive).
 *        Only the text cycles — enters, holds, exits before the next.
 *
 * Faster pacing: ~9s total.
 */
import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { COLOR, FONT, ANIM } from "./tokens";
import { PolaroidPhoto } from "./PolaroidPhoto";

const FPS = 30;

// ── Content ────────────────────────────────────────────────────────
interface ImageDef {
  src: string;
  rotation: number;
  offsetX: number;
  delay: number;
}

interface Item {
  text: string;
  images: ImageDef[];
}

const IMG_DIR = "compositions/vision-vc2";

const ITEMS: Item[] = [
  {
    text: "We fix insider trading.",
    images: [
      { src: `${IMG_DIR}/insider-1.jpg`, rotation: -3, offsetX: -160, delay: 0 },
      { src: `${IMG_DIR}/insider-3.jpg`, rotation: 1, offsetX: 0, delay: 3 },
      { src: `${IMG_DIR}/insider-2.jpg`, rotation: 4, offsetX: 160, delay: 6 },
    ],
  },
  {
    text: "We remove spreads.",
    images: [
      { src: `${IMG_DIR}/spreads-1.jpg`, rotation: 2, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/spreads-2.jpg`, rotation: -3, offsetX: 130, delay: 5 },
    ],
  },
  {
    text: "We find a willing counterparty\nfor 500k markets.",
    images: [
      { src: `${IMG_DIR}/liquidity-1.jpg`, rotation: -2, offsetX: -130, delay: 0 },
      { src: `${IMG_DIR}/liquidity-2.jpg`, rotation: 3, offsetX: 130, delay: 5 },
    ],
  },
];

// ── Timing ─────────────────────────────────────────────────────────
// Opening beats (before "Unless.")
const BEAT1_DUR = 55; // ~1.8s — DB + train delays
const BEAT2_DUR = 60; // ~2s — VC logos + "never liquid"
const BEAT_GAP = 8; // crossfade overlap
const INTRO_DURATION = BEAT1_DUR + BEAT2_DUR - BEAT_GAP; // 107 frames

// "Unless." section (frames are relative to Sequence start)
const ITEMS_START = 30;
const ITEM_DUR = 55;
const TEXT_EXIT_START = 40;
const UNLESS_DURATION = ITEMS_START + ITEMS.length * ITEM_DUR + 15;
const TOTAL = INTRO_DURATION + UNLESS_DURATION;

// ── VC logos ───────────────────────────────────────────────────────
const VC_LOGOS = ["vc-a16z.png", "vc-sequoia.png", "vc-paradigm.png", "vc-polychain.png"];

// ── Beat 1: DB logo + "bet on German train delays" ──────────────
const OpeningBeat1: React.FC = () => {
  const frame = useCurrentFrame();

  const enterS = spring({ frame, fps: FPS, config: ANIM.springFast });
  const exitProgress = interpolate(frame, [BEAT1_DUR - 15, BEAT1_DUR], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = Easing.in(Easing.cubic)(exitProgress);

  const opacity = interpolate(enterS, [0, 1], [0, 1]) * (1 - exit);
  const translateY = interpolate(enterS, [0, 1], [40, 0]) + exit * -20;
  const scale = interpolate(enterS, [0, 1], [0.92, 1]) * (1 - exit * 0.05);

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
      }}
    >
      <Img
        src={staticFile(`${IMG_DIR}/db-logo.png`)}
        style={{ height: 160, objectFit: "contain", marginBottom: 50 }}
      />
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 52,
          fontWeight: 600,
          color: COLOR.textPrimary,
          textAlign: "center",
          letterSpacing: "-0.02em",
          lineHeight: 1.4,
        }}
      >
        You can now bet on
        <br />
        German train delays
      </div>
    </AbsoluteFill>
  );
};

// ── Beat 2: VC logos + "this will never be liquid" ──────────────
const OpeningBeat2: React.FC = () => {
  const frame = useCurrentFrame();

  const enterS = spring({ frame, fps: FPS, config: ANIM.springFast });
  const exitProgress = interpolate(
    frame,
    [BEAT2_DUR - 15, BEAT2_DUR],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exit = Easing.in(Easing.cubic)(exitProgress);

  const opacity = interpolate(enterS, [0, 1], [0, 1]) * (1 - exit);
  const translateY = interpolate(enterS, [0, 1], [30, 0]) + exit * -20;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      {/* VC logo row */}
      <div
        style={{
          display: "flex",
          gap: 60,
          alignItems: "center",
          marginBottom: 55,
        }}
      >
        {VC_LOGOS.map((logo, i) => {
          const logoS = spring({
            frame: Math.max(0, frame - i * 2),
            fps: FPS,
            config: ANIM.springFast,
          });
          const logoOpacity = interpolate(logoS, [0, 1], [0, 0.7]) * (1 - exit);
          const logoScale = interpolate(logoS, [0, 1], [0.8, 1]);
          return (
            <Img
              key={logo}
              src={staticFile(`${IMG_DIR}/${logo}`)}
              style={{
                height: 45,
                objectFit: "contain",
                opacity: logoOpacity,
                transform: `scale(${logoScale})`,
                filter: "grayscale(100%)",
              }}
            />
          );
        })}
      </div>

      {/* Quote */}
      <div
        style={{
          fontFamily: FONT.sans,
          fontSize: 48,
          fontWeight: 500,
          color: COLOR.textSecondary,
          textAlign: "center",
          letterSpacing: "-0.01em",
          fontStyle: "italic",
        }}
      >
        &ldquo;But this will never be liquid&rdquo;
      </div>
    </AbsoluteFill>
  );
};

// ── Unless text ────────────────────────────────────────────────────
const UnlessText: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({
    frame,
    fps: FPS,
    config: ANIM.springMedium,
  });

  const opacity = interpolate(s, [0, 1], [0, 1]);
  const translateY = interpolate(s, [0, 1], [30, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 140,
        top: 0,
        bottom: 0,
        display: "flex",
        alignItems: "center",
        fontFamily: FONT.sans,
        fontSize: 120,
        fontWeight: 700,
        color: COLOR.textPrimary,
        opacity,
        transform: `translateY(${translateY}px)`,
        letterSpacing: "-0.02em",
      }}
    >
      Unless.
    </div>
  );
};

// ── Accumulating photo pile ────────────────────────────────────────
// Photos enter and STAY. As new groups arrive, old ones shrink + shift up.
const PhotoPile: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: 0,
        bottom: 0,
        width: 840,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ITEMS.map((item, itemIdx) => {
        const itemStart = ITEMS_START + itemIdx * ITEM_DUR;
        const localFrame = frame - itemStart;

        // Don't render before this item's entrance
        if (localFrame < -2) return null;

        // Count how many items have appeared AFTER this one
        const itemsAfterCount = ITEMS.reduce((count, _, laterIdx) => {
          if (laterIdx <= itemIdx) return count;
          const laterStart = ITEMS_START + laterIdx * ITEM_DUR;
          const laterLocal = frame - laterStart;
          return laterLocal > 5 ? count + 1 : count;
        }, 0);

        // Compress: shrink + shift up as more items stack on top
        const compressScale = Math.pow(0.82, itemsAfterCount);
        const compressY = -55 * itemsAfterCount;

        // Compress spring (animates when a new item arrives)
        const compressSpring = spring({
          frame: Math.max(0, itemsAfterCount > 0 ? localFrame - ITEM_DUR + 10 : 0),
          fps: FPS,
          config: { damping: 20, stiffness: 100, mass: 0.6 },
        });

        const currentScale = interpolate(
          compressSpring,
          [0, 1],
          [itemsAfterCount > 0 ? 1 / compressScale * Math.pow(0.82, itemsAfterCount - 1) : 1, compressScale],
        );
        const currentY = interpolate(
          compressSpring,
          [0, 1],
          [itemsAfterCount > 0 ? compressY + 55 : 0, compressY],
        );

        // Dim older items slightly
        const dimOpacity = interpolate(itemsAfterCount, [0, 1, 3], [1, 0.7, 0.4], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={itemIdx}
            style={{
              position: "absolute",
              width: 500,
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `translateY(${currentY}px) scale(${currentScale})`,
              opacity: dimOpacity,
              willChange: "transform, opacity",
            }}
          >
            {item.images.map((img, i) => (
              <PolaroidPhoto
                key={i}
                src={img.src}
                rotation={img.rotation}
                offsetX={img.offsetX}
                delay={img.delay}
                localFrame={localFrame}
                exitProgress={0}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
};

// ── Cycling text (only text swaps) ─────────────────────────────────
const CyclingText: React.FC<{ text: string; startFrame: number }> = ({
  text,
  startFrame,
}) => {
  const frame = useCurrentFrame();
  const localFrame = frame - startFrame;

  if (localFrame < 0 || localFrame > ITEM_DUR) return null;

  const enterSpring = spring({
    frame: Math.max(0, localFrame),
    fps: FPS,
    config: ANIM.springFast,
  });

  const exitRaw = interpolate(
    localFrame,
    [TEXT_EXIT_START, ITEM_DUR],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const exitProgress = Easing.in(Easing.cubic)(exitRaw);

  const enterY = interpolate(enterSpring, [0, 1], [30, 0]);
  const exitY = exitProgress * -20;

  const enterOpacity = interpolate(enterSpring, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });
  const exitOpacity = 1 - exitProgress;
  const opacity = enterOpacity * exitOpacity;

  const lines = text.split("\n");

  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        bottom: 120,
        width: 840,
        textAlign: "center",
        fontFamily: FONT.sans,
        fontSize: lines.length > 1 ? 40 : 46,
        fontWeight: 500,
        lineHeight: 1.35,
        color: COLOR.textSecondary,
        opacity,
        transform: `translateY(${enterY + exitY}px)`,
        letterSpacing: "-0.01em",
        whiteSpace: "pre-line",
      }}
    >
      {text}
    </div>
  );
};

// ── Subtle divider ─────────────────────────────────────────────────
const Divider: React.FC = () => {
  const frame = useCurrentFrame();

  const s = spring({
    frame: frame - 15,
    fps: FPS,
    config: ANIM.springSlow,
  });

  const scaleY = interpolate(s, [0, 1], [0, 1]);
  const opacity = interpolate(s, [0, 1], [0, 0.15]);

  return (
    <div
      style={{
        position: "absolute",
        left: "38%",
        top: "30%",
        height: "40%",
        width: 1,
        backgroundColor: COLOR.textPrimary,
        opacity,
        transform: `scaleY(${scaleY})`,
        transformOrigin: "center",
      }}
    />
  );
};

// ── Composition ────────────────────────────────────────────────────
export const VisionVC2Composition: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.page }}>
      {/* Beat 1: DB + train delays */}
      <Sequence durationInFrames={BEAT1_DUR}>
        <OpeningBeat1 />
      </Sequence>

      {/* Beat 2: VC logos + "never liquid" */}
      <Sequence from={BEAT1_DUR - BEAT_GAP} durationInFrames={BEAT2_DUR}>
        <OpeningBeat2 />
      </Sequence>

      {/* "Unless." — the answer */}
      <Sequence from={INTRO_DURATION} durationInFrames={UNLESS_DURATION}>
        <UnlessText />
        <Divider />
        <PhotoPile />
        {ITEMS.map((item, i) => (
          <CyclingText
            key={i}
            text={item.text}
            startFrame={ITEMS_START + i * ITEM_DUR}
          />
        ))}
      </Sequence>
    </AbsoluteFill>
  );
};

export const visionVC2Meta = {
  id: "VisionVC2",
  component: VisionVC2Composition,
  durationInFrames: TOTAL,
  fps: FPS as 30,
  width: 1920 as 1920,
  height: 1080 as 1080,
};
