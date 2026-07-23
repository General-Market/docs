#!/usr/bin/env python3
"""
Bake final.mp4 = cut segments (1.2× speed) with a 1.5s title card inserted
before each of the 13 exploits.

Segments come from cuts.json (sped up via setpts/atempo). Cards come from
/tmp/title-cards/*.mp4 (already 1.5s, NOT sped up). A card is inserted
before the first kept segment whose source start >= the card's trigger.
"""
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

REPO   = Path("/Users/maxguillabert/Downloads/index/video")
PUBLIC = REPO / "public/anticheat-edit"
COMP   = REPO / "src/compositions/anticheat-edit"
SOURCE = PUBLIC / "source.mp4"
CUTS   = COMP / "cuts.json"
OUT    = PUBLIC / "final.mp4"
META   = COMP / "final.meta.json"
CARDS  = json.load(open("/tmp/title-cards/cards.json"))["cards"]
RATE   = 1.2


def main():
    segs = json.load(open(CUTS))["segments"]
    # CARDLESS bake: the title cards are now Remotion overlays (per request),
    # NOT burned into the mp4. Leave card_before empty.
    card_before = {}   # seg_index -> card clip (intentionally empty)

    with tempfile.TemporaryDirectory(prefix="anticheat-cards-") as td:
        td = Path(td)
        listf = td / "list.txt"
        n_clip = 0
        with open(listf, "w") as lf:
            for i, seg in enumerate(segs):
                # Insert any cards that go before this segment.
                for card in card_before.get(i, []):
                    lf.write(f"file '{card['clip']}'\n")
                start = float(seg["start"]); end = float(seg["end"])
                dur = end - start
                if dur <= 1.0 / 60.0:
                    continue
                clip = td / f"seg-{i:05d}.mp4"
                # -ss AND -t BEFORE -i: both are INPUT options, so ffmpeg reads
                # exactly [start, start+dur] of source. setpts/atempo then speed
                # that fixed chunk to dur/RATE. (With -t AFTER -i it caps OUTPUT
                # duration and silently reads extra source — no speedup + bleed.)
                cmd = (
                    f'ffmpeg -y -hide_banner -loglevel error '
                    f'-ss {start:.3f} -t {dur:.3f} -i "{SOURCE}" '
                    f'-vf "setpts=PTS/{RATE},fps=30,scale=1920:1080" '
                    f'-af "atempo={RATE}" '
                    f'-c:v libx264 -crf 20 -preset veryfast -pix_fmt yuv420p '
                    f'-c:a aac -b:a 192k -movflags +faststart "{clip}"'
                )
                subprocess.run(cmd, shell=True, check=True)
                lf.write(f"file '{clip}'\n")
                n_clip += 1
                if (i + 1) % 25 == 0 or i == len(segs) - 1:
                    print(f"  {i+1}/{len(segs)} segments encoded", flush=True)

        # Concat. Cards and segments share codec params (h264/yuv420p/30fps/aac),
        # so concat -c copy is safe.
        tmp_out = td / "concat.mp4"
        subprocess.run(
            f'ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 '
            f'-i "{listf}" -c copy -movflags +faststart "{tmp_out}"',
            shell=True, check=True)
        PUBLIC.mkdir(parents=True, exist_ok=True)
        shutil.move(str(tmp_out), str(OUT))

    dur_s = float(subprocess.check_output(
        f'ffprobe -v error -show_entries format=duration '
        f'-of default=noprint_wrappers=1:nokey=1 "{OUT}"', shell=True).decode().strip())
    META.write_text(json.dumps({
        "duration_seconds": round(dur_s, 3),
        "source_segments": len(segs),
        "title_cards": 0,  # cardless — cards are Remotion overlays
        "playback_rate": RATE,
    }, indent=2) + "\n")
    print(f"\ndone. final.mp4 = {dur_s:.1f}s ({dur_s/60:.1f} min), {len(segs)} segments (cardless)")
    print(f"-> {OUT}")


if __name__ == "__main__":
    main()
