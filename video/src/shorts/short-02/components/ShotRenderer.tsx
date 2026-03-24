// TEMPLATE — Copy /src/shorts/_template/ to /src/shorts/your-short/
// Then: replace __TEMPLATE__ with your short ID

import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import type { Caption } from "../../../lib/types";
import type { ShotDef } from "../types";
import { COLORS } from "../types";
import { useShortContext } from "../ShortContext";

// Lib reuse
import { ScreenShake } from "../../../lib/components/Effects/ScreenShake";
import { FlashImpact } from "../../../lib/components/Effects/FlashImpact";
import { SFXTrigger } from "../../../lib/components/Audio/SFXTrigger";
import { EmojiRain } from "../../../lib/components/Effects/EmojiRain";
import { SpeedLines } from "../../../lib/components/Effects/SpeedLines";

// Reusable components
import { ShotTransition } from "./ShotTransition";
import { DuotoneOverlay } from "./DuotoneOverlay";
import { LightLeakOverlay } from "./LightLeakOverlay";
import { ShotBackground } from "./ShotBackground";
// import { VoiceSyncChibi } from "./VoiceSyncChibi";
// ShotCaptions moved to PersistentCaptions at composition level
import { DataCallout } from "./DataCallout";
import { AnimatedBg } from "./AnimatedBg";
import { ScreenBreak } from "./ScreenBreak";
import { ShotVfx } from "./ShotVfx";
import { CinematicLetterbox } from "./CinematicLetterbox";
import { SCENE_REGISTRY } from "../sceneRegistry";

interface Props {
  shot: ShotDef;
  captions: Caption[];
  globalFrameOffset: number;
  shotDurationFrames: number;
  prevShotEmotion?: string;
  nextShotEmotion?: string;
}

