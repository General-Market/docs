// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IVisionVaultFactory} from "../src/interfaces/IVisionVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// ─── Helper ──────────────────────────────────────────────────────────────────

/// @dev Deployed once per run, then called in chunks of ≤20 to batch vault
///      creation into far fewer transactions than one-per-vault.
contract VaultBatchHelper {
    struct VaultSpec {
        string name;
        string symbol;
        uint256 fee;
    }

    function batchCreate(
        address factory,
        VaultSpec[] calldata specs,
        address manager
    ) external returns (address[] memory vaults) {
        vaults = new address[](specs.length);
        for (uint256 i = 0; i < specs.length; i++) {
            vaults[i] = IVisionVaultFactory(factory).createVault(
                specs[i].name,
                specs[i].symbol,
                specs[i].fee,
                manager
            );
        }
    }
}

// ─── Script ──────────────────────────────────────────────────────────────────

/// @title BatchVaultDeploy — deploy ~140 per-source Vision fund vaults in bulk
/// @notice Deploys a VaultBatchHelper, then calls it in chunks of CHUNK_SIZE to
///         stay safely under the block gas limit. Emits a JSON receipt to
///         deployments/batch-vault-deploy.json.
contract BatchVaultDeploy is Script {
    address constant FACTORY    = 0xbc418956A20DB5C343b56b6AE947AF4896b23A1e;
    uint256 constant CHUNK_SIZE = 20;

    struct Fund {
        string name;
        string symbol;
        uint256 fee;
    }

    // ── Catalog ──────────────────────────────────────────────────────────────
    //
    // Per-source funds. fee = performance fee in basis points (2000 = 20%).
    // Populate this list before running — fund-branding.json will supply the
    // final names/symbols; these are placeholders until that file is ready.

    function _buildCatalog() internal pure returns (Fund[] memory funds) {
        // ── Crypto data sources ───────────────────────────────────────────────
        Fund[] memory crypto = new Fund[](10);
        crypto[0]  = Fund("Binance Spot",          "BNSP", 2000);
        crypto[1]  = Fund("Binance Futures",       "BNFT", 2000);
        crypto[2]  = Fund("Coinbase Spot",         "CBSP", 2000);
        crypto[3]  = Fund("OKX Spot",              "OKXS", 2000);
        crypto[4]  = Fund("Bybit Spot",            "BYBS", 2000);
        crypto[5]  = Fund("Kraken Spot",           "KRKN", 2000);
        crypto[6]  = Fund("Bitget Spot",           "BTGS", 2000);
        crypto[7]  = Fund("Gate Spot",             "GATE", 2000);
        crypto[8]  = Fund("HTX Spot",              "HTXS", 2000);
        crypto[9]  = Fund("Kucoin Spot",           "KCSN", 2000);

        // ── Equities ─────────────────────────────────────────────────────────
        Fund[] memory equities = new Fund[](8);
        equities[0] = Fund("NYSE Large Cap",       "NYSL", 1500);
        equities[1] = Fund("NASDAQ Tech",          "NQTK", 1500);
        equities[2] = Fund("S&P 500 Leaders",      "SP5L", 1500);
        equities[3] = Fund("Dow Industrials",      "DOWJ", 1500);
        equities[4] = Fund("Russell 2000",         "R2KF", 1500);
        equities[5] = Fund("European Blue Chip",   "EUBC", 1500);
        equities[6] = Fund("Nikkei Stars",         "NKST", 1500);
        equities[7] = Fund("Hong Kong Listings",   "HKLI", 1500);

        // ── Commodities ──────────────────────────────────────────────────────
        Fund[] memory commodities = new Fund[](6);
        commodities[0] = Fund("Energy Complex",    "ENRG", 2000);
        commodities[1] = Fund("Precious Metals",   "PMTL", 1500);
        commodities[2] = Fund("Industrial Metals", "INMT", 1500);
        commodities[3] = Fund("Agricultural",      "AGRI", 1500);
        commodities[4] = Fund("Soft Commodities",  "SOFT", 1500);
        commodities[5] = Fund("Livestock",         "LVST", 1000);

        // ── Forex ────────────────────────────────────────────────────────────
        Fund[] memory forex = new Fund[](8);
        forex[0] = Fund("Majors",                  "FXMJ", 1500);
        forex[1] = Fund("EUR Crosses",             "EURX", 1500);
        forex[2] = Fund("Asia Pacific FX",         "APFX", 1500);
        forex[3] = Fund("EM Currencies",           "EMFX", 2000);
        forex[4] = Fund("Scandinavian FX",         "SCFX", 1500);
        forex[5] = Fund("Latam FX",                "LTFX", 2000);
        forex[6] = Fund("Middle East FX",          "MEFX", 2000);
        forex[7] = Fund("Crypto-Forex Bridge",     "CFXB", 2000);

        // ── Weather ──────────────────────────────────────────────────────────
        Fund[] memory weather = new Fund[](8);
        weather[0] = Fund("US Temperature",        "USWT", 1500);
        weather[1] = Fund("EU Temperature",        "EUWT", 1500);
        weather[2] = Fund("Precipitation",         "PRCP", 1500);
        weather[3] = Fund("Wind Speed",            "WIND", 1500);
        weather[4] = Fund("Hurricane Season",      "HURR", 2000);
        weather[5] = Fund("Wildfire Index",        "FIRE", 2000);
        weather[6] = Fund("Drought Monitor",       "DRGT", 1500);
        weather[7] = Fund("Snow Depth",            "SNOW", 1000);

        // ── Sports ───────────────────────────────────────────────────────────
        Fund[] memory sports = new Fund[](10);
        sports[0] = Fund("NFL Lines",              "NFLL", 2000);
        sports[1] = Fund("NBA Spreads",            "NBAS", 2000);
        sports[2] = Fund("MLB Totals",             "MLBT", 2000);
        sports[3] = Fund("Premier League",         "EPLL", 2000);
        sports[4] = Fund("Champions League",       "UCLL", 2000);
        sports[5] = Fund("Tennis Majors",          "TNMS", 2000);
        sports[6] = Fund("UFC Odds",               "UFCO", 2500);
        sports[7] = Fund("Golf Outright",          "GOLF", 2000);
        sports[8] = Fund("Formula 1",              "F1RN", 2000);
        sports[9] = Fund("Esports",                "ESPT", 2500);

        // ── Politics & Macro ─────────────────────────────────────────────────
        Fund[] memory politics = new Fund[](8);
        politics[0] = Fund("US Elections",         "USEL", 2000);
        politics[1] = Fund("Fed Policy",           "FEDP", 2000);
        politics[2] = Fund("ECB Policy",           "ECBP", 2000);
        politics[3] = Fund("Geopolitical Risk",    "GPRS", 2500);
        politics[4] = Fund("Trade Policy",         "TRDP", 2000);
        politics[5] = Fund("Regulatory Watch",     "REGW", 1500);
        politics[6] = Fund("Inflation Prints",     "INFP", 2000);
        politics[7] = Fund("Jobs Reports",         "JOBS", 2000);

        // ── Entertainment ────────────────────────────────────────────────────
        Fund[] memory ent = new Fund[](6);
        ent[0] = Fund("Box Office",                "BOXO", 1500);
        ent[1] = Fund("Awards Season",             "AWRD", 1500);
        ent[2] = Fund("Streaming Charts",          "STRM", 1500);
        ent[3] = Fund("Music Charts",              "MUSC", 1500);
        ent[4] = Fund("Social Trends",             "SCTR", 2000);
        ent[5] = Fund("Reality TV",                "RLTV", 1500);

        // ── Science & Tech ───────────────────────────────────────────────────
        Fund[] memory tech = new Fund[](6);
        tech[0] = Fund("AI Benchmarks",            "AIBM", 2000);
        tech[1] = Fund("Biotech Catalysts",        "BIOT", 2500);
        tech[2] = Fund("Space Launches",           "SPCE", 2000);
        tech[3] = Fund("Earthquake Monitor",       "QUAK", 1500);
        tech[4] = Fund("Volcano Activity",         "VLCN", 1500);
        tech[5] = Fund("Epidemic Watch",           "EPID", 2000);

        // ── Transport & Infrastructure ────────────────────────────────────────
        Fund[] memory transport = new Fund[](6);
        transport[0] = Fund("Flight Delays",       "FLTD", 1500);
        transport[1] = Fund("Port Congestion",     "PORT", 1500);
        transport[2] = Fund("Rail Punctuality",    "RAIL", 1000);
        transport[3] = Fund("Shipping Rates",      "SHIP", 2000);
        transport[4] = Fund("EV Adoption",         "EVAD", 1500);
        transport[5] = Fund("Traffic Index",       "TRFX", 1000);

        // ── Count total ──────────────────────────────────────────────────────
        uint256 total = crypto.length + equities.length + commodities.length +
                        forex.length + weather.length + sports.length +
                        politics.length + ent.length + tech.length +
                        transport.length;

        funds = new Fund[](total);
        uint256 idx;

        for (uint256 i = 0; i < crypto.length;      i++) funds[idx++] = crypto[i];
        for (uint256 i = 0; i < equities.length;    i++) funds[idx++] = equities[i];
        for (uint256 i = 0; i < commodities.length; i++) funds[idx++] = commodities[i];
        for (uint256 i = 0; i < forex.length;       i++) funds[idx++] = forex[i];
        for (uint256 i = 0; i < weather.length;     i++) funds[idx++] = weather[i];
        for (uint256 i = 0; i < sports.length;      i++) funds[idx++] = sports[i];
        for (uint256 i = 0; i < politics.length;    i++) funds[idx++] = politics[i];
        for (uint256 i = 0; i < ent.length;         i++) funds[idx++] = ent[i];
        for (uint256 i = 0; i < tech.length;        i++) funds[idx++] = tech[i];
        for (uint256 i = 0; i < transport.length;   i++) funds[idx++] = transport[i];
    }

    // ── Run ──────────────────────────────────────────────────────────────────

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IVisionVaultFactory factory = IVisionVaultFactory(FACTORY);
        Fund[] memory funds = _buildCatalog();
        uint256 total = funds.length;

        console.log("===========================================");
        console.log("BATCH VAULT DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);
        console.log("Vaults before:", factory.getVaultCount());
        console.log("Deploying:", total, "vaults in chunks of", CHUNK_SIZE);
        console.log("");

        address[] memory allVaults = new address[](total);
        address usdc = factory.usdc();

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the helper once — reused for all chunks
        VaultBatchHelper helper = new VaultBatchHelper();
        console.log("VaultBatchHelper:", address(helper));
        console.log("");

        // Chunk loop
        uint256 deployed;
        uint256 chunk = 0;
        while (deployed < total) {
            uint256 end = deployed + CHUNK_SIZE;
            if (end > total) end = total;
            uint256 chunkLen = end - deployed;

            VaultBatchHelper.VaultSpec[] memory specs =
                new VaultBatchHelper.VaultSpec[](chunkLen);

            for (uint256 j = 0; j < chunkLen; j++) {
                specs[j] = VaultBatchHelper.VaultSpec({
                    name:   funds[deployed + j].name,
                    symbol: funds[deployed + j].symbol,
                    fee:    funds[deployed + j].fee
                });
            }

            address[] memory created = helper.batchCreate(FACTORY, specs, deployer);

            for (uint256 j = 0; j < chunkLen; j++) {
                allVaults[deployed + j] = created[j];
                console.log(
                    string.concat(
                        "  [", vm.toString(deployed + j + 1), "] ",
                        funds[deployed + j].name,
                        " (", funds[deployed + j].symbol, ")"
                    ),
                    created[j]
                );
            }

            deployed = end;
            chunk++;
            console.log(string.concat("  -- chunk ", vm.toString(chunk), " done --"));
            console.log("");
        }

        // Approve USDC on all vaults so the manager can seed capital
        console.log("Approving USDC for all vaults...");
        for (uint256 i = 0; i < total; i++) {
            IERC20(usdc).approve(allVaults[i], type(uint256).max);
        }

        vm.stopBroadcast();

        console.log("");
        console.log("Total vaults after deploy:", factory.getVaultCount());
        console.log("");

        _exportJson(deployer, address(helper), funds, allVaults);

        console.log("===========================================");
        console.log("BATCH VAULT DEPLOYMENT COMPLETE");
        console.log("===========================================");
    }

    // ── JSON receipt ─────────────────────────────────────────────────────────

    function _exportJson(
        address deployer,
        address helper,
        Fund[] memory funds,
        address[] memory vaults
    ) internal {
        string memory json = string.concat(
            '{\n',
            '  "chainId": ',    vm.toString(block.chainid), ',\n',
            '  "deployer": "',  vm.toString(deployer), '",\n',
            '  "factory": "',   vm.toString(FACTORY), '",\n',
            '  "helper": "',    vm.toString(helper), '",\n',
            '  "timestamp": ',  vm.toString(block.timestamp), ',\n',
            '  "vaults": {\n'
        );

        for (uint256 i = 0; i < funds.length; i++) {
            json = string.concat(
                json,
                '    "', funds[i].symbol, '": {\n',
                '      "name": "',    funds[i].name, '",\n',
                '      "address": "', vm.toString(vaults[i]), '",\n',
                '      "fee": ',      vm.toString(funds[i].fee), '\n',
                '    }'
            );
            if (i < funds.length - 1) json = string.concat(json, ',');
            json = string.concat(json, '\n');
        }

        json = string.concat(json, '  }\n}\n');

        string memory outPath = string.concat(
            vm.projectRoot(), "/../deployments/batch-vault-deploy.json"
        );
        vm.writeFile(outPath, json);
        console.log("  Saved to deployments/batch-vault-deploy.json");
    }
}
