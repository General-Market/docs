/**
 * Convert Whisper JSON output to our Caption pipeline format.
 * Also computes shot boundary timings.
 *
 * Usage: node scripts/convert-whisper-to-captions.mjs
 */
import { readFileSync, writeFileSync } from "fs";

const whisperData = JSON.parse(
  readFileSync("public/shorts/short-01/voice-raw-clean-16k.json", "utf8")  // using the first transcription that has original timestamps
);

// Whisper timestamps are based on the audio BEFORE trimming
// v3: 0.34s original trim + 0.30s leading silence trim = 0.64s total
const TRIM_OFFSET = 0.64;

// ──── Splice adjustments ────────────────────────────────────────────────
// The audio was surgically edited (voice-surgery-v4.wav) with these cuts:
//   V1 splices (original):
//     1. Gap closure: removed 0.64s at raw 53.52–54.16s
//     2. "at" removal: removed 0.34s at raw 58.48–58.82s
//     3. End trim: cut after raw 77.82s
//   V4 splices (moderate hook tightening + cut sentence):
//     4-8. Close inter-shot gaps in first 13s (less aggressive than v2)
//     9. Remove "hits before anyone else" from shot 6
//
// Splice offsets shift timestamps AFTER each cut point (using raw positions).
// MUST be in chronological order (raw position).
const SPLICES = [
  // V4: moderate gap closures (more breathing room than v2)
  { rawCutStart: 4.68,  rawCutEnd: 4.88,  removedSec: 0.20 },  // gap shot 1→2
  { rawCutStart: 6.51,  rawCutEnd: 6.66,  removedSec: 0.15 },  // gap shot 2→3 (was 0.30)
  { rawCutStart: 10.34, rawCutEnd: 10.54, removedSec: 0.20 },  // gap shot 3→4
  { rawCutStart: 12.26, rawCutEnd: 12.34, removedSec: 0.08 },  // gap shot 4→5 (40ms onset buffer)
  { rawCutStart: 13.46, rawCutEnd: 13.54, removedSec: 0.08 },  // gap shot 5→6 (40ms onset buffer)
  // V4: cut "hits before anyone else" (shot 6 ends after "breakout")
  { rawCutStart: 14.06, rawCutEnd: 16.14, removedSec: 2.08 },  // sentence cut
  // V1: original splices (later in the file)
  { rawCutStart: 53.52, rawCutEnd: 54.16, removedSec: 0.64 },  // gap closure
  { rawCutStart: 58.48, rawCutEnd: 58.82, removedSec: 0.34 },  // "at" removal
];
const RAW_END_CUT = 77.82;  // everything after this raw position is trimmed

// Skip "at" word: raw start ~58.48s (the word sits right at splice point 2)
const SKIP_AT_RAW_START = 58.40;  // slightly before to catch it
const SKIP_AT_RAW_END = 58.90;    // slightly after

// Skip "hits before anyone else" words (raw ~14.06–15.84s)
const SKIP_SENTENCE_RAW_START = 14.00;
const SKIP_SENTENCE_RAW_END = 16.00;
const SKIP_SENTENCE_WORDS = new Set(["hits", "before", "anyone", "else"]);

/**
 * Apply splice offsets to a trimmed timestamp.
 * Input: raw timestamp from Whisper.
 * Output: adjusted timestamp accounting for trim + all splices.
 */
function adjustTimestamp(rawSec) {
  // First apply trim offset
  let adjusted = rawSec - TRIM_OFFSET;

  // Then apply cumulative splice shifts
  let cumulativeShift = 0;
  for (const splice of SPLICES) {
    const trimmedCutStart = splice.rawCutStart - TRIM_OFFSET;
    const trimmedCutEnd = splice.rawCutEnd - TRIM_OFFSET;

    if (adjusted >= trimmedCutEnd) {
      // After this splice: shift back by removed amount
      cumulativeShift += splice.removedSec;
    } else if (adjusted > trimmedCutStart) {
      // Inside the cut region: snap to cut start
      adjusted = trimmedCutStart;
      cumulativeShift += splice.removedSec;
    }
  }

  return Math.max(0, adjusted - cumulativeShift);
}

// Word corrections (Whisper misheard these)
const WORD_FIXES = {
  "water": "wrote",
  "check.": "check.",  // keep
  "picked": "Pictures'",
  "wrong": "rank",
  "cold": "call",
  "gates": "hits",
  "sportbook": "sportsbook",
  "sportbooks.": "sportsbooks.",
  "swapped": "swiped",
  "judge": "JoJo",
  "our": "",  // remove ("judge our fans" → "JoJo fans")
  "viewers": "views",
};

