// Source: https://codepen.io/ — "Backlights" effect (Philips Ambilight look)
// A framed image casts a glow derived from itself: a blurred+contrast copy
// sits behind it, color-matched to the photo's edges.
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  Img,
  staticFile,
} from "remotion";

/* ── Images ── */

const IMAGES = [
  staticFile("iceberg.webp"),
  staticFile("phone_photo_1.png"),
  staticFile("webcam-frame.jpg"),
] as const;

const IMAGE_COUNT = IMAGES.length;

/* ── Timing ── */

// 600 frames total, 3 images → ~200 frames each
// Hold: 140 frames, crossfade: 60 frames (30 out + 30 in)
const HOLD_FRAMES = 140;
const FADE_FRAMES = 60;
const CYCLE_FRAMES = HOLD_FRAMES + FADE_FRAMES; // 200 per image

/* ── Layout ── */

const FRAME_HEIGHT = 720; // px — tall enough to feel large, never overflows 1080
const FRAME_ASPECT = 4 / 3; // default; image covers with objectFit
const FRAME_WIDTH = Math.round(FRAME_HEIGHT * FRAME_ASPECT);
const FRAME_RADIUS = 16; // 1em in the original
const FRAME_BORDER = 10; // 10px solid #000

// Glow halo: inset by -8px on all sides (original: inset: -5px)
const GLOW_INSET = -8;

/* ── Helpers ── */

function easeInOut(t: number): number {
  return Easing.inOut(Easing.cubic)(t);
}

// Per-image opacity — returns 0..1 for `imageIndex` at `frame`
function imageOpacity(frame: number, imageIndex: number): number {
  // Wrap frame into one big cycle
  const totalCycle = CYCLE_FRAMES * IMAGE_COUNT;
  const cycleFrame = ((frame % totalCycle) + totalCycle) % totalCycle;

  // Which slot is the "current" image and how far into the slot are we?
  const slotF = cycleFrame / CYCLE_FRAMES;
  const currentSlot = Math.floor(slotF);
  const slotProgress = slotF - currentSlot; // 0..1 within this slot

  // Transition progress (0 until the last FADE_FRAMES of the hold)
  const transitionStart = HOLD_FRAMES / CYCLE_FRAMES;
  const rawT = (slotProgress - transitionStart) / (1 - transitionStart);
  const t = easeInOut(Math.max(0, Math.min(1, rawT)));

  const nextSlot = (currentSlot + 1) % IMAGE_COUNT;

  if (imageIndex === currentSlot % IMAGE_COUNT) {
    // Fading out
    return 1 - t;
  }
  if (imageIndex === nextSlot) {
    // Fading in
    return t;
  }
  return 0;
}

// Ken Burns: gentle 1.0→1.04 scale drift per image slot
function kenBurnsScale(frame: number, imageIndex: number): number {
  const totalCycle = CYCLE_FRAMES * IMAGE_COUNT;
  const cycleFrame = ((frame % totalCycle) + totalCycle) % totalCycle;
  const slotF = cycleFrame / CYCLE_FRAMES;
  const currentSlot = Math.floor(slotF);

  // Scale only drives when this image is the active one
  if (imageIndex !== currentSlot % IMAGE_COUNT) {
    // Inactive images stay at their endpoint so they crossfade cleanly
    return 1.04;
  }

  const slotProgress = slotF - currentSlot;
  return interpolate(slotProgress, [0, 1], [1.0, 1.04], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/* ── Main component ── */

export const Backlights: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig(); // consumed for correctness; layout uses fixed px

  // Entry fade-in
  const entryOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ opacity: entryOpacity, overflow: "hidden" }}>
      {/* ── Page background: blurred cover of the current image ── */}
      {/* Two layers crossfade for the bg too */}
      {IMAGES.map((src, i) => {
        const opacity = imageOpacity(frame, i);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              opacity,
              // Scale up so the blur doesn't show edges
              transform: "scale(1.08)",
            }}
          >
            <Img
              src={src}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
                filter: "blur(32px) brightness(0.45) saturate(1.4)",
                display: "block",
              }}
            />
          </div>
        );
      })}

      {/* Slight dark vignette over the bg so the framed image pops */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Framed image + glow, centered ── */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
        }}
      >
        {IMAGES.map((src, i) => {
          const opacity = imageOpacity(frame, i);
          const kbScale = kenBurnsScale(frame, i);

          if (opacity === 0) return null;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                opacity,
              }}
            >
              {/* ── Glow layer (sits behind the framed image) ── */}
              {/* Absolutely positioned, inset by GLOW_INSET on all sides */}
              <div
                style={{
                  position: "absolute",
                  top: GLOW_INSET,
                  left: GLOW_INSET,
                  right: GLOW_INSET,
                  bottom: GLOW_INSET,
                  borderRadius: FRAME_RADIUS,
                  overflow: "hidden",
                  // The glow: blur(40px) contrast(3) as in the original
                  filter: "blur(40px) contrast(3)",
                  opacity: 0.85,
                  zIndex: 1,
                }}
              >
                <Img
                  src={src}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    transform: `scale(${kbScale})`,
                    display: "block",
                  }}
                />
              </div>

              {/* ── Crisp framed image on top ── */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: FRAME_RADIUS,
                  border: `${FRAME_BORDER}px solid #000`,
                  overflow: "hidden",
                  zIndex: 2,
                  // Box shadow to add depth over the glow
                  boxShadow:
                    "0 8px 48px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)",
                }}
              >
                <Img
                  src={src}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "center",
                    transform: `scale(${kbScale})`,
                    transformOrigin: "center center",
                    display: "block",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
