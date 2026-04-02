import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";

const CARDS = [
  { from: "#667eea", to: "#764ba2", label: "Indigo" },
  { from: "#f093fb", to: "#f5576c", label: "Fuchsia" },
  { from: "#4facfe", to: "#00f2fe", label: "Cyan" },
  { from: "#43e97b", to: "#38f9d7", label: "Mint" },
  { from: "#fa709a", to: "#fee140", label: "Sunset" },
  { from: "#a18cd1", to: "#fbc2eb", label: "Lavender" },
  { from: "#ffecd2", to: "#fcb69f", label: "Peach" },
];

const CARD_W = 280;
const CARD_H = 380;
const GAP = 50;
const UNIT = CARD_W + GAP;
const TRACK = UNIT * CARDS.length;
const MAX_ROTATION = 28;
const MAX_DEPTH = 140;

const mod = (n: number, m: number) => ((n % m) + m) % m;

export const GradientCarousel: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, fps } = useVideoConfig();
  const time = frame / fps;

  const scrollOffset = time * 100;
  const halfW = width / 2;

  // Find center card index for background color
  const centerIdx = Math.round(scrollOffset / UNIT) % CARDS.length;
  const centerCard = CARDS[mod(centerIdx, CARDS.length)];

  return (
    <AbsoluteFill
      style={{
        background: [
          `radial-gradient(ellipse at 40% 40%, ${centerCard.from}44, transparent 60%)`,
          `radial-gradient(ellipse at 65% 60%, ${centerCard.to}44, transparent 55%)`,
          "#0a0a12",
        ].join(", "),
        transition: "background 0.5s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: 1200,
          transformStyle: "preserve-3d",
        }}
      >
        {CARDS.map((card, i) => {
          const rawX = mod(i * UNIT - scrollOffset + TRACK / 2, TRACK) - TRACK / 2;
          const screenX = rawX + halfW - CARD_W / 2;
          const norm = Math.max(-1, Math.min(1, rawX / halfW));
          const absNorm = Math.abs(norm);

          const rotateY = -norm * MAX_ROTATION;
          const translateZ = (1 - absNorm) * MAX_DEPTH;
          const scale = 0.88 + (1 - absNorm) * 0.12;
          const blur = absNorm * 3;
          const opacity = interpolate(absNorm, [0, 0.7, 1], [1, 0.85, 0.4]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: screenX,
                top: "50%",
                width: CARD_W,
                height: CARD_H,
                transform: `translate3d(0, -50%, ${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                borderRadius: 20,
                background: `linear-gradient(135deg, ${card.from}, ${card.to})`,
                filter: blur > 0.1 ? `blur(${blur}px)` : undefined,
                opacity,
                boxShadow: `0 20px 60px ${card.from}33`,
                display: "flex",
                alignItems: "flex-end",
                padding: 24,
              }}
            >
              <span
                style={{
                  color: "rgba(255,255,255,0.7)",
                  fontSize: 18,
                  fontFamily: "system-ui, sans-serif",
                  fontWeight: 600,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                {card.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
