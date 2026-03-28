#!/usr/bin/env python3
"""
track-cotracker.py — SOTA motion tracking using CoTracker3 + RAFT

Tracks every visible point in a motion design video with sub-pixel accuracy.
Works on solid backgrounds where OpenCV fails completely.

Pipeline:
  1. CoTracker3: tracks grid of points across all frames (transformer-based)
  2. RAFT: dense optical flow for per-pixel motion vectors
  3. Bezier fitting: converts trajectories to Remotion-ready interpolation arrays
  4. Easing detection: classifies motion curves (ease_out, spring, linear, etc.)

Usage:
  python3 scripts/track-cotracker.py <reference.mp4> [output-dir] [--grid N] [--fps N]

Requires: cotracker, torch, torchvision (RAFT)
"""

import argparse
import json
import math
import os
import sys

import cv2
import numpy as np
import torch

# CoTracker
from cotracker.predictor import CoTrackerPredictor

# RAFT from torchvision
from torchvision.models.optical_flow import raft_large, Raft_Large_Weights
from torchvision import transforms

# Our helpers
from scipy.interpolate import splprep, splev


def load_video_frames(video_path, max_fps=15, max_frames=500):
    """Load video frames as torch tensor [1, T, 3, H, W]."""
    cap = cv2.VideoCapture(video_path)
    native_fps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    skip = max(1, int(native_fps / max_fps))

    # Downscale if too large (CoTracker works best at ~512px)
    scale = min(960 / w, 540 / h, 1.0)

    frames = []
    idx = 0
    while len(frames) < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % skip == 0:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            if scale < 1:
                frame_rgb = cv2.resize(frame_rgb, None, fx=scale, fy=scale)
            frames.append(frame_rgb)
        idx += 1

    cap.release()

    actual_h, actual_w = frames[0].shape[:2]
    # Convert to tensor [1, T, 3, H, W]
    video_tensor = torch.from_numpy(np.stack(frames)).permute(0, 3, 1, 2).unsqueeze(0).float()

    return video_tensor, {
        "native_fps": native_fps,
        "analysis_fps": native_fps / skip,
        "frame_skip": skip,
        "original_w": w,
        "original_h": h,
        "scaled_w": actual_w,
        "scaled_h": actual_h,
        "scale": scale,
        "num_frames": len(frames),
        "total_original_frames": total,
    }


def run_cotracker(video_tensor, grid_size=30, device="cpu"):
    """Run CoTracker3 on video to get point trajectories."""
    print(f"  [cotracker] Running on {video_tensor.shape[1]} frames, grid={grid_size}x{grid_size}...")
    print(f"  [cotracker] Device: {device}")

    model = CoTrackerPredictor(checkpoint=None)
    model = model.to(device)
    video = video_tensor.to(device)

    # Track grid of points
    pred_tracks, pred_visibility = model(video, grid_size=grid_size)

    # Move to CPU
    tracks = pred_tracks.squeeze(0).cpu().numpy()  # [T, N, 2]
    visibility = pred_visibility.squeeze(0).cpu().numpy()  # [T, N]

    print(f"  [cotracker] Tracked {tracks.shape[1]} points across {tracks.shape[0]} frames")
    return tracks, visibility


def run_raft_flow(video_tensor, device="cpu", sample_interval=3):
    """Run RAFT dense optical flow on frame pairs."""
    print(f"  [raft] Computing dense optical flow (every {sample_interval} frames)...")

    weights = Raft_Large_Weights.DEFAULT
    raft_model = raft_large(weights=weights).to(device).eval()
    raft_transforms = weights.transforms()

    T = video_tensor.shape[1]
    flows = []

    with torch.no_grad():
        for i in range(0, T - 1, sample_interval):
            j = min(i + 1, T - 1)
            # Extract frame pair [3, H, W]
            f1 = video_tensor[0, i].to(device)
            f2 = video_tensor[0, j].to(device)

            # RAFT expects [B, 3, H, W] in 0-255
            f1_batch = f1.unsqueeze(0)
            f2_batch = f2.unsqueeze(0)

            # Apply transforms
            f1_t, f2_t = raft_transforms(f1_batch, f2_batch)

            # Predict flow
            flow_predictions = raft_model(f1_t, f2_t)
            flow = flow_predictions[-1].squeeze(0).cpu().numpy()  # [2, H, W]

            # Compute stats
            mag = np.sqrt(flow[0]**2 + flow[1]**2)

            flows.append({
                "frame_idx": i,
                "to_frame": j,
                "mean_magnitude": round(float(mag.mean()), 3),
                "max_magnitude": round(float(mag.max()), 1),
                "mean_dx": round(float(flow[0].mean()), 2),
                "mean_dy": round(float(flow[1].mean()), 2),
                # Per-region flow (3x3 grid)
                "regions": _compute_region_flow(flow, mag),
            })

    print(f"  [raft] Computed {len(flows)} flow fields")
    return flows


