/**
 * Issuer process management helpers for resilience E2E tests.
 * Kill, restart, and health-check individual issuer nodes.
 */

import { spawn, execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, openSync, appendFileSync } from 'fs';
import { join } from 'path';

// ── Constants ───────────────────────────────────────────────

/** Anvil account private keys for issuers (accounts 1-3). */
const ISSUER_KEYS: Record<number, string> = {
  1: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Account 1
  2: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Account 2
  3: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', // Account 3
};

const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const PIDS_INFO_PATH = join(PROJECT_ROOT, '.pids.info');
const DEPLOYMENT_PATH = join(PROJECT_ROOT, 'deployments', 'active-deployment.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');

// ── Health response type ────────────────────────────────────

export interface IssuerHealthResponse {
  status: string;
  node_id: number;
  connected_peers: number;
  consensus: {
    rounds_total: number;
    success_total: number;
    failed_total: number;
  };
  pending_order_count: number;
}

// ── PID management ──────────────────────────────────────────

/** Read .pids.info and find PID for issuer-{id}. */
export function getIssuerPid(id: number): number | null {
  if (!existsSync(PIDS_INFO_PATH)) return null;
  const lines = readFileSync(PIDS_INFO_PATH, 'utf-8').split('\n');
  for (const line of lines) {
    const match = line.match(new RegExp(`^issuer-${id}:(\\d+)$`));
    if (match) return parseInt(match[1], 10);
  }
  return null;
}

/** Update .pids.info with a new PID for issuer-{id}. */
function updatePidsInfo(id: number, newPid: number): void {
  const content = existsSync(PIDS_INFO_PATH)
    ? readFileSync(PIDS_INFO_PATH, 'utf-8')
    : '';
  // Remove old entry for this issuer
  const lines = content.split('\n').filter(l => !l.startsWith(`issuer-${id}:`));
  lines.push(`issuer-${id}:${newPid}`);
  writeFileSync(PIDS_INFO_PATH, lines.filter(Boolean).join('\n') + '\n');
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isPortOpen(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(1_000),
    });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

// ── Kill / Restart ──────────────────────────────────────────

/** Find the actual PID of issuer-{id} by checking P2P port (9000+id) with lsof. */
function findPidByPort(port: number): number | null {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' }).trim();
    if (output) return parseInt(output.split('\n')[0], 10);
  } catch {
    // lsof exits non-zero if no process found
  }
  return null;
}

/** Kill issuer-{id} with SIGKILL and wait until the process is dead and port is freed. */
export async function killIssuer(id: number): Promise<void> {
  // Try PID from .pids.info first, then fall back to finding by port
  let pid = getIssuerPid(id);
  if (pid !== null && !isProcessAlive(pid)) pid = null;
  if (pid === null) pid = findPidByPort(9000 + id);
  if (pid === null) pid = findPidByPort(10000 + id);
  if (pid === null) {
    // Already dead — nothing to kill
    return;
  }

  process.kill(pid, 'SIGKILL');

  // Poll until process is dead
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) break;
    await new Promise(r => setTimeout(r, 200));
  }
  if (isProcessAlive(pid)) throw new Error(`issuer-${id} (PID ${pid}) didn't die after SIGKILL`);

  // Poll until API port is freed
  const apiPort = 10000 + id;
  while (Date.now() < deadline) {
    if (!(await isPortOpen(apiPort))) return;
    await new Promise(r => setTimeout(r, 200));
  }
}

