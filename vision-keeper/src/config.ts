import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import type { Address, Hex } from 'viem';

loadEnv();

const HERE = dirname(fileURLToPath(import.meta.url));

interface DeploymentJson {
  chainId: number;
  contracts: {
    Vision?: string;
    VisionVaultFactory?: string;
  };
}

export interface KeeperConfig {
  rpcUrl: string;
  chainId: number;
  visionAddress: Address;
  vaultFactoryAddress: Address;
  privateKey: Hex;
  pollIntervalMs: number;
  lookbackSeconds: number;
  healthPort: number;
  vaultRefreshMs: number;
  logEventChunk: bigint;
  refundConcurrency: number;
}

function findDeploymentJson(): DeploymentJson {
  const candidates = [
    process.env.DEPLOYMENT_JSON,
    resolve(HERE, '../../contracts/deployments/active-deployment.json'),
    resolve(HERE, '../../deployments/active-deployment.json'),
    resolve(HERE, '../../envs/testnet/active-deployment.json'),
  ].filter((p): p is string => Boolean(p));

  for (const path of candidates) {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8');
      return JSON.parse(raw) as DeploymentJson;
    }
  }

  throw new Error(
    `No deployment.json found. Tried:\n${candidates.map((c) => `  - ${c}`).join('\n')}\n` +
      `Set DEPLOYMENT_JSON to override.`,
  );
}

function asAddress(value: string | undefined, label: string): Address {
  if (!value || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${label} is not a valid 0x-prefixed address: ${String(value)}`);
  }
  return value as Address;
}

function asHexKey(value: string | undefined): Hex {
  if (!value) {
    throw new Error('KEEPER_PRIVATE_KEY is not set. The keeper has no hands without it.');
  }
  const normalised = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalised)) {
    throw new Error('KEEPER_PRIVATE_KEY must be a 32-byte hex string.');
  }
  return normalised as Hex;
}

export function loadConfig(): KeeperConfig {
  const deployment = findDeploymentJson();
  const visionAddress = asAddress(deployment.contracts.Vision, 'Vision');
  const vaultFactoryAddress = asAddress(deployment.contracts.VisionVaultFactory, 'VisionVaultFactory');
  const privateKey = asHexKey(process.env.KEEPER_PRIVATE_KEY);

  return {
    rpcUrl: process.env.L3_RPC_URL ?? 'https://rpc.generalmarket.io/',
    chainId: deployment.chainId,
    visionAddress,
    vaultFactoryAddress,
    privateKey,
    pollIntervalMs: Number(process.env.POLL_INTERVAL_SECS ?? '60') * 1000,
    // 6h: the L3 node prunes deeper history, so a wider default would only
    // produce pebble: not found on every cold boot.
    lookbackSeconds: Number(process.env.LOOKBACK_SECONDS ?? `${6 * 60 * 60}`),
    healthPort: Number(process.env.KEEPER_HEALTH_PORT ?? '9201'),
    vaultRefreshMs: Number(process.env.VAULT_REFRESH_SECS ?? '900') * 1000,
    logEventChunk: BigInt(process.env.LOG_EVENT_CHUNK ?? '5000'),
    refundConcurrency: Math.max(1, Number(process.env.REFUND_CONCURRENCY ?? '6')),
  };
}
