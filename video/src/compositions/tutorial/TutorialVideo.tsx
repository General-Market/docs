import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { TOTAL_FRAMES, SECTIONS, toFrames } from "./theme";
import { TalkingHeadLayout } from "./TalkingHeadLayout";
import { SCENES } from "./talkingHeadScenes";
import { LiquidityDiagrams } from "./diagrams/LiquidityDiagrams";
import { SettlementDiagrams } from "./diagrams/SettlementDiagrams";
import { ParimutuelDiagrams } from "./diagrams/ParimutuelDiagrams";
import { EraDiagrams } from "./diagrams/EraDiagrams";
import { ClosingDiagrams } from "./diagrams/ClosingDiagrams";
import { SourceCardOverlays } from "./overlays/SourceCardOverlays";
import { FaqQuestionOverlay } from "./overlays/FaqQuestionOverlay";
import { PromiseTicker } from "./overlays/PromiseTicker";
import { IntroTextOverlay } from "./overlays/IntroTextOverlay";
import { GlowMarqueeOverlay } from "./overlays/GlowMarqueeOverlay";
import { WiseScrollZoom } from "./overlays/WiseScrollZoom";
import { WiseSparkleSpiral } from "./overlays/WiseSparkleSpiral";
import { WiseMouseLight } from "./overlays/WiseMouseLight";
import { ExperienceDevicesOverlay } from "./overlays/ExperienceDevicesOverlay";
import { ClaudeTerminal } from "./overlays/ClaudeTerminal";
import { Sfx } from "./components/Sfx";
import type { SfxEvent } from "./components/Sfx";
import { SWOOSH, TEXT_IN_BG, PLOB_BG } from "./sfxMap";
import { COLOR, FONT } from "./designTokens";
import { TutorialThemeProvider, dayTheme, type TutorialTheme } from "./TutorialTheme";
import { WordParticleTransition } from "../../lib/components/Effects/WordParticleTransition";
import { seededRandom } from "../../lib/utils/random";

/**
 * Pills → "The Escape" particle transition.
 *
 * Voice: "risk management" ends at 21.12s, "and on and on" at 21.28s
 * Particles start at 20.5s (overlaps with pills still visible) so
 * the explosion feels like the pills themselves are shattering.
 * Pills fade out at 21.0s (PromiseTicker HOLD_UNTIL).
 *
 * Spans 20.5–25.5s (150 frames):
 *   break 18%  (20.5–21.4): "+X%" text fragments explode from pill positions
 *   travel 37% (21.4–23.3): fragments fly down behind webcam
 *   reform 25% (23.3–24.6): converge below webcam as "The Escape"
 *   holdTo 20% (24.6–25.5): "The Escape" visible
 */
const PARTICLE_PHASES = {
  holdFrom: 0,
  break: 0.18,
  travel: 0.37,
  reform: 0.25,
  holdTo: 0.20,
};

// Offsets from screen center (960, 540):
const PILLS_CENTER = { x: 416, y: 0 };
const ESCAPE_CENTER = { x: 0, y: 400 };

/** Each fragment gets a deterministic "+X.X%" label */
const pctLabel = (id: number) => {
  const val = (seededRandom(id * 777 + 42) * 28 + 0.1).toFixed(1);
  return `+${val}%`;
};

const seq = (key: keyof typeof SECTIONS) => ({
  from: toFrames(SECTIONS[key].start),
  durationInFrames: toFrames(SECTIONS[key].end - SECTIONS[key].start),
});

