/**
 * SceneFrame — the scaffolding that every data scene deserves
 * but would never think to build for itself.
 *
 * Layers background, children, border, badge, color grade, and ambient audio
 * into a single wrapper. The alternative was copy-pasting six components
 * per scene in VisionVCComposition.tsx, which is the kind of repetition
 * that eventually destroys a codebase from within.
 *
 * Layer order (bottom to top):
 *   1. BackgroundLayer  — blurred b-roll photograph, if provided
 *   2. Children         — the actual data visualization
 *   3. IsoSceneBorder   — isometric corner brackets
 *   4. DataBadge        — source identifier pill, top-right
 *   5. ColorGrade       — color temperature overlay
 *   6. AmbientSounds    — scene-matched environmental audio
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { SceneType } from "../audio/AmbientSounds";
import type { GradePreset } from "./ColorGrade";
import { BackgroundLayer } from "../device/BackgroundLayer";
import { IsoSceneBorder } from "../iso/IsoBorder";
import { DataBadge } from "./DataBadge";
import { ColorGrade } from "./ColorGrade";
import { AmbientSounds } from "../audio/AmbientSounds";

export interface SceneFrameProps {
  children: React.ReactNode;
  /** Data source identifier — drives badge, ambient audio, and nothing else */
  source: SceneType;
  /** Path relative to public/ for b-roll image. Omit for void. */
  brollSrc?: string;
  /** Color grade preset */
  grade: GradePreset;
  /** Ken Burns zoom on the background layer */
  motionZoom?: "in" | "out";
  /** Ken Burns drift on the background layer */
  motionDrift?: "left" | "right" | "up" | "down";
  /** Background blur in px (default 4) */
  bgBlur?: number;
  /** Background brightness 0-1 (default 0.25) */
  bgBrightness?: number;
  /** Iso border accent color override */
  borderAccent?: string;
  /** Color grade intensity override (default 0.15) */
  gradeIntensity?: number;
  /** Ambient audio volume 0-1 (default 0.15) */
  ambientVolume?: number;
}

export const SceneFrame: React.FC<SceneFrameProps> = ({
  children,
  source,
  brollSrc,
  grade,
  motionZoom = "in",
  motionDrift,
  bgBlur = 4,
  bgBrightness = 0.25,
  borderAccent,
  gradeIntensity,
  ambientVolume,
}) => {
  return (
    <AbsoluteFill>
      {/* 1. Background — subdued photograph, if one was provided */}
      {brollSrc && (
        <BackgroundLayer
          src={brollSrc}
          blur={bgBlur}
          brightness={bgBrightness}
          zoom={motionZoom}
        />
      )}

      {/* 2. Children — the scene itself, the thing that actually matters */}
      <AbsoluteFill>{children}</AbsoluteFill>

      {/* 3. Isometric border — architectural framing */}
      <IsoSceneBorder accent={borderAccent} />

      {/* 4. Data badge — source identification, top-right */}
      <DataBadge source={source} />

      {/* 5. Color grade — temperature overlay, last visual layer */}
      <ColorGrade preset={grade} intensity={gradeIntensity} />

      {/* 6. Ambient sounds — environmental audio, no visual footprint */}
      <AmbientSounds scene={source} volume={ambientVolume} />
    </AbsoluteFill>
  );
};
