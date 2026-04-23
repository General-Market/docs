import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Clip, Track } from "@/project/schema";
import { useStore } from "@/project/store";

interface TimelineClipProps {
  clip: Clip;
  track: Track;
  pxPerFrame: number;
  scroll: number;
  trackHeight: number;
}

type DragMode = "move" | "trim-left" | "trim-right" | "fade-in" | "fade-out";

interface DragState {
  mode: DragMode;
  startX: number;
  startIn: number;
  startOut: number;
  startAt: number;
  startFadeInMs: number;
  startFadeOutMs: number;
}

const SNAP_PX = 8;

export function TimelineClip({
  clip,
  track,
  pxPerFrame,
  scroll,
  trackHeight,
}: TimelineClipProps) {
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const updateClip = useStore((s) => s.updateClip);
  const rippleEnabled = useStore((s) => s.rippleEnabled);
  const snapEnabled = useStore((s) => s.snapEnabled);
  const setSnapFlash = useStore((s) => s.setSnapFlash);
  const project = useStore((s) => s.project);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [hovered, setHovered] = useState(false);

  const duration = clip.out - clip.in;
  const left = clip.at * pxPerFrame - scroll;
  const width = Math.max(1, duration * pxPerFrame);

  const selected =
    selection.kind === "clips" && selection.ids.includes(clip.id);

  const kindVar = useMemo(() => {
    switch (track.kind) {
      case "video":
        return "var(--clip-video)";
      case "audio":
        return "var(--clip-audio)";
      case "text":
        return "var(--clip-text)";
      default:
        return "var(--clip-video)";
    }
  }, [track.kind]);

  // Collect snap targets: clip edges on every other track, playhead, markers.
  const snapTargets = useMemo(() => {
    const set = new Set<number>();
    set.add(useStore.getState().playheadFrame);
    for (const t of project.tracks) {
      for (const c of t.clips) {
        if (c.id === clip.id) continue;
        set.add(c.at);
        set.add(c.at + (c.out - c.in));
      }
    }
    for (const m of project.markers) set.add(m.at);
    return Array.from(set);
  }, [project.tracks, project.markers, clip.id]);

  const applySnap = useCallback(
    (frame: number): number => {
      if (!snapEnabled) return frame;
      const threshold = SNAP_PX / pxPerFrame;
      let best: number | null = null;
      let bestDelta = Infinity;
      for (const t of snapTargets) {
        const d = Math.abs(t - frame);
        if (d <= threshold && d < bestDelta) {
          best = t;
          bestDelta = d;
        }
      }
      if (best != null) {
        setSnapFlash(best);
        return best;
      }
      return frame;
    },
    [snapEnabled, pxPerFrame, snapTargets, setSnapFlash],
  );

  const onMouseDown = useCallback(
    (e: ReactMouseEvent, mode: DragMode) => {
      if (track.locked) return;
      e.stopPropagation();
      e.preventDefault();
      setDrag({
        mode,
        startX: e.clientX,
        startIn: clip.in,
        startOut: clip.out,
        startAt: clip.at,
        startFadeInMs: clip.audioFade?.inMs ?? 0,
        startFadeOutMs: clip.audioFade?.outMs ?? 0,
      });

      // Click body = select. Shift extends.
      if (mode === "move") {
        if (e.shiftKey && selection.kind === "clips") {
          const ids = selection.ids.includes(clip.id)
            ? selection.ids
            : [...selection.ids, clip.id];
          setSelection({ kind: "clips", ids });
        } else {
          setSelection({ kind: "clips", ids: [clip.id] });
        }
      }
    },
    [track.locked, clip, selection, setSelection],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      if (track.locked) return;
      const dxPx = e.clientX - drag.startX;
      const dxFrames = Math.round(dxPx / pxPerFrame);

      // Opt disables snap and ripple, per DESIGN §5.4 / §5.5.
      const rippleOn = rippleEnabled && !e.altKey;
      const snapOn = snapEnabled && !e.altKey;

      const duration0 = drag.startOut - drag.startIn;

      if (drag.mode === "move") {
        let nextAt = Math.max(0, drag.startAt + dxFrames);
        if (snapOn) {
          const snappedStart = applySnapRaw(nextAt);
          const snappedEnd = applySnapRaw(nextAt + duration0);
          const deltaStart = Math.abs(snappedStart - nextAt);
          const deltaEnd = Math.abs(snappedEnd - (nextAt + duration0));
          if (deltaStart <= deltaEnd && snappedStart !== nextAt) {
            setSnapFlash(snappedStart);
            nextAt = snappedStart;
          } else if (snappedEnd !== nextAt + duration0) {
            setSnapFlash(snappedEnd);
            nextAt = snappedEnd - duration0;
          }
        }
        updateClip(clip.id, { at: nextAt });
        return;
      }

      if (drag.mode === "trim-left") {
        // Left edge moves: adjust `in` and `at` together, duration shrinks or grows.
        let nextIn = drag.startIn + dxFrames;
        let nextAt = drag.startAt + dxFrames;
        // Clamp so `in >= 0` and `in < out`.
        if (nextIn < 0) {
          nextAt -= nextIn;
          nextIn = 0;
        }
        if (nextIn >= drag.startOut) {
          nextIn = drag.startOut - 1;
          nextAt = drag.startAt + (nextIn - drag.startIn);
        }
        if (snapOn) {
          const snapped = applySnap(nextAt);
          const delta = snapped - nextAt;
          nextAt += delta;
          nextIn += delta;
        }
        if (rippleOn) {
          const delta = nextAt + (drag.startOut - nextIn) - (drag.startAt + duration0);
          rippleFollow(clip.id, track.id, delta);
        }
        updateClip(clip.id, { in: nextIn, at: nextAt });
        return;
      }

      if (drag.mode === "trim-right") {
        let nextOut = drag.startOut + dxFrames;
        if (nextOut <= drag.startIn) nextOut = drag.startIn + 1;
        if (snapOn) {
          const end = drag.startAt + (nextOut - drag.startIn);
          const snapped = applySnap(end);
          const delta = snapped - end;
          nextOut += delta;
        }
        if (rippleOn) {
          const newDuration = nextOut - drag.startIn;
          const delta = newDuration - duration0;
          rippleFollow(clip.id, track.id, delta);
        }
        updateClip(clip.id, { out: nextOut });
        return;
      }

      if (drag.mode === "fade-in" || drag.mode === "fade-out") {
        // Fade handles drag inward, length in frames → ms via project fps.
        const fps = project.meta.fps || 60;
        const msPerFrame = 1000 / fps;
        if (drag.mode === "fade-in") {
          const nextMs = Math.max(0, drag.startFadeInMs + dxFrames * msPerFrame);
          updateClip(clip.id, {
            audioFade: {
              inMs: nextMs,
              outMs: clip.audioFade?.outMs ?? drag.startFadeOutMs,
              curve: clip.audioFade?.curve ?? "equalPower",
            },
          });
        } else {
          const nextMs = Math.max(0, drag.startFadeOutMs - dxFrames * msPerFrame);
          updateClip(clip.id, {
            audioFade: {
              inMs: clip.audioFade?.inMs ?? drag.startFadeInMs,
              outMs: nextMs,
              curve: clip.audioFade?.curve ?? "equalPower",
            },
          });
        }
      }
    };

    const onUp = () => {
      setDrag(null);
      setSnapFlash(null);
    };

    function applySnapRaw(frame: number): number {
      if (!snapEnabled) return frame;
      const threshold = SNAP_PX / pxPerFrame;
      let best: number | null = null;
      let bestDelta = Infinity;
      for (const t of snapTargets) {
        const d = Math.abs(t - frame);
        if (d <= threshold && d < bestDelta) {
          best = t;
          bestDelta = d;
        }
      }
      return best ?? frame;
    }

    function rippleFollow(movedClipId: string, trackId: string, delta: number) {
      if (delta === 0) return;
      useStore.getState().patchProject((p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (t.id !== trackId) return t;
          if (t.locked) return t;
          const moved = t.clips.find((c) => c.id === movedClipId);
          if (!moved) return t;
          const movedEnd = moved.at + (moved.out - moved.in);
          return {
            ...t,
            clips: t.clips.map((c) => {
              if (c.id === movedClipId) return c;
              if (c.at >= movedEnd - delta) return { ...c, at: c.at + delta };
              return c;
            }),
          };
        }),
      }));
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [
    drag,
    clip.id,
    clip.audioFade,
    track.id,
    track.locked,
    pxPerFrame,
    rippleEnabled,
    snapEnabled,
    snapTargets,
    updateClip,
    applySnap,
    setSnapFlash,
    project.meta.fps,
  ]);

  const fadeVisible = track.kind === "audio";

  return (
    <div
      className={selected ? "mc-clip mc-clip-selected" : "mc-clip"}
      style={{
        left,
        width,
        height: trackHeight - 4,
        background: kindVar,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => onMouseDown(e, "move")}
    >
      <div className="mc-clip-label mono">
        {clip.id.slice(0, 4)} · {duration}
      </div>

      {(hovered || selected) && !track.locked && (
        <>
          <div
            className="mc-clip-trim mc-clip-trim-left"
            onMouseDown={(e) => onMouseDown(e, "trim-left")}
          />
          <div
            className="mc-clip-trim mc-clip-trim-right"
            onMouseDown={(e) => onMouseDown(e, "trim-right")}
          />
        </>
      )}

      {fadeVisible && !track.locked && (
        <>
          <div
            className="mc-clip-fade mc-clip-fade-in"
            onMouseDown={(e) => onMouseDown(e, "fade-in")}
          />
          <div
            className="mc-clip-fade mc-clip-fade-out"
            onMouseDown={(e) => onMouseDown(e, "fade-out")}
          />
        </>
      )}
    </div>
  );
}
