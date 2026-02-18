#!/usr/bin/env npx tsx
/**
 * Stress Test: Index L3 Issuer Infrastructure
 *
 * Entry point — orchestrates all phases, handles CLI args.
 *
 * Usage:
 *   npx tsx scripts/stress-test/index.ts [--phase 0-5] [--verbose]
 *
 * Phases:
 *   0  Netting correctness (simplest, ~30s)
 *   1  ITP creation scaling (~2 min)
 *   2  Issuer relay stress (~5 min)
 *   3  Order flood (~5 min)
 *   4  Rebalance storm (~2 min)
 *   5  Combined load (~3 min)
 *
 * Without --phase, runs all phases sequentially.
 */

import { log, logSection, timer, setVerbose } from './helpers';
import { startMonitor, stopMonitor, checkRpcsHealthy, checkServicesReady } from './monitor';
import { runPhase0 } from './phase0-netting';
import { runPhase1 } from './phase1-itp-scaling';
import { runPhase2 } from './phase2-relay-stress';
import { runPhase3 } from './phase3-order-flood';
import { runPhase4 } from './phase4-rebalance';
import { runPhase5 } from './phase5-combined';
import { runPhase6 } from './phase6-chaos-fuzz';
import { writeReport, StressTestReport } from './report';
import { getItpCount } from './helpers';

// ── CLI args ─────────────────────────────────────────────────────────

function parseArgs(): { phase: number | null; verbose: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  let phase: number | null = null;
  let verbose = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--phase' && args[i + 1]) {
      phase = parseInt(args[i + 1], 10);
      if (isNaN(phase) || phase < 0 || phase > 6) {
        console.error(`Invalid phase: ${args[i + 1]}. Must be 0-6.`);
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      verbose = true;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Stress Test: Index L3 Issuer Infrastructure

Usage: npx tsx scripts/stress-test/index.ts [options]

Options:
  --phase N     Run only phase N (0-6)
  --verbose     Show detailed output
  --dry-run     Pre-flight only: check RPCs, services, ITP count
  --help        Show this message

Phases:
  0  Netting correctness
  1  ITP creation scaling (direct L3)
  2  Issuer relay stress (BridgeProxy)
  3  Order flood (buy/sell)
  4  Rebalance storm
  5  Combined load (60s sustained)
  6  Chaos fuzz (100 accounts, reconciliation)
`);
      process.exit(0);
    }
  }

  return { phase, verbose, dryRun };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { phase, verbose, dryRun } = parseArgs();
  setVerbose(verbose);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║           INDEX L3 STRESS TEST                              ║
║  Finding breaking points in issuer infrastructure           ║
╚══════════════════════════════════════════════════════════════╝
`);

  // Pre-flight check
  logSection('PRE-FLIGHT CHECKS');
  log('Checking RPC connectivity...');
  const rpcsOk = await checkRpcsHealthy();
  if (!rpcsOk) {
    console.error('ERROR: L3 (localhost:8545) or Arb (localhost:8546) RPC not responding.');
    console.error('Run ./start.sh --no-tail first.');
    process.exit(1);
  }
  log('RPCs: OK');

  // Service health pre-flight (warn, don't block — Phase 1 doesn't need issuers)
  log('Checking service health...');
  const services = await checkServicesReady();
  for (const svc of services) {
    const icon = svc.healthy ? 'OK' : 'DOWN';
    const latency = svc.healthy ? ` (${svc.latencyMs.toFixed(0)}ms)` : '';
    log(`  ${svc.name}: ${icon}${latency}${svc.details ? ' — ' + svc.details : ''}`);
  }
  const downServices = services.filter(s => !s.healthy);
  if (downServices.length > 0) {
    log(`WARNING: ${downServices.length} service(s) down: ${downServices.map(s => s.name).join(', ')}`);
    log('Phases requiring these services may fail.');
  }

  // ITP count
  try {
    const itpCount = await getItpCount();
    log(`ITP count on L3: ${itpCount}`);
  } catch {
    log('ITP count: could not read (Index contract may not be deployed)');
  }

  if (dryRun) {
    logSection('DRY RUN COMPLETE');
    log('All pre-flight checks done. Ready to run stress test.');
    process.exit(0);
  }

  const report: StressTestReport = {
    timestamp: new Date().toISOString(),
    durationMs: 0,
    phases: {},
    breakingPoints: [],
  };

  const tTotal = timer('total');

  // Start background health monitor
  startMonitor(1_000);

  try {
    // Phase 0: Netting
    if (phase === null || phase === 0) {
      report.phases.netting = await runPhase0();
      collectBreakingPoints(report);
    }

    // Phase 1: ITP Scaling
    if (phase === null || phase === 1) {
      report.phases.itpScaling = await runPhase1();
      collectBreakingPoints(report);
    }

    // Phase 2: Relay Stress
    if (phase === null || phase === 2) {
      report.phases.relayStress = await runPhase2();
      collectBreakingPoints(report);
    }

    // Phase 3: Order Flood
    if (phase === null || phase === 3) {
      report.phases.orderFlood = await runPhase3();
      collectBreakingPoints(report);
    }

    // Phase 4: Rebalance
    if (phase === null || phase === 4) {
      report.phases.rebalance = await runPhase4();
      collectBreakingPoints(report);
    }

    // Phase 5: Combined
    if (phase === null || phase === 5) {
      report.phases.combined = await runPhase5();
      collectBreakingPoints(report);
    }

    // Phase 6: Chaos Fuzz
    if (phase === null || phase === 6) {
      report.phases.chaosFuzz = await runPhase6();
      collectBreakingPoints(report);
    }
  } catch (err: any) {
    console.error(`\nFATAL ERROR: ${err.message}`);
    console.error(err.stack);
    report.breakingPoints.push(`Fatal: ${err.message}`);
  }

  // Stop monitor and attach data
  report.monitor = stopMonitor();
  report.durationMs = tTotal.stop().ms;

  // Write report
  logSection('REPORT');
  const { mdPath, jsonPath } = writeReport(report);
  log(`Markdown: ${mdPath}`);
  log(`JSON:     ${jsonPath}`);

  // Summary
  logSection('SUMMARY');
  log(`Duration: ${(report.durationMs / 1000).toFixed(1)}s`);
  log(`Breaking points: ${report.breakingPoints.length}`);
  for (const bp of report.breakingPoints) {
    log(`  - ${bp}`);
  }

  if (report.phases.netting) {
    const passed = report.phases.netting.filter(r => r.passed).length;
    log(`Netting: ${passed}/${report.phases.netting.length} passed`);
  }

  if (report.phases.chaosFuzz && report.phases.chaosFuzz.length > 0) {
    const totalOps = report.phases.chaosFuzz.reduce((s, r) => s + r.opsAttempted, 0);
    const totalFuzz = report.phases.chaosFuzz.reduce((s, r) => s + r.fuzzStats.totalFuzzOps, 0);
    const incorrectSuccesses = report.phases.chaosFuzz.reduce((s, r) => s + r.fuzzStats.incorrectSuccesses, 0);
    log(`Chaos fuzz: ${totalOps} ops, ${totalFuzz} fuzz vectors, ${incorrectSuccesses} incorrect successes`);
  }

  if (report.monitor.anomalies.length > 0) {
    log(`Health anomalies: ${report.monitor.anomalies.length}`);
  }

  console.log('');
}

