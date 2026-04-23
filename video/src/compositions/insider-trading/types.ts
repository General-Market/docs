export interface ClipEntry {
  clip_id: number;
  source_url: string;
  source_title: string;
  clip_file: string;
  phrase_start: number;
  phrase_end: number;
  insider_start_in_clip: number;
  trading_end_in_clip: number;
  context: string;
  duration: number;
}

export interface ClipManifest {
  clips: ClipEntry[];
  total: number;
  fps: number;
}
