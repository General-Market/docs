import json
import math
import os
from pathlib import Path

import requests
from eth_account import Account
from web3 import Web3

ABI_DIR = Path(__file__).parent / "abi"


def _load_abi(name: str):
    data = json.loads((ABI_DIR / name).read_text())
    if isinstance(data, dict) and "abi" in data:
        return data["abi"]
    return data


class VisionBot:
    def __init__(self, rpc_url: str, vision_address: str, private_key: str,
                 data_node_url: str, oracle_urls: list[str]):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.account = Account.from_key(private_key)
        self.bot_addr = self.account.address

        vision_abi = _load_abi("Vision.json")
        erc20_abi = _load_abi("ERC20.json")

        self.vision = self.w3.eth.contract(
            address=Web3.to_checksum_address(vision_address), abi=vision_abi
        )
        self.usdc_address = self.vision.functions.USDC().call()
        self.usdc = self.w3.eth.contract(
            address=Web3.to_checksum_address(self.usdc_address), abi=erc20_abi
        )
        self.data_node_url = data_node_url.rstrip("/")
        self.oracle_urls = [u.rstrip("/") for u in oracle_urls]

    def get_batch(self, batch_id: int) -> dict:
        b = self.vision.functions.getBatch(batch_id).call()
        return {
            "creator":        b[0],
            "source_id":      b[1],
            "config_hash":    b[2],
            "tick_duration":  b[3],
            "lock_offset":    b[4],
            "created_at_tick": b[5],
            "paused":         b[6],
            "settled":        b[7],
        }

    def fetch_markets(self, config_hash: bytes) -> list[dict]:
        url = f"{self.data_node_url}/batches/config/0x{config_hash.hex()}"
        r = requests.get(url, timeout=15)
        if r.status_code != 200:
            raise RuntimeError(f"data-node {r.status_code}: {r.text[:500]}")
        return r.json()["markets"]

    def _base_tx(self) -> dict:
        return {
            "from": self.bot_addr,
            "nonce": self.w3.eth.get_transaction_count(self.bot_addr),
            "chainId": self.w3.eth.chain_id,
        }

    def build_dryrun_tx(self, batch_id: int, config_hash: bytes,
                        deposit_wei: int, bitmap_hash: bytes) -> dict:
        fn = self.vision.functions.joinBatchDirect(
            batch_id, config_hash, deposit_wei, bitmap_hash
        )
        return fn.build_transaction(self._base_tx())

    def _send(self, fn) -> bytes:
        tx = fn.build_transaction(self._base_tx())
        signed = self.account.sign_transaction(tx)
        raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
        tx_hash = self.w3.eth.send_raw_transaction(raw)
        self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return tx_hash

    def approve_usdc(self, amount_wei: int) -> bytes:
        return self._send(self.usdc.functions.approve(self.vision.address, amount_wei))

    def join_batch(self, batch_id: int, config_hash: bytes,
                   deposit_wei: int, bitmap_hash: bytes) -> bytes:
        return self._send(self.vision.functions.joinBatchDirect(
            batch_id, config_hash, deposit_wei, bitmap_hash
        ))

    def submit_bitmap(self, batch_id: int, bitmap: bytes, bitmap_hash: bytes) -> int:
        payload = {
            "player": self.bot_addr,
            "batch_id": batch_id,
            "bitmap_hex": "0x" + bitmap.hex(),
            "expected_hash": "0x" + bitmap_hash.hex(),
        }
        accepted = 0
        errors = []
        for url in self.oracle_urls:
            try:
                r = requests.post(f"{url}/vision/bitmap", json=payload, timeout=15)
                if 200 <= r.status_code < 300:
                    accepted += 1
                else:
                    errors.append(f"{url}: {r.status_code} {r.text[:200]}")
            except requests.RequestException as e:
                errors.append(f"{url}: {e}")
        quorum = math.ceil(len(self.oracle_urls) * 2 / 3)
        if accepted < quorum:
            raise RuntimeError(
                f"Oracle quorum failed: {accepted}/{len(self.oracle_urls)} "
                f"need {quorum}. Errors: {errors}"
            )
        return accepted

    def get_payout(self, batch_id: int) -> int:
        latest = self.w3.eth.block_number
        from_block = max(0, latest - 100_000)
        logs = self.vision.events.PlayerSettled.get_logs(
            argument_filters={"batchId": batch_id, "player": self.bot_addr},
            from_block=from_block,
            to_block=latest,
        )
        if not logs:
            return 0
        return int(logs[-1]["args"]["payout"])
