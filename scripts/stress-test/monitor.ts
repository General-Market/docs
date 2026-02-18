/**
 * Background health monitoring for issuers and AP.
 * Polls health endpoints every 1s, captures time-series data.
 */

import { ISSUER_HEALTH_PORTS, AP_HEALTH_PORT } from './config';
import { timer } from './helpers';

export interface HealthSample {
  timestamp: number;
  service: string;
  status: 'ok' | 'error' | 'timeout';
  latencyMs: number;
  peerCount?: number;
  extra?: Record<string, unknown>;
}

export interface MonitorData {
  samples: HealthSample[];
  anomalies: HealthSample[];
  start: number;
  end: number;
}

let _interval: ReturnType<typeof setInterval> | null = null;
let _samples: HealthSample[] = [];
let _anomalies: HealthSample[] = [];
let _startTime = 0;

async function pollHealth(port: number, service: string): Promise<HealthSample> {
  const t = timer(service);
  const sample: HealthSample = {
    timestamp: Date.now(),
    service,
    status: 'ok',
    latencyMs: 0,
  };

  try {
    const res = await fetch(`http://localhost:${port}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const elapsed = t.stop();
    sample.latencyMs = elapsed.ms;

    if (!res.ok) {
      sample.status = 'error';
    } else {
      try {
        const body = await res.json() as Record<string, unknown>;
        if (typeof body.peer_count === 'number') {
          sample.peerCount = body.peer_count as number;
        }
        if (typeof body.peers === 'number') {
          sample.peerCount = body.peers as number;
        }
        sample.extra = body;
      } catch {
        // Response may not be JSON
      }
    }
  } catch (err: any) {
    const elapsed = t.stop();
    sample.latencyMs = elapsed.ms;
    sample.status = err?.name === 'TimeoutError' ? 'timeout' : 'error';
  }

  return sample;
}

/** Start background health monitoring. */
export function startMonitor(intervalMs = 1_000): void {
  if (_interval) return;
  _samples = [];
  _anomalies = [];
  _startTime = Date.now();

  _interval = setInterval(async () => {
    const services = [
      ...ISSUER_HEALTH_PORTS.map((port, i) => ({ port, name: `issuer-${i + 1}` })),
      { port: AP_HEALTH_PORT, name: 'ap' },
    ];

    const results = await Promise.allSettled(
      services.map(s => pollHealth(s.port, s.name))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const sample = r.value;
        _samples.push(sample);
        // Flag anomalies
        if (sample.status !== 'ok' || sample.latencyMs > 5_000) {
          _anomalies.push(sample);
        }
      }
    }
  }, intervalMs);
}

/** Stop monitoring and return collected data. */
export function stopMonitor(): MonitorData {
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }
  return {
    samples: _samples,
    anomalies: _anomalies,
    start: _startTime,
    end: Date.now(),
  };
}

/** Get a snapshot of current data without stopping. */
export function getMonitorSnapshot(): MonitorData {
  return {
    samples: [..._samples],
    anomalies: [..._anomalies],
    start: _startTime,
    end: Date.now(),
  };
}

/** Quick health check — returns true if all services respond. */
export async function checkAllHealthy(): Promise<boolean> {
  const services = [
    ...ISSUER_HEALTH_PORTS.map((port, i) => ({ port, name: `issuer-${i + 1}` })),
    { port: AP_HEALTH_PORT, name: 'ap' },
  ];

  const results = await Promise.allSettled(
    services.map(s => pollHealth(s.port, s.name))
  );

  return results.every(r => r.status === 'fulfilled' && r.value.status === 'ok');
}

/** Service readiness status for pre-flight checks. */
export interface ServiceStatus {
  name: string;
  healthy: boolean;
  latencyMs: number;
  details?: string;
}

/** Check all services and return per-service status (non-blocking — warns but doesn't fail). */
export async function checkServicesReady(): Promise<ServiceStatus[]> {
  const results: ServiceStatus[] = [];

  // Check issuers
  for (let i = 0; i < ISSUER_HEALTH_PORTS.length; i++) {
    const port = ISSUER_HEALTH_PORTS[i];
    const sample = await pollHealth(port, `issuer-${i + 1}`);
    results.push({
      name: `issuer-${i + 1}`,
      healthy: sample.status === 'ok',
      latencyMs: sample.latencyMs,
      details: sample.status === 'ok'
        ? `peers=${sample.peerCount ?? '?'}`
        : sample.status,
    });
  }

  // Check AP
  const apSample = await pollHealth(AP_HEALTH_PORT, 'ap');
  results.push({
    name: 'ap',
    healthy: apSample.status === 'ok',
    latencyMs: apSample.latencyMs,
    details: apSample.status === 'ok' ? 'ok' : apSample.status,
  });

  // Check data-node
  try {
    const start = performance.now();
    const res = await fetch('http://localhost:8200/health', {
      signal: AbortSignal.timeout(5_000),
    });
    const ms = performance.now() - start;
    results.push({
      name: 'data-node',
      healthy: res.ok,
      latencyMs: ms,
      details: res.ok ? 'ok' : `status=${res.status}`,
    });
  } catch {
    results.push({
      name: 'data-node',
      healthy: false,
      latencyMs: 0,
      details: 'unreachable',
    });
  }

  return results;
}

/** Quick RPC health check — returns true if both L3 and Arb respond. */
export async function checkRpcsHealthy(): Promise<boolean> {
  try {
    const [l3, arb] = await Promise.all([
      fetch('http://localhost:8545', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        signal: AbortSignal.timeout(5_000),
      }),
      fetch('http://localhost:8546', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
        signal: AbortSignal.timeout(5_000),
      }),
    ]);
    return l3.ok && arb.ok;
  } catch {
    return false;
  }
}
