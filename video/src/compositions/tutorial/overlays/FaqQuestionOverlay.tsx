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
import { FPS } from "../theme";
import { useDesignTokens } from "../TutorialTheme";
import { SplitCard } from "../components/DiagramCard";
import { Sfx } from "../components/Sfx";
import { LAND } from "../sfxMap";

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
  const { COLOR, TYPE } = useDesignTokens();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const holdFrames = Math.round(HOLD_SEC * fps);
  const totalFrames = holdFrames + Math.round(FADE_OUT_SEC * fps);

  // Exit fade (entrance handled by SplitCard)
  const fadeOutOpacity = interpolate(
    frame,
    [holdFrames, totalFrames],
    [1, 0],
    clamp,
  );

  // Question text spring entrance (delayed slightly)
  const textSpring = spring({
    frame: Math.max(0, frame - 6),
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.8 },
  });
  const textScale = interpolate(textSpring, [0, 1], [0.92, 1], clamp);

  // Accent bar entrance
  const barHeight = interpolate(
    spring({
      frame: Math.max(0, frame - 4),
      fps,
      config: { damping: 14, stiffness: 160, mass: 0.6 },
    }),
    [0, 1],
    [0, 100],
    clamp,
  );

  return (
    <AbsoluteFill style={{ opacity: fadeOutOpacity }}>
      <SplitCard>
        {/* Green accent bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 4,
            height: `${barHeight}%`,
            background: COLOR.wiseGreen,
            borderRadius: 2,
          }}
        />

        <div
          style={{
            opacity: textSpring,
            transform: `scale(${textScale})`,
            transformOrigin: "left center",
          }}
        >
          <div
            style={{
              ...TYPE.label,
              color: COLOR.wiseGreen,
              fontSize: 22,
              letterSpacing: "0.15em",
              marginBottom: 24,
            }}
          >
            {entry.number}
          </div>

          <div
            style={{
              ...TYPE.sectionHeading,
              fontSize: 48,
              fontWeight: 700,
              color: COLOR.nearBlack,
              lineHeight: 1.2,
              whiteSpace: "pre-line",
              maxWidth: 680,
            }}
          >
            {entry.text}
          </div>
        </div>
      </SplitCard>
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
            <Sfx sound={LAND} />
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
