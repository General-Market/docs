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
}

interface BatchRow {
  batchId: bigint;
  createdBlock: bigint;
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

async function findBatchCreatedRange(
  client: PublicClient,
  cfg: KeeperConfig,
  headBlock: bigint,
  headTimestamp: bigint,
): Promise<BatchRow[]> {
  // Walk blocks back until timestamp drops below now-lookback, or we hit 0.
  // The chain has ~250ms blocks; but we only need a coarse anchor. Binary search by halving.
  const lookback = BigInt(cfg.lookbackSeconds);
  const targetTs = headTimestamp > lookback ? headTimestamp - lookback : 0n;
  let lo = 0n;
  let hi = headBlock;
  // 28 halvings is enough for any reasonable chain length.
  for (let i = 0; i < 32 && lo < hi; i++) {
    const mid = (lo + hi) / 2n;
    const block = await client.getBlock({ blockNumber: mid });
    if (block.timestamp < targetTs) {
      lo = mid + 1n;
    } else {
      hi = mid;
    }
  }
  const fromBlock = lo;

  const created = await fetchLogsChunked(
    client,
    cfg.visionAddress,
    eventByName('BatchCreated'),
    fromBlock,
    headBlock,
    cfg.logEventChunk,
  );

  const rows: BatchRow[] = [];
  for (const log of created) {
    const decoded = decodeEventLog({
      abi: VISION_ABI,
      data: log.data,
      topics: log.topics,
    });
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

async function rescueOne(
  publicClient: PublicClient,
  walletClient: WalletClient,
  cfg: KeeperConfig,
  state: KeeperState,
  batchId: bigint,
  player: Address,
): Promise<boolean> {
  // Idempotency: re-read totalDeposited at the head before sending.
  const position = (await publicClient.readContract({
    address: cfg.visionAddress,
    abi: VISION_ABI,
    functionName: 'getPosition',
    args: [batchId, player],
  })) as { totalDeposited: bigint };
  if (position.totalDeposited === 0n) {
    return false;
  }

  const isVault = state.knownVaults.has(lower(player));
  const account = walletClient.account;
  if (!account) throw new Error('walletClient has no account');
  const chain = walletClient.chain;
  if (!chain) throw new Error('walletClient has no chain');

  // Deployer key is shared with fund-manager + fast-joiner. Nonce drift
  // happens. Refresh pending count and retry once on nonce-too-low.
  const writeOnce = async (nonce?: number): Promise<Hex> => {
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
  };

  let txHash: Hex;
  try {
    try {
      txHash = await writeOnce();
    } catch (e1) {
      const m1 = e1 instanceof Error ? e1.message : String(e1);
      if (!(m1.includes('nonce') || m1.includes('Nonce'))) throw e1;
      const pending = Number(
        await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' }),
      );
      txHash = await writeOnce(pending);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[refund-fail] batch=${batchId} player=${player} kind=${isVault ? 'vault' : 'direct'} err=${msg}`);
    state.lastError = msg;
    return false;
  }

  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 120_000 });
    if (receipt.status !== 'success') {
      console.error(`[refund-revert] batch=${batchId} player=${player} tx=${txHash}`);
      state.lastError = `tx ${txHash} reverted`;
      return false;
    }
    console.log(
      `[refunded] batch=${batchId} player=${player} kind=${isVault ? 'vault' : 'direct'} tx=${txHash} gasUsed=${receipt.gasUsed}`,
    );
    state.rescuedThisRun += 1;
    state.rescuedTotal += 1;
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[refund-receipt] batch=${batchId} player=${player} tx=${txHash} err=${msg}`);
    state.lastError = msg;
    return false;
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

  const batches = await findBatchCreatedRange(publicClient, cfg, headBlock, headTs);
  console.log(`[tick] head=${headBlock} ts=${headTs} candidates=${batches.length}`);

  for (const row of batches) {
    let batch: { settled: boolean };
    let expirationTime: bigint;
    try {
      batch = (await publicClient.readContract({
        address: cfg.visionAddress,
        abi: VISION_ABI,
        functionName: 'getBatch',
        args: [row.batchId],
      })) as { settled: boolean };
      expirationTime = (await publicClient.readContract({
        address: cfg.visionAddress,
        abi: VISION_ABI,
        functionName: 'batchExpirationTime',
        args: [row.batchId],
      })) as bigint;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[skip] batch=${row.batchId} read-fail: ${msg}`);
      continue;
    }

    if (batch.settled) continue;
    if (headTs < expirationTime) continue;

    // Stuck. Enumerate players who joined and subtract those already refunded.
    const fromBlock = row.createdBlock;
    const joinedLogs = await fetchLogsChunked(
      publicClient,
      cfg.visionAddress,
      eventByName('PlayerJoined'),
      fromBlock,
      headBlock,
      cfg.logEventChunk,
      { batchId: row.batchId },
    );
    const refundedLogs = await fetchLogsChunked(
      publicClient,
      cfg.visionAddress,
      eventByName('PlayerRefunded'),
      fromBlock,
      headBlock,
      cfg.logEventChunk,
      { batchId: row.batchId },
    );

    const refunded = new Set<Address>();
    for (const log of refundedLogs) {
      const decoded = decodeEventLog({ abi: VISION_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName === 'PlayerRefunded') {
        refunded.add(lower(decoded.args.player as Address));
      }
    }

    const players: Address[] = [];
    const seen = new Set<Address>();
    for (const log of joinedLogs) {
      const decoded = decodeEventLog({ abi: VISION_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'PlayerJoined') continue;
      const player = lower(decoded.args.player as Address);
      if (refunded.has(player)) continue;
      if (seen.has(player)) continue;
      seen.add(player);
      players.push(player);
    }

    if (players.length === 0) continue;
    console.log(`[stuck] batch=${row.batchId} players=${players.length} expired=${expirationTime}`);

    for (const player of players) {
      await rescueOne(publicClient, walletClient, cfg, state, row.batchId, player);
    }
  }

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