export const TutorialVideo: React.FC<{ theme?: TutorialTheme }> = ({
  theme = dayTheme,
}) => {
  return (
    <TutorialThemeProvider theme={theme}>
    <AbsoluteFill>
      {/*
        All overlays are children of TalkingHeadLayout so they can call
        useTalkingHead() to get the content area bounds for the current frame.

        Position overlay content inside contentArea — NOT fullscreen,
        NOT on top of the webcam. See TalkingHeadLayout.tsx header.
      */}
      <TalkingHeadLayout
        videoSrc="tutorial-raw.mp4"
        scenes={SCENES}
        behindWebcam={
          <>
          {/* GLSL text-shadow — "GM" with green ray-marched light (4–9.4s) */}
          <Sequence from={toFrames(4)} durationInFrames={toFrames(5.4)}>
            <WiseMouseLight durationInFrames={toFrames(5.4)} />
          </Sequence>
          {/* Green sparkle spiral (40–48s) */}
          <Sequence from={toFrames(40)} durationInFrames={toFrames(8)}>
            <WiseSparkleSpiral durationInFrames={toFrames(8)} />
          </Sequence>
          <Sequence from={toFrames(20.5)} durationInFrames={toFrames(5)}>
            <AbsoluteFill>
              <WordParticleTransition
                fromText="Liquidity Capital Lock Risk Management"
                toText="The Escape"
                durationInFrames={toFrames(5)}
                fontFamily={FONT.display}
                fontSize={48}
                fontWeight={900}
                textColor={COLOR.wiseGreen}
                particleColors={[
                  COLOR.wiseGreen,
                  COLOR.pastelGreen,
                  COLOR.darkGreen,
                  "#10B981",
                  "#34D399",
                ]}
                fragmentCount={600}
                cameraPassFraction={0.15}
                seed={42}
                phaseTiming={PARTICLE_PHASES}
                fromCenter={PILLS_CENTER}
                toCenter={ESCAPE_CENTER}
                renderFromText={false}
                fragmentLabel={pctLabel}
                fragmentFontSize={22}
                noRotation
                noStagger
              />
            </AbsoluteFill>
          </Sequence>
          </>
        }
      >
        {/* Liquidity diagrams (48.64–89.84s) */}
        <Sequence {...seq("liquidityDiagram")}>
          <LiquidityDiagrams />
        </Sequence>

        {/* 10-min cycle timeline (100.4–113.8s) */}
        <Sequence {...seq("settlementTimeline")}>
          <SettlementDiagrams />
        </Sequence>

        {/* Parimutuel explanation (2:11-2:39) — overlaps settlementTimeline section */}
        <Sequence {...seq("settlementTimeline")}>
          <ParimutuelDiagrams />
        </Sequence>

        {/* Era timeline + competitive landscape (216.8–247.4s) */}
        <Sequence {...seq("moatTimeline")}>
          <EraDiagrams />
        </Sequence>

        {/* Bot dashboard + end card (271.0–282.9s) */}
        <Sequence {...seq("closingDiagrams")}>
          <ClosingDiagrams />
        </Sequence>

        {/* Source cards (253.9–264.9s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <SourceCardOverlays />
        </Sequence>

        {/* Promise ticker — Liquidity / Capital Lock / Risk Management (18.32–22.2s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <PromiseTicker />
        </Sequence>

        {/* Intro typewriter — "How to launch your first general market bot..." (0–3.5s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <IntroTextOverlay />
        </Sequence>

        {/* FAQ question screens */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <FaqQuestionOverlay />
        </Sequence>

        {/* 3D text zoom — "Every Level Same Wall" in content area (30–34s) */}
        <Sequence from={toFrames(30)} durationInFrames={toFrames(4)}>
          <WiseScrollZoom durationInFrames={toFrames(4)} centerText={"Every Level\nSame Wall"} />
        </Sequence>

        {/* Counter-scrolling marquee — "BEGINNER" / "HEDGE FUND" (36.4–42.8s) */}
        <GlowMarqueeOverlay />

        {/* Claude Code terminal mockup (42.8–57.76s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <ClaudeTerminal />
        </Sequence>

        {/* Experience GM — phone + desktop device showcase (278.5–280.8s) */}
        <Sequence from={0} durationInFrames={TOTAL_FRAMES}>
          <ExperienceDevicesOverlay />
        </Sequence>
        {/* ── Scene transition SFX ─────────────────────────────────── */}
        {/* Light swoosh on every layout change, text blip when title appears */}
        {SCENES.map((scene, i) => {
          const prev = i > 0 ? SCENES[i - 1] : null;
          if (prev && prev.layout === scene.layout) return null;

          const f = toFrames(scene.startSec);
          const sounds: SfxEvent[] = [];

          // Swoosh on layout change (skip the very first scene)
          if (prev) {
            sounds.push({ at: f, sound: SWOOSH });
          }

          // Title text appearing
          if (scene.title) {
            sounds.push({ at: f + 6, sound: TEXT_IN_BG });
          }

          // Bottom label appearing
          if (scene.bottomLabel) {
            sounds.push({ at: f + 4, sound: PLOB_BG });
          }

          // Subtitle appearing
          if (scene.subtitle) {
            sounds.push({ at: f + 10, sound: PLOB_BG });
          }

          // Pills appearing (staggered)
          if (scene.pills) {
            scene.pills.forEach((_, j) => {
              sounds.push({ at: f + 12 + j * 4, sound: PLOB_BG });
            });
          }

          if (sounds.length === 0) return null;
          return <Sfx key={`tr-${i}`} sound={sounds} />;
        })}
      </TalkingHeadLayout>
    </AbsoluteFill>
    </TutorialThemeProvider>
  );
};
