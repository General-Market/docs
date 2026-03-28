#!/usr/bin/env python3
"""
track-to-gsap.py — Convert motion tracking data to GSAP-ready format

Takes v3 tracker output and converts to:
  1. GSAP MotionPath arrays (for MotionPathPlugin)
  2. GSAP timeline positions (for .to()/.from() calls)
  3. GSAP SplitText-compatible text data
  4. GSAP easing strings (not Remotion easing names)

Usage:
  python3 scripts/track-to-gsap.py <tracks-dir> [output-file]
"""

import argparse
import json
import os
import sys

# Map our easing names to GSAP easing strings
EASING_MAP = {
    "linear": "none",
    "ease_in": "power2.in",
    "ease_out": "power2.out",
    "ease_in_out": "power2.inOut",
    "ease_out_cubic": "power3.out",
    "ease_out_expo": "expo.out",
    "spring": "back.out(1.7)",
    "spring_overshoot": "back.out(2.5)",
    "ease_out_back": "back.out(1.7)",
    "static": "none",
    "unknown": "power1.out",
}


def convert_text_tracks(text_tracks):
    """Convert text tracking data to GSAP timeline entries."""
    gsap_entries = []

    for word, data in text_tracks.items():
        positions = data.get("positions", [])
        if len(positions) < 2:
            continue

        # Entry animation (first appearance)
        first = positions[0]
        settled = positions[min(3, len(positions)-1)]  # position after a few frames

        # Compute entry animation
        entry_dx = settled["cx"] - first["cx"]
        entry_dy = settled["cy"] - first["cy"]

        x_ease = data.get("x_easing", {}).get("type", "unknown")
        y_ease = data.get("y_easing", {}).get("type", "unknown")

        # Check for rotation
        angles = [p.get("angle_deg", 0) for p in positions]
        has_rotation = max(angles) - min(angles) > 2 if angles else False
        angle_range = data.get("angle_range", [0, 0])

        # Build GSAP .from() entry
        gsap_from = {}
        if abs(entry_dy) > 5:
            gsap_from["y"] = -entry_dy
        if abs(entry_dx) > 5:
            gsap_from["x"] = -entry_dx
        gsap_from["opacity"] = 0
        if has_rotation:
            gsap_from["rotation"] = angle_range[0]

        # Size changes
        sizes = data.get("size_range", [0, 0])
        if sizes[0] > 0 and sizes[1] > 0 and sizes[1] / sizes[0] > 1.2:
            gsap_from["scale"] = sizes[0] / sizes[1]

        gsap_entry = {
            "word": word,
            "time": first["time"],
            "end_time": positions[-1]["time"],
            "gsap_from": gsap_from,
            "gsap_to": {
                "opacity": 1,
                "x": 0,
                "y": 0,
                "rotation": angle_range[1] if has_rotation else 0,
                "scale": 1,
            },
            "duration": round(min(0.6, (positions[-1]["time"] - first["time"]) / 2), 2),
            "ease": EASING_MAP.get(x_ease, "power1.out"),
            "has_rotation": has_rotation,
            "angle_range": angle_range,
            "position": {
                "cx_norm": settled.get("cx_norm", 0.5),
                "cy_norm": settled.get("cy_norm", 0.5),
            },
        }

        # Build MotionPath if we have bezier data
        bezier = data.get("bezier")
        if bezier and bezier.get("path"):
            gsap_entry["motionPath"] = {
                "path": bezier["path"],
                "curviness": 1.5,
                "autoRotate": has_rotation,
            }

        gsap_entries.append(gsap_entry)

    # Sort by time
    gsap_entries.sort(key=lambda e: e["time"])
    return gsap_entries


