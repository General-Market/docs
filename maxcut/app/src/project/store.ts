import { create } from "zustand";
import { temporal } from "zundo";
import type { Project, Clip, Track, TextBlock, Marker, CutSuggestion, Transcript, Asset } from "./schema";
import { emptyProject, newProjectId } from "./schema";

export type Selection =
  | { kind: "none" }
  | { kind: "clips"; ids: string[] }
  | { kind: "texts"; ids: string[] }
  | { kind: "range"; from: number; to: number };

type Tool =
  | "select"
  | "razor"
  | "slip"
  | "slide"
  | "pen"
  | "zoom"
  | "text";

export interface EditorState {
  project: Project;
  playheadFrame: number;
  playing: boolean;
  zoom: number;               // pixels per frame
  scroll: number;             // px from start
  tool: Tool;
  selection: Selection;
  inPoint: number | null;
  outPoint: number | null;
  textEditMode: boolean;
  snapEnabled: boolean;
  rippleEnabled: boolean;
  // Ephemeral indicators — not part of the undo stack.
  snapFlashAt: number | null;
  masterPeakDb: number;

  setProject: (p: Project) => void;
  patchProject: (updater: (p: Project) => Project) => void;
  setPlayhead: (f: number) => void;
  setPlaying: (b: boolean) => void;
  setZoom: (z: number) => void;
  setScroll: (s: number) => void;
  setTool: (t: Tool) => void;
  setSelection: (s: Selection) => void;
  setInOut: (inF: number | null, outF: number | null) => void;
  toggleTextEditMode: () => void;
  setSnapFlash: (frame: number | null) => void;
  setMasterPeakDb: (db: number) => void;

  addAsset: (a: Asset) => void;
  addClip: (trackId: string, clip: Clip) => void;
  updateClip: (clipId: string, patch: Partial<Clip>) => void;
  removeClip: (clipId: string) => void;
  addTrack: (t: Track) => void;
  removeTrack: (trackId: string) => void;
  addMarker: (m: Marker) => void;
  addText: (trackId: string, t: TextBlock) => void;
  updateText: (textId: string, patch: Partial<TextBlock>) => void;
  setSuggestions: (list: CutSuggestion[]) => void;
  updateSuggestion: (id: string, patch: Partial<CutSuggestion>) => void;
  upsertTranscript: (t: Transcript) => void;
}

export const useStore = create<EditorState>()(
  temporal(
    (set, get) => ({
      project: emptyProject(),
      playheadFrame: 0,
      playing: false,
      zoom: 1,
      scroll: 0,
      tool: "select",
      selection: { kind: "none" },
      inPoint: null,
      outPoint: null,
      textEditMode: false,
      snapEnabled: true,
      rippleEnabled: true,
      snapFlashAt: null,
      masterPeakDb: -96,

      setProject: (p) => set({ project: p }),
      patchProject: (updater) => set({ project: updater(get().project) }),
      setPlayhead: (f) => set({ playheadFrame: Math.max(0, Math.floor(f)) }),
      setPlaying: (b) => set({ playing: b }),
      setZoom: (z) => set({ zoom: Math.min(100, Math.max(0.01, z)) }),
      setScroll: (s) => set({ scroll: Math.max(0, s) }),
      setTool: (t) => set({ tool: t }),
      setSelection: (s) => set({ selection: s }),
      setInOut: (inF, outF) => set({ inPoint: inF, outPoint: outF }),
      toggleTextEditMode: () => set({ textEditMode: !get().textEditMode }),
      setSnapFlash: (frame) => set({ snapFlashAt: frame }),
      setMasterPeakDb: (db) => set({ masterPeakDb: db }),

      addAsset: (a) =>
        set({ project: { ...get().project, media: [...get().project.media, a] } }),

      addClip: (trackId, clip) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.map((t) =>
              t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
            ),
          },
        }),

      updateClip: (clipId, patch) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.map((t) => ({
              ...t,
              clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
            })),
          },
        }),

      removeClip: (clipId) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.map((t) => ({
              ...t,
              clips: t.clips.filter((c) => c.id !== clipId),
            })),
          },
        }),

      addTrack: (t) =>
        set({ project: { ...get().project, tracks: [...get().project.tracks, t] } }),

      removeTrack: (trackId) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.filter((t) => t.id !== trackId),
          },
        }),

      addMarker: (m) =>
        set({ project: { ...get().project, markers: [...get().project.markers, m] } }),

      addText: (trackId, tb) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.map((t) =>
              t.id === trackId ? { ...t, texts: [...t.texts, tb] } : t,
            ),
          },
        }),

      updateText: (textId, patch) =>
        set({
          project: {
            ...get().project,
            tracks: get().project.tracks.map((t) => ({
              ...t,
              texts: t.texts.map((tb) => (tb.id === textId ? { ...tb, ...patch } : tb)),
            })),
          },
        }),

      setSuggestions: (list) =>
        set({ project: { ...get().project, suggestions: list } }),

      updateSuggestion: (id, patch) =>
        set({
          project: {
            ...get().project,
            suggestions: get().project.suggestions.map((s) =>
              s.id === id ? { ...s, ...patch } : s,
            ),
          },
        }),

      upsertTranscript: (t) =>
        set({
          project: {
            ...get().project,
            transcripts: [
              ...get().project.transcripts.filter((x) => x.assetId !== t.assetId),
              t,
            ],
          },
        }),
    }),
    {
      limit: 500,
      partialize: (state) => {
        // Only the project goes through the undo stack.
        // Playhead, zoom, selection are ephemeral.
        const { project } = state;
        return { project } as Partial<EditorState>;
      },
      equality: (a, b) => a === b,
    },
  ),
);

export const useTemporal = useStore.temporal;

export function genId(): string {
  return newProjectId();
}
