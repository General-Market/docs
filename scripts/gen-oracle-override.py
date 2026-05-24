#!/usr/bin/env python3
"""Regenerate docker/testnet/oracle/docker-compose.override.yml on a VPS.

The override is NOT tracked in git — testnet.sh's `_start_oracles_docker`
writes it, and cleanup paths delete it. When it is gone, the oracles cannot be
recreated (the base compose has no command/volumes). This script rebuilds it
from canonical sources on the box: addresses from active-deployment.json, Bitget
creds from system.env. It does NOT touch the BLS/ECDSA key files.

Keep in sync with testnet.sh `_oracle_command_yaml` + the override heredoc. If
the oracle CLI flags or the static config (RPC, ports, settlement) change there,
mirror them here.

Usage:  python3 gen-oracle-override.py [REPO_BASE]   # default /home/max/index
"""
import json
import sys

BASE = sys.argv[1] if len(sys.argv) > 1 else "/home/max/index"

d = json.load(open(f"{BASE}/deployments/active-deployment.json"))
c = d.get("contracts", d)
vision = c.get("Vision")
bridge = c.get("SettlementBridgeProxy") or c.get("BridgeProxy")
custody = c.get("SettlementBridgeCustody")
deploy_block = int(d.get("deployBlock") or 0)
from_block = deploy_block - 500 if deploy_block > 1000 else deploy_block

bget = {}
for line in open(f"{BASE}/system.env"):
    line = line.strip()
    for key, short in (
        ("BITGET_READONLY_API_KEY", "k"),
        ("BITGET_READONLY_API_SECRET", "s"),
        ("BITGET_READONLY_PASSPHRASE", "p"),
    ):
        if line.startswith(key + "="):
            bget[short] = line.split("=", 1)[1]

RPC = "https://rpc.generalmarket.io/"
SETTLE_RPC = "http://127.0.0.1:8547"
CHAIN = "14601"
DNP = "8200"
DBURL = "postgres://max:m_f310f8cc478d54483105863917900d31@localhost:6432/index_prices"
PEERS = {
    1: "127.0.0.1:9002,127.0.0.1:9003",
    2: "127.0.0.1:9001,127.0.0.1:9003",
    3: "127.0.0.1:9001,127.0.0.1:9002",
}


def command(i):
    port = 9000 + i
    bls = i - 1
    args = [
        "--node-id", str(i),
        "--port", str(port),
        "--rpc", RPC,
        "--cycle-duration-ms", "1500",
        "--min-cycle-gap-ms", "50",
        "--consensus-timeout-ms", "1200",
        "--no-tls",
        "--test-key-seeds",
        "--bls-key-seed-index", str(bls),
        "--num-oracles", "3",
        "--registry-sync",
        "--data-node-url", f"http://localhost:{DNP}",
        "--deployment-file", "/app/deployments/active-deployment.json",
        "--symbol-map-file", "/app/data/symbol-map.json",
        "--wal-path", f"/app/logs/consensus-{i}.wal",
        "--log-level", "info",
        "--from-block", str(from_block),
        "--sign-timeout-ms", "5000",
        "--itp-id", "0x0000000000000000000000000000000000000000000000000000000000000001",
    ]
    if bridge:
        args += ["--bridge-proxy", bridge]
    if custody:
        args += ["--settlement-custody", custody]
    if vision:
        args += [
            "--vision-enabled",
            "--vision-address", vision,
            "--vision-database-url", DBURL,
            "--vision-data-node-url", f"http://localhost:{DNP}",
            "--vision-rpc-ws-url", RPC,
            "--vision-settlement-bridge-custody", custody,
            "--vision-settlement-rpc-url", SETTLE_RPC,
        ]
    return args


out = ["services:"]
for i in (1, 2, 3):
    out += [
        f"  oracle-{i}:",
        "    environment:",
        f"      ORACLE_PRIVATE_KEY_PATH: /tmp/oracle-key-{i}.txt",
        f"      ORACLE_SETTLEMENT_PRIVATE_KEY_PATH: /tmp/settlement-key-{i}.txt",
        f'      ORACLE_PEERS: "{PEERS[i]}"',
        f'      ORACLE_RPC_URL: "{RPC}"',
        f'      ORACLE_VISION_ADDRESS: "{vision}"',
        f'      ORACLE_SETTLEMENT_RPC_URL: "{SETTLE_RPC}"',
        f'      ORACLE_SETTLEMENT_CHAIN_ID: "{CHAIN}"',
        f'      BITGET_READONLY_API_KEY: "{bget.get("k", "")}"',
        f'      BITGET_READONLY_API_SECRET: "{bget.get("s", "")}"',
        f'      BITGET_READONLY_PASSPHRASE: "{bget.get("p", "")}"',
        '      EXCHANGE_MODE: "testnet"',
        "    command:",
    ]
    for a in command(i):
        out.append(f'      - "{a}"')
    out += [
        "    volumes:",
        f"      - {BASE}/deployments/active-deployment.json:/app/deployments/active-deployment.json:ro",
        f"      - {BASE}/data/symbol-map.json:/app/data/symbol-map.json:ro",
        f"      - /tmp/oracle-key-{i}.txt:/tmp/oracle-key-{i}.txt:ro",
        f"      - /tmp/settlement-key-{i}.txt:/tmp/settlement-key-{i}.txt:ro",
        f"      - {BASE}/logs:/app/logs",
    ]

path = f"{BASE}/docker/testnet/oracle/docker-compose.override.yml"
open(path, "w").write("\n".join(out) + "\n")
if not (bget.get("k") and bget.get("s") and bget.get("p")):
    sys.stderr.write("WARNING: Bitget creds incomplete — oracles would run in Mock mode\n")
print(
    f"wrote {path}\n  from_block={from_block} vision={vision}\n"
    f"  bridge={bridge} custody={custody} bitget_keys={sum(1 for x in 'ksp' if bget.get(x))}/3"
)
