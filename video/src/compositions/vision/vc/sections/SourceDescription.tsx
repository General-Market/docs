/**
 * SourceDescription — bottom-left data source description text
 *
 * Word-by-word reveal with typing cursor.
 * Each word slides in from the right (3px) with 3-frame stagger.
 * A blinking cursor trails the last revealed word, then fades
 * 0.5s (15 frames) after all words have landed.
 */
import React from "react";
import { useCurrentFrame, interpolate, useVideoConfig, spring } from "remotion";

interface SourceDescriptionProps {
  text: string;
  /** Delay in frames before text appears (default 15 = 0.5s) */
  delay?: number;
}

const WORD_GAP = 3; // frames between each word reveal
const WORD_ENTRANCE = 6; // frames for each word's fade+slide animation
const CURSOR_LINGER = 15; // frames cursor stays after last word (0.5s at 30fps)
const CURSOR_FADE = 8; // frames for cursor fade-out

export const SourceDescription: React.FC<SourceDescriptionProps> = ({
  text,
  delay = 15,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Frame at which the last word finishes appearing
  const lastWordStart = delay + (totalWords - 1) * WORD_GAP;
  const lastWordEnd = lastWordStart + WORD_ENTRANCE;

  // Container spring entrance: starts at delay
  const containerSpring = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 12, mass: 0.8 },
  });
  const containerOpacity = interpolate(containerSpring, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });
  const containerY = interpolate(containerSpring, [0, 1], [30, 0]);

  if (containerOpacity <= 0) return null;

  // Cursor blink: 0.5s period (15 frames at 30fps) — on/off square wave
  const blinkPeriod = Math.round(fps * 0.5);
  const cursorVisible = Math.floor((frame - delay) / blinkPeriod) % 2 === 0;

  // Cursor opacity: full while words revealing + linger, then fades
  const cursorFadeStart = lastWordEnd + CURSOR_LINGER;
  const cursorFadeEnd = cursorFadeStart + CURSOR_FADE;
  const cursorOpacity = interpolate(
    frame,
    [cursorFadeStart, cursorFadeEnd],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const showCursor = frame >= delay && cursorOpacity > 0 && cursorVisible;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 56,
        left: 60,
        maxWidth: 700,
        opacity: containerOpacity,
        transform: `translateY(${containerY}px)`,
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        fontWeight: 600,
        fontSize: 24,
        color: "#fafafa",
        lineHeight: 1.5,
        letterSpacing: "-0.01em",
        textShadow:
          "0 2px 8px rgba(0,0,0,0.9), 0 0 30px rgba(0,0,0,0.5)",
        // Pull-quote left border
        borderLeft: "3px solid rgba(255, 255, 255, 0.25)",
        paddingLeft: 20,
        // Readability gradient behind text
        background:
          "linear-gradient(to right, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.2) 80%, transparent 100%)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        paddingTop: 12,
        paddingBottom: 12,
        paddingRight: 32,
      }}
    >
      <span style={{ display: "inline" }}>
        {words.map((word, i) => {
          const wordStart = delay + i * WORD_GAP;
          const wordEnd = wordStart + WORD_ENTRANCE;

          const wordOpacity = interpolate(
            frame,
            [wordStart, wordEnd],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          const wordTranslateX = interpolate(
            frame,
            [wordStart, wordEnd],
            [3, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          if (wordOpacity <= 0) return null;

          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: wordOpacity,
                transform: `translateX(${wordTranslateX}px)`,
                marginRight: 6,
              }}
            >
              {word}
            </span>
          );
        })}
        {showCursor && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: "1.1em",
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              opacity: cursorOpacity,
              verticalAlign: "text-bottom",
              marginLeft: 2,
            }}
          />
        )}
      </span>
    </div>
  );
};
