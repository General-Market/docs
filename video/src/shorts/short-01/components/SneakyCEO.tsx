import React from "react";
import {
  Img,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { noise2D } from "@remotion/noise";
import { useShortContext } from "../ShortContext";

interface Props {
  delay?: number; // frames before appearing
}

const PHOTO_SIZE = 520;
const BORDER_WIDTH = 6;
const MONEY_YELLOW = "#FFE500";
const GOLD_BORDER = "#DAA520";
const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";

// Money particle symbols
const MONEY_SYMBOLS = ["$", "$", "💰", "$", "¥", "€", "$"];

export const SneakyCEO: React.FC<Props> = ({ delay = 0 }) => {
  const { assetDir } = useShortContext();
  const ceoSrc = staticFile(`${assetDir}/backgrounds/sony-ceo.jpg`);
  const rawFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const frame = Math.max(0, rawFrame - delay);
  if (rawFrame < delay) return null;

  // ── 1. Slide-in from right with spring bounce ────────────────────
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.9 },
    durationInFrames: 30,
  });

  // Start off-screen right, slide to final position
  const translateX = interpolate(slideIn, [0, 1], [350, 0]);

  // Slight rotation like peeking around a corner
  const peekRotation = interpolate(slideIn, [0, 0.6, 0.85, 1], [-15, 5, -2, 0]);

  // Fade in
  const opacity = interpolate(slideIn, [0, 0.15], [0, 1], {
    extrapolateRight: "clamp",
  });

  // ── 2. Scheming wobble (starts after slide-in settles) ───────────
  const schemeFrame = Math.max(0, frame - 25);

  // Left-right wobble (rubbing hands)
  const wobbleX =
    noise2D("ceoWobX", schemeFrame * 0.06, 0) * 6 +
    Math.sin(schemeFrame * 0.15) * 4;

  // Eyes squint — subtle scaleY pulse
  const squintPhase = Math.sin(schemeFrame * 0.12);
  const scaleY = interpolate(squintPhase, [-1, 1], [0.96, 1.0]);

  // "Heh heh" nod — small Y bounce every ~40 frames
  const nodCycle = schemeFrame % 50;
  let nodY = 0;
  if (nodCycle < 15 && schemeFrame > 5) {
    const nodT = nodCycle / 15;
    nodY =
      Math.sin(nodT * Math.PI * 3) * // triple-bounce nod
      interpolate(nodT, [0, 0.3, 1], [0, 6, 0]); // envelope
  }

  // ── 3. Golden border pulse ───────────────────────────────────────
  const borderPulse = Math.sin(schemeFrame * 0.1) * 0.5 + 0.5;
  const borderColor = interpolate(
    borderPulse,
    [0, 1],
    [0.6, 1.0]
  );
  const borderShadowIntensity = interpolate(borderPulse, [0, 1], [4, 12]);

  // ── 4. Speech bubble ────────────────────────────────────────────
  const bubbleDelay = 35; // frames after slide-in starts
  const bubbleFrame = Math.max(0, frame - bubbleDelay);
  const bubbleIn = spring({
    frame: bubbleFrame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.6 },
    durationInFrames: 15,
  });
  const bubbleScale = interpolate(bubbleIn, [0, 1], [0, 1]);
  const bubbleOpacity = interpolate(bubbleIn, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Alternate bubble text every ~60 frames
  const bubbleCycle = Math.floor(schemeFrame / 60) % 2;
  const bubbleText = bubbleCycle === 0 ? "heh heh" : "$$$";

  // Bubble wobble
  const bubbleWobble = Math.sin(schemeFrame * 0.08) * 3;

  // ── 5. Money particles ──────────────────────────────────────────
  const particles = MONEY_SYMBOLS.map((symbol, i) => {
    const particleDelay = 20 + i * 12;
    const particleFrame = Math.max(0, frame - particleDelay);
    const cycleLength = 50 + i * 7;
    const cycleFrame = particleFrame % cycleLength;

    // Float upward
    const floatY = interpolate(cycleFrame, [0, cycleLength], [0, -120]);

    // Horizontal drift using noise
    const driftX = noise2D("moneyX", cycleFrame * 0.04, i * 10) * 30;

    // Fade in then out
    const particleOpacity = interpolate(
      cycleFrame,
      [0, 8, cycleLength * 0.6, cycleLength],
      [0, 0.9, 0.7, 0],
      { extrapolateRight: "clamp" }
    );

    // Slight rotation
    const particleRot = noise2D("moneyR", cycleFrame * 0.05, i) * 20;

    // Scale wobble
    const particleScale = 0.7 + Math.sin(cycleFrame * 0.15 + i) * 0.15;

    // Position particles around the photo circle
    const baseX = -30 + (i % 3) * 50 - 40;
    const baseY = 40 + (i % 4) * 40;

    return (
      <div
        key={`money-${i}`}
        style={{
          position: "absolute",
          right: baseX,
          top: baseY,
          transform: `translate(${driftX}px, ${floatY}px) rotate(${particleRot}deg) scale(${particleScale})`,
          opacity: particleOpacity * (frame > particleDelay ? 1 : 0),
          fontSize: 28 + (i % 3) * 6,
          color: MONEY_YELLOW,
          fontFamily: FONT_FAMILY,
          fontWeight: 900,
          textShadow: `0 0 8px ${MONEY_YELLOW}66`,
          pointerEvents: "none",
          zIndex: 25,
        }}
      >
        {symbol}
      </div>
    );
  });

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 280,
        zIndex: 20,
        marginLeft: -(PHOTO_SIZE / 2),
        opacity,
        transform: `translateX(${translateX}px)`,
        willChange: "transform, opacity",
      }}
    >
      {/* Money particles layer */}
      {particles}

      {/* Photo container with golden border */}
      <div
        style={{
          width: PHOTO_SIZE,
          height: PHOTO_SIZE,
          borderRadius: "50%",
          border: `${BORDER_WIDTH}px solid rgba(218, 165, 32, ${borderColor})`,
          boxShadow: [
            `0 0 ${borderShadowIntensity}px ${GOLD_BORDER}`,
            `0 0 ${borderShadowIntensity * 2}px ${GOLD_BORDER}44`,
            `inset 0 0 ${borderShadowIntensity}px ${GOLD_BORDER}33`,
          ].join(", "),
          overflow: "hidden",
          transform: [
            `rotate(${peekRotation}deg)`,
            `translateX(${wobbleX}px)`,
            `translateY(${nodY}px)`,
            `scaleY(${scaleY})`,
          ].join(" "),
          transformOrigin: "center center",
          background: "#1a1a1a",
        }}
      >
        <Img
          src={ceoSrc}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "50%",
          }}
        />
      </div>

      {/* CEO label below photo */}
      <div
        style={{
          textAlign: "center",
          marginTop: 16,
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 900,
          color: GOLD_BORDER,
          letterSpacing: 10,
          textTransform: "uppercase",
          textShadow: `0 0 16px ${GOLD_BORDER}88, 0 0 40px ${GOLD_BORDER}44, 0 2px 6px rgba(0,0,0,0.6)`,
          opacity: interpolate(slideIn, [0.6, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        CEO
      </div>

      {/* SONY wordmark */}
      <div
        style={{
          textAlign: "center",
          marginTop: 8,
          fontFamily: FONT_FAMILY,
          fontSize: 60,
          fontWeight: 900,
          color: "#FFFFFF",
          letterSpacing: 16,
          textTransform: "uppercase",
          textShadow: `0 0 20px rgba(255,255,255,0.4), 0 0 50px rgba(255,255,255,0.2), 0 4px 8px rgba(0,0,0,0.5)`,
          opacity: interpolate(slideIn, [0.7, 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        SONY
      </div>

      {/* Speech bubble */}
      {frame > bubbleDelay && (
        <div
          style={{
            position: "absolute",
            left: -160,
            top: -40,
            transform: `scale(${bubbleScale}) rotate(${bubbleWobble}deg)`,
            transformOrigin: "bottom right",
            opacity: bubbleOpacity,
            zIndex: 26,
          }}
        >
          {/* Bubble body */}
          <div
            style={{
              background: "white",
              borderRadius: 28,
              padding: "18px 32px",
              position: "relative",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            <span
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: 56,
                fontWeight: 900,
                color: bubbleCycle === 1 ? "#228B22" : "#333",
                fontStyle: bubbleCycle === 0 ? "italic" : "normal",
                whiteSpace: "nowrap",
              }}
            >
              {bubbleText}
            </span>
            {/* Bubble tail */}
            <div
              style={{
                position: "absolute",
                right: 10,
                bottom: -10,
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderTop: "12px solid white",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
