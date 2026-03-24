import React, { useMemo } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/IBMPlexSans";
import type { ShortConfig, Emotion } from "../types";
import { msToFrame } from "../utils/frameConvert";
import { getPalette } from "../utils/colorPalettes";

// Hooks
import { useSegments } from "../hooks/useSegments";
import { useMusicAnalysis } from "../hooks/useMusicAnalysis";
import { useBeatSync } from "../hooks/useBeatSync";
import { useEnergyAtFrame } from "../hooks/useEnergyAtFrame";
import { useCaptions } from "../hooks/useCaptions";

// Background
import { AnimatedGradient } from "../components/Background/AnimatedGradient";
import { ParticleField } from "../components/Background/ParticleField";
import { AmbientShimmer } from "../components/Background/AmbientShimmer";
import { getBackgroundPreset } from "../components/Background/presets";

// Character
import { ChibiController } from "../components/Chibi/ChibiController";

// Captions
import { CaptionRenderer } from "../components/Captions/CaptionRenderer";

// Effects
import { ScreenShake } from "../components/Effects/ScreenShake";
import { ZoomPulse } from "../components/Effects/ZoomPulse";
import { FlashImpact } from "../components/Effects/FlashImpact";
import { EmojiRain } from "../components/Effects/EmojiRain";
import { SpeedLines } from "../components/Effects/SpeedLines";

// Overlays
import { Vignette } from "../components/Overlays/Vignette";
import { FilmGrain } from "../components/Overlays/FilmGrain";
import { ColorGrade } from "../components/Overlays/ColorGrade";
import { ProgressBar } from "../components/Overlays/ProgressBar";
import { Watermark } from "../components/Overlays/Watermark";

// Audio
import { MusicLayer } from "../components/Audio/MusicLayer";
import { VoiceLayer } from "../components/Audio/VoiceLayer";
import { SFXTrigger } from "../components/Audio/SFXTrigger";

// Effect compiler
import { compileEffectEvents } from "./compileEffectEvents";

// Load font
const { fontFamily } = loadFont("normal", { subsets: ["latin"], weights: ["400", "600", "700"] });

interface Props {
  config: ShortConfig;
}

/**
 * ChibiExplainer — Master template wiring all 18 visual layers.
 *
 * Layer order (bottom to top):
 * 0: AnimatedGradient | 1: ParticleField | 2: AmbientShimmer
 * 3: MusicLayer | 4: VoiceLayer | 5: SFXTrigger
 * 6: ChibiController | 7: (shadow in controller) | 8: CaptionRenderer
 * 9: ScreenShake | 10: ZoomPulse | 11: FlashImpact
 * 12: EmojiRain | 13: SpeedLines | 14: (thought bubble placeholder)
 * 15: Vignette | 16: FilmGrain | 17: ColorGrade | 18: ProgressBar
 */
export const ChibiExplainer: React.FC<Props> = ({ config }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load all data via hooks
  const { segments, getSegmentAtFrame } = useSegments(
    config.scenePlanPath,
    fps,
  );
  const { analysis } = useMusicAnalysis(config.musicAnalysisPath, fps);
  const { beatFrames } = useBeatSync(analysis, fps);
  const { getEnergy } = useEnergyAtFrame(analysis, fps);
  const { captions, pages } = useCaptions(config.captionsPath, fps);

  // Current segment info
  const currentSegment = getSegmentAtFrame(frame);
  const currentEmotion: Emotion = currentSegment?.emotion ?? "neutral";

  // Previous emotion for crossfades
  const prevSegment = useMemo(() => {
    if (!currentSegment || segments.length < 2) return null;
    const idx = segments.indexOf(currentSegment);
    return idx > 0 ? segments[idx - 1] : null;
  }, [currentSegment, segments]);

  const prevEmotion = prevSegment?.emotion;

  // Transition progress (12 frames crossfade)
  const transitionProgress = useMemo(() => {
    if (!currentSegment) return 1;
    const segStart = msToFrame(currentSegment.startMs, fps);
    const elapsed = frame - segStart;
    return Math.min(1, elapsed / 12);
  }, [currentSegment, frame, fps]);

  // Background preset for current emotion
  const bgPreset = getBackgroundPreset(currentEmotion);
  const palette = getPalette(currentEmotion);
  const energy = getEnergy(frame);

  // Compile all effect events
  const effects = useMemo(
    () => compileEffectEvents(segments, analysis, fps),
    [segments, analysis, fps],
  );

  // Collect all keywords from all segments
  const allKeywords = useMemo(
    () => segments.flatMap((s) => s.keywords),
    [segments],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#15181a", fontFamily }}>
      {/* Layer 0: Animated gradient background */}
      <AnimatedGradient
        emotion={currentEmotion}
        prevEmotion={prevEmotion}
        transitionProgress={transitionProgress}
      />

      {/* Layer 1: Particle field */}
      <ParticleField
        count={bgPreset.particleCount}
        energy={energy}
        color={bgPreset.particleColor}
      />

      {/* Layer 2: Ambient shimmer */}
      <AmbientShimmer
        tint={bgPreset.shimmerTint}
        opacity={bgPreset.shimmerOpacity}
      />

      {/* Layer 3: Music audio */}
      <MusicLayer musicPath={config.musicPath} captions={captions} />

      {/* Layer 4: Voice audio */}
      <VoiceLayer voicePath={config.voicePath} />

      {/* Layer 5: SFX audio */}
      <SFXTrigger sfxDir={config.sfxDir} events={effects.sfxEvents} />

      {/* Layers 9-10: Screen shake + zoom pulse wrapping visual content */}
      <ScreenShake events={effects.shakeEvents}>
        <ZoomPulse events={effects.zoomEvents}>
          {/* Layer 6-7: Chibi character with shadow */}
          <ChibiController
            chibiDir={config.chibiDir}
            segments={segments}
            beatFrames={beatFrames}
            fps={fps}
            size={500}
            bottomY={1000}
          />

          {/* Layer 8: Captions */}
          <CaptionRenderer
            pages={pages}
            keywords={allKeywords}
            stylePreset={config.captionStyle ?? "indexmaker"}
            yPosition={850}
          />
        </ZoomPulse>
      </ScreenShake>

      {/* Layer 11: Flash impact */}
      <FlashImpact events={effects.flashEvents} />

      {/* Layer 12: Emoji rain */}
      <EmojiRain events={effects.emojiEvents} />

      {/* Layer 13: Speed lines */}
      <SpeedLines events={effects.speedLineEvents} />

      {/* Layer 15: Vignette — IndexMaker DA: 35% (open, readable) */}
      <Vignette opacity={0.35} spread={50} />

      {/* Layer 16: Film grain — IndexMaker DA: 3% (minimal texture) */}
      <FilmGrain opacity={0.03} />

      {/* Layer 17: Color grade */}
      <ColorGrade
        emotion={currentEmotion}
        prevEmotion={prevEmotion}
        transitionProgress={transitionProgress}
      />

      {/* Layer 18: Progress bar */}
      <ProgressBar color={palette.accent} height={3} />

      {/* Watermark (optional) */}
      {config.watermarkText && <Watermark text={config.watermarkText} />}
    </AbsoluteFill>
  );
};