/** Restart issuer-{id} by spawning the binary with the same args as start.sh. */
export async function restartIssuer(id: number): Promise<void> {
  const deployment = JSON.parse(readFileSync(DEPLOYMENT_PATH, 'utf-8'));
  const contracts = deployment.contracts;

  const port = 9000 + id;
  const blsIdx = id - 1;

  const args = [
    '--node-id', String(id),
    '--port', String(port),
    '--rpc', 'http://localhost:8545',
    '--cycle-duration-ms', '200',
    '--min-cycle-gap-ms', '20',
    '--consensus-timeout-ms', '150',
    '--no-tls',
    '--test-key-seeds',
    '--bls-key-seed-index', String(blsIdx),
    '--signature-threshold', '2',
    '--num-issuers', '3',
    '--ntp-server', '',
    '--log-level', 'info',
    '--deployment-file', 'deployments/active-deployment.json',
  ];

  // Symbol map
  const symbolMapPath = join(PROJECT_ROOT, 'data', 'symbol-map.json');
  if (existsSync(symbolMapPath)) {
    args.push('--symbol-map-file', symbolMapPath);
  }

  // Contract addresses
  if (contracts.BridgeProxy) args.push('--bridge-proxy', contracts.BridgeProxy);
  if (contracts.MockBitgetVault) args.push('--bitget-vault', contracts.MockBitgetVault);
  if (contracts.SettlementBridgeCustody) args.push('--settlement-custody', contracts.SettlementBridgeCustody);
  if (contracts.BLSCustody) args.push('--issuer-custody-settlement', contracts.BLSCustody);
  if (contracts.MOCK_USDT && contracts.MOCK_USDT !== '0x0000000000000000000000000000000000000000') {
    args.push('--mock-usdt', contracts.MOCK_USDT);
  }

  // Vision flags
  if (contracts.Vision) {
    args.push(
      '--vision-enabled',
      '--vision-address', contracts.Vision,
      '--vision-database-url', 'postgres://localhost/index_prices',
      '--vision-data-node-url', 'http://localhost:8200',
      '--vision-rpc-ws-url', 'http://localhost:8546',
      '--vision-reveal-window-secs', '0',
      '--vision-tick-poll-interval-ms', '500',
    );
  }

  // Peer list: all other issuers
  const peers: string[] = [];
  for (let j = 1; j <= 3; j++) {
    if (j !== id) peers.push(`127.0.0.1:${9000 + j}`);
  }

  // Write private key to file
  const keyFile = `/tmp/issuer-key-${id}.txt`;
  writeFileSync(keyFile, ISSUER_KEYS[id]);

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    ISSUER_PRIVATE_KEY_PATH: keyFile,
    ISSUER_PEERS: peers.join(','),
    ISSUER_SETTLEMENT_RPC_URL: 'http://localhost:8546',
    ISSUER_SETTLEMENT_CHAIN_ID: '421611337',
    ISSUER_BRIDGE_PROXY_ADDRESS: contracts.BridgeProxy || '',
    DATA_NODE_URL: 'http://localhost:8200',
  };

  const logFile = join(LOGS_DIR, `issuer-${id}.log`);
  const logFd = openSync(logFile, 'a');

  const child = spawn(
    join(PROJECT_ROOT, 'target', 'release', 'issuer'),
    args,
    {
      cwd: PROJECT_ROOT,
      env,
      stdio: ['ignore', logFd, logFd],
      detached: true,
    },
  );
  child.unref();

  updatePidsInfo(id, child.pid!);

  // Also append to .pids for cleanup
  const pidsPath = join(PROJECT_ROOT, '.pids');
  appendFileSync(pidsPath, `${child.pid}\n`);
}

// ── Health checks ───────────────────────────────────────────

/** GET issuer health endpoint. Returns null only if process is dead (network error).
 *  Parses both 200 (healthy) and 503 (alive but degraded, e.g. 0 peers) responses. */
export async function getIssuerHealth(id: number): Promise<IssuerHealthResponse | null> {
  try {
    const res = await fetch(`http://localhost:${10000 + id}/health`, {
      signal: AbortSignal.timeout(3_000),
    });
    // Parse both 200 and 503 — issuer is alive in both cases
    // Only return null on network error (process actually dead)
    const text = await res.text();
    try {
      return JSON.parse(text) as IssuerHealthResponse;
    } catch {
      return null;
    }
  } catch {
    return null;  // fetch threw — process is dead
  }
}

/** Poll until issuer-{id} is healthy and has at least 1 connected peer. */
export async function waitForIssuerHealthy(id: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const health = await getIssuerHealth(id);
    if (health && health.connected_peers >= 1) return;
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`issuer-${id} not healthy after ${timeoutMs}ms`);
}

/** Get consensus.success_total for issuer-{id}, or 0 if unreachable. */
export async function getConsensusTotal(id: number): Promise<number> {
  const health = await getIssuerHealth(id);
  return health?.consensus?.success_total ?? 0;
}

/** Wait until ALL issuers have at least 1 successful consensus round (warmup). */
export async function waitForConsensusWarmup(ids: number[], timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (const id of ids) {
    while (Date.now() < deadline) {
      const total = await getConsensusTotal(id);
      if (total > 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    const total = await getConsensusTotal(id);
    if (total === 0) {
      throw new Error(`issuer-${id} never achieved a successful consensus round within ${timeoutMs}ms`);
    }
  }
}

/** Poll until issuer-{id}'s consensus.success_total >= baselineTotal + minIncrease. */
export async function waitForConsensusProgress(
  id: number,
  minIncrease: number,
  baselineTotal: number,
  timeoutMs: number,
): Promise<void> {
  const target = baselineTotal + minIncrease;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const total = await getConsensusTotal(id);
    if (total >= target) return;
    await new Promise(r => setTimeout(r, 500));
  }
  const final = await getConsensusTotal(id);
  throw new Error(
    `issuer-${id} consensus didn't progress: expected >= ${target}, got ${final} (baseline=${baselineTotal}, minIncrease=${minIncrease})`,
  );
}
