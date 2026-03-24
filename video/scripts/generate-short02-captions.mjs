/**
 * Generate captions.json for short-02 from Whisper transcription.
 * Applies word corrections (Whisper mishears several words).
 * Merges split words like "poly market" → "Polymarket".
 */
import { readFileSync, writeFileSync } from "fs";

const whisperData = JSON.parse(
  readFileSync("public/shorts/short-02/voice-final-16k.json", "utf8")
);

// Collect all words from all segments
const rawWords = [];
for (const seg of whisperData.segments) {
  if (!seg.words) continue;
  for (const w of seg.words) {
    const text = w.word.trim();
    if (!text || text.startsWith("[")) continue;
    rawWords.push({
      text,
      startMs: Math.round(w.start * 1000),
      endMs: Math.round(w.end * 1000),
      confidence: w.probability,
    });
  }
}

// ──── Word corrections ────
// Position-based corrections (by index) for words Whisper misheard
const corrections = [];

// Index 0: "me," → split into "In" + "Miami,"
// The audio says "In Miami" but Whisper heard "me,"
corrections.push({ idx: 0, replace: ["In", "Miami,"] });

// "your" → "used" (index 6)
corrections.push({ idx: 6, replace: ["used"] });

// "scores." → "cars." (index 7)
corrections.push({ idx: 7, replace: ["cars."] });

// Find and apply corrections by scanning for known patterns
const captions = [];
let i = 0;

