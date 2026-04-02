// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IVisionVaultFactory} from "../src/interfaces/IVisionVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title DeployFundCatalog — Deploy 43 Vision fund vaults via VisionVaultFactory
/// @notice Calls factory.createVault() for each fund in the catalog, then approves
///         USDC spending on every vault so the manager can seed capital later.
contract DeployFundCatalog is Script {
    address constant FACTORY = 0xbc418956A20DB5C343b56b6AE947AF4896b23A1e;
    uint256 constant NUM_FUNDS = 43;

    struct Fund {
        string name;
        string symbol;
        uint256 fee; // basis points
    }

    function _buildCatalog() internal pure returns (Fund[] memory funds) {
        funds = new Fund[](NUM_FUNDS);

        // CRYPTO
        funds[0]  = Fund("Herd",        "HERD", 500);
        funds[1]  = Fund("Washout",     "WASH", 500);
        funds[2]  = Fund("Degenerator", "DGEN", 500);
        funds[3]  = Fund("Lockflow",    "LOCK", 500);
        funds[4]  = Fund("Oracle",      "ORCL", 500);

        // WEATHER & GEOPHYSICAL
        funds[5]  = Fund("Revert",      "RVRT", 500);
        funds[6]  = Fund("Aftershock",  "AFTR", 500);
        funds[7]  = Fund("Ember",       "EMBR", 500);
        funds[8]  = Fund("Clearsky",    "CLR",  500);
        funds[9]  = Fund("Swell",       "SWEL", 500);
        funds[10] = Fund("Aurora",      "AURA", 500);

        // TRANSPORT
        funds[11] = Fund("Cascade",     "CSCD", 500);
        funds[12] = Fund("Tailwind",    "TAIL", 500);
        funds[13] = Fund("Gridlock",    "GRID", 500);
        funds[14] = Fund("Crossing",    "XING", 500);
        funds[15] = Fund("Spoke",       "SPOK", 500);

        // ENTERTAINMENT & SOCIAL
        funds[16] = Fund("Prime Time",  "PRME", 500);
        funds[17] = Fund("Weekend",     "WKND", 500);
        funds[18] = Fund("Hivemind",    "HIVE", 500);
        funds[19] = Fund("Decay",       "DCAY", 500);
        funds[20] = Fund("Season",      "SZON", 500);
        funds[21] = Fund("Noise",       "NOIS", 500);
        funds[22] = Fund("Homecourt",   "HOME", 500);

        // MACRO & ECONOMIC
        funds[23] = Fund("Hawkish",     "HAWK", 500);
        funds[24] = Fund("Payroll",     "PYRL", 500);
        funds[25] = Fund("Barrel",      "BRRL", 500);
        funds[26] = Fund("Glacier",     "GLCR", 500);
        funds[27] = Fund("Spread",      "SPRD", 500);

        // TECH & DEVELOPER
        funds[28] = Fund("Adoption",    "ADPT", 500);
        funds[29] = Fund("Trending",    "TRND", 500);
        funds[30] = Fund("Resilience",  "RSLN", 500);
        funds[31] = Fund("Overflow",    "OFLW", 500);

        // REGULATORY & GOVERNMENT
        funds[32] = Fund("Deadline",    "DDLN", 500);
        funds[33] = Fund("Session",     "SESN", 500);
        funds[34] = Fund("Complaint",   "CMPL", 500);

        // NATURE & ACADEMIC
        funds[35] = Fund("Migration",   "MIGR", 500);
        funds[36] = Fund("Preprint",    "PRPT", 500);

        // WATER & OCEAN
        funds[37] = Fund("Torrent",     "TRNT", 500);
        funds[38] = Fund("Tideline",    "TIDE", 500);

        // NICHE & EXOTIC
        funds[39] = Fund("Fastpass",    "FAST", 500);
        funds[40] = Fund("Soft Serve",  "SOFT", 500);
        funds[41] = Fund("After Dark",  "DARK", 500);
        funds[42] = Fund("Unusual",     "UNSL", 500);
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IVisionVaultFactory factory = IVisionVaultFactory(FACTORY);
        Fund[] memory funds = _buildCatalog();

        console.log("===========================================");
        console.log("VISION FUND CATALOG DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);
        console.log("Existing vaults:", factory.getVaultCount());
        console.log("Deploying:", NUM_FUNDS, "funds");
        console.log("");

        address[] memory vaults = new address[](NUM_FUNDS);
        address usdc = factory.usdc();

        vm.startBroadcast(deployerPrivateKey);

        for (uint256 i = 0; i < NUM_FUNDS; i++) {
            address vault = factory.createVault(
                funds[i].name,
                funds[i].symbol,
                funds[i].fee,
                deployer
            );
            vaults[i] = vault;
            console.log(
                string.concat("  [", vm.toString(i + 1), "] ", funds[i].name, " (", funds[i].symbol, ")"),
                vault
            );
        }

        console.log("");
        console.log("Approving USDC for all vaults...");

        for (uint256 i = 0; i < NUM_FUNDS; i++) {
            IERC20(usdc).approve(vaults[i], type(uint256).max);
        }

        vm.stopBroadcast();

        console.log("Total vaults after deploy:", factory.getVaultCount());
        console.log("");

        _exportJson(deployer, funds, vaults);

        console.log("===========================================");
        console.log("FUND CATALOG DEPLOYMENT COMPLETE");
        console.log("===========================================");
    }

    function _exportJson(
        address deployer,
        Fund[] memory funds,
        address[] memory vaults
    ) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(deployer), '",\n',
            '  "factory": "', vm.toString(FACTORY), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "vaults": {\n'
        );

        for (uint256 i = 0; i < funds.length; i++) {
            json = string.concat(
                json,
                '    "', funds[i].name, '": {\n',
                '      "address": "', vm.toString(vaults[i]), '",\n',
                '      "symbol": "', funds[i].symbol, '",\n',
                '      "fee": ', vm.toString(funds[i].fee), '\n',
                '    }'
            );
            if (i < funds.length - 1) json = string.concat(json, ',');
            json = string.concat(json, '\n');
        }

        json = string.concat(json, '  }\n}\n');

        string memory outPath = string.concat(vm.projectRoot(), "/../deployments/fund-catalog.json");
        vm.writeFile(outPath, json);
        console.log("  Saved to deployments/fund-catalog.json");
    }
}
