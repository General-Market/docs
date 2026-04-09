import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { C } from "../../../common/colors";
import { monoFont } from "../../../common/fonts";
import { EASE } from "../../../common/easing";
import { lerp } from "../../../common/utils";
import { FPS, BRAND_GREEN } from "../theme";

const PROMPT_TEXT =
  'claude "Build me a bot about Twitch viewer strategy for generalmarket.io"';

const RESPONSE_LINES = [
  { text: "I'll create a Twitch viewer prediction strategy...", delay: 0 },
  { text: "", delay: 8 },
  { text: "Setting up market connection...", delay: 16 },
  { text: "Analyzing 5,000 streamer patterns...", delay: 28 },
  { text: "Building prediction model...", delay: 40 },
];

/** Seconds → local frames */
const s = (seconds: number) => Math.round(seconds * FPS);

// Timing landmarks (local frames)
const SLIDE_IN_DUR = s(0.6);
const TYPE_START = s(0.4);
const TYPE_END = s(3);
const RESPONSE_START = s(3);
const CARD_IN = s(6);
const CARD_HOLD_END = s(9);
const CARD_OUT = s(10);
const SHRINK_START = s(10);
const SHRINK_END = s(14);

// Total scene duration: 57.76 - 42.80 = 14.96s
const SCENE_DUR = s(14.96);

