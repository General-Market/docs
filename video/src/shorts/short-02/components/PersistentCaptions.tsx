// PersistentCaptions — Global caption overlay rendered at composition level.
//
// Instead of filtering captions per-shot (which misaligns when voice phrases
// cross shot boundaries), this renders ALL captions using global frame timing.
// The active shot determines style (shout/quiet) and word highlights.

import React, { useMemo } from "react";
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import type { Caption } from "../../../lib/types";
import type { ShotDef, CaptionMode, WordHighlight } from "../types";
import { COLORS } from "../types";
import { msToFrame } from "../../../lib/utils/frameConvert";

const { fontFamily: narratorFont } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });
const { fontFamily: traderFont } = loadBebas("normal", { subsets: ["latin"], weights: ["400"] });

const MAX_CAP_WIDTH = 920;
const NARRATOR_CHAR_RATIO = 0.62;
const TRADER_CHAR_RATIO = 0.42;

// Break phrases at silences longer than this
const SILENCE_BREAK_MS = 600;

interface Props {
  captions: Caption[];
  shots: ShotDef[];
  shotFrameOffsets: number[];
  shotFrameDurations: number[];
}

// ── Helpers ─────────────────────────────────────────────────────────────

const findHighlight = (
  word: string,
  highlights: WordHighlight[],
): WordHighlight | undefined => {
  const clean = word.replace(/[^a-zA-Z0-9$%]/g, "").toLowerCase();
  return highlights.find(
    (h) =>
      h.word.toLowerCase() === clean ||
      clean.includes(h.word.toLowerCase()),
  );
};

const phraseFontSize = (
  words: Caption[],
  highlights: WordHighlight[],
  isShout: boolean,
  baseFontSize: number,
): number => {
  const charRatio = isShout ? TRADER_CHAR_RATIO : NARRATOR_CHAR_RATIO;
  let totalWidth = 0;
  let longestWordWidth = 0;
  for (const w of words) {
    const text = isShout ? w.text.toUpperCase() : w.text;
    const hl = findHighlight(w.text, highlights);
    const hlScale = hl?.scale ?? 1.0;
    const wordWidth = text.length * baseFontSize * hlScale * charRatio;
    totalWidth += wordWidth;
    longestWordWidth = Math.max(longestWordWidth, wordWidth);
  }
  totalWidth += (words.length - 1) * 14;
  if (totalWidth <= MAX_CAP_WIDTH) return baseFontSize;
  const shrinkRatio = MAX_CAP_WIDTH / longestWordWidth;
  const newSize = Math.floor(baseFontSize * shrinkRatio);
  return Math.max(36, Math.min(baseFontSize, newSize));
};

// Find which shot a given time (ms) falls into
const shotIndexAtMs = (
  ms: number,
  fps: number,
  offsets: number[],
  durations: number[],
): number => {
  const frame = msToFrame(ms, fps);
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (frame >= offsets[i]) return i;
  }
  return 0;
};

// ── Phrase with metadata ────────────────────────────────────────────────

interface PhraseInfo {
  words: Caption[];
  mode: CaptionMode;
  highlights: WordHighlight[];
  shotIdx: number;
}

// Build global phrase list, breaking at silences and mode changes
const buildPhrases = (
  captions: Caption[],
  shots: ShotDef[],
  offsets: number[],
  durations: number[],
  fps: number,
): PhraseInfo[] => {
  if (captions.length === 0) return [];

  const phrases: PhraseInfo[] = [];
  let current: Caption[] = [];
  let currentShotIdx = shotIndexAtMs(captions[0].startMs, fps, offsets, durations);
  let currentMode = shots[currentShotIdx]?.captionMode ?? "quiet";

  const flush = () => {
    if (current.length === 0) return;
    const si = shotIndexAtMs(current[0].startMs, fps, offsets, durations);
    const shot = shots[si];
    phrases.push({
      words: current,
      mode: shot?.captionMode ?? "quiet",
      highlights: shot?.wordHighlights ?? [],
      shotIdx: si,
    });
    current = [];
  };

  for (let i = 0; i < captions.length; i++) {
    const cap = captions[i];
    const si = shotIndexAtMs(cap.startMs, fps, offsets, durations);
    const mode = shots[si]?.captionMode ?? "quiet";

    // Check for silence gap from previous word
    if (i > 0) {
      const gap = cap.startMs - captions[i - 1].endMs;
      if (gap > SILENCE_BREAK_MS) {
        flush();
      }
    }

    // Check for mode change
    if (mode !== currentMode) {
      flush();
      currentMode = mode;
      currentShotIdx = si;
    }

    current.push(cap);

    // Flush at phrase size limit
    const phraseLimit = currentMode === "shout" ? 2 : 3;
    if (current.length >= phraseLimit) {
      flush();
    }
  }
  flush();

  return phrases;
};

// ── Word components ─────────────────────────────────────────────────────

