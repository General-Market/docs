#!/usr/bin/env node
/**
 * Deploy 627 mock ERC20 tokens in batches using MockTokenFactory
 *
 * Usage: node scripts/deploy-mock-tokens-batch.js [options]
 *
 * Options:
 *   --rpc URL          RPC endpoint (default: http://localhost:8545)
 *   --key KEY          Private key (default: Anvil account 0)
 *   --vault ADDR       MockBitgetVault address to fund (optional)
 *   --mint AMOUNT      Amount to mint per token in ether (default: 1000000)
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const RPC_URL = getArg('rpc', 'http://localhost:8545');
const PRIVATE_KEY = getArg('key', '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const VAULT_ADDR = getArg('vault', '');
const MINT_AMOUNT = getArg('mint', '1000000');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_FILE = path.join(PROJECT_ROOT, 'assets.json');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'data', 'symbol-map.json');
const CONTRACTS_DIR = path.join(PROJECT_ROOT, 'contracts');

console.log('=== Mock Token Batch Deployment ===');
console.log(`RPC: ${RPC_URL}`);
console.log(`Vault: ${VAULT_ADDR || '(none - no funding)'}`);
console.log(`Mint amount: ${MINT_AMOUNT} tokens each`);
console.log('');

// Load assets
const assets = JSON.parse(fs.readFileSync(ASSETS_FILE, 'utf8'));
console.log(`Loaded ${assets.length} assets from assets.json`);

// Ensure data directory
fs.mkdirSync(path.join(PROJECT_ROOT, 'data'), { recursive: true });

// Build contracts
console.log('\n[1/4] Building contracts...');
execSync('forge build --quiet', { cwd: CONTRACTS_DIR, stdio: 'inherit' });

// Deploy factory using forge script (more reliable than forge create)
console.log('\n[2/4] Deploying MockTokenFactory...');
try {
    execSync(
        `PRIVATE_KEY="${PRIVATE_KEY}" forge script script/DeployMockTokenFactory.s.sol:DeployMockTokenFactory --rpc-url "${RPC_URL}" --broadcast --quiet`,
        { cwd: CONTRACTS_DIR, encoding: 'utf8', stdio: 'inherit' }
    );
} catch (e) {
    console.error('  Factory deployment failed, trying alternative method...');
}

// Read factory address from deployment file
let factoryAddr;
const factoryDeployFile = path.join(PROJECT_ROOT, 'deployments', 'mock-token-factory.json');
if (fs.existsSync(factoryDeployFile)) {
    const factoryData = JSON.parse(fs.readFileSync(factoryDeployFile, 'utf8'));
    factoryAddr = factoryData.factory;
} else {
    // Fallback: use deterministic address based on deployer nonce
    // This is fragile but works for local E2E
    console.error('  WARNING: Could not read factory address, deployment may have failed');
    process.exit(1);
}
console.log(`  Factory deployed: ${factoryAddr}`);

// Helper to extract symbol from Bitget pair
function extractSymbol(bitgetPair) {
    return bitgetPair.replace(/(USDT|USDC|USD)$/, '');
}

// Deploy tokens in batches of 50
console.log('\n[3/4] Deploying tokens in batches...');
const BATCH_SIZE = 50;
const symbolMap = {};
let deployed = 0;

for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    const batch = assets.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(assets.length / BATCH_SIZE);

    // Prepare batch data
    const ids = batch.map(a => a.id);
    const symbols = batch.map(a => extractSymbol(a.bitget));
    const bitgetPairs = batch.map(a => a.bitget);

    // Format arrays for Solidity
    const idsArg = `[${ids.join(',')}]`;
    const symbolsArg = `[${symbols.map(s => `"${s}"`).join(',')}]`;
    const pairsArg = `[${bitgetPairs.map(p => `"${p}"`).join(',')}]`;

    try {
        let result;
        if (VAULT_ADDR) {
            // Deploy and fund
            const mintWei = BigInt(MINT_AMOUNT) * BigInt(10 ** 18);
            result = execSync(
                `cast send "${factoryAddr}" "deployBatchAndFund(uint256[],string[],string[],address,uint256)" '${idsArg}' '${symbolsArg}' '${pairsArg}' "${VAULT_ADDR}" ${mintWei} --rpc-url "${RPC_URL}" --private-key "${PRIVATE_KEY}" --json`,
                { cwd: CONTRACTS_DIR, encoding: 'utf8' }
            );
        } else {
            // Deploy only
            result = execSync(
                `cast send "${factoryAddr}" "deployBatch(uint256[],string[],string[])" '${idsArg}' '${symbolsArg}' '${pairsArg}' --rpc-url "${RPC_URL}" --private-key "${PRIVATE_KEY}" --json`,
                { cwd: CONTRACTS_DIR, encoding: 'utf8' }
            );
        }

        // Parse logs to get deployed addresses
        const txReceipt = JSON.parse(result);
        const logs = txReceipt.logs || [];

        // TokenDeployed event signature: keccak256("TokenDeployed(uint256,address,string)")
        const eventSig = '0x' + execSync('cast keccak "TokenDeployed(uint256,address,string)"', { encoding: 'utf8' }).trim().slice(2, 66);

        for (const log of logs) {
            if (log.topics && log.topics[0] === eventSig) {
                // topics[1] = id (indexed), data = abi.encode(address, string)
                const id = parseInt(log.topics[1], 16);
                // Decode data: first 32 bytes = address (padded), rest = string
                const data = log.data.slice(2); // remove 0x
                const addr = '0x' + data.slice(24, 64); // address is in bytes 12-32 of first word

                // Find matching asset
                const asset = batch.find(a => a.id === id);
                if (asset) {
                    symbolMap[addr] = asset.bitget;
                    deployed++;
                }
            }
        }

        console.log(`  Batch ${batchNum}/${totalBatches}: deployed ${batch.length} tokens (${deployed} total)`);
    } catch (err) {
        console.error(`  Batch ${batchNum} FAILED:`, err.message);
    }
}

// Write symbol map
console.log('\n[4/4] Writing symbol-map.json...');
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(symbolMap, null, 2));

console.log(`\n=== Deployment Complete ===`);
console.log(`Deployed: ${deployed}/${assets.length} tokens`);
console.log(`Symbol map: ${OUTPUT_FILE}`);
console.log(`\nTo use with oracle:`);
console.log(`  ./target/debug/oracle --symbol-map-file ${OUTPUT_FILE} ...`);
