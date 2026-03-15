"""
Chain interaction layer for Vision bots.

All on-chain reads/writes, oracle discovery, bitmap submission,
and data-node fetching live here.
"""

import json
import logging
import os
import time

import requests
from web3 import Web3

logger = logging.getLogger("vision-bot")

# ── ABI fragments ──────────────────────────────────────────────

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

VISION_ABI = [
    {
        "name": "joinBatch",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "depositAmount", "type": "uint256"},
            {"name": "stakePerTick", "type": "uint256"},
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
                    {"name": "stakePerTick", "type": "uint256"},
                    {"name": "startTick", "type": "uint256"},
                    {"name": "balance", "type": "uint256"},
                    {"name": "lastClaimedTick", "type": "uint256"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
                    {"name": "isVirtual", "type": "bool"},
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
                    {"name": "nextConfigHash", "type": "bytes32"},
                    {"name": "tickDuration", "type": "uint256"},
                    {"name": "lockOffset", "type": "uint256"},
                    {"name": "nextLockOffset", "type": "uint256"},
                    {"name": "nextTickDuration", "type": "uint256"},
                    {"name": "epochOffset", "type": "int256"},
                    {"name": "createdAtTick", "type": "uint256"},
                    {"name": "lastPromotionTick", "type": "uint256"},
                    {"name": "paused", "type": "bool"},
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
        "name": "claimRewards",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "fromTick", "type": "uint256"},
            {"name": "toTick", "type": "uint256"},
            {"name": "newBalance", "type": "uint256"},
            {"name": "blsSig", "type": "bytes"},
        ],
        "outputs": [],
    },
    {
        "name": "withdraw",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "finalBalance", "type": "uint256"},
            {"name": "blsSig", "type": "bytes"},
        ],
        "outputs": [],
    },
    {
        "name": "updateBitmap",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "configHash", "type": "bytes32"},
            {"name": "newHash", "type": "bytes32"},
        ],
        "outputs": [],
    },
    {
        "name": "deposit",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "batchId", "type": "uint256"},
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "depositBalance",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "withdrawBalance",
        "type": "function",
        "stateMutability": "nonpayable",
        "inputs": [
            {"name": "amount", "type": "uint256"},
        ],
        "outputs": [],
    },
    {
        "name": "balanceOf",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "user", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
    {
        "name": "realBalance",
        "type": "function",
        "stateMutability": "view",
        "inputs": [{"name": "user", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
    },
]

ORACLE_REGISTRY_ABI = [
    {
        "name": "getActiveOracleEndpoints",
        "type": "function",
        "stateMutability": "view",
        "inputs": [],
        "outputs": [{"name": "", "type": "bytes32[]"}],
    },
]

# ── Deployment loader ──────────────────────────────────────────


def load_deployment() -> dict:
    """Load deployment addresses from the active deployment file."""
    paths = [
        "deployments/active-deployment.json",
        "../deployments/active-deployment.json",
        os.path.join(
            os.path.dirname(__file__), "..", "deployments", "active-deployment.json"
        ),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    raise FileNotFoundError("Cannot find active-deployment.json")


# ── Executor ───────────────────────────────────────────────────


class Executor:
    """Handles all on-chain reads and writes for a single bot wallet."""

    def __init__(
        self,
        rpc_url: str,
        private_key: str,
        vision_addr: str,
        usdc_addr: str,
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_addr), abi=VISION_ABI
        )
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_addr), abi=ERC20_ABI
        )
        self.account = self.w3.eth.account.from_key(private_key)
        self.bot_addr: str = self.account.address

    # ── internal ──

    def _build_tx(self, gas: int = 300_000) -> dict:
        return {
            "from": self.bot_addr,
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
        }

    def _sign_and_send(self, tx: dict) -> bytes:
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        self.w3.eth.wait_for_transaction_receipt(tx_hash)
        return tx_hash

    # ── read methods ──

    def usdc_balance(self) -> int:
        """Return USDC balance of this bot (raw wei)."""
        return self.usdc.functions.balanceOf(self.bot_addr).call()

    def get_position(self, batch_id: int) -> dict:
        """Read on-chain position for this bot in a batch."""
        raw = self.vision.functions.getPosition(batch_id, self.bot_addr).call()
        return {
            "bitmapHash": raw[0],
            "configHash": raw[1],
            "stakePerTick": raw[2],
            "startTick": raw[3],
            "balance": raw[4],
            "lastClaimedTick": raw[5],
            "joinTimestamp": raw[6],
            "totalDeposited": raw[7],
            "isVirtual": raw[8],
        }

    def get_batch_info(self, batch_id: int) -> dict:
        """Read batch struct from chain."""
        info = self.vision.functions.getBatch(batch_id).call()
        return {
            "creator": info[0],
            "sourceId": info[1],
            "configHash": info[2],
            "nextConfigHash": info[3],
            "tickDuration": info[4],
            "lockOffset": info[5],
            "nextLockOffset": info[6],
            "nextTickDuration": info[7],
            "epochOffset": info[8],
            "createdAtTick": info[9],
            "lastPromotionTick": info[10],
            "paused": info[11],
        }

    def next_batch_id(self) -> int:
        """Return the next batch ID (= total count of batches)."""
        return self.vision.functions.nextBatchId().call()

    # ── write: join flow ──

    def approve_usdc(self, amount: int):
        """Approve the Vision contract to spend USDC."""
        tx = self.usdc.functions.approve(
            Web3.to_checksum_address(self.vision.address), amount
        ).build_transaction(self._build_tx(gas=200_000))
        self._sign_and_send(tx)
        logger.info("USDC approved: %d", amount)

    def join_batch(
        self, batch_id: int, config_hash: bytes, deposit: int, stake: int, bitmap_hash: bytes
    ):
        """Call Vision.joinBatch on-chain."""
        tx = self.vision.functions.joinBatch(
            batch_id, config_hash, deposit, stake, bitmap_hash
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Joined batch %d (tx: %s)", batch_id, tx_hash.hex()[:16])

    def register_bot(self, endpoint: str = "", pubkey_hash: bytes = b""):
        """Register as a bot on the Vision contract."""
        if not endpoint:
            endpoint = f"http://bot-{self.bot_addr[:8]}"
        if not pubkey_hash:
            pubkey_hash = Web3.keccak(text=f"bot-{self.bot_addr}")
        tx = self.vision.functions.registerBot(
            endpoint, pubkey_hash
        ).build_transaction(self._build_tx(gas=200_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Bot registered (tx: %s)", tx_hash.hex()[:16])

    # ── write: lifecycle ──

    def claim_rewards(
        self,
        batch_id: int,
        from_tick: int,
        to_tick: int,
        new_balance: int,
        bls_sig: bytes,
    ):
        """Claim rewards for a tick range."""
        tx = self.vision.functions.claimRewards(
            batch_id, from_tick, to_tick, new_balance, bls_sig
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info(
            "Claimed rewards batch=%d ticks=%d-%d (tx: %s)",
            batch_id, from_tick, to_tick, tx_hash.hex()[:16],
        )

    def withdraw(self, batch_id: int, final_balance: int, bls_sig: bytes):
        """Withdraw from a batch."""
        tx = self.vision.functions.withdraw(
            batch_id, final_balance, bls_sig
        ).build_transaction(self._build_tx(gas=500_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("Withdraw batch=%d (tx: %s)", batch_id, tx_hash.hex()[:16])

    def update_bitmap(self, batch_id: int, config_hash: bytes, new_hash: bytes):
        """Update bitmap hash on-chain."""
        tx = self.vision.functions.updateBitmap(
            batch_id, config_hash, new_hash
        ).build_transaction(self._build_tx(gas=300_000))
        tx_hash = self._sign_and_send(tx)
        logger.info(
            "Bitmap updated batch=%d (tx: %s)", batch_id, tx_hash.hex()[:16]
        )

    def deposit_more(self, batch_id: int, amount: int):
        """Deposit additional USDC into a batch position."""
        tx = self.vision.functions.deposit(
            batch_id, amount
        ).build_transaction(self._build_tx(gas=300_000))
        tx_hash = self._sign_and_send(tx)
        logger.info(
            "Deposited %d more into batch=%d (tx: %s)",
            amount, batch_id, tx_hash.hex()[:16],
        )

    def deposit_balance(self, amount: int):
        """Deposit USDC into Vision balance (dual-balance architecture).
        Must approve USDC first. Credits realBalance[bot]."""
        tx = self.vision.functions.depositBalance(
            amount
        ).build_transaction(self._build_tx(gas=300_000))
        tx_hash = self._sign_and_send(tx)
        logger.info("depositBalance %d (tx: %s)", amount, tx_hash.hex()[:16])

    def vision_balance(self) -> int:
        """Read total Vision balance (realBalance + virtualBalance)."""
        return self.vision.functions.balanceOf(self.bot_addr).call()


# ── Oracle discovery ───────────────────────────────────────────


def discover_oracles(
    mode: str,
    static_urls: list[str],
    w3=None,
    registry_addr: str = "",
    _cache: dict = {},
) -> list[str]:
    """
    Return list of oracle endpoint URLs.

    mode="static": return static_urls directly.
    mode="dynamic": call OracleRegistry.getActiveOracleEndpoints() on-chain,
                    cache for 5 min, fallback to static_urls on error.
    """
    if mode == "static":
        return static_urls

    # dynamic mode
    now = time.time()
    if _cache.get("urls") and now - _cache.get("ts", 0) < 300:
        return _cache["urls"]

    try:
        if w3 is None:
            raise RuntimeError("w3 not provided for dynamic discovery")
        registry = w3.eth.contract(
            address=Web3.to_checksum_address(registry_addr),
            abi=ORACLE_REGISTRY_ABI,
        )
        raw_endpoints = registry.functions.getActiveOracleEndpoints().call()
        # bytes32 -> trimmed UTF-8 string
        urls = []
        for ep in raw_endpoints:
            url = ep.rstrip(b"\x00").decode("utf-8", errors="ignore")
            if url:
                urls.append(url)
        _cache["urls"] = urls
        _cache["ts"] = now
        logger.info("Discovered %d oracles from registry", len(urls))
        return urls
    except Exception as e:
        logger.warning("Dynamic oracle discovery failed: %s — falling back to static", e)
        return static_urls


# ── Bitmap submission ──────────────────────────────────────────


def submit_bitmap(
    oracle_urls: list[str],
    player: str,
    batch_id: int,
    bitmap: bytes,
    bitmap_hash: bytes,
    retries: int = 3,
) -> int:
    """POST /vision/bitmap to each oracle. Returns acceptance count."""
    accepted = 0
    for url in oracle_urls:
        for attempt in range(retries):
            try:
                resp = requests.post(
                    f"{url}/vision/bitmap",
                    json={
                        "player": player,
                        "batch_id": batch_id,
                        "bitmap_hex": "0x" + bitmap.hex(),
                        "expected_hash": "0x" + bitmap_hash.hex(),
                    },
                    timeout=10,
                )
                if resp.ok:
                    accepted += 1
                    break
                else:
                    logger.warning(
                        "Bitmap rejected by %s: %d %s",
                        url, resp.status_code, resp.text[:200],
                    )
                    if resp.status_code == 404 and attempt < retries - 1:
                        time.sleep(2 ** attempt)  # 1s, 2s, 4s backoff
                        continue
                    break  # don't retry other errors (400, 500)
            except requests.RequestException as e:
                logger.warning("Bitmap POST to %s failed: %s", url, e)
                if attempt < retries - 1:
                    time.sleep(1)
    logger.info(
        "Bitmap submitted to %d/%d oracles", accepted, len(oracle_urls)
    )
    return accepted


# ── Batch fetching ─────────────────────────────────────────────


def load_batch_mapping() -> dict:
    """Load vision-batches.json produced by DeployAllVisionBatches."""
    paths = [
        "deployments/vision-batches.json",
        "../deployments/vision-batches.json",
        os.path.join(os.path.dirname(__file__), "..", "..", "deployments", "vision-batches.json"),
    ]
    for p in paths:
        if os.path.exists(p):
            with open(p) as f:
                return json.load(f)
    return {}


def fetch_batches(api_url: str, executor=None) -> list[dict]:
    """
    Get available batches. Tries oracle API first, then falls back to
    vision-batches.json + on-chain reads.
    """
    # Try oracle API
    try:
        resp = requests.get(f"{api_url}/vision/batches", timeout=10)
        if resp.ok:
            data = resp.json()
            batches = data.get("batches", data if isinstance(data, list) else [])
            if batches:
                return batches
    except requests.RequestException:
        pass

    # Fallback: vision-batches.json (always available after DeployAllVisionBatches)
    mapping = load_batch_mapping()
    if mapping and mapping.get("batches"):
        batches = []
        for source_name, entry in mapping["batches"].items():
            if source_name.startswith("e2e_test_"):
                continue  # skip E2E test batches
            batches.append({
                "id": entry["batchId"],
                "batch_id": entry["batchId"],
                "source_name": source_name,
                "config_hash": entry["configHash"],
                "market_count": 10,  # default for hash-based design
                "paused": False,
            })
        if batches:
            logger.info("Loaded %d batches from vision-batches.json", len(batches))
            return batches

    # Last resort: on-chain scan
    if executor:
        try:
            count = executor.next_batch_id()
            batches = []
            for i in range(count):
                try:
                    info = executor.get_batch_info(i)
                    if info["creator"] != "0x" + "0" * 40 and not info["paused"]:
                        batches.append({
                            "id": i,
                            "batch_id": i,
                            "config_hash": "0x" + info["configHash"].hex(),
                            "market_count": 10,
                            "paused": False,
                        })
                except Exception:
                    pass
            if batches:
                logger.info("Loaded %d batches from chain", len(batches))
                return batches
        except Exception as e:
            logger.warning("On-chain batch scan failed: %s", e)

    return []


# ── Batch config fetching ─────────────────────────────────────


def fetch_batch_config(data_node_url: str, config_hash: str):
    """
    Fetch batch config from data-node by configHash.
    Returns dict with 'markets' (list of asset dicts) and 'sourceId', or None on failure.
    """
    if not config_hash:
        return None
    if not config_hash.startswith("0x"):
        config_hash = "0x" + config_hash
    try:
        resp = requests.get(
            f"{data_node_url}/batches/config/{config_hash}", timeout=10
        )
        if resp.ok:
            return resp.json()
    except requests.RequestException as e:
        logger.debug("Failed to fetch config %s: %s", config_hash[:18], e)
    return None


# ── Market data fetching ──────────────────────────────────────


def fetch_markets(data_node_url: str, market_ids: list[str]) -> list[dict]:
    """
    GET /vision/snapshot from data-node.
    Returns list of dicts matching Strategy.predict() input format.
    """
    default = [
        {"id": mid, "price": 0, "change": None, "volume": None, "market_cap": None}
        for mid in market_ids
    ]
    try:
        resp = requests.get(f"{data_node_url}/vision/snapshot", timeout=10)
        if resp.ok:
            data = resp.json()
            by_id = {m["id"]: m for m in data.get("markets", [])}
            result = []
            for mid in market_ids:
                if mid in by_id:
                    m = by_id[mid]
                    result.append(
                        {
                            "id": mid,
                            "price": m.get("price", 0),
                            "change": m.get("change"),
                            "volume": m.get("volume"),
                            "market_cap": m.get("market_cap"),
                        }
                    )
                else:
                    result.append(
                        {
                            "id": mid,
                            "price": 0,
                            "change": None,
                            "volume": None,
                            "market_cap": None,
                        }
                    )
            return result
    except requests.RequestException:
        pass
    return default
