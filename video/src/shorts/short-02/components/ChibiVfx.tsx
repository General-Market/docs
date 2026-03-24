/**
 * ChibiVfx — entrance VFX, exit VFX, rain cloud, and zoom drift.
 * All effects are driven by shot config and auto-default when not specified.
 *
 * Rendered as siblings to the chibi image inside VoiceSyncChibi.
 */

import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { noise2D } from "@remotion/noise";
import type { ChibiEntrance, ChibiEntranceVfx, ChibiRainCloud } from "../types";

// ─── Entrance VFX ────────────────────────────────────────────────────

interface EntranceVfxProps {
  type: ChibiEntranceVfx;
  entrance: ChibiEntrance;
  /** Frame when entrance animation finishes (particles trigger here) */
  landingFrame: number;
  chibiWidth: number;
}

/** Resolve "auto" to a concrete VFX based on entrance direction */
export const resolveEntranceVfx = (
  vfx: ChibiEntranceVfx | undefined,
  entrance: ChibiEntrance,
): Exclude<ChibiEntranceVfx, "auto"> => {
  const effective = vfx ?? "auto";
  if (effective !== "auto") return effective;
  switch (entrance) {
    case "bottom":
      return "dust";
    case "left":
    case "right":
      return "speed-lines";
    case "top":
      return "glow-ring";
    default:
      return "none";
  }
};

export const EntranceVfx: React.FC<EntranceVfxProps> = ({
  type,
  entrance,
  landingFrame,
  chibiWidth,
}) => {
  const resolved = resolveEntranceVfx(type === "auto" ? undefined : type, entrance);
  if (resolved === "none") return null;

  switch (resolved) {
    case "dust":
      return <DustPuff triggerFrame={landingFrame} chibiWidth={chibiWidth} />;
    case "speed-lines":
      return (
        <SpeedLinesVfx
          entrance={entrance}
          startFrame={0}
          endFrame={landingFrame}
          chibiWidth={chibiWidth}
        />
      );
    case "glow-ring":
      return <GlowRing triggerFrame={landingFrame} chibiWidth={chibiWidth} />;
    case "ghost-trail":
      return (
        <GhostTrail
          entrance={entrance}
          startFrame={0}
          endFrame={landingFrame}
        />
      );
    default:
      return null;
  }
};

// ── Dust Puff ──────────────────────────────────────────────────────

const DUST_PARTICLES = 10;
const DUST_DURATION = 18;

const DustPuff: React.FC<{ triggerFrame: number; chibiWidth: number }> = ({
  triggerFrame,
  chibiWidth,
}) => {
  const frame = useCurrentFrame();
  const elapsed = frame - triggerFrame;
  if (elapsed < -2 || elapsed > DUST_DURATION) return null;
  const t = Math.max(0, elapsed);

  return (
    <>
      {Array.from({ length: DUST_PARTICLES }, (_, i) => {
        // Spread particles in a semicircle below
        const angle = ((i / DUST_PARTICLES) * Math.PI) - Math.PI;
        const speed = 30 + (i % 3) * 15;
        const x = Math.cos(angle) * speed * (t / DUST_DURATION);
        const y = Math.sin(angle) * speed * 0.4 * (t / DUST_DURATION);
        const opacity = interpolate(t, [0, 4, DUST_DURATION], [0, 0.5, 0], {
          extrapolateRight: "clamp",
        });
        const size = interpolate(t, [0, DUST_DURATION], [4, 12], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: -5,
              left: `calc(50% + ${x}px)`,
              transform: `translateX(-50%) translateY(${y}px)`,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: "rgba(180,170,160,0.6)",
              opacity,
              filter: "blur(2px)",
            }}
          />
        );
      })}
    </>
  );
};

// ── Speed Lines ────────────────────────────────────────────────────

