// Source: https://tympanus.net/Tutorials/TelescopeZoom/
import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  staticFile,
} from "remotion";

// --- Constants ---

const HERO_GRADIENT =
  "linear-gradient(135deg, #0f0c29 0%, #302b63 40%, #24243e 70%, #e94560 100%)";

const MASK_URL = staticFile("compositions/webgl-picks/mask.png");

const FRONT_INITIAL_SCALES = [1.0, 0.85, 0.6, 0.45, 0.3, 0.15];

const SMALL_IMAGE_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#2980b9",
  "#e84393",
  "#00cec9",
];

// Positions in vw units — replicated from the Codrops source
const SMALL_IMAGE_POSITIONS: Array<{
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
}> = [
  { top: "15vw", left: "-3vw" },
  { top: "5vw", left: "20vw" },
  { top: "8vw", left: "26.5vw" },
  { top: "18vw", right: "18vw" },
  { top: "5vw", right: "10vw" },
  { bottom: "5vw", left: "10vw" },
  { bottom: "8vw", left: "22.5vw" },
  { bottom: "3vw", left: "45vw" },
  { bottom: "5vw", right: "15vw" },
  { bottom: "9vw", right: "7vw" },
];

// --- GSAP Timeline → Remotion Frame Mapping ---
// Total effective timeline duration: 1.6
// frameAt(pos) = (pos / 1.6) * durationInFrames

const TIMELINE_TOTAL = 1.6;

// Stagger "from: center" — center indices get earliest offset, edges get latest
function staggerFromCenter(index: number, total: number, amount: number): number {
  const center = (total - 1) / 2;
  const maxDist = center;
  const dist = Math.abs(index - center);
  return maxDist === 0 ? 0 : (dist / maxDist) * amount;
}

// Stagger "from: end" — last element starts first (offset 0), first starts last
function staggerFromEnd(index: number, total: number, amount: number): number {
  return ((total - 1 - index) / (total - 1)) * amount;
}

const easeInOut = Easing.inOut(Easing.ease);

export const TelescopeZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Global progress (0 to 1), eased — drives --progress variable
  const rawProgress = frame / durationInFrames;
  const progress = easeInOut(Math.min(Math.max(rawProgress, 0), 1));

  // --- Tween 1: Small images fly toward camera ---
  // Timeline position 0 to 1, duration 1, ease power1.inOut
  // Stagger: amount 0.2, from "center"
  const tween1Start = 0 / TIMELINE_TOTAL; // 0
  const tween1End = 1 / TIMELINE_TOTAL; // 0.625

  // --- Tween 2: Front layers scale to 1 ---
  // Position 0.6, duration 1, delay 0.1 → effective start 0.7, end 1.7
  const tween2EffStart = 0.7 / TIMELINE_TOTAL; // 0.4375
  const tween2EffEnd = 1.7 / TIMELINE_TOTAL; // 1.0625 → clamped to 1

  // --- Tween 3: Front layers unblur ---
  // Position 0.6, duration 1, delay 0.4 → effective start 1.0, end 2.0
  // Stagger: amount 0.2, from "end"
  const tween3EffStart = 1.0 / TIMELINE_TOTAL; // 0.625
  const tween3EffEnd = 2.0 / TIMELINE_TOTAL; // 1.25 → clamped to 1

  // --- Text transforms driven by progress ---
  // .left: translate3d(calc(progress * (-66vw + 100%) - 0.5vw), 0, 0)
  // At 1920w, vw = 19.2px. 66vw = 1267.2. "100%" of the text element ~= its width.
  // For Remotion with absolute px: approximate the translation.
  // -66vw ≈ -1267.2px, 100% ≈ text width (~200px), -0.5vw ≈ -9.6px
  const leftTextX = progress * (-66 * (width / 100) + 200 - 0.5 * (width / 100));
  const rightTextX = progress * (66 * (width / 100) - 200);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", overflow: "hidden" }}>
      {/* --- Text layer (below media, visible at start) --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: "translateY(-15%)",
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: `${3 * (width / 100)}px`,
            fontWeight: 600,
            color: "#000",
            whiteSpace: "nowrap",
            transform: `translate3d(${leftTextX}px, 0, 0)`,
          }}
        >
          for the
        </span>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: `${3 * (width / 100)}px`,
            fontWeight: 600,
            color: "#000",
            whiteSpace: "nowrap",
            marginLeft: "0.5em",
            transform: `translate3d(${rightTextX}px, 0, 0)`,
          }}
        >
          planet
        </span>
      </div>

      {/* --- section__media container: scales from 0 to 1 via progress --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          transform: `scale(${progress})`,
          transformOrigin: "center center",
        }}
      >
        {/* Back layer — base image, no mask */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: HERO_GRADIENT,
          }}
        />

        {/* 6 front mask layers */}
        {FRONT_INITIAL_SCALES.map((initScale, i) => {
          // Tween 2: scale from initScale → 1
          const scaleT = interpolate(
            rawProgress,
            [tween2EffStart, Math.min(tween2EffEnd, 1)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const easedScaleT = easeInOut(scaleT);
          const scale = interpolate(easedScaleT, [0, 1], [initScale, 1]);

          // Tween 3: blur from 2px → 0px, stagger from end
          const staggerOffset = staggerFromEnd(i, FRONT_INITIAL_SCALES.length, 0.2);
          // Each layer's effective range within the tween3 window
          const layerBlurStart =
            tween3EffStart +
            staggerOffset * (Math.min(tween3EffEnd, 1) - tween3EffStart);
          const layerBlurEnd = Math.min(tween3EffEnd, 1);

          const blurT = interpolate(
            rawProgress,
            [layerBlurStart, layerBlurEnd],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const easedBlurT = easeInOut(blurT);
          const blur = interpolate(easedBlurT, [0, 1], [2, 0]);

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                background: HERO_GRADIENT,
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                filter: `blur(${blur}px)`,
                WebkitMaskImage: `url(${MASK_URL})`,
                maskImage: `url(${MASK_URL})`,
                WebkitMaskPosition: "50% 50%",
                maskPosition: "50% 50%",
                WebkitMaskSize: "cover",
                maskSize: "cover",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
              } as React.CSSProperties}
            />
          );
        })}
      </div>

      {/* --- section__images: 10 small images in perspective --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${height}px`,
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        {SMALL_IMAGE_COLORS.map((color, i) => {
          // Tween 1: z from 0 to height (100vh in perspective space)
          // Stagger from center, amount 0.2 over duration 1.0
          const staggerOffset = staggerFromCenter(i, SMALL_IMAGE_COLORS.length, 0.2);
          // Each image's effective start within the tween range
          const imgStart = tween1Start + staggerOffset * (tween1End - tween1Start);
          const imgEnd = tween1End;

          const flyT = interpolate(rawProgress, [imgStart, imgEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const easedFlyT = easeInOut(flyT);
          const z = easedFlyT * height;

          // Fade out as images fly past camera
          const opacity = interpolate(easedFlyT, [0, 0.7, 1], [1, 1, 0]);

          const pos = SMALL_IMAGE_POSITIONS[i];

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: `${10 * (width / 100)}px`,
                height: `${7 * (width / 100)}px`,
                backgroundColor: color,
                borderRadius: 4,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                transform: `translate3d(0, 0, ${z}px)`,
                opacity,
                ...pos,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
