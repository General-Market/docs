import json
import os
import time
import requests
from pathlib import Path
from web3 import Web3
from eth_account import Account


ABI_DIR = Path(__file__).parent / "abi"


class VisionBot:
    def __init__(
        self,
        rpc_url: str,
        vision_address: str,
        usdc_address: str,
        private_key: str,
        data_node_url: str,
        oracles: list[str],
        dry_run: bool = False,
    ):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            raise RuntimeError(f"RPC unreachable: {rpc_url}")

        self.dry_run = dry_run
        # In dry-run we tolerate an absent private key — reads still need an address slot.
        if private_key:
            self.account = Account.from_key(private_key)
            self.bot_addr = self.account.address
        else:
            self.account = None
            self.bot_addr = "0x000000000000000000000000000000000000dEaD"

        with open(ABI_DIR / "Vision.json") as f:
            vision_abi = json.load(f)["abi"]
        with open(ABI_DIR / "ERC20.json") as f:
            erc20_abi = json.load(f)["abi"]

        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_address),
            abi=vision_abi,
        )
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(usdc_address),
            abi=erc20_abi,
        )
        self.data_node_url = data_node_url.rstrip("/")
        self.oracles = [u.rstrip("/") for u in oracles]

    # ── read: batch metadata ──
    def get_batch(self, batch_id: int) -> dict:
        b = self.vision.functions.getBatch(batch_id).call()
        return {
            "creator":         b[0],
            "source_id":       int(b[1]),
            "config_hash":     b[2],
            "tick_duration":   int(b[3]),
            "lock_offset":     int(b[4]),
            "created_at_tick": int(b[5]),
            "paused":          bool(b[6]),
            "settled":         bool(b[7]),
        }

    def fetch_markets(self, config_hash: bytes) -> list[dict]:
        url = f"{self.data_node_url}/batches/config/0x{config_hash.hex()}"
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        return r.json()["markets"]

    # ── write: approve + join ──
    def _build_tx(self, gas: int) -> dict:
        return {
            "from": self.bot_addr,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
            "gas": gas,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id,
        }

    def _send(self, tx: dict) -> bytes:
        if self.dry_run:
            print(f"  [DRY-RUN] would send tx: to={tx.get('to','(built)')} gas={tx['gas']}")
            return b"\x00" * 32
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        if receipt.status != 1:
            raise RuntimeError(f"Tx reverted: {tx_hash.hex()}")
        return tx_hash

    def approve_usdc(self, amount_wei: int):
        tx = self.usdc.functions.approve(
            self.vision.address, amount_wei
        ).build_transaction(self._build_tx(gas=200_000))
        return self._send(tx)

    def join_batch(
        self,
        batch_id: int,
        config_hash: bytes,
        deposit_wei: int,
        bitmap_hash: bytes,
    ) -> bytes:
        tx = self.vision.functions.joinBatchDirect(
            batch_id, config_hash, deposit_wei, bitmap_hash
        ).build_transaction(self._build_tx(gas=500_000))
        return self._send(tx)

    # ── write: reveal bitmap to oracles ──
    def submit_bitmap(
        self,
        batch_id: int,
        bitmap: bytes,
        bitmap_hash: bytes,
        timeout: float = 5.0,
    ) -> int:
        payload = {
            "player": self.bot_addr,
            "batch_id": batch_id,
            "bitmap_hex": "0x" + bitmap.hex(),
            "expected_hash": "0x" + bitmap_hash.hex(),
        }
        if self.dry_run:
            print(f"  [DRY-RUN] would POST bitmap to {len(self.oracles)} oracles")
            return len(self.oracles)
        accepted = 0
        for url in self.oracles:
            try:
                r = requests.post(
                    f"{url}/vision/bitmap", json=payload, timeout=timeout
                )
                if r.status_code == 200:
                    accepted += 1
            except requests.RequestException:
                continue
        quorum = -(-len(self.oracles) * 2 // 3)
        if accepted < quorum:
            raise RuntimeError(
                f"Oracle quorum failed: {accepted}/{len(self.oracles)} "
                f"accepted, need {quorum}"
            )
        return accepted

    # ── read: settlement ──
    def get_payout(self, batch_id: int, from_block: int | None = None) -> int:
        if from_block is None:
            latest = self.w3.eth.block_number
            from_block = max(0, latest - 100_000)
        logs = self.vision.events.PlayerSettled.get_logs(
            argument_filters={"batchId": batch_id, "player": self.bot_addr},
            fromBlock=from_block,
        )
        return int(logs[-1]["args"]["payout"]) if logs else 0

    def check_balance(self, batch_id: int) -> int:
        for url in self.oracles:
            try:
                r = requests.get(
                    f"{url}/vision/balance/{batch_id}/{self.bot_addr}",
                    timeout=5,
                )
                if r.status_code == 200:
                    return int(r.json().get("balance", 0))
            except requests.RequestException:
                continue
        return 0

    def usdc_balance(self) -> int:
        return int(self.usdc.functions.balanceOf(self.bot_addr).call())
