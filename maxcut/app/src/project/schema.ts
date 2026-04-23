import { z } from "zod";

export const PROJECT_VERSION = 1 as const;

export const FFProbeSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  videoCodec: z.string().optional(),
  audioCodec: z.string().optional(),
  audioChannels: z.number().optional(),
  audioSampleRate: z.number().optional(),
  container: z.string().optional(),
  bitrate: z.number().optional(),
});
export type FFProbe = z.infer<typeof FFProbeSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.enum(["video", "audio", "image", "text"]),
  duration: z.number(),
  sourceFps: z.number().default(60),
  probe: FFProbeSchema.default({}),
  peaksPath: z.string().optional(),
  spritePath: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const AudioFadeSchema = z.object({
  inMs: z.number().nonnegative().default(0),
  outMs: z.number().nonnegative().default(0),
  curve: z.enum(["equalPower", "log", "linear"]).default("equalPower"),
});
export type AudioFade = z.infer<typeof AudioFadeSchema>;

export const GainKeyframeSchema = z.object({
  frame: z.number(),
  db: z.number(),
});
export type GainKeyframe = z.infer<typeof GainKeyframeSchema>;

export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().default(1),
  rotate: z.number().default(0),
});
export type Transform = z.infer<typeof TransformSchema>;

export const ClipSchema = z.object({
  id: z.string(),
  assetId: z.string(),
  in: z.number(),
  out: z.number(),
  at: z.number(),
  linkedTo: z.array(z.string()).default([]),
  syncOffsetFrames: z.number().default(0),
  offsetSamples: z.number().default(0),
  volumeDb: z.number().default(0),
  phaseInvert: z.boolean().default(false),
  audioFade: AudioFadeSchema.optional(),
  gainEnvelope: z.array(GainKeyframeSchema).default([]),
  transform: TransformSchema.optional(),
});
export type Clip = z.infer<typeof ClipSchema>;

export const TextStyleSchema = z.object({
  fontFamily: z.string().default("Inter Tight"),
  fontSize: z.number().default(64),
  fontWeight: z.number().default(500),
  color: z.string().default("#FFFFFF"),
  align: z.enum(["left", "center", "right"]).default("center"),
  background: z.string().optional(),
  letterSpacing: z.number().default(0),
});
export type TextStyle = z.infer<typeof TextStyleSchema>;

export const TextBlockSchema = z.object({
  id: z.string(),
  content: z.string(),
  from: z.number(),
  to: z.number(),
  x: z.number().min(0).max(1).default(0.5),
  y: z.number().min(0).max(1).default(0.5),
  style: TextStyleSchema.default({} as TextStyle),
});
export type TextBlock = z.infer<typeof TextBlockSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  kind: z.enum(["video", "audio", "text"]),
  name: z.string().default(""),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
  locked: z.boolean().default(false),
  height: z.number().default(56),
  excludeOnExport: z.boolean().default(false),
  clips: z.array(ClipSchema).default([]),
  texts: z.array(TextBlockSchema).default([]),
});
export type Track = z.infer<typeof TrackSchema>;

export const MarkerSchema = z.object({
  id: z.string(),
  at: z.number(),
  label: z.string().default(""),
  color: z.enum(["cyan", "amber", "red", "green", "white"]).default("cyan"),
  kind: z.enum(["chapter", "note", "todo"]).default("note"),
});
export type Marker = z.infer<typeof MarkerSchema>;

export const CutSuggestionSchema = z.object({
  id: z.string(),
  kind: z.enum(["silence", "filler", "repeat"]),
  assetId: z.string(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
  confidence: z.number(),
  status: z.enum(["pending", "accepted", "rejected"]).default("pending"),
});
export type CutSuggestion = z.infer<typeof CutSuggestionSchema>;

export const WordSchema = z.object({
  text: z.string(),
  start: z.number(),
  end: z.number(),
  confidence: z.number().default(1),
});
export type Word = z.infer<typeof WordSchema>;

export const TranscriptSchema = z.object({
  assetId: z.string(),
  words: z.array(WordSchema),
  sentences: z
    .array(z.object({ start: z.number(), end: z.number() }))
    .default([]),
});
export type Transcript = z.infer<typeof TranscriptSchema>;

export const ClipSliceSchema = z.object({
  clip: ClipSchema,
  track: z.string(),
});

export const ProjectMetaSchema = z.object({
  fps: z.number().default(60),
  width: z.number().default(1920),
  height: z.number().default(1080),
  sampleRate: z.number().default(48000),
  duration: z.number().default(0),
  loudnessTarget: z.enum(["off", "-16 LUFS", "-14 LUFS"]).default("off"),
});
export type ProjectMeta = z.infer<typeof ProjectMetaSchema>;

export const ProjectSchema = z.object({
  version: z.literal(PROJECT_VERSION),
  name: z.string().default("Untitled"),
  meta: ProjectMetaSchema.default({} as ProjectMeta),
  media: z.array(AssetSchema).default([]),
  tracks: z.array(TrackSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
  suggestions: z.array(CutSuggestionSchema).default([]),
  transcripts: z.array(TranscriptSchema).default([]),
  clipboard: z.array(ClipSliceSchema).default([]),
});
export type Project = z.infer<typeof ProjectSchema>;

export function newProjectId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyProject(name = "Untitled"): Project {
  return ProjectSchema.parse({
    version: PROJECT_VERSION,
    name,
    meta: {
      fps: 60,
      width: 1920,
      height: 1080,
      sampleRate: 48000,
      duration: 0,
      loudnessTarget: "off",
    },
    media: [],
    tracks: [
      { id: newProjectId(), kind: "video", name: "V1", height: 72, clips: [], texts: [] },
      { id: newProjectId(), kind: "audio", name: "A1", clips: [], texts: [] },
      { id: newProjectId(), kind: "audio", name: "A2", clips: [], texts: [] },
      { id: newProjectId(), kind: "audio", name: "A3", clips: [], texts: [] },
      { id: newProjectId(), kind: "audio", name: "A4", clips: [], texts: [] },
      { id: newProjectId(), kind: "text", name: "T1", clips: [], texts: [] },
    ],
    markers: [],
    suggestions: [],
    transcripts: [],
    clipboard: [],
  });
}
