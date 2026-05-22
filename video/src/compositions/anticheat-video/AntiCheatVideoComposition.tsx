import React from "react";
import {
  AbsoluteFill,
  Audio,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  staticFile,
} from "remotion";
import manifestRaw from "./manifest.json";

// ─── Types — keep in sync with build_manifest.py ──────────────────────────
type ChosenSpan = {
  start: number;
  end: number;
  duration: number;
  matched: number;
  total: number;
  score: number;
  parakeetText: string;
  parakeetWordCount: number;
  startIdx: number;
  endIdx: number;
};

type SourceData = {
  chosen: ChosenSpan | null;
  candidateCount: number;
  candidates: ChosenSpan[];
};

type ManifestSentence = {
  id: string;
  paragraph: string;
  rhythm: string;
  text: string;
  source: "A" | "B";
  sourceA: SourceData;
  sourceB: SourceData;
  autoPick: string;
  pickReason: string;
  overridden: boolean;
  broll: string | null;
};

export type AntiCheatVideoManifest = {
  version: number;
  fps: number;
  width: number;
  height: number;
  videoOffsetSeconds: number;
  takeAVideoSrc: string;
  takeAAudioSrc: string;
  takeBAudioSrc: string;
  sentences: ManifestSentence[];
  summary: Record<string, unknown>;
};

const manifest = manifestRaw as AntiCheatVideoManifest;

// ─── Layout — frame timeline derived from the chosen span per sentence ────
type Layout = {
  startFrame: number;
  durationFrames: number;
  sentence: ManifestSentence;
};

const buildLayout = (m: AntiCheatVideoManifest): { layout: Layout[]; totalFrames: number } => {
  let frame = 0;
  const layout: Layout[] = [];
  for (const sentence of m.sentences) {
    const chosen = sentence.source === "A" ? sentence.sourceA.chosen : sentence.sourceB.chosen;
    if (!chosen) continue; // skip unmatched sentences silently — flagged in the summary
    const durationFrames = Math.max(1, Math.round(chosen.duration * m.fps));
    layout.push({ startFrame: frame, durationFrames, sentence });
    frame += durationFrames;
  }
  return { layout, totalFrames: frame };
};

// ─── B-roll placeholder ───────────────────────────────────────────────────
const BrollPlaceholder: React.FC<{ sentence: ManifestSentence }> = ({ sentence }) => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at center, #18181b 0%, #09090b 100%)",
      color: "#e5e7eb",
      padding: "120px 160px",
      fontFamily:
        "'SF Pro Display', 'Helvetica Neue', system-ui, -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        alignSelf: "flex-start",
        background: "rgba(244, 63, 94, 0.12)",
        border: "1px solid rgba(244, 63, 94, 0.35)",
        borderRadius: 8,
        padding: "10px 16px",
        color: "#fb7185",
        fontSize: 18,
        fontWeight: 500,
        letterSpacing: "-0.005em",
        fontFeatureSettings: "'tnum'",
      }}
    >
      <span>[B-ROLL]</span>
      <span style={{ color: "#94a3b8" }}>{sentence.id}</span>
      <span style={{ color: "#52525b" }}>·</span>
      <span style={{ color: "#94a3b8" }}>{sentence.paragraph}</span>
    </div>

    <p
      style={{
        fontSize: 44,
        lineHeight: 1.32,
        fontWeight: 500,
        letterSpacing: "-0.022em",
        color: "#f1f5f9",
        maxWidth: 1500,
        margin: 0,
      }}
    >
      {sentence.text}
    </p>

    <div
      style={{
        fontSize: 16,
        color: "#71717a",
        letterSpacing: "-0.005em",
        fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
      }}
    >
      source: {sentence.source} · rhythm: {sentence.rhythm} · {sentence.pickReason}
    </div>
  </AbsoluteFill>
);

// ─── Per-sentence clip ─────────────────────────────────────────────────────
const SentenceClip: React.FC<{ sentence: ManifestSentence; fps: number; videoOffsetSeconds: number }> = ({
  sentence,
  fps,
  videoOffsetSeconds,
}) => {
  const source = sentence.source;
  const chosen = source === "A" ? sentence.sourceA.chosen : sentence.sourceB.chosen;
  if (!chosen) return null;

  const audioSrc = source === "A" ? manifest.takeAAudioSrc : manifest.takeBAudioSrc;
  const audioStartFrame = Math.round(chosen.start * fps);
  const audioEndFrame = Math.round(chosen.end * fps);

  return (
    <>
      <Audio
        src={staticFile(audioSrc)}
        startFrom={audioStartFrame}
        endAt={audioEndFrame}
      />
      {source === "A" ? (
        <OffthreadVideo
          src={staticFile(manifest.takeAVideoSrc)}
          startFrom={Math.round((chosen.start + videoOffsetSeconds) * fps)}
          endAt={Math.round((chosen.end + videoOffsetSeconds) * fps)}
          muted
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      ) : (
        <BrollPlaceholder sentence={sentence} />
      )}
    </>
  );
};

// ─── Composition ──────────────────────────────────────────────────────────
export const AntiCheatVideoComposition: React.FC = () => {
  const { layout } = buildLayout(manifest);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {layout.length === 0 ? (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            color: "#71717a",
            fontFamily: "'SF Pro Display', system-ui, sans-serif",
            fontSize: 28,
          }}
        >
          manifest is empty — run 06-voiceover/build_manifest.py
        </AbsoluteFill>
      ) : (
        layout.map(({ startFrame, durationFrames, sentence }) => (
          <Sequence
            key={sentence.id}
            from={startFrame}
            durationInFrames={durationFrames}
            premountFor={manifest.fps}
            name={`${sentence.id} [${sentence.source}]`}
          >
            <SentenceClip
              sentence={sentence}
              fps={manifest.fps}
              videoOffsetSeconds={manifest.videoOffsetSeconds}
            />
          </Sequence>
        ))
      )}
    </AbsoluteFill>
  );
};

// ─── Metadata calculation — dynamic duration from the manifest ────────────
const calculateMetadata: CalculateMetadataFunction<Record<string, never>> = async () => {
  const { totalFrames } = buildLayout(manifest);
  return {
    durationInFrames: Math.max(60, totalFrames + manifest.fps), // pad 1 second
    fps: manifest.fps,
    width: manifest.width,
    height: manifest.height,
  };
};

// ─── Meta export — for Root.tsx registration ──────────────────────────────
export const antiCheatVideoMeta = {
  id: "AntiCheatVideo",
  component: AntiCheatVideoComposition,
  durationInFrames: 60, // placeholder; calculateMetadata overrides
  fps: manifest.fps,
  width: manifest.width,
  height: manifest.height,
  calculateMetadata,
};
