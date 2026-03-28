#!/usr/bin/env python3
"""
scene-interpret.py — AI scene interpretation layer

Takes extracted frames from a video and uses Claude to understand:
  - What is the INTENT of each scene? (introduce brand, show product, build trust)
  - What EMOTION does the motion convey? (confidence, playfulness, urgency)
  - What TECHNIQUES are used? (kinetic typography, parallax, particle system)
  - What is the RHYTHM? (build-up, climax, resolution)
  - What TRANSITIONS connect scenes? (shockwave, dissolve, wipe)
  - What makes this animation feel PREMIUM? (timing, easing, overlap)

This gives agents CONTEXT — not just "move text to position X" but
"this text enters with authority to establish the brand."

Usage:
  python3 scripts/scene-interpret.py <analysis-dir> [--output interpretation.json]

Requires: frames already extracted by analyze-reference.sh
"""

import argparse
import json
import os
import sys
import base64
from pathlib import Path


def encode_image(path):
    """Encode image to base64 for API consumption."""
    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8")


def build_scene_interpretation_prompt(scene_idx, frame_paths, analysis_data=None):
    """Build prompt for interpreting a scene's intent and technique."""

    scene_info = ""
    if analysis_data:
        scenes = analysis_data.get("per_scene_summary", [])
        if scene_idx - 1 < len(scenes):
            s = scenes[scene_idx - 1]
            scene_info = f"""
Scene {scene_idx} metadata:
- Time: {s.get('start', '?')}s to {s.get('end', '?')}s ({s.get('duration', '?')}s)
- Dominant color: {s.get('dominant_color', '?')}
- Has text: {s.get('has_text', '?')}
- Text content: {', '.join(s.get('text_content', [])[:10])}
- Has 3D perspective: {s.get('has_3d_perspective', False)}
- Has phone mockup: {s.get('has_phone_mockup', False)}
- Dominant motion: {s.get('dominant_motion', '?')}
"""

    return f"""You are a motion design expert analyzing a video scene for replication.

Look at these {len(frame_paths)} frames from Scene {scene_idx} and describe:

{scene_info}

## 1. INTENT
What is this scene TRYING TO DO? What message is it conveying?
(e.g., "introduce the product name with authority", "show the app in action to build desire", "create emotional climax before CTA")

## 2. EMOTION / ENERGY
What FEELING does the motion convey?
- Pace: slow/medium/fast/frantic
- Energy: calm/building/explosive/settling
- Mood: confident/playful/urgent/elegant/dramatic
- Weight: light/heavy/floating/grounded

## 3. MOTION TECHNIQUES
What specific animation techniques are visible?
For each technique, describe:
- What element uses it
- The motion path (straight, arc, spiral, scatter)
- The timing (instant, gradual, staggered)
- The easing feel (snappy, bouncy, smooth, elastic)

Examples: kinetic typography, parallax layers, particle system, 3D rotation, morphing, scale reveal, stagger cascade, shockwave, liquid motion, glitch, etc.

## 4. COMPOSITION STRATEGY
- Where do eyes go first? (visual hierarchy)
- How does the scene USE space? (centered, offset, full-bleed, floating)
- What creates depth? (scale, blur, overlap, perspective, shadow)

## 5. TRANSITIONS
- How does this scene START? (cut, fade, wipe, morph from previous)
- How does it END? (cut, dissolve, element carries into next scene)
- Any IN-SCENE transitions between sub-segments?

## 6. TIMING NOTES
- What is the tempo? (cuts per second, how long elements hold)
- Where are the "beats"? (moments of impact, reveals, settles)
- Any syncopation? (elements arriving off-beat for surprise)

## 7. WHAT MAKES IT PREMIUM
- What separates this from generic motion graphics?
- What subtle details add polish? (secondary motion, overshoot, micro-interactions)
- What would look WRONG if an AI generated it without understanding?

## 8. REMOTION IMPLEMENTATION NOTES
For a developer replicating this in Remotion (React-based video framework):
- What components/libraries are needed?
- What's the trickiest part to replicate?
- Any effects that need special treatment (3D, shaders, blur)?

Output as structured JSON with these 8 sections.
"""


def interpret_with_frames(scene_idx, frame_paths, analysis_data=None):
    """
    Build interpretation data for a scene using frame analysis.
    Since we can't call Claude API directly, we prepare the prompt + frames
    for the agent to process.
    """
    prompt = build_scene_interpretation_prompt(scene_idx, frame_paths, analysis_data)

    # Prepare frame data
    frames_info = []
    for fp in frame_paths:
        frames_info.append({
            "path": fp,
            "filename": os.path.basename(fp),
            "base64": encode_image(fp) if os.path.getsize(fp) < 500000 else None,  # skip large files
        })

    return {
        "scene": scene_idx,
        "num_frames": len(frame_paths),
        "prompt": prompt,
        "frame_paths": [fp for fp in frame_paths],
    }


def main():
    parser = argparse.ArgumentParser(description="AI scene interpretation")
    parser.add_argument("analysis_dir", help="Directory with analysis.json and scene_frames/")
    parser.add_argument("--output", default=None, help="Output JSON path")
    parser.add_argument("--deep", default=None, help="Path to deep analysis summary.json")
    args = parser.parse_args()

    analysis_dir = os.path.abspath(args.analysis_dir)

    # Load analysis
    analysis_path = os.path.join(analysis_dir, "analysis.json")
    deep_path = args.deep
    analysis_data = None
    deep_data = None

    if os.path.exists(analysis_path):
        analysis_data = json.load(open(analysis_path))
    if deep_path and os.path.exists(deep_path):
        deep_data = json.load(open(deep_path))

    # Find scene frame directories
    scene_frames_dir = os.path.join(analysis_dir, "scene_frames")
    if not os.path.exists(scene_frames_dir):
        print(f"No scene_frames/ in {analysis_dir}")
        sys.exit(1)

    scene_dirs = sorted([d for d in os.listdir(scene_frames_dir) if d.startswith("scene_")])

    print(f"=== Scene Interpretation ===")
    print(f"  {len(scene_dirs)} scenes found")
    print()

    interpretations = []

    for scene_dir in scene_dirs:
        scene_idx = int(scene_dir.split("_")[1])
        frames_path = os.path.join(scene_frames_dir, scene_dir)
        frame_files = sorted([
            os.path.join(frames_path, f) for f in os.listdir(frames_path)
            if f.endswith(".png")
        ])

        if not frame_files:
            continue

        print(f"  Scene {scene_idx}: {len(frame_files)} frames")

        interp = interpret_with_frames(
            scene_idx,
            frame_files,
            deep_data,
        )
        interpretations.append(interp)

    # Write output — this is a PROMPT FILE for agents to process
    output_path = args.output or os.path.join(analysis_dir, "scene-interpretations.json")
    with open(output_path, "w") as f:
        json.dump({
            "description": "Scene interpretation prompts. Feed each scene's prompt + frame_paths to a multimodal agent.",
            "usage": "For each scene, have an agent READ all frame_paths (they're PNGs), then answer the prompt. Save the response as the scene's interpretation.",
            "scenes": interpretations,
        }, f, indent=2)

    print()
    print(f"Output: {output_path}")
    print(f"  {len(interpretations)} scene interpretation prompts ready")
    print()
    print("NEXT STEP: Feed each scene's prompt + frames to a multimodal agent.")
    print("The agent reads the frames visually and answers the interpretation questions.")
    print("Save responses to: {analysis_dir}/scene-NN-interpretation.json")


if __name__ == "__main__":
    main()
