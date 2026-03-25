import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  getL3UserShares,
  placeL3BuyOrderDirect,
  pollUntil,
  withdrawCollateralDirect,
  depositCollateralDirect,
  borrowDirect,
  repayDirect,
  mintL3Usdc,
  getMorphoPositionDirect,
  readMorphoDeployment,
  l3RpcCall,
  l3SignedSend,
  isValidErc20,
  createMorphoMarketDirect,
  supplyToMorphoDirect,
  overrideMorphoConfig,
  mintMorphoCollateral,
} from '../helpers/backend-api';
import { CONTRACTS } from '../env';
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem';

test.describe('Lending (Deposit -> Borrow -> Repay -> Withdraw)', () => {
  test('full lending cycle', async ({ walletPage: page }) => {
    test.setTimeout(300_000);

    // Ensure user has L3 ITP shares (needed for collateral)
    let shares = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    if (shares === 0n) {
      console.log('No L3 shares — placing L3 buy order...');
      await placeL3BuyOrderDirect(TEST_ADDRESS, ITP_ID, 100n * 10n ** 18n, 10n * 10n ** 18n);
      shares = await pollUntil(
        () => getL3UserShares(TEST_ADDRESS, ITP_ID),
        (s) => s > 0n,
        120_000,
        3_000,
      );
      console.log(`Buy order filled — shares: ${shares}`);
    }

    // Testnet: skip the UI path — use backend RPC directly
    console.log('Using backend API path for lending cycle');

    // Pre-check: verify Morpho core contract exists
    const morphoCheck = readMorphoDeployment();
    expect(morphoCheck).toBeTruthy();
    const morphoAddr = morphoCheck!.contracts?.MORPHO;
    expect(morphoAddr).toBeTruthy();

    const morphoCode = await l3RpcCall('eth_getCode', [morphoAddr, 'latest']);
    if (!morphoCode || morphoCode === '0x') {
      throw new Error(`MORPHO at ${morphoAddr} has no code — deployment is entirely stale`);
    }
    console.log(`MORPHO contract at ${morphoAddr}: has code`);

    // Validate collateral and loan tokens are real ERC20s
    const collateralOk = await isValidErc20(morphoCheck!.marketParams.collateralToken);
    const loanOk = await isValidErc20(morphoCheck!.marketParams.loanToken);
    const currentUsdc = CONTRACTS.L3_WUSDC || CONTRACTS.USDC;

    let needFreshMarket = false;
    if (!collateralOk) {
      console.log(`Collateral token ${morphoCheck!.marketParams.collateralToken} is not a valid ERC20 — stale deployment`);
      needFreshMarket = true;
    }
    if (!loanOk) {
      console.log(`Loan token ${morphoCheck!.marketParams.loanToken} is not a valid ERC20 — stale deployment`);
      needFreshMarket = true;
    }
    // Also check if loan token matches current USDC (deployment drift)
    if (loanOk && morphoCheck!.marketParams.loanToken.toLowerCase() !== currentUsdc.toLowerCase()) {
      console.log(`Loan token ${morphoCheck!.marketParams.loanToken} differs from current USDC ${currentUsdc}`);
      needFreshMarket = true;
    }

    // Check if stored MARKET_ID matches the keccak256 of current marketParams.
    // When only the JSON was updated (token address changed) without redeploying the market,
    // the stored ID is stale — on-chain operations will revert because Morpho validates params
    // against the market ID. Recompute and compare to catch this drift.
    if (!needFreshMarket) {
      const mp = morphoCheck!.marketParams;
      const expectedMarketId = keccak256(
        encodeAbiParameters(
          parseAbiParameters('address, address, address, address, uint256'),
          [
            mp.loanToken as `0x${string}`,
            mp.collateralToken as `0x${string}`,
            mp.oracle as `0x${string}`,
            mp.irm as `0x${string}`,
            BigInt(mp.lltv),
          ],
        ),
      );
      const storedMarketId = morphoCheck!.contracts.MARKET_ID.toLowerCase();
      if (expectedMarketId.toLowerCase() !== storedMarketId) {
        console.log(`Stored MARKET_ID ${storedMarketId} does not match recomputed ID ${expectedMarketId} — marketParams drifted from on-chain market`);
        needFreshMarket = true;
      } else {
        // Params are consistent — but confirm the market actually exists on-chain
        const marketIdHex = storedMarketId.replace('0x', '');
        const marketResult = await l3RpcCall('eth_call', [
          { to: morphoAddr, data: '0x5c60e39a' + marketIdHex },
          'latest',
        ]) as string;
        const hex = (marketResult || '').slice(2);
        const lastUpdate = hex.length >= 320 ? BigInt('0x' + (hex.slice(256, 320) || '0')) : 0n;
        if (lastUpdate === 0n) {
          console.log(`Morpho market ${storedMarketId} not created on-chain (lastUpdate=0) — creating fresh market`);
          needFreshMarket = true;
        } else {
          console.log(`Existing Morpho market verified (lastUpdate=${lastUpdate})`);
        }
      }
    }

    if (needFreshMarket) {
      // Create a fresh Morpho market using MOCK_USDT as collateral and current L3_WUSDC as loan token.
      // The existing MORPHO contract, IRM, and LLTV are reused — only the market params change.
      const mockUsdt = CONTRACTS.MOCK_USDT;
      expect(mockUsdt).toBeTruthy();
      const mockUsdtValid = await isValidErc20(mockUsdt);
      expect(mockUsdtValid).toBe(true);
      console.log(`Using MOCK_USDT (${mockUsdt}) as collateral, L3_WUSDC (${currentUsdc}) as loan token`);

      const irm = morphoCheck!.marketParams.irm || morphoCheck!.contracts.ADAPTIVE_IRM;
      const lltv = morphoCheck!.marketParams.lltv || '770000000000000000';
      const oracle = morphoCheck!.marketParams.oracle || morphoCheck!.contracts.ITP_NAV_ORACLE;

      console.log('Creating fresh Morpho market...');
      const newMarketId = await createMorphoMarketDirect(
        morphoAddr, currentUsdc, mockUsdt, oracle, irm, BigInt(lltv),
      );
      console.log(`Fresh market created — ID: ${newMarketId}`);

      // Supply USDC liquidity so borrowing works
      const liquidityAmount = 100_000n * 10n ** 18n;
      const newMarketParams = {
        loanToken: currentUsdc,
        collateralToken: mockUsdt,
        oracle,
        irm,
        lltv: lltv.toString(),
      };
      console.log('Seeding market with USDC liquidity...');
      await supplyToMorphoDirect(morphoAddr, currentUsdc, liquidityAmount, newMarketParams);
      console.log(`Supplied ${liquidityAmount} USDC to market`);

      // Override in-memory Morpho config so all helpers use the new market
      overrideMorphoConfig({
        contracts: { ...morphoCheck!.contracts, MARKET_ID: newMarketId },
        marketParams: newMarketParams,
      });
      console.log('Morpho config overridden with fresh market params');
    }

    // Re-read config (may have been overridden above)
    const morpho = readMorphoDeployment()!;
    const collateralToken = morpho.marketParams.collateralToken;
    const loanToken = morpho.marketParams.loanToken;

    // Step 0: Get collateral tokens
    // If using a MockERC20 (fresh market), mint directly. If using a vault, deposit USDC first.
    const isVault = await (async () => {
      try {
        // Check if collateral token has asset() — ERC4626 vault indicator
        const r = await l3RpcCall('eth_call', [{ to: collateralToken, data: '0x38d52e0f' }, 'latest']);
        return typeof r === 'string' && r.length >= 66;
      } catch { return false; }
    })();

    if (isVault) {
      // Vault path: deposit loan token into vault to get collateral tokens
      console.log('Collateral is an ERC4626 vault — depositing USDC to get vault tokens');
      const vaultUsdcAmount = 20n * 10n ** 18n;
      await mintL3Usdc(TEST_ADDRESS, vaultUsdcAmount);
      const pad = (a: string) => a.replace('0x', '').toLowerCase().padStart(64, '0');
      const approveData = '0x095ea7b3' + pad(collateralToken) + 'f'.repeat(64);
      await l3SignedSend(loanToken, approveData);
      const depositVaultData = '0x6e553f65' +
        vaultUsdcAmount.toString(16).padStart(64, '0') +
        TEST_ADDRESS.replace('0x', '').toLowerCase().padStart(64, '0');
      await l3SignedSend(collateralToken, depositVaultData);
      const vaultBalData = '0x70a08231' + TEST_ADDRESS.replace('0x', '').toLowerCase().padStart(64, '0');
      const vaultBal = BigInt(await l3RpcCall('eth_call', [{ to: collateralToken, data: vaultBalData }, 'latest']) as string || '0x0');
      expect(vaultBal).toBeGreaterThan(0n);
      console.log(`Got ${vaultBal} vault tokens`);
    } else {
      // MockERC20 path: mint collateral directly
      console.log('Collateral is a MockERC20 — minting directly');
      await mintMorphoCollateral(TEST_ADDRESS, 50n * 10n ** 18n);
      console.log('Minted 50 collateral tokens');
    }

    // Step 1: Deposit collateral into Morpho
    const posBefore = await getMorphoPositionDirect(TEST_ADDRESS);
    console.log(`Position before deposit: collateral=${posBefore.collateral}`);

    const depositAmount = 10n * 10n ** 18n;
    const depositTx = await depositCollateralDirect(TEST_ADDRESS, depositAmount);
    console.log(`Deposit TX sent: ${depositTx}`);

    const posAfterDeposit = await pollUntil(
      () => getMorphoPositionDirect(TEST_ADDRESS),
      (p) => p.collateral > posBefore.collateral,
      60_000,
      2_000,
    );
    console.log(`Position after deposit: collateral=${posAfterDeposit.collateral}`);
    expect(posAfterDeposit.collateral - posBefore.collateral).toBe(depositAmount);
    console.log('Step 1: Deposit (backend API)');

    // Step 2: Borrow USDC (direct RPC)
    const borrowAmount = 1n * 10n ** 18n; // 1 USDC (18 decimals on L3)
    const borrowTx = await borrowDirect(TEST_ADDRESS, borrowAmount);
    console.log(`Borrow TX sent: ${borrowTx}`);

    const posAfterBorrow = await pollUntil(
      () => getMorphoPositionDirect(TEST_ADDRESS),
      (p) => p.borrowShares > posAfterDeposit.borrowShares,
      60_000,
      2_000,
    );
    console.log(`Position after borrow: borrowShares=${posAfterBorrow.borrowShares}`);
    expect(posAfterBorrow.borrowShares).toBeGreaterThan(posAfterDeposit.borrowShares);
    console.log('Step 2: Borrow (backend API)');

    // Step 3: Repay (direct RPC) — repay the borrowed amount
    // Mint extra USDC to cover accrued interest
    await mintL3Usdc(TEST_ADDRESS, 10n * 10n ** 18n);
    const repayTx = await repayDirect(TEST_ADDRESS, borrowAmount);
    console.log(`Repay TX sent: ${repayTx}`);

    const posAfterRepay = await pollUntil(
      () => getMorphoPositionDirect(TEST_ADDRESS),
      (p) => p.borrowShares < posAfterBorrow.borrowShares,
      60_000,
      2_000,
    );
    console.log(`Position after repay: borrowShares=${posAfterRepay.borrowShares}`);
    expect(posAfterRepay.borrowShares).toBeLessThan(posAfterBorrow.borrowShares);
    console.log('Step 3: Repay (backend API)');

    // Step 4: Withdraw (direct RPC)
    const withdrawAmount = 5n * 10n ** 18n;
    const withdrawTx = await withdrawCollateralDirect(TEST_ADDRESS, withdrawAmount);
    console.log(`Withdraw TX sent: ${withdrawTx}`);

    const posAfterWithdraw = await pollUntil(
      () => getMorphoPositionDirect(TEST_ADDRESS),
      (p) => p.collateral < posAfterRepay.collateral,
      60_000,
      2_000,
    );
    console.log(`Position after withdraw: collateral=${posAfterWithdraw.collateral}`);
    expect(posAfterRepay.collateral - posAfterWithdraw.collateral).toBe(withdrawAmount);
    console.log('Step 4: Withdraw (backend API)');
  });
});
