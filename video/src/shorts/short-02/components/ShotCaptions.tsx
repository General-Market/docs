import React from "react";
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadBebas } from "@remotion/google-fonts/BebasNeue";
import type { Caption } from "../../../lib/types";
import type { CaptionMode, WordHighlight } from "../types";
import { COLORS } from "../types";
import { msToFrame } from "../../../lib/utils/frameConvert";

// Narrator — Inter Black (clean, readable)
const { fontFamily: narratorFont } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });
// Trader voice — Bebas Neue (cinematic, condensed, punchy)
const { fontFamily: traderFont } = loadBebas("normal", { subsets: ["latin"], weights: ["400"] });

// Max visual width for captions (1080 - 2×60 padding)
const MAX_CAP_WIDTH = 920;
// Char width ratios per font (used for auto-sizing)
const NARRATOR_CHAR_RATIO = 0.62;
const TRADER_CHAR_RATIO = 0.42;

interface Props {
  captions: Caption[];
  globalFrameOffset: number;
  shotDurationFrames: number;
  mode: CaptionMode;
  highlights: WordHighlight[];
}

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

const groupIntoPhrases = (
  caps: Caption[],
  wordsPerPhrase: number,
): Caption[][] => {
  const phrases: Caption[][] = [];
  let current: Caption[] = [];
  for (const c of caps) {
    current.push(c);
    if (current.length >= wordsPerPhrase) {
      phrases.push(current);
      current = [];
    }
  }
  if (current.length > 0) phrases.push(current);
  return phrases;
};

