// @ts-nocheck — viem strict typing requires authorizationList/chain on every call;
// suppressed for E2E helper where runtime correctness is verified by the test itself.
/**
 * Vision Swarm E2E Helpers
 *
 * SSH into VPS to manage the 10-bot swarm,
 * fund wallets, read on-chain state, verify invariants.
 */
import { execFileSync } from "child_process";
import {
  parseUnits,
  formatUnits,
  keccak256,
  toBytes,
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  decodeFunctionResult,
  encodeFunctionData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  L3_RPC,
  DEPLOYER_KEY,
  CONTRACTS,
} from "../env";

// ── Constants ──

const VPS = "index-maker/prod/be";
const REMOTE_DIR = "/home/max/index";
const DECIMALS = 18;
const FUND_AMOUNT = parseUnits("100000", DECIMALS);

const L3_CHAIN = {
  id: 111222333,
  name: "L3" as const,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [L3_RPC] } },
} as const;

// Load swarm bot addresses
import swarmAddresses from "../../../docker/testnet/vision-swarm/addresses.json";
export const SWARM_ADDRESSES: string[] = swarmAddresses;
export const SWARM_COUNT = SWARM_ADDRESSES.length;

// ── ABI Definitions (typed, matching IVision.sol exactly) ──

const VISION_ABI = parseAbi([
  "function getPosition(uint256 batchId, address player) view returns ((bytes32 bitmapHash, bytes32 configHash, uint256 stakePerTick, uint256 startTick, uint256 balance, uint256 lastClaimedTick, uint256 joinTimestamp, uint256 totalDeposited, bool isVirtual))",
  "function currentTickId(uint256 batchId) view returns (uint256)",
  "function balanceOf(address user) view returns (uint256)",
  "function realBalance(address user) view returns (uint256)",
  "function virtualBalance(address user) view returns (uint256)",
  "function totalRealBalance() view returns (uint256)",
  "function totalVirtualBalance() view returns (uint256)",
  "function accumulatedRealFees() view returns (uint256)",
  "function accumulatedVirtualFees() view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function mint(address to, uint256 amount) external",
]);

// ── SSH Helpers (no shell injection via execFileSync) ──

export function sshExec(cmd: string, timeoutMs = 30_000): string {
  return execFileSync("ssh", [VPS, cmd], {
    timeout: timeoutMs,
    encoding: "utf-8",
  }).trim();
}

export function startSwarm(): void {
  sshExec(
    `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && set -a && source swarm.env && set +a && docker compose up -d`,
    120_000
  );
}

export function stopSwarm(): void {
  sshExec(
    `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && docker compose down`,
    30_000
  );
}

export function swarmHealthy(): boolean {
  try {
    const out = sshExec(
      `cd ${REMOTE_DIR}/docker/testnet/vision-swarm && docker compose ps --format json 2>/dev/null || echo ""`
    );
    // docker compose v2 outputs NDJSON (one JSON object per line), not a JSON array
    const containers = out
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
    const running = containers.filter((c: any) => c.State === "running").length;
    return running >= SWARM_COUNT;
  } catch {
    return false;
  }
}

export function botLogs(botIndex: number, tail = 50): string {
  return sshExec(
    `docker logs swarm-bot-${botIndex} --tail ${tail} 2>&1`,
    10_000
  );
}

// ── RPC Client ──

const publicClient = createPublicClient({
  chain: L3_CHAIN,
  transport: http(L3_RPC),
});

// ── Funding (explicit nonce management) ──

export async function fundAllBots(): Promise<void> {
  const account = privateKeyToAccount(DEPLOYER_KEY as Hex);
  const client = createWalletClient({
    account,
    chain: L3_CHAIN,
    transport: http(L3_RPC),
  });

  let nonce = await publicClient.getTransactionCount({ address: account.address });
  let funded = 0;

  for (const addr of SWARM_ADDRESSES) {
    try {
      await client.writeContract({
        address: CONTRACTS.L3_WUSDC as Hex,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [addr as Hex, FUND_AMOUNT],
        nonce,
      });
      nonce++;
      funded++;
    } catch (e: any) {
      console.warn(`  Fund ${addr.slice(0, 10)} failed: ${e.message}`);
      // Re-fetch nonce after failure to avoid desync
      nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "pending" });
    }
  }
  if (funded < 8) throw new Error(`Only funded ${funded}/10 bots. Aborting.`);
}

/** Check L3 USDC balance (not Vision balance — bots need wallet USDC first). */
export async function getL3UsdcBalance(player: string): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.L3_WUSDC as Hex,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [player as Hex],
  });
}

// ── On-Chain State Reads (typed ABI, no manual hex slicing) ──

export async function getPosition(batchId: number, player: string) {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "getPosition",
    args: [BigInt(batchId), player as Hex],
  });
}

export async function getCurrentTick(batchId: number): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "currentTickId",
    args: [BigInt(batchId)],
  });
}

export async function getVisionBalance(player: string): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "balanceOf",
    args: [player as Hex],
  });
}

export async function getTotalRealBalance(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "totalRealBalance",
  });
}

