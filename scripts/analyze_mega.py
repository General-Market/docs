#!/usr/bin/env python3
"""
Mega analysis — 104 new dimensions per video.
Audio, motion, color design, text layout, UI detection, face depth, branding, metadata.
Resumable. Multiprocessed.
"""

import cv2
import json
import os
import re
import sys
import glob
import time
import subprocess
import numpy as np
from collections import Counter, defaultdict
from concurrent.futures import ProcessPoolExecutor, as_completed

VIDEO_DIRS = ["yc_videos_notranscript", "ph_videos_notranscript"]
OUTPUT_DIR = "video_mega_analyses"
FRAME_INTERVAL_SEC = 3.0


def extract_audio_features(video_path):
    """Audio analysis: speech, music, silence, energy, quality."""
    try:
        import librosa
        import warnings
        warnings.filterwarnings('ignore')

        # Extract audio to temporary wav
        tmp_wav = video_path + ".tmp.wav"
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path, "-ac", "1", "-ar", "22050",
            "-vn", "-f", "wav", tmp_wav
        ], capture_output=True, timeout=30)

        if not os.path.exists(tmp_wav) or os.path.getsize(tmp_wav) < 1000:
            if os.path.exists(tmp_wav): os.remove(tmp_wav)
            return {'has_audio': False}

        y, sr = librosa.load(tmp_wav, sr=22050, duration=300)
        os.remove(tmp_wav)

        if len(y) < sr:  # Less than 1 second
            return {'has_audio': False}

        duration = len(y) / sr

        # RMS energy
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        rms_db = librosa.amplitude_to_db(rms + 1e-10)

        # Silence detection (< -40dB)
        silence_threshold = -40
        silence_frames = np.sum(rms_db < silence_threshold)
        silence_pct = silence_frames / len(rms_db) if len(rms_db) > 0 else 0

        # Energy curve: first quarter vs last quarter
        q = len(rms) // 4
        if q > 0:
            first_q_energy = float(np.mean(rms[:q]))
            last_q_energy = float(np.mean(rms[-q:]))
            energy_trend = last_q_energy - first_q_energy
        else:
            first_q_energy = last_q_energy = float(np.mean(rms))
            energy_trend = 0

        # Peak moment
        peak_idx = np.argmax(rms)
        peak_timestamp = float(peak_idx * 512 / sr)

        # Dynamic range
        dynamic_range = float(np.max(rms_db) - np.percentile(rms_db, 10))

        # Spectral features for speech vs music detection
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        zero_crossings = librosa.feature.zero_crossing_rate(y)[0]

        # Speech detection heuristic: speech has centroid 300-3000Hz, moderate ZCR
        avg_centroid = float(np.mean(spectral_centroid))
        avg_bandwidth = float(np.mean(spectral_bandwidth))
        avg_zcr = float(np.mean(zero_crossings))

        # Rough speech/music classification
        has_speech = 300 < avg_centroid < 4000 and avg_zcr < 0.15
        has_music = avg_bandwidth > 3000 or avg_centroid > 4000

        # Onset density (beats/changes per second)
        onsets = librosa.onset.onset_detect(y=y, sr=sr, units='time')
        onset_density = len(onsets) / duration if duration > 0 else 0

        # Audio intro silence
        intro_silence = 0.0
        for i, val in enumerate(rms_db):
            if val > silence_threshold:
                intro_silence = float(i * 512 / sr)
                break

        # Audio outro silence
        outro_silence = 0.0
        for i, val in enumerate(reversed(rms_db)):
            if val > silence_threshold:
                outro_silence = float(i * 512 / sr)
                break

        # Sound effects: transient detection (non-speech, non-music bursts)
        # High onset strength + short duration = sound effect
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        strong_onsets = np.sum(onset_env > np.mean(onset_env) * 3)
        has_sound_effects = int(strong_onsets) > 5

        return {
            'has_audio': True,
            'audio_duration': round(duration, 1),
            'has_speech': has_speech,
            'has_music': has_music,
            'has_sound_effects': has_sound_effects,
            'silence_pct': round(silence_pct, 3),
            'energy_trend': round(energy_trend, 6),
            'peak_timestamp_sec': round(peak_timestamp, 1),
            'peak_position_pct': round(peak_timestamp / duration, 2) if duration > 0 else 0,
            'dynamic_range_db': round(dynamic_range, 1),
            'onset_density': round(onset_density, 2),
            'intro_silence_sec': round(intro_silence, 1),
            'outro_silence_sec': round(outro_silence, 1),
            'avg_spectral_centroid': round(avg_centroid, 0),
            'avg_spectral_bandwidth': round(avg_bandwidth, 0),
            'avg_zcr': round(avg_zcr, 4),
        }

    except Exception as e:
        return {'has_audio': False, 'audio_error': str(e)[:80]}


