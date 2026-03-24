#!/usr/bin/env python3
"""Essentia-based music analysis — mood proxies, danceability, key, rhythm.

Runs under brew's python@3.9 where Essentia is installed.
Called by analyze_music.py as a subprocess, outputs JSON to stdout.

Usage:
  /opt/homebrew/opt/python@3.9/bin/python3.9 scripts/essentia_analysis.py <audio_file>
"""
import sys
import json
import numpy as np


def analyze_with_essentia(audio_path):
    import essentia
    from essentia.standard import (
        MonoLoader,
        RhythmExtractor2013,
        KeyExtractor,
        Danceability,
        DynamicComplexity,
        Energy,
        EnergyBandRatio,
        LoudnessEBUR128,
    )

    # Load audio at 44100 Hz (Essentia default)
    loader = MonoLoader(filename=audio_path, sampleRate=44100)
    audio = loader()

    result = {}

    # --- Rhythm ---
    rhythm = RhythmExtractor2013(method="multifeature")
    bpm, ticks, confidence, estimates, intervals = rhythm(audio)
    result["essentia_bpm"] = round(float(bpm), 1)
    result["essentia_bpm_confidence"] = round(float(confidence), 3)
    result["essentia_beat_count"] = len(ticks)
    # Keep first/last 5 ticks for verification, full list too large
    result["essentia_ticks_sample"] = [round(float(t), 3) for t in ticks[:5]] + ["..."] + [round(float(t), 3) for t in ticks[-5:]] if len(ticks) > 10 else [round(float(t), 3) for t in ticks]

    # --- Key ---
    key_extractor = KeyExtractor()
    key, scale, key_strength = key_extractor(audio)
    result["essentia_key"] = key
    result["essentia_scale"] = scale  # "major" or "minor"
    result["essentia_key_strength"] = round(float(key_strength), 3)
    result["essentia_key_full"] = f"{key} {scale}"

    # --- Danceability ---
    dance = Danceability(sampleRate=44100)
    danceability, _ = dance(audio)
    result["danceability"] = round(float(danceability), 3)
    # Normalize: typical range 0-3, map to 0-1
    result["danceability_normalized"] = round(min(1.0, float(danceability) / 3.0), 3)

    # --- Dynamic Complexity ---
    dyn = DynamicComplexity(sampleRate=44100)
    complexity, loudness = dyn(audio)
    result["dynamic_complexity"] = round(float(complexity), 3)
    result["average_loudness_db"] = round(float(loudness), 1)

    # --- Energy distribution across frequency bands ---
    # Compute energy in different bands to determine "warmth" vs "brightness"
    from essentia.standard import Spectrum, Windowing, FrameGenerator
    frame_size = 2048
    hop_size = 1024

    low_energy = []
    mid_energy = []
    high_energy = []

    windowing = Windowing(type="hann", size=frame_size)
    spectrum_algo = Spectrum(size=frame_size)

    for frame in FrameGenerator(audio, frameSize=frame_size, hopSize=hop_size):
        windowed = windowing(frame)
        spec = spectrum_algo(windowed)
        n_bins = len(spec)
        sr = 44100
        freq_per_bin = sr / 2 / n_bins

        # Low: 20-300 Hz, Mid: 300-4000 Hz, High: 4000-20000 Hz
        low_end = int(300 / freq_per_bin)
        mid_end = int(4000 / freq_per_bin)

        low_energy.append(float(np.mean(spec[:low_end]) if low_end > 0 else 0))
        mid_energy.append(float(np.mean(spec[low_end:mid_end]) if mid_end > low_end else 0))
        high_energy.append(float(np.mean(spec[mid_end:]) if mid_end < n_bins else 0))

    total_energy = np.mean(low_energy) + np.mean(mid_energy) + np.mean(high_energy) + 1e-10
    result["energy_distribution"] = {
        "low_pct": round(float(np.mean(low_energy) / total_energy * 100), 1),
        "mid_pct": round(float(np.mean(mid_energy) / total_energy * 100), 1),
        "high_pct": round(float(np.mean(high_energy) / total_energy * 100), 1),
    }

    # --- Mood proxies (heuristic from audio features) ---
    # Without TF models, we infer mood from measurable features
    mood_tags = []

    # High danceability + high BPM = energetic
    if danceability > 1.5 and bpm > 120:
        mood_tags.append("energetic")
    elif danceability > 1.0:
        mood_tags.append("groovy")

    # Low BPM + minor key = melancholic/dark
    if bpm < 90 and scale == "minor":
        mood_tags.append("melancholic")
    elif scale == "minor":
        mood_tags.append("dark")
    elif scale == "major" and bpm > 100:
        mood_tags.append("happy")
    elif scale == "major":
        mood_tags.append("warm")

    # High dynamic complexity = dramatic
    if complexity > 5:
        mood_tags.append("dramatic")
    elif complexity < 2:
        mood_tags.append("steady")

    # Energy distribution clues
    low_pct = result["energy_distribution"]["low_pct"]
    high_pct = result["energy_distribution"]["high_pct"]
    if low_pct > 50:
        mood_tags.append("bass-heavy")
    if high_pct > 35:
        mood_tags.append("bright")
    elif high_pct < 15:
        mood_tags.append("muted")

    # BPM-based tempo feel
    if bpm < 70:
        mood_tags.append("slow")
    elif bpm < 100:
        mood_tags.append("moderate")
    elif bpm < 130:
        mood_tags.append("upbeat")
    else:
        mood_tags.append("fast")

    result["mood_tags"] = mood_tags

    # --- Visual suggestions for AI ---
    visual_hints = {}
    if "energetic" in mood_tags or "fast" in mood_tags:
        visual_hints["pace"] = "fast cuts, quick transitions"
        visual_hints["colors"] = "vivid, saturated, high contrast"
        visual_hints["motion"] = "rapid, dynamic, particles"
    elif "melancholic" in mood_tags or "dark" in mood_tags:
        visual_hints["pace"] = "slow, lingering shots"
        visual_hints["colors"] = "desaturated, cool tones, shadows"
        visual_hints["motion"] = "gentle, floating, slow drift"
    elif "happy" in mood_tags or "warm" in mood_tags:
        visual_hints["pace"] = "moderate, flowing"
        visual_hints["colors"] = "warm tones, golden, soft"
        visual_hints["motion"] = "smooth, bouncy, organic"
    else:
        visual_hints["pace"] = "match energy curve"
        visual_hints["colors"] = "neutral, adapt per segment"
        visual_hints["motion"] = "varied, follow dynamics"

    if "bass-heavy" in mood_tags:
        visual_hints["effects"] = "screen shake on bass hits, scale pulses"
    if "bright" in mood_tags:
        visual_hints["effects"] = visual_hints.get("effects", "") + ", lens flares, glow"

    result["visual_suggestions"] = visual_hints

    return result


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: essentia_analysis.py <audio_file>"}))
        sys.exit(1)

    try:
        result = analyze_with_essentia(sys.argv[1])
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
