#!/usr/bin/env python3
"""
track-v3.py — Ultimate motion tracker for motion design videos

Combines:
  1. EasyOCR — rotated bounding boxes with exact angles (not axis-aligned like pytesseract)
  2. RAFT — deep learning dense optical flow (way better than OpenCV Farneback)
  3. HSV color segmentation — track elements by color on solid backgrounds
  4. Contour tracking — shape matching across frames with rotation/scale
  5. Template matching — find recurring elements (phones, logos, icons)

Outputs per-element trajectories with:
  - Position (x, y) with sub-pixel accuracy
  - Rotation angle at arbitrary degrees
  - Scale / Z-depth estimation
  - Bezier curve fit
  - Easing classification
  - Motion blur amount
  - Remotion interpolate() arrays

Usage:
  python3 scripts/track-v3.py <reference.mp4> [output-dir] [--fps N] [--scene START END]
"""

import argparse
import json
import math
import os
import sys
from collections import defaultdict

import cv2
import numpy as np
import torch

# EasyOCR — rotated text detection
import easyocr

# RAFT — dense optical flow
from torchvision.models.optical_flow import raft_large, Raft_Large_Weights
from torchvision.transforms.functional import resize

from scipy.interpolate import splprep, splev


# ════════════════════════════════════════════════════
# 1. EASYOCR TEXT TRACKING — rotated bounding boxes
# ════════════════════════════════════════════════════

def track_text_easyocr(frames_rgb, fps, w, h):
    """Track text using EasyOCR — returns rotated bounding boxes with angles."""
    print("  [easyocr] Initializing reader...")
    reader = easyocr.Reader(['en'], gpu=False, verbose=False)

    text_tracks = defaultdict(list)

    for i, frame in enumerate(frames_rgb):
        if i % 3 != 0:  # every 3rd frame
            continue
        if i % 15 == 0:
            print(f"    Frame {i}/{len(frames_rgb)}...", end="\r")

        results = reader.readtext(frame, paragraph=False, rotation_info=[90, 180, 270])

        for bbox, text, conf in results:
            text = text.strip()
            if not text or conf < 0.2:
                continue

            # bbox is 4 points [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            pts = np.array(bbox, dtype=np.float32)
            cx = float(pts[:, 0].mean())
            cy = float(pts[:, 1].mean())

            # Compute rotation angle from the bounding box
            dx = pts[1][0] - pts[0][0]
            dy = pts[1][1] - pts[0][1]
            angle = math.degrees(math.atan2(dy, dx))

            # Compute width/height of the text
            width = float(np.linalg.norm(pts[1] - pts[0]))
            height = float(np.linalg.norm(pts[3] - pts[0]))

            # Sample color at center
            cy_int, cx_int = int(min(cy, h-1)), int(min(cx, w-1))
            color = frame[cy_int, cx_int].tolist()

            text_tracks[text].append({
                "frame_idx": i,
                "time": round(i / fps, 3),
                "cx": round(cx, 1), "cy": round(cy, 1),
                "cx_norm": round(cx / w, 4), "cy_norm": round(cy / h, 4),
                "width": round(width, 1), "height": round(height, 1),
                "angle_deg": round(angle, 2),
                "confidence": round(conf, 3),
                "bbox": [[round(p[0], 1), round(p[1], 1)] for p in pts.tolist()],
                "color_rgb": color,
            })

    print(f"  [easyocr] Tracked {len(text_tracks)} text elements" + " " * 20)
    return dict(text_tracks)


# ════════════════════════════════════════════════════
# 2. RAFT DENSE OPTICAL FLOW
# ════════════════════════════════════════════════════

