import React from "react";
import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
} from "remotion";
import type {
  Asset,
  Clip,
  Project,
  TextBlock,
  Track,
} from "@/project/schema";
import { gainAtFrame as importedGainAtFrame } from "@/audio/gainEnvelope";
import { dbToLin } from "./dbToLin";

// Fallback matches the signature of the real helper. Kept inline so this file
// type-checks even if the audio module is not yet on disk.
function localGainAtFrame(
  env: { frame: number; db: number }[] | undefined,
  frame: number,
): number {
  if (!env || env.length === 0) return 0;
  const sorted = [...env].sort((a, b) => a.frame - b.frame);
  if (frame <= sorted[0].frame) return sorted[0].db;
  const last = sorted[sorted.length - 1];
  if (frame >= last.frame) return last.db;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const span = b.frame - a.frame;
      if (span <= 0) return b.db;
      const t = (frame - a.frame) / span;
      return a.db + (b.db - a.db) * t;
    }
  }
  return last.db;
}

const gainAtFrame =
  typeof importedGainAtFrame === "function"
    ? importedGainAtFrame
    : localGainAtFrame;

function findAsset(project: Project, assetId: string): Asset | undefined {
  return project.media.find((a) => a.id === assetId);
}

function VideoClipSequence({
  clip,
  asset,
}: {
  clip: Clip;
  asset: Asset;
}): React.ReactElement | null {
  const duration = Math.max(1, clip.out - clip.in);
  return (
    <Sequence from={clip.at} durationInFrames={duration} layout="none">
      <AbsoluteFill>
        <OffthreadVideo
          src={asset.path}
          startFrom={clip.in}
          endAt={clip.out}
          volume={0}
        />
      </AbsoluteFill>
    </Sequence>
  );
}

function AudioClipSequence({
  clip,
  asset,
}: {
  clip: Clip;
  asset: Asset;
}): React.ReactElement | null {
  const duration = Math.max(1, clip.out - clip.in);
  const baseDb = clip.volumeDb ?? 0;
  const envelope = clip.gainEnvelope ?? [];
  const phaseSign = clip.phaseInvert ? -1 : 1;
  return (
    <Sequence from={clip.at} durationInFrames={duration} layout="none">
      <Audio
        src={asset.path}
        startFrom={clip.in}
        endAt={clip.out}
        volume={(f) => phaseSign * dbToLin(baseDb + gainAtFrame(envelope, f))}
      />
    </Sequence>
  );
}

function TextBlockSequence({
  tb,
  width,
  height,
}: {
  tb: TextBlock;
  width: number;
  height: number;
}): React.ReactElement {
  const duration = Math.max(1, tb.to - tb.from);
  const left = tb.x * width;
  const top = tb.y * height;
  const style: React.CSSProperties = {
    position: "absolute",
    left,
    top,
    transform: "translate(-50%, -50%)",
    fontFamily: tb.style.fontFamily,
    fontSize: tb.style.fontSize,
    fontWeight: tb.style.fontWeight,
    color: tb.style.color,
    textAlign: tb.style.align,
    letterSpacing: tb.style.letterSpacing,
    whiteSpace: "pre-wrap",
    padding: tb.style.background ? "4px 10px" : 0,
    background: tb.style.background ?? "transparent",
    pointerEvents: "none",
    lineHeight: 1.15,
  };
  return (
    <Sequence from={tb.from} durationInFrames={duration} layout="none">
      <AbsoluteFill>
        <div style={style}>{tb.content}</div>
      </AbsoluteFill>
    </Sequence>
  );
}

function TrackLayer({
  track,
  project,
}: {
  track: Track;
  project: Project;
}): React.ReactElement | null {
  if (track.muted) return null;

  if (track.kind === "video") {
    return (
      <>
        {track.clips.map((clip) => {
          const asset = findAsset(project, clip.assetId);
          if (!asset || asset.kind !== "video") return null;
          return (
            <VideoClipSequence key={clip.id} clip={clip} asset={asset} />
          );
        })}
      </>
    );
  }

  if (track.kind === "audio") {
    return (
      <>
        {track.clips.map((clip) => {
          const asset = findAsset(project, clip.assetId);
          if (!asset) return null;
          if (asset.kind !== "audio" && asset.kind !== "video") return null;
          return (
            <AudioClipSequence key={clip.id} clip={clip} asset={asset} />
          );
        })}
      </>
    );
  }

  if (track.kind === "text") {
    return (
      <>
        {track.texts.map((tb) => (
          <TextBlockSequence
            key={tb.id}
            tb={tb}
            width={project.meta.width}
            height={project.meta.height}
          />
        ))}
      </>
    );
  }

  return null;
}

export const TimelineComposition: React.FC<Project> = (project) => {
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {project.tracks.map((track) => (
        <TrackLayer key={track.id} track={track} project={project} />
      ))}
    </AbsoluteFill>
  );
};

export default TimelineComposition;
