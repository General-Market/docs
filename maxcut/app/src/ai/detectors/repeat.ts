import type { CutSuggestion, Word } from "@/project/schema";

type Suggestion = Omit<CutSuggestion, "id" | "status" | "assetId">;

// v2. Real repetition detection needs phonetic distance, not token equality.
export function detectRepeats(_words: Word[]): Suggestion[] {
  return [];
}
