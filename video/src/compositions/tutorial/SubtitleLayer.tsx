import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { font } from "../../common/fonts";
import { lerp } from "../../common/utils";
import { transcriptSegments } from "./transcriptData";

const FPS = 30;
const MAX_VISIBLE_WORDS = 12;
const PILL_BOTTOM = 100;
const PILL_PADDING_X = 28;
const PILL_PADDING_Y = 14;
const PILL_BORDER_RADIUS = 20;
const PILL_BG = "rgba(0, 0, 0, 0.7)";

const WORD_FONT_SIZE = 32;
const ACTIVE_FONT_SIZE = 36;
const WORD_GAP = 8;

const CROSSFADE_FRAMES = 8;

interface WordSpan {
  word: string;
  startFrame: number;
  endFrame: number;
  segmentIndex: number;
}

// Flatten all segment words into a single timeline with frame timing
const allWords: WordSpan[] = transcriptSegments.flatMap((seg, segIdx) =>
  seg.words.map((w) => ({
    word: w.word,
    startFrame: Math.round(w.startSec * FPS),
    endFrame: Math.round(w.endSec * FPS),
    segmentIndex: segIdx,
  }))
);

interface WordGroup {
  words: WordSpan[];
  startFrame: number;
  endFrame: number;
}

function buildGroups(): WordGroup[] {
  const groups: WordGroup[] = [];
  let i = 0;

  while (i < allWords.length) {
    // Collect up to MAX_VISIBLE_WORDS, but break at segment boundaries
    const chunk: WordSpan[] = [];
    const startSegment = allWords[i].segmentIndex;

    for (let j = i; j < allWords.length && chunk.length < MAX_VISIBLE_WORDS; j++) {
      // If this word belongs to a different segment and we already have words, break
      if (allWords[j].segmentIndex !== startSegment && chunk.length > 0) {
        break;
      }
      chunk.push(allWords[j]);
    }

    const startFrame = chunk[0].startFrame;
    const lastWord = chunk[chunk.length - 1];
    const endFrame = lastWord.endFrame;

    groups.push({ words: chunk, startFrame, endFrame });
    i += chunk.length;
  }

  return groups;
}

const wordGroups = buildGroups();

function findActiveGroup(frame: number): WordGroup | null {
  for (let i = wordGroups.length - 1; i >= 0; i--) {
    if (frame >= wordGroups[i].startFrame) {
      return wordGroups[i];
    }
  }
  return null;
}

function findActiveWordIndex(group: WordGroup, frame: number): number {
  let active = -1;
  for (let i = 0; i < group.words.length; i++) {
    if (frame >= group.words[i].startFrame) {
      active = i;
    }
  }
  return active;
}

const WordToken: React.FC<{
  span: WordSpan;
  state: "past" | "active" | "future";
  frame: number;
  fps: number;
}> = ({ span, state, frame, fps }) => {
  const scaleSpring =
    state === "active"
      ? spring({
          frame: frame - span.startFrame,
          fps,
          config: { damping: 14, stiffness: 180, mass: 0.6 },
        })
      : 1;

  const scale = state === "active" ? 1 + scaleSpring * 0.05 : 1;
  const opacity = state === "past" ? 0.7 : state === "future" ? 0.35 : 1;
  const fontSize = state === "active" ? ACTIVE_FONT_SIZE : WORD_FONT_SIZE;
  const fontWeight: number = state === "active" ? 700 : state === "past" ? 500 : 400;

  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font,
        fontSize,
        fontWeight,
        color: "white",
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: "center bottom",
        marginRight: WORD_GAP,
        lineHeight: 1.4,
      }}
    >
      {span.word}
    </span>
  );
};

export const SubtitleLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeSec = frame / fps;

  const currentSegmentIdx = transcriptSegments.findIndex(
    (seg) => currentTimeSec >= seg.startSec && currentTimeSec < seg.endSec
  );

  if (currentSegmentIdx === -1) {
    return null;
  }

  const group = findActiveGroup(frame);
  if (!group || group.words.length === 0) {
    return null;
  }

  const activeIdx = findActiveWordIndex(group, frame);

  const pillFadeIn = lerp(
    frame,
    [group.startFrame - CROSSFADE_FRAMES, group.startFrame],
    [0, 1]
  );
  const pillFadeOut = lerp(
    frame,
    [group.endFrame - CROSSFADE_FRAMES, group.endFrame],
    [1, 0]
  );
  const pillOpacity = Math.min(pillFadeIn, pillFadeOut);

  const slideY = lerp(
    frame,
    [group.startFrame - CROSSFADE_FRAMES, group.startFrame],
    [8, 0]
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          marginBottom: PILL_BOTTOM,
          background: PILL_BG,
          borderRadius: PILL_BORDER_RADIUS,
          paddingLeft: PILL_PADDING_X,
          paddingRight: PILL_PADDING_X,
          paddingTop: PILL_PADDING_Y,
          paddingBottom: PILL_PADDING_Y,
          maxWidth: 1400,
          textAlign: "center",
          opacity: pillOpacity,
          transform: `translateY(${slideY}px)`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            gap: 2,
          }}
        >
          {group.words.map((span, i) => {
            const state: "past" | "active" | "future" =
              i < activeIdx ? "past" : i === activeIdx ? "active" : "future";

            return (
              <WordToken
                key={`${span.startFrame}-${i}`}
                span={span}
                state={state}
                frame={frame}
                fps={fps}
              />
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
