#!/bin/bash
# Batch-trace all CLSNet art assets from reference frames.
set -e
cd "$(dirname "$0")"
F=ref-analysis/frames
T() { python3 trace.py "$@" --out art-store.json; }

# Line-phase city clusters (t=12.0)
T $F/regular_0025.png 280 77 460 145 rowBank
T $F/regular_0025.png 575 253 420 210 rowOffice
T $F/regular_0025.png 850 500 560 265 rowTowers
T $F/regular_0025.png 1100 800 760 235 rowSail

# Big two-city versions (t=41.0) — A top, B bottom
T $F/regular_0083.png 335 105 1150 295 cityA
T $F/regular_0083.png 420 455 1190 545 cityB

# World map white outline on blue (t=23.0)
T $F/regular_0047.png 150 60 1650 960 worldMap --colors "#FFFFFF"

# Globe rotation states (settled f487.5/f537.5) — gen-8 re-trace: white
# continents ONLY, tight disc crop (668,250,586 = 2*GLOBE.r), disc-centred.
# The old 720-crop + navy baked the white background + border ring, which
# rendered as the swoosh arc + disc-spill defect (r6 gap 6).
T $F/regular_0040.png 668 250 586 586 globeA --colors "#FFFFFF"
T $F/regular_0044.png 668 250 586 586 globeB --colors "#FFFFFF"

# Lock states (open t=19.5, list t=20.5, closed t=21.5)
T $F/regular_0040.png 1430 280 260 380 lockOpen
T $F/regular_0042.png 1430 280 260 380 lockList
T $F/regular_0044.png 1430 280 260 380 lockClosed

# Map mini hexes (t=28.0)
T $F/regular_0057.png 270 310 215 190 mHexHeli
T $F/regular_0057.png 650 135 215 190 mHexOffice
T $F/regular_0057.png 450 670 215 195 mHexBank
T $F/regular_0057.png 1000 330 215 190 mHexBank2
T $F/regular_0057.png 795 580 215 195 mHexTowers2
T $F/regular_0057.png 1390 225 215 190 mHexSail
T $F/regular_0057.png 1355 620 215 195 mHexCity2
echo BATCH1-DONE

# Re-trace the first five assets (were traced inverted before the fix)
T ref-analysis/frames/regular_0028.png 200 180 340 320 hexBank
T ref-analysis/frames/regular_0028.png 590 180 340 320 hexOffice
T ref-analysis/frames/regular_0028.png 980 180 340 320 hexTowers
T ref-analysis/frames/regular_0028.png 1370 180 340 320 hexSail
T ref-analysis/frames/regular_0028.png 823 675 274 300 logoMark --colors "#FFFFFF,#D45837"
echo BATCH-ALL-DONE
