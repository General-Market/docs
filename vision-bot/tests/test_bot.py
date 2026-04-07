import os
import pytest
from unittest.mock import MagicMock, patch

from framework.core import load_config


class TestLoadConfig:
    def test_defaults_without_file(self):
        cfg = load_config("/nonexistent/path.toml")
        assert cfg["strategy"] == "random"
        assert cfg["deposit"] == 10
        assert cfg["max_batches"] == 5
        assert cfg["rpc_url"] == "http://localhost:8546"
        assert cfg["auto_claim"] is True

    def test_env_var_overrides(self):
        with patch.dict(os.environ, {"DEPOSIT_AMOUNT": "25", "STRATEGY": "momentum"}):
            cfg = load_config("/nonexistent/path.toml")
            assert cfg["deposit"] == 25
            assert cfg["strategy"] == "momentum"

    def test_env_var_int_conversion(self):
        with patch.dict(os.environ, {"POLL_INTERVAL": "60"}):
            cfg = load_config("/nonexistent/path.toml")
            assert cfg["poll_interval"] == 60
            assert isinstance(cfg["poll_interval"], int)


class TestRunCycle:
    def _make_feed(self, fresh=True):
        feed = MagicMock()
        feed.is_fresh.return_value = fresh
        feed.subscribe.return_value = None
        feed.prices.return_value = {
            "btc": {"price": 50000, "change_pct": 2.0, "volume_24h": 1e9},
            "eth": {"price": 3000, "change_pct": -1.0, "volume_24h": 5e8},
            "sol": {"price": 100, "change_pct": 5.0, "volume_24h": 2e8},
        }
        return feed

    def test_joins_batch_and_calls_tracker(self):
        """Mock all dependencies, verify run_cycle joins a batch."""
        from bot import run_cycle

        cfg = load_config("/nonexistent")
        cfg["batch_ids"] = []
        cfg["max_batches"] = 5
        cfg["deposit"] = 1
        cfg["stake"] = 1
        executor = MagicMock()
        executor.bot_addr = "0x1234"
        executor.usdc_balance.return_value = 100 * 10**18
        executor.get_position.side_effect = Exception("not joined")
        executor.get_batch_info.return_value = {
            "configHash": b"\x00" * 32,
            "tickDuration": 60,
            "lockOffset": 0,
        }
        executor.is_tick_locked.return_value = False

        tracker = MagicMock()
        tracker.active_ids = set()
        tracker.active_count = 0
        tracker.positions = {}

        strategy = MagicMock()
        strategy.predict_with_context.return_value = ["UP", "DOWN", "UP"]
        strategy._rng = None

        from framework.core import RiskCheck
        risk = RiskCheck(5, 100 * 10**18)

        oracle_urls_fn = lambda: ["http://localhost:10001"]
        feed = self._make_feed()

        with patch("bot.fetch_batches") as mock_fb, \
             patch("bot.fetch_batch_config") as mock_fbc, \
             patch("bot.submit_bitmap") as mock_sb, \
             patch("bot._wait_for_join", return_value=True):
            mock_fb.return_value = [{"id": 1}]
            mock_fbc.return_value = {
                "markets": [{"assetId": "btc"}, {"assetId": "eth"}, {"assetId": "sol"}],
            }

            run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed)

            executor.approve_usdc.assert_called()
            executor.join_batch_direct.assert_called_once()
            tracker.on_join.assert_called_once()
            tracker.check_all.assert_called()
            strategy.predict_with_context.assert_called_once()

    def test_max_batches_respected(self):
        """When tracker is at max, no new joins."""
        from bot import run_cycle

        cfg = load_config("/nonexistent")
        cfg["batch_ids"] = []
        cfg["max_batches"] = 5
        executor = MagicMock()
        executor.bot_addr = "0x1234"

        tracker = MagicMock()
        tracker.active_ids = {1, 2, 3, 4, 5}
        tracker.active_count = 5  # at max
        tracker.positions = {}

        strategy = MagicMock()
        risk = MagicMock()
        oracle_urls_fn = lambda: ["http://localhost:10001"]
        feed = self._make_feed()

        with patch("bot.fetch_batches") as mock_fb:
            mock_fb.return_value = [{"id": 6}]

            run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed)

            executor.join_batch_direct.assert_not_called()
            tracker.check_all.assert_called_once()

    def test_skips_batch_when_feed_stale(self):
        """A stale feed must skip the join — yesterday's prices are not the
        prices we are betting on."""
        from bot import run_cycle

        cfg = load_config("/nonexistent")
        cfg["batch_ids"] = []
        cfg["max_batches"] = 5
        cfg["deposit"] = 1
        cfg["stake"] = 1
        executor = MagicMock()
        executor.bot_addr = "0x1234"
        executor.usdc_balance.return_value = 100 * 10**18
        executor.get_position.side_effect = Exception("not joined")
        executor.get_batch_info.return_value = {
            "configHash": b"\x00" * 32,
            "tickDuration": 60,
            "lockOffset": 0,
        }
        executor.is_tick_locked.return_value = False

        tracker = MagicMock()
        tracker.active_ids = set()
        tracker.active_count = 0
        tracker.positions = {}

        strategy = MagicMock()
        from framework.core import RiskCheck
        risk = RiskCheck(5, 100 * 10**18)

        oracle_urls_fn = lambda: ["http://localhost:10001"]
        feed = self._make_feed(fresh=False)

        with patch("bot.fetch_batches") as mock_fb, \
             patch("bot.fetch_batch_config") as mock_fbc:
            mock_fb.return_value = [{"id": 1}]
            mock_fbc.return_value = {
                "markets": [{"assetId": "btc"}],
            }

            run_cycle(cfg, executor, tracker, strategy, risk, oracle_urls_fn, feed)

            executor.join_batch_direct.assert_not_called()
            tracker.on_join.assert_not_called()
