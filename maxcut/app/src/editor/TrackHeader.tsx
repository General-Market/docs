import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Track } from "@/project/schema";
import { useStore } from "@/project/store";

interface TrackHeaderProps {
  track: Track;
}

const MIN_HEIGHT = 44;
const MAX_HEIGHT = 140;

export function TrackHeader({ track }: TrackHeaderProps) {
  const patchProject = useStore((s) => s.patchProject);
  const [dragging, setDragging] = useState<{ startY: number; startH: number } | null>(null);
  const trackRef = useRef<Track>(track);
  trackRef.current = track;

  const toggle = useCallback(
    (key: "muted" | "solo" | "locked") => {
      patchProject((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, [key]: !t[key] } : t)),
      }));
    },
    [patchProject, track.id],
  );

  const onResizeMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    setDragging({ startY: e.clientY, startH: trackRef.current.height });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dy = e.clientY - dragging.startY;
      const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, dragging.startH + dy));
      patchProject((p) => ({
        ...p,
        tracks: p.tracks.map((t) => (t.id === track.id ? { ...t, height: next } : t)),
      }));
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, patchProject, track.id]);

  return (
    <div className="mc-track-header" style={{ height: track.height }}>
      <div className="mc-track-header-top">
        <span className="mc-track-name label">{track.name || track.kind.toUpperCase()}</span>
        <div className="mc-track-buttons">
          <button
            type="button"
            className={track.muted ? "mc-track-btn mc-track-btn-on" : "mc-track-btn"}
            onClick={() => toggle("muted")}
            aria-pressed={track.muted}
            title="Mute"
          >
            M
          </button>
          <button
            type="button"
            className={track.solo ? "mc-track-btn mc-track-btn-on" : "mc-track-btn"}
            onClick={() => toggle("solo")}
            aria-pressed={track.solo}
            title="Solo"
          >
            S
          </button>
          <button
            type="button"
            className={track.locked ? "mc-track-btn mc-track-btn-on" : "mc-track-btn"}
            onClick={() => toggle("locked")}
            aria-pressed={track.locked}
            title="Lock"
          >
            L
          </button>
        </div>
      </div>
      <div className="mc-track-resize" onMouseDown={onResizeMouseDown} />
    </div>
  );
}
