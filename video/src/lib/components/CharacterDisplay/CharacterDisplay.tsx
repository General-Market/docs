import React from "react";
import { Img, staticFile, useVideoConfig } from "remotion";
import type { Emotion } from "../../types";
import type {
  CharacterDisplayProps,
  CharacterPreset,
  CharacterPosition,
  BubblePosition,
} from "./types";
import { getPreset } from "./CharacterPresets";

// Reuse existing Chibi animation wrappers
import { ChibiEntrance } from "../Chibi/ChibiEntrance";
import { ChibiBeatPulse } from "../Chibi/ChibiBeatPulse";
import { ChibiIdle } from "../Chibi/ChibiIdle";
import { ChibiShadow } from "../Chibi/ChibiShadow";
import { ChibiExit } from "../Chibi/ChibiExit";

// Bubble components
import { ThoughtBubble } from "./ThoughtBubble";
import { SpeechBubble } from "./SpeechBubble";

// ─── Position Coordinates ─────────────────────────────────────────────

const DEFAULT_SIZE = 750;

/** Returns absolute CSS position for the character container */
const getPositionStyle = (
  position: CharacterPosition,
  size: number,
  width: number,
  height: number,
): React.CSSProperties => {
  const halfSize = size / 2;
  const margin = 40;

  switch (position) {
    case "bottom-left":
      return { position: "absolute", left: margin, bottom: margin };
    case "bottom-center":
      return {
        position: "absolute",
        left: width / 2 - halfSize,
        bottom: margin,
      };
    case "bottom-right":
      return { position: "absolute", right: margin, bottom: margin };
    case "center-left":
      return {
        position: "absolute",
        left: margin,
        top: height / 2 - halfSize,
      };
    case "center-right":
      return {
        position: "absolute",
        right: margin,
        top: height / 2 - halfSize,
      };
    case "top-left":
      return { position: "absolute", left: margin, top: margin };
    case "top-right":
      return { position: "absolute", right: margin, top: margin };
    default:
      return {
        position: "absolute",
        left: width / 2 - halfSize,
        bottom: margin,
      };
  }
};

/** Auto-resolve bubble position based on character position */
const resolveBubblePosition = (
  charPosition: CharacterPosition,
  explicit?: BubblePosition,
): "above-left" | "above-right" => {
  if (explicit && explicit !== "auto") return explicit;
  // If character is on the right, bubble goes above-left and vice versa
  if (charPosition.includes("right")) return "above-left";
  return "above-right";
};

/** Emotion → PNG filename (default convention) */
const emotionToFile = (
  emotion: Emotion,
  emotionMap?: Partial<Record<Emotion, string>>,
): string => {
  if (emotionMap?.[emotion]) return emotionMap[emotion]!;
  return `${emotion}.png`;
};

// ─── Component ────────────────────────────────────────────────────────

export const CharacterDisplay: React.FC<CharacterDisplayProps> = ({
  character,
  emotion = "neutral",
  position = "bottom-center",
  size: sizeProp,
  beatFrames,
  bubble,
  animation,
  style,
}) => {
  const { width, height } = useVideoConfig();

  // ── Resolve preset ──────────────────────────────────────────────
  let preset: CharacterPreset;

  if (typeof character === "string") {
    const found = getPreset(character);
    if (!found) {
      // Fallback: treat as assetDir
      preset = {
        id: character,
        name: character,
        assetDir: character,
        defaultSize: DEFAULT_SIZE,
        shadow: true,
      };
    } else {
      preset = found;
    }
  } else {
    // Inline character config
    preset = {
      id: character.id,
      name: character.id,
      assetDir: character.assetDir,
      accentColor: character.accentColor,
      defaultSize: character.defaultSize ?? DEFAULT_SIZE,
      emotionMap: character.emotionMap,
      shadow: true,
    };
  }

  const size = sizeProp ?? preset.defaultSize ?? DEFAULT_SIZE;
  const accentColor = preset.accentColor ?? "#00D4FF";
  const showShadow = preset.shadow !== false;

  // ── Animation config defaults ───────────────────────────────────
  const {
    entrance = true,
    entranceFrame = 6,
    beatPulse = !!beatFrames,
    beatIntensity = 0.06,
    idle = true,
    exit = false,
    exitFrame = 999999,
  } = animation ?? {};

  // ── Image source ────────────────────────────────────────────────
  const file = emotionToFile(emotion, preset.emotionMap);
  const src = staticFile(`${preset.assetDir}/${file}`);

  // ── Position styles ─────────────────────────────────────────────
  const positionStyle = getPositionStyle(position, size, width, height);

  // ── Bubble setup ────────────────────────────────────────────────
  const showBubble = bubble && bubble.type !== "none" && bubble.text;
  const bubbleSide = resolveBubblePosition(position, bubble?.bubblePosition);
  const bubbleDelay = bubble?.delay ?? 12;
  const bubbleStartFrame = entranceFrame + bubbleDelay;

  // Bubble offset position relative to character
  const bubbleStyle: React.CSSProperties = {
    position: "absolute",
    bottom: size * 0.7,
    ...(bubbleSide === "above-left"
      ? { right: size * 0.3 }
      : { left: size * 0.3 }),
    zIndex: 2,
  };

  // ── Render tree ─────────────────────────────────────────────────
  // Build the character image core
  let core = (
    <Img
      src={src}
      style={{ width: size, height: "auto", objectFit: "contain" }}
    />
  );

  // Wrap in idle
  if (idle) {
    core = <ChibiIdle>{core}</ChibiIdle>;
  }

  // Wrap in beat pulse
  if (beatPulse && beatFrames && beatFrames.length > 0) {
    core = (
      <ChibiBeatPulse beatFrames={beatFrames} intensity={beatIntensity}>
        {core}
      </ChibiBeatPulse>
    );
  }

  // Wrap in entrance
  if (entrance) {
    core = (
      <ChibiEntrance startFrame={entranceFrame} durationFrames={12}>
        {core}
      </ChibiEntrance>
    );
  }

  // Wrap in exit
  if (exit) {
    core = <ChibiExit triggerFrame={exitFrame}>{core}</ChibiExit>;
  }

  return (
    <div
      style={{
        ...positionStyle,
        width: size,
        height: size,
        zIndex: 10,
        ...style,
      }}
    >
      {/* Shadow */}
      {showShadow && <ChibiShadow width={size * 0.6} />}

      {/* Character with animation stack */}
      {core}

      {/* Bubble */}
      {showBubble && bubble!.type === "thought" && (
        <div style={bubbleStyle}>
          <ThoughtBubble
            text={bubble!.text}
            startFrame={bubbleStartFrame}
            maxWidth={bubble!.maxWidth}
            fontSize={bubble!.fontSize}
            accentColor={bubble!.accentColor ?? accentColor}
            anchorLeft={bubbleSide === "above-left"}
          />
        </div>
      )}

      {showBubble && bubble!.type === "speech" && (
        <div style={bubbleStyle}>
          <SpeechBubble
            text={bubble!.text}
            startFrame={bubbleStartFrame}
            maxWidth={bubble!.maxWidth}
            fontSize={bubble!.fontSize}
            accentColor={bubble!.accentColor ?? accentColor}
            typewriter={bubble!.typewriter ?? true}
            tailRight={bubbleSide === "above-left"}
          />
        </div>
      )}
    </div>
  );
};
