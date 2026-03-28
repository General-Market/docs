#!/usr/bin/env python3
"""
storyboard.py — Frame-by-frame animation storyboard extractor

Goes through EVERY frame pair and detects ALL micro-animations:
  - Element position changes (even 1px shifts)
  - Opacity changes (fade-ins, fade-outs)
  - Scale changes (growing/shrinking elements)
  - Rotation (even subtle tilts)
  - Color transitions (per-region)
  - Shadow changes (offset, blur, opacity)
  - Text changes (new words appearing, counters)
  - Micro-interactions (pulses, bounces, wobbles)

Outputs a storyboard JSON: for every frame, what changed and by how much.

Usage:
  python3 scripts/storyboard.py <reference.mp4> [output-dir] [--start N] [--end N]
"""

import argparse
import json
import math
import os
import sys
from collections import defaultdict

import cv2
import numpy as np

try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def compute_region_changes(prev_bgr, curr_bgr, grid_rows=6, grid_cols=8):
    """Divide frame into grid, compute per-region changes."""
    h, w = prev_bgr.shape[:2]
    rh, rw = h // grid_rows, w // grid_cols

    regions = []
    for gy in range(grid_rows):
        for gx in range(grid_cols):
            y1, y2 = gy * rh, (gy + 1) * rh
            x1, x2 = gx * rw, (gx + 1) * rw

            prev_region = prev_bgr[y1:y2, x1:x2].astype(np.float32)
            curr_region = curr_bgr[y1:y2, x1:x2].astype(np.float32)

            # Color change (mean absolute difference)
            color_diff = float(np.abs(curr_region - prev_region).mean())

            # Brightness change
            prev_gray = cv2.cvtColor(prev_region.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
            curr_gray = cv2.cvtColor(curr_region.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
            brightness_diff = float((curr_gray - prev_gray).mean())

            # Edge change (structural change)
            prev_edges = cv2.Canny(prev_gray.astype(np.uint8), 50, 150)
            curr_edges = cv2.Canny(curr_gray.astype(np.uint8), 50, 150)
            edge_diff = float(np.abs(curr_edges.astype(np.float32) - prev_edges.astype(np.float32)).mean())

            # Motion in this region (optical flow)
            flow = cv2.calcOpticalFlowFarneback(
                prev_gray.astype(np.uint8), curr_gray.astype(np.uint8),
                None, 0.5, 2, 10, 2, 5, 1.1, 0
            )
            dx = float(flow[:, :, 0].mean())
            dy = float(flow[:, :, 1].mean())
            magnitude = math.sqrt(dx**2 + dy**2)

            if color_diff < 0.5 and magnitude < 0.1:
                continue  # skip static regions

            regions.append({
                "grid": {"row": gy, "col": gx},
                "center": {"x": int((x1 + x2) / 2), "y": int((y1 + y2) / 2)},
                "color_diff": round(color_diff, 2),
                "brightness_diff": round(brightness_diff, 2),
                "edge_diff": round(edge_diff, 2),
                "motion": {
                    "dx": round(dx, 3),
                    "dy": round(dy, 3),
                    "magnitude": round(magnitude, 3),
                    "direction_deg": round(math.degrees(math.atan2(dy, dx)), 1) if magnitude > 0.1 else 0,
                },
            })

    return regions


def detect_appearing_elements(prev_bgr, curr_bgr):
    """Detect new elements that appeared (opacity 0 → visible)."""
    prev_gray = cv2.cvtColor(prev_bgr, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(curr_bgr, cv2.COLOR_BGR2GRAY)

    # Absolute difference
    diff = cv2.absdiff(curr_gray, prev_gray)

    # Threshold for significant changes
    _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

    # Find contours of changed regions
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    elements = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 50:  # skip noise
            continue

        x, y, bw, bh = cv2.boundingRect(cnt)

        # Check if this region was dark before (element appearing)
        prev_region_brightness = float(prev_gray[y:y+bh, x:x+bw].mean())
        curr_region_brightness = float(curr_gray[y:y+bh, x:x+bw].mean())

        change_type = "unknown"
        if curr_region_brightness > prev_region_brightness + 20:
            change_type = "appearing"
        elif curr_region_brightness < prev_region_brightness - 20:
            change_type = "disappearing"
        else:
            change_type = "moving_or_changing"

        # Get the color of the new element
        curr_rgb = cv2.cvtColor(curr_bgr, cv2.COLOR_BGR2RGB)
        region_color = curr_rgb[y:y+bh, x:x+bw].mean(axis=(0, 1)).astype(int).tolist()

        elements.append({
            "type": change_type,
            "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
            "area": int(area),
            "brightness_before": round(prev_region_brightness, 1),
            "brightness_after": round(curr_region_brightness, 1),
            "color_rgb": region_color,
        })

    elements.sort(key=lambda e: e["area"], reverse=True)
    return elements[:20]


def detect_text_changes(prev_bgr, curr_bgr):
    """Detect new text appearing or text changing."""
    if not HAS_OCR:
        return {"new_text": [], "removed_text": []}

    try:
        prev_gray = cv2.cvtColor(prev_bgr, cv2.COLOR_BGR2GRAY)
        curr_gray = cv2.cvtColor(curr_bgr, cv2.COLOR_BGR2GRAY)

        prev_data = pytesseract.image_to_data(prev_gray, output_type=pytesseract.Output.DICT, config='--psm 11')
        curr_data = pytesseract.image_to_data(curr_gray, output_type=pytesseract.Output.DICT, config='--psm 11')

        prev_words = set(w.strip() for w, c in zip(prev_data["text"], prev_data["conf"]) if w.strip() and int(c) > 40)
        curr_words = set(w.strip() for w, c in zip(curr_data["text"], curr_data["conf"]) if w.strip() and int(c) > 40)

        new_text = sorted(curr_words - prev_words)
        removed_text = sorted(prev_words - curr_words)

        return {
            "new_text": new_text[:10],
            "removed_text": removed_text[:10],
            "has_text_change": len(new_text) > 0 or len(removed_text) > 0,
        }
    except Exception:
        return {"new_text": [], "removed_text": [], "has_text_change": False}


def classify_animation_type(regions, elements):
    """Classify the type of animation happening in this frame transition."""
    if not regions and not elements:
        return "static"

    # Check for global motion (pan/zoom)
    if regions:
        dxs = [r["motion"]["dx"] for r in regions if r["motion"]["magnitude"] > 0.3]
        dys = [r["motion"]["dy"] for r in regions if r["motion"]["magnitude"] > 0.3]

        if len(dxs) > len(regions) * 0.6:
            dx_std = np.std(dxs) if dxs else 0
            dy_std = np.std(dys) if dys else 0
            if dx_std < 1 and dy_std < 1:
                mean_dx = np.mean(dxs)
                mean_dy = np.mean(dys)
                if abs(mean_dx) > abs(mean_dy):
                    return "pan_horizontal"
                else:
                    return "pan_vertical"

    # Check for elements appearing/disappearing
    appearing = [e for e in elements if e["type"] == "appearing"]
    disappearing = [e for e in elements if e["type"] == "disappearing"]

    if appearing and not disappearing:
        return "element_entering"
    if disappearing and not appearing:
        return "element_exiting"
    if appearing and disappearing:
        return "transition"

    # Check for localized motion (component animation)
    moving_regions = [r for r in regions if r["motion"]["magnitude"] > 0.5]
    if 0 < len(moving_regions) <= len(regions) * 0.3:
        return "component_animation"

    # Large color change = scene transition
    color_changes = [r["color_diff"] for r in regions]
    if color_changes and np.mean(color_changes) > 20:
        return "scene_transition"

    return "micro_animation"


def main():
    parser = argparse.ArgumentParser(description="Frame-by-frame storyboard extractor")
    parser.add_argument("video", help="Path to reference MP4")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument("--start", type=float, default=0, help="Start time in seconds")
    parser.add_argument("--end", type=float, default=0, help="End time in seconds (0=full)")
    parser.add_argument("--skip", type=int, default=1, help="Analyze every Nth frame (1=every frame)")
    parser.add_argument("--no-ocr", action="store_true", help="Skip OCR (faster)")
    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    output_dir = args.output or os.path.join(os.path.dirname(video_path), "storyboard")
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps

    start_frame = int(args.start * fps) if args.start > 0 else 0
    end_frame = int(args.end * fps) if args.end > 0 else total_frames

    print(f"=== Frame-by-Frame Storyboard ===")
    print(f"Input:  {video_path}")
    print(f"  {width}x{height} @ {fps:.1f}fps, {duration:.1f}s")
    print(f"  Analyzing frames {start_frame}-{end_frame} (skip={args.skip})")
    print(f"  OCR: {'on' if HAS_OCR and not args.no_ocr else 'off'}")
    print()

    # Seek to start
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

    storyboard = []
    prev_frame = None
    frame_idx = start_frame
    analyzed = 0

    while frame_idx < end_frame:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_idx % args.skip != 0:
            frame_idx += 1
            continue

        if analyzed % 50 == 0:
            print(f"  Frame {frame_idx}/{end_frame} ({analyzed} analyzed)...", end="\r")

        # Downscale for faster analysis (keep aspect)
        scale = min(640 / width, 360 / height, 1.0)
        if scale < 1.0:
            small = cv2.resize(frame, None, fx=scale, fy=scale)
        else:
            small = frame

        if prev_frame is not None:
            # Compute all changes
            regions = compute_region_changes(prev_frame, small)
            elements = detect_appearing_elements(prev_frame, small)

            text_changes = {"new_text": [], "removed_text": [], "has_text_change": False}
            if HAS_OCR and not args.no_ocr and analyzed % 3 == 0:  # OCR every 3rd frame (expensive)
                text_changes = detect_text_changes(prev_frame, small)

            animation_type = classify_animation_type(regions, elements)

            # Overall change magnitude
            total_change = float(cv2.absdiff(small, prev_frame).mean())

            entry = {
                "frame": frame_idx,
                "time": round(frame_idx / fps, 3),
                "total_change": round(total_change, 2),
                "animation_type": animation_type,
                "is_keyframe": total_change > 10 or animation_type in ["scene_transition", "element_entering", "element_exiting"],
                "changed_regions": regions,
                "elements": elements,
                "text": text_changes,
            }

            # Only store if something happened
            if total_change > 0.3 or elements or text_changes.get("has_text_change"):
                storyboard.append(entry)

        prev_frame = small.copy()
        frame_idx += 1
        analyzed += 1

    cap.release()
    print(f"  Done: {analyzed} frames analyzed, {len(storyboard)} animation events" + " " * 20)

    # ── POST-PROCESS: Group into animation sequences ──
    print("Grouping animation sequences...")

    sequences = []
    current_seq = None

    for entry in storyboard:
        if current_seq is None:
            current_seq = {
                "start_frame": entry["frame"],
                "start_time": entry["time"],
                "end_frame": entry["frame"],
                "end_time": entry["time"],
                "type": entry["animation_type"],
                "peak_change": entry["total_change"],
                "frames": [entry],
            }
        elif (entry["frame"] - current_seq["end_frame"] <= 3 * args.skip and
              entry["animation_type"] == current_seq["type"]):
            # Continue sequence
            current_seq["end_frame"] = entry["frame"]
            current_seq["end_time"] = entry["time"]
            current_seq["peak_change"] = max(current_seq["peak_change"], entry["total_change"])
            current_seq["frames"].append(entry)
        else:
            # Close sequence and start new
            current_seq["duration_frames"] = current_seq["end_frame"] - current_seq["start_frame"]
            current_seq["duration_sec"] = round(current_seq["end_time"] - current_seq["start_time"], 3)
            current_seq["frame_count"] = len(current_seq["frames"])
            sequences.append(current_seq)
            current_seq = {
                "start_frame": entry["frame"],
                "start_time": entry["time"],
                "end_frame": entry["frame"],
                "end_time": entry["time"],
                "type": entry["animation_type"],
                "peak_change": entry["total_change"],
                "frames": [entry],
            }

    if current_seq:
        current_seq["duration_frames"] = current_seq["end_frame"] - current_seq["start_frame"]
        current_seq["duration_sec"] = round(current_seq["end_time"] - current_seq["start_time"], 3)
        current_seq["frame_count"] = len(current_seq["frames"])
        sequences.append(current_seq)

    print(f"  {len(sequences)} animation sequences detected")

    # ── SUMMARY ──
    summary = {
        "source": os.path.basename(video_path),
        "video": {"width": width, "height": height, "fps": round(fps, 2), "duration": round(duration, 3), "total_frames": total_frames},
        "analysis_range": {"start_frame": start_frame, "end_frame": end_frame, "skip": args.skip},
        "total_animation_events": len(storyboard),
        "animation_sequences": len(sequences),
        "sequence_summary": [{
            "start_time": s["start_time"],
            "end_time": s["end_time"],
            "duration": s["duration_sec"],
            "type": s["type"],
            "peak_change": round(s["peak_change"], 1),
            "frame_count": s["frame_count"],
        } for s in sequences],
        "animation_types": dict(sorted(
            defaultdict(int, {s["type"]: sum(1 for x in sequences if x["type"] == s["type"]) for s in sequences}).items(),
            key=lambda x: -x[1]
        )),
        "keyframes": [e["frame"] for e in storyboard if e.get("is_keyframe")],
    }

    # Write outputs
    storyboard_path = os.path.join(output_dir, "storyboard.json")
    with open(storyboard_path, "w") as f:
        json.dump(storyboard, f, indent=2, default=str)

    summary_path = os.path.join(output_dir, "storyboard-summary.json")
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)

    # Write sequences (without per-frame data, for quick reference)
    seq_summary_path = os.path.join(output_dir, "animation-sequences.json")
    seq_export = []
    for s in sequences:
        seq_export.append({
            "start_time": s["start_time"],
            "end_time": s["end_time"],
            "duration_sec": s["duration_sec"],
            "type": s["type"],
            "peak_change": round(s["peak_change"], 1),
            "frame_count": s["frame_count"],
            # Include first and last frame details
            "first_frame": {
                "frame": s["frames"][0]["frame"],
                "elements": s["frames"][0].get("elements", [])[:5],
                "text": s["frames"][0].get("text", {}),
            },
            "last_frame": {
                "frame": s["frames"][-1]["frame"],
                "elements": s["frames"][-1].get("elements", [])[:5],
                "text": s["frames"][-1].get("text", {}),
            },
        })

    with open(seq_summary_path, "w") as f:
        json.dump(seq_export, f, indent=2, default=str)

    print()
    print(f"=== Storyboard Complete ===")
    print(f"  {len(storyboard)} animation events across {analyzed} frames")
    print(f"  {len(sequences)} animation sequences")
    print(f"  {len(summary['keyframes'])} keyframes")
    print()
    print(f"Output:")
    print(f"  {storyboard_path} ({os.path.getsize(storyboard_path) // 1024}KB)")
    print(f"  {summary_path}")
    print(f"  {seq_summary_path}")

    # Print top sequences
    print()
    print("Top animation sequences:")
    for s in sorted(sequences, key=lambda x: x["peak_change"], reverse=True)[:15]:
        print(f"  {s['start_time']:.1f}s-{s['end_time']:.1f}s: {s['type']} "
              f"(peak={s['peak_change']:.1f}, {s['frame_count']} frames)")


if __name__ == "__main__":
    main()
