import React from "react";
import {
  Img,
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
} from "remotion";
import { useShortContext } from "../ShortContext";
import { useLayout } from "../../../engine/FormatContext";

// ─── Types ────────────────────────────────────────────────────────────

type MiniPersonaVariant = "analyst" | "gamer" | "fan" | "trader" | "naruto-fan";
type MiniPersonaPosition = "top-left" | "top-right" | "mid-left" | "mid-right";

export interface MiniPersonaProps {
  variant: MiniPersonaVariant;
  bubbleText: string;
  position?: MiniPersonaPosition;
  delay?: number;
  bubbleDelay?: number;
}

// ─── Constants ────────────────────────────────────────────────────────

const FONT_FAMILY = "'Switzer', 'Inter', 'Helvetica Neue', sans-serif";
const FADE_OUT_FRAMES = 10;

const VARIANT_COLORS: Record<MiniPersonaVariant, string> = {
  analyst: "#00D4FF",
  gamer: "#00FF88",
  fan: "#FFD700",
  trader: "#FFE500",
  "naruto-fan": "#FF6B00",
};

// ─── Manga Character Heads (detailed SVG) ────────────────────────────

const AnalystHead: React.FC<{ bgDir: string; size: number }> = ({ bgDir, size }) => (
  <Img
    src={staticFile(`${bgDir}/mangaka-head.png`)}
    width={size}
    height={size}
    style={{ objectFit: "cover" }}
  />
);

