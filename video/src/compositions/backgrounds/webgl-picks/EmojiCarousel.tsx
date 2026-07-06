// 1:1 port of the original CSS 3D emoji carousel.
// Three face-cards on a triangular ring rotate through camera over a 10s loop,
// with the original cubic-bezier(0.77, 0, 0.175, 1) "settle into place" easing.
// All animation is frame-driven so Remotion can render it deterministically.

import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BG = "#110F15";
const ORANGE = "#F47956";

const CARDS = [
  { emoji: "🙂", color: "#FDD94F" },
  { emoji: "😊", color: "#F87949" },
  { emoji: "😀", color: "#FBAB48" },
];

// Original easing curve — the snappy "fall into place" cubic bezier.
const cubic = Easing.bezier(0.77, 0, 0.175, 1);

// Scale the layout up from the 380×250 desktop cap to read at 1920×1080.
const CARD_W = 700;
const CARD_H = 460;
// In the source, cards translateZ(35vw) and the ring sits at translateZ(-35vw).
// Translate the same ratio (35vw / 60vw = 0.583) of card-width into pixels.
const RING_RADIUS = Math.round(CARD_W * (35 / 60)); // ≈ 408
const PERSPECTIVE = 1800;

export const EmojiCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  // 10s loop @ 60fps = 600 frames. Frame ranges come straight from the brief.
  const cycle = 600;
  const f = frame % cycle;

  let rotateY = 0;
  if (f < 105) {
    rotateY = 0;
  } else if (f < 165) {
    rotateY = interpolate(f, [105, 165], [0, -120], { easing: cubic });
  } else if (f < 270) {
    rotateY = -120;
  } else if (f < 330) {
    rotateY = interpolate(f, [270, 330], [-120, -240], { easing: cubic });
  } else if (f < 435) {
    rotateY = -240;
  } else if (f < 495) {
    rotateY = interpolate(f, [435, 495], [-240, -360], { easing: cubic });
  } else {
    rotateY = -360;
  }

  // Entrance and exit fades, both 20 frames.
  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const opacity = fadeIn * fadeOut;

  return (
    <AbsoluteFill
      style={{
        background: BG,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 80,
        opacity,
      }}
    >
      {/* Perspective wrapper (figure.icon-cards) */}
      <div
        style={{
          width: CARD_W,
          height: CARD_H,
          perspective: PERSPECTIVE,
        }}
      >
        {/* The rotating ring (.icon-cards__content) */}
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: `translateZ(-${RING_RADIUS}px) rotateY(${rotateY}deg)`,
          }}
        >
          {CARDS.map((card, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: CARD_W,
                height: CARD_H,
                background: card.color,
                borderRadius: 12,
                boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transform: `rotateY(${i * 120}deg) translateZ(${RING_RADIUS}px)`,
                backfaceVisibility: "hidden",
                color: "#fff",
              }}
            >
              <span
                style={{
                  fontSize: 280,
                  lineHeight: 1,
                }}
              >
                {card.emoji}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* .checkbox — "Toggle animation" pill (already checked, decorative) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: ORANGE,
          fontFamily: "'SF Pro Text', 'Inter', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background: ORANGE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* White tick */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 12.5l4.5 4.5L19 7.5"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <span>Toggle animation</span>
      </div>
    </AbsoluteFill>
  );
};