const NarratorWord: React.FC<{
  word: Caption;
  highlight: WordHighlight | undefined;
  baseFontSize: number;
}> = ({ word, highlight, baseFontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordAppearFrame = msToFrame(word.startMs - 70, fps);
  const wordEndFrame = msToFrame(word.endMs, fps);
  const isVisible = frame >= wordAppearFrame;
  const isCurrent = frame >= wordAppearFrame && frame < wordEndFrame + 5;

  const elapsed = Math.max(0, frame - wordAppearFrame);

  const popIn = isVisible
    ? spring({
        frame: elapsed,
        fps,
        config: { damping: 12, stiffness: 180, mass: 0.5 },
        durationInFrames: 8,
      })
    : 0;

  const animScale = isVisible
    ? interpolate(popIn, [0, 0.5, 1], [0.6, 1.06, 1.0])
    : 0;

  const hlScale = highlight?.scale ?? 1.0;
  const effectiveFontSize = Math.round(baseFontSize * hlScale);

  let color: string = COLORS.TEXT_PRIMARY;
  if (highlight) color = highlight.color;

  const hasGlow = highlight?.glow && isCurrent;
  const glowShadow = hasGlow
    ? `0 0 30px ${highlight!.color}80, 0 0 60px ${highlight!.color}40`
    : "";

  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${animScale})`,
        opacity: isVisible ? popIn : 0,
        color,
        fontFamily: narratorFont,
        fontWeight: 900,
        fontSize: effectiveFontSize,
        lineHeight: 1.2,
        letterSpacing: 1,
        margin: "0 8px 8px 0",
        whiteSpace: "nowrap",
        textShadow: [
          "0 2px 8px rgba(0,0,0,0.95)",
          "0 5px 16px rgba(0,0,0,0.6)",
          glowShadow,
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      {word.text}
    </span>
  );
};

type TraderEntrance = "slam-down" | "slide-left" | "slide-right" | "explode";
const TRADER_ENTRANCES: TraderEntrance[] = [
  "slam-down",
  "slide-left",
  "explode",
  "slide-right",
];

const TraderWord: React.FC<{
  word: Caption;
  highlight: WordHighlight | undefined;
  baseFontSize: number;
  entrance: TraderEntrance;
}> = ({ word, highlight, baseFontSize, entrance }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const wordAppearFrame = msToFrame(word.startMs - 70, fps);
  const wordEndFrame = msToFrame(word.endMs, fps);
  const isVisible = frame >= wordAppearFrame;
  const isCurrent = frame >= wordAppearFrame && frame < wordEndFrame + 5;

  const elapsed = Math.max(0, frame - wordAppearFrame);

  const wordSpring = isVisible
    ? spring({
        frame: elapsed,
        fps,
        config: { damping: 8, stiffness: 260, mass: 0.4 },
        durationInFrames: 10,
      })
    : 0;

  const hlScale = highlight?.scale ?? 1.0;
  const effectiveFontSize = Math.round(baseFontSize * hlScale);

  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let rotate = 0;

  switch (entrance) {
    case "slam-down":
      translateY = interpolate(wordSpring, [0, 1], [-60, 0]);
      scale = interpolate(wordSpring, [0, 0.3, 1], [1.4, 1.1, 1.0]);
      break;
    case "slide-left":
      translateX = interpolate(wordSpring, [0, 1], [-120, 0]);
      rotate = interpolate(wordSpring, [0, 0.5, 1], [-3, 1, 0]);
      break;
    case "slide-right":
      translateX = interpolate(wordSpring, [0, 1], [120, 0]);
      rotate = interpolate(wordSpring, [0, 0.5, 1], [3, -1, 0]);
      break;
    case "explode":
      scale = interpolate(wordSpring, [0, 0.4, 1], [0.2, 1.2, 1.0]);
      rotate = interpolate(wordSpring, [0, 0.5, 1], [-2, 1, 0]);
      break;
  }

  let color: string = COLORS.TEXT_PRIMARY;
  if (highlight) {
    color = highlight.color;
  } else if (!isCurrent && isVisible) {
    color = "rgba(255,255,255,0.85)";
  }

  const hasGlow = highlight?.glow && isCurrent;
  const glowShadow = hasGlow
    ? `0 0 40px ${highlight!.color}90, 0 0 80px ${highlight!.color}50`
    : "";

  const text = word.text.toUpperCase();

  return (
    <span
      style={{
        display: "inline-block",
        transform: [
          `translate(${translateX}px, ${translateY}px)`,
          `scale(${scale})`,
          `rotate(${rotate}deg)`,
        ].join(" "),
        opacity: isVisible ? wordSpring : 0,
        color,
        fontFamily: traderFont,
        fontWeight: 400,
        fontSize: effectiveFontSize,
        lineHeight: 1.05,
        letterSpacing: 5,
        margin: "0 8px 6px 0",
        whiteSpace: "nowrap",
        textShadow: [
          "0 4px 10px rgba(0,0,0,1)",
          "0 8px 24px rgba(0,0,0,0.7)",
          "2px 2px 0 rgba(0,0,0,0.9)",
          "-2px -2px 0 rgba(0,0,0,0.9)",
          "2px -2px 0 rgba(0,0,0,0.9)",
          "-2px 2px 0 rgba(0,0,0,0.9)",
          glowShadow,
        ]
          .filter(Boolean)
          .join(", "),
      }}
    >
      {text}
    </span>
  );
};

// ── Main component ──────────────────────────────────────────────────────

export const PersistentCaptions: React.FC<Props> = ({
  captions,
  shots,
  shotFrameOffsets,
  shotFrameDurations,
}) => {
  const frame = useCurrentFrame(); // global frame at composition level
  const { fps } = useVideoConfig();

  // Build all phrases once (memoized)
  const phrases = useMemo(
    () => buildPhrases(captions, shots, shotFrameOffsets, shotFrameDurations, fps),
    [captions, shots, shotFrameOffsets, shotFrameDurations, fps],
  );

  if (phrases.length === 0) return null;

  // Check if the active shot has hideCaptions
  const activeShotIdx = shotIndexAtMs((frame / fps) * 1000, fps, shotFrameOffsets, shotFrameDurations);
  if (shots[activeShotIdx]?.hideCaptions) return null;

  // Find active phrase: the last phrase whose first word has started
  let activePhraseIdx = -1;
  for (let i = 0; i < phrases.length; i++) {
    const firstWordFrame = msToFrame(phrases[i].words[0].startMs - 70, fps);
    if (frame >= firstWordFrame) {
      activePhraseIdx = i;
    }
  }

  if (activePhraseIdx === -1) return null;

  const phrase = phrases[activePhraseIdx];
  const isShout = phrase.mode === "shout";

  const phraseStartFrame = msToFrame(phrase.words[0].startMs - 70, fps);
  const phraseElapsed = frame - phraseStartFrame;

  // Phrase-level entrance spring
  const phraseIn = spring({
    frame: Math.max(0, phraseElapsed),
    fps,
    config: isShout
      ? { damping: 9, stiffness: 220, mass: 0.4 }
      : { damping: 14, stiffness: 160, mass: 0.5 },
    durationInFrames: isShout ? 10 : 8,
  });

  // Phrase-level exit: fade out when next phrase is about to start
  let phraseOut = 1;
  if (activePhraseIdx < phrases.length - 1) {
    const nextPhraseFrame = msToFrame(
      phrases[activePhraseIdx + 1].words[0].startMs - 70,
      fps,
    );
    const framesUntilNext = nextPhraseFrame - frame;
    if (framesUntilNext < 4) {
      phraseOut = Math.max(0, framesUntilNext / 4);
    }
  }

  // Also hide phrase if we're well past the last word's end
  const lastWordEnd = msToFrame(phrase.words[phrase.words.length - 1].endMs, fps);
  if (frame > lastWordEnd + 20 && activePhraseIdx === phrases.length - 1) {
    phraseOut = Math.max(0, 1 - (frame - lastWordEnd - 20) / 8);
  }

  // Font sizing
  const baseFontSize = isShout ? 94 : 72;
  const fontSize = phraseFontSize(phrase.words, phrase.highlights, isShout, baseFontSize);

  // Trader entrance style (cycles through patterns)
  const traderEntrance = TRADER_ENTRANCES[activePhraseIdx % TRADER_ENTRANCES.length];

  // Trader container-level motion
  const traderContainerY = isShout
    ? interpolate(phraseIn, [0, 1], [20, 0])
    : 0;
  const traderContainerScale = isShout
    ? interpolate(phraseIn, [0, 0.5, 1], [0.9, 1.03, 1.0])
    : 1;
  const traderTilt = isShout
    ? interpolate(phraseIn, [0, 0.5, 1], [
        activePhraseIdx % 2 === 0 ? -2 : 2,
        activePhraseIdx % 2 === 0 ? 0.5 : -0.5,
        0,
      ])
    : 0;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        ...(isShout
          ? { top: "38%", transform: "translateY(-50%)" }
          : { bottom: "14%" }),
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
        textAlign: "center",
        padding: "0 60px",
        opacity: phraseIn * phraseOut,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: MAX_CAP_WIDTH,
          transform: [
            `translateY(${traderContainerY}px)`,
            `scale(${traderContainerScale})`,
            `rotate(${traderTilt}deg)`,
          ].join(" "),
        }}
      >
        {isShout
          ? phrase.words.map((word, wordIdx) => (
              <TraderWord
                key={`${activePhraseIdx}-${wordIdx}`}
                word={word}
                highlight={findHighlight(word.text, phrase.highlights)}
                baseFontSize={fontSize}
                entrance={traderEntrance}
              />
            ))
          : phrase.words.map((word, wordIdx) => (
              <NarratorWord
                key={`${activePhraseIdx}-${wordIdx}`}
                word={word}
                highlight={findHighlight(word.text, phrase.highlights)}
                baseFontSize={fontSize}
              />
            ))}
      </div>
    </div>
  );
};
