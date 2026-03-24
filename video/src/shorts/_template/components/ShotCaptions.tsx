import React from "react";
import {
  spring,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import type { Caption } from "../../../lib/types";
import type { CaptionMode, WordHighlight } from "../types";
import { COLORS } from "../types";
import { msToFrame } from "../../../lib/utils/frameConvert";

const { fontFamily } = loadInter("normal", { subsets: ["latin"], weights: ["400", "700", "900"] });

// Max visual width for captions (1080 - 2×60 padding)
const MAX_CAP_WIDTH = 920;
const CHAR_RATIO = 0.70; // Inter Black uppercase — conservative

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

// Group captions into phrases of N words
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

/**
 * Compute font size so the phrase fits within MAX_CAP_WIDTH.
 * Accounts for highlight scales (which are baked into fontSize per word).
 * If the phrase is too wide for one line, the container wraps (flex-wrap),
 * so we just need the longest word (with its scale) to fit one line.
 */
const phraseFontSize = (
  words: Caption[],
  highlights: WordHighlight[],
  mode: CaptionMode,
  baseFontSize: number,
): number => {
  const isShout = mode === "shout";

  // Check if all words fit on one line
  let totalWidth = 0;
  let longestWordWidth = 0;

  for (const w of words) {
    const text = isShout ? w.text.toUpperCase() : w.text;
    const hl = findHighlight(w.text, highlights);
    const hlScale = hl?.scale ?? 1.0;
    // The word's visual width = text.length * baseFontSize * hlScale * CHAR_RATIO
    const wordWidth = text.length * baseFontSize * hlScale * CHAR_RATIO;
    totalWidth += wordWidth;
    longestWordWidth = Math.max(longestWordWidth, wordWidth);
  }
  // Add spacing between words
  totalWidth += (words.length - 1) * 14;

  // If fits on one line, done
  if (totalWidth <= MAX_CAP_WIDTH) return baseFontSize;

  // Otherwise: shrink so the longest word (at its highlight scale) fits one line
  // longestWordWidth_new = longestWordWidth * (newSize / baseFontSize) <= MAX_CAP_WIDTH
  const shrinkRatio = MAX_CAP_WIDTH / longestWordWidth;
  const newSize = Math.floor(baseFontSize * shrinkRatio);
  return Math.max(32, Math.min(baseFontSize, newSize));
};

const WordSpan: React.FC<{
  word: Caption;
  globalOffset: number;
  highlight: WordHighlight | undefined;
  mode: CaptionMode;
  baseFontSize: number;
}> = ({ word, globalOffset, highlight, mode, baseFontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const globalFrame = frame + globalOffset;
  const wordAppearFrame = msToFrame(word.startMs - 70, fps);
  const wordEndFrame = msToFrame(word.endMs, fps);

  const isVisible = globalFrame >= wordAppearFrame;
  const isShout = mode === "shout";
  const isCurrent =
    globalFrame >= wordAppearFrame && globalFrame < wordEndFrame + 5;

  const localAppearFrame = wordAppearFrame - globalOffset;
  const elapsed = frame - localAppearFrame;

  const popIn = isVisible
    ? spring({
        frame: Math.max(0, elapsed),
        fps,
        config: { damping: 10, stiffness: 200, mass: 0.5 },
        durationInFrames: 8,
      })
    : 0;

  // Pop-in animation only (settles to 1.0) — NO highlight scale here
  const animScale = isVisible
    ? interpolate(popIn, [0, 0.5, 1], [0.5, 1.08, 1.0])
    : 0;

  // Highlight scale baked into fontSize for accurate flex layout
  const hlScale = highlight?.scale ?? 1.0;
  const effectiveFontSize = Math.round(baseFontSize * hlScale);

  // Color
  let color: string = COLORS.TEXT_PRIMARY;
  if (highlight) {
    color = highlight.color;
  } else if (!isCurrent && isShout && isVisible) {
    color = "rgba(255,255,255,0.85)";
  }

  const hasGlow = highlight?.glow && isCurrent;
  const glowShadow = hasGlow
    ? `0 0 30px ${highlight!.color}80, 0 0 60px ${highlight!.color}40`
    : "";

  const text = isShout ? word.text.toUpperCase() : word.text;

  return (
    <span
      style={{
        display: "inline-block",
        transform: `scale(${animScale})`,
        opacity: isVisible ? popIn : 0,
        color,
        fontFamily,
        fontWeight: 900,
        fontSize: effectiveFontSize,
        lineHeight: 1.25,
        letterSpacing: isShout ? 2 : 1,
        margin: "0 7px 8px 0",
        whiteSpace: "nowrap",
        textShadow: [
          "0 2px 6px rgba(0,0,0,0.95)",
          "0 4px 12px rgba(0,0,0,0.6)",
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

export const ShotCaptions: React.FC<Props> = ({
  captions,
  globalFrameOffset,
  shotDurationFrames,
  mode,
  highlights,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const shotStartMs = (globalFrameOffset / fps) * 1000;
  const shotEndMs = ((globalFrameOffset + shotDurationFrames) / fps) * 1000;

  const shotCaptions = captions.filter(
    (c) => c.startMs >= shotStartMs && c.startMs < shotEndMs,
  );

  if (shotCaptions.length === 0) return null;

  // Show 2 words at a time — fast, punchy
  const phrases = groupIntoPhrases(shotCaptions, 2);

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

  const phraseProgress = spring({
    frame: Math.max(0, phraseElapsed),
    fps,
    config: { damping: 14, stiffness: 160, mass: 0.5 },
    durationInFrames: 8,
  });

  // Compute safe font size for this phrase (wraps if needed)
  const baseFontSize = mode === "shout" ? 76 : 46;
  const fontSize = phraseFontSize(activePhrase, highlights, mode, baseFontSize);

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "12%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
        textAlign: "center",
        padding: "0 80px",
        opacity: phraseProgress,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          maxWidth: MAX_CAP_WIDTH,
        }}
      >
        {activePhrase.map((word, wordIdx) => (
          <WordSpan
            key={`${activePhraseIdx}-${wordIdx}`}
            word={word}
            globalOffset={globalFrameOffset}
            highlight={findHighlight(word.text, highlights)}
            mode={mode}
            baseFontSize={fontSize}
          />
        ))}
      </div>
    </div>
  );
};
