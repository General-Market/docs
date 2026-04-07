import React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { AnimatedText } from "./AnimatedText";

const { fontFamily } = loadFont();

export const Scene05: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#fff",
        justifyContent: "center",
        alignItems: "center",
        fontFamily,
      }}
    >
      <AnimatedText
        text="Rationales feed into consensus metric"
        highlightLastN={2}
        startFrame={0}
        framesPerWord={6}
        fadeOutAt={50}
        fadeOutFrames={5}
        fontSize={56}
      />

      <AnimatedText
        text="Scores converge"
        highlightLastN={1}
        startFrame={60}
        framesPerWord={8}
        fadeOutAt={100}
        fadeOutFrames={10}
        fontSize={56}
      />
    </AbsoluteFill>
  );
};

export const scene05Meta = {
  id: "Council-Scene05",
  component: Scene05,
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 110,
};
