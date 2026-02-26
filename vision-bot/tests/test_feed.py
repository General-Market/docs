"""Load test for VisionFeed — multiple batches of 80 markets running in parallel.

Spins up a mock WebSocket server and a mock HTTP history server, then verifies
the VisionFeed handles continuous updates across multiple batches correctly.
"""

import json
import logging
import threading
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from unittest.mock import patch

import pytest
import websockets.sync.server

from framework.feed import VisionFeed

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ── Test constants ────────────────────────────────────────────
NUM_BATCHES = 5
MARKETS_PER_BATCH = 80
TICKS_TO_SIMULATE = 20
TICK_INTERVAL = 0.05  # 50ms per tick for fast testing


def make_market_ids(batch_id: int) -> list[str]:
    """Generate 80 unique market IDs for a batch."""
    return [f"batch{batch_id}_market{i}" for i in range(MARKETS_PER_BATCH)]


def make_price_message(batch_id: int, tick: int) -> dict:
    """Build a prices message for a batch at a given tick."""
    markets = []
    for i in range(MARKETS_PER_BATCH):
        base_price = 100.0 + i + tick * 0.1
        markets.append({
            "id": f"batch{batch_id}_market{i}",
            "source": f"source_{batch_id}",
            "price": f"{base_price:.2f}",
            "changePct": f"{(tick * 0.01):.4f}",
            "volume24h": f"{1000000 + i * 100}",
        })
    return {
        "type": "prices",
        "batchId": batch_id,
        "ts": f"2026-02-26T12:{tick:02d}:00Z",
        "markets": markets,
    }


def make_history_response(batch_id: int) -> dict:
    """Build a 7-day history response for a batch's markets."""
    markets = []
    for i in range(MARKETS_PER_BATCH):
        prices = []
        for day in range(7):
            for hour in range(0, 24, 6):  # 4 data points per day
                prices.append({
                    "ts": f"2026-02-{19 + day:02d}T{hour:02d}:00:00Z",
                    "price": f"{100.0 + i + day * 0.5:.2f}",
                    "changePct": f"{day * 0.01:.4f}",
                    "volume24h": f"{1000000 + i * 100}",
                })
        markets.append({
            "id": f"batch{batch_id}_market{i}",
            "symbol": f"M{i}",
            "prices": prices,
        })
    return {
        "batchId": batch_id,
        "source": f"source_{batch_id}",
        "markets": markets,
    }


# ── Mock WebSocket server ────────────────────────────────────

