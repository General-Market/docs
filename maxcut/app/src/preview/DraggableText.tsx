import React, { useCallback, useRef } from "react";
import { useStore } from "@/project/store";
import type { TextBlock } from "@/project/schema";

export interface VideoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface DraggableTextProps {
  videoRect: VideoRect;
}

interface TextHit {
  tb: TextBlock;
}

const OUTLINE_COLOR = "var(--accent, #6EC1E4)";
const HANDLE_SIZE = 20;

export const DraggableText: React.FC<DraggableTextProps> = ({ videoRect }) => {
  const project = useStore((s) => s.project);
  const playheadFrame = useStore((s) => s.playheadFrame);
  const updateText = useStore((s) => s.updateText);

  const visible: TextHit[] = [];
  for (const track of project.tracks) {
    if (track.kind !== "text") continue;
    for (const tb of track.texts) {
      if (playheadFrame >= tb.from && playheadFrame <= tb.to) {
        visible.push({ tb });
      }
    }
  }

  if (videoRect.w <= 0 || videoRect.h <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: videoRect.x,
        top: videoRect.y,
        width: videoRect.w,
        height: videoRect.h,
        pointerEvents: "none",
      }}
    >
      {visible.map(({ tb }) => (
        <DraggableTextItem
          key={tb.id}
          tb={tb}
          videoRect={videoRect}
          onMove={(nx, ny) => updateText(tb.id, { x: nx, y: ny })}
        />
      ))}
    </div>
  );
};

interface ItemProps {
  tb: TextBlock;
  videoRect: VideoRect;
  onMove: (x: number, y: number) => void;
}

const DraggableTextItem: React.FC<ItemProps> = ({ tb, videoRect, onMove }) => {
  const startRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      startRef.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        startX: tb.x,
        startY: tb.y,
      };
    },
    [tb.x, tb.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const start = startRef.current;
      if (!start) return;
      if (videoRect.w <= 0 || videoRect.h <= 0) return;
      const dx = (e.clientX - start.pointerX) / videoRect.w;
      const dy = (e.clientY - start.pointerY) / videoRect.h;
      const nx = Math.max(0, Math.min(1, start.startX + dx));
      const ny = Math.max(0, Math.min(1, start.startY + dy));
      onMove(nx, ny);
    },
    [videoRect.w, videoRect.h, onMove],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      startRef.current = null;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    [],
  );

  const left = tb.x * videoRect.w;
  const top = tb.y * videoRect.h;

  // The Player paints the real glyphs; this overlay only supplies a grab target.
  // The minimum box is 20 px (handle target), the max tracks the estimated text size.
  const approxWidth = Math.max(HANDLE_SIZE * 2, tb.content.length * tb.style.fontSize * 0.55);
  const approxHeight = Math.max(HANDLE_SIZE * 2, tb.style.fontSize * 1.3);

  return (
    <div
      role="button"
      aria-label={`Drag text block: ${tb.content}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        left,
        top,
        width: approxWidth,
        height: approxHeight,
        transform: "translate(-50%, -50%)",
        outline: `1px dashed ${OUTLINE_COLOR}`,
        outlineOffset: 2,
        cursor: "move",
        pointerEvents: "auto",
        boxSizing: "border-box",
        background: "transparent",
      }}
    />
  );
};

export default DraggableText;
