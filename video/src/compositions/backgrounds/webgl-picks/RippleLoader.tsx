// Five concentric glassy disks. Each scales on a 2s ease-in-out cycle with a
// 200ms stagger between neighbors. The center glyph breathes from grey to
// white. The source ran on infinite CSS keyframes; the maths is the same,
// just snapped to the frame clock so the loop is exact.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from "remotion";

const CYCLE_FRAMES = 120; // 2s @ 60fps
const STAGGER_FRAMES = 12; // 0.2s @ 60fps
const SIZE = 600; // px — outer loader box

// Ease-in-out scale across the half cycle, peaking at 1.3, then back to 1.
function rippleScale(frame: number, delay: number): number {
  const t = (((frame - delay) % CYCLE_FRAMES) + CYCLE_FRAMES) % CYCLE_FRAMES;
  const local = t / CYCLE_FRAMES;
  const eased = Easing.inOut(Easing.cubic)(local);
  // 0 → 0.5 → 1 mapped via sine wave so we land at 1 again at the loop seam
  const wave = Math.sin(eased * Math.PI);
  return 1 + wave * 0.3;
}

// Logo fill — grey → white → grey
function logoFill(frame: number): string {
  const t = (frame % CYCLE_FRAMES) / CYCLE_FRAMES;
  const eased = Easing.inOut(Easing.cubic)(t);
  const wave = Math.sin(eased * Math.PI); // 0 → 1 → 0
  const v = 128 + Math.round(wave * 127);
  return `rgb(${v}, ${v}, ${v})`;
}

const BOXES = [0, 1, 2, 3, 4]; // 5 disks, outer → inner

// Inset percentage per layer — outer 0%, then 10, 20, 30, 40 (centermost)
const INSETS = [0, 10, 20, 30, 40];

export const RippleLoader: React.FC = () => {
  const frame = useCurrentFrame();
  useVideoConfig();
  const fill = logoFill(frame);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        display: "grid",
        placeItems: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          width: SIZE,
          height: SIZE,
        }}
      >
        {BOXES.map((i) => {
          // Outer (i=0) sits underneath with the longest delay so the wave
          // appears to emanate from the center outward — same z stack as the
          // source (.box:nth-child(1) z-index 99 → :nth-child(5) z-index 95).
          const layerFromCenter = INSETS.length - 1 - i; // 4..0
          const delay = layerFromCenter * STAGGER_FRAMES;
          const scale = rippleScale(frame, delay);
          const inset = INSETS[INSETS.length - 1 - i]; // 40..0
          const borderAlpha = 0.2 + (layerFromCenter / 4) * 0.8;
          const shadowAlpha = 0.3;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: `${inset}%`,
                borderRadius: "50%",
                background:
                  "linear-gradient(0deg, rgba(50,50,50,0.2) 0%, rgba(100,100,100,0.2) 100%)",
                borderTop: `1px solid rgba(100,100,100,${borderAlpha})`,
                boxShadow: `0 ${10 + (scale - 1) * 66}px ${
                  10 + (scale - 1) * 33
                }px 0 rgba(0, 0, 0, ${shadowAlpha})`,
                backdropFilter: "blur(5px)",
                transform: `scale(${scale})`,
                zIndex: 99 - i,
              }}
            />
          );
        })}

        {/* Centered logo — eight-pointed star, color-cycling */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "30%",
            zIndex: 100,
          }}
        >
          <svg viewBox="0 0 100 100" style={{ width: "100%", fill }}>
            <path d="M100 34.2c-.4-2.6-3.3-4-5.3-5.3-3.6-2.4-7.1-4.7-10.7-7.1-8.5-5.7-17.1-11.4-25.6-17.1-2-1.3-4-2.7-6-4-1.4-1-3.3-1-4.8 0-5.7 3.8-11.5 7.7-17.2 11.5L5.2 29C3 30.4.1 31.8 0 34.8c-.1 3.3 0 6.7 0 10v16c0 2.9-.6 6.3 2.1 8.1 6.4 4.4 12.9 8.6 19.4 12.9 8 5.3 16 10.7 24 16 2.2 1.5 4.4 3.1 7.1 1.3 2.3-1.5 4.5-3 6.8-4.5 8.9-5.9 17.8-11.9 26.7-17.8l9.9-6.6c.6-.4 1.3-.8 1.9-1.3 1.4-1 2-2.4 2-4.1V37.3c.1-1.1.2-2.1.1-3.1 0-.1 0 .2 0 0zM54.3 12.3 88 34.8 73 44.9 54.3 32.4V12.3zm-8.6 0v20L27.1 44.8 12 34.8l33.7-22.5zM8.6 42.8 19.3 50 8.6 57.2V42.8zm37.1 44.9L12 65.2l15-10.1 18.6 12.5v20.1zM50 60.2 34.8 50 50 39.8 65.2 50 50 60.2zm4.3 27.5v-20l18.6-12.5 15 10.1-33.6 22.4zm37.1-30.5L80.7 50l10.8-7.2-.1 14.4z" />
          </svg>
        </div>
      </div>
    </AbsoluteFill>
  );
};
