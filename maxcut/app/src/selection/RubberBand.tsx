// Rubber-band overlay for the timeline. Drag to describe a rectangle; on
// release, every clip whose DOMRect intersects becomes the new selection.
//
// The component stays pure about geometry — it asks the parent for the
// clip rects via `getClipRects()` so it never has to know the timeline's
// internal layout. One dashed border, ten-percent fill. No shadows.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { useStore } from "../project/store";

export interface RubberBandProps {
  getClipRects: () => { id: string; rect: DOMRect }[];
  className?: string;
  style?: CSSProperties;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

function toDOMRect(r: Rect): DOMRect {
  return new DOMRect(r.x, r.y, r.w, r.h);
}

export function RubberBand({ getClipRects, className, style }: RubberBandProps) {
  const setSelection = useStore((s) => s.setSelection);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [band, setBand] = useState<Rect | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    // Skip if the user clicked on an actual clip — parent decides; we just
    // start when the mousedown reaches the overlay root itself.
    if (e.target !== e.currentTarget) return;
    originRef.current = { x: e.clientX, y: e.clientY };
    setBand({ x: e.clientX, y: e.clientY, w: 0, h: 0 });
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!band) return;

    const onMove = (e: MouseEvent) => {
      const o = originRef.current;
      if (!o) return;
      const x = Math.min(o.x, e.clientX);
      const y = Math.min(o.y, e.clientY);
      const w = Math.abs(e.clientX - o.x);
      const h = Math.abs(e.clientY - o.y);
      setBand({ x, y, w, h });
    };

    const onUp = () => {
      const cur = band;
      const rects = getClipRects();
      if (cur && (cur.w > 2 || cur.h > 2)) {
        const bandRect = toDOMRect(cur);
        const ids = rects
          .filter((r) => rectsIntersect(bandRect, r.rect))
          .map((r) => r.id);
        if (ids.length > 0) {
          setSelection({ kind: "clips", ids });
        } else {
          setSelection({ kind: "none" });
        }
      }
      originRef.current = null;
      setBand(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [band, getClipRects, setSelection]);

  // Translate the viewport-anchored band into the overlay's local coords.
  const overlayRect = rootRef.current?.getBoundingClientRect();
  const localBand =
    band && overlayRect
      ? {
          left: band.x - overlayRect.left,
          top: band.y - overlayRect.top,
          width: band.w,
          height: band.h,
        }
      : null;

  return (
    <div
      ref={rootRef}
      onMouseDown={onMouseDown}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        ...style,
      }}
    >
      {localBand && (
        <div
          style={{
            position: "absolute",
            left: localBand.left,
            top: localBand.top,
            width: localBand.width,
            height: localBand.height,
            border: "1px dashed var(--accent)",
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