export async function getAccumulatedRealFees(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.Vision as Hex,
    abi: VISION_ABI,
    functionName: "accumulatedRealFees",
  });
}

export async function getVisionContractUsdc(): Promise<bigint> {
  return publicClient.readContract({
    address: CONTRACTS.L3_WUSDC as Hex,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [CONTRACTS.Vision as Hex],
  });
}

// ── Health Checks ──

const VPS_IP = "142.132.164.24";

export async function checkDataNodeHealth(): Promise<boolean> {
  try {
    const res = await fetch(`http://${VPS_IP}:8200/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export function checkIssuerHealthViaSSH(port: number): boolean {
  try {
    sshExec(`curl -sf http://localhost:${port}/health`, 5_000);
    return true;
  } catch {
    return false;
  }
}

export async function checkL3Rpc(): Promise<boolean> {
  try {
    await publicClient.getBlockNumber();
    return true;
  } catch {
    return false;
  }
}

// ── Economic Invariants ──

export interface InvariantResult {
  passed: boolean;
  name: string;
  detail: string;
  expected?: string;
  actual?: string;
}

/**
 * Verify Vision contract solvency:
 * USDC.balanceOf(Vision) >= totalRealBalance + accumulatedRealFees
 *
 * Note: totalRealBalance tracks UNALLOCATED real balance only.
 * Active position balances are funded from totalRealBalance via _debitBalance(),
 * so the USDC stays in the contract but moves out of totalRealBalance.
 * The invariant USDC >= totalRealBalance + fees is the contract's own check.
 *
 * We ALSO sum active real position balances for swarm bots as an additional
 * lower-bound check. This catches over-crediting bugs in claimRewards.
 */
export async function verifySolvency(
  batchIds: number[]
): Promise<InvariantResult> {
  const [contractUsdc, totalReal, realFees] = await Promise.all([
    getVisionContractUsdc(),
    getTotalRealBalance(),
    getAccumulatedRealFees(),
  ]);

  // Contract's own invariant (necessary condition)
  const contractInvariant = contractUsdc >= totalReal + realFees;

  // Additional check: sum swarm bots' active position balances (real only)
  let swarmActiveReal = 0n;
  for (const batchId of batchIds.slice(0, 10)) {
    const results = await Promise.allSettled(
      SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
    );
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      const pos = r.value;
      if (pos.bitmapHash === ("0x" + "0".repeat(64)) as Hex) continue;
      if (!pos.isVirtual) {
        swarmActiveReal += pos.balance;
      }
    }
  }

  // Swarm active balances + unallocated should not exceed contract USDC
  const totalAccountedFor = totalReal + swarmActiveReal + realFees;
  const passed = contractInvariant && contractUsdc >= totalAccountedFor;

  return {
    passed,
    name: "Solvency",
    detail: `USDC.balanceOf(Vision) >= totalRealBalance + swarmActivePositions + fees`,
    expected: `>= ${formatUnits(totalAccountedFor, DECIMALS)} USDC`,
    actual: `${formatUnits(contractUsdc, DECIMALS)} USDC`,
  };
}

/**
 * Verify per-batch conservation for swarm bots only (SOFT CHECK).
 *
 * In parimutuel, sum(all_player_balances) = sum(all_deposits) - fees.
 * But we only check SWARM bots. If swarm bots won from non-swarm players,
 * sum(swarm_balances) > sum(swarm_deposits) — which is correct behavior,
 * not a protocol violation. So this is a WARNING, not an assertion.
 */
export async function verifyBatchConservation(
  batchId: number,
  players: string[]
): Promise<InvariantResult> {
  let totalBalance = 0n;
  let totalDeposited = 0n;
  let positionCount = 0;

  const results = await Promise.allSettled(
    players.map((p) => getPosition(batchId, p))
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const pos = r.value;
    if (pos.bitmapHash === ("0x" + "0".repeat(64)) as Hex) continue;
    totalBalance += pos.balance;
    totalDeposited += pos.totalDeposited;
    positionCount++;
  }

  // Soft check: log but don't fail (subset invariant is not guaranteed)
  const diff = totalBalance - totalDeposited;
  const passed = true; // Always passes — this is informational

  return {
    passed,
    name: `Pool Info (batch ${batchId}, ${positionCount} swarm positions)`,
    detail: diff > 0n
      ? `Swarm bots net +${formatUnits(diff, DECIMALS)} (winning from non-swarm players)`
      : `Swarm bots net ${formatUnits(diff, DECIMALS)} (fees extracted or losing)`,
    expected: "informational",
    actual: `balance=${formatUnits(totalBalance, DECIMALS)}, deposited=${formatUnits(totalDeposited, DECIMALS)}`,
  };
}

// ── Polling ──

export async function pollUntil<T>(
  fn: () => Promise<T>,
  predicate: (val: T) => boolean,
  timeoutMs: number,
  intervalMs = 5_000,
  label = "condition"
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T;
  while (Date.now() < deadline) {
    try {
      last = await fn();
      if (predicate(last)) return last;
    } catch (e: any) {
      console.warn(`  Poll error (${label}): ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
}
