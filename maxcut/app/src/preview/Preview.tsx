import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useStore } from "@/project/store";
import { TimelineComposition } from "@remotion-mc/TimelineComposition";
import { DraggableText } from "./DraggableText";
import { usePreviewFit } from "./usePreviewFit";

export const Preview: React.FC = () => {
  const project = useStore((s) => s.project);
  const playheadFrame = useStore((s) => s.playheadFrame);
  const playing = useStore((s) => s.playing);
  const textEditMode = useStore((s) => s.textEditMode);
  const setPlayhead = useStore((s) => s.setPlayhead);
  const setPlaying = useStore((s) => s.setPlaying);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const playerRef = useRef<PlayerRef | null>(null);

  // Guard re-entrancy between store playhead and Player's frameupdate event.
  const lastAppliedFrame = useRef<number>(-1);
  const suppressFrameEvent = useRef<boolean>(false);

  useLayoutEffect(() => {
    setContainer(containerRef.current);
  }, []);

  const aspect = project.meta.width / Math.max(1, project.meta.height);
  const fitRect = usePreviewFit(container, aspect);

  const durationInFrames = Math.max(1, project.meta.duration || 600);
  const fps = project.meta.fps;

  // Sync playhead from store → Player.
  useEffect(() => {
    const ref = playerRef.current;
    if (!ref) return;
    if (lastAppliedFrame.current === playheadFrame) return;
    lastAppliedFrame.current = playheadFrame;
    suppressFrameEvent.current = true;
    try {
      ref.seekTo(playheadFrame);
    } finally {
      // The Player will emit a frameupdate synchronously or on next tick;
      // we release the guard after a microtask so our own seek doesn't
      // bounce back into the store.
      queueMicrotask(() => {
        suppressFrameEvent.current = false;
      });
    }
  }, [playheadFrame]);

  // Sync transport from store → Player.
  useEffect(() => {
    const ref = playerRef.current;
    if (!ref) return;
    if (playing) ref.play();
    else ref.pause();
  }, [playing]);

  // Sync Player → store.
  useEffect(() => {
    const ref = playerRef.current;
    if (!ref) return;

    const onFrame = (e: { detail: { frame: number } }) => {
      if (suppressFrameEvent.current) return;
      const f = e.detail.frame;
      if (f === lastAppliedFrame.current) return;
      lastAppliedFrame.current = f;
      setPlayhead(f);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    ref.addEventListener("frameupdate", onFrame);
    ref.addEventListener("play", onPlay);
    ref.addEventListener("pause", onPause);
    ref.addEventListener("ended", onEnded);
    return () => {
      ref.removeEventListener("frameupdate", onFrame);
      ref.removeEventListener("play", onPlay);
      ref.removeEventListener("pause", onPause);
      ref.removeEventListener("ended", onEnded);
    };
  }, [setPlayhead, setPlaying]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {fitRect.w > 0 && fitRect.h > 0 ? (
        <div
          style={{
            position: "absolute",
            left: fitRect.x,
            top: fitRect.y,
            width: fitRect.w,
            height: fitRect.h,
          }}
        >
          <Player
            ref={playerRef}
            component={TimelineComposition}
            inputProps={project}
            durationInFrames={durationInFrames}
            fps={fps}
            compositionWidth={project.meta.width}
            compositionHeight={project.meta.height}
            controls={false}
            style={{ width: "100%", height: "100%" }}
            acknowledgeRemotionLicense
          />
        </div>
      ) : null}
      {textEditMode ? <DraggableText videoRect={fitRect} /> : null}
    </div>
  );
};

export default Preview;
