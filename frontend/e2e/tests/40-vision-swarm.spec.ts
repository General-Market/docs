/**
 * 40-vision-swarm.spec.ts
 *
 * Full-stack Vision E2E: deploy 10 bots, let them join all batches,
 * wait for tick resolution, verify frontend + economic invariants.
 *
 * Testnet only. Total timeout: 20 minutes.
 */
import { test, expect } from "@playwright/test";
import {
  SWARM_ADDRESSES,
  SWARM_COUNT,
  startSwarm,
  stopSwarm,
  swarmHealthy,
  fundAllBots,
  getPosition,
  getCurrentTick,
  getL3UsdcBalance,
  verifySolvency,
  verifyBatchConservation,
  checkDataNodeHealth,
  checkOracleHealthViaSSH,
  checkL3Rpc,
  pollUntil,
  botLogs,
} from "../helpers/swarm-api";
import { FRONTEND_URL } from "../env";
import type { Hex } from "viem";

// Batch IDs from vision-batches.json (object: { batches: { name: { batchId, ... } } })
import visionBatchesDeploy from "../../../deployments/vision-batches.json";
const BATCH_ENTRIES = Object.values(
  (visionBatchesDeploy as any).batches || {}
) as Array<{ batchId: number; tickDuration: number }>;
const BATCH_IDS: number[] = BATCH_ENTRIES.map((b) => b.batchId);

const FAST_BATCHES = BATCH_ENTRIES
  .filter((b) => b.tickDuration <= 300)
  .map((b) => b.batchId);

const ORACLE_PORTS = [10001, 10002, 10003];
const ZERO_HASH = ("0x" + "0".repeat(64)) as Hex;

test.describe.configure({ mode: "serial" });
test.setTimeout(20 * 60 * 1000);

// ── Stage 1: Pre-flight ──

test("Stage 1: infrastructure health", async () => {
  const [l3, dataNode] = await Promise.all([checkL3Rpc(), checkDataNodeHealth()]);
  expect(l3, "L3 RPC unreachable").toBe(true);
  expect(dataNode, "Data node unreachable").toBe(true);

  for (const port of ORACLE_PORTS) {
    expect(checkOracleHealthViaSSH(port), `Oracle :${port} unreachable`).toBe(true);
  }
});

// ── Stage 2: Fund + Deploy ──

test("Stage 2: fund and deploy swarm", async () => {
  // Stop any existing swarm first (idempotent)
  try { stopSwarm(); } catch { /* not running */ }

  await fundAllBots();

  // Verify at least first bot has L3 USDC (not Vision balance — bots need wallet USDC)
  const bal = await getL3UsdcBalance(SWARM_ADDRESSES[0]);
  expect(bal > 0n, `Bot 0 has no L3 USDC after funding`).toBe(true);

  startSwarm();

  await pollUntil(
    async () => swarmHealthy(),
    (ok) => ok,
    120_000,
    5_000,
    "swarm containers running"
  );
});

// ── Stage 3: Wait for joins (parallelized RPC with error tolerance) ──

test("Stage 3: bots join batches", async () => {
  const SAMPLE_SIZE = 10;
  const MIN_BOTS_PER_BATCH = 5;
  const MIN_BATCHES_WITH_BOTS = Math.floor(SAMPLE_SIZE * 0.8);

  await pollUntil(
    async () => {
      let batchesOk = 0;
      const sample = BATCH_IDS.slice(0, SAMPLE_SIZE);

      // Parallelize: check all bots in all sampled batches at once
      const checks = sample.map(async (batchId) => {
        const results = await Promise.allSettled(
          SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
        );
        const joined = results.filter(
          (r) => r.status === "fulfilled" && r.value.bitmapHash !== ZERO_HASH
        ).length;
        return joined >= MIN_BOTS_PER_BATCH;
      });

      const outcomes = await Promise.all(checks);
      batchesOk = outcomes.filter(Boolean).length;
      return batchesOk;
    },
    (count) => count >= MIN_BATCHES_WITH_BOTS,
    5 * 60 * 1000,
    15_000,
    "bots joining batches"
  );

  // Log sample positions
  for (const batchId of BATCH_IDS.slice(0, 2)) {
    const pos = await getPosition(batchId, SWARM_ADDRESSES[0]);
    if (pos.bitmapHash !== ZERO_HASH) {
      console.log(
        `  Bot 0 in batch ${batchId}: stake=${pos.stakePerTick}, balance=${pos.balance}`
      );
    }
  }
});

