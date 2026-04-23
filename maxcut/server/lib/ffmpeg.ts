import ffmpeg from "fluent-ffmpeg";
import { stat } from "node:fs/promises";

export interface ProbeResult {
  durationSec: number;
  fps: number;
  width?: number;
  height?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  audioSampleRate?: number;
  container?: string;
  bitrate?: number;
}

/** ffprobe the path. Throws a 404-class error if the file does not exist. */
export async function probe(path: string): Promise<ProbeResult> {
  try {
    await stat(path);
  } catch {
    const err: NodeJS.ErrnoException = new Error(`file not found: ${path}`);
    err.code = "ENOENT";
    throw err;
  }

  return new Promise<ProbeResult>((resolvePromise, rejectPromise) => {
    ffmpeg.ffprobe(path, (err, data) => {
      if (err) return rejectPromise(err);
      const streams = data.streams ?? [];
      const video = streams.find((s) => s.codec_type === "video");
      const audio = streams.find((s) => s.codec_type === "audio");

      let fps = 0;
      if (video?.r_frame_rate) {
        const [num, den] = video.r_frame_rate.split("/").map(Number);
        if (num && den) fps = num / den;
      }
      if (!fps && video?.avg_frame_rate) {
        const [num, den] = video.avg_frame_rate.split("/").map(Number);
        if (num && den) fps = num / den;
      }
      if (!fps) fps = 60;

      const durationSec =
        typeof data.format?.duration === "number"
          ? data.format.duration
          : Number(data.format?.duration ?? 0) || 0;

      const result: ProbeResult = {
        durationSec,
        fps,
        width: video?.width,
        height: video?.height,
        videoCodec: video?.codec_name,
        audioCodec: audio?.codec_name,
        audioChannels: audio?.channels,
        audioSampleRate: audio?.sample_rate ? Number(audio.sample_rate) : undefined,
        container: data.format?.format_name,
        bitrate: data.format?.bit_rate ? Number(data.format.bit_rate) : undefined,
      };
      resolvePromise(result);
    });
  });
}

/** Extract mono PCM WAV at the given sample rate. */
export async function extractWav(
  path: string,
  outPath: string,
  sampleRate: number,
): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    ffmpeg(path)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .audioCodec("pcm_s16le")
      .format("wav")
      .on("error", rejectPromise)
      .on("end", () => resolvePromise())
      .save(outPath);
  });
}

/**
 * Decode the file to mono s16le 48 kHz PCM and pipe the raw samples to `onSamples`.
 * No header — ffmpeg emits raw PCM because we asked for format=s16le.
 */
export function decodeMonoPcm(
  path: string,
  sampleRate: number,
  onChunk: (chunk: Buffer) => void,
): Promise<void> {
  return new Promise<void>((resolvePromise, rejectPromise) => {
    const proc = ffmpeg(path)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(sampleRate)
      .audioCodec("pcm_s16le")
      .format("s16le")
      .on("error", rejectPromise)
      .on("end", () => resolvePromise());

    const stream = proc.pipe();
    stream.on("data", onChunk);
    stream.on("error", rejectPromise);
  });
}

/**
 * Two-tier peaks: min/max per bucket. Low = 5 ms buckets (200 Hz), high = 1 ms (1 kHz).
 * Samples are s16le at 48 kHz — 240 samples/5 ms, 48 samples/1 ms.
 */
export async function generatePeaks(
  path: string,
  writeLow: (buf: Buffer) => Promise<void>,
  writeHigh: (buf: Buffer) => Promise<void>,
): Promise<{ lowBytes: number; highBytes: number }> {
  const SR = 48000;
  const LOW_BUCKET = (SR * 5) / 1000; // 240
  const HIGH_BUCKET = (SR * 1) / 1000; // 48

  let residue = Buffer.alloc(0);

  let lowMin = 0x7fff;
  let lowMax = -0x8000;
  let lowCount = 0;
  let lowBytesTotal = 0;

  let highMin = 0x7fff;
  let highMax = -0x8000;
  let highCount = 0;
  let highBytesTotal = 0;

  const flushLow = async () => {
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(lowMin, 0);
    buf.writeInt16LE(lowMax, 2);
    await writeLow(buf);
    lowBytesTotal += 4;
    lowMin = 0x7fff;
    lowMax = -0x8000;
    lowCount = 0;
  };

  const flushHigh = async () => {
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(highMin, 0);
    buf.writeInt16LE(highMax, 2);
    await writeHigh(buf);
    highBytesTotal += 4;
    highMin = 0x7fff;
    highMax = -0x8000;
    highCount = 0;
  };

  // Collect chunks synchronously, process at end so we can await I/O.
  const chunks: Buffer[] = [];
  await decodeMonoPcm(path, SR, (c) => {
    chunks.push(c);
  });

  for (const chunk of chunks) {
    const merged = Buffer.concat([residue, chunk]);
    const usable = merged.length - (merged.length % 2);
    residue = merged.subarray(usable);
    for (let i = 0; i < usable; i += 2) {
      const sample = merged.readInt16LE(i);
      if (sample < lowMin) lowMin = sample;
      if (sample > lowMax) lowMax = sample;
      lowCount++;
      if (sample < highMin) highMin = sample;
      if (sample > highMax) highMax = sample;
      highCount++;
      if (lowCount >= LOW_BUCKET) await flushLow();
      if (highCount >= HIGH_BUCKET) await flushHigh();
    }
  }
  if (lowCount > 0) await flushLow();
  if (highCount > 0) await flushHigh();

  return { lowBytes: lowBytesTotal, highBytes: highBytesTotal };
}

/** Horizontal sprite, 64 px tiles, 1 fps. WebP output. */
export async function generateSprite(path: string, outWebp: string): Promise<void> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    ffmpeg(path)
      .noAudio()
      .outputOptions(["-vf", "fps=1,scale=64:-1,tile=9999x1", "-frames:v", "1"])
      .output(outWebp)
      .on("error", rejectPromise)
      .on("end", () => resolvePromise())
      .run();
  });
}
