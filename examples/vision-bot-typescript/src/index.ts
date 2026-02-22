import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  keccak256,
  toHex,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arbitrum } from "viem/chains";
import "dotenv/config";

// -- Config -------------------------------------------------------------------

const RPC_URL = process.env.RPC_URL || "https://arb1.arbitrum.io/rpc";
const VISION_API_URL =
  process.env.VISION_API_URL || "https://generalmarket.io/api/vision";
const VISION_ADDRESS = process.env.VISION_ADDRESS as Hex;
const USDC_ADDRESS = process.env.USDC_ADDRESS as Hex;
const DEPOSIT_AMOUNT = parseUnits(process.env.DEPOSIT_AMOUNT || "10", 6);
const STAKE_PER_TICK = parseUnits(process.env.STAKE_PER_TICK || "1", 6);
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || "30") * 1000;

const account = privateKeyToAccount(process.env.BOT_PRIVATE_KEY as Hex);
const publicClient = createPublicClient({
  chain: arbitrum,
  transport: http(RPC_URL),
});
const walletClient = createWalletClient({
  account,
  chain: arbitrum,
  transport: http(RPC_URL),
});

// -- ABIs (minimal) -----------------------------------------------------------

const visionAbi = [
  { type: "function", name: "registerBot", inputs: [{ name: "endpoint", type: "string" }, { name: "pubkeyHash", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "joinBatch", inputs: [{ name: "batchId", type: "uint256" }, { name: "depositAmount", type: "uint256" }, { name: "stakePerTick", type: "uint256" }, { name: "bitmapHash", type: "bytes32" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "claimRewards", inputs: [{ name: "batchId", type: "uint256" }, { name: "fromTick", type: "uint256" }, { name: "toTick", type: "uint256" }, { name: "newBalance", type: "uint256" }, { name: "blsSignature", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "withdraw", inputs: [{ name: "batchId", type: "uint256" }, { name: "finalBalance", type: "uint256" }, { name: "blsSignature", type: "bytes" }], outputs: [], stateMutability: "nonpayable" },
] as const;

const erc20Abi = [
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }], stateMutability: "nonpayable" },
] as const;

// -- Helpers ------------------------------------------------------------------

const joined = new Set<number>();

function encodeBitmap(bets: boolean[]): Uint8Array {
  const byteCount = Math.ceil(bets.length / 8);
  const bitmap = new Uint8Array(byteCount);
  for (let i = 0; i < bets.length; i++) {
    if (bets[i]) {
      bitmap[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    }
  }
  return bitmap;
}

function randomBets(n: number): boolean[] {
  return Array.from({ length: n }, () => Math.random() > 0.5);
}

async function sendAndWait(hash: Hex) {
  await publicClient.waitForTransactionReceipt({ hash });
}

// -- Bot lifecycle ------------------------------------------------------------

async function register() {
  const pubkeyHash = keccak256(toHex(`bot-${account.address}`));
  try {
    const hash = await walletClient.writeContract({
      address: VISION_ADDRESS,
      abi: visionAbi,
      functionName: "registerBot",
      args: ["https://my-bot.example.com", pubkeyHash],
    });
    await sendAndWait(hash);
    console.log(`[+] Registered bot ${account.address}`);
  } catch (e: any) {
    console.log(`[*] Registration skipped: ${e.shortMessage || e.message}`);
  }
}

async function joinBatch(batchId: number, marketCount: number) {
  const bets = randomBets(marketCount);
  const bitmap = encodeBitmap(bets);
  const bitmapHash = keccak256(bitmap);

  const ups = bets.filter(Boolean).length;
  console.log(`[>] Batch ${batchId}: ${marketCount} markets, ${ups} UP / ${marketCount - ups} DOWN`);

  // 1. Approve USDC
  const approveTx = await walletClient.writeContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [VISION_ADDRESS, DEPOSIT_AMOUNT],
  });
  await sendAndWait(approveTx);

  // 2. Join on-chain
  const joinTx = await walletClient.writeContract({
    address: VISION_ADDRESS,
    abi: visionAbi,
    functionName: "joinBatch",
    args: [BigInt(batchId), DEPOSIT_AMOUNT, STAKE_PER_TICK, bitmapHash],
  });
  await sendAndWait(joinTx);

  // 3. Wait for indexer
  console.log("[*] Waiting 6s for chain indexer...");
  await new Promise((r) => setTimeout(r, 6000));

  // 4. Submit bitmap to API
  const resp = await fetch(`${VISION_API_URL}/vision/bitmap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      player: account.address,
      batch_id: batchId,
      bitmap_hex: toHex(bitmap),
      expected_hash: bitmapHash,
    }),
  });

  if (resp.ok) {
    console.log(`[+] Bitmap accepted for batch ${batchId}`);
  } else {
    console.log(`[!] Bitmap rejected: ${resp.status} ${(await resp.text()).slice(0, 200)}`);
  }

  joined.add(batchId);
}

async function checkClaims() {
  for (const batchId of joined) {
    try {
      const resp = await fetch(
        `${VISION_API_URL}/vision/balance/${batchId}/${account.address}`
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data.claimable > 0 && data.bls_signature) {
        const hash = await walletClient.writeContract({
          address: VISION_ADDRESS,
          abi: visionAbi,
          functionName: "claimRewards",
          args: [
            BigInt(batchId),
            BigInt(data.from_tick),
            BigInt(data.to_tick),
            BigInt(data.new_balance),
            data.bls_signature as Hex,
          ],
        });
        await sendAndWait(hash);
        console.log(`[+] Claimed rewards for batch ${batchId}`);
      }
    } catch (e: any) {
      console.log(`[!] Claim check failed for batch ${batchId}: ${e.message}`);
    }
  }
}

// -- Main loop ----------------------------------------------------------------

async function main() {
  const chainId = await publicClient.getChainId();
  console.log(`Vision Bot | ${account.address} | chain ${chainId}`);
  await register();

  while (true) {
    try {
      const resp = await fetch(`${VISION_API_URL}/vision/batches`);
      const batches = resp.ok ? (await resp.json()).batches || [] : [];

      for (const batch of batches) {
        const bid = batch.id ?? batch.batch_id;
        if (bid == null || joined.has(bid) || batch.paused) continue;
        const marketCount = batch.market_count || batch.market_ids?.length || 0;
        if (marketCount > 0) {
          await joinBatch(bid, marketCount);
        }
      }

      await checkClaims();
    } catch (e: any) {
      console.log(`[!] Error: ${e.message}`);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
  }
}

main();