// ── Stage 4: Tick resolution ──

test("Stage 4: tick resolution via BLS consensus", async () => {
  if (FAST_BATCHES.length === 0) {
    console.log("No fast-ticking batches. Skipping.");
    return;
  }

  const initialTicks = new Map<number, bigint>();
  for (const batchId of FAST_BATCHES.slice(0, 5)) {
    initialTicks.set(batchId, await getCurrentTick(batchId));
  }

  const THRESHOLD = Math.min(3, FAST_BATCHES.length);

  await pollUntil(
    async () => {
      let resolved = 0;
      for (const [batchId, initial] of initialTicks) {
        const current = await getCurrentTick(batchId);
        if (current > initial) {
          resolved++;
          console.log(`  Batch ${batchId}: tick ${initial} → ${current}`);
        }
      }
      return resolved;
    },
    (n) => n >= THRESHOLD,
    10 * 60 * 1000,
    15_000,
    "tick resolution"
  );

  // Verify balances changed after resolution
  for (const [batchId, initial] of initialTicks) {
    if ((await getCurrentTick(batchId)) <= initial) continue;

    const results = await Promise.allSettled(
      SWARM_ADDRESSES.map((addr) => getPosition(batchId, addr))
    );
    const changed = results.filter(
      (r) => r.status === "fulfilled" &&
        r.value.bitmapHash !== ZERO_HASH &&
        r.value.balance !== r.value.totalDeposited
    ).length;
    console.log(`  Batch ${batchId}: ${changed}/${SWARM_COUNT} balances changed`);
    expect(changed).toBeGreaterThan(0);
  }
});

// ── Stage 5: Frontend ──

test("Stage 5: frontend displays swarm data", async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/vision`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-testid="source-card"]').first()).toBeVisible({
    timeout: 30_000,
  });

  // Navigate to detail page
  await page.locator('[data-testid="source-card"]').first().click();
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

  // Check leaderboard
  await page.goto(`${FRONTEND_URL}/vision/leaderboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5_000);

  const content = await page.textContent("body");
  const visible = SWARM_ADDRESSES.filter((a) =>
    content?.toLowerCase().includes(a.toLowerCase().slice(2, 10))
  );
  console.log(`  ${visible.length}/${SWARM_COUNT} bots on leaderboard`);
});

// ── Stage 6: Economic invariants ──

test("Stage 6: economic invariants hold", async () => {
  // 6a. Solvency (HARD assertion)
  const solvency = await verifySolvency(BATCH_IDS);
  console.log(`  Solvency: ${solvency.passed ? "PASS" : "FAIL"} (${solvency.actual} vs ${solvency.expected})`);
  expect(solvency.passed, solvency.detail).toBe(true);

  // 6b. Per-batch conservation (SOFT — informational only, no assertion)
  for (const batchId of FAST_BATCHES.slice(0, 5)) {
    const info = await verifyBatchConservation(batchId, SWARM_ADDRESSES);
    console.log(`  ${info.name}: ${info.detail}`);
    // No expect — subset invariant is not guaranteed
  }
});

// ── Teardown ──

test.afterAll(async () => {
  try {
    for (let i = 0; i < 3; i++) {
      console.log(`\n=== Bot ${i} ===\n${botLogs(i, 15)}`);
    }
  } catch { /* VPS unreachable */ }
});
