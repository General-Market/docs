/**
 * Validate voice segment boundaries for short-03.
 *
 * Checks:
 * 1. Word boundary violations (words cut at segment edges)
 * 2. Seamless boundary continuity
 * 3. Continuous-run architecture (no decoder boundary between seamless shots)
 * 4. Tail padding (last word vs segment end)
 * 5. ffmpeg RMS analysis at transition points (detects clicks/pops)
 * 6. Buffer adequacy — is the trailing buffer long enough for natural decay?
 *
 * Run: npx tsx scripts/validate-voice-cuts.ts
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";

interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  timestampMs: number;
}

interface VoiceSegment {
  startMs: number;
  endMs: number;
}

// ── Load data ────────────────────────────────────────────────────────

const captionsPath = resolve(__dirname, "../public/shorts/short-03/captions.json");
const captions: Caption[] = JSON.parse(readFileSync(captionsPath, "utf-8"));

const shotsPath = resolve(__dirname, "../src/shorts/short-03/shots.ts");
const shotsContent = readFileSync(shotsPath, "utf-8");

const segRe = /voiceSegments:\s*\[([^\]]+)\]/g;
const allShotSegments: VoiceSegment[][] = [];
let match: RegExpExecArray | null;
while ((match = segRe.exec(shotsContent)) !== null) {
  const inner = match[1];
  const pairs = [...inner.matchAll(/startMs:\s*(\d+),\s*endMs:\s*(\d+)/g)];
  allShotSegments.push(
    pairs.map((p) => ({ startMs: parseInt(p[1]), endMs: parseInt(p[2]) })),
  );
}

const FPS = 30;
const SCENE_BUFFER_FRAMES = 10;
const msToFrame = (ms: number, fps = FPS) => Math.round((ms / 1000) * fps);

let warnings = 0;
let errors = 0;

console.log("=== Voice Cut Validation (v3 — Auto-Smooth) ===\n");
console.log(`Shots: ${allShotSegments.length}`);
console.log(`Captions: ${captions.length}`);
console.log(`Buffer: ${SCENE_BUFFER_FRAMES} frames (${((SCENE_BUFFER_FRAMES / FPS) * 1000).toFixed(0)}ms)\n`);

// ── Check 1: Boundary types ─────────────────────────────────────────

console.log("--- Boundary Check ---");
const isSeamless: boolean[] = [];
for (let i = 0; i < allShotSegments.length - 1; i++) {
  const lastSeg = allShotSegments[i][allShotSegments[i].length - 1];
  const nextFirstSeg = allShotSegments[i + 1][0];
  const gap = nextFirstSeg.startMs - lastSeg.endMs;
  const seamless = gap === 0;
  isSeamless.push(seamless);

  if (seamless) {
    console.log(`  Shot ${i + 1} → ${i + 2}: SEAMLESS (${lastSeg.endMs}ms)`);
  } else if (gap > 0) {
    console.log(`  Shot ${i + 1} → ${i + 2}: GAPPED (${gap}ms gap)`);
  } else {
    console.log(`  Shot ${i + 1} → ${i + 2}: OVERLAP (${-gap}ms!) *** ERROR`);
    errors++;
  }
}
isSeamless.push(false); // last shot

// ── Check 2: Continuous runs ────────────────────────────────────────

console.log("\n--- Continuous Runs (decoder boundary elimination) ---");
let runStart = 0;
const runs: { start: number; end: number; gapped: boolean }[] = [];
for (let i = 0; i < allShotSegments.length; i++) {
  if (!isSeamless[i]) {
    const isGapped = i < allShotSegments.length - 1; // not last shot
    runs.push({ start: runStart + 1, end: i + 1, gapped: isGapped });
    const voiceStart = allShotSegments[runStart][0].startMs;
    const voiceEnd = allShotSegments[i][allShotSegments[i].length - 1].endMs;
    const shotCount = i - runStart + 1;
    console.log(
      `  Run: Shots ${runStart + 1}-${i + 1} (${shotCount} shots) → ONE <Audio> element ` +
      `(voice ${voiceStart}-${voiceEnd}ms = ${((voiceEnd - voiceStart) / 1000).toFixed(2)}s)` +
      (isGapped ? " + buffer" : ""),
    );
    runStart = i + 1;
  }
}
console.log(`  Total Audio elements: ${runs.length} (was ${allShotSegments.length})`);

// ── Check 3: Word boundary violations ───────────────────────────────

console.log("\n--- Word Boundary Check ---");
const allBoundaries: { ms: number; type: "start" | "end"; shot: number }[] = [];
for (let i = 0; i < allShotSegments.length; i++) {
  for (const seg of allShotSegments[i]) {
    allBoundaries.push({ ms: seg.startMs, type: "start", shot: i + 1 });
    allBoundaries.push({ ms: seg.endMs, type: "end", shot: i + 1 });
  }
}

let wordCuts = 0;
for (const b of allBoundaries) {
  // At seamless boundaries, audio is one continuous stream — word spans are
  // intentional J-cuts and not actual audio cuts.
  const shotIdx = b.shot - 1;
  const boundaryIsSeamless =
    (b.type === "end" && shotIdx < isSeamless.length && isSeamless[shotIdx]) ||
    (b.type === "start" && shotIdx > 0 && isSeamless[shotIdx - 1]);

  const spanning = captions.filter(
    (c) => c.startMs < b.ms && c.endMs > b.ms,
  );
  for (const w of spanning) {
    if (boundaryIsSeamless) {
      console.log(
        `  J-CUT: "${w.text}" (${w.startMs}-${w.endMs}ms) spans seamless boundary at ${b.ms}ms (shot ${b.shot}) — audio continuous, OK`,
      );
    } else {
      console.log(
        `  *** WORD CUT: "${w.text}" (${w.startMs}-${w.endMs}ms) spans shot ${b.shot} ${b.type} at ${b.ms}ms`,
      );
      wordCuts++;
      errors++;
    }
  }

  if (b.type === "end") {
    const tight = captions.filter(
      (c) => c.endMs === b.ms && c.startMs >= b.ms - 500,
    );
    for (const w of tight) {
      const isSeamlessBoundary =
        b.shot <= isSeamless.length && isSeamless[b.shot - 1];
      if (!isSeamlessBoundary) {
        console.log(
          `  ! TIGHT: "${w.text}" ends exactly at gapped boundary ${b.ms}ms (shot ${b.shot}) — no decay room`,
        );
        warnings++;
      }
    }
  }
}
if (wordCuts === 0) console.log("  No mid-word cuts.");

// ── Check 4: Tail padding ───────────────────────────────────────────

console.log("\n--- Tail Padding Check ---");
const MIN_TAIL_MS = 50;
for (let i = 0; i < allShotSegments.length; i++) {
  const segs = allShotSegments[i];
  const lastSeg = segs[segs.length - 1];
  const shotCaps = captions.filter(
    (c) => c.startMs >= segs[0].startMs && c.endMs <= lastSeg.endMs,
  );
  if (shotCaps.length === 0) {
    console.log(`  Shot ${i + 1}: no captions`);
    warnings++;
    continue;
  }
  const lastWord = shotCaps[shotCaps.length - 1];
  const tailMs = lastSeg.endMs - lastWord.endMs;
  const status = tailMs < MIN_TAIL_MS ? (isSeamless[i] ? "OK (seamless)" : "TIGHT") : "OK";
  if (status === "TIGHT") {
    console.log(
      `  Shot ${i + 1}: ${status} — "${lastWord.text}" ends ${tailMs}ms before gapped boundary`,
    );
    warnings++;
  } else {
    console.log(
      `  Shot ${i + 1}: ${status} — "${lastWord.text}" +${tailMs}ms`,
    );
  }
}

// ── Check 5: ffmpeg RMS at transition points ────────────────────────

const voicePath = resolve(__dirname, "../public/shorts/short-03/voice.mp3");
const hasFFmpeg = (() => {
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();

/**
 * Measure peak RMS (dB) over a short window of voice.mp3.
 * Uses ffmpeg volumedetect filter for reliable RMS measurement.
 */
