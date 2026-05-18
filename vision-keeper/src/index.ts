// Vision refund keeper. Drains stuck deposits when the oracle gives up.
//
// Loop:
//   1. Find every BatchCreated in the lookback window.
//   2. Skip the settled. Skip the unexpired.
//   3. For the rest, list joined players, subtract those already refunded.
//   4. For each survivor, send claimRefundFor (or vault.refundStuckBatch).
//   5. Sleep. Wake. Repeat. The protocol forgets; the keeper does not.

import { createServer } from 'node:http';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  defineChain,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { VISION_ABI, VISION_VAULT_ABI, VISION_VAULT_FACTORY_ABI } from './abi.js';
import { loadConfig, type KeeperConfig } from './config.js';

interface KeeperState {
  startedAt: number;
  lastTickAt: number;
  lastError: string | null;
  rescuedThisRun: number;
  rescuedTotal: number;
  knownVaults: Set<Address>;
  vaultsRefreshedAt: number;
  lastScannedBlock: bigint | null;
  seenBatches: Map<bigint, BatchRow>;
  batchPlayers: Map<bigint, BatchPlayerState>;
}

interface BatchRow {
  batchId: bigint;
  createdBlock: bigint;
}

interface BatchPlayerState {
  players: Set<Address>;
  lastJoinScanBlock: bigint;
}

function lower(addr: string): Address {
  return addr.toLowerCase() as Address;
}

function buildChain(cfg: KeeperConfig) {
  return defineChain({
    id: cfg.chainId,
    name: `index-l3-${cfg.chainId}`,
    nativeCurrency: { name: 'GM', symbol: 'GM', decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
  });
}

async function fetchLogsChunked(
  client: PublicClient,
  address: Address,
  event: (typeof VISION_ABI)[number] & { type: 'event' },
  fromBlock: bigint,
  toBlock: bigint,
  chunk: bigint,
  topics?: { batchId?: bigint },
): Promise<Log[]> {
  const out: Log[] = [];
  let cursor = fromBlock;
  while (cursor <= toBlock) {
    const end = cursor + chunk - 1n > toBlock ? toBlock : cursor + chunk - 1n;
    const args = topics?.batchId !== undefined ? { batchId: topics.batchId } : {};
    const logs = await client.getLogs({
      address,
      event,
      args,
      fromBlock: cursor,
      toBlock: end,
    });
    out.push(...logs);
    cursor = end + 1n;
  }
  return out;
}

function eventByName(name: string) {
  const ev = VISION_ABI.find((e) => e.type === 'event' && e.name === name);
  if (!ev || ev.type !== 'event') throw new Error(`Missing event ${name} in ABI`);
  return ev;
}

async function filterStuckBatches(
  client: PublicClient,
  cfg: KeeperConfig,
  rows: BatchRow[],
  headTs: bigint,
): Promise<{ stuck: BatchRow[]; settledIds: bigint[] }> {
  const CHUNK = 64;
  const stuck: BatchRow[] = [];
  const settledIds: bigint[] = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const reads = await Promise.allSettled(
      slice.flatMap((row) => [
        client.readContract({
          address: cfg.visionAddress,
          abi: VISION_ABI,
          functionName: 'getBatch',
          args: [row.batchId],
        }),
        client.readContract({
          address: cfg.visionAddress,
          abi: VISION_ABI,
          functionName: 'batchExpirationTime',
          args: [row.batchId],
        }),
      ]),
    );
    for (let j = 0; j < slice.length; j++) {
      const row = slice[j];
      const batchRes = reads[j * 2];
      const expRes = reads[j * 2 + 1];
      if (!row || !batchRes || !expRes) continue;
      if (batchRes.status !== 'fulfilled' || expRes.status !== 'fulfilled') continue;
      const batch = batchRes.value as { settled: boolean };
      const expirationTime = expRes.value as bigint;
      if (batch.settled) {
        settledIds.push(row.batchId);
        continue;
      }
      if (headTs < expirationTime) continue;
      stuck.push(row);
    }
  }
  return { stuck, settledIds };
}

