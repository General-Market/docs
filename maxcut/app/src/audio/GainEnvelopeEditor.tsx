import { useMemo, useRef, useState } from "react";
import type { Clip, GainKeyframe } from "../project/schema";
import { useStore } from "../project/store";
import { addKeyframe, moveKeyframe, removeKeyframe } from "./gainEnvelope";

const DB_MIN = -24;
const DB_MAX = 12;

function dbToY(db: number, height: number): number {
  const t = (db - DB_MIN) / (DB_MAX - DB_MIN);
  const clamped = Math.min(1, Math.max(0, t));
  return height - clamped * height;
}

function yToDb(y: number, height: number): number {
  const t = 1 - y / height;
  const clamped = Math.min(1, Math.max(0, t));
  return DB_MIN + clamped * (DB_MAX - DB_MIN);
}

interface Props {
  clip: Clip;
  pxPerFrame: number;
  height: number;
}

/**
 * Overlay drawn atop a clip when the Pen tool is active.
 * Click empty space → add keyframe. Drag a keyframe → move. Alt-click → remove.
 */
export function GainEnvelopeEditor({ clip, pxPerFrame, height }: Props) {
  const tool = useStore((s) => s.tool);
  const updateClip = useStore((s) => s.updateClip);
  const [dragging, setDragging] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const env = clip.gainEnvelope ?? [];
  const clipFrames = Math.max(0, clip.out - clip.in);
  const width = clipFrames * pxPerFrame;

  const points = useMemo(() => {
    const sorted = [...env].sort((a, b) => a.frame - b.frame);
    return sorted.map((kf) => ({
      kf,
      x: kf.frame * pxPerFrame,
      y: dbToY(kf.db, height),
    }));
  }, [env, pxPerFrame, height]);

  if (tool !== "pen") return null;

  const polyline =
    points.length === 0
      ? ""
      : [
          `0,${dbToY(points[0].kf.db, height)}`,
          ...points.map((p) => `${p.x},${p.y}`),
          `${width},${dbToY(points[points.length - 1].kf.db, height)}`,
        ].join(" ");

  const localPoint = (evt: React.MouseEvent): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const onBackgroundDown = (evt: React.MouseEvent<SVGRectElement>) => {
    const pt = localPoint(evt);
    if (!pt) return;
    const frame = Math.round(pt.x / pxPerFrame);
    const db = yToDb(pt.y, height);
    const next = addKeyframe(env, { frame, db });
    updateClip(clip.id, { gainEnvelope: next });
    evt.stopPropagation();
  };

  const onKeyframeDown =
    (kf: GainKeyframe) => (evt: React.MouseEvent<SVGCircleElement>) => {
      if (evt.altKey) {
        updateClip(clip.id, { gainEnvelope: removeKeyframe(env, kf.frame) });
        evt.stopPropagation();
        return;
      }
      setDragging(kf.frame);
      evt.stopPropagation();
      evt.preventDefault();

      const startFrame = kf.frame;
      const onMove = (e: MouseEvent) => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const toFrame = Math.min(
          Math.max(0, Math.round(x / pxPerFrame)),
          Math.max(0, clipFrames),
        );
        const toDb = yToDb(y, height);
        const current = useStore.getState().project.tracks
          .flatMap((t) => t.clips)
          .find((c) => c.id === clip.id)?.gainEnvelope ?? [];
        updateClip(clip.id, {
          gainEnvelope: moveKeyframe(current, startFrame, toFrame, toDb),
        });
      };
      const onUp = () => {
        setDragging(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        pointerEvents: "auto",
        cursor: "crosshair",
      }}
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onMouseDown={onBackgroundDown}
      />
      {polyline && (
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--accent, #6EC1E4)"
          strokeWidth={1.25}
          pointerEvents="none"
        />
      )}
      {points.map((p) => (
        <circle
          key={p.kf.frame}
          cx={p.x}
          cy={p.y}
          r={dragging === p.kf.frame ? 5 : 3.5}
          fill="var(--accent, #6EC1E4)"
          stroke="#0E0F12"
          strokeWidth={1}
          style={{ cursor: "grab" }}
          onMouseDown={onKeyframeDown(p.kf)}
        />
      ))}
    </svg>
  );
}
