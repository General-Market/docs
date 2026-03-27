#!/usr/bin/env python3
"""
Analyze YC launch videos that have no transcript.
Extracts: on-screen text (OCR), scene transitions, visual structure.
Outputs per-video JSON + aggregated master JSON.

Resumable — skips already-analyzed videos.
"""

import cv2
import json
import os
import sys
import time
import glob
import numpy as np
import pytesseract
from collections import OrderedDict
from concurrent.futures import ProcessPoolExecutor, as_completed

VIDEO_DIR = "yc_videos_notranscript"
OUTPUT_DIR = "yc_video_analyses"
ENRICHED_JSON = "yc_launches_enriched.json"
MASTER_OUTPUT = "yc_video_analyses_master.json"

# Analysis params
FRAME_INTERVAL_SEC = 3.0        # Extract a frame every N seconds
TRANSITION_THRESHOLD = 0.45     # Histogram correlation below this = scene change
OCR_CONFIDENCE_MIN = 50         # Min tesseract confidence to keep a word
TEXT_DEDUP_SIMILARITY = 0.85    # Levenshtein ratio to consider text "same"
MIN_TEXT_LENGTH = 3             # Ignore OCR results shorter than this


def levenshtein_ratio(s1, s2):
    """Quick similarity ratio between two strings."""
    if not s1 or not s2:
        return 0.0
    len1, len2 = len(s1), len(s2)
    if abs(len1 - len2) / max(len1, len2) > 0.5:
        return 0.0
    # Simple character overlap ratio (faster than full levenshtein)
    common = sum(1 for a, b in zip(s1, s2) if a == b)
    return common / max(len1, len2)


def extract_text_from_frame(frame):
    """Run OCR on a single frame, return cleaned text."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Skip mostly dark or white frames (no text worth reading)
    mean_val = np.mean(gray)
    if mean_val < 30 or mean_val > 245:
        return ''

    # Single pass: enhanced grayscale
    gray = cv2.convertScaleAbs(gray, alpha=1.5, beta=10)

    # Resize down if huge (speeds up OCR dramatically)
    h, w = gray.shape
    if w > 800:
        scale = 800 / w
        gray = cv2.resize(gray, (800, int(h * scale)))

    texts = set()
    try:
        data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT,
                                          config='--psm 6 --oem 3')
        for i, word in enumerate(data['text']):
            conf = int(data['conf'][i]) if data['conf'][i] != '-1' else 0
            word = word.strip()
            if conf >= OCR_CONFIDENCE_MIN and len(word) >= MIN_TEXT_LENGTH:
                texts.add(word)
    except Exception:
        pass

    return ' '.join(sorted(texts)) if texts else ''


def compute_histogram(frame):
    """Compute color histogram for scene transition detection."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
    cv2.normalize(hist, hist)
    return hist


def detect_dominant_colors(frame, k=3):
    """Get dominant colors from frame via k-means."""
    pixels = frame.reshape(-1, 3).astype(np.float32)
    # Sample for speed
    if len(pixels) > 10000:
        indices = np.random.choice(len(pixels), 10000, replace=False)
        pixels = pixels[indices]

    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    centers = centers.astype(int).tolist()
    # Sort by frequency
    unique, counts = np.unique(labels, return_counts=True)
    sorted_idx = np.argsort(-counts)
    return [centers[i] for i in sorted_idx]


def classify_frame_type(frame, text):
    """Heuristic classification of frame content."""
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Check if mostly dark (intro/outro)
    mean_brightness = np.mean(gray)

    # Check edge density (UI/code vs natural image)
    edges = cv2.Canny(gray, 50, 150)
    edge_ratio = np.count_nonzero(edges) / (h * w)

    # Check text density
    text_words = len(text.split()) if text else 0

    if mean_brightness < 40:
        return "dark_screen"
    elif mean_brightness > 230:
        return "white_screen"
    elif text_words > 15:
        return "text_heavy"
    elif text_words > 5:
        return "text_with_visual"
    elif edge_ratio > 0.15:
        return "ui_or_code"
    elif edge_ratio > 0.08:
        return "detailed_visual"
    else:
        return "simple_visual"


