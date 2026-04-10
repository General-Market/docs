import React from "react";
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FAQ } from "../designTokens";
import { FPS } from "../theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

interface FaqEntry {
  number: string;
  text: string;
  startSec: number;
}

const FAQ_QUESTIONS: FaqEntry[] = [
  {
    number: "Q1",
    text: "How does General Market ensure\nliquidity on 500,000 markets?",
    startSec: 48.64,
  },
  {
    number: "Q2",
    text: "How does pricing work\nwith 10-minute settlements?",
    startSec: 89.84,
  },
  {
    number: "Q3",
    text: "How is General Market private\nwhen others are not?",
    startSec: 161.4,
  },
  {
    number: "Q4",
    text: "How do I find an edge\nwhen I must trade everything?",
    startSec: 194.04,
  },
  {
    number: "Q5",
    text: "Do I need to bet on every\nmarket on the platform?",
    startSec: 247.44,
  },
];

const HOLD_SEC = 5.5;
const FADE_OUT_SEC = 0.8;

const FaqQuestion: React.FC<{ entry: FaqEntry }> = ({ entry }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = Math.round(HOLD_SEC * fps);
  const fadeOutFrames = Math.round(FADE_OUT_SEC * fps);
  const totalFrames = holdFrames + fadeOutFrames;

  const enterSpring = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
  });

  const scale = interpolate(enterSpring, [0, 1], [0.9, 1], clamp);
  const enterOpacity = interpolate(enterSpring, [0, 1], [0, 1], clamp);

  const fadeOutOpacity = interpolate(
    frame,
    [holdFrames, totalFrames],
    [1, 0],
    clamp,
  );

  const opacity = Math.min(enterOpacity, fadeOutOpacity);

  const backdropOpacity = interpolate(
    frame,
    [0, 6, holdFrames, totalFrames],
    [0, 0.92, 0.92, 0],
    clamp,
  );

  return (
    <AbsoluteFill>
      {/* Mountain b-roll background instead of flat dark overlay */}
      <AbsoluteFill style={{ opacity: backdropOpacity }}>
        <Video
          src={staticFile("broll/mountains-aerial.mp4")}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(4px) brightness(0.3)",
          }}
          loop
          playbackRate={0.3}
          muted
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            ...FAQ.numberStyle,
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          {entry.number}
        </div>

        <div
          style={{
            ...FAQ.questionStyle,
            whiteSpace: "pre-line",
          }}
        >
          {entry.text}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const FaqQuestionOverlay: React.FC = () => {
  return (
    <AbsoluteFill>
      {FAQ_QUESTIONS.map((entry, i) => {
        const startFrame = Math.round(entry.startSec * FPS);
        const durationFrames =
          Math.round((HOLD_SEC + FADE_OUT_SEC) * FPS) + 5;

        return (
          <Sequence key={i} from={startFrame} durationInFrames={durationFrames}>
            <FaqQuestion entry={entry} />
            <Sequence from={0} durationInFrames={Math.round(HOLD_SEC * FPS)}>
              <Audio
                src={staticFile("sfx/whoosh-scene-grid.mp3")}
                volume={0.3}
              />
            </Sequence>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