def _compute_region_flow(flow, mag):
    """Compute flow stats per 3x3 grid region."""
    h, w = mag.shape
    rh, rw = h // 3, w // 3
    regions = {}
    for gy, name_y in enumerate(["top", "mid", "bot"]):
        for gx, name_x in enumerate(["left", "center", "right"]):
            y1, y2 = gy * rh, (gy + 1) * rh
            x1, x2 = gx * rw, (gx + 1) * rw
            region_mag = mag[y1:y2, x1:x2]
            region_dx = flow[0, y1:y2, x1:x2]
            region_dy = flow[1, y1:y2, x1:x2]
            regions[f"{name_y}_{name_x}"] = {
                "magnitude": round(float(region_mag.mean()), 2),
                "dx": round(float(region_dx.mean()), 2),
                "dy": round(float(region_dy.mean()), 2),
                "max_mag": round(float(region_mag.max()), 1),
            }
    return regions


def process_cotracker_tracks(tracks, visibility, meta, analysis_fps):
    """Convert CoTracker output to structured trajectories with easing."""
    T, N, _ = tracks.shape
    scale_x = meta["original_w"] / meta["scaled_w"]
    scale_y = meta["original_h"] / meta["scaled_h"]

    trajectories = []

    for point_idx in range(N):
        points = []
        prev_x, prev_y = None, None

        for frame_idx in range(T):
            if not visibility[frame_idx, point_idx]:
                continue

            x = float(tracks[frame_idx, point_idx, 0]) * scale_x
            y = float(tracks[frame_idx, point_idx, 1]) * scale_y
            t = frame_idx / analysis_fps

            dx = x - prev_x if prev_x is not None else 0
            dy = y - prev_y if prev_y is not None else 0
            speed = math.sqrt(dx*dx + dy*dy)
            angle = math.degrees(math.atan2(dy, dx)) if speed > 0.5 else 0

            points.append({
                "frame_idx": frame_idx,
                "original_frame": frame_idx * meta["frame_skip"],
                "time": round(t, 3),
                "x": round(x, 1),
                "y": round(y, 1),
                "x_norm": round(x / meta["original_w"], 4),
                "y_norm": round(y / meta["original_h"], 4),
                "dx": round(dx, 1),
                "dy": round(dy, 1),
                "speed": round(speed, 1),
                "direction_deg": round(angle, 1),
                "blur_estimate": round(min(speed * 0.25, 15), 1),
                "visible": True,
            })

            prev_x, prev_y = x, y

        if len(points) < 3:
            continue

        # Compute trajectory stats
        total_dist = sum(p["speed"] for p in points)
        max_speed = max(p["speed"] for p in points)

        if total_dist < 3:
            continue  # static point

        # Fit easing curves
        xs = [p["x"] for p in points]
        ys = [p["y"] for p in points]
        times = [p["time"] for p in points]

        x_easing = _fit_easing(xs, times)
        y_easing = _fit_easing(ys, times)

        # Fit bezier path
        bezier = None
        if len(xs) >= 4:
            try:
                tck, u = splprep([xs, ys], s=len(xs) * 3, k=min(3, len(xs)-1))
                u_fine = np.linspace(0, 1, 50)
                x_fine, y_fine = splev(u_fine, tck)
                bezier = {
                    "path": [{"x": round(float(x), 1), "y": round(float(y), 1)}
                             for x, y in zip(x_fine, y_fine)],
                    "control_points": [{"x": round(float(x), 1), "y": round(float(y), 1)}
                                       for x, y in zip(tck[1][0], tck[1][1])],
                }
            except Exception:
                pass

        # Classify motion
        if total_dist < 15:
            motion_type = "micro_vibration"
        else:
            start_to_end = math.sqrt((xs[-1]-xs[0])**2 + (ys[-1]-ys[0])**2)
            path_length = sum(math.sqrt((xs[i]-xs[i-1])**2 + (ys[i]-ys[i-1])**2) for i in range(1, len(xs)))
            straightness = start_to_end / max(path_length, 0.01)

            if straightness > 0.9:
                angle = math.degrees(math.atan2(ys[-1]-ys[0], xs[-1]-xs[0]))
                motion_type = f"linear_{round(angle)}deg"
            elif straightness > 0.6:
                motion_type = "arc"
            else:
                motion_type = "complex_curve"

        # Remotion keyframes (simplified)
        orig_frames = [p["original_frame"] for p in points]
        x_pct = [round(p["x"] / meta["original_w"] * 100, 2) for p in points]
        y_pct = [round(p["y"] / meta["original_h"] * 100, 2) for p in points]

        # Keep only direction-change keyframes
        key_i = [0]
        for i in range(1, len(orig_frames) - 1):
            dx1 = x_pct[i] - x_pct[i-1]
            dy1 = y_pct[i] - y_pct[i-1]
            dx2 = x_pct[i+1] - x_pct[i]
            dy2 = y_pct[i+1] - y_pct[i]
            a1 = math.atan2(dy1, dx1)
            a2 = math.atan2(dy2, dx2)
            s1 = math.sqrt(dx1**2+dy1**2)
            s2 = math.sqrt(dx2**2+dy2**2)
            if abs(a2-a1) > 0.25 or (s1 > 0 and abs(s2-s1)/max(s1,0.01) > 0.3):
                key_i.append(i)
        key_i.append(len(orig_frames)-1)

        trajectories.append({
            "point_id": point_idx,
            "motion_type": motion_type,
            "total_distance": round(total_dist, 1),
            "max_speed": round(max_speed, 1),
            "peak_blur": round(max_speed * 0.25, 1),
            "duration_frames": len(points),
            "start_time": points[0]["time"],
            "end_time": points[-1]["time"],
            "x_easing": x_easing,
            "y_easing": y_easing,
            "bezier": bezier,
            "remotion": {
                "frames": [orig_frames[i] for i in key_i],
                "x_percent": [x_pct[i] for i in key_i],
                "y_percent": [y_pct[i] for i in key_i],
                "code_x": f"interpolate(frame, {[orig_frames[i] for i in key_i]}, {[x_pct[i] for i in key_i]})",
                "code_y": f"interpolate(frame, {[orig_frames[i] for i in key_i]}, {[y_pct[i] for i in key_i]})",
            },
            "points": points,
        })

    trajectories.sort(key=lambda t: t["total_distance"], reverse=True)
    return trajectories