def convert_trajectories(trajectories):
    """Convert shape trajectories to GSAP MotionPath format."""
    gsap_paths = []

    for traj in trajectories:
        if not traj.get("bezier"):
            continue

        path = traj["bezier"].get("path", [])
        if len(path) < 3:
            continue

        x_ease = traj.get("x_easing", {}).get("type", "unknown")
        y_ease = traj.get("y_easing", {}).get("type", "unknown")

        gsap_paths.append({
            "id": traj.get("point_id", traj.get("id")),
            "motion_type": traj.get("motion_type", "unknown"),
            "motionPath": {
                "path": path,
                "curviness": 1.25,
                "autoRotate": traj.get("angle_range", 0) > 10,
            },
            "duration": round(traj.get("end_time", 1) - traj.get("start_time", 0), 2),
            "start_time": traj.get("start_time", 0),
            "ease": EASING_MAP.get(x_ease, "power1.out"),
            "peak_blur": traj.get("peak_blur", 0),
            "scale_range": traj.get("scale_range", 0),
        })

    return gsap_paths


def generate_gsap_code(text_entries, shape_paths):
    """Generate paste-ready GSAP timeline code."""
    lines = [
        "// Auto-generated GSAP timeline from motion tracking data",
        "// Paste inside useEffect() after useGsapTimeline()",
        "",
        "import { useGsapTimeline } from '../../lib/useGsapTimeline';",
        "",
        "const { tl, containerRef } = useGsapTimeline();",
        "",
        "useEffect(() => {",
        "  if (!containerRef.current) return;",
        "  const timeline = tl.current;",
        "",
    ]

    # Text animations
    for entry in text_entries[:30]:
        word_safe = entry["word"].replace("'", "\\'")
        from_props = json.dumps(entry["gsap_from"], indent=None)
        duration = entry["duration"]
        ease = entry["ease"]
        time = entry["time"]

        if entry.get("motionPath"):
            lines.append(f"  // '{word_safe}' at {time}s — follows bezier path")
            lines.append(f"  timeline.from('.word-{word_safe}', {{")
            lines.append(f"    ...{from_props},")
            lines.append(f"    motionPath: {{ path: {json.dumps(entry['motionPath']['path'][:10])}, curviness: 1.5 }},")
            lines.append(f"    duration: {duration}, ease: '{ease}'")
            lines.append(f"  }}, {time});")
        else:
            lines.append(f"  // '{word_safe}' at {time}s")
            lines.append(f"  timeline.from('.word-{word_safe}', {from_props}, {{ duration: {duration}, ease: '{ease}' }}, {time});")
        lines.append("")

    lines.append("}, []);")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Convert tracking data to GSAP format")
    parser.add_argument("tracks_dir", help="Directory with v3 tracker output")
    parser.add_argument("output", nargs="?", help="Output JSON file")
    args = parser.parse_args()

    tracks_dir = os.path.abspath(args.tracks_dir)
    output_path = args.output or os.path.join(tracks_dir, "gsap-timeline.json")

    # Load text tracks
    text_path = os.path.join(tracks_dir, "text-tracks.json")
    text_tracks = {}
    if os.path.exists(text_path):
        text_tracks = json.load(open(text_path))
        print(f"  Loaded {len(text_tracks)} text tracks")

    # Load shape trajectories
    traj_path = os.path.join(tracks_dir, "trajectories.json")
    trajectories = []
    if os.path.exists(traj_path):
        trajectories = json.load(open(traj_path))
        print(f"  Loaded {len(trajectories)} shape trajectories")

    # Convert
    text_entries = convert_text_tracks(text_tracks)
    shape_paths = convert_trajectories(trajectories)

    # Generate code
    code = generate_gsap_code(text_entries, shape_paths)

    # Output
    output = {
        "description": "GSAP-ready animation data from motion tracking",
        "text_animations": text_entries,
        "motion_paths": shape_paths,
        "easing_map": EASING_MAP,
        "gsap_code": code,
        "usage": "Import useGsapTimeline hook, paste the timeline code in useEffect",
    }

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    # Also write the code to a .ts file
    code_path = os.path.join(tracks_dir, "gsap-timeline-code.ts")
    with open(code_path, "w") as f:
        f.write(code)

    print(f"\n  {len(text_entries)} text animations converted to GSAP .from() calls")
    print(f"  {len(shape_paths)} shape trajectories converted to MotionPath")
    print(f"  Output: {output_path}")
    print(f"  Code: {code_path}")


if __name__ == "__main__":
    main()
