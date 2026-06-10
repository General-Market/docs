#!/usr/bin/env python3
"""
Vision Bot — autonomous prediction market trader.

Discovers the current round's Vision batches, joins them with UP/DOWN
predictions, submits bitmaps to oracles, tracks PnL. Auto-faucets
testnet USDC on startup if balance is low.

A batch lives exactly one round: the oracle settles it one tick after
creation and mints a fresh batch per source, so the loop joins new
batch ids every round.

Usage:
    cp .env.example .env   # add BOT_PRIVATE_KEY
    pip install -r requirements.txt
    python bot.py
"""

import hashlib
import json
import logging
import math
import os
import random
import sys
import time

# ── .env loader (no dependency) ──────────────────────────────────

def _load_dotenv():
    for p in [".env", "../.env"]:
        if os.path.exists(p):
            with open(p) as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, _, val = line.partition("=")
                    key, val = key.strip(), val.strip().strip("'\"")
                    if key and key not in os.environ:
                        os.environ[key] = val
            break

_load_dotenv()

import requests
from web3 import Web3

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("vision-bot")

DECIMALS = 18  # L3 USDC uses 18 decimals

# ── Config ───────────────────────────────────────────────────────

def load_config() -> dict:
    defaults = {
        "strategy": "random",
        "deposit": 10.0,
        # "stake" is read for backward compatibility but NOT used on-chain:
        # joinBatchDirect has no stake parameter — the deposit is the stake.
        "stake": 1.0,
        # max joins per cycle. Batches live one round, so this is a per-cycle
        # throttle, not a lifetime cap.
        "max_batches": 50,
        "max_exposure": 1000.0,
        "poll_interval": 30,
        "rpc_url": "https://rpc.generalmarket.io/",
        "api_url": "https://generalmarket.io/api",
        # Live Vision contract (source of truth: frontend/lib/contracts/deployment.json)
        "vision_address": "0x36a28967544c301a3c66dcfb6c6c90e548412693",
        "auto_faucet": True,
        "faucet_amount": 1000,
        "pnl_file": "pnl.json",
        "batch_ids": [],
    }
    for p in ["config.toml", "../config.toml"]:
        if os.path.exists(p):
            try:
                try:
                    import tomllib
                except ImportError:
                    import tomli as tomllib
                with open(p, "rb") as f:
                    defaults.update(tomllib.load(f))
            except ImportError:
                pass
            break
    env_map = {
        "STRATEGY": "strategy",
        "DEPOSIT_AMOUNT": "deposit",
        "STAKE_PER_TICK": "stake",
        "MAX_BATCHES": "max_batches",
        "MAX_EXPOSURE": "max_exposure",
        "POLL_INTERVAL": "poll_interval",
        "L3_RPC_URL": "rpc_url",
        "RPC_URL": "rpc_url",
        "API_URL": "api_url",
        "VISION_ADDRESS": "vision_address",
        "PNL_FILE": "pnl_file",
    }
    for env_key, conf_key in env_map.items():
        if env_key in os.environ:
            val = os.environ[env_key]
            t = type(defaults[conf_key])
            if t == bool:
                defaults[conf_key] = val.lower() in ("true", "1", "yes")
            elif t == float:
                defaults[conf_key] = float(val)
            elif t == int:
                defaults[conf_key] = int(float(val))
            else:
                defaults[conf_key] = val
    if "BATCH_IDS" in os.environ:
        defaults["batch_ids"] = [int(x) for x in os.environ["BATCH_IDS"].split(",") if x.strip()]
    return defaults


# ── ABIs ─────────────────────────────────────────────────────────

VISION_ABI = [
    {
        # Live signature — 4 params, selector 0xa092fd46. There is no stake
        # parameter: the deposit is the stake for the round.
        "name": "joinBatchDirect",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "depositAmount", "type": "uint256"},
            {"name": "bitmapHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "getPosition",
        "type": "function",
        "stateMutability": "view",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "player", "type": "address"},
        ],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "bitmapHash", "type": "bytes32"},
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
                ],
            }
        ],
    },
    {
        "name": "registerBot",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "endpoint", "type": "string"},
            {"name": "pubkeyHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "getBatch",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "batchId", "type": "uint256"}],
        "outputs": [
            {
                "name": "",
                "type": "tuple",
                "components": [
                    {"name": "creator", "type": "address"},
                    {"name": "sourceId", "type": "bytes32"},
                    {"name": "configHash", "type": "bytes32"},
                    {"name": "tickDuration", "type": "uint256"},
                    {"name": "lockOffset", "type": "uint256"},
                    {"name": "settlementGrace", "type": "uint256"},
                    {"name": "createdAtTick", "type": "uint256"},
                    {"name": "paused", "type": "bool"},
                    {"name": "settled", "type": "bool"},
                ],
            }
        ],
    },
    {
        "name": "nextBatchId",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "USDC",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "address"}],
    },
]

