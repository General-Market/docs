import type { CutSuggestion, Transcript } from "@/project/schema";
import { genId } from "@/project/store";
import { detectSilences } from "./silence";
import { detectFillers } from "./filler";
import { detectRepeats } from "./repeat";

export { detectSilences } from "./silence";
export { detectFillers, DEFAULT_FILLERS } from "./filler";
export { detectRepeats } from "./repeat";

export function runDetectors(
  transcript: Transcript,
  assetId: string,
  fps: number,
): CutSuggestion[] {
  const words = transcript.words;
  const raw = [
    ...detectSilences(words, { fps }),
    ...detectFillers(words, undefined, { fps }),
    ...detectRepeats(words),
  ];
  return raw.map((s) => ({
    ...s,
    id: genId(),
    assetId,
    status: "pending" as const,
  }));
}
