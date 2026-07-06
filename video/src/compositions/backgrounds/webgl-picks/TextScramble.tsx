// Matrix-style text scramble — phrases shift from one to the next with
// random-character "dud" interpolation. The original uses requestAnimationFrame
// and Math.random; here every value is hashed from (phraseIndex, charIndex, frame)
// so each render is pixel-identical.

import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";

const BG = "#212121";
const TEXT = "#FAFAFA";
const DUD = "#757575";
const CHARS = "!<>-_\\/[]{}—=+*^?#________";

const PHRASES = [
  "Neo,",
  "sooner or later",
  "you're going to realize",
  "just as I did",
  "that there's a difference",
  "between knowing the path",
  "and walking the path",
];

// Deterministic pseudo-random from a 2D seed. Same input → same output forever.
const rand = (a: number, b: number) => {
  const x = Math.sin(a * 374761.393 + b * 668265263.0) * 43758.5453;
  return x - Math.floor(x);
};

// Per-phrase timing. Original JS: start ∈ [0,40), end = start + [0,40), so
// worst-case finish = frame 80. Plus an 800ms idle (~48 frames @ 60fps).
const SCRAMBLE_FRAMES = 80;
const IDLE_FRAMES = 40;
const PHRASE_FRAMES = SCRAMBLE_FRAMES + IDLE_FRAMES; // 120 frames per phrase
// 600 frames / 120 = 5 phrases shown, with the first scrambling in from blanks.

// Pick a fresh dud character every few frames (original: 28% per frame).
// Deterministic equivalent: bin frames into 4-frame groups, hash on the bin.
const DUD_FLICKER_BINS = 4;

const FADE_FRAMES = 20;

export const TextScramble: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const phraseIdx = Math.floor(frame / PHRASE_FRAMES);
  const localFrame = frame % PHRASE_FRAMES;

  // Phrase 0 scrambles in from empty so the opening reads correctly.
  const oldText = phraseIdx === 0 ? "" : PHRASES[(phraseIdx - 1) % PHRASES.length];
  const newText = PHRASES[phraseIdx % PHRASES.length];
  const length = Math.max(oldText.length, newText.length);

  const segments: { text: string; isDud: boolean; key: number }[] = [];

  for (let i = 0; i < length; i++) {
    const from = oldText[i] || "";
    const to = newText[i] || "";

    // Match the original ranges exactly: start ∈ [0,40), duration ∈ [0,40).
    const start = Math.floor(rand(phraseIdx + 1, i + 1) * 40);
    const end = start + Math.floor(rand(phraseIdx + 1, i + 977) * 40);

    if (localFrame >= end) {
      segments.push({ text: to || " ", isDud: false, key: i });
    } else if (localFrame >= start) {
      const bin = Math.floor(localFrame / DUD_FLICKER_BINS);
      const charIdx = Math.floor(rand(phraseIdx * 131 + i, bin + 1) * CHARS.length);
      segments.push({
        text: CHARS[charIdx] || "?",
        isDud: true,
        key: i,
      });
    } else {
      segments.push({ text: from || " ", isDud: false, key: i });
    }
  }

  const fadeIn = interpolate(frame, [0, FADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - FADE_FRAMES, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        background: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Roboto Mono', 'SF Mono', ui-monospace, monospace",
        fontWeight: 100,
        fontSize: 96,
        color: TEXT,
        letterSpacing: "0.02em",
        opacity: fadeIn * fadeOut,
      }}
    >
      <div style={{ whiteSpace: "pre" }}>
        {segments.map((seg) => (
          <span key={seg.key} style={{ color: seg.isDud ? DUD : TEXT }}>
            {seg.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