async function findAnchorBlock(
  client: PublicClient,
  headBlock: bigint,
  headTimestamp: bigint,
  lookbackSeconds: number,
): Promise<bigint> {
  const lookback = BigInt(lookbackSeconds);
  const targetTs = headTimestamp > lookback ? headTimestamp - lookback : 0n;
  let lo = 0n;
  let hi = headBlock;
  for (let i = 0; i < 32 && lo < hi; i++) {
    const mid = (lo + hi) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (block.timestamp < targetTs) {
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }
  return lo;
}

async function scanBatchCreated(
  client: PublicClient,
  cfg: KeeperConfig,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<BatchRow[]> {
  if (fromBlock > toBlock) return [];
  const logs = await fetchLogsChunked(
    client,
    cfg.visionAddress,
    eventByName('BatchCreated'),
    fromBlock,
    toBlock,
    cfg.logEventChunk,
  );
  const rows: BatchRow[] = [];
  for (const log of logs) {
    const decoded = decodeEventLog({ abi: VISION_ABI, data: log.data, topics: log.topics });
    if (decoded.eventName !== 'BatchCreated') continue;
    const batchId = decoded.args.batchId as bigint;
    rows.push({ batchId, createdBlock: log.blockNumber ?? fromBlock });
  }
  return rows;
}

async function refreshVaults(
  client: PublicClient,
  cfg: KeeperConfig,
  state: KeeperState,
): Promise<void> {
  const vaults = (await client.readContract({
    address: cfg.vaultFactoryAddress,
    abi: VISION_VAULT_FACTORY_ABI,
    functionName: 'getAllVaults',
  })) as readonly Address[];
  state.knownVaults = new Set(vaults.map(lower));
  state.vaultsRefreshedAt = Date.now();
  console.log(`[vaults] ${state.knownVaults.size} registered`);
}

function sendRefundTx(
  walletClient: WalletClient,
  cfg: KeeperConfig,
  state: KeeperState,
  batchId: bigint,
  player: Address,
  nonce: number,
): Promise<Hex> {
  const isVault = state.knownVaults.has(lower(player));
  const account = walletClient.account;
  if (!account) throw new Error('walletClient has no account');
  const chain = walletClient.chain;
  if (!chain) throw new Error('walletClient has no chain');
  if (isVault) {
    return walletClient.writeContract({
      account,
      chain,
      address: player,
      abi: VISION_VAULT_ABI,
      functionName: 'refundStuckBatch',
      args: [batchId],
      nonce,
    });
  }
  return walletClient.writeContract({
    account,
    chain,
    address: cfg.visionAddress,
    abi: VISION_ABI,
    functionName: 'claimRefundFor',
    args: [batchId, player],
    nonce,
  });
}

async function rescueBatch(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: KeeperConfig,
  state: KeeperState,
  batchId: bigint,
  players: Address[],
): Promise<void> {
  // Idempotency: re-read totalDeposited at head, drop any already-zero.
  const positions = await Promise.allSettled(
    players.map((player) =>
      publicClient.readContract({
        address: cfg.visionAddress,
        abi: VISION_ABI,
        functionName: 'getPosition',
        args: [batchId, player],
      }),
    ),
  );
  const pending: Address[] = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    if (!player) continue;
    const res = positions[i];
    if (!res || res.status !== 'fulfilled') continue;
    const pos = res.value as { totalDeposited: bigint };
    if (pos.totalDeposited === 0n) continue;
    pending.push(player);
  }
  if (pending.length === 0) return;

  const account = walletClient.account;
  if (!account) throw new Error('walletClient has no account');

  // Submit refunds in parallel chunks. Explicit nonces let viem skip its
  // own per-call nonce read — the keeper key is shared with fund-manager
  // + fast-joiner so we resync per chunk to swallow drift.
  for (let i = 0; i < pending.length; i += cfg.refundConcurrency) {
    const chunk = pending.slice(i, i + cfg.refundConcurrency);
    const baseNonce = Number(
      await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
    );

    const sends = await Promise.allSettled(
      chunk.map((player, idx) => sendRefundTx(walletClient, cfg, state, batchId, player, baseNonce + idx)),
    );

    const receiptWaits = sends.map(async (sent, idx) => {
      const player = chunk[idx]!;
      const isVault = state.knownVaults.has(lower(player));
      if (sent.status !== 'fulfilled') {
        const msg = sent.reason instanceof Error ? sent.reason.message : String(sent.reason);
        console.error(
          `[refund-fail] batch=${batchId} player=${player} kind=${isVault ? 'vault' : 'direct'} err=${msg}`,
        );
        state.lastError = msg;
        return;
      }
      const txHash = sent.value;
      try {
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
        if (receipt.status !== 'success') {
          console.error(`[refund-revert] batch=${batchId} player=${player} tx=${txHash}`);
          state.lastError = `tx ${txHash} reverted`;
          return;
        }
        console.log(
          `[refunded] batch=${batchId} player=${player} kind=${isVault ? 'vault' : 'direct'} tx=${txHash} gasUsed=${receipt.gasUsed}`,
        );
        state.rescuedThisRun += 1;
        state.rescuedTotal += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[refund-receipt] batch=${batchId} player=${player} tx=${txHash} err=${msg}`);
        state.lastError = msg;
      }
    });
    await Promise.all(receiptWaits);
  }
}

async function tick(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: KeeperConfig,
  state: KeeperState,
): Promise<void> {
  const head = await publicClient.getBlock({ blockTag: 'latest' });
  const headTs = head.timestamp;
  const headBlock = head.number ?? 0n;
  state.rescuedThisRun = 0;

  if (Date.now() - state.vaultsRefreshedAt > cfg.vaultRefreshMs) {
    await refreshVaults(publicClient, cfg, state);
  }

  const scanFrom =
    state.lastScannedBlock === null
      ? await findAnchorBlock(publicClient, headBlock, headTs, cfg.lookbackSeconds)
      : state.lastScannedBlock + 1n;

  const newRows = await scanBatchCreated(publicClient, cfg, scanFrom, headBlock);
  for (const row of newRows) {
    if (!state.seenBatches.has(row.batchId)) {
      state.seenBatches.set(row.batchId, row);
    }
  }
  console.log(
    `[tick] head=${headBlock} ts=${headTs} new=${newRows.length} tracked=${state.seenBatches.size}`,
  );

  const candidates = Array.from(state.seenBatches.values());
  const { stuck, settledIds } = await filterStuckBatches(publicClient, cfg, candidates, headTs);
  for (const id of settledIds) {
    state.seenBatches.delete(id);
    state.batchPlayers.delete(id);
  }

  if (stuck.length === 0) {
    state.lastScannedBlock = headBlock;
    state.lastTickAt = Math.floor(Date.now() / 1000);
    return;
  }
  console.log(`[tick] stuck-candidates=${stuck.length}`);

  for (const row of stuck) {
    const playerState =
      state.batchPlayers.get(row.batchId) ??
      ({ players: new Set<Address>(), lastJoinScanBlock: row.createdBlock - 1n } as BatchPlayerState);

    const joinFrom = playerState.lastJoinScanBlock + 1n;
    if (joinFrom <= headBlock) {
      const [joinedLogs, refundedLogs] = await Promise.all([
        fetchLogsChunked(
          publicClient,
          cfg.visionAddress,
          eventByName('PlayerJoined'),
          joinFrom,
          headBlock,
          cfg.logEventChunk,
          { batchId: row.batchId },
        ),
        fetchLogsChunked(
          publicClient,
          cfg.visionAddress,
          eventByName('PlayerRefunded'),
          joinFrom,
          headBlock,
          cfg.logEventChunk,
          { batchId: row.batchId },
        ),
      ]);

      for (const log of joinedLogs) {
        const decoded = decodeEventLog({ abi: VISION_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'PlayerJoined') continue;
        playerState.players.add(lower(decoded.args.player as Address));
      }
      for (const log of refundedLogs) {
        const decoded = decodeEventLog({ abi: VISION_ABI, data: log.data, topics: log.topics });
        if (decoded.eventName !== 'PlayerRefunded') continue;
        playerState.players.delete(lower(decoded.args.player as Address));
      }
      playerState.lastJoinScanBlock = headBlock;
    }

    state.batchPlayers.set(row.batchId, playerState);
    const players = Array.from(playerState.players);
    if (players.length === 0) continue;
    console.log(`[stuck] batch=${row.batchId} players=${players.length}`);

    await rescueBatch(publicClient, walletClient, cfg, state, row.batchId, players);
  }

  state.lastScannedBlock = headBlock;
  state.lastTickAt = Math.floor(Date.now() / 1000);
}


function startHealthServer(state: KeeperState, port: number): void {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const body = JSON.stringify({
        ok: true,
        startedAt: state.startedAt,
        lastTickAt: state.lastTickAt,
        lastError: state.lastError,
        rescuedThisRun: state.rescuedThisRun,
        rescuedTotal: state.rescuedTotal,
        knownVaults: state.knownVaults.size,
      });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  server.listen(port, () => {
    console.log(`[health] listening on :${port}`);
  });
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const chain = buildChain(cfg);
  const account = privateKeyToAccount(cfg.privateKey);

  const publicClient = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  const walletClient = createWalletClient({ chain, transport: http(cfg.rpcUrl), account });

  console.log(
    `[boot] keeper=${account.address} vision=${cfg.visionAddress} factory=${cfg.vaultFactoryAddress} chain=${cfg.chainId}`,
  );

  const state: KeeperState = {
    startedAt: Math.floor(Date.now() / 1000),
    lastTickAt: 0,
    lastError: null,
    rescuedThisRun: 0,
    rescuedTotal: 0,
    knownVaults: new Set<Address>(),
    vaultsRefreshedAt: 0,
    lastScannedBlock: null,
    seenBatches: new Map<bigint, BatchRow>(),
    batchPlayers: new Map<bigint, BatchPlayerState>(),
  };

  startHealthServer(state, cfg.healthPort);

  // Eagerly populate the vault set. A miss here doesn't crash boot.
  try {
    await refreshVaults(publicClient, cfg, state);
  } catch (err) {
    state.lastError = err instanceof Error ? err.message : String(err);
    console.warn(`[vaults] initial refresh failed: ${state.lastError}`);
  }

  // Loop forever. A failed tick logs and waits.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await tick(publicClient, walletClient, cfg, state);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      state.lastError = msg;
      console.error(`[tick-fail] ${msg}`);
    }
    await new Promise((r) => setTimeout(r, cfg.pollIntervalMs));
  }
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
