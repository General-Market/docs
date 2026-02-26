"""
WebSocket-based market data feed for Vision batches.

Usage:
    feed = VisionFeed(ws_url="ws://localhost:8200/vision/ws", http_url="http://localhost:8200")
    feed.subscribe(["1", "3"], history_days=7)

    prices = feed.prices("1")        # latest prices, updated in background
    history = feed.history("1", "bitcoin")  # 7d history, fetched once

    feed.unsubscribe(["1"])
    feed.close()
"""

import json
import logging
import threading
import time
from typing import Optional

import requests
import websockets.sync.client

log = logging.getLogger(__name__)


class VisionFeed:
    def __init__(self, ws_url: str, http_url: str):
        self._ws_url = ws_url
        self._http_url = http_url.rstrip("/")
        self._prices: dict[str, dict[str, dict]] = {}
        self._history: dict[str, dict[str, list]] = {}
        self._subscribed: set[str] = set()
        self._lock = threading.Lock()
        self._ws: Optional[websockets.sync.client.ClientConnection] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._connect()

    def _connect(self):
        """Connect WebSocket and start listener thread."""
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()

    def _listen_loop(self):
        """Reconnect loop with exponential backoff."""
        backoff = 1
        while self._running:
            try:
                self._ws = websockets.sync.client.connect(self._ws_url)
                log.info("WebSocket connected to %s", self._ws_url)
                backoff = 1

                # Re-subscribe on reconnect
                if self._subscribed:
                    msg = json.dumps({"subscribe": list(self._subscribed)})
                    self._ws.send(msg)

                for raw in self._ws:
                    if not self._running:
                        break
                    try:
                        data = json.loads(raw)
                        self._handle_message(data)
                    except json.JSONDecodeError:
                        pass

            except Exception as e:
                if not self._running:
                    break
                log.warning("WebSocket error: %s, reconnecting in %ds", e, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)

    def _handle_message(self, data: dict):
        """Process incoming price message."""
        if data.get("type") != "prices":
            return

        batch_id = str(data["batchId"])
        with self._lock:
            if batch_id not in self._prices:
                self._prices[batch_id] = {}

            for m in data.get("markets", []):
                asset_id = m["id"]
                self._prices[batch_id][asset_id] = {
                    "price": float(m["price"]),
                    "change_pct": float(m["changePct"]) if m.get("changePct") else None,
                    "volume_24h": float(m["volume24h"]) if m.get("volume24h") else None,
                }

                # Append to history if we have it
                if batch_id in self._history and asset_id in self._history[batch_id]:
                    self._history[batch_id][asset_id].append({
                        "ts": data["ts"],
                        "price": float(m["price"]),
                        "change_pct": float(m["changePct"]) if m.get("changePct") else None,
                    })

    def subscribe(self, batch_ids: list[str], history_days: int = 0):
        """Subscribe to batch price feeds. Optionally fetch history (once)."""
        new_ids = [bid for bid in batch_ids if bid not in self._subscribed]
        if not new_ids:
            return

        self._subscribed.update(new_ids)

        # Send WS subscribe
        if self._ws:
            try:
                self._ws.send(json.dumps({"subscribe": new_ids}))
            except Exception:
                pass  # Will re-subscribe on reconnect

        # Fetch history via HTTP (in parallel threads)
        if history_days > 0:
            for bid in new_ids:
                threading.Thread(
                    target=self._fetch_history,
                    args=(bid, history_days),
                    daemon=True,
                ).start()

    def _fetch_history(self, batch_id: str, days: int):
        """Fetch batch history via HTTP and cache locally."""
        url = f"{self._http_url}/vision/batch/{batch_id}/history?days={days}"
        try:
            resp = requests.get(url, timeout=30)
            if not resp.ok:
                log.warning("History fetch failed for batch %s: %s", batch_id, resp.status_code)
                return

            data = resp.json()
            with self._lock:
                self._history[batch_id] = {}
                for market in data.get("markets", []):
                    asset_id = market["id"]
                    self._history[batch_id][asset_id] = [
                        {
                            "ts": p["ts"],
                            "price": float(p["price"]),
                            "change_pct": float(p.get("changePct") or 0),
                        }
                        for p in market.get("prices", [])
                    ]
            log.info("Fetched %dd history for batch %s (%d markets)", days, batch_id, len(data.get("markets", [])))
        except Exception as e:
            log.warning("History fetch error for batch %s: %s", batch_id, e)

    def unsubscribe(self, batch_ids: list[str]):
        """Unsubscribe from batch price feeds."""
        self._subscribed -= set(batch_ids)
        if self._ws:
            try:
                self._ws.send(json.dumps({"unsubscribe": batch_ids}))
            except Exception:
                pass
        with self._lock:
            for bid in batch_ids:
                self._prices.pop(bid, None)
                self._history.pop(bid, None)

    def prices(self, batch_id: str) -> dict[str, dict]:
        """Get latest prices for a batch. Returns {asset_id: {price, change_pct, volume_24h}}."""
        with self._lock:
            return dict(self._prices.get(batch_id, {}))

    def history(self, batch_id: str, asset_id: str) -> list[dict]:
        """Get cached price history for a market in a batch."""
        with self._lock:
            return list(self._history.get(batch_id, {}).get(asset_id, []))

    def close(self):
        """Disconnect and stop listener thread."""
        self._running = False
        if self._ws:
            try:
                self._ws.close()
            except Exception:
                pass
        if self._thread:
            self._thread.join(timeout=5)