// Collect all words with corrected text and adjusted timestamps
const captions = [];
for (const segment of whisperData.segments) {
  if (!segment.words) continue;
  for (const w of segment.words) {
    let text = w.word.trim();
    if (!text || text.startsWith("[")) continue;

    // Skip words past the end cut
    if (w.start >= RAW_END_CUT) continue;

    // Skip "at" word in the splice region
    if (w.start >= SKIP_AT_RAW_START && w.start <= SKIP_AT_RAW_END) {
      const cleanWord = text.replace(/[.,!?]/g, "").toLowerCase();
      if (cleanWord === "at") continue;
    }

    // Skip "hits before anyone else" words (cut from shot 6)
    if (w.start >= SKIP_SENTENCE_RAW_START && w.start <= SKIP_SENTENCE_RAW_END) {
      const cleanWord = text.replace(/[.,!?]/g, "").toLowerCase();
      if (SKIP_SENTENCE_WORDS.has(cleanWord)) continue;
    }

    // Skip words that fall inside cut regions
    let insideCut = false;
    for (const splice of SPLICES) {
      if (w.start >= splice.rawCutStart && w.end <= splice.rawCutEnd) {
        insideCut = true;
        break;
      }
    }
    if (insideCut) continue;

    // Apply fixes
    const cleanKey = text.replace(/[.,!?]/g, "");
    const suffix = text.replace(cleanKey, "");  // punctuation
    if (WORD_FIXES[cleanKey] !== undefined) {
      if (WORD_FIXES[cleanKey] === "") continue; // skip word
      text = WORD_FIXES[cleanKey] + suffix;
    }
    if (WORD_FIXES[text] !== undefined) {
      text = WORD_FIXES[text];
    }

    // Strip periods from caption text
    text = text.replace(/\./g, "");
    if (!text) continue;  // skip if only punctuation

    // Adjust timestamps with trim + splice offsets
    const startMs = Math.max(0, Math.round(adjustTimestamp(w.start) * 1000));
    const endMs = Math.max(0, Math.round(adjustTimestamp(w.end) * 1000));

    captions.push({
      text,
      startMs,
      endMs,
      confidence: w.probability,
      timestampMs: startMs,
    });
  }
}

writeFileSync(
  "public/shorts/short-01/captions.json",
  JSON.stringify(captions, null, 2)
);
console.log(`Wrote ${captions.length} words to captions.json`);

// ──── Shot boundary computation ────────────────────────────────────────
// Map each shot to the word timestamps
const SHOT_LINES = [
  { id: 1, text: "600 million people have been betting on manga for 20 years" },
  { id: 2, text: "They just forgot to use money" },
  { id: 3, text: "Every week millions of fans predict which manga tops the charts" },
  { id: 4, text: "They argue who wins in a fight" },
  { id: 5, text: "Rank entire seasons" },  // Whisper hears "wrong" but we corrected
  { id: 6, text: "Call breakout" },
  { id: 7, text: "That's not fandom" },
  { id: 8, text: "That's a trading desk" },
  { id: 9, text: "Sony saw all that passion and wrote a check" },
  { id: 10, text: "1 175 billion" },
  { id: 11, text: "for Crunchyroll" },
  { id: 12, text: "40 of Sony Pictures profit now" },
  { id: 13, text: "from debate you had for free" },
  { id: 14, text: "Fandom com" },
  { id: 15, text: "780 million visits a month" },
  { id: 16, text: "40 million pages" },
  { id: 17, text: "written by volunteers who earn exactly" },
  { id: 18, text: "zero" },
  { id: 19, text: "I build financial infrastructure" },
  { id: 20, text: "and when I look at manga forums" },
  { id: 21, text: "I don't see fans arguing" },
  { id: 22, text: "I see 600 million analysts running predictions with no payout" },
  { id: 23, text: "That same generation already betting" },
  { id: 24, text: "1 in 3 Gen Z kids opened a sportsbook" },
  { id: 25, text: "Last year it was 1 in 4" },
  { id: 26, text: "The forum thread" },
  { id: 27, text: "is a trading floor" },
  { id: 28, text: "You've been trading for free" },
  { id: 29, text: "How many views will Naruto pull today" },
  { id: 30, text: "Who cracks the top 20 this season" },
  { id: 31, text: "And will JoJo fans finally" },
  { id: 32, text: "Actually they already swiped away" },
];

// Fuzzy word match: handles plurals, possessives, contractions
function fuzzyMatch(capWord, keyword) {
  if (capWord === keyword) return true;
  if (capWord.includes(keyword)) return true;
  if (keyword.includes(capWord) && capWord.length >= 3) return true;  // "season" matches "seasons"
  // Stem match (first 4+ chars)
  const stem = keyword.slice(0, Math.max(4, keyword.length - 2));
  if (capWord.startsWith(stem)) return true;
  return false;
}

