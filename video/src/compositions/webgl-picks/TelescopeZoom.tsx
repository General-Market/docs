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

const MASK_URL = staticFile("compositions/webgl-picks/mask.png");

// Original front-layer initial scales (CSS: front-1=1, front-2=0.85, etc.)
const FRONT_INITIAL_SCALES = [1.0, 0.85, 0.6, 0.45, 0.3, 0.15];

// 10 gradient "thumbnail" cards with varied aspect ratios and rich gradients
// to approximate scattered photograph thumbnails from the original
const SMALL_IMAGES: Array<{
  w: number; // width in vw
  aspect: number; // height / width ratio
  gradient: string;
}> = [
  {
    w: 10,
    aspect: 0.75, // landscape
    gradient: "linear-gradient(145deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
  },
  {
    w: 10,
    aspect: 1.3, // portrait
    gradient: "linear-gradient(160deg, #2d1b69 0%, #6b3fa0 50%, #c77dff 100%)",
  },
  {
    w: 10,
    aspect: 0.65, // wide landscape
    gradient: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
  },
  {
    w: 10,
    aspect: 1.4, // tall portrait
    gradient: "linear-gradient(150deg, #0c0c0c 0%, #3a3a3a 40%, #8e7c68 100%)",
  },
  {
    w: 10,
    aspect: 0.7, // landscape
    gradient: "linear-gradient(140deg, #1f1c2c 0%, #928dab 100%)",
  },
  {
    w: 10,
    aspect: 1.2, // portrait
    gradient: "linear-gradient(155deg, #2c3e50 0%, #4ca1af 50%, #c4e0e5 100%)",
  },
  {
    w: 10,
    aspect: 0.6, // wide landscape
    gradient: "linear-gradient(130deg, #0f2027 0%, #203a43 40%, #2c5364 100%)",
  },
  {
    w: 10,
    aspect: 1.1, // slightly tall
    gradient: "linear-gradient(145deg, #232526 0%, #414345 50%, #636363 100%)",
  },
  {
    w: 10,
    aspect: 0.75, // landscape
    gradient: "linear-gradient(160deg, #1e3c72 0%, #2a5298 50%, #4a77b4 100%)",
  },
  {
    w: 10,
    aspect: 1.35, // portrait
    gradient: "linear-gradient(135deg, #141e30 0%, #243b55 50%, #4b6584 100%)",
  },
];

// Positions in vw — exact match of original CSS
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

// Hero gradient — rich, deep, full-bleed reveal
const HERO_GRADIENT =
  "linear-gradient(135deg, #0f0c29 0%, #302b63 30%, #24243e 55%, #6b2fa0 75%, #e94560 100%)";

// --- GSAP Timeline → Remotion frame mapping ---
//
// Original timeline (all positions relative to GSAP timeline cursor):
//   Tween 1 @ pos=0:   smallImages z→100vh,  dur=1, stagger=0.2 from center
//   Tween 2 @ pos=0.6: frontLayers scale→1,  dur=1, delay=0.1  → eff 0.7..1.7
//   Tween 3 @ pos=0.6: frontLayers blur→0px, dur=1, delay=0.4, stagger=0.2 from end → eff 1.0..2.2
//
// Max timeline end = 1.0 + 1.0 + 0.2 (stagger) = 2.2
const TIMELINE_TOTAL = 2.2;

// Stagger "from: center" — center indices offset 0, edges offset most
function staggerFromCenter(
  index: number,
  total: number,
  amount: number,
): number {
  const center = (total - 1) / 2;
  const maxDist = center;
  const dist = Math.abs(index - center);
  return maxDist === 0 ? 0 : (dist / maxDist) * amount;
}

// Stagger "from: end" — last index offset 0, first index offset most
function staggerFromEnd(
  index: number,
  total: number,
  amount: number,
): number {
  if (total <= 1) return 0;
  return ((total - 1 - index) / (total - 1)) * amount;
}

const easeInOut = Easing.inOut(Easing.ease);

