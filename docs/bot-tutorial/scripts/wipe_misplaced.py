#!/usr/bin/env python3
"""Delete every tutorial item in the right-hand storyboard column.

The column lives at CENTRE_X=4800 (see upload_to_miro.py). Hero text at y≈0,
ten cards stack down to y≈12900, closer below at y≈14000. Items are 1200–1500
wide, so x bounds span roughly 4050–5550. Box is generous in both axes; nothing
else lives in this corner of the board.

Usage:
    export $(grep -E "^MIRO_" .env | xargs)
    python3 docs/bot-tutorial/scripts/wipe_misplaced.py
"""
import os
import urllib.parse

import requests

TOKEN = os.environ["MIRO_ACCESS_TOKEN"]
BOARD_ID = "uXjVOkYo-do="
BOARD_ENC = urllib.parse.quote(BOARD_ID, safe="")
BASE = f"https://api.miro.com/v2/boards/{BOARD_ENC}"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

# Bounding box of items to delete — the full bot-tutorial column.
X_MIN, X_MAX = 4000, 5600
Y_MIN, Y_MAX = -400, 15000


def list_items(item_type: str):
    items = []
    cursor = None
    while True:
        params = {"limit": 50, "type": item_type}
        if cursor:
            params["cursor"] = cursor
        r = requests.get(f"{BASE}/items", headers=HEADERS, params=params, timeout=20)
        r.raise_for_status()
        d = r.json()
        items.extend(d.get("data", []))
        cursor = d.get("cursor")
        if not cursor:
            break
    return items


def in_box(pos):
    x, y = pos.get("x", 0), pos.get("y", 0)
    return X_MIN <= x <= X_MAX and Y_MIN <= y <= Y_MAX


def main() -> None:
    deleted = 0
    for item_type in ("image", "text"):
        items = list_items(item_type)
        for it in items:
            if in_box(it.get("position", {})):
                item_id = it["id"]
                r = requests.delete(
                    f"{BASE}/{item_type}s/{item_id}", headers=HEADERS, timeout=20
                )
                if r.ok:
                    title = it.get("data", {}).get("title") or (
                        it.get("data", {}).get("content", "")[:40] + "…"
                    )
                    print(f"  deleted {item_type:5s}  {item_id}  {title}")
                    deleted += 1
                else:
                    print(
                        f"  ERR    {item_type:5s}  {item_id}  "
                        f"{r.status_code} {r.text[:160]}"
                    )
    print(f"\nDeleted {deleted} item(s).")


if __name__ == "__main__":
    main()