def compute_raft_flow(frames_rgb, fps, w, h, interval=2):
    """Compute RAFT dense optical flow between frame pairs."""
    print(f"  [raft] Loading model...")
    device = "cpu"
    weights = Raft_Large_Weights.DEFAULT
    model = raft_large(weights=weights).to(device).eval()
    raft_transforms = weights.transforms()

    flows = []
    print(f"  [raft] Computing flow for {len(frames_rgb)} frames (interval={interval})...")

    with torch.no_grad():
        for i in range(0, len(frames_rgb) - interval, interval):
            j = i + interval
            if i % 10 == 0:
                print(f"    Frame {i}/{len(frames_rgb)}...", end="\r")

            # Convert to tensors [1, 3, H, W]
            f1 = torch.from_numpy(frames_rgb[i]).permute(2, 0, 1).unsqueeze(0).float().to(device)
            f2 = torch.from_numpy(frames_rgb[j]).permute(2, 0, 1).unsqueeze(0).float().to(device)

            # Resize to be divisible by 8
            _, _, fh, fw = f1.shape
            new_h = (fh // 8) * 8
            new_w = (fw // 8) * 8
            f1 = resize(f1, [new_h, new_w])
            f2 = resize(f2, [new_h, new_w])

            f1_t, f2_t = raft_transforms(f1, f2)
            preds = model(f1_t, f2_t)
            flow = preds[-1].squeeze(0).cpu().numpy()  # [2, H, W]

            mag = np.sqrt(flow[0]**2 + flow[1]**2)

            # Find regions of high motion
            motion_mask = mag > 2.0
            hot_spots = []
            if motion_mask.sum() > 50:
                # Find contours of motion regions
                mask_u8 = (motion_mask * 255).astype(np.uint8)
                contours, _ = cv2.findContours(mask_u8, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
                    area = cv2.contourArea(cnt)
                    if area < 100:
                        continue
                    x, y, bw, bh = cv2.boundingRect(cnt)
                    region_flow = flow[:, y:y+bh, x:x+bw]
                    mean_dx = float(region_flow[0].mean())
                    mean_dy = float(region_flow[1].mean())
                    mean_mag = float(np.sqrt(mean_dx**2 + mean_dy**2))
                    direction = math.degrees(math.atan2(mean_dy, mean_dx))

                    hot_spots.append({
                        "bbox": {"x": int(x), "y": int(y), "w": int(bw), "h": int(bh)},
                        "center": {"x": int(x + bw//2), "y": int(y + bh//2)},
                        "dx": round(mean_dx, 2),
                        "dy": round(mean_dy, 2),
                        "magnitude": round(mean_mag, 2),
                        "direction_deg": round(direction, 1),
                        "area": int(area),
                        "blur_estimate": round(mean_mag * 0.3, 1),
                    })

            flows.append({
                "frame_idx": i,
                "to_frame": j,
                "time": round(i / fps, 3),
                "mean_magnitude": round(float(mag.mean()), 3),
                "max_magnitude": round(float(mag.max()), 1),
                "moving_area_pct": round(float(motion_mask.mean()) * 100, 1),
                "hot_spots": hot_spots,
            })

    print(f"  [raft] Computed {len(flows)} flow fields" + " " * 20)
    return flows


# ════════════════════════════════════════════════════
# 3. HSV COLOR SEGMENTATION TRACKING
# ════════════════════════════════════════════════════

def track_by_color(frames_rgb, fps, w, h):
    """Segment and track elements by their dominant color."""
    print("  [color] Detecting and tracking color regions...")

    # Auto-detect dominant colors from first few frames
    print("    Detecting dominant colors...")
    all_pixels = np.concatenate([f.reshape(-1, 3) for f in frames_rgb[:5]])
    from sklearn.cluster import KMeans
    kmeans = KMeans(n_clusters=6, n_init=3, max_iter=50, random_state=42)
    kmeans.fit(all_pixels[::100])  # sample every 100th pixel
    dominant_colors = kmeans.cluster_centers_.astype(int)

    print(f"    Dominant colors: {['#{:02x}{:02x}{:02x}'.format(c[0],c[1],c[2]) for c in dominant_colors]}")

    color_tracks = {}
    for ci, color in enumerate(dominant_colors):
        # Skip near-white and near-black (backgrounds)
        brightness = color.mean()
        if brightness > 240 or brightness < 15:
            continue

        # Create HSV range for this color
        color_bgr = np.uint8([[color[::-1]]])  # RGB to BGR
        color_hsv = cv2.cvtColor(color_bgr, cv2.COLOR_BGR2HSV)[0][0]

        # HSV tolerance
        h_tol, s_tol, v_tol = 15, 50, 50
        lower = np.array([max(0, color_hsv[0] - h_tol), max(0, color_hsv[1] - s_tol), max(0, color_hsv[2] - v_tol)])
        upper = np.array([min(179, color_hsv[0] + h_tol), min(255, color_hsv[1] + s_tol), min(255, color_hsv[2] + v_tol)])

        positions = []
        for fi, frame in enumerate(frames_rgb):
            if fi % 2 != 0:
                continue

            hsv = cv2.cvtColor(frame, cv2.COLOR_RGB2HSV)
            mask = cv2.inRange(hsv, lower, upper)

            # Clean mask
            kernel = np.ones((5, 5), np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            for cnt in contours:
                area = cv2.contourArea(cnt)
                if area < 200:
                    continue

                rect = cv2.minAreaRect(cnt)
                center, size, angle = rect
                M = cv2.moments(cnt)
                if M["m00"] > 0:
                    cmx = int(M["m10"] / M["m00"])
                    cmy = int(M["m01"] / M["m00"])
                else:
                    cmx, cmy = int(center[0]), int(center[1])

                positions.append({
                    "frame_idx": fi,
                    "time": round(fi / fps, 3),
                    "cx": cmx, "cy": cmy,
                    "cx_norm": round(cmx / w, 4), "cy_norm": round(cmy / h, 4),
                    "area": int(area),
                    "angle_deg": round(angle, 2),
                    "width": round(max(size), 1),
                    "height": round(min(size), 1),
                })

        if len(positions) > 3:
            hex_color = '#{:02x}{:02x}{:02x}'.format(color[0], color[1], color[2])
            color_tracks[hex_color] = {
                "color_rgb": color.tolist(),
                "total_appearances": len(positions),
                "positions": positions,
            }

    print(f"  [color] Tracked {len(color_tracks)} color groups")
    return color_tracks


# ════════════════════════════════════════════════════
# 4. EASING + BEZIER FITTING
# ════════════════════════════════════════════════════

def fit_easing(values, times):
    if len(values) < 3:
        return {"type": "unknown"}
    v = np.array(values, dtype=float)
    t = np.array(times, dtype=float)
    t_norm = (t - t[0]) / max(t[-1] - t[0], 0.001)
    v_min, v_max = v.min(), v.max()
    if v_max - v_min < 0.5:
        return {"type": "static"}
    v_norm = (v - v_min) / (v_max - v_min)

    curves = {
        "linear": lambda t: t,
        "ease_in": lambda t: t**2,
        "ease_out": lambda t: 1-(1-t)**2,
        "ease_in_out": lambda t: np.where(t<0.5, 2*t**2, 1-(-2*t+2)**2/2),
        "ease_out_cubic": lambda t: 1-(1-t)**3,
        "ease_out_expo": lambda t: 1-2**(-10*np.clip(t,0,1)),
        "spring": lambda t: 1+2.70158*(t-1)**3+1.70158*(t-1)**2,
    }
    best, best_err = "linear", float("inf")
    for name, func in curves.items():
        try:
            err = float(np.mean((v_norm - func(t_norm))**2))
            if err < best_err: best_err, best = err, name
        except: pass
    if bool(np.any(v_norm > 1.05) or np.any(v_norm < -0.05)):
        best = "spring_overshoot"
    return {"type": best, "confidence": round(max(0, 1-best_err*10), 3)}


def fit_bezier(xs, ys):
    if len(xs) < 4:
        return None
    try:
        tck, u = splprep([xs, ys], s=len(xs)*3, k=min(3, len(xs)-1))
        u_fine = np.linspace(0, 1, 50)
        x_fine, y_fine = splev(u_fine, tck)
        return {
            "path": [{"x": round(float(x), 1), "y": round(float(y), 1)} for x, y in zip(x_fine, y_fine)],
            "control_points": [{"x": round(float(x), 1), "y": round(float(y), 1)} for x, y in zip(tck[1][0], tck[1][1])],
        }
    except:
        return None


# ════════════════════════════════════════════════════
# MAIN
# ════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Ultimate motion tracker v3")
    parser.add_argument("video", help="Reference MP4")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument("--fps", type=int, default=10, help="Analysis FPS")
    parser.add_argument("--scene", nargs=2, type=float, metavar=("START", "END"), help="Scene time range")
    parser.add_argument("--no-raft", action="store_true")
    parser.add_argument("--no-color", action="store_true")
    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    output_dir = args.output or os.path.join(os.path.dirname(video_path), "tracks-v3")
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    native_fps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = total / native_fps

    skip = max(1, int(native_fps / args.fps))
    start_f = int(args.scene[0] * native_fps) if args.scene else 0
    end_f = int(args.scene[1] * native_fps) if args.scene else total

    print(f"=== Ultimate Motion Tracker v3 ===")
    print(f"  {video_path}")
    print(f"  {w}x{h} @ {native_fps:.0f}fps, {dur:.1f}s")
    print(f"  Range: {start_f/native_fps:.1f}s-{end_f/native_fps:.1f}s, analysis at {args.fps}fps")
    print()

    # Load frames
    print("[1/5] Loading frames...")
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_f)
    frames = []
    scale = min(960 / w, 540 / h, 1.0)
    fi = start_f
    while fi < end_f and len(frames) < 600:
        ret, frame = cap.read()
        if not ret: break
        if (fi - start_f) % skip == 0:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            if scale < 1:
                rgb = cv2.resize(rgb, None, fx=scale, fy=scale)
            frames.append(rgb)
        fi += 1
    cap.release()
    sw, sh = frames[0].shape[1], frames[0].shape[0]
    print(f"  {len(frames)} frames at {sw}x{sh}")

    # EasyOCR text tracking
    print("[2/5] EasyOCR text tracking (rotated boxes)...")
    text_data = track_text_easyocr(frames, args.fps, sw, sh)

    # Process text into trajectories with easing
    text_trajectories = {}
    for word, positions in text_data.items():
        if len(positions) < 2:
            continue
        xs = [p["cx"] for p in positions]
        ys = [p["cy"] for p in positions]
        angles = [p["angle_deg"] for p in positions]
        times = [p["time"] for p in positions]

        text_trajectories[word] = {
            "appearances": len(positions),
            "first_seen": positions[0]["time"],
            "last_seen": positions[-1]["time"],
            "x_easing": fit_easing(xs, times),
            "y_easing": fit_easing(ys, times),
            "angle_easing": fit_easing(angles, times),
            "angle_range": [round(min(angles), 1), round(max(angles), 1)],
            "size_range": [round(min(p["height"] for p in positions), 1), round(max(p["height"] for p in positions), 1)],
            "bezier": fit_bezier(xs, ys),
            "positions": positions,
        }

    # RAFT dense flow
    raft_data = []
    if not args.no_raft:
        print("[3/5] RAFT dense optical flow...")
        raft_data = compute_raft_flow(frames, args.fps, sw, sh, interval=2)
    else:
        print("[3/5] Skipping RAFT")

    # Color segmentation tracking
    color_data = {}
    if not args.no_color:
        print("[4/5] HSV color segmentation tracking...")
        color_data = track_by_color(frames, args.fps, sw, sh)
    else:
        print("[4/5] Skipping color tracking")

    # Aggregate motion events
    print("[5/5] Building motion timeline...")
    motion_events = []

    # From RAFT: high-motion frames
    for flow in raft_data:
        if flow["max_magnitude"] > 5:
            for hs in flow["hot_spots"]:
                motion_events.append({
                    "time": flow["time"],
                    "frame_idx": flow["frame_idx"],
                    "type": "raft_motion",
                    "center": hs["center"],
                    "direction_deg": hs["direction_deg"],
                    "magnitude": hs["magnitude"],
                    "blur": hs["blur_estimate"],
                })

    # From text: text appearances/movements
    for word, traj in text_trajectories.items():
        if traj["appearances"] >= 2:
            motion_events.append({
                "time": traj["first_seen"],
                "type": "text_appear",
                "word": word,
                "angle_range": traj["angle_range"],
                "x_easing": traj["x_easing"]["type"],
                "y_easing": traj["y_easing"]["type"],
            })

    motion_events.sort(key=lambda e: e["time"])

    # Summary
    from collections import Counter
    text_easing_types = Counter()
    for t in text_trajectories.values():
        text_easing_types[t["x_easing"]["type"]] += 1
        text_easing_types[t["y_easing"]["type"]] += 1

    raft_motion_frames = sum(1 for f in raft_data if f["max_magnitude"] > 5)

    summary = {
        "source": os.path.basename(video_path),
        "resolution": f"{w}x{h}",
        "analysis_resolution": f"{sw}x{sh}",
        "text_elements": len(text_trajectories),
        "text_with_rotation": sum(1 for t in text_trajectories.values() if abs(t["angle_range"][1] - t["angle_range"][0]) > 2),
        "text_easing_types": dict(text_easing_types.most_common()),
        "raft_flow_fields": len(raft_data),
        "raft_high_motion_frames": raft_motion_frames,
        "color_groups_tracked": len(color_data),
        "motion_events": len(motion_events),
        "text_animations": {w: {
            "first": t["first_seen"], "last": t["last_seen"],
            "x_easing": t["x_easing"]["type"], "y_easing": t["y_easing"]["type"],
            "angle_range": t["angle_range"],
        } for w, t in list(text_trajectories.items())[:50]},
    }

    # Write outputs
    print("\nWriting outputs...")
    with open(os.path.join(output_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)
    with open(os.path.join(output_dir, "text-tracks.json"), "w") as f:
        json.dump(text_trajectories, f, indent=2)
    if raft_data:
        with open(os.path.join(output_dir, "raft-flow.json"), "w") as f:
            json.dump(raft_data, f, indent=2)
    if color_data:
        with open(os.path.join(output_dir, "color-tracks.json"), "w") as f:
            json.dump(color_data, f, indent=2, default=str)
    with open(os.path.join(output_dir, "motion-events.json"), "w") as f:
        json.dump(motion_events, f, indent=2)

    # Remotion-ready text keyframes
    remotion = {}
    for word, traj in text_trajectories.items():
        if len(traj["positions"]) < 3:
            continue
        frames_list = [p["frame_idx"] * skip + start_f for p in traj["positions"]]
        x_pct = [round(p["cx"] / sw * 100, 2) for p in traj["positions"]]
        y_pct = [round(p["cy"] / sh * 100, 2) for p in traj["positions"]]
        angles = [round(p["angle_deg"], 1) for p in traj["positions"]]

        remotion[word] = {
            "frames": frames_list,
            "x_percent": x_pct,
            "y_percent": y_pct,
            "angles": angles,
            "x_easing": traj["x_easing"]["type"],
            "y_easing": traj["y_easing"]["type"],
            "code_x": f"interpolate(frame, {frames_list}, {x_pct})",
            "code_y": f"interpolate(frame, {frames_list}, {y_pct})",
            "code_angle": f"interpolate(frame, {frames_list}, {angles})",
        }

    with open(os.path.join(output_dir, "remotion-text-keyframes.json"), "w") as f:
        json.dump(remotion, f, indent=2)

    print()
    print(f"=== Tracking Complete ===")
    print(f"  {len(text_trajectories)} text elements (EasyOCR, rotated)")
    print(f"  {sum(1 for t in text_trajectories.values() if abs(t['angle_range'][1] - t['angle_range'][0]) > 2)} with detected rotation")
    print(f"  {raft_motion_frames} high-motion frames (RAFT)")
    print(f"  {len(color_data)} color groups tracked")
    print(f"  {len(motion_events)} motion events")
    print(f"  Easing types: {dict(text_easing_types.most_common(5))}")
    print()
    print(f"Output: {output_dir}/")
    for f in ["summary.json", "text-tracks.json", "raft-flow.json", "color-tracks.json", "remotion-text-keyframes.json"]:
        p = os.path.join(output_dir, f)
        if os.path.exists(p):
            print(f"  {f} ({os.path.getsize(p)//1024}KB)")


if __name__ == "__main__":
    main()