export const TelescopeZoom: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();

  // Raw progress 0→1 over all frames
  const rawProgress = frame / durationInFrames;

  // Eased global progress — drives --progress (text split + media scale)
  // Original uses power1.inOut on ScrollTrigger self.progress
  const progress = easeInOut(Math.min(Math.max(rawProgress, 0), 1));

  const vw = width / 100;

  // --- Tween 1: small images fly toward camera ---
  // Timeline pos 0, duration 1, power1.inOut, stagger 0.2 from center
  const tween1Start = 0 / TIMELINE_TOTAL;
  const tween1End = 1 / TIMELINE_TOTAL;

  // --- Tween 2: front layers scale → 1 ---
  // Timeline pos 0.6, duration 1, delay 0.1 → effective 0.7..1.7
  const tween2Start = 0.7 / TIMELINE_TOTAL;
  const tween2End = 1.7 / TIMELINE_TOTAL;

  // --- Tween 3: front layers blur → 0px ---
  // Timeline pos 0.6, duration 1, delay 0.4, stagger 0.2 from end → effective 1.0..2.2
  const tween3Start = 1.0 / TIMELINE_TOTAL;
  const tween3End = 2.2 / TIMELINE_TOTAL; // = 1.0

  // --- Text split ---
  // Original CSS: .left  → translate3d(calc(--progress * (-66vw + 100%) - 0.5vw), 0, 0)
  //               .right → translate3d(calc(--progress * (66vw - 100%)), 0, 0)
  // 100% = the span's own width. We estimate each span's width from font metrics.
  // At 3vw font-size with weight 600: "for the" ~ 7ch, "planet" ~ 6ch → approximate.
  const fontSize = 3 * vw;
  const leftSpanWidth = fontSize * 3.8; // "for the" approximate width
  const rightSpanWidth = fontSize * 3.2; // "planet" approximate width

  const leftTextX = progress * (-66 * vw + leftSpanWidth - 0.5 * vw);
  const rightTextX = progress * (66 * vw - rightSpanWidth);

  return (
    <AbsoluteFill style={{ backgroundColor: "#fff", overflow: "hidden" }}>
      {/* --- Text layer (below media, visible at start, splits apart) --- */}
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
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            color: "#000",
            whiteSpace: "nowrap",
            display: "inline-block",
            transform: `translate3d(${leftTextX}px, 0px, 0px)`,
          }}
        >
          for the
        </span>
        <span
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            color: "#000",
            whiteSpace: "nowrap",
            display: "inline-block",
            transform: `translate3d(${rightTextX}px, 0px, 0px)`,
          }}
        >
          planet
        </span>
      </div>

      {/* --- section__media: scales from 0→1 via eased progress, reveals hero --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          transform: `scale(${progress})`,
          transformOrigin: "center center",
        }}
      >
        {/* Back layer — full hero image, no mask */}
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            background: HERO_GRADIENT,
          }}
        />

        {/* 6 front mask layers — staggered scale + blur-to-clear */}
        {FRONT_INITIAL_SCALES.map((initScale, i) => {
          // Tween 2: scale from initScale → 1
          // All 6 layers share the same timing (no stagger on scale tween)
          const scaleT = interpolate(
            rawProgress,
            [tween2Start, Math.min(tween2End, 1)],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const scale = interpolate(easeInOut(scaleT), [0, 1], [initScale, 1]);

          // Tween 3: blur from 2px → 0px, stagger from end
          // Each layer has its own delay within the stagger window
          const layerStagger = staggerFromEnd(
            i,
            FRONT_INITIAL_SCALES.length,
            0.2,
          );
          // Map stagger offset into the tween3 progress range
          const tween3Duration = tween3End - tween3Start;
          const layerBlurStart = tween3Start + layerStagger * tween3Duration;
          const layerBlurEnd = Math.min(tween3End, 1);

          const blurT = interpolate(
            rawProgress,
            [layerBlurStart, layerBlurEnd],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          const blur = interpolate(easeInOut(blurT), [0, 1], [2, 0]);

          return (
            <div
              key={i}
              style={
                {
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
                } as React.CSSProperties
              }
            />
          );
        })}
      </div>

      {/* --- section__images: 10 scattered thumbnails in perspective --- */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: `${height}px`,
          zIndex: 3,
          pointerEvents: "none",
        }}
      >
        {SMALL_IMAGES.map((img, i) => {
          // Tween 1: z from 0 → 100vh (height), power1.inOut, stagger from center
          const staggerOffset = staggerFromCenter(
            i,
            SMALL_IMAGES.length,
            0.2,
          );
          const imgStart =
            tween1Start + staggerOffset * (tween1End - tween1Start);
          const imgEnd = tween1End;

          const flyT = interpolate(rawProgress, [imgStart, imgEnd], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const easedFlyT = easeInOut(flyT);
          const z = easedFlyT * height;

          // Fade out as images fly past the camera plane
          const opacity = interpolate(easedFlyT, [0, 0.7, 1], [1, 1, 0]);

          const pos = SMALL_IMAGE_POSITIONS[i];
          const imgW = img.w * vw;
          const imgH = imgW * img.aspect;

          return (
            <div
              key={i}
              style={
                {
                  position: "absolute",
                  width: `${imgW}px`,
                  height: `${imgH}px`,
                  background: img.gradient,
                  borderRadius: 6,
                  overflow: "hidden",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                  transformStyle: "preserve-3d",
                  backfaceVisibility: "hidden",
                  transform: `translate3d(0, 0, ${z}px)`,
                  opacity,
                  ...pos,
                } as React.CSSProperties
              }
            >
              {/* Inner sheen to sell the photograph illusion */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 40%, rgba(0,0,0,0.15) 100%)",
                  pointerEvents: "none",
                }}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
