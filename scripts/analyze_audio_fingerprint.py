#!/usr/bin/env python3
"""
Audio fingerprinting: extract chromagram signatures, tempo, key, and
spectral fingerprints to identify common SFX patterns, music styles,
and audio trends across PH launch videos.
"""

import json, glob, os, re, sys, time
import numpy as np
import subprocess
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed

VIDEO_DIRS = ["ph_videos_notranscript", "yc_videos_notranscript"]
OUTPUT_DIR = "video_mega_analyses"  # Add to existing mega files


def analyze_audio_deep(video_path):
    """Deep audio: tempo, key, chroma, MFCC clusters, SFX patterns."""
    try:
        import librosa
        import warnings
        warnings.filterwarnings('ignore')

        tmp_wav = video_path + ".tmp_fp.wav"
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, "-ac", "1", "-ar", "22050",
            "-vn", "-f", "wav", tmp_wav
        ], capture_output=True, timeout=30)

        if not os.path.exists(tmp_wav) or os.path.getsize(tmp_wav) < 1000:
            if os.path.exists(tmp_wav): os.remove(tmp_wav)
            return None

        y, sr = librosa.load(tmp_wav, sr=22050, duration=300)
        os.remove(tmp_wav)

        if len(y) < sr:
            return None

        duration = len(y) / sr

        # === TEMPO / BPM ===
        tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
        if isinstance(tempo, np.ndarray):
            tempo = float(tempo[0]) if len(tempo) > 0 else 0
        else:
            tempo = float(tempo)

        # === KEY DETECTION ===
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_avg = np.mean(chroma, axis=1)
        key_idx = int(np.argmax(chroma_avg))
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        detected_key = key_names[key_idx]
        key_confidence = float(chroma_avg[key_idx] / (np.sum(chroma_avg) + 1e-10))

        # === MFCC — Audio Texture Fingerprint ===
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1).tolist()
        mfcc_std = np.std(mfccs, axis=1).tolist()

        # === SPECTRAL CONTRAST (brightness/darkness of audio) ===
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        avg_contrast = float(np.mean(contrast))

        # === TONNETZ (harmonic content) ===
        tonnetz = librosa.feature.tonnetz(y=librosa.effects.harmonic(y), sr=sr)
        avg_tonnetz = np.mean(tonnetz, axis=1).tolist()

        # === SFX DETECTION — Classify audio segments ===
        # Split into 1-second windows and classify each
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        rms_db = librosa.amplitude_to_db(rms + 1e-10)
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

        # Segment-level analysis (3-second windows)
        seg_len = int(3 * sr)
        n_segs = max(1, len(y) // seg_len)
        segment_types = []

        for i in range(n_segs):
            seg = y[i*seg_len:(i+1)*seg_len]
            if len(seg) < sr // 2:
                continue

            seg_rms = float(np.sqrt(np.mean(seg**2)))
            seg_rms_db = 20 * np.log10(seg_rms + 1e-10)
            seg_zcr = float(np.mean(librosa.feature.zero_crossing_rate(seg)))
            seg_centroid = float(np.mean(librosa.feature.spectral_centroid(y=seg, sr=sr)))
            seg_bandwidth = float(np.mean(librosa.feature.spectral_bandwidth(y=seg, sr=sr)))

            # Classify segment
            if seg_rms_db < -40:
                seg_type = 'silence'
            elif 200 < seg_centroid < 4000 and seg_zcr < 0.12:
                seg_type = 'speech'
            elif seg_bandwidth > 4000 and seg_centroid > 3000:
                seg_type = 'music_bright'
            elif seg_bandwidth > 2500 and seg_centroid < 3000:
                seg_type = 'music_warm'
            elif seg_rms_db > -15 and seg_zcr > 0.15:
                seg_type = 'sfx_sharp'  # whoosh, click, ding
            elif seg_rms_db > -20 and seg_bandwidth < 2000:
                seg_type = 'sfx_low'  # bass hit, thud
            elif seg_zcr > 0.2:
                seg_type = 'noise'
            else:
                seg_type = 'ambient'

            segment_types.append({
                'timestamp': round(i * 3, 1),
                'type': seg_type,
                'rms_db': round(seg_rms_db, 1),
                'centroid': round(seg_centroid, 0),
                'bandwidth': round(seg_bandwidth, 0),
            })

        # Segment type distribution
        type_counts = Counter(s['type'] for s in segment_types)
        total_segs = max(len(segment_types), 1)
        type_dist = {t: round(c / total_segs, 3) for t, c in type_counts.items()}

        # === AUDIO STRUCTURE ===
        # Does it start with music?
        starts_with_music = segment_types[0]['type'].startswith('music') if segment_types else False
        # Does it end with music?
        ends_with_music = segment_types[-1]['type'].startswith('music') if segment_types else False
        # Are there distinct intro/outro music sections?
        first_3_types = [s['type'] for s in segment_types[:3]] if len(segment_types) >= 3 else []
        last_3_types = [s['type'] for s in segment_types[-3:]] if len(segment_types) >= 3 else []
        has_music_intro = any(t.startswith('music') for t in first_3_types)
        has_music_outro = any(t.startswith('music') for t in last_3_types)

        # Music-to-speech ratio
        music_segs = sum(1 for s in segment_types if s['type'].startswith('music'))
        speech_segs = sum(1 for s in segment_types if s['type'] == 'speech')
        sfx_segs = sum(1 for s in segment_types if s['type'].startswith('sfx'))

        # === TRANSITION SOUNDS ===
        # Detect sharp audio transients that might be SFX at scene cuts
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time')
        # Strong onsets = potential SFX
        strong_onset_times = []
        onset_strength_values = librosa.onset.onset_strength(y=y, sr=sr)
        onset_threshold = np.mean(onset_strength_values) * 2.5
        for onset_time in onsets:
            onset_frame = librosa.time_to_frames(onset_time, sr=sr)
            if onset_frame < len(onset_strength_values) and onset_strength_values[onset_frame] > onset_threshold:
                strong_onset_times.append(round(float(onset_time), 2))

        # === ENERGY ENVELOPE SHAPE ===
        # Classify the overall energy shape
        rms_smoothed = np.convolve(rms, np.ones(20)/20, mode='valid')
        if len(rms_smoothed) >= 4:
            q = len(rms_smoothed) // 4
            e1 = float(np.mean(rms_smoothed[:q]))
            e2 = float(np.mean(rms_smoothed[q:2*q]))
            e3 = float(np.mean(rms_smoothed[2*q:3*q]))
            e4 = float(np.mean(rms_smoothed[3*q:]))

            if e1 > e4 * 1.3:
                energy_shape = 'front_heavy'
            elif e4 > e1 * 1.3:
                energy_shape = 'back_heavy'
            elif e2 > e1 * 1.2 and e2 > e4 * 1.2:
                energy_shape = 'peak_middle'
            elif e1 > e2 and e4 > e3:
                energy_shape = 'valley'
            else:
                energy_shape = 'flat'
        else:
            energy_shape = 'flat'

        return {
            'tempo_bpm': round(tempo, 1),
            'detected_key': detected_key,
            'key_confidence': round(key_confidence, 3),
            'mfcc_mean': [round(x, 3) for x in mfcc_mean],
            'mfcc_std': [round(x, 3) for x in mfcc_std],
            'avg_spectral_contrast': round(avg_contrast, 2),
            'avg_tonnetz': [round(x, 4) for x in avg_tonnetz],

            'segment_types': segment_types,
            'segment_distribution': type_dist,
            'speech_pct': round(speech_segs / total_segs, 3),
            'music_pct': round(music_segs / total_segs, 3),
            'sfx_pct': round(sfx_segs / total_segs, 3),
            'silence_pct': round(type_dist.get('silence', 0), 3),

            'starts_with_music': starts_with_music,
            'ends_with_music': ends_with_music,
            'has_music_intro': has_music_intro,
            'has_music_outro': has_music_outro,
            'energy_shape': energy_shape,

            'strong_sfx_count': len(strong_onset_times),
            'strong_sfx_timestamps': strong_onset_times[:20],

            'n_segments': total_segs,
        }

    except Exception as e:
        return {'error': str(e)[:100]}


def process_video(video_path):
    """Add deep audio to existing mega analysis."""
    vid = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(OUTPUT_DIR, f"{vid}.json")

    # Check if already has deep audio
    if os.path.exists(out_path):
        try:
            existing = json.load(open(out_path))
            if existing.get('audio_deep'):
                return vid, None  # Already done
        except:
            pass

    try:
        result = analyze_audio_deep(video_path)
        if result is None:
            return vid, 'no_audio'

        # Merge into existing
        if os.path.exists(out_path):
            existing = json.load(open(out_path))
        else:
            existing = {'video_id': vid, 'status': 'ok'}

        existing['audio_deep'] = result

        with open(out_path, 'w') as f:
            json.dump(existing, f, indent=2, default=lambda x:
                      int(x) if isinstance(x, (np.integer,)) else
                      float(x) if isinstance(x, (np.floating,)) else
                      bool(x) if isinstance(x, (np.bool_,)) else
                      x.tolist() if isinstance(x, np.ndarray) else str(x))

        return vid, 'ok'

    except Exception as e:
        return vid, f'error: {str(e)[:60]}'


def main():
    videos = []
    for vdir in VIDEO_DIRS:
        videos.extend(sorted(glob.glob(os.path.join(vdir, '*.mp4'))))
    videos = [v for v in videos if os.path.getsize(v) > 1000]

    # Filter already done
    remaining = []
    for v in videos:
        vid = os.path.splitext(os.path.basename(v))[0]
        out_path = os.path.join(OUTPUT_DIR, f'{vid}.json')
        if os.path.exists(out_path):
            try:
                existing = json.load(open(out_path))
                if existing.get('audio_deep'):
                    continue
            except:
                pass
        remaining.append(v)

    print(f"Total: {len(videos)}, need deep audio: {len(remaining)}")

    if not remaining:
        print("All done!")
        return

    ok = fail = 0
    t0 = time.time()
    workers = min(4, os.cpu_count() or 2)

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_video, v): v for v in remaining}
        for future in as_completed(futures):
            try:
                vid_id, status = future.result()
                if status == 'ok': ok += 1
                elif status is not None and status != 'no_audio': fail += 1
                done = ok + fail
                if done % 20 == 0:
                    elapsed = time.time() - t0
                    rate = done / elapsed * 60 if elapsed > 0 else 0
                    eta = (len(remaining) - done) / rate if rate > 0 else 0
                    print(f"  [{done}/{len(remaining)}] ok={ok} fail={fail} — {rate:.1f}/min ETA {eta:.0f}min")
            except Exception as e:
                fail += 1

    print(f"\nDone! ok={ok} fail={fail} in {(time.time()-t0)/60:.1f}min")


if __name__ == '__main__':
    main()
