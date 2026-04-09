import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font, monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { FPS, BRAND_GREEN } from "../theme";

const sec = (s: number) => Math.round(s * FPS);

const RED = "#DC2626";
const GREEN = BRAND_GREEN;

// ---------------------------------------------------------------------------
// 1. Lock Icon Animation — appears at 1.76s (when "private" is said)
// ---------------------------------------------------------------------------

const LockIcon: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spring-based entrance scale
  const enterScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.6 },
  });

  const scale = interpolate(enterScale, [0, 1], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Lock closes over ~18 frames (0.6s)
  const shackleY = interpolate(frame, [8, 26], [-12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.overshoot,
  });

  // Green glow appears when lock closes
  const glowOpacity = interpolate(frame, [22, 30], [0, 0.8], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out after 2 seconds
  const exitOpacity = interpolate(frame, [sec(1.8), sec(2.4)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        paddingBottom: 320,
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          position: "relative",
          width: 120,
          height: 140,
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: "absolute",
            inset: -30,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(0,200,83,${glowOpacity * 0.4}) 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />

        {/* SVG Padlock */}
        <svg
          viewBox="0 0 120 140"
          width={120}
          height={140}
          style={{ position: "relative", zIndex: 1 }}
        >
          {/* Shackle (open → closed) */}
          <path
            d={`M 35 65 L 35 ${45 + shackleY} C 35 25, 85 25, 85 ${45 + shackleY} L 85 65`}
            fill="none"
            stroke={glowOpacity > 0.3 ? GREEN : "#999"}
            strokeWidth={10}
            strokeLinecap="round"
          />
          {/* Body */}
          <rect
            x={20}
            y={60}
            width={80}
            height={65}
            rx={10}
            fill={glowOpacity > 0.3 ? GREEN : "#666"}
            opacity={0.9}
          />
          {/* Keyhole */}
          <circle cx={60} cy={88} r={8} fill="#0a0a0a" />
          <rect x={56} y={88} width={8} height={16} rx={2} fill="#0a0a0a" />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 2. "COPY TRADERS BLOCKED" Stamp
// ---------------------------------------------------------------------------

const CopyTradersStamp: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slam in with spring
  const slamScale = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200, mass: 0.5 },
  });

  const scale = interpolate(slamScale, [0, 1], [2.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = interpolate(slamScale, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Exit
  const exitOpacity = interpolate(
    frame,
    [sec(2.5), sec(3.0)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "flex-end",
        padding: "120px 100px",
        opacity: Math.min(opacity, exitOpacity),
      }}
    >
      <div
        style={{
          transform: `scale(${scale}) rotate(-6deg)`,
          transformOrigin: "center center",
          border: `4px solid ${RED}`,
          borderRadius: 8,
          padding: "14px 28px",
          position: "relative",
        }}
      >
        <div
          style={{
            fontFamily: font,
            fontSize: 32,
            fontWeight: 800,
            color: RED,
            letterSpacing: 4,
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          COPY TRADERS BLOCKED
        </div>
        {/* Diagonal strike line */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: -8,
            right: -8,
            height: 3,
            background: RED,
            transform: "rotate(-8deg)",
            opacity: 0.6,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 3. "NO DISPUTES" Animated Checkmark
// ---------------------------------------------------------------------------

const NoDisputesCheck: React.FC = () => {
  const frame = useCurrentFrame();

  // Stroke draws itself over 30 frames (1s)
  const drawProgress = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Text fades in after checkmark
  const textOpacity = interpolate(frame, [28, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const textY = interpolate(frame, [28, 40], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE.out,
  });

  // Exit
  const exitOpacity = interpolate(
    frame,
    [sec(4.5), sec(5.2)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Checkmark path length (approximate for M 15 50 L 40 75 L 85 20)
  const pathLength = 130;
  const dashOffset = pathLength * (1 - drawProgress);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "flex-end",
        padding: "0 120px 160px 0",
        opacity: exitOpacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Checkmark SVG */}
        <svg width={100} height={100} viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx={50}
            cy={50}
            r={46}
            fill="none"
            stroke={GREEN}
            strokeWidth={3}
            opacity={0.3}
          />
          {/* Animated checkmark */}
          <path
            d="M 25 52 L 42 70 L 78 30"
            fill="none"
            stroke={GREEN}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength}
            strokeDashoffset={dashOffset}
          />
        </svg>

        {/* Text below */}
        <div
          style={{
            fontFamily: font,
            fontSize: 24,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 1,
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
          }}
        >
          Zero disputes. Ever.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 4. Settlement Countdown Timer
// ---------------------------------------------------------------------------

const SettlementCountdown: React.FC = () => {
  const frame = useCurrentFrame();

  const totalFrames = sec(8.4); // ~252 frames for 8.4s duration
  const progress = interpolate(frame, [0, totalFrames], [600, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Format as MM:SS
  const totalSeconds = Math.max(0, Math.ceil(progress));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const display = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // Entrance
  const enterOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Color shifts to brighter green as it approaches zero
  const greenIntensity = interpolate(frame, [0, totalFrames], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Pulse faster as it nears zero
  const pulseSpeed = interpolate(frame, [0, totalFrames], [0.05, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const pulse = 0.8 + 0.2 * Math.sin(frame * pulseSpeed);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 80,
        opacity: enterOpacity,
      }}
    >
      {/* Label */}
      <div
        style={{
          fontFamily: font,
          fontSize: 13,
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          letterSpacing: 2,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        Settlement
      </div>
      {/* Timer */}
      <div
        style={{
          fontFamily: monoFont,
          fontSize: 40,
          fontWeight: 700,
          color: GREEN,
          opacity: greenIntensity * pulse,
          letterSpacing: 2,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {display}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// 5. Floating Comparison Labels
// ---------------------------------------------------------------------------

interface LabelPair {
  left: string;
  right: string;
}

const LABEL_PAIRS: LabelPair[] = [
  { left: "TRANSPARENT", right: "SEALED" },
  { left: "EXPLOITABLE", right: "PRIVATE" },
  { left: "SLOW", right: "INSTANT" },
];

const FloatingLabels: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const exitOpacity = interpolate(
    frame,
    [sec(6.0), sec(6.6)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ opacity: exitOpacity }}>
      {LABEL_PAIRS.map((pair, i) => {
        const delay = i * sec(1.0);
        const localFrame = Math.max(frame - delay, 0);

        // Left label slides in from left
        const leftSlide = spring({
          frame: localFrame,
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.7 },
        });

        const leftX = interpolate(leftSlide, [0, 1], [-300, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const leftOpacity = interpolate(localFrame, [0, 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        // Right label slides in from right
        const rightSlide = spring({
          frame: Math.max(localFrame - 4, 0),
          fps,
          config: { damping: 14, stiffness: 120, mass: 0.7 },
        });

        const rightX = interpolate(rightSlide, [0, 1], [300, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const rightOpacity = interpolate(localFrame, [4, 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const yPosition = 300 + i * 100;

        const pillBase: React.CSSProperties = {
          fontFamily: monoFont,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: "uppercase",
          padding: "10px 22px",
          borderRadius: 24,
          whiteSpace: "nowrap",
        };

        return (
          <React.Fragment key={i}>
            {/* Left (red) */}
            <div
              style={{
                position: "absolute",
                left: 60,
                top: yPosition,
                transform: `translateX(${leftX}px)`,
                opacity: leftOpacity,
              }}
            >
              <div
                style={{
                  ...pillBase,
                  color: RED,
                  border: `2px solid ${RED}`,
                  background: "rgba(220, 38, 38, 0.1)",
                }}
              >
                {pair.left}
              </div>
            </div>

            {/* Right (green) */}
            <div
              style={{
                position: "absolute",
                right: 60,
                top: yPosition,
                transform: `translateX(${rightX}px)`,
                opacity: rightOpacity,
              }}
            >
              <div
                style={{
                  ...pillBase,
                  color: GREEN,
                  border: `2px solid ${GREEN}`,
                  background: "rgba(0, 200, 83, 0.1)",
                }}
              >
                {pair.right}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------------------
// 6. "BLS VERIFIED" Badge
// ---------------------------------------------------------------------------

const BlsVerifiedBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 140, mass: 0.6 },
  });

  const scale = interpolate(enterScale, [0, 1], [0.5, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const enterOpacity = interpolate(enterScale, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Subtle pulse
  const pulse = 0.85 + 0.15 * Math.sin(frame * 0.1);

  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        right: 80,
        transform: `scale(${scale})`,
        opacity: enterOpacity * pulse,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          border: `2px solid ${GREEN}`,
          borderRadius: 8,
          padding: "10px 20px",
          background: "rgba(0, 200, 83, 0.08)",
        }}
      >
        {/* Shield icon */}
        <svg width={22} height={26} viewBox="0 0 22 26">
          <path
            d="M 11 1 L 21 6 L 21 14 C 21 20 11 25 11 25 C 11 25 1 20 1 14 L 1 6 Z"
            fill="none"
            stroke={GREEN}
            strokeWidth={2}
          />
          {/* Inner checkmark */}
          <path
            d="M 7 13 L 10 16 L 15 10"
            fill="none"
            stroke={GREEN}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div
          style={{
            fontFamily: monoFont,
            fontSize: 16,
            fontWeight: 700,
            color: GREEN,
            letterSpacing: 2,
          }}
        >
          BLS VERIFIED
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main composition — all local times, frame 0 = 161.40s video
// ---------------------------------------------------------------------------

export const EnhancedPrivacy: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. Lock icon at 1.76s */}
      <Sequence from={sec(1.76)} durationInFrames={sec(2.6)}>
        <LockIcon />
        <Sequence from={sec(0.5)}>
          <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.5} />
        </Sequence>
      </Sequence>

      {/* 2. "COPY TRADERS BLOCKED" stamp at 5.0s-8.0s */}
      <Sequence from={sec(5.0)} durationInFrames={sec(3.0)}>
        <CopyTradersStamp />
      </Sequence>

      {/* 3. "NO DISPUTES" checkmark at 19.8s-25.0s */}
      <Sequence from={sec(19.8)} durationInFrames={sec(5.2)}>
        <NoDisputesCheck />
        <Sequence from={sec(1.0)}>
          <Audio src={staticFile("sfx/cursor-click-soft.mp3")} volume={0.45} />
        </Sequence>
      </Sequence>

      {/* 4. Settlement countdown at 11.4s-19.8s */}
      <Sequence from={sec(11.4)} durationInFrames={sec(8.4)}>
        <SettlementCountdown />
      </Sequence>

      {/* 5. Floating comparison labels at 4.8s-11.4s */}
      <Sequence from={sec(4.8)} durationInFrames={sec(6.6)}>
        <FloatingLabels />
      </Sequence>

      {/* 6. "BLS VERIFIED" badge at 11.4s-19.8s */}
      <Sequence from={sec(11.4)} durationInFrames={sec(8.4)}>
        <BlsVerifiedBadge />
      </Sequence>
    </AbsoluteFill>
  );
};
