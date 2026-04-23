// Thumbnail strip for a video clip. One tile per second from the source.
// Positions each tile where its source second lands inside the visible clip range.
// If the sprite is absent, render nothing. Silence is a graceful failure.

import { useEffect, useState } from "react";
import type { Asset, Clip } from "../project/schema";
import { SPRITE_TILE_H, SPRITE_TILE_W, secondsInRange } from "./sprite";

type Props = {
  asset: Asset;
  clip: Clip;
  pxPerFrame: number;
  height: number;
};

const status = new Map<string, "ok" | "missing">();

function spriteUrl(assetId: string): string {
  return `/api/thumbs/${encodeURIComponent(assetId)}.webp`;
}

function useSpriteAvailability(assetId: string): "unknown" | "ok" | "missing" {
  const initial = status.get(assetId) ?? "unknown";
  const [state, setState] = useState<"unknown" | "ok" | "missing">(initial);

  useEffect(() => {
    const cached = status.get(assetId);
    if (cached) {
      setState(cached);
      return;
    }
    let dead = false;
    const img = new Image();
    img.onload = () => {
      if (dead) return;
      status.set(assetId, "ok");
      setState("ok");
    };
    img.onerror = () => {
      if (dead) return;
      status.set(assetId, "missing");
      setState("missing");
    };
    img.src = spriteUrl(assetId);
    return () => {
      dead = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [assetId]);

  return state;
}

export function Strip({ asset, clip, pxPerFrame, height }: Props) {
  const available = useSpriteAvailability(asset.id);
  if (available !== "ok") return null;
  if (asset.kind !== "video") return null;

  const fps = asset.sourceFps > 0 ? asset.sourceFps : 60;
  const clipLengthFrames = Math.max(0, clip.out - clip.in);
  const width = Math.max(1, Math.round(clipLengthFrames * pxPerFrame));

  const seconds = secondsInRange(clip.in, clip.out, fps);
  const scaleY = height / SPRITE_TILE_H;
  const tileRenderW = Math.round(fps * pxPerFrame); // one source-second worth of timeline pixels
  const url = spriteUrl(asset.id);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {seconds.map((sec) => {
        const sourceFrame = sec * fps;
        const timelineX = Math.round((sourceFrame - clip.in) * pxPerFrame);
        const renderW = Math.max(1, tileRenderW);
        const bgScale = renderW / SPRITE_TILE_W;
        return (
          <div
            key={sec}
            style={{
              position: "absolute",
              left: timelineX,
              top: 0,
              width: renderW,
              height,
              backgroundImage: `url(${url})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: `${-sec * SPRITE_TILE_W * bgScale}px 0`,
              backgroundSize: `auto ${SPRITE_TILE_H * scaleY}px`,
              imageRendering: "auto",
            }}
          />
        );
      })}
    </div>
  );
}