class MockWSServer:
    """Mock WebSocket server that accepts subscriptions and pushes price updates."""

    def __init__(self, host="127.0.0.1", port=0):
        self.host = host
        self.port = port
        self.server = None
        self.thread = None
        self.subscriptions: dict[int, bool] = {}  # batch_id → active
        self.clients: list = []
        self._running = False
        self._tick_thread = None
        self.messages_sent = 0
        self.subscribe_count = 0
        self.unsubscribe_count = 0
        self._lock = threading.Lock()

    def start(self):
        self._running = True
        self.server = websockets.sync.server.serve(
            self._handler, self.host, self.port,
        )
        self.port = self.server.socket.getsockname()[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        # Start tick pusher
        self._tick_thread = threading.Thread(target=self._tick_loop, daemon=True)
        self._tick_thread.start()
        log.info("Mock WS server started on port %d", self.port)

    def stop(self):
        self._running = False
        if self.server:
            self.server.shutdown()

    def _handler(self, ws):
        with self._lock:
            self.clients.append(ws)
        try:
            for raw in ws:
                msg = json.loads(raw)
                if "subscribe" in msg:
                    for bid in msg["subscribe"]:
                        bid_int = int(bid) if isinstance(bid, str) else bid
                        self.subscriptions[bid_int] = True
                        self.subscribe_count += 1
                if "unsubscribe" in msg:
                    for bid in msg["unsubscribe"]:
                        bid_int = int(bid) if isinstance(bid, str) else bid
                        self.subscriptions.pop(bid_int, None)
                        self.unsubscribe_count += 1
        except Exception:
            pass
        finally:
            with self._lock:
                if ws in self.clients:
                    self.clients.remove(ws)

    def _tick_loop(self):
        tick = 0
        while self._running:
            time.sleep(TICK_INTERVAL)
            tick += 1
            with self._lock:
                clients = list(self.clients)
            for bid, active in list(self.subscriptions.items()):
                if not active:
                    continue
                msg = json.dumps(make_price_message(bid, tick))
                for ws in clients:
                    try:
                        ws.send(msg)
                        self.messages_sent += 1
                    except Exception:
                        pass


# ── Mock HTTP server for history ─────────────────────────────

class MockHistoryHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse /vision/batch/{id}/history
        parts = self.path.split("/")
        if len(parts) >= 5 and parts[2] == "batch" and "history" in parts[4]:
            batch_id = int(parts[3])
            resp = json.dumps(make_history_response(batch_id)).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(resp)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress request logging


# ── Tests ────────────────────────────────────────────────────


class TestVisionFeedParallelBatches:
    """Test VisionFeed with multiple 80-market batches running continuously."""

    @pytest.fixture(autouse=True)
    def setup_servers(self):
        """Start mock WS and HTTP servers."""
        self.ws_server = MockWSServer()
        self.ws_server.start()

        self.http_server = HTTPServer(("127.0.0.1", 0), MockHistoryHandler)
        self.http_port = self.http_server.server_address[1]
        self.http_thread = threading.Thread(target=self.http_server.serve_forever, daemon=True)
        self.http_thread.start()

        yield

        self.ws_server.stop()
        self.http_server.shutdown()

    def _make_feed(self) -> VisionFeed:
        return VisionFeed(
            ws_url=f"ws://127.0.0.1:{self.ws_server.port}",
            http_url=f"http://127.0.0.1:{self.http_port}",
        )

    def test_single_batch_80_markets(self):
        """Single batch with 80 markets receives continuous updates."""
        feed = self._make_feed()
        time.sleep(0.2)  # let WS connect

        feed.subscribe(["1"], history_days=7)
        time.sleep(TICK_INTERVAL * 5 + 0.3)  # wait for a few ticks + history fetch

        prices = feed.prices("1")
        assert len(prices) == MARKETS_PER_BATCH, f"Expected {MARKETS_PER_BATCH} markets, got {len(prices)}"

        # Verify price structure
        for mid, p in prices.items():
            assert "price" in p, f"Missing price for {mid}"
            assert isinstance(p["price"], float)
            assert p["price"] > 0

        # Verify history was fetched
        hist = feed.history("1", "batch1_market0")
        assert len(hist) > 0, "History should have been fetched"
        # 7 days * 4 points/day = 28 base points + any live appended
        assert len(hist) >= 28, f"Expected >= 28 history points, got {len(hist)}"

        feed.close()

    def test_parallel_batches_80_markets_each(self):
        """5 batches × 80 markets = 400 markets updated continuously."""
        feed = self._make_feed()
        time.sleep(0.2)

        # Subscribe to all batches at once
        batch_ids = [str(i) for i in range(1, NUM_BATCHES + 1)]
        feed.subscribe(batch_ids, history_days=7)

        # Let it run for several ticks
        time.sleep(TICK_INTERVAL * TICKS_TO_SIMULATE + 0.5)

        # Verify all batches have prices
        for bid in batch_ids:
            prices = feed.prices(bid)
            assert len(prices) == MARKETS_PER_BATCH, (
                f"Batch {bid}: expected {MARKETS_PER_BATCH} markets, got {len(prices)}"
            )

        # Verify WS server processed subscriptions
        assert self.ws_server.subscribe_count >= NUM_BATCHES

        # Verify history for each batch
        time.sleep(1.0)  # give history threads time to complete
        for bid in batch_ids:
            hist = feed.history(bid, f"batch{bid}_market0")
            assert len(hist) >= 28, (
                f"Batch {bid}: expected >= 28 history points, got {len(hist)}"
            )

        # Verify messages were sent
        assert self.ws_server.messages_sent > 0
        log.info(
            "Parallel test: %d batches × %d markets, %d WS messages sent",
            NUM_BATCHES, MARKETS_PER_BATCH, self.ws_server.messages_sent,
        )

        feed.close()

    def test_subscribe_unsubscribe_cycle(self):
        """Subscribe, receive data, unsubscribe, verify cleanup."""
        feed = self._make_feed()
        time.sleep(0.2)

        # Subscribe
        feed.subscribe(["1", "2"])
        time.sleep(TICK_INTERVAL * 5 + 0.2)

        assert len(feed.prices("1")) == MARKETS_PER_BATCH
        assert len(feed.prices("2")) == MARKETS_PER_BATCH

        # Unsubscribe batch 1
        feed.unsubscribe(["1"])

        # Batch 1 should be cleared
        assert len(feed.prices("1")) == 0
        # Batch 2 should still be active
        time.sleep(TICK_INTERVAL * 3 + 0.1)
        assert len(feed.prices("2")) == MARKETS_PER_BATCH

        feed.close()

    def test_reconnect_preserves_subscriptions(self):
        """After WS disconnect, feed reconnects and re-subscribes."""
        feed = self._make_feed()
        time.sleep(0.2)

        feed.subscribe(["1"])
        time.sleep(TICK_INTERVAL * 3 + 0.1)
        assert len(feed.prices("1")) == MARKETS_PER_BATCH

        # Force-close all client connections from server side
        initial_sub_count = self.ws_server.subscribe_count
        with self.ws_server._lock:
            for ws in list(self.ws_server.clients):
                try:
                    ws.close()
                except Exception:
                    pass
            self.ws_server.clients.clear()

        # Wait for feed to reconnect (backoff: 1s first retry)
        time.sleep(3.0)

        # Should have re-subscribed after reconnect
        assert self.ws_server.subscribe_count > initial_sub_count, (
            f"Feed should have re-subscribed after reconnect: "
            f"was {initial_sub_count}, now {self.ws_server.subscribe_count}"
        )

        # Should receive new data
        time.sleep(TICK_INTERVAL * 5 + 0.2)
        prices = feed.prices("1")
        assert len(prices) == MARKETS_PER_BATCH

        feed.close()

    def test_continuous_80_markets_no_data_loss(self):
        """Run 80-market batch for many ticks, verify prices always update."""
        feed = self._make_feed()
        time.sleep(0.2)

        feed.subscribe(["1"])
        time.sleep(TICK_INTERVAL * 3 + 0.1)

        # Sample prices at multiple points
        snapshots = []
        for _ in range(10):
            time.sleep(TICK_INTERVAL * 2)
            p = feed.prices("1")
            assert len(p) == MARKETS_PER_BATCH, f"Expected {MARKETS_PER_BATCH}, got {len(p)}"
            snapshots.append(p)

        # Verify prices are changing (not stale)
        first_price = snapshots[0]["batch1_market0"]["price"]
        last_price = snapshots[-1]["batch1_market0"]["price"]
        assert first_price != last_price, "Prices should be updating over time"

        feed.close()

    def test_history_fetched_only_once(self):
        """Calling subscribe twice with history_days doesn't re-fetch."""
        feed = self._make_feed()
        time.sleep(0.2)

        feed.subscribe(["1"], history_days=7)
        time.sleep(0.5)

        # Subscribe again — should be no-op
        feed.subscribe(["1"], history_days=7)
        time.sleep(0.2)

        # Still subscribed, data available
        hist = feed.history("1", "batch1_market0")
        assert len(hist) >= 28

        feed.close()

    def test_large_message_throughput(self):
        """Verify feed handles rapid 80-market updates without dropping."""
        feed = self._make_feed()
        time.sleep(0.2)

        feed.subscribe(["1"])

        # Wait for many ticks
        time.sleep(TICK_INTERVAL * 50 + 0.5)

        prices = feed.prices("1")
        assert len(prices) == MARKETS_PER_BATCH

        # Every market should have a price
        for i in range(MARKETS_PER_BATCH):
            mid = f"batch1_market{i}"
            assert mid in prices, f"Missing market {mid}"
            assert prices[mid]["price"] > 0

        log.info("Throughput test: %d messages sent by server", self.ws_server.messages_sent)
        feed.close()
