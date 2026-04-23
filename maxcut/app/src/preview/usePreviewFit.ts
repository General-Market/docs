import { useEffect, useState } from "react";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Given a container element and a composition aspect ratio, returns the inner
 * letterboxed rectangle that preserves the composition's aspect ratio while
 * fitting inside the container. Resize-observer aware.
 */
export function usePreviewFit(
  container: HTMLElement | null,
  aspect: number,
): Rect {
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    if (!container) return;
    if (!Number.isFinite(aspect) || aspect <= 0) return;

    const compute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) {
        setRect({ x: 0, y: 0, w: 0, h: 0 });
        return;
      }
      const containerAspect = cw / ch;
      let w: number;
      let h: number;
      if (containerAspect > aspect) {
        h = ch;
        w = h * aspect;
      } else {
        w = cw;
        h = w / aspect;
      }
      const x = (cw - w) / 2;
      const y = (ch - h) / 2;
      setRect({ x, y, w, h });
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [container, aspect]);

  return rect;
}
