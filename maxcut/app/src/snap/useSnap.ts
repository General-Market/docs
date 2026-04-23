// Magnetic snap hook. Reads the project from the store, returns a snap
// function that callers invoke during drag / trim.
//
// Modifiers:
//   alt   → disables snap entirely
//   shift → frame-grid only (inputs are already frames, so: identity)
//   none  → snap to the nearest target within 8 px
//
// Zero-crossing snap (Z modifier) is deferred per scope.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "../project/store";
import { collectSnapTargets } from "./targets";

const SNAP_THRESHOLD_PX = 8;
const FLASH_CLEAR_MS = 100;

export interface SnapModifiers {
  shift: boolean;
  alt: boolean;
}

export type SnapFn = (
  candidateFrame: number,
  playheadFrame: number,
  pxPerFrame: number,
  modifiers: SnapModifiers,
) => number;

export function useSnap(opts?: {
  includeWords?: boolean;
  excludeClipId?: string;
}): SnapFn {
  const project = useStore((s) => s.project);
  const setSnapFlash = useStore((s) => s.setSnapFlash);

  const targets = useMemo(
    () =>
      collectSnapTargets(project, {
        includeWords: opts?.includeWords,
        excludeClipId: opts?.excludeClipId,
      }),
    [project, opts?.includeWords, opts?.excludeClipId],
  );

  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const flash = useCallback(
    (frame: number | null) => {
      setSnapFlash(frame);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (frame !== null) {
        flashTimer.current = setTimeout(() => {
          setSnapFlash(null);
        }, FLASH_CLEAR_MS);
      }
    },
    [setSnapFlash],
  );

  return useCallback<SnapFn>(
    (candidate, playhead, pxPerFrame, mods) => {
      if (mods.alt) {
        flash(null);
        return candidate;
      }
      if (mods.shift) {
        // Candidates already arrive as frames; enforce integer.
        const snapped = Math.round(candidate);
        flash(null);
        return snapped;
      }

      const thresholdFrames =
        pxPerFrame > 0 ? SNAP_THRESHOLD_PX / pxPerFrame : SNAP_THRESHOLD_PX;

      // Nearest target, including the playhead.
      let best: number | null = null;
      let bestDist = Infinity;
      const all = [...targets, playhead];
      for (const t of all) {
        const d = Math.abs(t - candidate);
        if (d < bestDist) {
          bestDist = d;
          best = t;
        }
      }

      if (best !== null && bestDist <= thresholdFrames) {
        flash(best);
        return best;
      }
      flash(null);
      return candidate;
    },
    [targets, flash],
  );
}
