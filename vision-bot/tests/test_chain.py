"""Tests for framework.chain — Executor, oracle discovery, bitmap submission, fetching."""

import pytest
from unittest.mock import patch, MagicMock

from framework.chain import (
    Executor,
    discover_oracles,
    submit_bitmap,
    fetch_batches,
    fetch_markets,
)


# ── Test private key ────────────────────────────────────────────
# Deterministic key for tests — never used on any real chain.
TEST_PRIVATE_KEY = "0x" + "ab" * 32
# Expected address derived from the key above (eth_account deterministic).


# ── Executor init ───────────────────────────────────────────────


class TestExecutorInit:
    def test_valid_key_derives_address(self):
        """Executor with a valid private key sets bot_addr to a checksummed address."""
        ex = Executor(
            rpc_url="http://localhost:8545",
            private_key=TEST_PRIVATE_KEY,
            vision_addr="0x" + "11" * 20,
            usdc_addr="0x" + "22" * 20,
        )
        # bot_addr should be a 42-char hex string starting with 0x
        assert ex.bot_addr.startswith("0x")
        assert len(ex.bot_addr) == 42
        # Should be checksummed (mixed case or all-lower is fine, but not empty)
        assert ex.bot_addr != ""

    def test_invalid_key_raises(self):
        """Executor with an invalid private key raises an exception."""
        with pytest.raises(Exception):
            Executor(
                rpc_url="http://localhost:8545",
                private_key="not-a-valid-key",
                vision_addr="0x" + "11" * 20,
                usdc_addr="0x" + "22" * 20,
            )


# ── discover_oracles ────────────────────────────────────────────


class TestDiscoverOracles:
    def test_static_mode_returns_urls(self):
        """Static mode returns the provided URLs directly."""
        urls = ["http://oracle1:10001", "http://oracle2:10002"]
        result = discover_oracles(mode="static", static_urls=urls)
        assert result == urls

    def test_dynamic_mode_falls_back_on_error(self):
        """Dynamic mode with w3=None falls back to static URLs."""
        from framework import chain as chain_mod
        static = ["http://fallback:10001"]
        # Clear the module-level cache so prior tests can't bleed in.
        chain_mod._ORACLE_DISCOVERY_CACHE["urls"] = []
        chain_mod._ORACLE_DISCOVERY_CACHE["ts"] = 0.0
        result = discover_oracles(
            mode="dynamic",
            static_urls=static,
            w3=None,
            registry_addr="0x" + "33" * 20,
        )
        assert result == static


# ── submit_bitmap ───────────────────────────────────────────────


class TestSubmitBitmap:
    @patch("framework.chain.requests.post")
    def test_successful_submission(self, mock_post):
        """Successful POST to all oracles returns correct acceptance count."""
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_post.return_value = mock_resp

        urls = ["http://oracle1:10001", "http://oracle2:10002"]
        bitmap = b"\xaa"
        bitmap_hash = b"\xbb" * 32

        count = submit_bitmap(
            oracle_urls=urls,
            player="0xABCD",
            batch_id=42,
            bitmap=bitmap,
            bitmap_hash=bitmap_hash,
        )

        assert count == 2
        assert mock_post.call_count == 2

        # Verify payload of first call
        call_args = mock_post.call_args_list[0]
        assert call_args[0][0] == "http://oracle1:10001/vision/bitmap"
        payload = call_args[1]["json"]
        assert payload["player"] == "0xABCD"
        assert payload["batch_id"] == 42
        assert payload["bitmap_hex"] == "0x" + bitmap.hex()
        assert payload["expected_hash"] == "0x" + bitmap_hash.hex()

    @patch("framework.chain.requests.post")
    @patch("framework.chain.time.sleep")
    def test_retry_on_failure(self, mock_sleep, mock_post):
        """First attempt fails (transient), second succeeds — still counts as accepted."""
        import requests as req

        ok_resp = MagicMock()
        ok_resp.ok = True

        # First call: a transient connection error. Second: success.
        # ConnectionError is in our retry-eligible list; bare RequestException is not.
        mock_post.side_effect = [req.ConnectionError("network blip"), ok_resp]

        count = submit_bitmap(
            oracle_urls=["http://oracle1:10001"],
            player="0xABCD",
            batch_id=1,
            bitmap=b"\xff",
            bitmap_hash=b"\x00" * 32,
            retries=3,
            enforce_quorum=False,
        )

        assert count == 1
        assert mock_post.call_count == 2
        # Sleep is exponential + jitter; we only check it ran at least once.
        assert mock_sleep.call_count >= 1


# ── fetch_batches ───────────────────────────────────────────────


class TestFetchBatches:
    @patch("framework.chain.requests.get")
    def test_successful_fetch(self, mock_get):
        """Successful response returns batch list."""
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "batches": [
                {"id": 1, "market_count": 5},
                {"id": 2, "market_count": 10},
            ]
        }
        mock_get.return_value = mock_resp

        result = fetch_batches("http://oracle:10001")
        assert len(result) == 2
        assert result[0]["id"] == 1
        assert result[1]["market_count"] == 10

        mock_get.assert_called_once_with(
            "http://oracle:10001/vision/batches", timeout=10
        )


# ── fetch_markets ───────────────────────────────────────────────


class TestFetchMarkets:
    @patch("framework.chain.requests.get")
    def test_returns_matched_and_default_markets(self, mock_get):
        """Markets found in snapshot are returned with data; missing ones get defaults."""
        mock_resp = MagicMock()
        mock_resp.ok = True
        mock_resp.json.return_value = {
            "markets": [
                {
                    "id": "BTC",
                    "price": 60000.0,
                    "change": 2.5,
                    "volume": 1e9,
                    "market_cap": 1.2e12,
                },
                {
                    "id": "ETH",
                    "price": 3000.0,
                    "change": -1.0,
                    "volume": 5e8,
                    "market_cap": 3.6e11,
                },
            ]
        }
        mock_get.return_value = mock_resp

        result = fetch_markets(
            data_node_url="http://datanode:8200",
            market_ids=["BTC", "DOGE", "ETH"],
        )

        assert len(result) == 3

        # BTC found
        assert result[0]["id"] == "BTC"
        assert result[0]["price"] == 60000.0
        assert result[0]["change"] == 2.5

        # DOGE missing -> default
        assert result[1]["id"] == "DOGE"
        assert result[1]["price"] == 0
        assert result[1]["change"] is None
        assert result[1]["volume"] is None
        assert result[1]["market_cap"] is None

        # ETH found
        assert result[2]["id"] == "ETH"
        assert result[2]["price"] == 3000.0
