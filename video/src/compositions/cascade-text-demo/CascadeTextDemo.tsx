/**
 * CascadeTextDemo — five text samples, each ~60 frames apart, exercising
 * the CascadeText component across line counts, widths, and alignments.
 *
 * 1920×1080 at 30fps. Green on near-black, reminiscent of the reference.
 */

import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { CascadeText } from "../../lib/components/Text";
import { font } from "../../common/fonts";

export const TOTAL_FRAMES = 600; // 20s
export const FPS = 30;

const BG = "#0a0a0a";
const GREEN = "#9fe870";
const DIM = "#5a6a52";

const BLOCK: React.CSSProperties = {
  position: "absolute",
  left: 120,
  top: 140,
};

const Slide: React.FC<{ children: React.ReactNode; label: string }> = ({
  children,
  label,
}) => (
  <AbsoluteFill style={{ background: BG, color: GREEN }}>
    <div
      style={{
        position: "absolute",
        left: 120,
        top: 80,
        fontFamily: font,
        fontSize: 24,
        fontWeight: 500,
        color: DIM,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
    <div style={BLOCK}>{children}</div>
  </AbsoluteFill>
);

export const CascadeTextDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* 0–4s: single long phrase, wraps twice */}
      <Sequence from={0} durationInFrames={120}>
        <Slide label="Wraps across three lines">
          <CascadeText
            text="The bot you never wrote now trades the markets you never watched"
            maxWidth={1400}
            fontFamily={font}
            fontSize={112}
            fontWeight={800}
            color={GREEN}
            letterSpacing="-0.02em"
            delayPerWord={3}
            durationPerWord={22}
            fallDistance={80}
            driftDistance={28}
            tiltDeg={5}
          />
        </Slide>
      </Sequence>

      {/* 4–8s: dense block, narrow box, heavy stagger */}
      <Sequence from={120} durationInFrames={120}>
        <Slide label="Narrow column, slower stagger">
          <CascadeText
            text="Fastest token image and metadata pipeline ever shipped"
            maxWidth={900}
            fontFamily={font}
            fontSize={128}
            fontWeight={900}
            color={GREEN}
            letterSpacing="-0.03em"
            delayPerWord={5}
            durationPerWord={28}
            fallDistance={100}
            driftDistance={40}
            tiltDeg={6}
          />
        </Slide>
      </Sequence>

      {/* 8–12s: short punchy, centered */}
      <Sequence from={240} durationInFrames={120}>
        <Slide label="Centered, single line">
          <CascadeText
            text="Everything trades everything"
            maxWidth={1600}
            fontFamily={font}
            fontSize={160}
            fontWeight={900}
            color={GREEN}
            letterSpacing="-0.03em"
            align="center"
            delayPerWord={4}
            durationPerWord={24}
            fallDistance={90}
            driftDistance={32}
            tiltDeg={5}
          />
        </Slide>
      </Sequence>

      {/* 12–16s: overlap — words nearly tripping over each other */}
      <Sequence from={360} durationInFrames={120}>
        <Slide label="Tight overlap, fast stagger">
          <CascadeText
            text="Sealed bets. Specialized oracle. Instant settlement. No dispute."
            maxWidth={1500}
            fontFamily={font}
            fontSize={96}
            fontWeight={700}
            color={GREEN}
            delayPerWord={2}
            durationPerWord={18}
            fallDistance={60}
            driftDistance={20}
            tiltDeg={4}
          />
        </Slide>
      </Sequence>

      {/* 16–20s: long, quieter */}
      <Sequence from={480} durationInFrames={120}>
        <Slide label="Calmer drop, less tilt">
          <CascadeText
            text="Whether you are a beginner or already a hedge fund manager"
            maxWidth={1400}
            fontFamily={font}
            fontSize={96}
            fontWeight={600}
            color={GREEN}
            delayPerWord={4}
            durationPerWord={30}
            fallDistance={45}
            driftDistance={18}
            tiltDeg={3}
          />
        </Slide>
      </Sequence>
    </AbsoluteFill>
  );
};
