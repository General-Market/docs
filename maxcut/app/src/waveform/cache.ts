// Peaks fetch + memory cache. Keyed by asset and tier.
// LRU by accessed-at. Bound the sum of bytes to a fixed budget; evict the oldest.
// A cache is a promise that forgetting can be deferred, not avoided.

import { PEAKS_HZ, type PeaksTier, decodePeaks } from "./format";

const MAX_BYTES = 200 * 1024 * 1024;

type Entry = {
  key: string;
  mins: Float32Array;
  maxs: Float32Array;
  rateHz: number;
  bytes: number;
  touchedAt: number;
};

const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
let totalBytes = 0;

function keyFor(assetId: string, tier: PeaksTier): string {
  return `${assetId}:${tier}`;
}

function touch(entry: Entry): void {
  entry.touchedAt = performance.now();
  // re-insert so Map iteration order reflects recency
  entries.delete(entry.key);
  entries.set(entry.key, entry);
}

function evictToBudget(): void {
  if (totalBytes <= MAX_BYTES) return;
  const it = entries.values();
  while (totalBytes > MAX_BYTES) {
    const next = it.next();
    if (next.done) return;
    const victim = next.value;
    entries.delete(victim.key);
    totalBytes -= victim.bytes;
  }
}

export type PeaksResult = { mins: Float32Array; maxs: Float32Array; rateHz: number };

export async function fetchPeaks(assetId: string, tier: PeaksTier): Promise<PeaksResult> {
  const key = keyFor(assetId, tier);
  const hit = entries.get(key);
  if (hit) {
    touch(hit);
    return { mins: hit.mins, maxs: hit.maxs, rateHz: hit.rateHz };
  }
  const existing = inflight.get(key);
  if (existing) {
    const e = await existing;
    return { mins: e.mins, maxs: e.maxs, rateHz: e.rateHz };
  }

  const p = (async (): Promise<Entry> => {
    const url = `/api/peaks/${encodeURIComponent(assetId)}?tier=${tier}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`fetchPeaks: ${res.status} ${res.statusText}`);
    }
    const buf = await res.arrayBuffer();
    const decoded = decodePeaks(buf);
    const rateHz = decoded.rateHz || PEAKS_HZ[tier];
    const bytes = decoded.mins.byteLength + decoded.maxs.byteLength;
    const entry: Entry = {
      key,
      mins: decoded.mins,
      maxs: decoded.maxs,
      rateHz,
      bytes,
      touchedAt: performance.now(),
    };
    entries.set(key, entry);
    totalBytes += bytes;
    evictToBudget();
    return entry;
  })();

  inflight.set(key, p);
  try {
    const e = await p;
    return { mins: e.mins, maxs: e.maxs, rateHz: e.rateHz };
  } finally {
    inflight.delete(key);
  }
}

export function invalidatePeaks(assetId: string): void {
  for (const tier of Object.keys(PEAKS_HZ) as PeaksTier[]) {
    const key = keyFor(assetId, tier);
    const hit = entries.get(key);
    if (hit) {
      entries.delete(key);
      totalBytes -= hit.bytes;
    }
  }
}

export function clearPeaksCache(): void {
  entries.clear();
  totalBytes = 0;
}

export function peaksCacheStats(): { count: number; bytes: number; maxBytes: number } {
  return { count: entries.size, bytes: totalBytes, maxBytes: MAX_BYTES };
}