const GamerHead: React.FC<{ bgDir: string; size: number }> = ({ size }) => (
  <svg viewBox="0 0 180 180" width={size} height={size}>
    {/* Hair (messy/spiky) */}
    <path d="M 25 65 L 15 30 L 45 55 L 35 15 L 65 50 L 60 10 L 90 45 L 95 8 L 115 45 L 130 12 L 135 50 L 155 20 L 150 60 L 165 35 L 155 70" fill="#1a3e1a" />
    {/* Face */}
    <ellipse cx="90" cy="98" rx="58" ry="62" fill="#f0c8a0" />
    {/* Headset band */}
    <path d="M 25 75 Q 25 25 90 25 Q 155 25 155 75" fill="none" stroke="#00FF88" strokeWidth="7" strokeLinecap="round" />
    {/* Left ear cup */}
    <rect x="12" y="68" width="28" height="36" rx="10" fill="#00FF88" stroke="#005522" strokeWidth="2" />
    <rect x="18" y="76" width="16" height="20" rx="4" fill="#003311" />
    {/* Right ear cup */}
    <rect x="140" y="68" width="28" height="36" rx="10" fill="#00FF88" stroke="#005522" strokeWidth="2" />
    <rect x="146" y="76" width="16" height="20" rx="4" fill="#003311" />
    {/* Mic */}
    <path d="M 22 104 Q 14 130 40 138" fill="none" stroke="#00FF88" strokeWidth="4" strokeLinecap="round" />
    <circle cx="42" cy="140" r="7" fill="#00FF88" stroke="#005522" strokeWidth="2" />
    {/* Excited eyes - big sparkly */}
    <ellipse cx="65" cy="92" rx="12" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="2" />
    <circle cx="68" cy="90" r="7" fill="#1a3e1a" />
    <circle cx="70" cy="88" r="2.5" fill="white" />
    <ellipse cx="115" cy="92" rx="12" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="2" />
    <circle cx="118" cy="90" r="7" fill="#1a3e1a" />
    <circle cx="120" cy="88" r="2.5" fill="white" />
    {/* Cat mouth grin */}
    <path d="M 70 118 Q 78 128 90 120 Q 102 128 110 118" fill="none" stroke="#6b3e1a" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const FanHead: React.FC<{ bgDir: string; size: number }> = ({ bgDir, size }) => (
  <Img
    src={staticFile(`${bgDir}/goku-head.png`)}
    width={size}
    height={size}
    style={{ objectFit: "cover" }}
  />
);

const TraderHead: React.FC<{ bgDir: string; size: number }> = ({ bgDir, size }) => (
  <Img
    src={staticFile(`${bgDir}/frieren-head.png`)}
    width={size}
    height={size}
    style={{ objectFit: "cover" }}
  />
);

const NarutoFanHead: React.FC<{ bgDir: string; size: number }> = ({ bgDir, size }) => (
  <Img
    src={staticFile(`${bgDir}/naruto-head.png`)}
    width={size}
    height={size}
    style={{ objectFit: "cover" }}
  />
);

const VARIANT_FACES: Record<MiniPersonaVariant, React.FC<{ bgDir: string; size: number }>> = {
  analyst: AnalystHead,
  gamer: GamerHead,
  fan: FanHead,
  trader: TraderHead,
  "naruto-fan": NarutoFanHead,
};

// ─── Component ────────────────────────────────────────────────────────

export const MiniPersona: React.FC<MiniPersonaProps> = ({
  variant,
  bubbleText,
  position = "top-right",
  delay = 0,
  bubbleDelay = 8,
}) => {
  const { assetDir } = useShortContext();
  const bgDir = `${assetDir}/backgrounds`;
  const rawFrame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const layout = useLayout();

  const frame = Math.max(0, rawFrame - delay);
  if (rawFrame < delay) return null;

  const color = VARIANT_COLORS[variant];
  const posCoords = (() => {
    const pos = position ?? "top-right";
    const isTop = pos.startsWith("top");
    const isLeft = pos.endsWith("left");
    const top = isTop ? layout.personaTopY : layout.personaMidY;
    return {
      top,
      ...(isLeft ? { left: 40 } : { right: 40 }),
    };
  })();
  const FaceComponent = VARIANT_FACES[variant];
  const avatarSize = layout.personaAvatarSize;
  const bubbleMaxWidth = layout.personaBubbleMaxWidth;

  const isRight = position.endsWith("right");

  // ── 1. Avatar pop-in with spring bounce ────────────────────────────
  const popIn = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 160, mass: 0.7 },
    durationInFrames: 20,
  });

  const avatarScale = interpolate(popIn, [0, 1], [0, 1]);

  // ── 2. Landing wobble ──────────────────────────────────────────────
  const wobbleFrame = Math.max(0, frame - 12);
  const wobbleAmount = Math.max(0, 1 - wobbleFrame / 15);
  const wobbleAngle = Math.sin(wobbleFrame * 0.8) * 8 * wobbleAmount;

  // ── 3. Speech bubble ──────────────────────────────────────────────
  const bubbleFrame = Math.max(0, frame - bubbleDelay);
  const showBubble = frame >= bubbleDelay;

  const bubbleIn = spring({
    frame: bubbleFrame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.5 },
    durationInFrames: 15,
  });

  const bubbleScale = interpolate(bubbleIn, [0, 1], [0, 1]);
  const bubbleOpacity = interpolate(bubbleIn, [0, 0.3], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Typewriter effect
  const charsPerFrame = 0.8;
  const visibleChars = Math.floor(bubbleFrame * charsPerFrame);
  const displayedText = bubbleText.slice(0, Math.min(visibleChars, bubbleText.length));

  // ── 4. Fade out before end of shot ────────────────────────────────
  const framesBeforeEnd = durationInFrames - rawFrame;
  const fadeOut = interpolate(
    framesBeforeEnd,
    [0, FADE_OUT_FRAMES],
    [0, 1],
    { extrapolateRight: "clamp" },
  );

  // ── Bubble layout ─────────────────────────────────────────────────
  const bubbleTransformOrigin = isRight ? "bottom right" : "bottom left";

  // Tail pointing toward avatar
  const tailStyle: React.CSSProperties = isRight
    ? {
        position: "absolute" as const,
        right: -10,
        bottom: 14,
        width: 0,
        height: 0,
        borderTop: "14px solid transparent",
        borderBottom: "14px solid transparent",
        borderLeft: "16px solid white",
      }
    : {
        position: "absolute" as const,
        left: -10,
        bottom: 14,
        width: 0,
        height: 0,
        borderTop: "14px solid transparent",
        borderBottom: "14px solid transparent",
        borderRight: "16px solid white",
      };

  const tailBorderStyle: React.CSSProperties = isRight
    ? {
        position: "absolute" as const,
        right: -15,
        bottom: 11,
        width: 0,
        height: 0,
        borderTop: "17px solid transparent",
        borderBottom: "17px solid transparent",
        borderLeft: "19px solid black",
      }
    : {
        position: "absolute" as const,
        left: -15,
        bottom: 11,
        width: 0,
        height: 0,
        borderTop: "17px solid transparent",
        borderBottom: "17px solid transparent",
        borderRight: "19px solid black",
      };

  return (
    <div
      style={{
        position: "absolute",
        ...posCoords,
        zIndex: 15,
        opacity: fadeOut,
        willChange: "transform, opacity",
      }}
    >
      {/* Avatar — manga character head */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: "50%",
          border: `4px solid ${color}`,
          boxShadow: `0 0 16px ${color}88, 0 0 32px ${color}44`,
          overflow: "hidden",
          transform: `scale(${avatarScale}) rotate(${wobbleAngle}deg)`,
          transformOrigin: "center center",
          background: "#0a0a0a",
        }}
      >
        <FaceComponent bgDir={bgDir} size={avatarSize} />
      </div>

      {/* Speech bubble */}
      {showBubble && displayedText.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: isRight ? undefined : avatarSize + 16,
            right: isRight ? avatarSize + 16 : undefined,
            bottom: 30,
            transform: `scale(${bubbleScale})`,
            transformOrigin: bubbleTransformOrigin,
            opacity: bubbleOpacity * fadeOut,
            maxWidth: bubbleMaxWidth,
            zIndex: 16,
          }}
        >
          {/* Border tail (behind) */}
          <div style={tailBorderStyle} />
          {/* Bubble body */}
          <div
            style={{
              background: "white",
              borderRadius: 18,
              padding: "14px 24px",
              position: "relative",
              border: "4px solid black",
              boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
            }}
          >
            <span
              style={{
                fontFamily: FONT_FAMILY,
                fontSize: 38,
                fontWeight: 800,
                color: "#1a1a1a",
                whiteSpace: "nowrap",
                letterSpacing: "-0.02em",
              }}
            >
              {displayedText}
              {/* Blinking cursor while typing */}
              {visibleChars < bubbleText.length && (
                <span
                  style={{
                    opacity: Math.sin(bubbleFrame * 0.4) > 0 ? 1 : 0,
                    color: color,
                    fontWeight: 900,
                  }}
                >
                  |
                </span>
              )}
            </span>
            {/* White tail (on top of border tail) */}
            <div style={tailStyle} />
          </div>
        </div>
      )}
    </div>
  );
};