const SpeedLinesVfx: React.FC<{
  entrance: ChibiEntrance;
  startFrame: number;
  endFrame: number;
  chibiWidth: number;
}> = ({ entrance, startFrame, endFrame, chibiWidth }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame || frame > endFrame + 3) return null;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(progress, [0, 0.3, 0.8, 1], [0, 0.6, 0.4, 0]);
  const isHorizontal = entrance === "left" || entrance === "right";
  const dir = entrance === "left" ? 1 : entrance === "right" ? -1 : 0;

  return (
    <>
      {Array.from({ length: 6 }, (_, i) => {
        const offset = (i - 2.5) * 60;
        const length = 80 + (i % 3) * 40;
        const x = isHorizontal ? dir * (200 - progress * 250) : 0;
        const y = isHorizontal ? offset : (entrance === "top" ? 1 : -1) * (200 - progress * 250);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              bottom: isHorizontal ? `calc(30% + ${offset}px)` : undefined,
              top: !isHorizontal ? `calc(50% + ${offset}px)` : undefined,
              width: isHorizontal ? length : 3,
              height: isHorizontal ? 3 : length,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.5)",
              transform: `translate(${x}px, ${y}px)`,
              opacity,
              filter: "blur(1px)",
            }}
          />
        );
      })}
    </>
  );
};

// ── Glow Ring ──────────────────────────────────────────────────────

const GlowRing: React.FC<{ triggerFrame: number; chibiWidth: number }> = ({
  triggerFrame,
  chibiWidth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - triggerFrame;
  if (elapsed < 0 || elapsed > 20) return null;

  const expand = spring({
    frame: elapsed,
    fps,
    config: { damping: 12, stiffness: 150, mass: 0.6 },
    durationInFrames: 20,
  });
  const size = interpolate(expand, [0, 1], [30, chibiWidth * 0.6]);
  const opacity = interpolate(elapsed, [0, 5, 20], [0, 0.7, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        left: "50%",
        width: size,
        height: size * 0.3,
        borderRadius: "50%",
        border: "3px solid rgba(0,212,255,0.6)",
        boxShadow: "0 0 20px rgba(0,212,255,0.4), inset 0 0 10px rgba(0,212,255,0.2)",
        transform: "translateX(-50%)",
        opacity,
      }}
    />
  );
};

// ── Ghost Trail ────────────────────────────────────────────────────