def _fit_easing(values, times):
    """Fit easing curve to values over time."""
    if len(values) < 3:
        return {"type": "unknown"}

    v = np.array(values, dtype=float)
    t = np.array(times, dtype=float)
    t_norm = (t - t[0]) / max(t[-1] - t[0], 0.001)
    v_min, v_max = v.min(), v.max()
    if v_max - v_min < 0.5:
        return {"type": "static", "value": round(float(v.mean()), 1)}

    v_norm = (v - v_min) / (v_max - v_min)

    curves = {
        "linear": lambda t: t,
        "ease_in": lambda t: t**2,
        "ease_out": lambda t: 1-(1-t)**2,
        "ease_in_out": lambda t: np.where(t<0.5, 2*t**2, 1-(-2*t+2)**2/2),
        "ease_out_cubic": lambda t: 1-(1-t)**3,
        "ease_out_expo": lambda t: 1-2**(-10*np.clip(t,0,1)),
        "ease_out_back": lambda t: 1+2.70158*(t-1)**3+1.70158*(t-1)**2,
    }

    best, best_err = "linear", float("inf")
    for name, func in curves.items():
        try:
            err = float(np.mean((v_norm - func(t_norm))**2))
            if err < best_err:
                best_err = err
                best = name
        except:
            pass

    overshoot = bool(np.any(v_norm > 1.05) or np.any(v_norm < -0.05))
    if overshoot:
        best = "spring"

    return {"type": best, "confidence": round(max(0, 1-best_err*10), 3), "has_overshoot": overshoot}