while (i < rawWords.length) {
  const w = rawWords[i];
  const wClean = w.text.replace(/[.,!?'"]/g, "").toLowerCase();
  const nextW = rawWords[i + 1];
  const nextClean = nextW ? nextW.text.replace(/[.,!?'"]/g, "").toLowerCase() : "";

  // First word: "me," → "In Miami,"
  if (i === 0 && wClean === "me") {
    // Split into two words
    const midMs = Math.round((w.startMs + w.endMs) / 2);
    captions.push({ text: "In", startMs: w.startMs, endMs: midMs, confidence: 0.95, timestampMs: w.startMs });
    captions.push({ text: "Miami,", startMs: midMs, endMs: w.endMs, confidence: 0.95, timestampMs: midMs });
    i++;
    continue;
  }

  // "your" → "used" (before "scores"/"cars")
  if (wClean === "your" && nextClean === "scores") {
    captions.push({ text: "used", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "scores" → "cars"
  if (wClean === "scores") {
    captions.push({ text: "cars.", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "Forex trader" at ~7.64 (start of sentence) → "Forex traders"
  if (wClean === "forex" && nextClean === "trader" && nextW && nextW.startMs < 9000 && nextW.startMs > 7000) {
    captions.push({ text: "Forex", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    captions.push({ text: "traders", startMs: nextW.startMs, endMs: nextW.endMs, confidence: 0.95, timestampMs: nextW.startMs });
    i += 2;
    continue;
  }

  // "forks" → "forex" (Whisper heard "forks" for "forex")
  if (wClean === "forks") {
    captions.push({ text: "forex.", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "bitcoin" (lowercase) → "Bitcoin" (capitalize)
  if (wClean === "bitcoin") {
    const punct = w.text.match(/[.,!?]+$/)?.[0] || "";
    captions.push({ text: "Bitcoin" + punct, startMs: w.startMs, endMs: w.endMs, confidence: w.confidence, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "stocks," at ~31.52 (in "any stocks,") → "stock." (script says "any stock")
  if (wClean === "stocks" && w.startMs > 31000 && w.startMs < 32500) {
    captions.push({ text: "stock.", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "hedge fund" → "hedge funds" (throughout)
  if (wClean === "fund" && i > 0 && rawWords[i - 1].text.replace(/[.,!?'"]/g, "").toLowerCase() === "hedge") {
    captions.push({ text: "funds", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "zero" + "dt" → "zero-DTE" (merge)
  if (wClean === "zero" && nextClean === "dt") {
    captions.push({ text: "zero-DTE", startMs: w.startMs, endMs: nextW.endMs, confidence: 0.90, timestampMs: w.startMs });
    i += 2;
    continue;
  }

  // "MemeCoins" → "memecoins"
  if (wClean === "memecoins") {
    const punct = w.text.match(/[.,!?]+$/)?.[0] || "";
    captions.push({ text: "memecoins" + punct, startMs: w.startMs, endMs: w.endMs, confidence: w.confidence, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "poly" + "market" → "Polymarket" (merge two words)
  if (wClean === "poly" && nextClean === "market") {
    const punct = nextW.text.match(/[.,!?]+$/)?.[0] || "";
    captions.push({ text: "Polymarket" + punct, startMs: w.startMs, endMs: nextW.endMs, confidence: 0.95, timestampMs: w.startMs });
    i += 2;
    continue;
  }

  // "maybe" → "Maybe" at start of quoted speech
  if (wClean === "maybe" && w.startMs > 60000) {
    captions.push({ text: "Maybe", startMs: w.startMs, endMs: w.endMs, confidence: w.confidence, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "prediction market," → "prediction markets —"
  if (wClean === "market" && w.startMs > 62000 && w.startMs < 64000) {
    captions.push({ text: "markets", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "Cytadel" → "Citadel"
  if (wClean === "cytadel") {
    captions.push({ text: "Citadel", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "Jup" → "Jump"
  if (wClean === "jup") {
    captions.push({ text: "Jump", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "trading" after "Jump" → "Trading"
  if (wClean === "trading" && i > 0 && rawWords[i - 1].text.replace(/[.,!?'"]/g, "").toLowerCase() === "jup") {
    captions.push({ text: "Trading", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "wanted," → "realized —" (script says "realized")
  if (wClean === "wanted" && w.startMs > 78000) {
    captions.push({ text: "realized", startMs: w.startMs, endMs: w.endMs, confidence: 0.90, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "cards" → "cars" (flipping cars, not cards)
  if (wClean === "cards" && i > 0 && rawWords[i - 1].text.replace(/[.,!?'"]/g, "").toLowerCase() === "flipping") {
    const punct = w.text.match(/[.,!?]+$/)?.[0] || "";
    captions.push({ text: "cars" + punct, startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "in" → "on" before "AGI"
  if (wClean === "in" && nextClean === "agi") {
    captions.push({ text: "on", startMs: w.startMs, endMs: w.endMs, confidence: 0.95, timestampMs: w.startMs });
    i++;
    continue;
  }

  // "AGI" + "arena" → "AgiArena"
  if (wClean === "agi" && nextClean === "arena") {
    const punct = nextW.text.match(/[.,!?]+$/)?.[0] || "";
    captions.push({ text: "AgiArena" + punct, startMs: w.startMs, endMs: nextW.endMs, confidence: 0.95, timestampMs: w.startMs });
    i += 2;
    continue;
  }

  // Strip periods from words (cleaner captions), keep other punctuation
  let text = w.text;

  // Default: pass through
  captions.push({
    text,
    startMs: w.startMs,
    endMs: w.endMs,
    confidence: w.confidence,
    timestampMs: w.startMs,
  });
  i++;
}

writeFileSync(
  "public/shorts/short-02/captions.json",
  JSON.stringify(captions, null, 2)
);
console.log(`Wrote ${captions.length} words to captions.json`);

// ──── Print script alignment ────
console.log("\n=== Caption text preview ===");
let line = "";
for (const c of captions) {
  line += c.text + " ";
}
console.log(line.trim());

// ──── Shot boundary analysis ────
const SCRIPT_LINES = [
  "In Miami, there was a guy flipping used cars.",
  "One day, he saw a forex trader.",
  "Forex traders make more than me. I want to trade forex.",
  "So he became the forex trader.",
  "But then he saw a stock trader.",
  "Stocks are easier than forex. I want to trade stocks.",
  "And he became the stock trader.",
  "Then he saw Bitcoin futures.",
  "Bitcoin is faster than any stock. I want to trade Bitcoin.",
  "And he traded Bitcoin.",
  "But Goldman Sachs was on the other side of every trade.",
  "The hedge funds were stronger than him, he thought.",
  "So he switched to zero-DTE options.",
  "Then the hedge funds followed him there too. So he jumped to memecoins.",
  "And the hedge funds showed up in memecoins.",
  "So he thought, Maybe prediction markets — Polymarket — that's where I'll have an edge.",
  "And finally he traded Polymarket.",
  "But then Citadel and Jump Trading were right there, cutting into his profits.",
  "And so he realized — I want to go back. I want to go back to flipping cars.",
  "That's the lesson. The edge was always in the niche.",
  "See you on AgiArena.",
];

console.log("\n=== Shot boundaries (for shots.ts) ===");
let captionIdx = 0;
for (let s = 0; s < SCRIPT_LINES.length; s++) {
  const line = SCRIPT_LINES[s];
  const firstWord = line.split(" ")[0].replace(/[.,!?'"]/g, "").toLowerCase();
  const wordCount = line.split(" ").length;

  // Find first word match
  for (let j = captionIdx; j < captions.length; j++) {
    const cw = captions[j].text.replace(/[.,!?'"—]/g, "").toLowerCase();
    if (cw === firstWord || (firstWord === "in" && cw === "in" && j === 0)) {
      const endIdx = Math.min(j + wordCount - 1, captions.length - 1);
      const startMs = captions[j].startMs;
      const endMs = captions[endIdx].endMs;
      const nextStartMs = s < SCRIPT_LINES.length - 1 ? null : endMs + 500;

      // Duration: if not last shot, find the next shot's start
      let durMs;
      if (endIdx + 1 < captions.length) {
        // Duration extends to just before next shot
        durMs = endMs - startMs + 200; // Add 200ms tail
      } else {
        durMs = endMs - startMs + 500;
      }

      const durSec = Math.round(durMs / 10) / 100;
      console.log(`  Shot ${s + 1}: ${(startMs / 1000).toFixed(2)}s → ${(endMs / 1000).toFixed(2)}s (${durSec}s) | "${line.substring(0, 50)}..."`);
      captionIdx = endIdx + 1;
      break;
    }
  }
}