def analyze_video(video_path):
    """Full analysis of a single video file."""
    video_id = os.path.splitext(os.path.basename(video_path))[0]

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"video_id": video_id, "error": "cannot_open", "status": "failed"}

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_sec = total_frames / fps if fps > 0 else 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if total_frames < 2 or duration_sec < 0.5:
        cap.release()
        return {"video_id": video_id, "error": "too_short", "status": "failed",
                "duration_sec": round(duration_sec, 1)}

    frame_skip = max(1, int(fps * FRAME_INTERVAL_SEC))

    scenes = []
    all_texts = []
    prev_hist = None
    prev_text = ""
    transitions = []
    frame_types = []

    frame_idx = 0
    analyzed_count = 0

    while True:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret:
            break

        timestamp = frame_idx / fps

        # Histogram for transition detection
        hist = compute_histogram(frame)
        if prev_hist is not None:
            correlation = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_CORREL)
            if correlation < TRANSITION_THRESHOLD:
                transitions.append({
                    "timestamp_sec": round(timestamp, 1),
                    "correlation": round(correlation, 3),
                    "type": "hard_cut" if correlation < 0.2 else "transition"
                })
        prev_hist = hist

        # OCR
        text = extract_text_from_frame(frame)

        # Deduplicate against previous frame text
        is_new_text = True
        if text and prev_text:
            ratio = levenshtein_ratio(text.lower(), prev_text.lower())
            if ratio > TEXT_DEDUP_SIMILARITY:
                is_new_text = False

        if text and is_new_text:
            all_texts.append({
                "timestamp_sec": round(timestamp, 1),
                "text": text
            })
        prev_text = text if text else prev_text

        # Frame classification
        ftype = classify_frame_type(frame, text)
        frame_types.append(ftype)

        # Scene snapshots (at transitions or every ~5 frames analyzed)
        if analyzed_count % 5 == 0 or (transitions and transitions[-1]["timestamp_sec"] == round(timestamp, 1)):
            colors = detect_dominant_colors(frame)
            scenes.append({
                "timestamp_sec": round(timestamp, 1),
                "frame_type": ftype,
                "dominant_colors_bgr": colors,
                "has_text": bool(text),
            })

        analyzed_count += 1
        frame_idx += frame_skip

    cap.release()

    # Summarize frame types
    from collections import Counter
    type_counts = Counter(frame_types)
    total_sampled = len(frame_types)
    type_distribution = {k: round(v / total_sampled, 2) for k, v in type_counts.most_common()}

    # Extract unique text segments (deduplicate across the whole video)
    unique_texts = []
    seen_texts = set()
    for t in all_texts:
        normalized = t["text"].lower().strip()
        # Check against all seen
        is_dup = False
        for seen in seen_texts:
            if levenshtein_ratio(normalized, seen) > 0.7:
                is_dup = True
                break
        if not is_dup:
            unique_texts.append(t)
            seen_texts.add(normalized)

    # Reconstruct full "pseudo-transcript" from unique texts in order
    pseudo_transcript = " | ".join(t["text"] for t in unique_texts) if unique_texts else ""

    return {
        "video_id": video_id,
        "status": "ok",
        "duration_sec": round(duration_sec, 1),
        "resolution": f"{width}x{height}",
        "fps": round(fps, 1),
        "frames_analyzed": analyzed_count,
        "transition_count": len(transitions),
        "transitions": transitions,
        "unique_text_segments": len(unique_texts),
        "text_extractions": unique_texts,
        "pseudo_transcript": pseudo_transcript,
        "frame_type_distribution": type_distribution,
        "scene_snapshots": scenes,
    }


def process_one(video_path):
    """Wrapper for multiprocessing — returns (video_id, result_dict)."""
    video_id = os.path.splitext(os.path.basename(video_path))[0]
    out_path = os.path.join(OUTPUT_DIR, f"{video_id}.json")

    # Skip if already done
    if os.path.exists(out_path):
        try:
            existing = json.load(open(out_path))
            if existing.get("status") == "ok":
                return video_id, None  # Already done
        except Exception:
            pass

    try:
        result = analyze_video(video_path)
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        return video_id, result.get("status", "unknown")
    except Exception as e:
        err_result = {"video_id": video_id, "status": "error", "error": str(e)[:200]}
        with open(out_path, 'w') as f:
            json.dump(err_result, f, indent=2)
        return video_id, f"error: {str(e)[:60]}"


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    videos = sorted(glob.glob(os.path.join(VIDEO_DIR, "*.mp4")))
    # Filter zero-byte
    videos = [v for v in videos if os.path.getsize(v) > 1000]
    print(f"Videos to analyze: {len(videos)}")

    # Check how many already done
    already_done = 0
    for v in videos:
        vid = os.path.splitext(os.path.basename(v))[0]
        out_path = os.path.join(OUTPUT_DIR, f"{vid}.json")
        if os.path.exists(out_path):
            try:
                existing = json.load(open(out_path))
                if existing.get("status") == "ok":
                    already_done += 1
            except Exception:
                pass

    remaining = len(videos) - already_done
    print(f"Already analyzed: {already_done}, remaining: {remaining}")

    if remaining == 0:
        print("All videos already analyzed!")
        aggregate_results()
        return

    # Filter to only remaining videos
    to_process = []
    for v in videos:
        vid = os.path.splitext(os.path.basename(v))[0]
        out_path = os.path.join(OUTPUT_DIR, f"{vid}.json")
        if os.path.exists(out_path):
            try:
                existing = json.load(open(out_path))
                if existing.get("status") == "ok":
                    continue
            except Exception:
                pass
        to_process.append(v)

    ok = 0
    fail = 0
    start_time = time.time()
    workers = min(4, os.cpu_count() or 2)
    print(f"Processing {len(to_process)} videos with {workers} workers...")

    with ProcessPoolExecutor(max_workers=workers) as executor:
        futures = {executor.submit(process_one, v): v for v in to_process}
        for future in as_completed(futures):
            try:
                vid_id, status = future.result()
                if status == "ok":
                    ok += 1
                elif status is not None:
                    fail += 1

                done = ok + fail
                total_elapsed = time.time() - start_time
                rate = done / total_elapsed * 60 if total_elapsed > 0 else 0
                eta_min = (len(to_process) - done) / rate if rate > 0 else 0
                print(f"  [{done}/{len(to_process)}] {status}: {vid_id} "
                      f"— {rate:.1f}/min, ETA {eta_min:.0f}min")
            except Exception as e:
                fail += 1
                print(f"  CRASH: {futures[future]} — {e}")

    total_time = time.time() - start_time
    print(f"\nDone! ok={ok} fail={fail} in {total_time/60:.1f}min")

    aggregate_results()


