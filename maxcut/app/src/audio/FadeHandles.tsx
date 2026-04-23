import { useRef } from "react";
import type { Clip } from "../project/schema";
import { useStore } from "../project/store";

interface Props {
  clip: Clip;
  pxPerFrame: number;
  height: number;
  /** fps of the project — required to convert drag px to ms. */
  fps: number;
}

const HANDLE_SIZE = 10;

/**
 * Two triangles at each clip corner. Drag inward = extend fade (inMs / outMs).
 * Writes to clip.audioFade. Minimum 0, maximum clip length in ms.
 */
export function FadeHandles({ clip, pxPerFrame, height, fps }: Props) {
  const updateClip = useStore((s) => s.updateClip);
  const dragRef = useRef<{
    edge: "in" | "out";
    startX: number;
    startMs: number;
  } | null>(null);

  const clipFrames = Math.max(0, clip.out - clip.in);
  const widthPx = clipFrames * pxPerFrame;
  const clipMs = (clipFrames / fps) * 1000;

  const fade = clip.audioFade ?? { inMs: 0, outMs: 0, curve: "equalPower" as const };
  const msToPx = (ms: number) => (ms / 1000) * fps * pxPerFrame;
  const inPx = Math.min(msToPx(fade.inMs), widthPx);
  const outPx = Math.min(msToPx(fade.outMs), widthPx);

  const onDown =
    (edge: "in" | "out") => (evt: React.MouseEvent<SVGPolygonElement>) => {
      evt.stopPropagation();
      evt.preventDefault();
      dragRef.current = {
        edge,
        startX: evt.clientX,
        startMs: edge === "in" ? fade.inMs : fade.outMs,
      };
      const onMove = (e: MouseEvent) => {
        const d = dragRef.current;
        if (!d) return;
        const dxPx = e.clientX - d.startX;
        // Inward drag = positive fade length. In = drag right; Out = drag left.
        const signedPx = d.edge === "in" ? dxPx : -dxPx;
        const framesDelta = signedPx / pxPerFrame;
        const msDelta = (framesDelta / fps) * 1000;
        const raw = d.startMs + msDelta;
        const clamped = Math.max(0, Math.min(clipMs, raw));
        const nextFade = {
          ...fade,
          inMs: d.edge === "in" ? clamped : fade.inMs,
          outMs: d.edge === "out" ? clamped : fade.outMs,
        };
        updateClip(clip.id, { audioFade: nextFade });
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

  // Triangles sit at the top edge. Left corner points right-down, right corner points left-down.
  const leftTri = `0,0 ${HANDLE_SIZE},0 0,${HANDLE_SIZE}`;
  const rightTri = `${widthPx},0 ${widthPx - HANDLE_SIZE},0 ${widthPx},${HANDLE_SIZE}`;

  return (
    <svg
      width={widthPx}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "none",
      }}
    >
      {/* Fade curves as diagonal guides. */}
      {inPx > 0 && (
        <line
          x1={0}
          y1={height}
          x2={inPx}
          y2={0}
          stroke="var(--fg-dim, #8A91A0)"
          strokeWidth={0.75}
          opacity={0.6}
        />
      )}
      {outPx > 0 && (
        <line
          x1={widthPx - outPx}
          y1={0}
          x2={widthPx}
          y2={height}
          stroke="var(--fg-dim, #8A91A0)"
          strokeWidth={0.75}
          opacity={0.6}
        />
      )}
      <polygon
        points={leftTri}
        fill="var(--fg, #E8ECF1)"
        opacity={0.9}
        style={{ pointerEvents: "auto", cursor: "ew-resize" }}
        onMouseDown={onDown("in")}
      />
      <polygon
        points={rightTri}
        fill="var(--fg, #E8ECF1)"
        opacity={0.9}
        style={{ pointerEvents: "auto", cursor: "ew-resize" }}
        onMouseDown={onDown("out")}
      />
    </svg>
  );
}
