// Canvas waveform for a single clip. Picks the tier by zoom.
// Redraws on zoom, clip edit, or layout resize. No animation.
// A waveform is not an image; it is a confession of amplitude.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Asset, Clip } from "../project/schema";
import { fetchPeaks } from "./cache";
import { chooseTier, resamplePeaks, type PeaksSource } from "./peaks";

type Props = {
  asset: Asset;
  clip: Clip;
  pxPerFrame: number;
  height: number;
};

function readClipAudioColor(): string {
  if (typeof window === "undefined") return "#2E5968";
  const v = getComputedStyle(document.documentElement).getPropertyValue("--clip-audio").trim();
  return v.length > 0 ? v : "#2E5968";
}

function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function Waveform({ asset, clip, pxPerFrame, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [peaks, setPeaks] = useState<PeaksSource | null>(null);
  const [cssWidth, setCssWidth] = useState<number>(0);

  const tier = chooseTier(pxPerFrame);
  const clipLengthFrames = Math.max(0, clip.out - clip.in);
  const targetWidth = Math.max(1, Math.round(clipLengthFrames * pxPerFrame));

  const color = useMemo(readClipAudioColor, []);
  const fill = useMemo(() => hexWithAlpha(color, 0.6), [color]);
  const stroke = color;

  useEffect(() => {
    let dead = false;
    setPeaks(null);
    fetchPeaks(asset.id, tier)
      .then((r) => {
        if (dead) return;
        setPeaks(r);
      })
      .catch(() => {
        if (dead) return;
        setPeaks(null);
      });
    return () => {
      dead = true;
    };
  }, [asset.id, tier]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCssWidth(Math.round(entry.contentRect.width));
      }
    });
    ro.observe(el);
    setCssWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = Math.max(1, Math.min(targetWidth, cssWidth || targetWidth));
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const pxW = Math.max(1, Math.round(width * dpr));
    const pxH = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pxW) canvas.width = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pxW, pxH);
    if (!peaks || peaks.mins.length === 0) return;

    const pxCount = width;
    const { mins, maxs } = resamplePeaks({
      peaks,
      inFrame: clip.in,
      outFrame: clip.out,
      sourceFps: asset.sourceFps,
      pxCount,
    });

    const mid = pxH / 2;
    const halfH = pxH / 2;

    ctx.fillStyle = fill;
    ctx.beginPath();
    // top hull
    for (let x = 0; x < pxCount; x++) {
      const v = Math.max(-1, Math.min(1, maxs[x]));
      const y = mid - v * halfH;
      const xp = x * dpr + 0.5;
      if (x === 0) ctx.moveTo(xp, y);
      else ctx.lineTo(xp, y);
    }
    // bottom hull, reversed
    for (let x = pxCount - 1; x >= 0; x--) {
      const v = Math.max(-1, Math.min(1, mins[x]));
      const y = mid - v * halfH;
      const xp = x * dpr + 0.5;
      ctx.lineTo(xp, y);
    }
    ctx.closePath();
    ctx.fill();

    // 1 px stroke along the top, reads as a rim.
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, Math.round(dpr));
    ctx.beginPath();
    for (let x = 0; x < pxCount; x++) {
      const v = Math.max(-1, Math.min(1, maxs[x]));
      const y = mid - v * halfH;
      const xp = x * dpr + 0.5;
      if (x === 0) ctx.moveTo(xp, y);
      else ctx.lineTo(xp, y);
    }
    ctx.stroke();
  }, [peaks, clip.in, clip.out, asset.sourceFps, pxPerFrame, height, cssWidth, targetWidth, fill, stroke]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: targetWidth,
        height,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
