import { useEffect, useState } from "react";
import { useStore } from "@/project/store";
import { frameToPx } from "./timecode";

interface SnapLineProps {
  pxPerFrame: number;
  scroll: number;
  height: number;
}

// Visible just long enough to register, then it disappears.
// A snap that lingers becomes a distraction.
const FLASH_MS = 180;

export function SnapLine({ pxPerFrame, scroll, height }: SnapLineProps) {
  const snapFlashAt = useStore((s) => s.snapFlashAt);
  const setSnapFlash = useStore((s) => s.setSnapFlash);
  const [visible, setVisible] = useState<number | null>(null);

  useEffect(() => {
    if (snapFlashAt == null) {
      setVisible(null);
      return;
    }
    setVisible(snapFlashAt);
    const id = window.setTimeout(() => {
      setVisible(null);
      setSnapFlash(null);
    }, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [snapFlashAt, setSnapFlash]);

  if (visible == null) return null;

  const x = frameToPx(visible, pxPerFrame, scroll);
  return (
    <div
      className="mc-snap-line"
      style={{
        left: x,
        height,
      }}
    />
  );
}
