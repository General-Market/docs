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
import { monoFont } from "../../../common/fonts";
import { FPS, BRAND_GREEN, PANEL } from "../theme";

// ---------------------------------------------------------------------------
// Frame conversion
// ---------------------------------------------------------------------------

const sec = (s: number) => Math.round(s * FPS);

// ---------------------------------------------------------------------------
// Visibility events — each appearance window
// ---------------------------------------------------------------------------

interface Window {
  /** Frame the panel starts sliding in */
  enterFrame: number;
  /** How many frames the panel holds fully visible (after enter completes) */
  holdFrames: number;
  /** Whether it fades out after hold. False = stays visible to end of video. */
  fadeOut: boolean;
  /** Items that should be checked during this window (indices 0-2) */
  newlyChecked: number[];
}

const WINDOWS: Window[] = [
  // 11.28s — first appear, all unchecked, hold 8s, fade out
  {
    enterFrame: sec(11.28),
    holdFrames: sec(8),
    fadeOut: true,
    newlyChecked: [],
  },
  // 76.72s — Liquidity checked, hold 3s, fade out
  {
    enterFrame: sec(76.72),
    holdFrames: sec(3),
    fadeOut: true,
    newlyChecked: [0],
  },
  // 159.72s — Capital Lock + Risk Management checked, hold 3s, fade out
  {
    enterFrame: sec(159.72),
    holdFrames: sec(3),
    fadeOut: true,
    newlyChecked: [1, 2],
  },
  // 276.88s — all checked, stays until end
  {
    enterFrame: sec(276.88),
    holdFrames: sec(6),
    fadeOut: false,
    newlyChecked: [],
  },
];

const ENTER_FRAMES = 15; // slide-in duration
const FADE_OUT_FRAMES = 15;

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const ITEMS = ["Liquidity", "Capital Lock", "Risk Management"] as const;

// ---------------------------------------------------------------------------
// Determine which items are checked at a given frame
// ---------------------------------------------------------------------------

function checkedSetAtFrame(frame: number): Set<number> {
  const checked = new Set<number>();
  for (const w of WINDOWS) {
    if (frame >= w.enterFrame) {
      for (const idx of w.newlyChecked) checked.add(idx);
    }
  }
  return checked;
}

// ---------------------------------------------------------------------------
// Find which window is active (if any) at a given frame, and compute
// panel opacity + translateX
// ---------------------------------------------------------------------------

function panelState(
  frame: number,
  fps: number,
): { opacity: number; translateX: number } | null {
  for (let i = WINDOWS.length - 1; i >= 0; i--) {
    const w = WINDOWS[i];
    const localFrame = frame - w.enterFrame;
    if (localFrame < 0) continue;

    const windowEnd = ENTER_FRAMES + w.holdFrames + (w.fadeOut ? FADE_OUT_FRAMES : 0);

    // Past fade-out — panel is hidden
    if (w.fadeOut && localFrame > windowEnd) continue;

    // Enter: spring-based slide + opacity ramp
    const enterSpring = spring({
      frame: Math.max(localFrame, 0),
      fps,
      config: { damping: 14, stiffness: 140, mass: 0.7 },
    });

    const translateX = interpolate(enterSpring, [0, 1], [-200, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    const enterOpacity = interpolate(localFrame, [0, ENTER_FRAMES], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

    // Exit: fade over 15 frames after hold ends
    const holdEnd = ENTER_FRAMES + w.holdFrames;
    let exitOpacity = 1;
    if (w.fadeOut && localFrame > holdEnd) {
      exitOpacity = interpolate(
        localFrame,
        [holdEnd, holdEnd + FADE_OUT_FRAMES],
        [1, 0],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
      );
    }

    const opacity = Math.min(enterOpacity, exitOpacity);
    if (opacity <= 0) continue;

    return { opacity, translateX };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Checkmark with spring scale
// ---------------------------------------------------------------------------

const CheckMark: React.FC<{ frame: number; checkedAtFrame: number }> = ({
  frame,
  checkedAtFrame,
}) => {
  const { fps } = useVideoConfig();
  const localFrame = frame - checkedAtFrame;

  // Low damping = natural overshoot past 1.0, then settles back
  const raw = spring({
    frame: Math.max(localFrame, 0),
    fps,
    config: { damping: 8, stiffness: 180, mass: 0.5 },
  });

  return (
    <span
      style={{
        color: BRAND_GREEN,
        display: "inline-block",
        transform: `scale(${raw})`,
        transformOrigin: "center",
      }}
    >
      ✓
    </span>
  );
};

// ---------------------------------------------------------------------------
// Compute the frame at which each item first becomes checked
// ---------------------------------------------------------------------------

function getCheckFrames(): (number | null)[] {
  const result: (number | null)[] = [null, null, null];
  for (const w of WINDOWS) {
    for (const idx of w.newlyChecked) {
      if (result[idx] === null) {
        result[idx] = w.enterFrame;
      }
    }
  }
  return result;
}

const CHECK_FRAMES = getCheckFrames();

// ---------------------------------------------------------------------------
// SFX frame positions: each checkmark + final all-checked
// ---------------------------------------------------------------------------

// Checkmark SFX at: 76.72s (item 0), 159.72s (items 1+2)
const CHECKMARK_SFX_FRAMES = [sec(76.72), sec(159.72)];
// Final success SFX at 276.88s
const FINAL_SFX_FRAME = sec(276.88);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const PromiseChecklist: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const state = panelState(frame, fps);
  if (!state) return null;

  const checked = checkedSetAtFrame(frame);

  return (
    <AbsoluteFill>
      {/* Panel */}
      <div
        style={{
          position: "absolute",
          top: 48,
          left: 48,
          opacity: state.opacity,
          transform: `translateX(${state.translateX}px)`,
          ...PANEL,
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {ITEMS.map((label, i) => {
          const isChecked = checked.has(i);
          const checkFrame = CHECK_FRAMES[i];

          return (
            <div
              key={label}
              style={{
                fontFamily: monoFont,
                fontSize: 20,
                fontWeight: 500,
                color: "#fafafa",
                opacity: isChecked ? 1 : 0.6,
                display: "flex",
                alignItems: "center",
                gap: 8,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ width: 28, textAlign: "center" }}>
                {isChecked && checkFrame !== null ? (
                  <>
                    [<CheckMark frame={frame} checkedAtFrame={checkFrame} />]
                  </>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.4)" }}>[ ]</span>
                )}
              </span>
              <span>{label}</span>
            </div>
          );
        })}
      </div>

      {/* SFX: metal-latch-unlock on each checkmark moment */}
      {CHECKMARK_SFX_FRAMES.map((sfxFrame) => (
        <Sequence key={sfxFrame} from={sfxFrame} durationInFrames={60}>
          <Audio src={staticFile("sfx/metal-latch-unlock.mp3")} volume={0.6} />
        </Sequence>
      ))}

      {/* SFX: code-compile-success on final all-checked */}
      <Sequence from={FINAL_SFX_FRAME} durationInFrames={90}>
        <Audio src={staticFile("sfx/code-compile-success.mp3")} volume={0.55} />
      </Sequence>
    </AbsoluteFill>
  );
};
