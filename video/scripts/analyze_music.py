#!/usr/bin/env python3
"""Analyze music tracks so AI knows what happens when — no human listening needed.

Outputs a JSON with:
  - BPM, key, time signature
  - Beat timestamps (every beat)
  - Onset timestamps (every hit/note)
  - Section boundaries (intro, verse, chorus, bridge, outro)
  - Energy curve over time (for matching visuals to intensity)
  - Spectral features (brightness, warmth) per section
  - Recommended sync points (drops, transitions, peaks)

Usage:
  python3 analyze_music.py <audio_file> [output.json]
  python3 analyze_music.py music.mp3
  python3 analyze_music.py music.wav analysis.json
"""
import sys
import os
import json
import subprocess
import numpy as np
import librosa

# Essentia runs under brew's python@3.9
ESSENTIA_PYTHON = "/opt/homebrew/opt/python@3.9/bin/python3.9"
ESSENTIA_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "essentia_analysis.py")


def analyze(audio_path):
    print(f"Loading: {audio_path}")
    y, sr = librosa.load(audio_path, sr=22050)
    duration = librosa.get_duration(y=y, sr=sr)
    print(f"Duration: {duration:.1f}s | Sample rate: {sr}")

    result = {
        "file": audio_path,
        "duration_seconds": round(duration, 2),
        "sample_rate": sr,
    }

    # --- Tempo & Beats ---
    print("Detecting tempo and beats...")
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    result["bpm"] = round(float(np.mean(tempo)), 1)
    result["beat_count"] = len(beat_times)
    result["beat_timestamps"] = [round(t, 3) for t in beat_times]

    # --- Onsets (every note/hit) ---
    print("Detecting onsets...")
    onset_frames = librosa.onset.onset_detect(y=y, sr=sr)
    onset_times = librosa.frames_to_time(onset_frames, sr=sr).tolist()
    result["onset_count"] = len(onset_times)
    result["onset_timestamps"] = [round(t, 3) for t in onset_times]

    # --- Energy curve (RMS) over time ---
    print("Computing energy curve...")
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(range(len(rms)), sr=sr, hop_length=hop_length)

    # Sample energy every ~1 second for compact output
    step = max(1, int(sr / hop_length))
    energy_curve = []
    for i in range(0, len(rms), step):
        energy_curve.append({
            "time": round(float(rms_times[i]), 1),
            "energy": round(float(rms[i]), 4),
        })
    result["energy_curve"] = energy_curve

    # Normalize energy for peak detection
    rms_norm = rms / (rms.max() + 1e-8)

    # --- Energy peaks (drops / climaxes) ---
    print("Finding energy peaks...")
    peak_threshold = 0.75
    peaks = []
    in_peak = False
    for i, val in enumerate(rms_norm):
        t = float(rms_times[i])
        if val >= peak_threshold and not in_peak:
            in_peak = True
            peaks.append({"time": round(t, 2), "energy": round(float(val), 3), "type": "peak_start"})
        elif val < peak_threshold * 0.6 and in_peak:
            in_peak = False
            peaks.append({"time": round(t, 2), "energy": round(float(val), 3), "type": "peak_end"})
    result["energy_peaks"] = peaks

    # --- Spectral features ---
    print("Computing spectral features...")
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]

    # Average brightness/warmth per ~5-second window
    window = int(5 * sr / hop_length)
    spectral_sections = []
    for i in range(0, len(spectral_centroid), window):
        chunk_centroid = spectral_centroid[i:i + window]
        chunk_bw = spectral_bandwidth[i:i + window]
        t = float(rms_times[min(i, len(rms_times) - 1)])
        spectral_sections.append({
            "time": round(t, 1),
            "brightness": round(float(np.mean(chunk_centroid)), 1),
            "bandwidth": round(float(np.mean(chunk_bw)), 1),
        })
    result["spectral_profile"] = spectral_sections

    # --- Chroma / Key estimation ---
    print("Estimating key...")
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_index = int(np.argmax(np.mean(chroma, axis=1)))
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    result["estimated_key"] = key_names[key_index]

    # --- Segment boundaries (structural changes) ---
    print("Detecting segment boundaries...")
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    bound_frames = librosa.segment.agglomerative(mfcc, k=None)
    # Filter to reasonable number of segments (4-12)
    if len(bound_frames) > 12:
        # Keep only the most significant boundaries
        bound_times_all = librosa.frames_to_time(bound_frames, sr=sr)
        # Resegment with fewer clusters
        n_segments = min(8, max(4, int(duration / 30)))
        bound_frames = librosa.segment.agglomerative(mfcc, k=n_segments)

    bound_times = librosa.frames_to_time(bound_frames, sr=sr).tolist()
    segments = []
    all_bounds = [0.0] + bound_times + [duration]
    for i in range(len(all_bounds) - 1):
        start = all_bounds[i]
        end = all_bounds[i + 1]
        # Compute average energy for this segment
        start_frame = int(start * sr / hop_length)
        end_frame = int(end * sr / hop_length)
        seg_energy = float(np.mean(rms[start_frame:end_frame])) if end_frame > start_frame else 0
        seg_centroid = float(np.mean(spectral_centroid[start_frame:end_frame])) if end_frame > start_frame else 0

        # Heuristic labels based on position and energy
        position = (start + end) / 2 / duration
        energy_level = "high" if seg_energy > np.mean(rms) * 1.2 else ("low" if seg_energy < np.mean(rms) * 0.7 else "medium")

        if position < 0.1:
            label = "intro"
        elif position > 0.9:
            label = "outro"
        elif energy_level == "high":
            label = "chorus/drop"
        elif energy_level == "low":
            label = "bridge/break"
        else:
            label = "verse"

        segments.append({
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": round(end - start, 2),
            "label": label,
            "energy_level": energy_level,
            "avg_energy": round(seg_energy, 4),
            "brightness": round(seg_centroid, 1),
        })
    result["segments"] = segments

    # --- Recommended sync points for video ---
    print("Computing sync points...")
    sync_points = []

    # Add beat-aligned sync points at segment boundaries
    for seg in segments:
        closest_beat = min(beat_times, key=lambda b: abs(b - seg["start"]), default=seg["start"])
        sync_points.append({
            "time": round(closest_beat, 3),
            "reason": f"segment_change ({seg['label']})",
            "energy": seg["energy_level"],
        })

    # Add energy peaks as sync points
    for peak in peaks:
        if peak["type"] == "peak_start":
            sync_points.append({
                "time": peak["time"],
                "reason": "energy_peak",
                "energy": "high",
            })

    # Sort and deduplicate (merge points within 1s of each other)
    sync_points.sort(key=lambda x: x["time"])
    merged = []
    for sp in sync_points:
        if not merged or sp["time"] - merged[-1]["time"] > 1.0:
            merged.append(sp)
    result["sync_points"] = merged

    # --- Essentia analysis (mood, danceability, key verification) ---
    essentia_data = None
    if os.path.isfile(ESSENTIA_PYTHON) and os.path.isfile(ESSENTIA_SCRIPT):
        print("Running Essentia analysis (mood, danceability, key)...")
        try:
            proc = subprocess.run(
                [ESSENTIA_PYTHON, ESSENTIA_SCRIPT, audio_path],
                capture_output=True, text=True, timeout=120,
            )
            if proc.returncode == 0:
                essentia_data = json.loads(proc.stdout)
                if "error" not in essentia_data:
                    result["essentia"] = essentia_data
                    print(f"  Essentia key: {essentia_data.get('essentia_key_full', '?')}")
                    print(f"  Danceability: {essentia_data.get('danceability_normalized', '?')}")
                    print(f"  Mood: {', '.join(essentia_data.get('mood_tags', []))}")
                else:
                    print(f"  Essentia warning: {essentia_data['error']}")
            else:
                print(f"  Essentia skipped (exit code {proc.returncode})")
        except (subprocess.TimeoutExpired, Exception) as e:
            print(f"  Essentia skipped: {e}")
    else:
        print("Essentia not available (needs brew python@3.9) — skipping mood/danceability")

    # --- Summary for AI ---
    summary = {
        "bpm": result["bpm"],
        "key": result["estimated_key"],
        "duration": f"{int(duration // 60)}:{int(duration % 60):02d}",
        "total_beats": result["beat_count"],
        "total_segments": len(segments),
        "total_sync_points": len(merged),
        "energy_profile": "builds_up" if segments[-2]["avg_energy"] > segments[1]["avg_energy"] else "steady" if abs(segments[-2]["avg_energy"] - segments[1]["avg_energy"]) < 0.01 else "winds_down",
        "avg_brightness": round(float(np.mean(spectral_centroid)), 1),
        "recommended_scene_count": len(merged),
    }

    # Enrich summary with Essentia data if available
    if essentia_data and "error" not in essentia_data:
        summary["key_with_scale"] = essentia_data.get("essentia_key_full", "unknown")
        summary["danceability"] = essentia_data.get("danceability_normalized", None)
        summary["mood_tags"] = essentia_data.get("mood_tags", [])
        summary["dynamic_complexity"] = essentia_data.get("dynamic_complexity", None)
        summary["visual_suggestions"] = essentia_data.get("visual_suggestions", {})

    result["ai_summary"] = summary

    return result


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 analyze_music.py <audio_file> [output.json]")
        print("\nOutputs JSON with: BPM, beats, onsets, energy curve, segments,")
        print("spectral features, key, sync points — everything AI needs to")
        print("sync video to music without a human listening.")
        sys.exit(1)

    audio_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else audio_file.rsplit(".", 1)[0] + "_analysis.json"

    result = analyze(audio_file)

    with open(output_file, "w") as f:
        json.dump(result, f, indent=2)

    print(f"\nSaved: {output_file}")
    print(f"\n=== AI Summary ===")
    for k, v in result["ai_summary"].items():
        print(f"  {k}: {v}")
    print(f"  sync_points: {[sp['time'] for sp in result['sync_points'][:10]]}...")


if __name__ == "__main__":
    main()
