/**
 * Report generation — markdown + JSON output.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { NettingResult } from './phase0-netting';
import { Phase1Result } from './phase1-itp-scaling';
import { Phase2Result } from './phase2-relay-stress';
import { Phase3Result } from './phase3-order-flood';
import { Phase4Result } from './phase4-rebalance';
import { Phase5Result } from './phase5-combined';
import { Phase6Result } from './phase6-chaos-fuzz';
import { MonitorData } from './monitor';

export interface StressTestReport {
  timestamp: string;
  durationMs: number;
  phases: {
    netting?: NettingResult[];
    itpScaling?: Phase1Result[];
    relayStress?: Phase2Result[];
    orderFlood?: Phase3Result[];
    rebalance?: Phase4Result[];
    combined?: Phase5Result[];
    chaosFuzz?: Phase6Result;
  };
  monitor?: MonitorData;
  breakingPoints: string[];
}

export function generateReport(report: StressTestReport): { markdown: string; json: string } {
  const bp = report.breakingPoints;
  const ts = report.timestamp;

  let md = `# Stress Test Report\n\n`;
  md += `**Timestamp**: ${ts}\n`;
  md += `**Duration**: ${(report.durationMs / 1000).toFixed(1)}s\n\n`;

  // Breaking points summary
  if (bp.length > 0) {
    md += `## Breaking Points Found\n\n`;
    for (const point of bp) {
      md += `- ${point}\n`;
    }
    md += `\n`;
  } else {
    md += `## No Breaking Points Found\n\n`;
  }

  // Phase 0: Netting
  if (report.phases.netting) {
    md += `## Phase 0: Netting Correctness\n\n`;
    md += `| Test | Passed | Duration | Details |\n`;
    md += `|------|--------|----------|----------|\n`;
    for (const r of report.phases.netting) {
      md += `| ${r.test} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.durationMs.toFixed(0)}ms | ${r.details} |\n`;
    }
    md += `\n`;
  }

  // Phase 1: ITP Scaling
  if (report.phases.itpScaling) {
    md += `## Phase 1: ITP Creation Scaling\n\n`;
    md += `| Tier | Label | ITPs Created | Avg Gas | Wall Time | getItpCount | getItpState | Breaking Point |\n`;
    md += `|------|-------|-------------|---------|-----------|-------------|-------------|----------------|\n`;
    for (const r of report.phases.itpScaling) {
      md += `| ${r.tier} | ${r.label} | ${r.itpsCreated} | ${r.avgGasPerItp} | ${r.wallTimeMs.toFixed(0)}ms | ${r.getItpCountLatencyMs.toFixed(1)}ms | ${r.getItpStateLatencyMs.toFixed(1)}ms | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;
  }

  // Phase 2: Relay Stress
  if (report.phases.relayStress) {
    md += `## Phase 2: Oracle Relay Stress\n\n`;
    md += `| Level | Requests | Send Time | Completion Time | Rate (req/s) | Health Stable | Breaking Point |\n`;
    md += `|-------|----------|-----------|-----------------|--------------|---------------|----------------|\n`;
    for (const r of report.phases.relayStress) {
      md += `| ${r.level} | ${r.requestsSent} | ${r.requestTimeMs.toFixed(0)}ms | ${r.completionTimeMs.toFixed(0)}ms | ${r.processingRate.toFixed(2)} | ${r.healthStable ? 'Yes' : 'No'} | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;
  }

  // Phase 3: Order Flood
  if (report.phases.orderFlood) {
    md += `## Phase 3: Order Flood\n\n`;
    md += `| Tier | Orders | Failed | Filled | Submit Rate | P50 | P95 | P99 | Queue Full | Breaking Point |\n`;
    md += `|------|--------|--------|--------|-------------|-----|-----|-----|------------|----------------|\n`;
    for (const r of report.phases.orderFlood) {
      md += `| ${r.tier} | ${r.ordersSubmitted} | ${r.ordersFailed} | ${r.ordersFilledCount} | ${r.submitRatePerSec.toFixed(1)}/s | ${r.fillLatencyP50Ms.toFixed(0)}ms | ${r.fillLatencyP95Ms.toFixed(0)}ms | ${r.fillLatencyP99Ms.toFixed(0)}ms | ${r.queueFullTriggered ? 'Yes' : 'No'} | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;
  }

  // Phase 4: Rebalance
  if (report.phases.rebalance) {
    md += `## Phase 4: Rebalance Storm\n\n`;
    md += `| Tier | Attempted | Completed | Avg Latency | Max Latency | NAV Preserved | NAV Drift | Breaking Point |\n`;
    md += `|------|-----------|-----------|-------------|-------------|---------------|-----------|----------------|\n`;
    for (const r of report.phases.rebalance) {
      md += `| ${r.tier} | ${r.rebalancesAttempted} | ${r.rebalancesCompleted} | ${r.avgLatencyMs.toFixed(0)}ms | ${r.maxLatencyMs.toFixed(0)}ms | ${r.navPreserved ? 'Yes' : 'No'} | ${r.navDriftPct.toFixed(4)}% | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;
  }

  // Phase 5: Combined
  if (report.phases.combined) {
    md += `## Phase 5: Combined Load\n\n`;
    md += `| Rate | Duration | Buys | Sells | Rebalances | Creates | Fills | P50 | P95 | P99 | Health Drops | Breaking Point |\n`;
    md += `|------|----------|------|-------|------------|---------|-------|-----|-----|-----|-------------|----------------|\n`;
    for (const r of report.phases.combined) {
      md += `| ${r.rate} | ${r.durationMs.toFixed(0)}ms | ${r.buysSubmitted} | ${r.sellsSubmitted} | ${r.rebalancesRequested} | ${r.itpsCreated} | ${r.ordersFilledCount} | ${r.fillLatencyP50Ms.toFixed(0)}ms | ${r.fillLatencyP95Ms.toFixed(0)}ms | ${r.fillLatencyP99Ms.toFixed(0)}ms | ${r.healthDrops} | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;
  }

  // Phase 6: Chaos Fuzz
  if (report.phases.chaosFuzz && report.phases.chaosFuzz.length > 0) {
    md += `## Phase 6: Chaos Fuzz Test\n\n`;
    md += `### Operations Summary\n\n`;
    md += `| Tier | Duration | Ops Total | Succeeded | Failed | Buy | Sell | Create | Rebalance | Liquidate | Breaking Point |\n`;
    md += `|------|----------|-----------|-----------|--------|-----|------|--------|-----------|-----------|----------------|\n`;
    for (const r of report.phases.chaosFuzz) {
      md += `| ${r.tier} | ${r.durationMs.toFixed(0)}ms | ${r.opsAttempted} | ${r.opsSucceeded} | ${r.opsFailed} | ${r.opsByType.buy} | ${r.opsByType.sell} | ${r.opsByType.create} | ${r.opsByType.rebalance} | ${r.opsByType.liquidate} | ${r.breakingPoint ?? '—'} |\n`;
    }
    md += `\n`;

    md += `### Fuzz Validation\n\n`;
    md += `| Tier | Fuzz Ops | Correct Reverts | INCORRECT Successes | Correct Successes | Incorrect Reverts |\n`;
    md += `|------|----------|-----------------|---------------------|-------------------|-----------|\n`;
    for (const r of report.phases.chaosFuzz) {
      const fs = r.fuzzStats;
      md += `| ${r.tier} | ${fs.totalFuzzOps} | ${fs.correctReverts} | ${fs.incorrectSuccesses} | ${fs.correctSuccesses} | ${fs.incorrectReverts} |\n`;
    }
    md += `\n`;

    md += `### Reconciliation\n\n`;
    md += `| Tier | Block Range | Orders | Fills | Creates | Rebalances | Fees | Stuck | Escrow Leaks | Mismatches |\n`;
    md += `|------|-------------|--------|-------|---------|------------|------|-------|--------------|------------|\n`;
    for (const r of report.phases.chaosFuzz) {
      const rc = r.reconciliation;
      md += `| ${r.tier} | ${rc.initialBlock}→${rc.finalBlock} | ${rc.events.ordersSubmitted} | ${rc.events.fillsConfirmed} | ${rc.events.itpsCreated} | ${rc.events.rebalances} | ${rc.events.feesCharged} | ${rc.stuckOrders} | ${rc.escrowLeaks} | ${rc.mismatches.length} |\n`;
    }
    md += `\n`;

    // List critical mismatches
    const allMismatches = report.phases.chaosFuzz.flatMap(r => r.reconciliation.mismatches);
    const criticals = allMismatches.filter(m => m.severity === 'critical');
    if (criticals.length > 0) {
      md += `### Critical Mismatches\n\n`;
      md += `| Category | Description | Expected | Actual |\n`;
      md += `|----------|-------------|----------|--------|\n`;
      for (const m of criticals.slice(0, 20)) {
        md += `| ${m.category} | ${m.description} | ${m.expected} | ${m.actual} |\n`;
      }
      if (criticals.length > 20) {
        md += `\n... and ${criticals.length - 20} more critical mismatches\n`;
      }
      md += `\n`;
    }
  }

  // Monitor summary
  if (report.monitor) {
    md += `## Health Monitor Summary\n\n`;
    md += `- Duration: ${((report.monitor.end - report.monitor.start) / 1000).toFixed(1)}s\n`;
    md += `- Total samples: ${report.monitor.samples.length}\n`;
    md += `- Anomalies: ${report.monitor.anomalies.length}\n`;

    if (report.monitor.anomalies.length > 0) {
      md += `\n### Anomalies\n\n`;
      md += `| Time | Service | Status | Latency |\n`;
      md += `|------|---------|--------|----------|\n`;
      for (const a of report.monitor.anomalies.slice(0, 20)) {
        const relTime = ((a.timestamp - report.monitor.start) / 1000).toFixed(1);
        md += `| ${relTime}s | ${a.service} | ${a.status} | ${a.latencyMs.toFixed(0)}ms |\n`;
      }
      if (report.monitor.anomalies.length > 20) {
        md += `\n... and ${report.monitor.anomalies.length - 20} more anomalies\n`;
      }
    }
    md += `\n`;
  }

  const json = JSON.stringify(report, (_, v) =>
    typeof v === 'bigint' ? v.toString() : v, 2);

  return { markdown: md, json };
}

export function writeReport(report: StressTestReport): { mdPath: string; jsonPath: string } {
  const { markdown, json } = generateReport(report);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Write reports to scripts/stress-test/reports/ directory
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const reportsDir = join(scriptDir, 'reports');
  mkdirSync(reportsDir, { recursive: true });

  const mdPath = join(reportsDir, `stress-test-report-${timestamp}.md`);
  const jsonPath = join(reportsDir, `stress-test-report-${timestamp}.json`);

  writeFileSync(mdPath, markdown, 'utf8');
  writeFileSync(jsonPath, json, 'utf8');

  return { mdPath, jsonPath };
}
