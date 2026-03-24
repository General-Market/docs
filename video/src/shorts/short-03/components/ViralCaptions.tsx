// Clean podcast-style captions — Montserrat Black, white, full phrase, hard cut
//
// Smart phrase grouping: breaks on punctuation, speech pauses, and max length.

import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import type { Caption } from "../../../lib/types";
import type { ShotDef } from "../types";
import { msToFrame } from "../../../lib/utils/frameConvert";

const { fontFamily } = loadMontserrat("normal", {
  subsets: ["latin"],
  weights: ["800", "900"],
});

const MAX_CAP_WIDTH = 920;
const BASE_FONT_SIZE = 62;

// Phrase grouping config
const MIN_WORDS = 2;
const PAUSE_THRESHOLD_MS = 180; // gap between words that signals a natural break
const CHAR_RATIO = 0.54; // avg char width as fraction of font-size (Montserrat 900)

interface Props {
  captions: Caption[];
  shots: ShotDef[];
  shotFrameOffsets: number[];
  shotFrameDurations: number[];
  /** Show captions this many frames earlier than their timestamp (compensates STT latency). */
  captionLeadFrames?: number;
}

const findCurrentShotIdx = (
  globalFrame: number,
  offsets: number[],
  durations: number[],
): number => {
  for (let i = offsets.length - 1; i >= 0; i--) {
    if (globalFrame >= offsets[i] && globalFrame < offsets[i] + durations[i]) {
      return i;
    }
  }
  return -1;
};

/** Estimate rendered pixel width of a phrase at BASE_FONT_SIZE. */
const estimateWidth = (words: Caption[]): number =>
  words.map((w) => w.text).join("  ").length * BASE_FONT_SIZE * CHAR_RATIO;

/**
 * Smart phrase grouping — breaks on:
 *   1. Width overflow: adding the next word would exceed MAX_CAP_WIDTH
 *   2. Punctuation at end of word (comma, period, question mark, etc.)
 *   3. Timing gap > PAUSE_THRESHOLD_MS between consecutive words
 * Punctuation/gap breaks only fire after MIN_WORDS to avoid single-word phrases.
 */
const smartGroupPhrases = (caps: Caption[]): Caption[][] => {
  const phrases: Caption[][] = [];
  let current: Caption[] = [];

  for (let i = 0; i < caps.length; i++) {
    current.push(caps[i]);

    const atMin = current.length >= MIN_WORDS;
    const isLast = i === caps.length - 1;

    // Check for punctuation break (comma, period, colon, semicolon, dash, !, ?)
    const endsWithPunct = /[,.:;!?\u2014—-]$/.test(caps[i].text);

    // Check for timing gap before next word
    let hasGap = false;
    if (!isLast) {
      const gap = caps[i + 1].startMs - caps[i].endMs;
      hasGap = gap >= PAUSE_THRESHOLD_MS;
    }

    // Would adding the next word overflow the max width?
    let nextOverflows = false;
    if (!isLast) {
      nextOverflows = estimateWidth([...current, caps[i + 1]]) > MAX_CAP_WIDTH;
    }

    if (isLast || nextOverflows || (atMin && (endsWithPunct || hasGap))) {
      phrases.push(current);
      current = [];
    }
  }

  if (current.length > 0) phrases.push(current);
  return phrases;
};

export const ViralCaptions: React.FC<Props> = ({
  captions,
  shots,
  shotFrameOffsets,
  shotFrameDurations,
  captionLeadFrames = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Advance effective frame to compensate STT timestamp latency
  const effectiveFrame = frame + captionLeadFrames;

  if (captions.length === 0) return null;

  const shotIdx = findCurrentShotIdx(frame, shotFrameOffsets, shotFrameDurations);
  if (shotIdx === -1) return null;

  const shot = shots[shotIdx];
  if (!shot || shot.hideCaptions) return null;

  // Filter captions for this shot (frame-based — no ms↔frame drift)
  const shotStartF = shotFrameOffsets[shotIdx];
  const shotEndF = shotStartF + shotFrameDurations[shotIdx];
  const shotCaptions = captions.filter((c) => {
    const capF = msToFrame(c.startMs, fps);
    return capF >= shotStartF && capF < shotEndF;
  });
  if (shotCaptions.length === 0) return null;

  const phrases = smartGroupPhrases(shotCaptions);

  // Find active phrase — the most recent phrase whose first word has been spoken
  let activePhraseIdx = -1;
  for (let i = 0; i < phrases.length; i++) {
    const firstWordFrame = msToFrame(phrases[i][0].startMs, fps);
    if (effectiveFrame >= firstWordFrame) {
      activePhraseIdx = i;
    }
  }
  if (activePhraseIdx === -1) return null;

  // Show full phrase at once (not word-by-word)
  const activePhrase = phrases[activePhraseIdx];
  const phraseText = activePhrase.map((w) => w.text).join("  ");

  const fontSize = BASE_FONT_SIZE;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: "13%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 20,
        textAlign: "center",
        padding: "0 50px",
      }}
    >
      <div
        style={{
          maxWidth: MAX_CAP_WIDTH,
          color: "#FFFFFF",
          fontFamily,
          fontWeight: 900,
          fontSize,
          lineHeight: 1.25,
          wordSpacing: 8,
          textShadow: [
            "2px 2px 0 #000",
            "-2px -2px 0 #000",
            "2px -2px 0 #000",
            "-2px 2px 0 #000",
            "0 2px 0 #000",
            "0 -2px 0 #000",
            "2px 0 0 #000",
            "-2px 0 0 #000",
            "0 4px 12px rgba(0,0,0,0.9)",
          ].join(", "),
        }}
      >
        {phraseText}
      </div>
    </div>
  );
};