export const ShotRenderer: React.FC<Props> = ({
  shot,
  captions,
  globalFrameOffset,
  shotDurationFrames,
  prevShotEmotion,
  nextShotEmotion,
}) => {
  const { assetDir } = useShortContext();
  const sfxDir = `${assetDir}/sfx`;
  const durationFrames = shotDurationFrames;

  const shakeEvents = shot.screenShake
    ? [{ frame: 0, amplitude: shot.screenShake.amplitude, duration: shot.screenShake.duration }]
    : [];

  const flashEvents = shot.flash
    ? [{ frame: 0, color: "white", duration: 4, maxOpacity: 0.6 }]
    : [];

  // ── Full-screen camera effects ──────────────────────────────────────
  const frame = useCurrentFrame();
  const clamp = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };

  const fsScale = shot.fullScreenZoom
    ? interpolate(frame, [0, durationFrames], shot.fullScreenZoom === "in" ? [1, 1.05] : [1.05, 1], clamp)
    : 1;

  const breathScale = shot.breathingPulse
    ? 1 + 0.015 * Math.sin((frame / 30) * Math.PI * 2 * 0.5)
    : 1;

  const tiltDeg = shot.cameraTilt
    ? interpolate(frame, [0, durationFrames], shot.cameraTilt === "cw" ? [0, 0.5] : [0, -0.5], clamp)
    : 0;

  const driftPx = shot.cameraDrift
    ? interpolate(frame, [0, durationFrames], shot.cameraDrift === "right" ? [-10, 10] : [10, -10], clamp)
    : 0;

  const focusBlur = shot.focusPull
    ? interpolate(frame, [0, durationFrames * 0.4], shot.focusPull === "sharpen" ? [2, 0] : [0, 2], clamp)
    : 0;

  const colorProgress = shot.colorShift
    ? interpolate(frame, [0, durationFrames], [0, 1], clamp)
    : 0;
  const warmAmount = shot.colorShift
    ? shot.colorShift === "cool-to-warm" ? colorProgress : 1 - colorProgress
    : 0;

  const transforms: string[] = [];
  const combinedScale = fsScale * breathScale;
  if (combinedScale !== 1) transforms.push(`scale(${combinedScale})`);
  if (tiltDeg !== 0) transforms.push(`rotate(${tiltDeg}deg)`);
  if (driftPx !== 0) transforms.push(`translateX(${driftPx}px)`);

  const filters: string[] = [];
  if (focusBlur > 0.01) filters.push(`blur(${focusBlur}px)`);
  if (warmAmount > 0.01) {
    filters.push(`sepia(${warmAmount * 0.15})`);
    filters.push(`hue-rotate(${warmAmount * -10}deg)`);
  }

  // 3D scene is rendered at composition level — make bg transparent so it shows through
  const has3D = shot.customScenes?.includes("tradingJourney");

  const outerStyle: React.CSSProperties = {
    backgroundColor: has3D ? "transparent" : COLORS.BG_BASE,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
    filter: filters.length > 0 ? filters.join(" ") : undefined,
  };

  const letterboxCfg = shot.letterbox
    ? typeof shot.letterbox === "object" ? shot.letterbox : {}
    : null;

  return (
    <AbsoluteFill style={outerStyle}>
      {/* Layer 0: Background (skip for 3D shots — persistent ThreeCanvas is behind us) */}
      {!has3D && <ShotBackground bg={shot.background} durationFrames={durationFrames} />}

      {/* Custom scenes (topic-specific via registry) */}
      {shot.customScenes?.map((name) => {
        const render = SCENE_REGISTRY[name];
        return render ? <React.Fragment key={name}>{render({ shot, globalFrameOffset })}</React.Fragment> : null;
      })}

      {/* Duotone color-grade overlay (after 3D scene so it grades the actual visuals) */}
      {shot.duotone && (
        <DuotoneOverlay
          {...(typeof shot.duotone === "object" ? shot.duotone : {})}
        />
      )}

      {/* Animated background overlay */}
      {shot.animatedBg && (
        <AnimatedBg variant={shot.animatedBg} accentColor={shot.animatedBgColor} />
      )}

      {/* Screen shake */}
      <ScreenShake events={shakeEvents}>
        <AbsoluteFill />
      </ScreenShake>

      {/* Chibi — disabled for now
      {!shot.hideChibi && <AbsoluteFill>
        <VoiceSyncChibi
          emotion={shot.chibiEmotion}
          animation={shot.chibiAnimation}
          entrance={shot.chibiEntrance}
          delay={shot.chibiDelay}
          isFirstShot={shot.isFirstShot}
          captions={captions}
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
        />
      </AbsoluteFill>}
      */}

      {/* Data callout */}
      {shot.dataCallout && <DataCallout callout={shot.dataCallout} />}
      {shot.secondaryCallout && <DataCallout callout={shot.secondaryCallout} />}
      {shot.callouts?.map((c, i) => <DataCallout key={`callout-${i}`} callout={c} />)}

      {/* Captions — now rendered by PersistentCaptions at composition level */}

      {/* Shot VFX overlay */}
      {shot.shotVfx && (
        <ShotVfx variant={shot.shotVfx} color={shot.shotVfxColor} delay={shot.shotVfxDelay} />
      )}

      {/* EmojiRain */}
      {shot.emojiRain && <EmojiRain events={shot.emojiRain} />}

      {/* SpeedLines */}
      {shot.speedLines && <SpeedLines events={shot.speedLines} />}

      {/* Light leak */}
      {shot.lightLeak && (
        <LightLeakOverlay {...(typeof shot.lightLeak === "object" ? shot.lightLeak : {})} />
      )}

      {/* Flash impact */}
      <FlashImpact events={flashEvents} />

      {/* Screen break intro */}
      {shot.screenBreak && <ScreenBreak />}

      {/* SFX */}
      {shot.sfx.length > 0 && (
        <SFXTrigger
          sfxDir={sfxDir}
          events={shot.sfx.map((s) => ({
            frame: s.frame,
            file: s.file,
            volume: s.volume,
            durationFrames: 45,
          }))}
        />
      )}

      {/* Letterbox */}
      {letterboxCfg && (
        <CinematicLetterbox
          delay={letterboxCfg.delay}
          height={letterboxCfg.height}
          durationFrames={durationFrames}
        />
      )}

      {/* Transition */}
      {shot.transitionIn !== "cut" && (
        <ShotTransition type={shot.transitionIn} durationFrames={shot.transitionDuration} />
      )}
    </AbsoluteFill>
  );
};