function collectBreakingPoints(report: StressTestReport) {
  const bp = report.breakingPoints;

  // Phase 0
  if (report.phases.netting) {
    for (const r of report.phases.netting) {
      if (!r.passed) bp.push(`Netting ${r.test}: ${r.details}`);
    }
  }

  // Phase 1
  if (report.phases.itpScaling) {
    for (const r of report.phases.itpScaling) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`ITP Scaling ${r.tier}: ${r.breakingPoint}`);
      }
    }
  }

  // Phase 2
  if (report.phases.relayStress) {
    for (const r of report.phases.relayStress) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`Relay ${r.level}: ${r.breakingPoint}`);
      }
    }
  }

  // Phase 3
  if (report.phases.orderFlood) {
    for (const r of report.phases.orderFlood) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`Orders ${r.tier}: ${r.breakingPoint}`);
      }
    }
  }

  // Phase 4
  if (report.phases.rebalance) {
    for (const r of report.phases.rebalance) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`Rebalance ${r.tier}: ${r.breakingPoint}`);
      }
    }
  }

  // Phase 5
  if (report.phases.combined) {
    for (const r of report.phases.combined) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`Combined ${r.rate}: ${r.breakingPoint}`);
      }
    }
  }

  // Phase 6
  if (report.phases.chaosFuzz) {
    for (const r of report.phases.chaosFuzz) {
      if (r.breakingPoint && !bp.includes(r.breakingPoint)) {
        bp.push(`Chaos ${r.tier}: ${r.breakingPoint}`);
      }
    }
  }

  // Deduplicate
  report.breakingPoints = [...new Set(bp)];
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
