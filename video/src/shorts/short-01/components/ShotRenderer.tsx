import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import type { Caption } from "../../../lib/types";
import type { ShotDef, VoiceSegment } from "../types";
import { COLORS } from "../types";
import { useShortContext } from "../ShortContext";
import { secondsToFrame } from "../../../lib/utils/frameConvert";

// Lib reuse
import { ScreenShake } from "../../../lib/components/Effects/ScreenShake";
import { FlashImpact } from "../../../lib/components/Effects/FlashImpact";
import { SFXTrigger } from "../../../lib/components/Audio/SFXTrigger";
import { EmojiRain } from "../../../lib/components/Effects/EmojiRain";
import { SpeedLines } from "../../../lib/components/Effects/SpeedLines";

// Short-01 components
import { ShotTransition } from "./ShotTransition";
import { DuotoneOverlay } from "./DuotoneOverlay";
import { LightLeakOverlay } from "./LightLeakOverlay";
import { ShotBackground } from "./ShotBackground";
import { VoiceSyncChibi } from "./VoiceSyncChibi";
import { ShotCaptions } from "./ShotCaptions";
import { DataCallout } from "./DataCallout";
import { RedditToTerminalMorph } from "./RedditToTerminalMorph";
import { GhostLogos } from "./GhostLogos";
import { AnimatedBarChart } from "./AnimatedBarChart";
import { AnimatedRankings } from "./AnimatedRankings";
import { AnimatedBg } from "./AnimatedBg";
import { FloatingCryptoLogos } from "./FloatingCryptoLogos";
import { StablecoinCards } from "./StablecoinCards";
import { ProjectShowcase } from "./ProjectShowcase";
import { ProjectDataCard } from "./ProjectDataCard";
import { ScreenBreak } from "./ScreenBreak";
import { ImpactScene } from "./ImpactScene";
import { MiniPersona } from "./MiniPersona";
import { QuestionStack } from "./QuestionStack";
import { SCENE_REGISTRY } from "../sceneRegistry";
import { CompoundingList } from "./CompoundingList";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { ShotVfx } from "./ShotVfx";
import { CinematicLetterbox } from "./CinematicLetterbox";
import { BrollMosaic } from "./BrollMosaic";

interface Props {
  shot: ShotDef;
  captions: Caption[];
  globalFrameOffset: number;
  /** Previous shot's chibi emotion (for continuity — skip entrance if same) */
  prevShotEmotion?: string;
  /** Next shot's chibi emotion (for continuity — skip exit if same) */
  nextShotEmotion?: string;
  /** Previous shot's project data card ticker (for chart continuity) */
  prevProjectTicker?: string;
  /** Per-shot voice segments for chibi audio sync */
  voiceSegments?: VoiceSegment[];
}



