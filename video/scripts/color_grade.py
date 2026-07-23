#!/usr/bin/env python3
"""Apply a reusable color grade to video using FFmpeg.

The color sibling of voice_effects.py: a grade is a named chain of FFmpeg
video filters. Define it once, apply it to any video. Each preset is tuned
for a kind of footage, not a single clip.

  python3 color_grade.py <preset> <input.mp4> [output.mp4]
  python3 color_grade.py --make-lut <preset> [output.png]   # bake to portable CLUT
  python3 color_grade.py --lut <clut.png> <input.mp4> [output.mp4]
"""
import subprocess
import sys

# Each preset is an ordered list of FFmpeg video filters. They run in order,
# the way a Pedalboard chain runs effects in order.
PRESETS = {
    # The default look for talking-head camera footage: warm white balance,
    # a gentle filmic S-curve, a touch of vibrance, a soft vignette to pull
    # the eye to the face, and light sharpening to recover camera softness.
    "talking-head-warm": [
        "colortemperature=temperature=5500:mix=0.45",
        "curves=all='0/0.02 0.25/0.215 0.5/0.5 0.75/0.79 1/0.985'",
        "eq=saturation=1.10:gamma=0.99",
        "vignette=angle=PI/5",
        "unsharp=5:5:0.5:5:5:0.0",
    ],
    # Minimal correction — contrast and crispness only, no color shift.
    "clean": [
        "curves=all='0/0.01 0.5/0.5 1/0.99'",
        "eq=contrast=1.04:saturation=1.04",
        "unsharp=5:5:0.4:5:5:0.0",
    ],
    # Warm highlights, cool shadows — the standard cinematic split tone.
    "cinematic-teal-orange": [
        "curves=b='0/0.06 0.5/0.5 1/0.92':g='0/0.0 0.5/0.5 1/0.99'",
        "colortemperature=temperature=5200:mix=0.5",
        "eq=contrast=1.08:saturation=1.06",
        "vignette=angle=PI/4.5",
        "unsharp=5:5:0.5:5:5:0.0",
    ],
    # Cooler, crisp, slightly desaturated — for product and tech footage.
    "cool-tech": [
        "colortemperature=temperature=7200:mix=0.4",
        "curves=all='0/0.015 0.5/0.5 1/0.99'",
        "eq=contrast=1.07:saturation=0.96",
        "unsharp=5:5:0.6:5:5:0.0",
    ],
}


# Filters that depend on a pixel's position or its neighbours. They cannot be
# frozen into a Hald CLUT (which is a pure per-pixel colour map) — baking one in
# warps the colour grid. They are applied alongside a CLUT, never inside it.
SPATIAL_FILTERS = ("vignette", "unsharp", "gblur", "boxblur", "convolution", "noise")


def _is_spatial(f):
    name = f.split("=", 1)[0]
    return name in SPATIAL_FILTERS


def vf(preset_name):
    return ",".join(PRESETS[preset_name])


def color_only(preset_name):
    """The CLUT-safe (per-pixel) filters of a preset."""
    return ",".join(f for f in PRESETS[preset_name] if not _is_spatial(f))


def spatial_only(preset_name):
    """The position/neighbour filters of a preset, to apply outside a CLUT."""
    return [f for f in PRESETS[preset_name] if _is_spatial(f)]


def run(cmd):
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, check=True)


def grade_video(vf_chain, input_file, output_file, crf=18):
    """Re-encode input through a filter chain, copying audio untouched."""
    run([
        "ffmpeg", "-y", "-i", input_file,
        "-vf", vf_chain,
        "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        output_file,
    ])


def apply_clut(clut_file, input_file, output_file, crf=18):
    run([
        "ffmpeg", "-y", "-i", input_file, "-i", clut_file,
        "-filter_complex", "[0][1]haldclut",
        "-c:v", "libx264", "-preset", "medium", "-crf", str(crf),
        "-pix_fmt", "yuv420p",
        "-c:a", "copy",
        "-movflags", "+faststart",
        output_file,
    ])


def make_lut(preset_name, output_file, level=8):
    """Bake a preset into a portable Hald CLUT PNG.

    The CLUT freezes the look into a single image. Apply it to any future
    video in one filter (haldclut) — or import it into DaVinci/Premiere —
    and get the identical grade without re-deriving the chain. Only the
    colour filters are baked; spatial ones (vignette, sharpen) are listed
    so you can add them alongside the CLUT.
    """
    run([
        "ffmpeg", "-y", "-f", "lavfi", "-i", f"haldclutsrc={level}",
        "-vf", color_only(preset_name), "-frames:v", "1", output_file,
    ])
    print(f"Baked '{preset_name}' -> {output_file}")
    dropped = spatial_only(preset_name)
    if dropped:
        print(f"Apply alongside the CLUT (not bakeable): {', '.join(dropped)}")


def usage():
    print(__doc__)
    print(f"Presets: {', '.join(PRESETS.keys())}")
    sys.exit(1)


def main():
    args = sys.argv[1:]
    if not args:
        usage()

    if args[0] == "--make-lut":
        if len(args) < 2 or args[1] not in PRESETS:
            usage()
        preset = args[1]
        out = args[2] if len(args) > 2 else f"{preset}.clut.png"
        make_lut(preset, out)
        return

    if args[0] == "--lut":
        if len(args) < 3:
            usage()
        clut, input_file = args[1], args[2]
        out = args[3] if len(args) > 3 else f"graded-{input_file}"
        apply_clut(clut, input_file, out)
        print(f"Applied CLUT '{clut}' -> {out}")
        return

    preset = args[0]
    if preset not in PRESETS or len(args) < 2:
        usage()
    input_file = args[1]
    out = args[2] if len(args) > 2 else f"{preset}-{input_file}"
    grade_video(vf(preset), input_file, out)
    print(f"Applied '{preset}' -> {out}")


if __name__ == "__main__":
    main()
