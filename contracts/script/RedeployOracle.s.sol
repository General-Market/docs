// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IMorpho, MarketParams, Id} from "@morpho-blue/interfaces/IMorpho.sol";
import {MetaMorpho} from "@metamorpho/MetaMorpho.sol";
import {MarketParamsLib} from "@morpho-blue/libraries/MarketParamsLib.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title RedeployOracle - Redeploy ITPNAVOracle and reconfigure existing vault
/// @notice Fixes stale oracle by deploying fresh oracle + market, reuses existing vault (timelock=0)
contract RedeployOracle is Script {
    using MarketParamsLib for MarketParams;

    uint256 constant LLTV = 0.77e18;
    uint256 constant INITIAL_ORACLE_PRICE = 100e24; // 100 USDC per ITP (24 decimal precision)
    uint256 constant SUPPLY_CAP = type(uint184).max;
    uint256 constant INITIAL_VAULT_LIQUIDITY = 100_000 * 1e6; // 100k USDC

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);

        // Existing addresses
        address morphoAddr = vm.envAddress("MORPHO");
        address irmAddr = vm.envAddress("ADAPTIVE_IRM");
        address settlementUSDC = vm.envAddress("SETTLEMENT_USDC");
        address itpVault = vm.envAddress("ITP_VAULT");
        address mirrorRegistry = vm.envAddress("MIRROR_REGISTRY");
        address vaultAddr = vm.envAddress("METAMORPHO_VAULT");

        console.log("=== RedeployOracle ===");
        console.log("Deployer:", deployer);
        console.log("Reusing vault:", vaultAddr);

        IMorpho morpho = IMorpho(morphoAddr);
        MetaMorpho vault = MetaMorpho(vaultAddr);

        vm.startBroadcast(deployerKey);

        // 1. Deploy fresh ITPNAVOracle
        ITPNAVOracle oracle = new ITPNAVOracle(mirrorRegistry, itpVault, INITIAL_ORACLE_PRICE);
        console.log("New ITPNAVOracle:", address(oracle));
        console.log("  price():", oracle.price());

        // 2. Create new Morpho market with new oracle
        MarketParams memory marketParams = MarketParams({
            loanToken: settlementUSDC,
            collateralToken: itpVault,
            oracle: address(oracle),
            irm: irmAddr,
            lltv: LLTV
        });
        morpho.createMarket(marketParams);
        Id marketId = marketParams.id();
        console.log("New market ID:");
        console.logBytes32(Id.unwrap(marketId));

        // 3. Configure existing vault for new market (timelock=0, so instant)
        vault.submitCap(marketParams, SUPPLY_CAP);
        vault.acceptCap(marketParams);
        console.log("Supply cap accepted on existing vault");

        // 4. Set supply queue to new market only
        Id[] memory supplyQueue = new Id[](1);
        supplyQueue[0] = marketId;
        vault.setSupplyQueue(supplyQueue);
        console.log("Supply queue updated");

        // 5. Seed vault with USDC liquidity
        MockERC20(settlementUSDC).mint(deployer, INITIAL_VAULT_LIQUIDITY);
        IERC20(settlementUSDC).approve(vaultAddr, INITIAL_VAULT_LIQUIDITY);
        vault.deposit(INITIAL_VAULT_LIQUIDITY, deployer);
        console.log("Vault seeded with 100k USDC");

        vm.stopBroadcast();

        // 6. Write updated deployment JSON
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
            '",\n    "collateralToken": "', vm.toString(itpVault),
            '",\n    "oracle": "', vm.toString(address(oracle)),
            '",\n    "irm": "', vm.toString(irmAddr),
            '",\n    "lltv": "', vm.toString(LLTV),
            '"\n  }\n}\n'
        );
        vm.writeFile(string.concat(vm.projectRoot(), "/../deployments/morpho-e2e.json"), string.concat(p1, p2, p3));
        console.log("Written to deployments/morpho-e2e.json");
    }
}