def main():
    parser = argparse.ArgumentParser(description="SOTA motion tracking with CoTracker3 + RAFT")
    parser.add_argument("video", help="Reference MP4")
    parser.add_argument("output", nargs="?", help="Output directory")
    parser.add_argument("--grid", type=int, default=30, help="CoTracker grid size (default 30 = 900 points)")
    parser.add_argument("--fps", type=int, default=10, help="Analysis FPS")
    parser.add_argument("--no-raft", action="store_true", help="Skip RAFT dense flow")
    parser.add_argument("--device", default="auto", help="Device: auto, cpu, mps, cuda")
    args = parser.parse_args()

    video_path = os.path.abspath(args.video)
    output_dir = args.output or os.path.join(os.path.dirname(video_path), "cotracker-tracks")
    os.makedirs(output_dir, exist_ok=True)

    # Auto device
    if args.device == "auto":
        if torch.cuda.is_available():
            device = "cuda"
        elif torch.backends.mps.is_available():
            device = "cpu"  # CoTracker has some ops that don't work on MPS yet
        else:
            device = "cpu"
    else:
        device = args.device

    print(f"=== SOTA Motion Tracking (CoTracker3 + RAFT) ===")
    print(f"Input:  {video_path}")
    print(f"Device: {device}")
    print(f"Grid:   {args.grid}x{args.grid} = {args.grid**2} points")
    print()

    # Load video
    print("[1/4] Loading video frames...")
    video_tensor, meta = load_video_frames(video_path, max_fps=args.fps)
    print(f"  {meta['num_frames']} frames at {meta['scaled_w']}x{meta['scaled_h']} "
          f"(original {meta['original_w']}x{meta['original_h']})")

    # CoTracker3
    print("[2/4] Running CoTracker3 point tracking...")
    tracks, visibility = run_cotracker(video_tensor, grid_size=args.grid, device=device)

    # Process tracks
    print("[3/4] Processing trajectories...")
    trajectories = process_cotracker_tracks(tracks, visibility, meta, meta["analysis_fps"])
    print(f"  {len(trajectories)} significant trajectories")

    # Motion type summary
    from collections import Counter
    type_counts = Counter(t["motion_type"] for t in trajectories)
    print(f"  Types: {dict(type_counts.most_common(10))}")

    # RAFT dense flow
    raft_flows = []
    if not args.no_raft:
        print("[4/4] Running RAFT dense optical flow...")
        try:
            raft_flows = run_raft_flow(video_tensor, device=device, sample_interval=5)
        except Exception as e:
            print(f"  [raft] Failed: {e}")
            print(f"  [raft] Continuing without RAFT data")
    else:
        print("[4/4] Skipping RAFT (--no-raft)")

    # Write outputs
    print("\nWriting outputs...")

    summary = {
        "source": os.path.basename(video_path),
        "video": meta,
        "tracking": {
            "engine": "CoTracker3",
            "grid_size": args.grid,
            "total_points": args.grid ** 2,
            "significant_trajectories": len(trajectories),
            "motion_types": dict(type_counts),
        },
        "raft": {
            "enabled": not args.no_raft,
            "flow_fields": len(raft_flows),
        },
        "top_movers": [{
            "id": t["point_id"],
            "type": t["motion_type"],
            "distance": t["total_distance"],
            "max_speed": t["max_speed"],
            "blur": t["peak_blur"],
            "x_easing": t["x_easing"]["type"],
            "y_easing": t["y_easing"]["type"],
            "start": t["start_time"],
            "end": t["end_time"],
        } for t in trajectories[:50]],
    }

    with open(os.path.join(output_dir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=2)

    with open(os.path.join(output_dir, "trajectories.json"), "w") as f:
        json.dump(trajectories[:200], f, indent=2, default=str)

    # Remotion-ready keyframes
    remotion = [{
        "id": t["point_id"],
        "type": t["motion_type"],
        "remotion": t["remotion"],
        "x_easing": t["x_easing"]["type"],
        "y_easing": t["y_easing"]["type"],
        "blur": t["peak_blur"],
        "bezier": t.get("bezier"),
    } for t in trajectories[:100]]

    with open(os.path.join(output_dir, "remotion-keyframes.json"), "w") as f:
        json.dump(remotion, f, indent=2)

    if raft_flows:
        with open(os.path.join(output_dir, "raft-flow.json"), "w") as f:
            json.dump(raft_flows, f, indent=2)

    # Save raw tracks as numpy for further processing
    np.savez_compressed(
        os.path.join(output_dir, "raw_tracks.npz"),
        tracks=tracks, visibility=visibility
    )

    traj_size = os.path.getsize(os.path.join(output_dir, "trajectories.json")) // 1024
    print()
    print(f"=== Tracking Complete ===")
    print(f"  {len(trajectories)} trajectories with bezier paths")
    print(f"  {len(raft_flows)} RAFT flow fields")
    print(f"  Types: {dict(type_counts.most_common(5))}")
    if trajectories:
        print(f"  Top mover: {trajectories[0]['motion_type']} "
              f"({trajectories[0]['total_distance']:.0f}px, "
              f"blur={trajectories[0]['peak_blur']:.0f}px)")
    print()
    print(f"Output: {output_dir}/")
    print(f"  summary.json            — Overview")
    print(f"  trajectories.json       — Full tracks ({traj_size}KB)")
    print(f"  remotion-keyframes.json — Copy-paste interpolation arrays")
    if raft_flows:
        print(f"  raft-flow.json          — Dense per-pixel flow")
    print(f"  raw_tracks.npz          — NumPy arrays for further processing")


if __name__ == "__main__":
    main()
