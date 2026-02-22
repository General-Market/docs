"""
Chain interaction layer for Vision bots.

All on-chain reads/writes, issuer discovery, bitmap submission,
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
                    {"name": "stakePerTick", "type": "uint256"},
                    {"name": "startTick", "type": "uint256"},
                    {"name": "balance", "type": "uint256"},
                    {"name": "lastClaimedTick", "type": "uint256"},
                    {"name": "joinTimestamp", "type": "uint256"},
                    {"name": "totalDeposited", "type": "uint256"},
                    {"name": "totalClaimed", "type": "uint256"},
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
                    {"name": "marketIds", "type": "bytes32[]"},
                    {"name": "resolutionTypes", "type": "uint8[]"},
                    {"name": "tickDuration", "type": "uint256"},
                    {"name": "customThresholds", "type": "uint256[]"},
                    {"name": "createdAtTick", "type": "uint256"},
                    {"name": "paused", "type": "bool"},
                ],
            }
        ],
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
]

ISSUER_REGISTRY_ABI = [
    {
        "name": "getActiveIssuerEndpoints",
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
            "stakePerTick": raw[1],
            "startTick": raw[2],
            "balance": raw[3],
            "lastClaimedTick": raw[4],
            "joinTimestamp": raw[5],
            "totalDeposited": raw[6],
            "totalClaimed": raw[7],
        }

    def get_batch_market_count(self, batch_id: int) -> int:
        """Return the number of markets in a batch."""
        info = self.vision.functions.getBatch(batch_id).call()
        return len(info[1])  # marketIds array

    # ── write: join flow ──

    def approve_usdc(self, amount: int):
        """Approve the Vision contract to spend USDC."""
        tx = self.usdc.functions.approve(
            Web3.to_checksum_address(self.vision.address), amount
        ).build_transaction(self._build_tx(gas=200_000))
        self._sign_and_send(tx)
        logger.info("USDC approved: %d", amount)

    def join_batch(
        self, batch_id: int, deposit: int, stake: int, bitmap_hash: bytes
    ):
        """Call Vision.joinBatch on-chain."""
        tx = self.vision.functions.joinBatch(
            batch_id, deposit, stake, bitmap_hash
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

    def update_bitmap(self, batch_id: int, new_hash: bytes):
        """Update bitmap hash on-chain."""
        tx = self.vision.functions.updateBitmap(
            batch_id, new_hash
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


# ── Issuer discovery ───────────────────────────────────────────


def discover_issuers(
    mode: str,
    static_urls: list[str],
    w3=None,
    registry_addr: str = "",
    _cache: dict = {},
) -> list[str]:
    """
    Return list of issuer endpoint URLs.

    mode="static": return static_urls directly.
    mode="dynamic": call IssuerRegistry.getActiveIssuerEndpoints() on-chain,
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
            abi=ISSUER_REGISTRY_ABI,
        )
        raw_endpoints = registry.functions.getActiveIssuerEndpoints().call()
        # bytes32 -> trimmed UTF-8 string
        urls = []
        for ep in raw_endpoints:
            url = ep.rstrip(b"\x00").decode("utf-8", errors="ignore")
            if url:
                urls.append(url)
        _cache["urls"] = urls
        _cache["ts"] = now
        logger.info("Discovered %d issuers from registry", len(urls))
        return urls
    except Exception as e:
        logger.warning("Dynamic issuer discovery failed: %s — falling back to static", e)
        return static_urls


# ── Bitmap submission ──────────────────────────────────────────


def submit_bitmap(
    issuer_urls: list[str],
    player: str,
    batch_id: int,
    bitmap: bytes,
    bitmap_hash: bytes,
    retries: int = 3,
) -> int:
    """POST /vision/bitmap to each issuer. Returns acceptance count."""
    accepted = 0
    for url in issuer_urls:
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
            except requests.RequestException:
                if attempt < retries - 1:
                    time.sleep(1)
    logger.info(
        "Bitmap submitted to %d/%d issuers", accepted, len(issuer_urls)
    )
    return accepted


# ── Batch fetching ─────────────────────────────────────────────


def fetch_batches(api_url: str) -> list[dict]:
    """GET /vision/batches from issuer API."""
    try:
        resp = requests.get(f"{api_url}/vision/batches", timeout=10)
        if resp.ok:
            data = resp.json()
            return data.get("batches", data if isinstance(data, list) else [])
    except requests.RequestException:
        pass
    return []


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
