// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../test/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RedeployMorphoFull - Full Morpho redeploy with fresh collateral + oracle + market + vault
/// @notice Deploys new collateral token, oracle, market, and vault. Reuses existing Morpho core + IRM.
contract RedeployMorphoFull is Script {
    using MarketParamsLib for MarketParams;

    uint256 constant LLTV = 0.77e18;
    // Both L3_WUSDC (loan) and collateral are 18 decimals
    // Precision = 36 + 18 - 18 = 36
    uint256 constant INITIAL_ORACLE_PRICE = 1e36;
    uint256 constant SUPPLY_CAP = type(uint184).max;
    uint256 constant INITIAL_VAULT_LIQUIDITY = 100_000 * 1e18; // 100k USDC (18 decimals)

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);

        // Existing addresses (Morpho core + IRM survive chain state)
        address morphoAddr = vm.envAddress("MORPHO");
        address irmAddr = vm.envAddress("ADAPTIVE_IRM");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address mirrorRegistry = vm.envAddress("MIRROR_REGISTRY");

        console.log("=== RedeployMorphoFull ===");
        console.log("Deployer:", deployer);

        IMorpho morpho = IMorpho(morphoAddr);

        vm.startBroadcast(deployerKey);

        // 1. Deploy fresh collateral token (ITP Vault shares mock)
        MockERC20 collateral = new MockERC20("E2E Test ITP", "E2ET", 18);
        console.log("New collateral token:", address(collateral));

        // 2. Deploy fresh ITPNAVOracle
        ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, address(collateral), INITIAL_ORACLE_PRICE);
        console.log("New ITPNAVOracle:", address(oracle));

        // 3. Create new Morpho market
        MarketParams memory marketParams = MarketParams({
            loanToken: settlementUSDC,
            collateralToken: address(collateral),
            oracle: address(oracle),
            irm: irmAddr,
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        Id marketId = marketParams.id();
        console.log("New market ID:");
        console.logBytes32(Id.unwrap(marketId));

        // 4. Deploy new MetaMorpho vault (timelock=0 for testnet)
        MetaMorpho vault = new MetaMorpho(
            deployer,
            morphoAddr,
            0,
            settlementUSDC,
            "Index ITP Lending Vault",
            "ilUSDC"
        );
        address vaultAddr = address(vault);
        console.log("New vault:", vaultAddr);

        // 5. Configure vault
        vault.submitCap(marketParams, SUPPLY_CAP);
        vault.acceptCap(marketParams);
        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);
        console.log("Vault configured: cap accepted, queue set");

        // 6. Seed vault with USDC liquidity
        MockERC20(settlementUSDC).mint(deployer, INITIAL_VAULT_LIQUIDITY);
        IERC20(settlementUSDC).approve(vaultAddr, INITIAL_VAULT_LIQUIDITY);
        vault.deposit(INITIAL_VAULT_LIQUIDITY, deployer);
        console.log("Vault seeded with 100k USDC");

        vm.stopBroadcast();

        // 7. Write deployment JSON
        string memory p1 = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid),
            ',\n  "deployer": "', vm.toString(deployer),
            '",\n  "timestamp": ', vm.toString(block.timestamp),
            ',\n  "contracts": {\n'
        );
        string memory p2 = string.concat(
            '    "MORPHO": "', vm.toString(morphoAddr),
            '",\n    "ADAPTIVE_IRM": "', vm.toString(irmAddr),
            '",\n    "MIRROR_REGISTRY": "', vm.toString(mirrorRegistry),
            '",\n    "ITP_NAV_ORACLE": "', vm.toString(address(oracle)),
            '",\n    "METAMORPHO_VAULT": "', vm.toString(vaultAddr),
            '",\n    "MARKET_ID": "', vm.toString(Id.unwrap(marketId)),
            '"\n  },\n'
        );
        string memory p3 = string.concat(
            '  "marketParams": {\n',
            '    "loanToken": "', vm.toString(settlementUSDC),
            '",\n    "collateralToken": "', vm.toString(address(collateral)),
            '",\n    "oracle": "', vm.toString(address(oracle)),
            '",\n    "irm": "', vm.toString(irmAddr),
            '",\n    "lltv": "', vm.toString(LLTV),
            '"\n  }\n}\n'
        );
        vm.writeFile(string.concat(vm.projectRoot(), "/../deployments/morpho-e2e.json"), string.concat(p1, p2, p3));
        console.log("Written to deployments/morpho-e2e.json");
    }
}
