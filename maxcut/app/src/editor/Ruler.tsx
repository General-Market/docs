import { useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { framesToTimecode, pxToFrame } from "./timecode";
import { useStore } from "@/project/store";

interface RulerProps {
  fps: number;
  pxPerFrame: number;
  scroll: number;
  width: number;
}

export function Ruler({ fps, pxPerFrame, scroll, width }: RulerProps) {
  const setPlayhead = useStore((s) => s.setPlayhead);

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setPlayhead(Math.max(0, pxToFrame(x, pxPerFrame, scroll)));
    },
    [pxPerFrame, scroll, setPlayhead],
  );

  const ticks: Array<{ x: number; frame: number; major: boolean; label?: string }> = [];

  const secondStep = fps;
  const framesVisible = width / pxPerFrame;
  const pxPerSecond = pxPerFrame * secondStep;

  // Pick a second-interval that gives at least ~60 px between major ticks.
  let secondInterval = 1;
  if (pxPerSecond < 60) {
    const base = [1, 2, 5, 10, 30, 60, 120, 300, 600];
    for (const b of base) {
      if (pxPerFrame * fps * b >= 60) {
        secondInterval = b;
        break;
      }
    }
    if (secondInterval === 1) secondInterval = 600;
  }

  const firstFrame = Math.max(0, Math.floor(scroll / pxPerFrame));
  const lastFrame = Math.ceil((scroll + width) / pxPerFrame);

  const majorStep = fps * secondInterval;
  const firstMajor = Math.floor(firstFrame / majorStep) * majorStep;

  for (let f = firstMajor; f <= lastFrame; f += majorStep) {
    const x = f * pxPerFrame - scroll;
    ticks.push({ x, frame: f, major: true, label: framesToTimecode(f, fps) });
  }

  // Minor ticks every 5 frames when zoom is generous enough to justify them.
  if (pxPerFrame >= 2 && framesVisible < 6000) {
    const minorStep = 5;
    const firstMinor = Math.floor(firstFrame / minorStep) * minorStep;
    for (let f = firstMinor; f <= lastFrame; f += minorStep) {
      if (f % majorStep === 0) continue;
      const x = f * pxPerFrame - scroll;
      ticks.push({ x, frame: f, major: false });
    }
  }

  return (
    <div className="mc-ruler" onMouseDown={onClick}>
      {ticks.map((t) => (
        <div
          key={`${t.major ? "M" : "m"}-${t.frame}`}
          className={t.major ? "mc-ruler-tick mc-ruler-tick-major" : "mc-ruler-tick"}
          style={{ left: t.x }}
        >
          {t.major && t.label ? <span className="mc-ruler-label mono">{t.label}</span> : null}
        </div>
      ))}
    </div>
  );
}
