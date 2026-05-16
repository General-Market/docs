"""Per-vault bitmap persistence keyed by (vault_addr, batch_id).

The fund-manager commits ``bm_hash`` on-chain via ``joinBatch`` and then
reveals the bitmap to the oracles. If the bot ever re-enters the submit
path for a batch it has already joined — restart, retry, a stray
reconciliation cycle — it must present the exact bytes whose keccak256
matches the committed hash. Recomputing from a fresh ``predict()`` is
how vaults end up joined-but-bitmap-less: the markets list shifts, the
strategy fires on slightly different inputs, the hash drifts, every
oracle returns 400, the vault never trades.

The store is a flat JSON file per vault under ``/app/pnl-data/bitmaps/``.
Hex strings, atomic writes. No locking — one process owns a vault.

Settled batches are evicted to keep the file from growing indefinitely.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from typing import Optional

log = logging.getLogger("fund-manager.bitmap-store")

# Default matches the fund-manager container's writable mount point. Tests
# and ad-hoc tooling can override via VISION_BITMAP_STORE_DIR.
_DEFAULT_DIR = "/app/pnl-data/bitmaps"


def _store_dir() -> str:
    return os.environ.get("VISION_BITMAP_STORE_DIR", _DEFAULT_DIR)


def _path_for(vault_addr: str) -> str:
    # Normalize so 0xABC… and 0xabc… share the same file. The on-chain
    # address is checksummed but cases drift between sources.
    return os.path.join(_store_dir(), vault_addr.lower() + ".json")


def _load_file(path: str) -> dict:
    try:
        with open(path) as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except FileNotFoundError:
        return {}
    except (OSError, json.JSONDecodeError) as e:
        log.warning("Bitmap store unreadable at %s (%s) — treating as empty", path, e)
    return {}


def _atomic_write(path: str, data: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".bitmap-", dir=os.path.dirname(path))
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(data, f)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def save_bitmap(vault_addr: str, batch_id: int, bitmap: bytes, bm_hash: bytes) -> None:
    """Persist the (bitmap, hash) pair so future submissions match the commitment."""
    path = _path_for(vault_addr)
    data = _load_file(path)
    data[str(batch_id)] = {
        "bitmap_hex": bitmap.hex(),
        "hash_hex": bm_hash.hex(),
    }
    try:
        _atomic_write(path, data)
    except OSError as e:
        # A failed save is not fatal — the in-memory bitmap will still be
        # submitted this cycle. Loud warning so cumulative failures surface.
        log.warning("Could not persist bitmap for %s batch %d: %s",
                    vault_addr, batch_id, e)


def load_bitmap(vault_addr: str, batch_id: int) -> Optional[tuple[bytes, bytes]]:
    """Return the saved (bitmap, hash) for a batch, or None if absent."""
    path = _path_for(vault_addr)
    data = _load_file(path)
    entry = data.get(str(batch_id))
    if not entry:
        return None
    try:
        return bytes.fromhex(entry["bitmap_hex"]), bytes.fromhex(entry["hash_hex"])
    except (KeyError, ValueError) as e:
        log.warning("Bitmap store entry for %s/%d corrupt (%s) — discarding",
                    vault_addr, batch_id, e)
        return None


def drop_bitmap(vault_addr: str, batch_id: int) -> None:
    """Evict a settled batch from the store so the file stays small."""
    path = _path_for(vault_addr)
    data = _load_file(path)
    if data.pop(str(batch_id), None) is None:
        return
    try:
        if data:
            _atomic_write(path, data)
        else:
            os.unlink(path)
    except OSError as e:
        log.warning("Could not prune bitmap %s/%d: %s", vault_addr, batch_id, e)