export const ClaudeTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // --- Terminal slide-in from right ---
  const slideIn = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 180, mass: 0.8 },
    durationInFrames: SLIDE_IN_DUR,
  });
  const panelX = interpolate(slideIn, [0, 1], [800, 0]);

  // --- Shrink animation ---
  const shrinkProgress = lerp(
    frame,
    [SHRINK_START, SHRINK_END],
    [0, 1],
    EASE.inOut
  );

  const panelWidth = interpolate(shrinkProgress, [0, 1], [45, 16]);
  const panelHeight = interpolate(shrinkProgress, [0, 1], [100, 6]);
  const panelTop = interpolate(shrinkProgress, [0, 1], [0, 2]);
  const panelRight = interpolate(shrinkProgress, [0, 1], [0, 2]);
  const panelBorderRadius = interpolate(shrinkProgress, [0, 1], [0, 12]);
  const panelOpacity = lerp(frame, [0, s(0.3)], [0, 1]);
  const isShrunk = shrinkProgress >= 1;

  // --- Typing animation ---
  const typeProgress = lerp(frame, [TYPE_START, TYPE_END], [0, 1]);
  const charsVisible = Math.floor(typeProgress * PROMPT_TEXT.length);
  const typedText = PROMPT_TEXT.slice(0, charsVisible);

  // --- Cursor blink (toggles every 8 frames, ~270ms) ---
  const cursorVisible =
    frame < SHRINK_START &&
    (frame < TYPE_END || Math.floor(frame / 8) % 2 === 0);

  // --- Response streaming ---
  const responseFrame = frame - RESPONSE_START;

  // --- "While the bot builds" card ---
  const cardOpacity =
    frame >= CARD_IN && frame < CARD_OUT
      ? frame < CARD_IN + s(0.4)
        ? lerp(frame, [CARD_IN, CARD_IN + s(0.4)], [0, 1])
        : frame > CARD_HOLD_END
          ? lerp(frame, [CARD_HOLD_END, CARD_OUT], [1, 0])
          : 1
      : 0;

  const cardScale =
    frame >= CARD_IN
      ? spring({
          frame: frame - CARD_IN,
          fps,
          config: { damping: 20, stiffness: 120, mass: 0.6 },
        })
      : 0;

  // --- Indicator pulsing dot (1 Hz sine) ---
  const pulseOpacity = isShrunk
    ? 0.4 + 0.6 * Math.sin(((frame - SHRINK_END) / fps) * Math.PI * 2)
    : 1;

  // Content opacity fades out during shrink
  const contentOpacity = lerp(
    frame,
    [SHRINK_START, SHRINK_START + s(0.5)],
    [1, 0]
  );

  // Typing click volume: ramps in and out with the typing window
  const typingVolume = lerp(frame, [TYPE_START, TYPE_END], [0.15, 0], EASE.in);

  return (
    <AbsoluteFill>
      {/* SFX: terminal slide in */}
      <Audio
        src={staticFile("sfx/cut-fast-swish.mp3")}
        startFrom={0}
        volume={0.6}
      />

      {/* SFX: typing clicks — Sequence bounds prevent mount/unmount flicker */}
      <Sequence from={TYPE_START} durationInFrames={TYPE_END - TYPE_START}>
        <Audio
          src={staticFile("sfx/cursor-click-soft.mp3")}
          volume={typingVolume}
          loop
        />
      </Sequence>

      {/* SFX: "While the bot builds" reveal */}
      <Sequence from={CARD_IN} durationInFrames={SCENE_DUR - CARD_IN}>
        <Audio src={staticFile("sfx/dramatic-reveal.mp3")} volume={0.5} />
      </Sequence>

      {/* Terminal panel */}
      <div
        style={{
          position: "absolute",
          top: `${panelTop}%`,
          right: `${panelRight}%`,
          width: `${panelWidth}%`,
          height: `${panelHeight}%`,
          background: C.black,
          borderLeft: isShrunk ? "none" : `1px solid ${C.gray[700]}`,
          border: isShrunk ? `1px solid ${C.gray[700]}` : undefined,
          borderRadius: panelBorderRadius,
          transform: `translateX(${panelX}px)`,
          opacity: panelOpacity,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: isShrunk
            ? "0 4px 24px rgba(0,0,0,0.6)"
            : "0 0 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* Shrunk indicator state */}
        {isShrunk ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 18px",
              fontFamily: monoFont,
              fontSize: 16,
              color: C.gray[200],
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: BRAND_GREEN,
                opacity: pulseOpacity,
                boxShadow: `0 0 6px ${BRAND_GREEN}`,
              }}
            />
            Building strategy...
          </div>
        ) : (
          <>
            {/* Terminal header bar — macOS traffic lights */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 18px",
                borderBottom: `1px solid ${C.gray[800]}`,
                opacity: contentOpacity,
              }}
            >
              {(["#FF5F56", "#FFBD2E", "#27C93F"] as const).map((color) => (
                <div
                  key={color}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                  }}
                />
              ))}
              <span
                style={{
                  fontFamily: monoFont,
                  fontSize: 14,
                  color: C.gray[400],
                  marginLeft: 12,
                  letterSpacing: 0.5,
                }}
              >
                Claude Code
              </span>
            </div>

            {/* Terminal body */}
            <div
              style={{
                flex: 1,
                padding: "20px 24px",
                fontFamily: monoFont,
                fontSize: 18,
                lineHeight: 1.7,
                opacity: contentOpacity,
                overflow: "hidden",
              }}
            >
              {/* Prompt line */}
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                <span style={{ color: BRAND_GREEN, fontWeight: 700 }}>$ </span>
                <span style={{ color: C.gray[200] }}>{typedText}</span>
                {cursorVisible && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 22,
                      background: C.gray[200],
                      marginLeft: 2,
                      verticalAlign: "text-bottom",
                    }}
                  />
                )}
              </div>

              {/* Response lines — stream in after typing completes */}
              {frame >= RESPONSE_START && (
                <div style={{ marginTop: 20 }}>
                  {RESPONSE_LINES.map((line, i) => {
                    const lineFrame = responseFrame - line.delay;
                    if (lineFrame < 0) return null;

                    if (line.text === "") {
                      return <div key={i} style={{ height: 10 }} />;
                    }

                    const lineOpacity = lerp(
                      lineFrame,
                      [0, 6],
                      [0, 1],
                      EASE.out
                    );

                    const lineY = interpolate(lineFrame, [0, 6], [8, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                      easing: EASE.out,
                    });

                    return (
                      <div
                        key={i}
                        style={{
                          opacity: lineOpacity,
                          transform: `translateY(${lineY}px)`,
                          color: C.gray[200],
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ color: C.gray[500] }}>{">"} </span>
                        {highlightKeywords(line.text)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* "While the bot builds..." overlay card */}
      {cardOpacity > 0 && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: `translate(-50%, -50%) scale(${cardScale})`,
            opacity: cardOpacity,
            background: "rgba(10, 10, 10, 0.92)",
            border: `1px solid ${C.gray[700]}`,
            borderRadius: 16,
            padding: "44px 64px",
            textAlign: "center",
            boxShadow: "0 8px 48px rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 32,
              fontWeight: 600,
              color: C.white,
              lineHeight: 1.5,
            }}
          >
            While the bot builds,
            <br />
            let&#39;s answer your questions.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Highlight specific keywords in accent purple */
function highlightKeywords(text: string): React.ReactNode {
  const keywords = [
    "prediction strategy",
    "market connection",
    "5,000",
    "streamer patterns",
    "prediction model",
  ];

  let segments: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  for (const keyword of keywords) {
    const idx = remaining.indexOf(keyword);
    if (idx >= 0) {
      if (idx > 0) {
        segments.push(
          <span key={`t-${keyIndex}`}>{remaining.slice(0, idx)}</span>
        );
      }
      segments.push(
        <span key={`k-${keyIndex}`} style={{ color: C.accent }}>
          {keyword}
        </span>
      );
      remaining = remaining.slice(idx + keyword.length);
      keyIndex++;
    }
  }

  if (remaining) {
    segments.push(<span key="rest">{remaining}</span>);
  }

  return segments.length > 0 ? <>{segments}</> : text;
}
