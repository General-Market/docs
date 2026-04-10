import React from "react";
import {
  interpolate,
  useCurrentFrame,
} from "remotion";
import { COLOR, FONT } from "../designTokens";
import { FPS } from "../theme";
import { useTalkingHead } from "../TalkingHeadLayout";

const sec = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const WISE_GREEN = [159, 232, 112] as const;

const easeIn = (t: number, power: number): number =>
  Math.pow(Math.max(0, Math.min(1, t)), power);

/**
 * TypewriterPhrase — Ember-style character-by-character reveal.
 * Green→white color sweep per character, then wipe out.
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
  fontSize = 48,
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
    <div
      style={{
        fontFamily: FONT.display,
        fontSize,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        whiteSpace: "nowrap",
        fontFeatureSettings: '"calt" 1',
        textAlign: "center",
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
          <span key={i} style={{ color: COLOR.gray }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/**
 * IntroTextOverlay — "How to launch your first general market bot
 * in only five minutes." synced to speech (0.16s–3.44s).
 *
 * Positioned in the bottom content area below the webcam,
 * replacing the static "General Market" bottomLabel.
 */
export const IntroTextOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { contentArea } = useTalkingHead();

  // Only render when content area exists (centered-bottom layout)
  if (!contentArea) return null;
  // Only active during the intro
  if (frame > sec(3.5)) return null;

  const enterOpacity = interpolate(frame, [sec(0.1), sec(0.3)], [0, 1], clamp);
  const exitOpacity = interpolate(frame, [sec(3.2), sec(3.44)], [1, 0], clamp);
  const opacity = Math.min(enterOpacity, exitOpacity);
  const slideY = interpolate(enterOpacity, [0, 1], [12, 0], clamp);

  return (
    <div
      style={{
        position: "absolute",
        left: contentArea.x,
        top: contentArea.y,
        width: contentArea.w,
        height: contentArea.h,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity,
        transform: `translateY(${slideY}px)`,
        pointerEvents: "none",
      }}
    >
      <TypewriterPhrase
        text="How to launch your first"
        typeStart={sec(0.16)}
        typeEnd={sec(1.04)}
        wipeStart={sec(1.2)}
        wipeEnd={sec(1.36)}
      />
      <TypewriterPhrase
        text="general market bot"
        typeStart={sec(1.36)}
        typeEnd={sec(2.0)}
        wipeStart={sec(2.16)}
        wipeEnd={sec(2.32)}
        typePower={1.5}
      />
      <TypewriterPhrase
        text="in only five minutes"
        typeStart={sec(2.32)}
        typeEnd={sec(2.96)}
        wipeStart={sec(3.16)}
        wipeEnd={sec(3.44)}
        typePower={1.5}
      />
    </div>
  );
};