const phraseFontSize = (
  words: Caption[],
  highlights: WordHighlight[],
  mode: CaptionMode,
  baseFontSize: number,
): number => {
  const isShout = mode === "shout";
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

// ---------------------------------------------------------------------------
// Narrator word — clean pop-in
// ---------------------------------------------------------------------------

const NarratorWord: React.FC<{
  word: Caption;
  globalOffset: number;
  highlight: WordHighlight | undefined;
  baseFontSize: number;
}> = ({ word, globalOffset, highlight, baseFontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const globalFrame = frame + globalOffset;
  const wordAppearFrame = msToFrame(word.startMs - 70, fps);
  const wordEndFrame = msToFrame(word.endMs, fps);
  const isVisible = globalFrame >= wordAppearFrame;
  const isCurrent =
    globalFrame >= wordAppearFrame && globalFrame < wordEndFrame + 5;

  const elapsed = frame - (wordAppearFrame - globalOffset);

  const popIn = isVisible
    ? spring({
        frame: Math.max(0, elapsed),
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
        WebkitTextStroke: "1.5px rgba(0,0,0,0.7)",
        textShadow: [
          "0 2px 8px rgba(0,0,0,1)",
          "0 5px 16px rgba(0,0,0,0.7)",
          "0 0 30px rgba(0,0,0,0.5)",
          glowShadow,
        ]
          .filter(Boolean)
          .join(", "),
        backgroundColor: "rgba(0,0,0,0.45)",
        padding: "6px 16px",
        borderRadius: 6,
      }}
    >
      {word.text}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Trader word — dynamic entrance per phrase
// ---------------------------------------------------------------------------

type TraderEntrance = "slam-down" | "slide-left" | "slide-right" | "explode";
const TRADER_ENTRANCES: TraderEntrance[] = [
  "slam-down",
  "slide-left",
  "explode",
  "slide-right",
];

const TraderWord: React.FC<{
  word: Caption;
  globalOffset: number;
  highlight: WordHighlight | undefined;
  baseFontSize: number;
  entrance: TraderEntrance;
  phraseProgress: number; // 0→1 spring for the whole phrase
}> = ({ word, globalOffset, highlight, baseFontSize, entrance, phraseProgress }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const globalFrame = frame + globalOffset;
  const wordAppearFrame = msToFrame(word.startMs - 70, fps);
  const wordEndFrame = msToFrame(word.endMs, fps);
  const isVisible = globalFrame >= wordAppearFrame;
  const isCurrent =
    globalFrame >= wordAppearFrame && globalFrame < wordEndFrame + 5;

  const elapsed = frame - (wordAppearFrame - globalOffset);

  const wordSpring = isVisible
    ? spring({
        frame: Math.max(0, elapsed),
        fps,
        config: { damping: 8, stiffness: 260, mass: 0.4 },
        durationInFrames: 10,
      })
    : 0;

  const hlScale = highlight?.scale ?? 1.0;
  const effectiveFontSize = Math.round(baseFontSize * hlScale);

  // Entrance-specific transforms
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
          "3px 3px 0 rgba(0,0,0,0.9)",
          "-3px -3px 0 rgba(0,0,0,0.9)",
          "3px -3px 0 rgba(0,0,0,0.9)",
          "-3px 3px 0 rgba(0,0,0,0.9)",
          glowShadow,
        ]
          .filter(Boolean)
          .join(", "),
        backgroundColor: "rgba(0,0,0,0.35)",
        padding: "8px 20px",
        borderRadius: 8,
      }}
    >
      {text}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Main caption component
// ---------------------------------------------------------------------------

export const ShotCaptions: React.FC<Props> = ({
  captions,
  globalFrameOffset,
  shotDurationFrames,
  mode,
  highlights,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isShout = mode === "shout";

  const shotStartMs = (globalFrameOffset / fps) * 1000;
  const shotEndMs = ((globalFrameOffset + shotDurationFrames) / fps) * 1000;

  const shotCaptions = captions.filter(
    (c) => c.startMs >= shotStartMs && c.startMs < shotEndMs,
  );

  if (shotCaptions.length === 0) return null;

  const wordsPerPhrase = isShout ? 2 : 3;
  const phrases = groupIntoPhrases(shotCaptions, wordsPerPhrase);

  const globalFrame = frame + globalFrameOffset;

  // Find active phrase
  let activePhraseIdx = -1;
  for (let i = 0; i < phrases.length; i++) {
    const firstWordFrame = msToFrame(phrases[i][0].startMs - 70, fps);
    if (globalFrame >= firstWordFrame) {
      activePhraseIdx = i;
    }
  }

  if (activePhraseIdx === -1) return null;

  const activePhrase = phrases[activePhraseIdx];

  const phraseStartFrame = msToFrame(activePhrase[0].startMs - 70, fps);
  const phraseElapsed = globalFrame - phraseStartFrame;

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
      phrases[activePhraseIdx + 1][0].startMs - 70,
      fps,
    );
    const framesUntilNext = nextPhraseFrame - globalFrame;
    if (framesUntilNext < 4) {
      phraseOut = Math.max(0, framesUntilNext / 4);
    }
  }

  // Font sizes: narrator 72px, trader 94px
  const baseFontSize = isShout ? 94 : 72;
  const fontSize = phraseFontSize(activePhrase, highlights, mode, baseFontSize);

  // Trader: pick entrance style based on phrase index (cycles through patterns)
  const traderEntrance = TRADER_ENTRANCES[activePhraseIdx % TRADER_ENTRANCES.length];

  // Trader: slight container-level motion for extra dynamism
  const traderContainerY = isShout
    ? interpolate(phraseIn, [0, 1], [20, 0])
    : 0;
  const traderContainerScale = isShout
    ? interpolate(phraseIn, [0, 0.5, 1], [0.9, 1.03, 1.0])
    : 1;
  // Trader: subtle tilt per phrase (alternating direction)
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
        // Narrator: bottom area (subtitle zone)
        // Trader: center-ish (in-your-face)
        ...(isShout
          ? { top: "38%", transform: "translateY(-50%)" }
          : { bottom: "14%" }),
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
        textAlign: "center",
        padding: isShout ? "0 60px" : "0 60px",
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
          backgroundColor: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          padding: "8px 12px",
          borderRadius: 10,
          transform: [
            `translateY(${traderContainerY}px)`,
            `scale(${traderContainerScale})`,
            `rotate(${traderTilt}deg)`,
          ].join(" "),
        }}
      >
        {isShout
          ? activePhrase.map((word, wordIdx) => (
              <TraderWord
                key={`${activePhraseIdx}-${wordIdx}`}
                word={word}
                globalOffset={globalFrameOffset}
                highlight={findHighlight(word.text, highlights)}
                baseFontSize={fontSize}
                entrance={traderEntrance}
                phraseProgress={phraseIn}
              />
            ))
          : activePhrase.map((word, wordIdx) => (
              <NarratorWord
                key={`${activePhraseIdx}-${wordIdx}`}
                word={word}
                globalOffset={globalFrameOffset}
                highlight={findHighlight(word.text, highlights)}
                baseFontSize={fontSize}
              />
            ))}
      </div>
    </div>
  );
};
