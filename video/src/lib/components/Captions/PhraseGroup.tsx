import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { Caption } from "../../types";
import { msToFrame } from "../../utils/frameConvert";
import { WordPopIn } from "./WordPopIn";
import type { CaptionStyleConfig } from "./captionStyles";
import { getWordStyle } from "./captionStyles";

interface Props {
  words: Caption[];
  keywords: string[];
  style: CaptionStyleConfig;
}

export const PhraseGroup: React.FC<Props> = ({ words, keywords, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()));

  // Find which word is currently being spoken
  let currentWordIdx = -1;
  for (let i = 0; i < words.length; i++) {
    const start = msToFrame(words[i].startMs, fps);
    const end = msToFrame(words[i].endMs, fps);
    if (frame >= start && frame < end) {
      currentWordIdx = i;
      break;
    }
  }

  return (
    <div
      style={{
        ...getWordStyle(style),
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {words.map((word, i) => (
        <WordPopIn
          key={`${word.startMs}-${i}`}
          word={word}
          isCurrentWord={i === currentWordIdx}
          isKeyword={keywordSet.has(word.text.toLowerCase().replace(/[^a-z]/g, ""))}
          highlightColor={style.highlightColor}
          currentWordColor={style.currentWordColor}
          keywords={keywords}
        />
      ))}
    </div>
  );
};
