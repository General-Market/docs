import React from "react";
import { useCurrentFrame } from "remotion";
import { beatPulse } from "../beats";

// Per-letter inner glow. Splits children into spans and animates a
// text-shadow envelope on each span keyed to a beat index. Optional
// per-letter stagger gives a wave; stagger=0 fires every letter
// simultaneously.
//
// One instance reserved for the Solution scene's "$ claude" prompt.
// That budget is intentional — multiplied by every letter on every
// beat, glow becomes noise.

export interface LetterglowProps {
  children: string;
  beatIndex: number;
  // Absolute frame at which the parent's Sequence was mounted. Add
  // this to useCurrentFrame() to recover the global timeline frame
  // (which is what beatPulse expects). Defaults to 0 — correct only
  // if mounted at the composition root with no Sequence above it.
  mountFrame?: number;
  attack?: number;
  decay?: number;
  // Stagger in frames between letters. 0 = all simultaneous.
  stagger?: number;
  // Glow colour. Honours alpha — keep below 0.9 or the glow eats the
  // letter shape.
  color?: string;
  // Max blur radius for the text-shadow at peak.
  maxBlurPx?: number;
  // Number of layered shadows (more = thicker bloom). Cheap on render.
  layers?: number;
  // Style passthrough for the wrapping span.
  style?: React.CSSProperties;
}

export const Letterglow: React.FC<LetterglowProps> = ({
  children,
  beatIndex,
  mountFrame = 0,
  attack = 4,
  decay = 22,
  stagger = 0,
  color = "rgba(91, 134, 255, 0.85)",
  maxBlurPx = 18,
  layers = 3,
  style,
}) => {
  const absoluteFrame = useCurrentFrame() + mountFrame;
  const chars = Array.from(children);

  return (
    <span style={{ display: "inline-block", whiteSpace: "pre", ...style }}>
      {chars.map((ch, i) => {
        const env = beatPulse(absoluteFrame - i * stagger, beatIndex, attack, decay);
        const shadows: string[] = [];
        for (let l = 1; l <= layers; l++) {
          const r = (maxBlurPx * l) / layers;
          shadows.push(`0 0 ${r * env}px ${color}`);
        }
        return (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            style={{
              textShadow: env > 0 ? shadows.join(", ") : "none",
              willChange: env > 0 ? "text-shadow" : undefined,
            }}
          >
            {ch}
          </span>
        );
      })}
    </span>
  );
};
