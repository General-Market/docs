# broll-cut — clean b-roll extraction from vague timestamps

You watch a source video and jot down rough marks: *"0:19 to 0:21 orderbook,
1:39 to 1:40 NYC."* This toolkit turns those into clips cut to the exact frame,
on the editor's real hard cuts, with both edges proven clean.

The principle: in an interview edit, every b-roll insert begins and ends on a
hard cut. Detect the cuts once, snap the vague marks to them, then verify by
*looking at the frames* — never by trusting a timestamp.

## The loop

```
detect_cuts ──► prep ──► [read montage, pin frame] ──► extract ──► [read edge-verify] ──► INDEX
   (once)     (per spec)        (agent/you)          (per clip)        (agent/you)       (manual)
```

1. **prep** runs detection, snaps each vague range to the nearest real cuts, and
   renders one labelled montage per clip. It prints a ready-to-run `extract`
   command per clip.
2. **You or an agent read each montage.** Tiles are labelled with frame index
   and absolute source timestamp. Find the first tile of the insert (IN) and the
   last (OUT). Correct the printed `--in/--out` to those times.
3. **extract** cuts the clip frame-accurate, keeps audio, and writes an
   edge-verify montage (`.verify/<name>.png`) beside it.
4. **Read the edge-verify.** First two and last two frames must *all* be the
   intended shot. If the first frame shows the previous shot, bump `--in` by one
   frame-step (`1/fps`) and re-run.

## Quick start

```bash
cd video/scripts/broll-cut

# 1. write a spec — one line per clip, your own rough marks
cat > /tmp/spec.txt <<'EOF'
0:19 to 0:21  orderbook zoomed
1:39 to 1:40  NYC skyline
8:30 to 8:35  traffic fast timelapse
EOF

# 2. prep: detect cuts, snap, render montages, print extract commands
python3 prep.py "/path/to/source.mp4" /tmp/spec.txt \
    --workdir /tmp/broll/<name> \
    --out-dir ../../public/broll/<source-slug>

# 3. read /tmp/broll/<name>/montages/NN_<slug>.png, then per clip:
python3 extract.py "/path/to/source.mp4" --in 19.55 --out 22.66 \
    --name orderbook-zoom --dir ../../public/broll/<source-slug>

# 4. read ../../public/broll/<source-slug>/.verify/<name>.png — confirm clean edges
```

Spec format: `M:SS to M:SS  description` (also accepts `H:MM:SS`, `-`/`→`
separators). Blank lines and `#` comments ignored. The description becomes the
kebab-case filename; duplicates get `-2`, `-3`.

## The scripts

| Script | Does |
|---|---|
| `detect_cuts.py` | Full-video scene detection → `cuts.json` (`{t, score}` per cut). Downscaled for speed; times stay source-accurate. |
| `prep.py` | Parse spec → snap to cuts → render a montage per clip → `worklist.json` + extract commands. Caches `cuts.json`. |
| `montage.py` | Labelled window montage (the artifact you read). Also `edge_verify()`. |
| `extract.py` | Frame-accurate cut-to-cut extract (libx264 crf18, audio kept, faststart) + auto edge-verify. |
| `_util.py` | probe / timestamp parse+format / slug / run helpers. |

Run any script with `-h` for its flags. Useful ones:
`prep --tol` (max snap distance to a cut), `--pad/--tail` (montage lead in/out),
`--force` (re-detect); `extract --accurate` (output-seek, exact but slow for
late clips), `--no-audio`, `--no-verify`.

## Gotchas this toolkit is built around

- **This ffmpeg has no freetype.** `drawtext` is unavailable; ImageMagick lacks
  it too. Labels are burned with Pillow. Don't "simplify" back to `drawtext`.
- **Input-seek can leak one neighbour frame at the head.** `extract` uses fast
  input-seek (`-ss` before `-i`); it's near-exact but a shared-cut boundary can
  bleed one previous-shot frame in. That is exactly what edge-verify catches —
  bump `--in` one frame-step, or pass `--accurate`.
- **The tail.** `extract` adds half a frame-step to the duration so the frame at
  `--out` is included and the next one is not. Pass `--out` as the *last frame
  you want to keep*.
- **OUT must come after IN.** `prep` snaps the out boundary only to cuts later
  than the in boundary, so a nearby in-cut can't swallow the clip.
- **A `⚠ no nearby cut` flag** means no cut sits within `--tol` of your mark —
  widen `--tol` or eyeball the montage; the mark was kept as-is.

## Many clips at once → parallel agents

For a long list, dispatch one agent per 3–4 clips. Give each: the source path,
the output dir, and its rows from the `worklist.json` (slug, snapped in/out,
montage path). Each agent reads its montages, pins frames, runs `extract`, reads
its edge-verify montages, and reports verified in/out + a one-line content
check. Aggregate, then write the INDEX entry yourself. Tell agents **not** to
commit — `public/` is gitignored, and the index lives there too.

## Where clips land, and INDEX

Clips go in `video/public/broll/<source-slug>/`. **`video/public/` is gitignored
by design** (the b-roll pool is ~600 MB of local-only media) — there is nothing
to commit for the clips themselves. Document each new folder in
`video/public/broll/INDEX.md`: a table of `filename | source range | duration |
content`. Load in Remotion with `staticFile('broll/<source-slug>/<name>.mp4')`.