function measureRmsDb(startMs: number, durationMs: number): number | null {
  try {
    const cmd =
      `ffmpeg -i "${voicePath}" -ss ${(startMs / 1000).toFixed(3)} ` +
      `-t ${(durationMs / 1000).toFixed(3)} ` +
      `-af volumedetect -f null - 2>&1`;
    const output = execSync(cmd, { encoding: "utf-8" });
    const rmsMatch = output.match(/mean_volume:\s*(-?[\d.]+)\s*dB/);
    return rmsMatch ? parseFloat(rmsMatch[1]) : null;
  } catch {
    return null;
  }
}

if (hasFFmpeg && existsSync(voicePath)) {
  console.log("\n--- Audio Waveform Analysis (ffmpeg volumedetect) ---");

  for (let i = 0; i < allShotSegments.length - 1; i++) {
    const boundaryMs = allShotSegments[i][allShotSegments[i].length - 1].endMs;
    // Measure 200ms window centered on boundary
    const rmsDb = measureRmsDb(boundaryMs - 100, 200);

    if (rmsDb === null) {
      console.log(`  Shot ${i + 1}→${i + 2}: ffmpeg analysis failed`);
      continue;
    }

    const status = rmsDb < -40 ? "SILENCE" : rmsDb < -25 ? "quiet" : "ACTIVE";
    console.log(
      `  Shot ${i + 1}→${i + 2} (${boundaryMs}ms): RMS ${rmsDb.toFixed(1)}dB [${status}]` +
      (isSeamless[i] ? " — continuous run, no decoder boundary" : " — gapped, separate Audio"),
    );

    if (rmsDb < -40 && isSeamless[i]) {
      console.log(`    ^ Unexpected silence in seamless run — check voice.mp3`);
      warnings++;
    }
  }

  // ── Check 6: Buffer adequacy for gapped boundaries ──────────────
  console.log("\n--- Buffer Adequacy (gapped boundaries only) ---");
  const bufferMs = (SCENE_BUFFER_FRAMES / FPS) * 1000;

  for (let i = 0; i < allShotSegments.length; i++) {
    if (isSeamless[i] || i >= allShotSegments.length - 1) continue;

    const lastSeg = allShotSegments[i][allShotSegments[i].length - 1];
    const cutMs = lastSeg.endMs;

    // Measure RMS right at the cut point (50ms window)
    const rmsAtCut = measureRmsDb(cutMs - 25, 50);
    // Measure RMS at the end of the buffer zone (50ms window)
    const rmsAtBufferEnd = measureRmsDb(cutMs + bufferMs - 25, 50);

    if (rmsAtCut === null) {
      console.log(`  Shot ${i + 1} (cut at ${cutMs}ms): analysis failed`);
      continue;
    }

    const cutStatus = rmsAtCut > -15 ? "LOUD" : rmsAtCut > -25 ? "audible" : "quiet";
    // Below -20dB at buffer end = room noise / background (anti-click handles it).
    // Only flag if actual speech energy persists (>-20dB).
    const bufEndStatus = rmsAtBufferEnd !== null
      ? (rmsAtBufferEnd > -20 ? "STILL LOUD" : rmsAtBufferEnd > -35 ? "fading" : "silent")
      : "unknown";

    const needsMore = rmsAtBufferEnd !== null && rmsAtBufferEnd > -20;
    const icon = needsMore ? "!!!" : "OK";

    console.log(
      `  Shot ${i + 1}: [${icon}] cut=${rmsAtCut.toFixed(1)}dB (${cutStatus}), ` +
      `buffer_end=${rmsAtBufferEnd?.toFixed(1) ?? "?"}dB (${bufEndStatus})`,
    );

    if (needsMore) {
      // Recommend buffer: measure in 50ms steps until RMS < -40dB
      let recMs = bufferMs;
      for (let step = 1; step <= 10; step++) {
        const probeMs = bufferMs + step * 50;
        const probeRms = measureRmsDb(cutMs + probeMs - 25, 50);
        if (probeRms !== null && probeRms < -40) {
          recMs = probeMs;
          break;
        }
        if (step === 10) recMs = probeMs;
      }
      const recFrames = Math.ceil((recMs / 1000) * FPS);
      console.log(
        `    ^ Audio still audible at buffer end. ` +
        `Recommend: ${recFrames} frames (${recMs.toFixed(0)}ms) instead of ${SCENE_BUFFER_FRAMES}`,
      );
      warnings++;
    }
  }
} else {
  console.log("\n--- Audio Waveform Analysis ---");
  console.log("  Skipped (ffmpeg not found or voice.mp3 missing)");
}

// ── Summary ──────────────────────────────────────────────────────────

console.log("\n=== Summary ===");
console.log(`  Errors:   ${errors}`);
console.log(`  Warnings: ${warnings}`);
console.log(`  Voice runs: ${runs.length} (eliminated ${allShotSegments.length - runs.length} decoder boundaries)`);
console.log(
  errors === 0
    ? "\n  All boundaries clean."
    : "\n  *** Fix errors above before rendering. ***",
);

process.exit(errors > 0 ? 1 : 0);
