import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
} from "remotion";
import type { ScenePlan, Segment, TransitionType } from "../types";
import { msToFrame } from "../utils/frameConvert";

interface TransitionEvent {
  frame: number;
  type: TransitionType;
  fromSegment: Segment;
  toSegment: Segment;
}

interface SegmentsResult {
  segments: Segment[];
  getSegmentAtFrame: (frame: number) => Segment | null;
  transitions: TransitionEvent[];
  totalDurationFrames: number;
}

export const useSegments = (scenePlanPath: string, fps = 30): SegmentsResult => {
  const [plan, setPlan] = useState<ScenePlan | null>(null);
  const [handle] = useState(() => delayRender("Loading scene plan"));

  useEffect(() => {
    fetch(staticFile(scenePlanPath))
      .then((r) => r.json())
      .then((data: ScenePlan) => {
        setPlan(data);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [scenePlanPath, handle]);

  const segments = plan?.segments ?? [];

  const getSegmentAtFrame = useCallback(
    (frame: number): Segment | null => {
      for (const seg of segments) {
        const startF = msToFrame(seg.startMs, fps);
        const endF = msToFrame(seg.endMs, fps);
        if (frame >= startF && frame < endF) return seg;
      }
      return null;
    },
    [segments, fps],
  );

  const transitions = useMemo((): TransitionEvent[] => {
    const result: TransitionEvent[] = [];
    for (let i = 0; i < segments.length - 1; i++) {
      const from = segments[i];
      const to = segments[i + 1];
      if (to.transition) {
        result.push({
          frame: msToFrame(to.startMs, fps),
          type: to.transition,
          fromSegment: from,
          toSegment: to,
        });
      }
    }
    return result;
  }, [segments, fps]);

  const totalDurationFrames = plan
    ? msToFrame(plan.totalDurationMs, fps)
    : 0;

  return { segments, getSegmentAtFrame, transitions, totalDurationFrames };
};
