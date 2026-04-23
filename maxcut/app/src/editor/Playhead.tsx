import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { useStore } from "@/project/store";
import { frameToPx, pxToFrame } from "./timecode";

interface PlayheadProps {
  pxPerFrame: number;
  scroll: number;
  height: number;
}

export function Playhead({ pxPerFrame, scroll, height }: PlayheadProps) {
  const playheadFrame = useStore((s) => s.playheadFrame);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);

  const x = frameToPx(playheadFrame, pxPerFrame, scroll);

  const onDiamondDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      // Drag is resolved against the timeline strip, inferred from the diamond parent.
      const parent = containerRef.current?.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const px = e.clientX - rect.left;
      setPlayhead(Math.max(0, pxToFrame(px, pxPerFrame, scroll)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, pxPerFrame, scroll, setPlayhead]);

  return (
    <div
      ref={containerRef}
      className="mc-playhead"
      style={{
        transform: `translateX(${x}px)`,
        height,
      }}
    >
      <div className="mc-playhead-diamond" onMouseDown={onDiamondDown} />
      <div className="mc-playhead-line" />
    </div>
  );
}
