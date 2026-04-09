import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { font } from "../../../common/fonts";
import { BRAND_GREEN } from "../theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
}

interface SentenceBlock {
  /** All words with their timestamps, in order */
  words: WordTiming[];
  /** Time when the panel fades in (sec) — slightly before first word */
  panelIn: number;
  /** Time when the panel fades out (sec) — slightly after last word */
  panelOut: number;
}

// ---------------------------------------------------------------------------
// Brand-green keywords (lowercased for matching)
// ---------------------------------------------------------------------------

const GREEN_WORDS = new Set([
  "10",
  "30",
  "1",
  "billion",
  "parimutuel",
  "oracle",
  "moat",
  "moat.",
  "pnl.",
  "billions",
  "20",
]);

const isGreenWord = (w: string): boolean =>
  GREEN_WORDS.has(w.toLowerCase().replace(/[.,!?;:]$/, "")) ||
  GREEN_WORDS.has(w.toLowerCase());

// ---------------------------------------------------------------------------
// Sentence data — pulled from transcriptData.ts word timestamps
// ---------------------------------------------------------------------------

const SENTENCES: SentenceBlock[] = [
  // 1. (62.40s - 76.72s) Twitch streamer example
  {
    panelIn: 61.8,
    panelOut: 77.5,
    words: [
      // "Every trader bets on will this Twitch streamer have more viewers in 10 minutes."
      { word: "Every", startSec: 62.4, endSec: 62.8 },
      { word: "trader", startSec: 62.8, endSec: 63.28 },
      { word: "bets", startSec: 63.28, endSec: 63.68 },
      { word: "on", startSec: 63.68, endSec: 63.84 },
      { word: "will", startSec: 64.08, endSec: 64.16 },
      { word: "this", startSec: 64.32, endSec: 64.48 },
      { word: "Twitch", startSec: 64.48, endSec: 64.8 },
      { word: "streamer", startSec: 64.88, endSec: 65.52 },
      { word: "have", startSec: 65.52, endSec: 65.76 },
      { word: "more", startSec: 65.76, endSec: 66.0 },
      { word: "viewers", startSec: 66.0, endSec: 66.48 },
      { word: "in", startSec: 66.48, endSec: 66.64 },
      { word: "10", startSec: 66.64, endSec: 66.96 },
      { word: "minutes.", startSec: 66.96, endSec: 67.44 },
      // "The system only accepts trades where you fill bets for every streamer's."
      { word: "The", startSec: 67.68, endSec: 67.92 },
      { word: "system", startSec: 67.92, endSec: 68.24 },
      { word: "only", startSec: 68.24, endSec: 68.56 },
      { word: "accepts", startSec: 68.56, endSec: 69.12 },
      { word: "trades", startSec: 69.12, endSec: 69.6 },
      { word: "where", startSec: 69.6, endSec: 69.92 },
      { word: "you", startSec: 69.92, endSec: 70.08 },
      { word: "fill", startSec: 70.08, endSec: 70.4 },
      { word: "bets", startSec: 70.4, endSec: 70.56 },
      { word: "for", startSec: 70.72, endSec: 70.88 },
      { word: "every", startSec: 70.88, endSec: 71.2 },
      { word: "streamer.", startSec: 71.2, endSec: 72.08 },
      // "No submarket is left out because everyone trades on everything."
      { word: "No", startSec: 72.72, endSec: 72.96 },
      { word: "submarket", startSec: 72.96, endSec: 73.44 },
      { word: "is", startSec: 73.44, endSec: 73.6 },
      { word: "left", startSec: 73.6, endSec: 74.32 },
      { word: "out", startSec: 73.6, endSec: 74.32 },
      { word: "because", startSec: 74.48, endSec: 74.72 },
      { word: "everyone", startSec: 74.72, endSec: 75.36 },
      { word: "trades", startSec: 75.36, endSec: 75.84 },
      { word: "on", startSec: 75.84, endSec: 76.0 },
      { word: "everything.", startSec: 76.0, endSec: 76.72 },
    ],
  },

  // 2. (135.72s - 150.44s) Parimutuel settlement explanation
  {
    panelIn: 135.1,
    panelOut: 151.2,
    words: [
      // "For each submarket, if traders who bet yes did win, they win the collateral of traders who bet no."
      { word: "For", startSec: 135.72, endSec: 135.96 },
      { word: "each", startSec: 135.96, endSec: 136.2 },
      { word: "submarket,", startSec: 136.2, endSec: 137.16 },
      { word: "if", startSec: 137.16, endSec: 137.4 },
      { word: "traders", startSec: 137.4, endSec: 137.96 },
      { word: "who", startSec: 137.96, endSec: 138.2 },
      { word: "bet", startSec: 138.2, endSec: 138.52 },
      { word: "yes", startSec: 138.52, endSec: 138.76 },
      { word: "did", startSec: 138.92, endSec: 139.16 },
      { word: "win,", startSec: 139.16, endSec: 139.64 },
      { word: "they", startSec: 139.64, endSec: 139.88 },
      { word: "win", startSec: 139.88, endSec: 140.2 },
      { word: "the", startSec: 140.2, endSec: 140.36 },
      { word: "collateral", startSec: 140.36, endSec: 140.92 },
      { word: "of", startSec: 141.0, endSec: 141.16 },
      { word: "traders", startSec: 141.16, endSec: 141.56 },
      { word: "who", startSec: 141.56, endSec: 141.72 },
      { word: "bet", startSec: 141.72, endSec: 141.96 },
      { word: "no.", startSec: 142.12, endSec: 142.44 },
      // "We do this computation 30 times for each train station."
      { word: "We", startSec: 143.8, endSec: 144.04 },
      { word: "do", startSec: 144.04, endSec: 144.28 },
      { word: "this", startSec: 144.28, endSec: 144.6 },
      { word: "computation", startSec: 144.6, endSec: 145.32 },
      { word: "30", startSec: 145.32, endSec: 145.72 },
      { word: "times", startSec: 145.72, endSec: 145.96 },
      { word: "for", startSec: 145.96, endSec: 146.12 },
      { word: "each", startSec: 146.12, endSec: 146.44 },
      { word: "train", startSec: 146.44, endSec: 146.92 },
      { word: "station.", startSec: 146.92, endSec: 147.4 },
      // "And we make a sum getting your final PNL."
      { word: "And", startSec: 147.4, endSec: 147.64 },
      { word: "we", startSec: 147.64, endSec: 147.8 },
      { word: "make", startSec: 147.8, endSec: 147.96 },
      { word: "a", startSec: 147.96, endSec: 148.2 },
      { word: "sum", startSec: 148.2, endSec: 148.44 },
      { word: "getting", startSec: 148.6, endSec: 149.0 },
      { word: "your", startSec: 149.0, endSec: 149.16 },
      { word: "final", startSec: 149.16, endSec: 149.48 },
      { word: "PNL.", startSec: 149.48, endSec: 150.44 },
    ],
  },

  // 3. (172.84s - 194.04s) Oracle and instant settlement
  {
    panelIn: 172.2,
    panelOut: 194.8,
    words: [
      // "In our mission to launch 1 billion prediction markets in parallel, we had to build a specialized scalable oracle."
      { word: "In", startSec: 172.84, endSec: 173.0 },
      { word: "our", startSec: 173.0, endSec: 173.16 },
      { word: "mission", startSec: 173.16, endSec: 173.48 },
      { word: "to", startSec: 173.48, endSec: 173.64 },
      { word: "launch", startSec: 173.64, endSec: 173.96 },
      { word: "1", startSec: 173.96, endSec: 174.2 },
      { word: "billion", startSec: 174.2, endSec: 174.68 },
      { word: "prediction", startSec: 174.68, endSec: 175.16 },
      { word: "markets", startSec: 175.16, endSec: 175.56 },
      { word: "in", startSec: 175.56, endSec: 175.8 },
      { word: "parallel,", startSec: 175.8, endSec: 176.76 },
      { word: "we", startSec: 176.76, endSec: 177.08 },
      { word: "had", startSec: 177.08, endSec: 177.32 },
      { word: "to", startSec: 177.32, endSec: 177.56 },
      { word: "build", startSec: 177.56, endSec: 177.96 },
      { word: "a", startSec: 177.96, endSec: 178.2 },
      { word: "specialized", startSec: 178.2, endSec: 178.92 },
      { word: "scalable", startSec: 178.92, endSec: 179.56 },
      { word: "oracle.", startSec: 179.56, endSec: 180.12 },
      // "Every market settles instantly. No traditional disputes."
      { word: "Every", startSec: 185.8, endSec: 186.2 },
      { word: "market", startSec: 186.2, endSec: 186.52 },
      { word: "settles", startSec: 186.76, endSec: 187.16 },
      { word: "instantly.", startSec: 187.16, endSec: 187.56 },
      { word: "No", startSec: 189.64, endSec: 189.96 },
      { word: "traditional", startSec: 189.96, endSec: 190.52 },
      { word: "disputes.", startSec: 190.52, endSec: 191.0 },
    ],
  },

  // 4. (204.92s - 216.84s) Moat + Quantity over Quality
  {
    panelIn: 204.3,
    panelOut: 217.5,
    words: [
      // "The moat is not anymore how good you are at predicting one market, but how good you are at predicting all markets."
      { word: "The", startSec: 204.92, endSec: 205.08 },
      { word: "moat", startSec: 205.08, endSec: 205.24 },
      { word: "is", startSec: 205.48, endSec: 205.64 },
      { word: "not", startSec: 205.64, endSec: 205.8 },
      { word: "anymore", startSec: 205.8, endSec: 206.12 },
      { word: "how", startSec: 206.12, endSec: 206.28 },
      { word: "good", startSec: 206.28, endSec: 206.52 },
      { word: "you", startSec: 206.52, endSec: 206.68 },
      { word: "are", startSec: 206.68, endSec: 206.92 },
      { word: "at", startSec: 206.92, endSec: 207.08 },
      { word: "predicting", startSec: 207.08, endSec: 207.8 },
      { word: "one", startSec: 207.8, endSec: 208.04 },
      { word: "market,", startSec: 208.04, endSec: 208.6 },
      { word: "but", startSec: 208.6, endSec: 208.92 },
      { word: "how", startSec: 208.92, endSec: 209.16 },
      { word: "good", startSec: 209.16, endSec: 209.4 },
      { word: "you", startSec: 209.4, endSec: 209.64 },
      { word: "are", startSec: 209.64, endSec: 209.88 },
      { word: "at", startSec: 209.88, endSec: 210.12 },
      { word: "predicting", startSec: 210.12, endSec: 210.92 },
      { word: "all", startSec: 210.92, endSec: 211.24 },
      { word: "markets.", startSec: 211.24, endSec: 212.12 },
      // "Quantity over quality."
      { word: "Quantity", startSec: 212.12, endSec: 212.76 },
      { word: "over", startSec: 212.76, endSec: 213.08 },
      { word: "quality.", startSec: 213.08, endSec: 213.8 },
    ],
  },

  // 5. (230.32s - 247.44s) New instrument vs incumbent moats
  {
    panelIn: 229.7,
    panelOut: 248.2,
    words: [
      // "It's easier starting from a new financial instrument than starting from an instrument with billions of hedge funds."
      { word: "It's", startSec: 230.56, endSec: 230.88 },
      { word: "easier", startSec: 230.88, endSec: 231.44 },
      { word: "starting", startSec: 231.44, endSec: 231.84 },
      { word: "from", startSec: 231.84, endSec: 232.0 },
      { word: "a", startSec: 232.0, endSec: 232.16 },
      { word: "new", startSec: 232.16, endSec: 232.48 },
      { word: "financial", startSec: 232.48, endSec: 232.96 },
      { word: "instrument", startSec: 232.96, endSec: 233.44 },
      { word: "than", startSec: 233.68, endSec: 234.0 },
      { word: "starting", startSec: 234.16, endSec: 234.72 },
      { word: "from", startSec: 234.72, endSec: 234.88 },
      { word: "an", startSec: 234.88, endSec: 235.12 },
      { word: "instrument", startSec: 235.12, endSec: 235.68 },
      { word: "with", startSec: 235.68, endSec: 235.84 },
      { word: "billions", startSec: 236.0, endSec: 236.48 },
      { word: "of", startSec: 236.48, endSec: 236.72 },
      { word: "hedge", startSec: 236.72, endSec: 237.2 },
      { word: "funds.", startSec: 237.2, endSec: 237.6 },
      // "Every instrument in the order book has huge incumbent moats."
      { word: "Every", startSec: 241.52, endSec: 241.92 },
      { word: "instrument", startSec: 241.92, endSec: 242.4 },
      { word: "in", startSec: 242.8, endSec: 243.04 },
      { word: "the", startSec: 243.04, endSec: 243.28 },
      { word: "order", startSec: 243.28, endSec: 243.6 },
      { word: "book", startSec: 243.6, endSec: 243.92 },
      { word: "has", startSec: 244.08, endSec: 244.24 },
      { word: "huge", startSec: 246.4, endSec: 246.8 },
      { word: "incumbent", startSec: 244.24, endSec: 244.72 },
      { word: "moats.", startSec: 246.8, endSec: 247.44 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Single word component
// ---------------------------------------------------------------------------

const HighlightWord: React.FC<{
  word: string;
  startSec: number;
  endSec: number;
  currentSec: number;
}> = ({ word, startSec, endSec, currentSec }) => {
  const isCurrent = currentSec >= startSec && currentSec < endSec;
  const isSpoken = currentSec >= endSec;
  const isUpcoming = currentSec < startSec;

  // Transition progress: how far through speaking this word we are (0..1)
  const wordDuration = Math.max(endSec - startSec, 0.08);
  const progress = isUpcoming
    ? 0
    : isSpoken
      ? 1
      : Math.min(1, (currentSec - startSec) / wordDuration);

  // Opacity: dim (0.2) -> current (1.0) -> spoken (0.7)
  const opacity = isUpcoming
    ? 0.2
    : isCurrent
      ? interpolate(progress, [0, 0.3], [0.2, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0.7;

  // Scale: only the current word gets a subtle bump
  const scale = isCurrent
    ? interpolate(progress, [0, 0.2, 0.8, 1], [1, 1.05, 1.05, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Weight: bold only when current
  const fontWeight = isCurrent ? 700 : isSpoken ? 500 : 400;

  // Color: brand green for key terms when active/spoken, white otherwise
  const green = isGreenWord(word);
  let color = "white";
  if (green && (isCurrent || isSpoken)) {
    color = BRAND_GREEN;
  }

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `scale(${scale})`,
        fontWeight,
        color,
        transition: "none",
        marginRight: 8,
        lineHeight: 1.6,
      }}
    >
      {word}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Single sentence panel
// ---------------------------------------------------------------------------

const SentencePanel: React.FC<{
  block: SentenceBlock;
  currentSec: number;
}> = ({ block, currentSec }) => {
  // Panel fade in/out
  const fadeInStart = block.panelIn;
  const firstWord = block.words[0].startSec;
  const lastWord = block.words[block.words.length - 1].endSec;
  const fadeOutEnd = block.panelOut;

  const panelOpacity = interpolate(
    currentSec,
    [fadeInStart, firstWord - 0.2, lastWord + 0.8, fadeOutEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Panel slide up on entry
  const slideY = interpolate(
    currentSec,
    [fadeInStart, firstWord - 0.1],
    [20, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (panelOpacity < 0.01) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: `translate(-50%, -50%) translateY(${slideY}px)`,
        width: "60%",
        opacity: panelOpacity,
        background: "rgba(10, 10, 10, 0.88)",
        borderRadius: 16,
        padding: "32px 40px",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          fontFamily: font,
          fontSize: 24,
          color: "white",
          textAlign: "center",
          lineHeight: 1.6,
          letterSpacing: "-0.01em",
        }}
      >
        {block.words.map((w, i) => (
          <HighlightWord
            key={`${w.word}-${i}`}
            word={w.word}
            startSec={w.startSec}
            endSec={w.endSec}
            currentSec={currentSec}
          />
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Root overlay — full-duration, renders all sentence panels
// ---------------------------------------------------------------------------

export const TextHighlightSync: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentSec = frame / fps;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {SENTENCES.map((block, i) => (
        <SentencePanel key={i} block={block} currentSec={currentSec} />
      ))}
    </AbsoluteFill>
  );
};