export const ShotRenderer: React.FC<Props> = ({
  shot,
  captions,
  globalFrameOffset,
  prevShotEmotion,
  nextShotEmotion,
  prevProjectTicker,
  voiceSegments,
}) => {
  const { assetDir } = useShortContext();
  const { width, height } = useVideoConfig();
  const sfxDir = `${assetDir}/sfx`;
  const durationFrames = secondsToFrame(shot.durationSeconds);

  // Build effect events from shot definition
  const shakeEvents = shot.screenShake
    ? [{ frame: 0, amplitude: shot.screenShake.amplitude, duration: shot.screenShake.duration }]
    : [];

  const flashEvents = shot.flash
    ? [{ frame: 0, color: "white", duration: 4, maxOpacity: 0.6 }]
    : [];

  // ── Full-screen camera effects ──────────────────────────────────────
  const frame = useCurrentFrame();
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  // 1. Zoom drift (1.0 ↔ 1.05)
  const fsScale = shot.fullScreenZoom
    ? interpolate(frame, [0, durationFrames], shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1], clamp)
    : 1;

  // 2. Breathing pulse — sinusoidal micro-scale (~2s period)
  const breathScale = shot.breathingPulse
    ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)
    : 1;

  // 3. Camera tilt (0 → ±0.5°)
  const tiltDeg = shot.cameraTilt
    ? interpolate(frame, [0, durationFrames], shot.cameraTilt === "cw" ? [0, 0.5] : [0, -0.5], clamp)
    : 0;

  // 4. Camera drift (±10px)
  const driftPx = shot.cameraDrift
    ? interpolate(frame, [0, durationFrames], shot.cameraDrift === "right" ? [-10, 10] : [10, -10], clamp)
    : 0;

  // 4b. Camera vertical drift (±80px — for "from above" entrance)
  const vertDriftPx = shot.cameraVerticalDrift
    ? interpolate(frame, [0, durationFrames], shot.cameraVerticalDrift === "down" ? [-80, 0] : [0, -80], clamp)
    : 0;

  // 5. Focus pull (blur 2px ↔ 0px over first/last 40% of shot)
  const focusBlur = shot.focusPull
    ? interpolate(
        frame,
        [0, durationFrames * 0.4],
        shot.focusPull === "sharpen" ? [2, 0] : [0, 2],
        clamp,
      )
    : 0;

  // 6. Color temperature shift (sepia + hue-rotate blend)
  const colorProgress = shot.colorShift
    ? interpolate(frame, [0, durationFrames], [0, 1], clamp)
    : 0;
  const warmAmount = shot.colorShift
    ? shot.colorShift === "cool-to-warm" ? colorProgress : 1 - colorProgress
    : 0;

  // Build combined transform string
  const transforms: string[] = [];
  const combinedScale = fsScale * breathScale;
  if (combinedScale !== 1) transforms.push(`scale(${combinedScale})`);
  if (tiltDeg !== 0) transforms.push(`rotate(${tiltDeg}deg)`);
  if (driftPx !== 0) transforms.push(`translateX(${driftPx}px)`);
  if (vertDriftPx !== 0) transforms.push(`translateY(${vertDriftPx}px)`);

  // Build combined filter string
  const filters: string[] = [];
  if (focusBlur > 0.01) filters.push(`blur(${focusBlur}px)`);
  if (warmAmount > 0.01) {
    filters.push(`sepia(${warmAmount * 0.15})`);
    filters.push(`hue-rotate(${warmAmount * -10}deg)`);
  }

  const outerStyle: React.CSSProperties = {
    backgroundColor: COLORS.BG_BASE,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
    filter: filters.length > 0 ? filters.join(" ") : undefined,
  };

  // Letterbox config
  const letterboxCfg = shot.letterbox
    ? typeof shot.letterbox === "object" ? shot.letterbox : {}
    : null;

  return (
    <AbsoluteFill style={outerStyle}>
      {/* Layer 0: Background */}
      {shot.duotone ? (
        <DuotoneOverlay
          {...(typeof shot.duotone === "object" ? shot.duotone : {})}
        />
      ) : shot.morph ? (
        <RedditToTerminalMorph
          durationFrames={durationFrames}
          fromColor={COLORS.REDDIT_ORANGE}
          toColor={shot.morphToColor ?? COLORS.BLOOMBERG_GREEN}
          toColorAlt={COLORS.BLOOMBERG_GREEN}
        />
      ) : (
        <ShotBackground bg={shot.background} durationFrames={durationFrames} />
      )}

      {/* Layer 0.1: Architecture diagram (replaces background) */}
      {shot.architectureDiagram && (
        <ArchitectureDiagram config={shot.architectureDiagram} />
      )}

      {/* Layer 0.25: Custom scenes (topic-specific via registry) */}
      {shot.customScenes?.map((name) => {
        const render = SCENE_REGISTRY[name];
        return render ? <React.Fragment key={name}>{render({ shot, globalFrameOffset })}</React.Fragment> : null;
      })}

      {/* Layer 0.5: Animated background overlay */}
      {shot.animatedBg && (
        <AnimatedBg
          variant={shot.animatedBg}
          accentColor={shot.animatedBgColor}
        />
      )}

      {/* Layer 0.7: B-roll mosaic (zoom-out to 3x3 grid) */}
      {shot.brollMosaic && (
        <BrollMosaic
          triggerFrame={shot.brollMosaic.triggerFrame}
          videos={shot.brollMosaic.videos}
          assetDir={assetDir}
        />
      )}

      {/* Layer 1: Bar chart (shots 24-25) */}
      {shot.barChart && (
        <AnimatedBarChart
          variant={shot.barChartVariant ?? "1in3"}
        />
      )}

      {/* Layer 1.5: Rankings (shots 29-31) */}
      {shot.rankings && <AnimatedRankings variant={shot.rankings} />}

      {/* Layer 1.7: Floating crypto logos */}
      {shot.floatingLogos && <FloatingCryptoLogos assetDir={assetDir} />}

      {/* Layer 1.8: Stablecoin CoinGecko-style cards */}
      {shot.stablecoinCards && <StablecoinCards assetDir={assetDir} />}

      {/* Layer 1.9: Project showcase (7 scrolling screenshots) */}
      {shot.projectShowcase && <ProjectShowcase assetDir={assetDir} instant={shot.isFirstShot} />}

      {/* Layer 1.95: Per-project CoinGecko data card (replaces chibi) */}
      {shot.projectDataCard && (
        <ProjectDataCard
          name={shot.projectDataCard.name}
          ticker={shot.projectDataCard.ticker}
          logo={shot.projectDataCard.logo}
          color={shot.projectDataCard.color}
          category={shot.projectDataCard.category}
          pricePath={shot.projectDataCard.pricePath}
          pricePrefix={shot.projectDataCard.pricePrefix}
          priceDecimals={shot.projectDataCard.priceDecimals}
          badgeLogo={shot.projectDataCard.badgeLogo}
          assetDir={assetDir}
          isContinuation={!!(prevProjectTicker && shot.projectDataCard.ticker === prevProjectTicker)}
        />
      )}

      {/* Layer 2: Ghost logos (shot 35) */}
      {shot.ghostLogos && <GhostLogos durationFrames={durationFrames} />}

      {/* Layer 3: Screen shake effect */}
      <ScreenShake events={shakeEvents}>
        <AbsoluteFill />
      </ScreenShake>

      {/* Layer 4: Chibi (voice-synced + VFX system) */}
      <AbsoluteFill>
        <VoiceSyncChibi
          emotion={shot.chibiEmotion}
          animation={shot.chibiAnimation}
          entrance={shot.chibiEntrance}
          delay={shot.chibiDelay}
          isFirstShot={shot.isFirstShot}
          globalFrameOffset={globalFrameOffset}
          shotDurationFrames={durationFrames}
          entranceVfx={shot.chibiEntranceVfx}
          exitStyle={shot.chibiExit}
          zoomDrift={shot.chibiZoomDrift}
          rainCloud={shot.chibiRainCloud}
          expressions={shot.chibiExpressions}
          flipY={shot.chibiFlipY}
          prevShotEmotion={prevShotEmotion}
          nextShotEmotion={nextShotEmotion}
          voiceSegments={voiceSegments}
        />
      </AbsoluteFill>

      {/* Layer 4.5: Mini persona */}
      {shot.miniPersona && (
        <MiniPersona
          variant={shot.miniPersona.variant}
          bubbleText={shot.miniPersona.bubbleText}
          position={shot.miniPersona.position}
          delay={shot.miniPersona.delay}
          bubbleDelay={shot.miniPersona.bubbleDelay}
        />
      )}

      {/* Layer 5: Data callout */}
      {shot.dataCallout && <DataCallout callout={shot.dataCallout} />}
      {shot.secondaryCallout && <DataCallout callout={shot.secondaryCallout} />}
      {shot.callouts?.map((c, i) => <DataCallout key={`callout-${i}`} callout={c} />)}

      {/* Layer 5.5: Impact scene overlay (hide counter text when DataCallout handles it) */}
      {shot.impactScene && <ImpactScene variant={shot.impactScene} hideCounter={!!shot.dataCallout} />}

      {/* Layer 5.6: Question stack list */}
      {shot.questionStack && (
        <QuestionStack
          items={shot.questionStack.items}
          activeCount={shot.questionStack.activeCount}
        />
      )}

      {/* Layer 5.8: Compounding bullet list (shots 3-6) */}
      {shot.compoundingList && (
        <CompoundingList
          items={shot.compoundingList.items}
          activeCount={shot.compoundingList.activeCount}
        />
      )}

      {/* Layer 6: Captions (hidden when shot uses title callouts instead) */}
      {!shot.hideCaptions && (
      <ShotCaptions
        captions={captions}
        globalFrameOffset={globalFrameOffset}
        shotDurationFrames={durationFrames}
        mode={shot.captionMode}
        highlights={shot.wordHighlights}
      />
      )}

      {/* Layer 6.2: Shot VFX overlay */}
      {shot.shotVfx && (
        <ShotVfx
          variant={shot.shotVfx}
          color={shot.shotVfxColor}
          delay={shot.shotVfxDelay}
        />
      )}

      {/* Layer 6.3: EmojiRain */}
      {shot.emojiRain && (
        <EmojiRain events={shot.emojiRain} width={width} height={height} />
      )}

      {/* Layer 6.4: SpeedLines */}
      {shot.speedLines && (
        <SpeedLines events={shot.speedLines} width={width} height={height} />
      )}

      {/* Layer 6.5: Light leak overlay */}
      {shot.lightLeak && (
        <LightLeakOverlay
          {...(typeof shot.lightLeak === "object" ? shot.lightLeak : {})}
        />
      )}

      {/* Layer 7: Flash impact */}
      <FlashImpact events={flashEvents} />

      {/* Layer 8: Screen break intro effect */}
      {shot.screenBreak && <ScreenBreak />}

      {/* Layer 9: SFX */}
      {shot.sfx.length > 0 && (
        <SFXTrigger
          sfxDir={sfxDir}
          events={shot.sfx.map((s) => ({
            frame: s.frame,
            file: s.file,
            volume: s.volume,
            durationFrames: 45,
          }))}
          globalFrameOffset={globalFrameOffset}
        />
      )}

      {/* Layer 9.5: Cinematic letterbox bars */}
      {letterboxCfg && (
        <CinematicLetterbox
          delay={letterboxCfg.delay}
          height={letterboxCfg.height}
          durationFrames={durationFrames}
        />
      )}

      {/* Layer 10: Shot transition overlay (topmost — reveals content) */}
      {shot.transitionIn !== "cut" && (
        <ShotTransition
          type={shot.transitionIn}
          durationFrames={shot.transitionDuration}
        />
      )}
    </AbsoluteFill>
  );
};
