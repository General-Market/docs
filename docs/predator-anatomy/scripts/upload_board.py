#!/usr/bin/env python3
"""Wipe the General board and upload the full ICEBERG composition.

Layout — T-shape for video pan:
- HERO          (centred top)
- THEORY 1, 2   (side by side, second row)
- THEORY 3, 4   (side by side, third row)
- DIVIDER       (centred, narrow)
- MECH 01–07    (centred spine, vertical), each with VOICES card to the right
- FIX           (centred, bottom)
"""
import os, json, pathlib, time, urllib.parse, requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BID = "uXjVOkYo-do="
ENC = BID.replace("=", "%3D")
BASE = f"https://api.miro.com/v2/boards/{ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

ROOT = pathlib.Path(__file__).resolve().parents[1] / "diagrams"
MECH_DIR = ROOT / "multi"
EXTRAS_DIR = ROOT / "extras"


def upload_image(svg_path, x, y, width):
    data = {
        "title": svg_path.stem,
        "position": {"x": x, "y": y, "origin": "center"},
        "geometry": {"width": width},
    }
    with open(svg_path, "rb") as f:
        r = requests.post(
            f"{BASE}/images",
            headers=HEADERS,
            files={
                "resource": (svg_path.name, f, "image/svg+xml"),
                "data": (None, json.dumps(data), "application/json"),
            },
        )
    if not r.ok:
        print(f"  ERR {svg_path.name}: {r.status_code} {r.text[:200]}")
    return r


def wipe():
    cursor = None
    items = []
    while True:
        url = f"{BASE}/items?limit=50"
        if cursor: url += f"&cursor={cursor}"
        r = requests.get(url, headers=HEADERS).json()
        for i in r.get("data", []):
            items.append((i.get("id"), i.get("type")))
        cursor = r.get("cursor")
        if not cursor: break
    ep_map = {"text": "texts", "image": "images", "shape": "shapes", "frame": "frames"}
    deleted = 0
    for iid, t in items:
        ep = ep_map.get(t, "items")
        r = requests.delete(f"{BASE}/{ep}/{iid}", headers=HEADERS)
        if r.status_code in (200, 204): deleted += 1
        time.sleep(0.04)
    print(f"Wiped {deleted}/{len(items)} items")


# ===== LAYOUT =====
# Miro coords: x positive=right, y positive=down. origin=center of element.

# Vertical positions of each row
Y_HERO     = 0       # centered
Y_THEORY1  = 1700    # theory 1, 2 row
Y_THEORY2  = 3300    # theory 3, 4 row
Y_DIVIDER  = 4800
Y_MECH_START = 5900  # first mechanism starts here
MECH_PITCH = 2250    # vertical spacing between mechanisms

# Horizontal positions
X_HERO_W = 2400
X_THEORY_W = 1800
X_THEORY_OFFSET = 1000      # centre of each theory card from x=0 (theory 1 at -1000, theory 2 at +1000)
X_DIVIDER_W = 2400
X_MECH = -450               # mechanism spine slightly left of centre
X_MECH_W = 1500             # display width
X_VOICES = 1450             # voices column on the right
X_VOICES_W = 600
X_FIX_W = 2400


def main():
    wipe()
    print("\nUploading…")

    # HERO
    upload_image(EXTRAS_DIR / "00-hero.svg", 0, Y_HERO, X_HERO_W)
    print(f"  · hero @ y={Y_HERO}")

    # THEORY 2x2 grid
    upload_image(EXTRAS_DIR / "0A-triangle.svg",  -X_THEORY_OFFSET, Y_THEORY1, X_THEORY_W)
    upload_image(EXTRAS_DIR / "0B-limit.svg",      X_THEORY_OFFSET, Y_THEORY1, X_THEORY_W)
    upload_image(EXTRAS_DIR / "0C-skandalon.svg", -X_THEORY_OFFSET, Y_THEORY2, X_THEORY_W)
    upload_image(EXTRAS_DIR / "0D-pharmakon.svg",  X_THEORY_OFFSET, Y_THEORY2, X_THEORY_W)
    print(f"  · 4 theory cards in 2x2 grid")

    # DIVIDER
    upload_image(EXTRAS_DIR / "99-divider.svg", 0, Y_DIVIDER, X_DIVIDER_W)
    print(f"  · divider @ y={Y_DIVIDER}")

    # MECHANISMS + VOICES
    names = ["01-toxic-flow","02-stop-hunting","03-cross-venue","04-latency",
             "05-information","06-spoofing","07-pfof"]
    for i, name in enumerate(names):
        y = Y_MECH_START + i * MECH_PITCH
        # Mechanism (spine, slightly left)
        upload_image(MECH_DIR / f"{name}.svg", X_MECH, y, X_MECH_W)
        # Voices (right column)
        upload_image(EXTRAS_DIR / f"voices-{name}.svg", X_VOICES, y, X_VOICES_W)
        print(f"  · mech {name} + voices @ y={y}")
        time.sleep(0.2)

    # FIX (centered bottom)
    y_fix = Y_MECH_START + len(names) * MECH_PITCH
    upload_image(EXTRAS_DIR / "99-fix.svg", 0, y_fix, X_FIX_W)
    print(f"  · fix @ y={y_fix}")

    print(f"\nView: https://miro.com/app/board/{BID}")


if __name__ == "__main__":
    main()
