/**
 * CascadeTextDemo — five text samples, each ~60 frames apart, exercising
 * the CascadeText component across line counts, widths, and alignments.
 *
 * 1920×1080 at 30fps. Green on near-black, reminiscent of the reference.
 */

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
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

/** Left-aligned label that drifts slowly rightward — never stops. */
const LABEL_DRIFT_PX_PER_SEC = 10;

const Slide: React.FC<{
  children: React.ReactNode;
  label: string;
  absFrame: number;
}> = ({ children, label, absFrame }) => {
  const drift = (absFrame / FPS) * LABEL_DRIFT_PX_PER_SEC;
  return (
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
          transform: `translateX(${drift}px)`,
          willChange: "transform",
        }}
      >
        {label}
      </div>
      <div style={BLOCK}>{children}</div>
    </AbsoluteFill>
  );
};

export const CascadeTextDemo: React.FC = () => {
  const absFrame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: BG }}>
      {/* 0–4s: long phrase, wraps twice, continuous wave */}
      <Sequence from={0} durationInFrames={120}>
        <Slide label="Wraps across three lines" absFrame={absFrame}>
          <CascadeText
            text="The bot you never wrote now trades the markets you never watched"
            maxWidth={1400}
            fontFamily={font}
            fontSize={112}
            fontWeight={800}
            color={GREEN}
            letterSpacing="-0.02em"
            riseDistance={80}
            blurPx={14}
          />
        </Slide>
      </Sequence>

      {/* 4–8s: dense block, narrow box, heavier stagger */}
      <Sequence from={120} durationInFrames={120}>
        <Slide label="Narrow column, slower stagger" absFrame={absFrame}>
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
            riseDistance={100}
            blurPx={18}
          />
        </Slide>
      </Sequence>

      {/* 8–12s: short punchy, centered */}
      <Sequence from={240} durationInFrames={120}>
        <Slide label="Centered, single line" absFrame={absFrame}>
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
            riseDistance={90}
            blurPx={20}
          />
        </Slide>
      </Sequence>

      {/* 12–16s: tight overlap, fast stagger */}
      <Sequence from={360} durationInFrames={120}>
        <Slide label="Tight overlap, fast stagger" absFrame={absFrame}>
          <CascadeText
            text="Sealed bets. Specialized oracle. Instant settlement. No dispute."
            maxWidth={1500}
            fontFamily={font}
            fontSize={96}
            fontWeight={700}
            color={GREEN}
            delayPerWord={2}
            durationPerWord={18}
            riseDistance={60}
            blurPx={10}
          />
        </Slide>
      </Sequence>

      {/* 16–20s: long, slower rise */}
      <Sequence from={480} durationInFrames={120}>
        <Slide label="Calmer rise" absFrame={absFrame}>
          <CascadeText
            text="Whether you are a beginner or already a hedge fund manager"
            maxWidth={1400}
            fontFamily={font}
            fontSize={96}
            fontWeight={600}
            color={GREEN}
            delayPerWord={4}
            durationPerWord={30}
            riseDistance={45}
            blurPx={12}
          />
        </Slide>
      </Sequence>
    </AbsoluteFill>
  );
};
