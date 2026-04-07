"""
WebSocket-based market data feed for Vision batches.

Built to run for months without supervision. The listener thread is watchdogged,
the price store is locked, the history is bounded, and every cached value carries
a freshness timestamp so callers can refuse stale data instead of betting on it.

Usage:
    feed = VisionFeed(ws_url="ws://localhost:8200/vision/ws", http_url="http://localhost:8200")
    feed.subscribe(["1", "3"], history_days=7)

    prices = feed.prices("1")        # latest prices, updated in background
    history = feed.history("1", "bitcoin")  # 7d history, fetched once
    fresh = feed.is_fresh("1", max_age_secs=60)

    feed.unsubscribe(["1"])
    feed.close()
"""

import inspect
import json
import logging
import random
import threading
import time
from typing import Optional

import requests
import websockets.sync.client

log = logging.getLogger(__name__)

# websockets 13+ exposes ping_interval/ping_timeout on sync.client.connect.
# On 12.x they're absent and passing them raises TypeError. Detect once.
_CONNECT_PARAMS = set(inspect.signature(websockets.sync.client.connect).parameters)
_SUPPORTS_WS_KEEPALIVE = "ping_interval" in _CONNECT_PARAMS

# Cap each market's in-memory history. A long-lived batch with a 5-second tick
# fills 17,000 points per day — without a cap the process eats itself alive.
MAX_HISTORY_PER_ASSET = 1000

# Default eviction window for batches that have stopped emitting messages.
# Configurable via constructor; defaults to 1 hour of silence.
DEFAULT_STALE_BATCH_SECS = 3600

# How often the listener loop runs its housekeeping pass.
HOUSEKEEPING_INTERVAL_SECS = 60

# WebSocket keepalive — without this a half-open TCP connection (firewall drop,
# NAT timeout) hangs the listener thread forever.
WS_PING_INTERVAL = 20
WS_PING_TIMEOUT = 10

# Reconnect backoff bounds.
BACKOFF_MIN = 1.0
BACKOFF_MAX = 30.0


