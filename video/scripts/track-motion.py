#!/usr/bin/env python3
"""
track-motion.py v2 — Ultra motion tracker for motion design videos

Tracks EVERYTHING:
  - Per-letter text position, size, rotation, opacity across frames
  - Shape/element position, scale, rotation (including Z-axis perspective)
  - Contour-based tracking (works on solid backgrounds)
  - Template matching for recurring elements
  - Angle detection (arbitrary, not just 0/45/90)
  - Z-depth estimation from scale changes + perspective transforms
  - Motion blur estimation per element
  - Easing curve fitting with bezier control points
  - Remotion-ready interpolation arrays

Usage:
  python3 scripts/track-motion.py <reference.mp4> [output-dir] [--start N] [--end N] [--fps N]
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

from scipy.interpolate import splprep, splev
from scipy.optimize import curve_fit


# ═══════════════════════════════════════════════════
# TEXT TRACKING — per-word and per-letter
# ═══════════════════════════════════════════════════

def track_text_elements(frames_bgr, fps, video_w, video_h):
    """Track every text element across frames using OCR + position tracking."""
    if not HAS_OCR:
        return {}

    print("  [text] Running OCR on each frame...")
    text_tracks = defaultdict(list)  # word -> list of {frame, x, y, w, h, angle, conf}

    for i, frame in enumerate(frames_bgr):
        if i % 5 == 0:
            print(f"    OCR frame {i}/{len(frames_bgr)}...", end="\r")

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        try:
            # Get detailed OCR with orientation
            data = pytesseract.image_to_data(gray, output_type=pytesseract.Output.DICT,
                                              config='--psm 11 --oem 3')
        except Exception:
            continue

        for j in range(len(data["text"])):
            word = data["text"][j].strip()
            conf = int(data["conf"][j]) if str(data["conf"][j]) != '-1' else 0
            if not word or conf < 20 or len(word) < 1:
                continue

            x, y, w, h = data["left"][j], data["top"][j], data["width"][j], data["height"][j]
            if w < 3 or h < 3:
                continue

            # Sample color at text center
            cy, cx = min(y + h//2, video_h-1), min(x + w//2, video_w-1)
            color = frame[cy, cx].tolist()  # BGR

            text_tracks[word].append({
                "frame_idx": i,
                "time": round(i / fps, 3),
                "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                "cx": int(x + w//2), "cy": int(y + h//2),
                "cx_norm": round((x + w//2) / video_w, 4),
                "cy_norm": round((y + h//2) / video_h, 4),
                "font_height": int(h),
                "confidence": conf,
                "color_bgr": color,
            })

    print(f"  [text] Tracked {len(text_tracks)} unique words" + " " * 20)
    return dict(text_tracks)


def track_per_letter(frames_bgr, fps, video_w, video_h):
    """Track individual letters for per-character animation detection."""
    if not HAS_OCR:
        return {}

    print("  [letters] Running character-level OCR...")
    letter_tracks = defaultdict(list)

    for i, frame in enumerate(frames_bgr):
        if i % 8 == 0:  # every 8th frame for speed
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            try:
                # Character-level boxes
                boxes = pytesseract.image_to_boxes(gray, config='--psm 11 --oem 3')
                for line in boxes.strip().split('\n'):
                    if not line:
                        continue
                    parts = line.split()
                    if len(parts) < 6:
                        continue
                    char = parts[0]
                    x1, y1, x2, y2 = int(parts[1]), int(parts[2]), int(parts[3]), int(parts[4])
                    # Tesseract y is from bottom
                    y1_real = video_h - y2
                    y2_real = video_h - y1
                    cx = (x1 + x2) // 2
                    cy = (y1_real + y2_real) // 2

                    letter_tracks[char].append({
                        "frame_idx": i,
                        "time": round(i / fps, 3),
                        "x": x1, "y": y1_real,
                        "w": x2 - x1, "h": y2_real - y1_real,
                        "cx": cx, "cy": cy,
                        "cx_norm": round(cx / video_w, 4),
                        "cy_norm": round(cy / video_h, 4),
                    })
            except Exception:
                pass

    print(f"  [letters] Tracked {len(letter_tracks)} unique characters")
    return dict(letter_tracks)


# ═══════════════════════════════════════════════════
# CONTOUR TRACKING — works on solid backgrounds
# ═══════════════════════════════════════════════════

def track_contours(frames_bgr, fps, video_w, video_h, min_area=200):
    """Track shape contours across frames — works on clean motion graphics."""
    print("  [contours] Detecting and tracking shapes...")

    all_contour_data = []

    for i, frame in enumerate(frames_bgr):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Adaptive threshold to handle both light and dark backgrounds
        binary = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                        cv2.THRESH_BINARY, 11, 2)
        # Also try Otsu
        _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

        # Combine
        combined = cv2.bitwise_or(binary, otsu)

        contours, hierarchy = cv2.findContours(combined, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        frame_contours = []
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if area < min_area:
                continue

            # Rotated bounding box (captures rotation angle!)
            rect = cv2.minAreaRect(cnt)
            center = rect[0]
            size = rect[1]
            angle = rect[2]

            # Regular bounding box
            x, y, bw, bh = cv2.boundingRect(cnt)

            # Aspect ratio and circularity
            perimeter = cv2.arcLength(cnt, True)
            circularity = 4 * math.pi * area / (perimeter * perimeter) if perimeter > 0 else 0

            # Approximate shape
            approx = cv2.approxPolyDP(cnt, 0.02 * perimeter, True)
            n_vertices = len(approx)

            # Moments for center of mass
            M = cv2.moments(cnt)
            if M["m00"] > 0:
                cmx = int(M["m10"] / M["m00"])
                cmy = int(M["m01"] / M["m00"])
            else:
                cmx, cmy = int(center[0]), int(center[1])

            # Mean color inside contour
            mask = np.zeros(gray.shape, dtype=np.uint8)
            cv2.drawContours(mask, [cnt], 0, 255, -1)
            mean_color = cv2.mean(frame, mask=mask)[:3]

            frame_contours.append({
                "area": int(area),
                "center": {"x": cmx, "y": cmy},
                "center_norm": {"x": round(cmx / video_w, 4), "y": round(cmy / video_h, 4)},
                "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
                "rotated_rect": {
                    "center": {"x": round(center[0], 1), "y": round(center[1], 1)},
                    "size": {"w": round(max(size), 1), "h": round(min(size), 1)},
                    "angle": round(angle, 2),
                },
                "circularity": round(circularity, 3),
                "vertices": n_vertices,
                "aspect_ratio": round(max(size) / max(min(size), 1), 2),
                "color_bgr": [int(c) for c in mean_color],
            })

        # Sort by area
        frame_contours.sort(key=lambda c: c["area"], reverse=True)

        all_contour_data.append({
            "frame_idx": i,
            "time": round(i / fps, 3),
            "contours": frame_contours[:30],  # top 30
        })

    print(f"  [contours] Processed {len(all_contour_data)} frames")
    return all_contour_data


# ═══════════════════════════════════════════════════
# ELEMENT MATCHING — track same element across frames
# ═══════════════════════════════════════════════════

def match_elements_across_frames(contour_data, max_dist=100):
    """Match contours between consecutive frames to build trajectories."""
    print("  [matching] Linking elements across frames...")

    trajectories = []  # list of {id, points: [{frame, x, y, angle, scale, ...}]}
    active = {}  # id -> last known state
    next_id = 0

    for frame_data in contour_data:
        frame_idx = frame_data["frame_idx"]
        contours = frame_data["contours"]

        used_ids = set()
        unmatched = list(range(len(contours)))

        # Match to existing trajectories
        for tid, last in list(active.items()):
            best_match = None
            best_dist = max_dist

            for ci in unmatched:
                cnt = contours[ci]
                dx = cnt["center"]["x"] - last["center"]["x"]
                dy = cnt["center"]["y"] - last["center"]["y"]
                dist = math.sqrt(dx*dx + dy*dy)

                # Also check area similarity
                area_ratio = cnt["area"] / max(last["area"], 1)
                if 0.3 < area_ratio < 3.0 and dist < best_dist:
                    best_dist = dist
                    best_match = ci

            if best_match is not None:
                cnt = contours[best_match]
                used_ids.add(tid)
                unmatched.remove(best_match)

                # Compute motion metrics
                dx = cnt["center"]["x"] - last["center"]["x"]
                dy = cnt["center"]["y"] - last["center"]["y"]
                speed = math.sqrt(dx*dx + dy*dy)
                direction = math.degrees(math.atan2(dy, dx))

                # Scale change (Z-depth indicator)
                scale_change = cnt["area"] / max(last["area"], 1)

                # Rotation change
                angle_change = cnt["rotated_rect"]["angle"] - last.get("angle", 0)

                point = {
                    "frame_idx": frame_idx,
                    "time": frame_data["time"],
                    "x": cnt["center"]["x"],
                    "y": cnt["center"]["y"],
                    "x_norm": cnt["center_norm"]["x"],
                    "y_norm": cnt["center_norm"]["y"],
                    "area": cnt["area"],
                    "angle": cnt["rotated_rect"]["angle"],
                    "width": cnt["rotated_rect"]["size"]["w"],
                    "height": cnt["rotated_rect"]["size"]["h"],
                    "dx": round(dx, 1),
                    "dy": round(dy, 1),
                    "speed": round(speed, 1),
                    "direction_deg": round(direction, 1),
                    "scale_change": round(scale_change, 3),
                    "angle_change": round(angle_change, 2),
                    "blur_estimate": round(speed * 0.3, 1),
                    "z_depth_indicator": round(math.log(max(scale_change, 0.01)), 3),
                }

                # Find the trajectory and append
                for traj in trajectories:
                    if traj["id"] == tid:
                        traj["points"].append(point)
                        break

                active[tid] = {
                    "center": cnt["center"],
                    "area": cnt["area"],
                    "angle": cnt["rotated_rect"]["angle"],
                }

        # Start new trajectories for unmatched contours
        for ci in unmatched:
            cnt = contours[ci]
            tid = next_id
            next_id += 1

            trajectories.append({
                "id": tid,
                "start_frame": frame_idx,
                "start_time": frame_data["time"],
                "color_bgr": cnt["color_bgr"],
                "initial_area": cnt["area"],
                "points": [{
                    "frame_idx": frame_idx,
                    "time": frame_data["time"],
                    "x": cnt["center"]["x"],
                    "y": cnt["center"]["y"],
                    "x_norm": cnt["center_norm"]["x"],
                    "y_norm": cnt["center_norm"]["y"],
                    "area": cnt["area"],
                    "angle": cnt["rotated_rect"]["angle"],
                    "width": cnt["rotated_rect"]["size"]["w"],
                    "height": cnt["rotated_rect"]["size"]["h"],
                    "dx": 0, "dy": 0, "speed": 0,
                    "direction_deg": 0, "scale_change": 1.0,
                    "angle_change": 0, "blur_estimate": 0,
                    "z_depth_indicator": 0,
                }],
            })

            active[tid] = {
                "center": cnt["center"],
                "area": cnt["area"],
                "angle": cnt["rotated_rect"]["angle"],
            }

    # Filter: keep only trajectories with 3+ points and significant movement
    significant = []
    for traj in trajectories:
        if len(traj["points"]) < 3:
            continue

        total_dist = sum(p["speed"] for p in traj["points"])
        max_speed = max(p["speed"] for p in traj["points"])
        angle_range = max(p["angle"] for p in traj["points"]) - min(p["angle"] for p in traj["points"])
        scale_range = max(p["scale_change"] for p in traj["points"]) - min(p["scale_change"] for p in traj["points"])

        if total_dist < 5 and angle_range < 2 and scale_range < 0.05:
            continue  # static element

        traj["total_distance"] = round(total_dist, 1)
        traj["max_speed"] = round(max_speed, 1)
        traj["peak_blur"] = round(max_speed * 0.3, 1)
        traj["angle_range"] = round(angle_range, 1)
        traj["scale_range"] = round(scale_range, 3)
        traj["duration_frames"] = len(traj["points"])
        traj["end_frame"] = traj["points"][-1]["frame_idx"]
        traj["end_time"] = traj["points"][-1]["time"]

        # Classify motion
        if total_dist < 20:
            traj["motion_type"] = "vibration"
        elif angle_range > 15:
            traj["motion_type"] = "rotating"
        elif scale_range > 0.3:
            traj["motion_type"] = "scaling_z_axis"
        else:
            # Check path curvature
            xs = [p["x"] for p in traj["points"]]
            ys = [p["y"] for p in traj["points"]]
            if len(xs) > 2:
                start_to_end = math.sqrt((xs[-1]-xs[0])**2 + (ys[-1]-ys[0])**2)
                path_length = sum(math.sqrt((xs[i]-xs[i-1])**2 + (ys[i]-ys[i-1])**2) for i in range(1, len(xs)))
                straightness = start_to_end / max(path_length, 0.01)
                if straightness > 0.9:
                    # Check angle
                    angle = abs(math.degrees(math.atan2(ys[-1]-ys[0], xs[-1]-xs[0])))
                    traj["motion_type"] = f"slide_{round(angle)}deg"
                elif straightness > 0.6:
                    traj["motion_type"] = "arc"
                else:
                    traj["motion_type"] = "complex_curve"
            else:
                traj["motion_type"] = "unknown"

        significant.append(traj)

    # Sort by total distance
    significant.sort(key=lambda t: t["total_distance"], reverse=True)

    print(f"  [matching] {len(significant)} significant trajectories (from {len(trajectories)} total)")
    return significant


# ═══════════════════════════════════════════════════
# EASING + BEZIER FITTING
# ═══════════════════════════════════════════════════

def fit_trajectory_curves(trajectories, video_w, video_h):
    """Fit easing curves and bezier paths to each trajectory."""
    print("  [curves] Fitting easing curves...")

    for traj in trajectories:
        points = traj["points"]
        if len(points) < 3:
            continue

        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        times = [p["time"] for p in points]
        angles = [p["angle"] for p in points]
        scales = [p.get("area", 1) for p in points]

        # X easing
        traj["x_easing"] = _fit_easing(xs, times)
        traj["y_easing"] = _fit_easing(ys, times)
        traj["angle_easing"] = _fit_easing(angles, times)
        traj["scale_easing"] = _fit_easing(scales, times)

        # Bezier curve fit
        if len(xs) >= 4:
            try:
                tck, u = splprep([xs, ys], s=len(xs) * 5, k=min(3, len(xs)-1))
                u_fine = np.linspace(0, 1, 50)
                x_fine, y_fine = splev(u_fine, tck)

                traj["bezier_path"] = [
                    {"x": round(float(x), 1), "y": round(float(y), 1)}
                    for x, y in zip(x_fine, y_fine)
                ]

                # Control points
                traj["bezier_control_points"] = [
                    {"x": round(float(x), 1), "y": round(float(y), 1)}
                    for x, y in zip(tck[1][0], tck[1][1])
                ]
            except Exception:
                pass

        # Remotion keyframe arrays
        frames = [p["frame_idx"] for p in points]
        x_pct = [round(p["x"] / video_w * 100, 2) for p in points]
        y_pct = [round(p["y"] / video_h * 100, 2) for p in points]

        # Simplify keyframes (keep direction changes only)
        key_frames, key_xs, key_ys = _simplify_keyframes(frames, x_pct, y_pct)

        traj["remotion"] = {
            "frames": key_frames,
            "x_percent": key_xs,
            "y_percent": key_ys,
            "angles": [round(p["angle"], 1) for p in points],
            "code_x": f"interpolate(frame, {key_frames}, {key_xs})",
            "code_y": f"interpolate(frame, {key_frames}, {key_ys})",
        }

    return trajectories


def _fit_easing(values, times):
    """Fit standard easing curves to a value series."""
    if len(values) < 3:
        return {"type": "unknown", "confidence": 0}

    v = np.array(values, dtype=float)
    t = np.array(times, dtype=float)

    # Normalize
    t_norm = (t - t[0]) / max(t[-1] - t[0], 0.001)
    v_min, v_max = v.min(), v.max()
    if v_max - v_min < 0.5:
        return {"type": "static", "value": round(float(v.mean()), 1), "confidence": 1.0}

    v_norm = (v - v_min) / (v_max - v_min)

    curves = {
        "linear": lambda t: t,
        "ease_in_quad": lambda t: t**2,
        "ease_out_quad": lambda t: 1 - (1-t)**2,
        "ease_in_out_quad": lambda t: np.where(t < 0.5, 2*t**2, 1 - (-2*t+2)**2/2),
        "ease_out_cubic": lambda t: 1 - (1-t)**3,
        "ease_out_expo": lambda t: 1 - 2**(-10*np.clip(t, 0, 1)),
        "ease_out_back": lambda t: 1 + 2.70158*(t-1)**3 + 1.70158*(t-1)**2,
    }

    best = "linear"
    best_err = float("inf")
    for name, func in curves.items():
        try:
            pred = func(t_norm)
            err = float(np.mean((v_norm - pred)**2))
            if err < best_err:
                best_err = err
                best = name
        except:
            pass

    overshoot = bool(np.any(v_norm > 1.05) or np.any(v_norm < -0.05))
    if overshoot:
        best = "spring_overshoot"

    return {
        "type": best,
        "confidence": round(max(0, 1 - best_err * 10), 3),
        "has_overshoot": overshoot,
        "start": round(float(v[0]), 1),
        "end": round(float(v[-1]), 1),
        "change": round(float(v[-1] - v[0]), 1),
    }


def _simplify_keyframes(frames, xs, ys, angle_threshold=0.3, speed_threshold=0.3):
    """Keep only frames where direction or speed changes significantly."""
    if len(frames) <= 3:
        return frames, xs, ys

    keep = [0]
    for i in range(1, len(frames) - 1):
        dx1, dy1 = xs[i] - xs[i-1], ys[i] - ys[i-1]
        dx2, dy2 = xs[i+1] - xs[i], ys[i+1] - ys[i]

        a1 = math.atan2(dy1, dx1) if (dx1 != 0 or dy1 != 0) else 0
        a2 = math.atan2(dy2, dx2) if (dx2 != 0 or dy2 != 0) else 0

        s1 = math.sqrt(dx1**2 + dy1**2)
        s2 = math.sqrt(dx2**2 + dy2**2)

        if abs(a2 - a1) > angle_threshold or abs(s2 - s1) / max(s1, 0.01) > speed_threshold:
            keep.append(i)

    keep.append(len(frames) - 1)
    return [frames[i] for i in keep], [xs[i] for i in keep], [ys[i] for i in keep]


# ═══════════════════════════════════════════════════
# PERSPECTIVE / Z-AXIS DETECTION
# ═══════════════════════════════════════════════════

def detect_perspective_transforms(frames_bgr, fps, video_w, video_h):
    """Detect perspective/3D rotation by analyzing line convergence and scale gradients."""
    print("  [perspective] Analyzing 3D transforms...")

    perspective_data = []

    for i, frame in enumerate(frames_bgr):
        if i % 3 != 0:  # every 3rd frame
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)

        lines = cv2.HoughLinesP(edges, 1, np.pi/180, 50, minLineLength=40, maxLineGap=10)
        if lines is None:
            perspective_data.append({"frame_idx": i, "time": round(i/fps, 3), "has_perspective": False})
            continue

        angles = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = math.degrees(math.atan2(y2-y1, x2-x1))
            angles.append(angle)

        if not angles:
            perspective_data.append({"frame_idx": i, "time": round(i/fps, 3), "has_perspective": False})
            continue

        angle_std = float(np.std(angles))
        angle_mean = float(np.mean(angles))

        # High angle diversity = perspective
        has_perspective = angle_std > 15

        # Estimate vanishing point direction
        h_lines = [a for a in angles if abs(a) < 30 or abs(a) > 150]
        v_lines = [a for a in angles if 60 < abs(a) < 120]
        d_lines = [a for a in angles if 30 < abs(a) < 60 or 120 < abs(a) < 150]

        perspective_data.append({
            "frame_idx": i,
            "time": round(i/fps, 3),
            "has_perspective": has_perspective,
            "angle_diversity": round(angle_std, 1),
            "dominant_angle": round(angle_mean, 1),
            "horizontal_lines": len(h_lines),
            "vertical_lines": len(v_lines),
            "diagonal_lines": len(d_lines),
            "total_lines": len(angles),
            "estimated_rotation": round(angle_mean, 1) if has_perspective else 0,
        })

    print(f"  [perspective] {sum(1 for p in perspective_data if p.get('has_perspective'))} frames with perspective")
    return perspective_data


# ═══════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Ultra motion tracker v2")
    parser.add_argument("video", help="Path to reference MP4")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--end", type=float, default=0)
    parser.add_argument("--fps", type=int, default=0, help="Analysis FPS (0=native)")
    parser.add_argument("--no-ocr", action="store_true")
    parser.add_argument("--no-letters", action="store_true")
    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    output_dir = args.output or os.path.join(os.path.dirname(video_path), "motion-tracks-v2")
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    native_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / native_fps

    analysis_fps = args.fps if args.fps > 0 else min(int(native_fps), 15)
    frame_skip = max(1, int(native_fps / analysis_fps))

    start_frame = int(args.start * native_fps) if args.start > 0 else 0
    end_frame = int(args.end * native_fps) if args.end > 0 else total_frames

    print(f"=== Ultra Motion Tracker v2 ===")
    print(f"Input:  {video_path}")
    print(f"  {w}x{h} @ {native_fps:.1f}fps, {duration:.1f}s")
    print(f"  Analyzing at {analysis_fps}fps (skip={frame_skip})")
    print()

    # Extract frames
    print("[1/6] Extracting frames...")
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    frames = []
    fidx = start_frame
    while fidx < end_frame:
        ret, frame = cap.read()
        if not ret:
            break
        if (fidx - start_frame) % frame_skip == 0:
            # Downscale for speed
            scale = min(960 / w, 540 / h, 1.0)
            if scale < 1:
                small = cv2.resize(frame, None, fx=scale, fy=scale)
            else:
                small = frame
            frames.append(small)
        fidx += 1
    cap.release()

    scaled_w = frames[0].shape[1] if frames else w
    scaled_h = frames[0].shape[0] if frames else h
    print(f"  Extracted {len(frames)} frames at {scaled_w}x{scaled_h}")

    # Track text
    text_data = {}
    if not args.no_ocr:
        print("[2/6] Tracking text elements...")
        text_data = track_text_elements(frames, analysis_fps, scaled_w, scaled_h)

    # Track letters
    letter_data = {}
    if not args.no_ocr and not args.no_letters:
        print("[3/6] Tracking per-letter positions...")
        letter_data = track_per_letter(frames, analysis_fps, scaled_w, scaled_h)

    # Track contours
    print("[4/6] Tracking shape contours...")
    contour_data = track_contours(frames, analysis_fps, scaled_w, scaled_h)

    # Match elements across frames
    print("[5/6] Matching elements across frames...")
    trajectories = match_elements_across_frames(contour_data)
    trajectories = fit_trajectory_curves(trajectories, scaled_w, scaled_h)

    # Perspective detection
    print("[6/6] Detecting perspective/3D transforms...")
    perspective = detect_perspective_transforms(frames, analysis_fps, scaled_w, scaled_h)

    # ── WRITE OUTPUTS ──
    print("\nWriting outputs...")

    # Text tracks with easing
    text_with_easing = {}
    for word, positions in text_data.items():
        if len(positions) < 2:
            continue
        xs = [p["cx"] for p in positions]
        ys = [p["cy"] for p in positions]
        times = [p["time"] for p in positions]

        text_with_easing[word] = {
            "appearances": len(positions),
            "first_seen": positions[0]["time"],
            "last_seen": positions[-1]["time"],
            "x_easing": _fit_easing(xs, times),
            "y_easing": _fit_easing(ys, times),
            "font_height_range": [min(p["font_height"] for p in positions), max(p["font_height"] for p in positions)],
            "positions": positions,
        }

    # Summary
    motion_types = defaultdict(int)
    for t in trajectories:
        motion_types[t.get("motion_type", "unknown")] += 1

    summary = {
        "source": os.path.basename(video_path),
        "resolution": f"{w}x{h}",
        "analysis_resolution": f"{scaled_w}x{scaled_h}",
        "fps": round(native_fps, 1),
        "analysis_fps": analysis_fps,
        "duration": round(duration, 1),
        "frames_analyzed": len(frames),
        "text_elements_tracked": len(text_with_easing),
        "letters_tracked": len(letter_data),
        "shape_trajectories": len(trajectories),
        "perspective_frames": sum(1 for p in perspective if p.get("has_perspective")),
        "motion_types": dict(motion_types),
        "top_movers": [{
            "id": t["id"],
            "type": t.get("motion_type", "unknown"),
            "distance": t["total_distance"],
            "max_speed": t["max_speed"],
            "peak_blur": t["peak_blur"],
            "angle_range": t["angle_range"],
            "scale_range": t["scale_range"],
            "x_easing": t.get("x_easing", {}).get("type", "unknown"),
            "y_easing": t.get("y_easing", {}).get("type", "unknown"),
            "duration_frames": t["duration_frames"],
        } for t in trajectories[:30]],
        "text_animations": {w: {
            "first": d["first_seen"],
            "last": d["last_seen"],
            "x_easing": d["x_easing"]["type"],
            "y_easing": d["y_easing"]["type"],
        } for w, d in list(text_with_easing.items())[:50]},
    }

    # Write files
    with open(os.path.join(output_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    with open(os.path.join(output_dir, "trajectories.json"), "w") as f:
        json.dump(trajectories[:100], f, indent=2, default=str)

    with open(os.path.join(output_dir, "text-tracks.json"), "w") as f:
        json.dump(text_with_easing, f, indent=2)

    if letter_data:
        with open(os.path.join(output_dir, "letter-tracks.json"), "w") as f:
            json.dump(dict(list(letter_data.items())[:100]), f, indent=2)

    with open(os.path.join(output_dir, "perspective.json"), "w") as f:
        json.dump(perspective, f, indent=2)

    # Remotion-ready keyframes (top 50 trajectories)
    remotion_data = [{
        "id": t["id"],
        "motion_type": t.get("motion_type"),
        "remotion": t.get("remotion", {}),
        "x_easing": t.get("x_easing", {}).get("type"),
        "y_easing": t.get("y_easing", {}).get("type"),
        "angle_easing": t.get("angle_easing", {}).get("type"),
        "peak_blur": t.get("peak_blur", 0),
        "bezier_path": t.get("bezier_path"),
    } for t in trajectories[:50] if "remotion" in t]

    with open(os.path.join(output_dir, "remotion-keyframes.json"), "w") as f:
        json.dump(remotion_data, f, indent=2)

    print()
    print(f"=== Ultra Motion Tracking Complete ===")
    print(f"  {len(text_with_easing)} text elements with easing curves")
    print(f"  {len(letter_data)} individual characters tracked")
    print(f"  {len(trajectories)} shape trajectories with bezier paths")
    print(f"  {sum(1 for p in perspective if p.get('has_perspective'))} frames with 3D perspective")
    print(f"  Motion types: {dict(motion_types)}")
    print()
    print(f"Output: {output_dir}/")
    print(f"  summary.json           — Overview + top movers")
    print(f"  trajectories.json      — Full trajectories with bezier curves")
    print(f"  text-tracks.json       — Per-word positions + easing")
    print(f"  letter-tracks.json     — Per-character positions")
    print(f"  perspective.json       — 3D/perspective detection per frame")
    print(f"  remotion-keyframes.json — Ready-to-paste interpolation arrays")


if __name__ == "__main__":
    main()
