import React from "react";
import { useCurrentFrame, useVideoConfig, spring } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";

const { fontFamily: monoFont } = loadFont();

export const COUNCIL_TEAL = "#0FE8AE";
export const COUNCIL_DARK = "#000000";

export interface AnimatedTextProps {
  /** Full text to reveal, words separated by whitespace. */
  text: string;
  /** Number of trailing words painted in highlightColor. */
  highlightLastN?: number;
  /** Frame the first word starts entering. */
  startFrame?: number;
  /** Frame the whole block starts fading out (defaults to never). */
  fadeOutAt?: number;
  /** Frames the fade out takes. */
  fadeOutFrames?: number;
  /** Frames between successive word entries. */
  framesPerWord?: number;
  /** Spring duration for the trailing word — should be larger than wordSpringFrames so it lands slower. */
  lastWordSpringFrames?: number;
  /** Spring duration for every word except the last. */
  wordSpringFrames?: number;
  /** Pixels each word rises from below. */
  riseFromPx?: number;

  /** Optional icon shown before the text — springs in centered, then rises. */
  icon?: React.ReactNode;
  /** Frame the icon starts springing in. */
  iconStartFrame?: number;
  /** Frame the icon starts rising upward to make room for the text. Defaults to startFrame - 4. */
  iconRiseFrame?: number;
  /** Pixels the icon travels upward during the rise. */
  iconRisePx?: number;

  /** Typography. */
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  highlightColor?: string;
  fontFamily?: string;
  letterSpacing?: number | string;

  /** Container override (defaults to absolute fill). */
  style?: React.CSSProperties;
}

/**
 * Single source of truth for the council video's text reveals.
 * Words enter from below one at a time. The last word's spring is slower.
 * Optionally an icon springs in centered and then rises before the text appears.
 */
export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  highlightLastN = 0,
  startFrame = 0,
  fadeOutAt,
  fadeOutFrames = 8,
  framesPerWord = 6,
  wordSpringFrames = 10,
  lastWordSpringFrames = 22,
  riseFromPx = 44,
  icon,
  iconStartFrame = 0,
  iconRiseFrame,
  iconRisePx = 110,
  fontSize = 54,
  fontWeight = 600,
  color = COUNCIL_DARK,
  highlightColor = COUNCIL_TEAL,
  fontFamily = monoFont,
  letterSpacing = -0.5,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const words = text.split(/\s+/).filter(Boolean);
  const total = words.length;
  const effectiveIconRise = iconRiseFrame ?? Math.max(iconStartFrame, startFrame - 6);

  const iconScale = spring({
    frame: Math.max(0, frame - iconStartFrame),
    fps,
    config: { damping: 14, stiffness: 130, mass: 0.7 },
    durationInFrames: 14,
  });
  const iconRiseProgress = spring({
    frame: Math.max(0, frame - effectiveIconRise),
    fps,
    config: { damping: 18, stiffness: 110, mass: 0.8 },
    durationInFrames: 16,
  });
  const iconCurrentY = -iconRisePx * iconRiseProgress;

  const blockOpacity = (() => {
    if (fadeOutAt === undefined) return 1;
    if (frame <= fadeOutAt) return 1;
    if (frame >= fadeOutAt + fadeOutFrames) return 0;
    return 1 - (frame - fadeOutAt) / fadeOutFrames;
  })();

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity: blockOpacity,
        ...style,
      }}
    >
      {icon ? (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, calc(-50% + ${iconCurrentY}px)) scale(${iconScale})`,
            transformOrigin: "center center",
            pointerEvents: "none",
          }}
        >
          {icon}
        </div>
      ) : null}

      {/*
        Layout note: we use inline-block + text-align center, not flex.
        Flex with gap was causing the first word to appear to drift right
        when subsequent words entered. Inline layout with real space
        characters between spans is layout-stable from frame 0 because
        the browser's text engine reserves space for every span at mount,
        regardless of opacity or transform.
      */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
          whiteSpace: "nowrap",
          fontFamily,
          fontSize,
          fontWeight,
          letterSpacing,
          lineHeight: 1,
        }}
      >
        {words.map((word, i) => {
          const isLast = i === total - 1;
          const isHighlight = i >= total - highlightLastN;
          const wordStart = startFrame + i * framesPerWord;
          const elapsed = frame - wordStart;
          const dur = isLast ? lastWordSpringFrames : wordSpringFrames;
          const stiffness = isLast ? 60 : 120;
          const damping = isLast ? 20 : 22;
          const progress = spring({
            frame: Math.max(0, elapsed),
            fps,
            config: { damping, stiffness, mass: 0.8, overshootClamping: true },
            durationInFrames: dur,
          });
          const opacity = elapsed < 0 ? 0 : progress;
          const translateY = (1 - progress) * riseFromPx;
          return (
            <React.Fragment key={i}>
              {i > 0 ? " " : null}
              <span
                style={{
                  display: "inline-block",
                  opacity,
                  transform: `translate3d(0, ${translateY}px, 0)`,
                  color: isHighlight ? highlightColor : color,
                  willChange: "transform, opacity",
                }}
              >
                {word}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
