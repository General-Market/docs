/**
 * Transcribe voice audio using @remotion/install-whisper-cpp.
 *
 * Usage:
 *   npx tsx scripts/transcribe.ts <voice.wav> [output.json]
 *
 * Outputs word-level timestamps in the Caption format expected by the pipeline.
 */
import { installWhisperCpp, transcribe, downloadWhisperModel } from "@remotion/install-whisper-cpp";
import { existsSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";

const WHISPER_DIR = resolve(__dirname, "../.whisper");
const MODEL = "medium.en";

interface OutputCaption {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  timestampMs: number;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/transcribe.ts <voice.wav> [output.json]");
    process.exit(1);
  }
  const outputPath = process.argv[3] ?? inputPath.replace(/\.[^.]+$/, "-captions.json");

  // Ensure whisper directory
  if (!existsSync(WHISPER_DIR)) {
    mkdirSync(WHISPER_DIR, { recursive: true });
  }

  // Install whisper.cpp
  console.log("Installing whisper.cpp...");
  const whisperPath = await installWhisperCpp({ to: WHISPER_DIR, version: "1.5.5" });

  // Download model
  console.log(`Downloading ${MODEL} model...`);
  await downloadWhisperModel({ model: MODEL, folder: WHISPER_DIR });

  // Transcribe
  console.log("Transcribing...");
  const { transcription } = await transcribe({
    inputPath: resolve(inputPath),
    whisperPath: whisperPath.mainExePath ?? whisperPath,
    model: MODEL,
    modelFolder: WHISPER_DIR,
    tokenLevelTimestamps: true,
  });

  // Convert to our Caption format (word-level)
  const captions: OutputCaption[] = [];
  for (const segment of transcription) {
    if (segment.tokens) {
      for (const token of segment.tokens) {
        const text = token.text.trim();
        if (!text || text.startsWith("[")) continue;
        captions.push({
          text,
          startMs: token.offsets.from,
          endMs: token.offsets.to,
          confidence: token.p ?? 0.95,
          timestampMs: token.offsets.from,
        });
      }
    } else {
      // Fallback: segment-level
      const text = segment.text.trim();
      if (!text) continue;
      captions.push({
        text,
        startMs: segment.offsets.from,
        endMs: segment.offsets.to,
        confidence: 0.9,
        timestampMs: segment.offsets.from,
      });
    }
  }

  writeFileSync(resolve(outputPath), JSON.stringify(captions, null, 2));
  console.log(`Wrote ${captions.length} words to ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
