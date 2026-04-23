// useSyncActions — the three sync verbs bound to the store.
//
//   autoAlignSelection   — two selected audio clips, cross-correlate peaks, apply offset.
//   clapAlignSelection   — two selected clips, detect the first transient in each, align marks.
//   resyncDrifted        — scan selected group, cross-correlate a 2 s window at the drift point.
//
// The peaks cache is imported dynamically so a unit test or a stripped build
// without the cache module still loads this hook. Missing cache → we fail
// gracefully and report a reason.

import { useCallback } from "react";
import type { Clip } from "../project/schema";
import { useStore } from "../project/store";
import { normalizedXcorr } from "./xcorr";
import { detectFirstOnset } from "./onset";

type PeaksResult = { mins: Float32Array; maxs: Float32Array; rateHz: number };

type CacheModule = {
  fetchPeaks: (assetId: string, tier: "low" | "high") => Promise<PeaksResult>;
};

async function loadCache(): Promise<CacheModule | null> {
  try {
    const mod = (await import("../waveform/cache")) as unknown as CacheModule;
    if (!mod || typeof mod.fetchPeaks !== "function") return null;
    return mod;
  } catch {
    return null;
  }
}

export type SyncActionResult = {
  ok: boolean;
  reason?: string;
  appliedFrames?: number;
  correlation?: number;
};

function selectedClips(): Clip[] {
  const { project, selection } = useStore.getState();
  if (selection.kind !== "clips") return [];
  const ids = new Set(selection.ids);
  const out: Clip[] = [];
  for (const t of project.tracks) {
    for (const c of t.clips) {
      if (ids.has(c.id)) out.push(c);
    }
  }
  return out;
}

function findClipById(id: string): Clip | null {
  const { project } = useStore.getState();
  for (const t of project.tracks) {
    for (const c of t.clips) if (c.id === id) return c;
  }
  return null;
}

// Convert a lag measured in peak samples into timeline frames.
function peakSamplesToFrames(samples: number, rateHz: number, fps: number): number {
  return Math.round((samples / rateHz) * fps);
}

export function useSyncActions() {
  const updateClip = useStore((s) => s.updateClip);

  const autoAlignSelection = useCallback(async (): Promise<SyncActionResult> => {
    const clips = selectedClips();
    if (clips.length !== 2) {
      return { ok: false, reason: "select exactly two audio clips" };
    }
    const cache = await loadCache();
    if (!cache) return { ok: false, reason: "peaks cache unavailable" };

    const [a, b] = clips;
    const { project } = useStore.getState();
    const fps = project.meta.fps;

    const [pa, pb] = await Promise.all([
      cache.fetchPeaks(a.assetId, "high"),
      cache.fetchPeaks(b.assetId, "high"),
    ]);
    if (pa.rateHz !== pb.rateHz) {
      return { ok: false, reason: "peak rates differ" };
    }

    // ±5 s window at the peak rate.
    const maxLag = Math.floor(pa.rateHz * 5);
    const { lag, correlation } = normalizedXcorr(pa.maxs, pb.maxs, maxLag);

    if (correlation < 0.3) {
      return { ok: false, reason: `correlation ${correlation.toFixed(2)} too low`, correlation };
    }

    const frames = peakSamplesToFrames(lag, pa.rateHz, fps);
    const prev = b.syncOffsetFrames ?? 0;
    updateClip(b.id, { syncOffsetFrames: prev - frames });
    return { ok: true, appliedFrames: -frames, correlation };
  }, [updateClip]);

  const clapAlignSelection = useCallback(async (): Promise<SyncActionResult> => {
    const clips = selectedClips();
    if (clips.length !== 2) {
      return { ok: false, reason: "select exactly two clips" };
    }
    const cache = await loadCache();
    if (!cache) return { ok: false, reason: "peaks cache unavailable" };

    const [a, b] = clips;
    const { project } = useStore.getState();
    const fps = project.meta.fps;

    const [pa, pb] = await Promise.all([
      cache.fetchPeaks(a.assetId, "high"),
      cache.fetchPeaks(b.assetId, "high"),
    ]);

    const oa = detectFirstOnset(pa.mins, pa.maxs);
    const ob = detectFirstOnset(pb.mins, pb.maxs);
    if (oa === null || ob === null) {
      return { ok: false, reason: "no transient found in one or both clips" };
    }

    // Convert both onsets to frames on their respective rates, then take the
    // difference. b is the secondary — we shift its syncOffsetFrames.
    const frameA = Math.round((oa / pa.rateHz) * fps);
    const frameB = Math.round((ob / pb.rateHz) * fps);
    const delta = frameA - frameB;
    const prev = b.syncOffsetFrames ?? 0;
    updateClip(b.id, { syncOffsetFrames: prev + delta });
    return { ok: true, appliedFrames: delta };
  }, [updateClip]);

  const resyncDrifted = useCallback(async (): Promise<SyncActionResult> => {
    const clips = selectedClips();
    if (clips.length === 0) return { ok: false, reason: "no selection" };

    // Collect the sync group from the first selected clip.
    const seed = clips[0];
    const groupIds = new Set<string>([seed.id, ...(seed.linkedTo ?? [])]);
    const group: Clip[] = [];
    for (const id of groupIds) {
      const c = findClipById(id);
      if (c) group.push(c);
    }
    if (group.length < 2) {
      return { ok: false, reason: "clip is not in a sync group" };
    }

    const cache = await loadCache();
    if (!cache) return { ok: false, reason: "peaks cache unavailable" };

    const { project } = useStore.getState();
    const fps = project.meta.fps;

    // Use the first two group members as reference and secondary.
    const [ref, sec] = group;
    const [pr, ps] = await Promise.all([
      cache.fetchPeaks(ref.assetId, "high"),
      cache.fetchPeaks(sec.assetId, "high"),
    ]);
    if (pr.rateHz !== ps.rateHz) {
      return { ok: false, reason: "peak rates differ" };
    }

    // 2 s window centered at the drift point — we do not track a drift
    // frame, so we bound the search to ±2 s total which is the correct
    // resolution for the §8.5 re-sync.
    const windowSamples = Math.floor(pr.rateHz * 2);
    const refWin = pr.maxs.subarray(0, Math.min(pr.maxs.length, windowSamples));
    const secWin = ps.maxs.subarray(0, Math.min(ps.maxs.length, windowSamples));

    const maxLag = Math.floor(pr.rateHz * 1); // ±1 s of slop
    const { lag, correlation } = normalizedXcorr(refWin, secWin, maxLag);

    if (correlation < 0.3) {
      return { ok: false, reason: `correlation ${correlation.toFixed(2)} too low`, correlation };
    }

    const frames = peakSamplesToFrames(lag, pr.rateHz, fps);
    for (const c of group) {
      if (c.id === ref.id) continue;
      const prev = c.syncOffsetFrames ?? 0;
      updateClip(c.id, { syncOffsetFrames: prev - frames });
    }
    return { ok: true, appliedFrames: -frames, correlation };
  }, [updateClip]);

  return { autoAlignSelection, clapAlignSelection, resyncDrifted };
}