ERC20_ABI = [
    {
        "name": "approve",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "spender", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [{"name": "", "type": "bool"}],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "account", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]


# ── Bitmap encoding ──────────────────────────────────────────────

def encode_bitmap(bets: list[str], count: int) -> bytes:
    byte_count = math.ceil(count / 8)
    bitmap = bytearray(byte_count)
    for i in range(count):
        if bets[i] == "UP":
            bitmap[i // 8] |= 1 << (7 - (i % 8))
    return bytes(bitmap)


def hash_bitmap(bitmap: bytes) -> bytes:
    return Web3.keccak(bitmap)


# ── Strategies ───────────────────────────────────────────────────

def make_strategy(name: str, private_key: str):
    seed = int(hashlib.sha256(f"{private_key}:{name}".encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)

    strategies = {
        "random":     lambda markets: [rng.choice(["UP", "DOWN"]) for _ in markets],
        "momentum":   lambda markets: ["UP" if (m.get("change") or 0) >= 0 else "DOWN" for m in markets],
        "contrarian": lambda markets: ["DOWN" if (m.get("change") or 0) >= 0 else "UP" for m in markets],
        "bullish":    lambda markets: [rng.choice(["UP", "UP", "UP", "DOWN"]) for _ in markets],
        "bearish":    lambda markets: [rng.choice(["UP", "DOWN", "DOWN", "DOWN"]) for _ in markets],
    }

    if name not in strategies:
        log.warning("Unknown strategy '%s', falling back to random", name)
        name = "random"

    return strategies[name]


# ── Chain interaction ────────────────────────────────────────────

class Bot:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        private_key = os.environ.get("BOT_PRIVATE_KEY", "")
        if not private_key:
            log.error("BOT_PRIVATE_KEY env var required")
            sys.exit(1)

        self.w3 = Web3(Web3.HTTPProvider(cfg["rpc_url"]))
        self.account = self.w3.eth.account.from_key(private_key)
        self.address = self.account.address

        vision_addr = Web3.to_checksum_address(cfg["vision_address"])
        self.vision = self.w3.eth.contract(address=vision_addr, abi=VISION_ABI)

        # Read USDC address from Vision contract
        try:
            usdc_addr = self.vision.functions.USDC().call()
            log.info("USDC from Vision contract: %s", usdc_addr)
        except Exception:
            # L3_WUSDC from frontend/lib/contracts/deployment.json
            usdc_addr = "0xaddB799BC1499b224DC4368e92b9042a54908553"
            log.warning("Cannot read USDC from Vision, using fallback: %s", usdc_addr)

        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_addr), abi=ERC20_ABI,
        )

        self.strategy = make_strategy(cfg["strategy"], private_key)
        self.joined: set[int] = set()
        self.pnl: dict[int, dict] = {}
        self._approved = False
        self._load_pnl()

    def _build_tx(self, gas: int = 300_000) -> dict:
        return {
            "from": self.address,
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "nonce": self.w3.eth.get_transaction_count(self.address, "pending"),
        }

    def _send(self, tx: dict) -> bytes:
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
        if receipt["status"] == 0:
            raise RuntimeError(f"Tx reverted: {tx_hash.hex()}")
        return tx_hash

    def usdc_balance(self) -> int:
        return self.usdc.functions.balanceOf(self.address).call()

    # ── Faucet ──

    def auto_faucet(self):
        """Top up testnet USDC. POST /api/faucet is waitlist-gated by default;
        on 403 WAITLIST_REQUIRED we fall back to POST /api/bot/faucet (fixed
        100 USDC + 1 GM, one claim per IP per 24h, same waitlist gate)."""
        if not self.cfg.get("auto_faucet", False):
            return
        balance = self.usdc_balance()
        deposit_needed = int(self.cfg["deposit"] * 10**DECIMALS)
        if balance >= deposit_needed:
            return

        amount = max(int(self.cfg.get("faucet_amount", 1000)), int(self.cfg["deposit"] * 2))
        log.info("Balance %d USDC — requesting %d from faucet", balance // 10**DECIMALS, amount)
        try:
            resp = requests.post(
                f"{self.cfg['api_url']}/faucet",
                json={"address": self.address, "amount": str(amount)},
                timeout=60,
            )
        except Exception as e:
            log.warning("Faucet error: %s", e)
            return

        body = {}
        try:
            body = resp.json()
        except Exception:
            pass

        if resp.ok:
            usdc_leg = body.get("vision", {}).get("usdc", {})
            log.info("Faucet OK: %s", usdc_leg.get("amount") or usdc_leg.get("error") or "done")
            return

        if resp.status_code == 429:
            log.warning(
                "Faucet cooldown (30s per address) — retry in %ss",
                body.get("retryAfter", 30),
            )
            return

        if resp.status_code == 403 and body.get("error") == "WAITLIST_REQUIRED":
            log.warning(
                "Main faucet refused: this address is not on the waitlist (join at %s)",
                body.get("waitlistUrl", "https://generalmarket.io/?waitlist=1"),
            )
            log.info("Trying the bot faucet instead (100 USDC + 1 GM, one claim per IP per 24h)...")
            self._bot_faucet()
            return

        log.warning("Faucet failed: %d %s", resp.status_code, resp.text[:200])

    def _bot_faucet(self):
        try:
            resp = requests.post(
                f"{self.cfg['api_url']}/bot/faucet",
                json={"address": self.address},
                timeout=90,
            )
        except Exception as e:
            log.warning("Bot faucet error: %s", e)
            return

        body = {}
        try:
            body = resp.json()
        except Exception:
            pass

        if resp.ok:
            log.info(
                "Bot faucet OK: %s + %s",
                body.get("usdc", {}).get("amount", "?"),
                body.get("l3Gas", {}).get("amount", "?"),
            )
        elif resp.status_code == 403 and body.get("error") == "WAITLIST_REQUIRED":
            log.error(
                "Bot faucet refused too — both faucets are waitlist-gated. "
                "Join the waitlist with this address first: %s",
                body.get("waitlistUrl", "https://generalmarket.io/?waitlist=1"),
            )
        elif resp.status_code == 429:
            log.warning("Bot faucet rate-limited (one claim per IP per 24h): %s",
                        body.get("error", resp.text[:200]))
        else:
            log.warning("Bot faucet failed: %d %s", resp.status_code, resp.text[:200])

    # ── Registration ──

    def register(self):
        try:
            endpoint = f"http://bot-{self.address[:8]}"
            pubkey_hash = Web3.keccak(text=f"bot-{self.address}")
            tx = self.vision.functions.registerBot(
                endpoint, pubkey_hash
            ).build_transaction(self._build_tx(gas=200_000))
            self._send(tx)
            log.info("Bot registered")
        except Exception as e:
            if "AlreadyRegistered" in str(e):
                log.info("Bot already registered")
            else:
                log.warning("Registration failed: %s", e)

    # ── Batch discovery ──

    def fetch_batches(self) -> list[dict]:
        """Fetch active batches from public API, fall back to on-chain scan."""
        api_url = self.cfg["api_url"]
        try:
            resp = requests.get(f"{api_url}/vision/batches", timeout=10)
            if resp.ok:
                data = resp.json()
                batches = data.get("batches", data if isinstance(data, list) else [])
                if batches:
                    return batches
        except Exception:
            pass

        # Fallback: scan the chain directly. A batch lives one round, so only
        # the most recent ids can still be open — scan the last 100, not all.
        log.info("API unavailable, scanning chain for recent batches...")
        try:
            count = self.vision.functions.nextBatchId().call()
            batches = []
            for i in range(max(0, count - 100), count):
                try:
                    # Batch: (creator, sourceId, configHash, tickDuration,
                    #         lockOffset, settlementGrace, createdAtTick,
                    #         paused, settled)
                    info = self.vision.functions.getBatch(i).call()
                    if info[0] != "0x" + "0" * 40 and not info[7] and not info[8]:
                        batches.append({
                            "id": i,
                            "config_hash": "0x" + info[2].hex(),
                            "market_count": 0,
                            "paused": False,
                        })
                except Exception:
                    pass
            log.info("Found %d open batches on-chain", len(batches))
            return batches
        except Exception as e:
            log.warning("Chain scan failed: %s", e)
            return []

    def fetch_batch_config(self, config_hash: str) -> list[str] | None:
        """Fetch market IDs for a batch by config hash.

        /vision/config/by-hash/{hash} is the public API route; the raw
        data-node path /batches/config/{hash} is kept as a fallback for
        api_url values that point straight at a data-node.
        """
        if not config_hash or config_hash == "0x" + "00" * 32:
            return None
        api_url = self.cfg["api_url"]
        for path in (
            f"/vision/config/by-hash/{config_hash}",
            f"/batches/config/{config_hash}",
        ):
            try:
                resp = requests.get(f"{api_url}{path}", timeout=10)
                if resp.ok:
                    markets = resp.json().get("markets") or []
                    ids = [m.get("assetId") or m.get("asset_id") for m in markets]
                    if ids and all(ids):
                        return ids
            except Exception:
                pass
        return None

    # ── Join + predict ──

    def join_batch(self, batch_id: int) -> bool:
        """Join a single batch: approve USDC, join with bitmap, submit to oracles.

        Returns True only when a fresh join landed on-chain.
        """
        deposit_wei = int(self.cfg["deposit"] * 10**DECIMALS)

        # Check balance
        if self.usdc_balance() < deposit_wei:
            log.warning("Batch %d: insufficient USDC", batch_id)
            return False

        # Already joined on-chain? (totalDeposited != 0 is the joined sentinel —
        # this pre-check is the reliable AlreadyJoined guard)
        try:
            pos = self.vision.functions.getPosition(batch_id, self.address).call()
            if pos[3] > 0:  # totalDeposited
                log.debug("Batch %d: already joined on-chain", batch_id)
                self.joined.add(batch_id)
                return False
        except Exception:
            pass

        # Get configHash from chain
        try:
            info = self.vision.functions.getBatch(batch_id).call()
            config_hash = info[2]
        except Exception as e:
            log.warning("Batch %d: cannot read from chain: %s", batch_id, e)
            return False

        # Get market list by config hash
        config_hash_hex = "0x" + config_hash.hex() if isinstance(config_hash, bytes) else config_hash
        market_ids = self.fetch_batch_config(config_hash_hex)
        if not market_ids:
            log.warning("Batch %d: cannot fetch market config — skipping", batch_id)
            return False

        market_count = len(market_ids)

        # Generate predictions
        markets = [{"id": mid, "change": None} for mid in market_ids]
        bets = self.strategy(markets)
        while len(bets) < market_count:
            bets.append(random.choice(["UP", "DOWN"]))

        bitmap = encode_bitmap(bets, market_count)
        bm_hash = hash_bitmap(bitmap)

        ups = sum(1 for b in bets if b == "UP")
        log.info("Batch %d: %d markets, %d UP / %d DOWN", batch_id, market_count, ups, len(bets) - ups)

        # Approve once
        if not self._approved:
            tx = self.usdc.functions.approve(
                self.vision.address, 2**256 - 1
            ).build_transaction(self._build_tx(gas=200_000))
            self._send(tx)
            self._approved = True

        # Join on-chain — 4-param joinBatchDirect, no stake argument
        try:
            tx = self.vision.functions.joinBatchDirect(
                batch_id, config_hash, deposit_wei, bm_hash
            ).build_transaction(self._build_tx(gas=500_000))
            self._send(tx)
        except Exception as e:
            if "AlreadyJoined" in str(e):
                log.info("Batch %d: already joined", batch_id)
                self.joined.add(batch_id)
            else:
                log.warning("Batch %d: join failed: %s", batch_id, e)
            return False

        # Submit bitmap to oracles
        time.sleep(2)
        self._submit_bitmap(batch_id, bitmap, bm_hash)

        self.joined.add(batch_id)
        self.pnl[batch_id] = {
            "deposited": deposit_wei,
            "joined_at": time.time(),
            "market_count": market_count,
        }
        self._save_pnl()
        log.info("Batch %d: joined (%d markets)", batch_id, market_count)
        return True

    def _submit_bitmap(self, batch_id: int, bitmap: bytes, bm_hash: bytes):
        api_url = self.cfg["api_url"]
        urls = [api_url]
        accepted = 0
        for url in urls:
            for attempt in range(3):
                try:
                    resp = requests.post(
                        f"{url}/vision/bitmap",
                        json={
                            "player": self.address,
                            "batch_id": batch_id,
                            "bitmap_hex": "0x" + bitmap.hex(),
                            "expected_hash": "0x" + bm_hash.hex(),
                        },
                        timeout=10,
                    )
                    if resp.ok:
                        # The public API fans out to every oracle and returns
                        # 200 with {acceptedCount, totalCount, results} even
                        # when every oracle said no — check the count.
                        try:
                            data = resp.json()
                        except Exception:
                            data = {}
                        if "acceptedCount" in data and not data["acceptedCount"]:
                            errs = "; ".join(
                                str(r.get("error")) for r in data.get("results", [])
                            )
                            log.warning("Bitmap rejected by all oracles: %s", errs[:200])
                            break
                        accepted += 1
                        break
                    elif resp.status_code == 404 and attempt < 2:
                        time.sleep(2 ** attempt)
                        continue
                    else:
                        log.warning("Bitmap rejected by %s: %s", url, resp.text[:200])
                        break
                except Exception as e:
                    log.warning("Bitmap submit to %s failed: %s", url, e)
                    if attempt < 2:
                        time.sleep(1)
        if accepted:
            log.info("Bitmap accepted by %d oracle(s)", accepted)

    # ── PnL persistence ──

    def _save_pnl(self):
        try:
            with open(self.cfg["pnl_file"], "w") as f:
                json.dump({
                    "joined": list(self.joined),
                    "positions": {str(k): v for k, v in self.pnl.items()},
                }, f, indent=2)
        except Exception:
            pass

    def _load_pnl(self):
        try:
            if os.path.exists(self.cfg["pnl_file"]):
                with open(self.cfg["pnl_file"]) as f:
                    data = json.load(f)
                self.joined = set(data.get("joined", []))
                self.pnl = {int(k): v for k, v in data.get("positions", {}).items()}
        except Exception:
            pass

    # ── Main loop ──

    def run_cycle(self):
        """One pass: discover the current round's batches and join the new ones.

        A batch lives exactly one round — every tick the oracle settles the
        old batch and mints a fresh one per source, so each cycle brings NEW
        batch ids. `self.joined` only stops a re-join of an id we already
        hold; it never blocks the next round's batches, and `max_batches`
        caps joins per cycle, not for the bot's lifetime.
        """
        batches = self.fetch_batches()
        joined_this_cycle = 0
        for batch in batches:
            bid = batch.get("id", batch.get("batch_id"))
            if bid is None:
                continue
            if bid in self.joined:
                continue
            if batch.get("paused"):
                continue
            if self.cfg["batch_ids"] and bid not in self.cfg["batch_ids"]:
                continue
            if joined_this_cycle >= self.cfg["max_batches"]:
                break

            if self.join_batch(bid):
                joined_this_cycle += 1

        if joined_this_cycle:
            log.info("Joined %d new batch(es) this round (lifetime total: %d)",
                     joined_this_cycle, len(self.joined))
        else:
            log.info("No new batches to join this cycle (%d joined so far) — "
                     "new rounds mint new batch ids every tick", len(self.joined))


def main():
    cfg = load_config()
    bot = Bot(cfg)

    log.info("Vision Bot starting")
    log.info("  Strategy:    %s", cfg["strategy"])
    log.info("  Bot address: %s", bot.address)
    log.info("  RPC:         %s", cfg["rpc_url"])
    log.info("  API:         %s", cfg["api_url"])
    log.info("  Deposit:     %d USDC per round (the deposit is the stake)", cfg["deposit"])

    if cfg["batch_ids"]:
        log.warning("batch_ids pin %s set — batches live ONE round, so a pinned "
                    "id goes stale after one tick. Clear batch_ids to follow new rounds.",
                    cfg["batch_ids"])

    # Check connectivity
    try:
        chain_id = bot.w3.eth.chain_id
        log.info("  Chain ID:    %d", chain_id)
    except Exception as e:
        log.error("Cannot connect to RPC: %s", e)
        sys.exit(1)

    # The Vision address must hold code — a stale config (e.g. the retired
    # 0x821D7c… default) makes every call revert with no useful message.
    try:
        code = bot.w3.eth.get_code(bot.vision.address)
    except Exception:
        code = b"\x01"  # cannot check — proceed
    if not code:
        log.error(
            "No contract at %s. Set VISION_ADDRESS=0x36a28967544c301a3c66dcfb6c6c90e548412693 "
            "(or fix vision_address in config.toml) and restart.",
            bot.vision.address,
        )
        sys.exit(1)

    # Auto-faucet
    bot.auto_faucet()

    balance = bot.usdc_balance()
    log.info("  USDC balance: %d", balance // 10**DECIMALS)

    if balance == 0:
        log.error("No USDC. Add BOT_PRIVATE_KEY to .env and ensure faucet is reachable.")
        sys.exit(1)

    # Register
    bot.register()

    # Single run or loop
    if "--once" in sys.argv:
        bot.run_cycle()
        return

    try:
        while True:
            try:
                bot.run_cycle()
            except Exception as e:
                log.error("Cycle error: %s", e)
            time.sleep(cfg["poll_interval"])
    except KeyboardInterrupt:
        log.info("Shutting down")


if __name__ == "__main__":
    main()