def aggregate_results():
    """Combine per-video analyses with YC launch metadata."""
    print("\nAggregating results...")

    # Load enriched launch data
    enriched = {}
    if os.path.exists(ENRICHED_JSON):
        launches = json.load(open(ENRICHED_JSON))
        import re
        for launch in launches:
            if not launch.get("video_urls"):
                continue
            urls = launch["video_urls"].split(" | ") if " | " in launch["video_urls"] else [launch["video_urls"]]
            for url in urls:
                for pattern in [r'youtube\.com/watch\?v=([a-zA-Z0-9_-]{11})',
                                r'youtu\.be/([a-zA-Z0-9_-]{11})',
                                r'youtube\.com/embed/([a-zA-Z0-9_-]{11})']:
                    match = re.search(pattern, url)
                    if match:
                        enriched[match.group(1)] = launch
                        break

    # Load all analysis files
    analyses = []
    analysis_files = glob.glob(os.path.join(OUTPUT_DIR, "*.json"))
    for af in sorted(analysis_files):
        try:
            data = json.load(open(af))
            vid = data.get("video_id", "")

            # Attach launch metadata
            if vid in enriched:
                launch = enriched[vid]
                data["company_name"] = launch.get("company_name", "")
                data["title"] = launch.get("title", "")
                data["tagline"] = launch.get("tagline", "")
                data["batch"] = launch.get("batch", "")
                data["industry"] = launch.get("industry", "")
                data["launch_url"] = launch.get("launch_url", "")

            analyses.append(data)
        except Exception as e:
            print(f"  Skipping {af}: {e}")

    # Summary stats
    ok_count = sum(1 for a in analyses if a.get("status") == "ok")
    fail_count = sum(1 for a in analyses if a.get("status") != "ok")
    avg_duration = np.mean([a["duration_sec"] for a in analyses if a.get("duration_sec")]) if analyses else 0
    avg_transitions = np.mean([a["transition_count"] for a in analyses if a.get("transition_count") is not None]) if analyses else 0
    avg_text_segments = np.mean([a["unique_text_segments"] for a in analyses if a.get("unique_text_segments") is not None]) if analyses else 0

    # Videos with most text
    text_rich = sorted([a for a in analyses if a.get("status") == "ok"],
                       key=lambda x: x.get("unique_text_segments", 0), reverse=True)[:20]

    master = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total_videos": len(analyses),
            "successful": ok_count,
            "failed": fail_count,
            "avg_duration_sec": round(avg_duration, 1),
            "avg_transitions": round(avg_transitions, 1),
            "avg_unique_text_segments": round(avg_text_segments, 1),
        },
        "top_text_rich_videos": [{
            "video_id": v["video_id"],
            "company": v.get("company_name", ""),
            "text_segments": v.get("unique_text_segments", 0),
            "pseudo_transcript_preview": v.get("pseudo_transcript", "")[:200],
        } for v in text_rich],
        "analyses": analyses,
    }

    with open(MASTER_OUTPUT, 'w') as f:
        json.dump(master, f, indent=2)

    print(f"Master output: {MASTER_OUTPUT}")
    print(f"  {ok_count} successful, {fail_count} failed")
    print(f"  Avg duration: {avg_duration:.1f}s, Avg transitions: {avg_transitions:.1f}")
    print(f"  Avg text segments: {avg_text_segments:.1f}")


if __name__ == "__main__":
    main()