const GhostTrail: React.FC<{
  entrance: ChibiEntrance;
  startFrame: number;
  endFrame: number;
}> = ({ entrance, startFrame, endFrame }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame || frame > endFrame + 5) return null;

  const progress = interpolate(frame, [startFrame, endFrame], [0, 1], {
    extrapolateRight: "clamp",
  });

  // 3 ghosts at earlier positions along the entrance path
  return (
    <>
      {[0.2, 0.4, 0.6].map((ghostT, i) => {
        if (progress < ghostT) return null;
        const ghostProgress = Math.max(0, progress - ghostT);
        const opacity = interpolate(ghostProgress, [0, 0.3], [0.3 - i * 0.08, 0], {
          extrapolateRight: "clamp",
        });
        if (opacity <= 0) return null;

        let gx = 0;
        let gy = 0;
        const pathFraction = ghostT;
        switch (entrance) {
          case "bottom":
            gy = interpolate(pathFraction, [0, 1], [400, 0]);
            break;
          case "left":
            gx = interpolate(pathFraction, [0, 1], [-600, 0]);
            break;
          case "right":
            gx = interpolate(pathFraction, [0, 1], [600, 0]);
            break;
          case "top":
            gy = interpolate(pathFraction, [0, 1], [-500, 0]);
            break;
        }

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${gx}px, ${gy}px)`,
              opacity,
              filter: `blur(${3 + i * 2}px)`,
            }}
          />
        );
      })}
    </>
  );
};

// ─── Rain Cloud ──────────────────────────────────────────────────────

interface RainCloudProps {
  config: ChibiRainCloud;
  chibiWidth: number;
}

const RAIN_DROP_COUNT = 24;

export const RainCloud: React.FC<RainCloudProps> = ({ config, chibiWidth }) => {
  const frame = useCurrentFrame();
  const delay = config.delay ?? 0;
  const elapsed = frame - delay;
  if (elapsed < 0) return null;

  const intensity = config.intensity ?? 0.7;
  const color = config.color ?? "#8899aa";

  // Cloud entrance
  const cloudOpacity = interpolate(elapsed, [0, 15], [0, 0.85], {
    extrapolateRight: "clamp",
  });
  const cloudY = interpolate(elapsed, [0, 15], [-30, 0], {
    extrapolateRight: "clamp",
  });

  // Lightning flash
  const hasLightning = config.lightning ?? false;
  const lightningFlash =
    hasLightning && elapsed > 20 && elapsed % 40 < 3
      ? interpolate(elapsed % 40, [0, 1, 3], [0, 0.6, 0])
      : 0;

  const cloudWidth = chibiWidth * 0.55;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: -30,
        transform: `translateX(-50%) translateY(${cloudY}px)`,
        width: cloudWidth,
        opacity: cloudOpacity,
        zIndex: 5,
      }}
    >
      {/* Cloud body */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 60,
        }}
      >
        {/* Cloud puffs */}
        {[
          { x: "20%", y: 10, w: 120, h: 50 },
          { x: "40%", y: 0, w: 150, h: 60 },
          { x: "60%", y: 5, w: 130, h: 55 },
          { x: "30%", y: 15, w: 100, h: 40 },
          { x: "55%", y: 18, w: 90, h: 35 },
        ].map((puff, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: puff.x,
              top: puff.y,
              width: puff.w,
              height: puff.h,
              borderRadius: "50%",
              backgroundColor: `${color}cc`,
              transform: "translateX(-50%)",
              filter: "blur(8px)",
            }}
          />
        ))}

        {/* Lightning flash inside cloud */}
        {lightningFlash > 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 30,
              backgroundColor: `rgba(255,255,240,${lightningFlash})`,
              filter: "blur(10px)",
            }}
          />
        )}
      </div>

      {/* Rain drops */}
      {Array.from({ length: Math.round(RAIN_DROP_COUNT * intensity) }, (_, i) => {
        const x = noise2D("rx", i, 0) * cloudWidth * 0.8;
        const speed = 8 + noise2D("rs", i, 0) * 3;
        const dropY = ((elapsed * speed + i * 30) % 300);
        const dropOpacity = interpolate(dropY, [0, 30, 250, 300], [0, 0.6, 0.5, 0]);
        const dropLength = 12 + noise2D("rl", i, 0) * 6;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `calc(50% + ${x}px)`,
              top: 50 + dropY,
              width: 2,
              height: dropLength,
              borderRadius: 1,
              backgroundColor: color,
              opacity: dropOpacity * intensity,
            }}
          />
        );
      })}
    </div>
  );
};

// ─── Exit VFX (poof particles) ───────────────────────────────────────

interface ExitPoofProps {
  /** Frame when exit starts */
  triggerFrame: number;
  chibiWidth: number;
}

const POOF_PARTICLES = 12;
const POOF_DURATION = 10;

export const ExitPoof: React.FC<ExitPoofProps> = ({ triggerFrame, chibiWidth }) => {
  const frame = useCurrentFrame();
  const elapsed = frame - triggerFrame;
  if (elapsed < 0 || elapsed > POOF_DURATION) return null;

  return (
    <>
      {Array.from({ length: POOF_PARTICLES }, (_, i) => {
        const angle = (i / POOF_PARTICLES) * Math.PI * 2;
        const speed = 40 + (i % 4) * 15;
        const x = Math.cos(angle) * speed * (elapsed / POOF_DURATION);
        const y = Math.sin(angle) * speed * 0.6 * (elapsed / POOF_DURATION) - elapsed * 2;
        const opacity = interpolate(elapsed, [0, 3, POOF_DURATION], [0, 0.6, 0], {
          extrapolateRight: "clamp",
        });
        const size = interpolate(elapsed, [0, POOF_DURATION], [6, 18], {
          extrapolateRight: "clamp",
        });

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              bottom: "30%",
              left: `calc(50% + ${x}px)`,
              transform: "translateX(-50%)",
              marginBottom: y,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: "rgba(200,190,180,0.5)",
              opacity,
              filter: "blur(3px)",
            }}
          />
        );
      })}
    </>
  );
};