def analyze_visual_deep(video_path):
    """Deep visual analysis: UI detection, color design, text layout, composition."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return None

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if total_frames < 2 or duration < 0.5:
        cap.release()
        return None

    frame_skip = max(1, int(fps * FRAME_INTERVAL_SEC))

    # Accumulators
    scroll_directions = []
    prev_gray = None
    prev_flow = None

    color_palettes = []
    gradient_frames = 0
    high_contrast_frames = 0

    navbar_frames = 0
    sidebar_frames = 0
    modal_frames = 0
    table_frames = 0
    chat_frames = 0
    code_frames = 0
    terminal_frames = 0
    mobile_frames = 0
    desktop_chrome_frames = 0

    text_positions_y = []  # normalized y positions of text
    text_areas = []  # % of frame covered by text
    text_colors = []

    symmetry_scores = []
    thirds_scores = []
    content_aspect_ratios = []

    scene_histograms = []
    scene_timestamps = []

    total_analyzed = 0
    frame_idx = 0

    while frame_idx < total_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = frame.shape[:2]

        # === SCROLL DETECTION (#16-18) ===
        if prev_gray is not None and h > 100:
            # Compute optical flow on center strip
            center_prev = prev_gray[h//4:3*h//4, w//4:3*w//4]
            center_curr = gray[h//4:3*h//4, w//4:3*w//4]
            flow = cv2.calcOpticalFlowFarneback(center_prev, center_curr, None,
                                                 0.5, 1, 15, 3, 5, 1.1, 0)
            avg_vy = np.mean(flow[:, :, 1])
            avg_vx = np.mean(flow[:, :, 0])
            if abs(avg_vy) > 2:
                scroll_directions.append(('vertical', float(avg_vy)))
            elif abs(avg_vx) > 2:
                scroll_directions.append(('horizontal', float(avg_vx)))

        prev_gray = gray.copy()

        # === COLOR ANALYSIS (#27-37) ===
        # Color palette (k-means)
        pixels = frame.reshape(-1, 3).astype(np.float32)
        if len(pixels) > 5000:
            idx = np.random.choice(len(pixels), 5000, replace=False)
            pixels = pixels[idx]

        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _, labels, centers = cv2.kmeans(pixels, 5, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
        palette = centers.astype(int).tolist()
        color_palettes.append(palette)

        # Gradient detection: smooth horizontal/vertical brightness change
        if h > 50:
            col_means = np.mean(gray, axis=1)
            gradient_score = np.std(np.diff(col_means))
            if gradient_score < 2 and np.std(col_means) > 20:
                gradient_frames += 1

        # Contrast ratio
        p5 = np.percentile(gray, 5)
        p95 = np.percentile(gray, 95)
        if p5 > 0:
            contrast = p95 / p5
            if contrast > 5:
                high_contrast_frames += 1

        # === UI DETECTION (#51-67) ===
        # Navbar: horizontal high-edge-density strip in top 15%
        if h > 100:
            top_strip = gray[:int(h*0.12), :]
            top_edges = cv2.Canny(top_strip, 50, 150)
            top_h_lines = np.mean(top_edges, axis=1)
            if np.max(top_h_lines) > 40:
                navbar_frames += 1

        # Sidebar: vertical strip with different brightness on left/right 20%
        if w > 200:
            left = gray[:, :int(w*0.2)]
            main = gray[:, int(w*0.2):int(w*0.8)]
            left_mean = np.mean(left)
            main_mean = np.mean(main)
            if abs(left_mean - main_mean) > 30:
                sidebar_frames += 1

        # Modal: bright rectangle in center with darker surroundings
        center_region = gray[h//4:3*h//4, w//4:3*w//4]
        border_region = np.concatenate([gray[:h//4, :].flatten(), gray[3*h//4:, :].flatten()])
        if np.mean(center_region) > np.mean(border_region) + 40:
            modal_frames += 1

        # Table/grid: regular horizontal lines
        edges = cv2.Canny(gray, 50, 150)
        h_lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, minLineLength=w//3, maxLineGap=10)
        if h_lines is not None and len(h_lines) > 5:
            table_frames += 1

        # Code/terminal detection: dark bg + regular horizontal text patterns
        if np.mean(gray) < 60:
            edge_density = np.count_nonzero(edges) / (h * w)
            if 0.03 < edge_density < 0.12:
                code_frames += 1
                # Terminal: look for $ or > prompts (very dark + sparse text)
                if edge_density < 0.06:
                    terminal_frames += 1

        # Chat interface: alternating light/dark horizontal bands
        if h > 200:
            band_means = [np.mean(gray[i:i+h//10, :]) for i in range(0, h-h//10, h//10)]
            diffs = [abs(band_means[i] - band_means[i+1]) for i in range(len(band_means)-1)]
            if np.mean(diffs) > 25:
                chat_frames += 1

        # Mobile app frame: narrow content area centered
        if w > 300:
            left_strip = gray[:, :int(w*0.2)]
            right_strip = gray[:, int(w*0.8):]
            center = gray[:, int(w*0.2):int(w*0.8)]
            if (np.std(left_strip) < 15 and np.std(right_strip) < 15 and
                np.std(center) > 30 and abs(np.mean(left_strip) - np.mean(right_strip)) < 20):
                mobile_frames += 1

        # Desktop chrome: title bar with 3 dots/buttons in top-left
        if h > 50:
            top_left = gray[:30, :100]
            if np.mean(top_left) > 200 and np.std(top_left) > 20:
                desktop_chrome_frames += 1

        # === COMPOSITION (#77-79) ===
        # Symmetry: left half vs right half similarity
        left_half = gray[:, :w//2]
        right_half = cv2.flip(gray[:, w//2:w//2*2], 1)
        if left_half.shape == right_half.shape:
            sym = 1 - np.mean(np.abs(left_half.astype(float) - right_half.astype(float))) / 255
            symmetry_scores.append(sym)

        # Rule of thirds: edge density at third lines
        third_h = h // 3
        third_w = w // 3
        third_lines = np.concatenate([
            edges[third_h-5:third_h+5, :].flatten(),
            edges[2*third_h-5:2*third_h+5, :].flatten(),
            edges[:, third_w-5:third_w+5].flatten(),
            edges[:, 2*third_w-5:2*third_w+5].flatten(),
        ])
        rest = edges.flatten()
        if len(rest) > 0:
            thirds_score = np.mean(third_lines) / (np.mean(rest) + 1e-10)
            thirds_scores.append(min(thirds_score, 5))

        # Content aspect ratio
        # Find non-black content area
        mask = gray > 20
        rows = np.any(mask, axis=1)
        cols = np.any(mask, axis=0)
        if np.any(rows) and np.any(cols):
            rmin, rmax = np.where(rows)[0][[0, -1]]
            cmin, cmax = np.where(cols)[0][[0, -1]]
            content_h = rmax - rmin
            content_w = cmax - cmin
            if content_h > 20:
                content_aspect_ratios.append(content_w / content_h)

        # Scene histogram for diversity
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        hist = cv2.calcHist([hsv], [0, 1], None, [30, 30], [0, 180, 0, 256])
        cv2.normalize(hist, hist)
        scene_histograms.append(hist)
        scene_timestamps.append(timestamp)

        total_analyzed += 1
        frame_idx += frame_skip

    cap.release()

    if total_analyzed == 0:
        return None

    # Compute aggregates
    n = total_analyzed

    # Scroll stats
    vert_scrolls = [s[1] for s in scroll_directions if s[0] == 'vertical']
    has_scroll = len(vert_scrolls) > 2
    avg_scroll_speed = float(np.mean(np.abs(vert_scrolls))) if vert_scrolls else 0

    # Color palette diversity: unique colors across all frames
    all_colors = [tuple(c) for palette in color_palettes for c in palette]
    # Cluster to find truly distinct colors
    unique_palette_size = min(len(set(all_colors)), 20)

    # Color consistency: how similar are palettes across frames
    palette_consistency = 0
    if len(color_palettes) >= 2:
        diffs = []
        for i in range(1, len(color_palettes)):
            d = np.mean(np.abs(np.array(color_palettes[i]) - np.array(color_palettes[i-1])))
            diffs.append(d)
        palette_consistency = float(np.mean(diffs))

    # Scene diversity
    scene_diversity = 0
    repetition_count = 0
    if len(scene_histograms) >= 2:
        correlations = []
        for i in range(1, len(scene_histograms)):
            c = cv2.compareHist(scene_histograms[i], scene_histograms[i-1], cv2.HISTCMP_CORREL)
            correlations.append(c)
        scene_diversity = 1 - float(np.mean(correlations))

        # Repetition: does any later scene match an earlier one?
        for i in range(len(scene_histograms)):
            for j in range(i+3, len(scene_histograms)):  # Skip adjacent
                c = cv2.compareHist(scene_histograms[i], scene_histograms[j], cv2.HISTCMP_CORREL)
                if c > 0.9:
                    repetition_count += 1
                    break

    # Bookend: first and last scene similar
    bookend = False
    if len(scene_histograms) >= 2:
        c = cv2.compareHist(scene_histograms[0], scene_histograms[-1], cv2.HISTCMP_CORREL)
        bookend = c > 0.8

    # Longest unbroken scene
    longest_scene = 0
    if len(scene_histograms) >= 2:
        current_len = 1
        for i in range(1, len(scene_histograms)):
            c = cv2.compareHist(scene_histograms[i], scene_histograms[i-1], cv2.HISTCMP_CORREL)
            if c > 0.7:
                current_len += 1
            else:
                longest_scene = max(longest_scene, current_len)
                current_len = 1
        longest_scene = max(longest_scene, current_len)
    longest_scene_sec = longest_scene * FRAME_INTERVAL_SEC

    return {
        # Scroll
        'has_scroll': has_scroll,
        'scroll_frame_count': len(vert_scrolls),
        'avg_scroll_speed': round(avg_scroll_speed, 2),

        # Color design
        'color_palette_size': unique_palette_size,
        'color_consistency': round(palette_consistency, 1),
        'gradient_frame_pct': round(gradient_frames / n, 3),
        'high_contrast_frame_pct': round(high_contrast_frames / n, 3),

        # UI detection
        'navbar_pct': round(navbar_frames / n, 3),
        'sidebar_pct': round(sidebar_frames / n, 3),
        'modal_pct': round(modal_frames / n, 3),
        'table_pct': round(table_frames / n, 3),
        'chat_pct': round(chat_frames / n, 3),
        'code_pct': round(code_frames / n, 3),
        'terminal_pct': round(terminal_frames / n, 3),
        'mobile_frame_pct': round(mobile_frames / n, 3),
        'desktop_chrome_pct': round(desktop_chrome_frames / n, 3),

        # Composition
        'avg_symmetry': round(float(np.mean(symmetry_scores)), 3) if symmetry_scores else 0,
        'avg_thirds_score': round(float(np.mean(thirds_scores)), 3) if thirds_scores else 0,
        'avg_content_aspect': round(float(np.mean(content_aspect_ratios)), 3) if content_aspect_ratios else 0,

        # Structural
        'scene_diversity': round(scene_diversity, 3),
        'repetition_count': repetition_count,
        'has_bookend': bookend,
        'longest_scene_sec': round(longest_scene_sec, 1),

        'frames_analyzed': n,
    }


def extract_metadata(video_path):
    """FFprobe metadata extraction."""
    try:
        result = subprocess.run([
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', video_path
        ], capture_output=True, text=True, timeout=10)

        probe = json.loads(result.stdout)
        streams = probe.get('streams', [])
        fmt = probe.get('format', {})

        video_stream = next((s for s in streams if s.get('codec_type') == 'video'), {})
        audio_stream = next((s for s in streams if s.get('codec_type') == 'audio'), None)

        return {
            'video_codec': video_stream.get('codec_name', ''),
            'audio_codec': audio_stream.get('codec_name', '') if audio_stream else 'none',
            'has_audio_track': audio_stream is not None,
            'video_profile': video_stream.get('profile', ''),
            'pix_fmt': video_stream.get('pix_fmt', ''),
            'avg_frame_rate': video_stream.get('avg_frame_rate', ''),
            'r_frame_rate': video_stream.get('r_frame_rate', ''),
            'bit_rate_stream': int(video_stream.get('bit_rate', 0)) if video_stream.get('bit_rate') else 0,
            'format_name': fmt.get('format_name', ''),
            'encoder': fmt.get('tags', {}).get('encoder', fmt.get('tags', {}).get('major_brand', '')),
            'creation_time': fmt.get('tags', {}).get('creation_time', ''),
        }
    except Exception as e:
        return {'metadata_error': str(e)[:80]}


def process_video(video_path):
    """Full mega analysis on one video."""
    vid = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(OUTPUT_DIR, f"{vid}.json")

    # Skip if done
    if os.path.exists(out_path):
        try:
            existing = json.load(open(out_path))
            if existing.get('status') == 'ok':
                return vid, None
        except:
            pass

    try:
        # Audio
        audio = extract_audio_features(video_path)

        # Deep visual
        visual = analyze_visual_deep(video_path)
        if visual is None:
            result = {'video_id': vid, 'status': 'failed', 'error': 'visual_failed'}
            with open(out_path, 'w') as f:
                json.dump(result, f, indent=2)
            return vid, 'failed'

        # Metadata
        meta = extract_metadata(video_path)

        result = {
            'video_id': vid,
            'status': 'ok',
            'audio': audio,
            'deep_visual': visual,
            'metadata': meta,
        }

        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2, default=lambda x: int(x) if isinstance(x, (np.integer,)) else
                      float(x) if isinstance(x, (np.floating,)) else
                      bool(x) if isinstance(x, (np.bool_,)) else
                      x.tolist() if isinstance(x, np.ndarray) else str(x))

        return vid, 'ok'

    except Exception as e:
        result = {'video_id': vid, 'status': 'error', 'error': str(e)[:200]}
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        return vid, f'error: {str(e)[:60]}'


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

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
                if existing.get('status') == 'ok':
                    continue
            except:
                pass
        remaining.append(v)

    print(f"Total videos: {len(videos)}, already done: {len(videos)-len(remaining)}, remaining: {len(remaining)}")

    if not remaining:
        print("All done!")
        return

    ok = fail = 0
    t0 = time.time()
    workers = min(4, os.cpu_count() or 2)
    print(f"Processing with {workers} workers...")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_video, v): v for v in remaining}
        for future in as_completed(futures):
            try:
                vid_id, status = future.result()
                if status == 'ok':
                    ok += 1
                elif status is not None:
                    fail += 1

                done = ok + fail
                elapsed = time.time() - t0
                rate = done / elapsed * 60 if elapsed > 0 else 0
                eta = (len(remaining) - done) / rate if rate > 0 else 0
                if done % 20 == 0 or done == len(remaining):
                    print(f"  [{done}/{len(remaining)}] ok={ok} fail={fail} — {rate:.1f}/min ETA {eta:.0f}min")
            except Exception as e:
                fail += 1

    print(f"\nDone! ok={ok} fail={fail} in {(time.time()-t0)/60:.1f}min")


if __name__ == '__main__':
    main()