// Find the first word timestamp for each shot using keyword matching
let captionIdx = 0;
const shotTimings = [];

for (const shot of SHOT_LINES) {
  if (!shot.text) {
    shotTimings.push({ id: shot.id, startMs: null, endMs: null });
    continue;
  }

  const clean = w => w.replace(/[.,!?'"%]/g, "");
  const keywords = shot.text.toLowerCase().split(" ").map(clean).filter(w => w.length > 1);
  const firstKeyword = keywords[0];
  const wordCount = shot.text.split(" ").length;  // actual word count including short words

  // Find matching word in captions starting from current position
  let found = false;
  for (let i = captionIdx; i < captions.length; i++) {
    const capWord = captions[i].text.toLowerCase().replace(/[.,!?'"%]/g, "");
    if (capWord === firstKeyword ||
        (firstKeyword === "600" && capWord === "600") ||
        (firstKeyword === "40" && (capWord === "40%" || capWord === "40")) ||
        (firstKeyword === "780" && capWord === "780") ||
        (firstKeyword === "fandom" && capWord === "fandom") ||
        (firstKeyword === "for" && capWord === "for" && i > 10) ||
        (firstKeyword === "from" && capWord === "from") ||
        (firstKeyword === "written" && capWord === "written") ||
        (firstKeyword === "is" && capWord === "is" && i > 50) ||
        // contractions handled by cleaning both sides
        (capWord.length >= 3 && capWord.includes(firstKeyword))) {

      // End index: count forward by wordCount (the actual number of words in the shot line)
      // But clamp to not go past the next significant pause (>400ms gap)
      let lastWordIdx = Math.min(i + wordCount - 1, captions.length - 1);

      // Try to find last keyword match in a reasonable range for better end timing
      const lastKw = keywords[keywords.length - 1];
      for (let j = i; j <= Math.min(i + wordCount + 3, captions.length - 1); j++) {
        const jWord = captions[j].text.toLowerCase().replace(/[.,!?'"%]/g, "");
        if (fuzzyMatch(jWord, lastKw)) {
          lastWordIdx = j;
          break;
        }
      }

      shotTimings.push({
        id: shot.id,
        startMs: captions[i].startMs,
        endMs: captions[lastWordIdx].endMs,
      });
      captionIdx = lastWordIdx + 1;
      found = true;
      break;
    }
  }
  if (!found) {
    console.warn(`⚠ Could not find shot ${shot.id}: "${shot.text}"`);
    shotTimings.push({ id: shot.id, startMs: null, endMs: null });
  }
}

// Compute shot durations (each shot lasts until the next shot starts, with some padding)
console.log("\n// ──── Shot durations (for shots.ts) ────");
console.log("// Format: id, durationSeconds, startMs, endMs\n");

for (let i = 0; i < shotTimings.length; i++) {
  const shot = shotTimings[i];
  const nextShot = shotTimings[i + 1];

  let duration;
  if (!shot.startMs && shot.startMs !== 0) {
    // Silent shot
    duration = 1.5;
  } else if (nextShot && nextShot.startMs !== null) {
    // Duration = gap from this shot's start to next shot's start + some padding
    const gapMs = nextShot.startMs - shot.startMs;
    duration = Math.round(gapMs / 10) / 100;  // round to 2 decimals
  } else if (nextShot && nextShot.startMs === null) {
    // Next shot is silent — this shot lasts until end of speech + padding
    const endOfSpeech = shot.endMs + 500; // 0.5s after last word
    duration = Math.round((endOfSpeech - shot.startMs) / 10) / 100;
  } else {
    // Last shot — end of speech + 0.5s tail
    const endOfSpeech = shot.endMs + 500;
    duration = Math.round((endOfSpeech - shot.startMs) / 10) / 100;
  }

  console.log(
    `  // Shot ${shot.id}: ${duration}s` +
    (shot.startMs !== null ? ` (${(shot.startMs / 1000).toFixed(2)}s → ${(shot.endMs / 1000).toFixed(2)}s)` : " (silent)")
  );
  console.log(`  { id: ${shot.id}, durationSeconds: ${duration} },`);
}

// Total duration
const lastSpoken = shotTimings.filter(s => s.endMs).pop();
const totalSpoken = lastSpoken ? lastSpoken.endMs / 1000 : 0;
console.log(`\n// Total spoken: ${totalSpoken.toFixed(2)}s`);
console.log(`// (32 shots, no silent ending — video ends at shot 32)`);
