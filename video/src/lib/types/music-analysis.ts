export interface MusicAnalysis {
  bpm: number;
  beat_timestamps: number[]; // seconds
  energy_peaks: number[]; // seconds
  sync_points: number[]; // seconds
  energy_curve: Array<{ time: number; energy: number }>; // 0-1 energy
  segments: Array<{
    start: number;
    end: number;
    label: string; // "intro" | "verse" | "chorus" | "drop" | "bridge" | "outro"
  }>;
  mood_tags: string[];
  key: string;
  duration: number; // seconds
}
