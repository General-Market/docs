import { useCallback, useMemo, type DragEvent as ReactDragEvent } from "react";
import type { Track } from "@/project/schema";
import { useStore, genId } from "@/project/store";
import { TimelineClip } from "./TimelineClip";
import { pxToFrame } from "./timecode";

interface TrackLaneProps {
  track: Track;
  pxPerFrame: number;
  scroll: number;
  viewportWidth: number;
}

export function TrackLane({
  track,
  pxPerFrame,
  scroll,
  viewportWidth,
}: TrackLaneProps) {
  const addClip = useStore((s) => s.addClip);
  const assets = useStore((s) => s.project.media);

  const firstVisibleFrame = scroll / pxPerFrame;
  const lastVisibleFrame = (scroll + viewportWidth) / pxPerFrame;

  const visibleClips = useMemo(() => {
    return track.clips.filter((c) => {
      const end = c.at + (c.out - c.in);
      return end >= firstVisibleFrame && c.at <= lastVisibleFrame;
    });
  }, [track.clips, firstVisibleFrame, lastVisibleFrame]);

  const onDrop = useCallback(
    (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (track.locked) return;
      const assetId = e.dataTransfer.getData("application/x-maxcut-asset");
      if (!assetId) return;
      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const at = Math.max(0, pxToFrame(x, pxPerFrame, scroll));
      const outSourceFrame = Math.max(1, Math.floor(asset.duration) || 60);

      addClip(track.id, {
        id: genId(),
        assetId: asset.id,
        in: 0,
        out: outSourceFrame,
        at,
        linkedTo: [],
        syncOffsetFrames: 0,
        offsetSamples: 0,
        volumeDb: 0,
        phaseInvert: false,
        gainEnvelope: [],
      });
    },
    [track.id, track.locked, assets, pxPerFrame, scroll, addClip],
  );

  const onDragOver = useCallback((e: ReactDragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-maxcut-asset")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  return (
    <div
      className={track.locked ? "mc-lane mc-lane-locked" : "mc-lane"}
      style={{ height: track.height }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      {visibleClips.map((c) => (
        <TimelineClip
          key={c.id}
          clip={c}
          track={track}
          pxPerFrame={pxPerFrame}
          scroll={scroll}
          trackHeight={track.height}
        />
      ))}
    </div>
  );
}
