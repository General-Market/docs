import { useEffect, useRef } from "react";
import { useStore } from "@/project/store";

// rAF runs at monitor rate; we convert elapsed ms into frames at project fps.
// When the last clip ends, pause. Silence is honest.
export function useTransport(): void {
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    function tick(now: number) {
      const s = useStore.getState();
      if (!s.playing) {
        lastTickRef.current = null;
        rafRef.current = null;
        return;
      }

      const fps = s.project.meta.fps || 60;
      const last = lastTickRef.current;
      if (last == null) {
        lastTickRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const elapsedMs = now - last;
      const frames = (elapsedMs * fps) / 1000;

      if (frames >= 1) {
        const advance = Math.floor(frames);
        lastTickRef.current = last + (advance * 1000) / fps;

        const end = lastClipFrame(s.project);
        const next = s.playheadFrame + advance;

        if (end > 0 && next >= end) {
          s.setPlayhead(end);
          s.setPlaying(false);
          lastTickRef.current = null;
          rafRef.current = null;
          return;
        }

        s.setPlayhead(next);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    const unsub = useStore.subscribe((state, prev) => {
      if (state.playing && !prev.playing) {
        lastTickRef.current = null;
        if (rafRef.current == null) {
          rafRef.current = requestAnimationFrame(tick);
        }
      }
      if (!state.playing && prev.playing) {
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        lastTickRef.current = null;
      }
    });

    // If we mount mid-play, kick the loop.
    if (useStore.getState().playing && rafRef.current == null) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      unsub();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = null;
    };
  }, []);
}

function lastClipFrame(project: ReturnType<typeof useStore.getState>["project"]): number {
  let end = 0;
  for (const t of project.tracks) {
    for (const c of t.clips) {
      const clipEnd = c.at + (c.out - c.in);
      if (clipEnd > end) end = clipEnd;
    }
  }
  return end;
}
