import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { Clip, Project } from "@/project/schema";
import { useStore, genId } from "@/project/store";
import { Ruler } from "./Ruler";
import { TrackHeader } from "./TrackHeader";
import { TrackLane } from "./TrackLane";
import { Playhead } from "./Playhead";
import { SnapLine } from "./SnapLine";
import { useTransport } from "./useTransport";
import { pxToFrame } from "./timecode";
import "./Timeline.css";

interface TimelineProps {
  project: Project;
  onRazor?: (frame: number) => void;
}

const HEADER_WIDTH = 180;
const RULER_HEIGHT = 22;
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 100;

export function Timeline({ project, onRazor }: TimelineProps) {
  const zoom = useStore((s) => s.zoom);
  const scroll = useStore((s) => s.scroll);
  const setScroll = useStore((s) => s.setScroll);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const rippleEnabled = useStore((s) => s.rippleEnabled);
  const patchProject = useStore((s) => s.patchProject);

  useTransport();

  const stripRef = useRef<HTMLDivElement | null>(null);
  const hoveringStripRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(1200);
  const [panning, setPanning] = useState<{ startX: number; startScroll: number } | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);

  useLayoutEffect(() => {
    if (!stripRef.current) return;
    const el = stripRef.current;
    const ro = new ResizeObserver(() => {
      setViewportWidth(el.clientWidth);
    });
    ro.observe(el);
    setViewportWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Space-hold pan. Capture-phase so we can flip state before keymap processes play/pause —
  // when the cursor is over the timeline strip, pan wins over play.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) {
        return;
      }
      if (!hoveringStripRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setSpaceHeld(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, []);

  // React's synthetic wheel is passive — preventDefault() is a no-op there.
  // Bind natively with { passive: false } to actually suppress page scroll under Ctrl.
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const currentZoom = useStore.getState().zoom;
        const currentScroll = useStore.getState().scroll;
        const frameAtCursor = (currentScroll + cursorX) / currentZoom;

        const factor = Math.exp(-e.deltaY * 0.0015);
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
        const nextScroll = Math.max(0, frameAtCursor * nextZoom - cursorX);
        useStore.getState().setZoom(nextZoom);
        useStore.getState().setScroll(nextScroll);
        return;
      }
      // Horizontal pan. Trackpads send deltaX; mouse wheels send deltaY.
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      const currentScroll = useStore.getState().scroll;
      useStore.getState().setScroll(Math.max(0, currentScroll + delta));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onStripMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const isPanTrigger = e.button === 1 || (e.button === 0 && spaceHeld);
      if (isPanTrigger) {
        e.preventDefault();
        setPanning({ startX: e.clientX, startScroll: scroll });
      }
    },
    [scroll, spaceHeld],
  );

  useEffect(() => {
    if (!panning) return;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - panning.startX;
      setScroll(Math.max(0, panning.startScroll - dx));
    };
    const onUp = () => setPanning(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [panning, setScroll]);

  // Razor: split every clip under `frame` on unlocked tracks. Ripple if enabled.
  const razor = useCallback(
    (frame: number) => {
      patchProject((p) => ({
        ...p,
        tracks: p.tracks.map((t) => {
          if (t.locked) return t;
          const next: Clip[] = [];
          for (const c of t.clips) {
            const end = c.at + (c.out - c.in);
            if (frame > c.at && frame < end) {
              const splitOffset = frame - c.at;
              next.push({ ...c, out: c.in + splitOffset });
              next.push({
                ...c,
                id: genId(),
                in: c.in + splitOffset,
                at: frame,
                linkedTo: [],
              });
            } else {
              next.push(c);
            }
          }
          return { ...t, clips: next };
        }),
      }));
      onRazor?.(frame);
    },
    [patchProject, onRazor],
  );

  // Expose razor globally so shortcuts/keymap can find it without re-wiring props.
  useEffect(() => {
    (window as unknown as { __maxcutRazor?: (f: number) => void }).__maxcutRazor = razor;
    return () => {
      delete (window as unknown as { __maxcutRazor?: (f: number) => void }).__maxcutRazor;
    };
  }, [razor]);

  const stripClickSeek = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      if (panning || spaceHeld) return;
      if (e.button !== 0) return;
      if (e.target !== e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setPlayhead(Math.max(0, pxToFrame(x, zoom, scroll)));
    },
    [panning, spaceHeld, zoom, scroll, setPlayhead],
  );

  const totalHeight = project.tracks.reduce((acc, t) => acc + t.height, 0);

  return (
    <div className="mc-timeline">
      <div className="mc-timeline-left" style={{ width: HEADER_WIDTH }}>
        <div className="mc-ruler-pad">
          <span className="label mono">
            {rippleEnabled ? "RIPPLE" : "—"}
          </span>
        </div>
        <div className="mc-track-headers">
          {project.tracks.map((t) => (
            <TrackHeader key={t.id} track={t} />
          ))}
        </div>
      </div>

      <div
        className="mc-timeline-right"
        ref={stripRef}
        onMouseDown={onStripMouseDown}
        onMouseEnter={() => { hoveringStripRef.current = true; }}
        onMouseLeave={() => { hoveringStripRef.current = false; }}
        style={{ cursor: spaceHeld || panning ? "grab" : "default" }}
      >
        <div className="mc-ruler-wrap" style={{ height: RULER_HEIGHT }}>
          <Ruler fps={project.meta.fps} pxPerFrame={zoom} scroll={scroll} width={viewportWidth} />
        </div>

        <div
          className="mc-tracks"
          style={{ height: totalHeight }}
          onMouseDown={stripClickSeek}
        >
          {project.tracks.map((t) => (
            <TrackLane
              key={t.id}
              track={t}
              pxPerFrame={zoom}
              scroll={scroll}
              viewportWidth={viewportWidth}
            />
          ))}
        </div>

        <Playhead pxPerFrame={zoom} scroll={scroll} height={RULER_HEIGHT + totalHeight} />
        <SnapLine pxPerFrame={zoom} scroll={scroll} height={RULER_HEIGHT + totalHeight} />
      </div>
    </div>
  );
}