class VisionFeed:
    def __init__(
        self,
        ws_url: str,
        http_url: str,
        stale_batch_secs: float = DEFAULT_STALE_BATCH_SECS,
    ):
        self._ws_url = ws_url
        self._http_url = http_url.rstrip("/")
        self._stale_batch_secs = stale_batch_secs

        # All mutable state below is guarded by self._lock.
        self._prices: dict[str, dict[str, dict]] = {}
        self._history: dict[str, dict[str, list]] = {}
        self._received_at: dict[str, dict[str, float]] = {}  # monotonic per asset
        self._batch_last_seen: dict[str, float] = {}          # monotonic per batch
        self._subscribed: set[str] = set()
        self._last_message_at: Optional[float] = None         # monotonic
        self._last_message_wallclock: Optional[float] = None  # time.time()

        self._lock = threading.Lock()
        self._ws: Optional[websockets.sync.client.ClientConnection] = None
        self._ws_lock = threading.Lock()  # serializes sends; never held during recv
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_housekeeping = 0.0
        self._connect()

    # ── Lifecycle ────────────────────────────────────────────

    def _connect(self):
        """Start listener thread. The thread owns the WebSocket lifecycle."""
        self._running = True
        self._thread = threading.Thread(
            target=self._listen_loop,
            name="VisionFeed-listener",
            daemon=True,
        )
        self._thread.start()

    def _listen_loop(self):
        """Reconnect loop with exponential backoff and jitter.

        Catches BaseException so a stray MemoryError or KeyError can't silently
        kill the thread and leave callers reading stale prices for hours.
        KeyboardInterrupt is re-raised so Ctrl-C still works.
        """
        backoff = BACKOFF_MIN
        while self._running:
            try:
                connect_kwargs = {}
                if _SUPPORTS_WS_KEEPALIVE:
                    connect_kwargs["ping_interval"] = WS_PING_INTERVAL
                    connect_kwargs["ping_timeout"] = WS_PING_TIMEOUT
                with self._ws_lock:
                    self._ws = websockets.sync.client.connect(
                        self._ws_url,
                        **connect_kwargs,
                    )
                log.info("WebSocket connected to %s", self._ws_url)
                backoff = BACKOFF_MIN

                # Re-subscribe to whatever the bot still cares about. Snapshot
                # under the lock so a concurrent subscribe() can't mutate the
                # set mid-iteration.
                with self._lock:
                    pending = list(self._subscribed)
                if pending:
                    try:
                        with self._ws_lock:
                            self._ws.send(json.dumps({"subscribe": pending}))
                        log.info("Re-subscribed to %d batches after connect", len(pending))
                    except Exception as e:
                        log.warning("Re-subscribe failed: %s", e)

                # Drain messages. Each message is wrapped so a single bad payload
                # cannot bring down the loop.
                for raw in self._ws:
                    if not self._running:
                        break
                    try:
                        data = json.loads(raw)
                        self._handle_message(data)
                    except json.JSONDecodeError:
                        continue
                    except Exception as e:
                        log.warning("Bad message dropped: %s", e)
                        continue

                    # Periodic housekeeping — runs from the listener so we don't
                    # need a second supervisor thread.
                    self._maybe_housekeep()

            except KeyboardInterrupt:
                self._running = False
                raise
            except BaseException as e:
                if not self._running:
                    break
                log.warning(
                    "WebSocket listener error (%s: %s), reconnecting in %.1fs",
                    type(e).__name__, e, backoff,
                )
                # Close any half-open connection before sleeping.
                self._safe_close_ws()
                # Jittered sleep keeps the thread interruptible-ish and avoids
                # synchronized reconnect storms across multiple bots.
                sleep_for = backoff * random.uniform(0.5, 1.5)
                self._sleep_interruptible(sleep_for)
                backoff = min(backoff * 2, BACKOFF_MAX)

        self._safe_close_ws()
        log.info("VisionFeed listener exiting cleanly")

    def _sleep_interruptible(self, secs: float):
        """Sleep that wakes early on shutdown."""
        end = time.monotonic() + secs
        while self._running and time.monotonic() < end:
            time.sleep(min(0.5, end - time.monotonic()))

    def _safe_close_ws(self):
        with self._ws_lock:
            if self._ws is not None:
                try:
                    self._ws.close()
                except Exception:
                    pass
                self._ws = None

    # ── Message handling ─────────────────────────────────────

    def _handle_message(self, data: dict):
        """Process incoming price message. Stamps every asset with monotonic time."""
        if data.get("type") != "prices":
            return
        if "batchId" not in data:
            return

        batch_id = str(data["batchId"])
        now_mono = time.monotonic()
        now_wall = time.time()

        with self._lock:
            self._last_message_at = now_mono
            self._last_message_wallclock = now_wall
            self._batch_last_seen[batch_id] = now_mono

            if batch_id not in self._prices:
                self._prices[batch_id] = {}
            if batch_id not in self._received_at:
                self._received_at[batch_id] = {}

            for m in data.get("markets", []):
                asset_id = m.get("id")
                if asset_id is None:
                    continue
                try:
                    price = float(m["price"])
                except (KeyError, TypeError, ValueError):
                    continue

                # Use `is not None` so a legitimate 0.0 isn't dropped as falsy.
                change_pct_raw = m.get("changePct")
                change_pct = float(change_pct_raw) if change_pct_raw is not None else None

                volume_raw = m.get("volume24h")
                volume_24h = float(volume_raw) if volume_raw is not None else None

                self._prices[batch_id][asset_id] = {
                    "price": price,
                    "change_pct": change_pct,
                    "volume_24h": volume_24h,
                }
                self._received_at[batch_id][asset_id] = now_mono

                # Append to history if we have it. Trim to MAX_HISTORY_PER_ASSET
                # so a long-lived batch can't drink the heap.
                hist_batch = self._history.get(batch_id)
                if hist_batch is not None and asset_id in hist_batch:
                    series = hist_batch[asset_id]
                    series.append({
                        "ts": data.get("ts"),
                        "price": price,
                        "change_pct": change_pct,
                    })
                    overflow = len(series) - MAX_HISTORY_PER_ASSET
                    if overflow > 0:
                        del series[:overflow]

    # ── Housekeeping ─────────────────────────────────────────

    def _maybe_housekeep(self):
        """Run periodic eviction of long-silent batches."""
        now = time.monotonic()
        if now - self._last_housekeeping < HOUSEKEEPING_INTERVAL_SECS:
            return
        self._last_housekeeping = now

        cutoff = now - self._stale_batch_secs
        to_evict = []
        with self._lock:
            for bid, last_seen in self._batch_last_seen.items():
                # Don't evict batches the user explicitly asked us to track.
                # Eviction is for orphans where the data-node stopped emitting
                # but unsubscribe() was never called.
                if bid in self._subscribed:
                    continue
                if last_seen < cutoff:
                    to_evict.append(bid)
            for bid in to_evict:
                self._prices.pop(bid, None)
                self._history.pop(bid, None)
                self._received_at.pop(bid, None)
                self._batch_last_seen.pop(bid, None)
        if to_evict:
            log.info("Evicted %d stale batches: %s", len(to_evict), to_evict)

    # ── Subscription ─────────────────────────────────────────

    def subscribe(self, batch_ids: list[str], history_days: int = 0):
        """Subscribe to batch price feeds. Optionally fetch history (once)."""
        with self._lock:
            new_ids = [bid for bid in batch_ids if bid not in self._subscribed]
            if not new_ids:
                return
            self._subscribed.update(new_ids)

        # Send WS subscribe outside the state lock to avoid holding it across
        # network IO. The listener will re-send on reconnect anyway.
        sent = False
        with self._ws_lock:
            if self._ws is not None:
                try:
                    self._ws.send(json.dumps({"subscribe": new_ids}))
                    sent = True
                except Exception as e:
                    log.warning("subscribe send failed (%s); will resend on reconnect", e)
        if not sent:
            log.info("Subscribe buffered for next reconnect: %s", new_ids)

        # Fetch history via HTTP (in parallel threads).
        # NOTE: history is fetched once on subscribe and never refreshed for the
        # lifetime of the subscription. After WS reconnects, only the live tail
        # is appended via _handle_message. For batches that live for many days,
        # the prepended history will become an increasingly old snapshot. Fixing
        # this would require periodic re-fetch with its own coordination cost
        # and is deferred until we have a use case that demands it.
        if history_days > 0:
            for bid in new_ids:
                threading.Thread(
                    target=self._fetch_history,
                    args=(bid, history_days),
                    name=f"VisionFeed-history-{bid}",
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
                    asset_id = market.get("id")
                    if asset_id is None:
                        continue
                    series = []
                    for p in market.get("prices", []):
                        try:
                            price = float(p["price"])
                        except (KeyError, TypeError, ValueError):
                            continue
                        change_raw = p.get("changePct")
                        change_pct = float(change_raw) if change_raw is not None else 0.0
                        series.append({
                            "ts": p.get("ts"),
                            "price": price,
                            "change_pct": change_pct,
                        })
                    # Trim historical fetches too — a 7-day fetch on a fast tick
                    # source can already exceed our budget.
                    if len(series) > MAX_HISTORY_PER_ASSET:
                        series = series[-MAX_HISTORY_PER_ASSET:]
                    self._history[batch_id][asset_id] = series
            log.info(
                "Fetched %dd history for batch %s (%d markets)",
                days, batch_id, len(data.get("markets", [])),
            )
        except Exception as e:
            log.warning("History fetch error for batch %s: %s", batch_id, e)

    def unsubscribe(self, batch_ids: list[str]):
        """Unsubscribe from batch price feeds and free their memory."""
        with self._lock:
            self._subscribed -= set(batch_ids)

        with self._ws_lock:
            if self._ws is not None:
                try:
                    self._ws.send(json.dumps({"unsubscribe": batch_ids}))
                except Exception:
                    pass

        with self._lock:
            for bid in batch_ids:
                self._prices.pop(bid, None)
                self._history.pop(bid, None)
                self._received_at.pop(bid, None)
                self._batch_last_seen.pop(bid, None)

    # ── Read API ─────────────────────────────────────────────

    def prices(self, batch_id: str) -> dict[str, dict]:
        """Get latest prices for a batch. Returns {asset_id: {price, change_pct, volume_24h}}."""
        with self._lock:
            return dict(self._prices.get(batch_id, {}))

    def history(self, batch_id: str, asset_id: str) -> list[dict]:
        """Get cached price history for a market in a batch."""
        with self._lock:
            return list(self._history.get(batch_id, {}).get(asset_id, []))

    def is_fresh(self, batch_id: str, max_age_secs: float) -> bool:
        """True if any asset in this batch was updated within max_age_secs."""
        with self._lock:
            last_seen = self._batch_last_seen.get(batch_id)
        if last_seen is None:
            return False
        return (time.monotonic() - last_seen) <= max_age_secs

    def asset_age_secs(self, batch_id: str, asset_id: str) -> Optional[float]:
        """Seconds since this asset's last price update, or None if never seen."""
        with self._lock:
            received = self._received_at.get(batch_id, {}).get(asset_id)
        if received is None:
            return None
        return time.monotonic() - received

    def seconds_since_last_message(self) -> Optional[float]:
        """Seconds since the listener received any message at all. None if never."""
        with self._lock:
            ts = self._last_message_at
        if ts is None:
            return None
        return time.monotonic() - ts

    @property
    def last_message_at(self) -> Optional[float]:
        """Wall-clock time of the most recent message (time.time()), or None."""
        with self._lock:
            return self._last_message_wallclock

    def is_alive(self) -> bool:
        """True if the listener thread is still running."""
        return self._thread is not None and self._thread.is_alive()

    # ── Shutdown ─────────────────────────────────────────────

    def close(self):
        """Disconnect and stop listener thread. Waits up to 5s for clean exit."""
        self._running = False
        self._safe_close_ws()
        if self._thread is not None:
            self._thread.join(timeout=5)
            if self._thread.is_alive():
                log.warning("VisionFeed listener thread did not exit within 5s")
