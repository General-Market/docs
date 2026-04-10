import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FONT } from "../designTokens";
import { FPS } from "../theme";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const WISE_GREEN = [159, 232, 112] as const; // COLOR.wiseGreen in RGB

const easeIn = (t: number, power: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), power);

/**
 * TypewriterPhrase — Ember-style character-by-character reveal.
 *
 * Characters appear left-to-right with a green→white color sweep.
 * Then wipe out left-to-right before the next phrase.
 */
const TypewriterPhrase: React.FC<{
  text: string;
  typeStart: number;
  typeEnd: number;
  wipeStart: number;
  wipeEnd: number;
  fontSize?: number;
  typePower?: number;
}> = ({
  text,
  typeStart,
  typeEnd,
  wipeStart,
  wipeEnd,
  fontSize = 80,
  typePower = 2.5,
}) => {
  const frame = useCurrentFrame();
  const len = text.length;

  if (frame < typeStart || frame > wipeEnd) return null;

  let visibleStart = 0;
  let visibleEnd = 0;
  let phase: "typing" | "hold" | "wiping" = "hold";

  if (frame < typeEnd) {
    phase = "typing";
    const t = (frame - typeStart) / (typeEnd - typeStart);
    visibleEnd = Math.min(len, Math.max(1, Math.round(len * easeIn(t, typePower))));
  } else if (frame < wipeStart) {
    phase = "hold";
    visibleEnd = len;
  } else {
    phase = "wiping";
    const t = (frame - wipeStart) / (wipeEnd - wipeStart);
    const removed = Math.min(len, Math.round(len * easeIn(t, 2)));
    visibleStart = removed;
    visibleEnd = len;
  }

  if (visibleEnd <= visibleStart) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT.display,
          fontSize,
          fontWeight: 900,
          lineHeight: 0.85,
          letterSpacing: "-0.02em",
          whiteSpace: "nowrap",
          fontFeatureSettings: '"calt" 1',
        }}
      >
        {text.split("").map((ch, i) => {
          if (i < visibleStart || i >= visibleEnd) return null;

          if (phase === "typing") {
            const currentT = (frame - typeStart) / (typeEnd - typeStart);
            const charThreshold = i / len;
            const age =
              (easeIn(currentT, typePower) - charThreshold) *
              (typeEnd - typeStart);
            const colorT = interpolate(age, [0, 4], [0, 1], clamp);
            const r = interpolate(colorT, [0, 1], [WISE_GREEN[0], 255]);
            const g = interpolate(colorT, [0, 1], [WISE_GREEN[1], 255]);
            const b = interpolate(colorT, [0, 1], [WISE_GREEN[2], 255]);
            return (
              <span key={i} style={{ color: `rgb(${r},${g},${b})` }}>
                {ch}
              </span>
            );
          }

          if (phase === "wiping") {
            const dist = i - visibleStart;
            const op = interpolate(dist, [0, 3], [0.15, 1], clamp);
            return (
              <span key={i} style={{ color: `rgba(255,255,255,${op})` }}>
                {ch}
              </span>
            );
          }

          return (
            <span key={i} style={{ color: "white" }}>
              {ch}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * IntroTextOverlay — "How to launch your first general market bot
 * in only five minutes." synced to speech (0.16s–3.44s).
 *
 * Three phrases replace each other, Ember-style:
 *   1. "How to launch your first"   (0.16–1.36s)
 *   2. "general market bot"          (1.36–2.32s)
 *   3. "in only five minutes"        (2.32–3.44s)
 */
export const IntroTextOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  // Dark vignette backdrop for readability over webcam
  const backdropOpacity = interpolate(
    frame,
    [sec(0.1), sec(0.3), sec(3.2), sec(3.5)],
    [0, 0.7, 0.7, 0],
    clamp,
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Backdrop */}
      {backdropOpacity > 0.01 && (
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 70% at 50% 50%, rgba(14,15,12,${backdropOpacity}) 0%, transparent 100%)`,
          }}
        />
      )}

      {/* Phrase 1: "How to launch your first" — speech: 0.16s–1.36s */}
      <TypewriterPhrase
        text="How to launch your first"
        typeStart={sec(0.16)}
        typeEnd={sec(1.04)}
        wipeStart={sec(1.2)}
        wipeEnd={sec(1.36)}
        fontSize={80}
      />

      {/* Phrase 2: "general market bot" — speech: 1.36s–2.32s */}
      <TypewriterPhrase
        text="general market bot"
        typeStart={sec(1.36)}
        typeEnd={sec(2.0)}
        wipeStart={sec(2.16)}
        wipeEnd={sec(2.32)}
        fontSize={80}
        typePower={1.5}
      />

      {/* Phrase 3: "in only five minutes" — speech: 2.32s–3.44s */}
      <TypewriterPhrase
        text="in only five minutes"
        typeStart={sec(2.32)}
        typeEnd={sec(2.96)}
        wipeStart={sec(3.16)}
        wipeEnd={sec(3.44)}
        fontSize={80}
        typePower={1.5}
      />
    </AbsoluteFill>
  );
};
