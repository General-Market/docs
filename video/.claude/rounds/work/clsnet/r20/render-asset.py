#!/usr/bin/env python3
"""Rasterize one asset from art-store.json to PNG (optionally one fill layer)."""
import json, subprocess, sys, tempfile, os
store = json.load(open(sys.argv[1]))
name = sys.argv[2]
out = sys.argv[3]
only = sys.argv[4] if len(sys.argv) > 4 else None
a = store[name]
gs = "".join(
    f'<g transform="{l["transform"]}"><path d="{l["d"]}" fill="{l["fill"]}"/></g>'
    for l in a["layers"] if only is None or l["fill"] == only
)
svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{a["w"]}" height="{a["h"]}" viewBox="0 0 {a["w"]} {a["h"]}"><rect width="100%" height="100%" fill="#FDFDFD"/>{gs}</svg>'
with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as f:
    f.write(svg); p = f.name
subprocess.run(["magick", "-background", "none", p, out], check=True)
os.unlink(p)
print(out, a["w"], a["h"], [l["fill"] for l in a["layers"]])
