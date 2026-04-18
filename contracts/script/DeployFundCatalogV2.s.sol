// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IVisionVaultFactory} from "../src/interfaces/IVisionVault.sol";
/// @title DeployFundCatalogV2 — Deploy 141 missing Vision fund vaults
/// @notice Recovers 40 sources from the Apr 2 trim plus 7 brand-new sources.
///         Uses the live factory at 0xe54d...58D0 deployed Apr 15.
contract DeployFundCatalogV2 is Script {
    address constant FACTORY = 0xe54DB21b61FD50d5F1191C3BCb70AD184F4D58D0;
    uint256 constant NUM_FUNDS = 141;

    struct Fund {
        string name;
        string symbol;
        uint256 fee; // basis points
    }

    function _buildCatalog() internal pure returns (Fund[] memory funds) {
        funds = new Fund[](NUM_FUNDS);

        funds[0] = Fund("Herd", "HERD", 500);
        funds[1] = Fund("Washout", "WASH", 500);
        funds[2] = Fund("Bullrun", "BULL", 500);
        funds[3] = Fund("Ticker", "TIKR", 500);
        funds[4] = Fund("Reversion", "RVRS", 500);
        funds[5] = Fund("Alpha", "ALFA", 500);
        funds[6] = Fund("Squeeze", "SQZE", 500);
        funds[7] = Fund("Cover", "COVR", 500);
        funds[8] = Fund("Pressure", "PRSS", 500);
        funds[9] = Fund("Barrel", "BRRL", 500);
        funds[10] = Fund("Rebalance", "RBAL", 500);
        funds[11] = Fund("Contango", "CTGO", 500);
        funds[12] = Fund("Espresso", "ESPR", 500);
        funds[13] = Fund("Raincheck", "RAIN", 500);
        funds[14] = Fund("Roast", "ROST", 500);
        funds[15] = Fund("Taipei", "TPEI", 500);
        funds[16] = Fund("Strait", "STRT", 500);
        funds[17] = Fund("Pacific", "PCFC", 500);
        funds[18] = Fund("Sovereign", "SVRN", 500);
        funds[19] = Fund("Bailout", "BAIL", 500);
        funds[20] = Fund("Reserve", "RESV", 500);
        funds[21] = Fund("Crude", "CRUD", 500);
        funds[22] = Fund("Glut", "GLUT", 500);
        funds[23] = Fund("Benzene", "BNZN", 500);
        funds[24] = Fund("Speculator", "SPEC", 500);
        funds[25] = Fund("Hedger", "HDGR", 500);
        funds[26] = Fund("Commitment", "CMIT", 500);
        funds[27] = Fund("Docket", "DKCT", 500);
        funds[28] = Fund("Verdict", "VRDT", 500);
        funds[29] = Fund("Subpoena", "SBPN", 500);
        funds[30] = Fund("Trending", "TRND", 500);
        funds[31] = Fund("Burnout", "BRNT", 500);
        funds[32] = Fund("Stargazer", "STAR", 500);
        funds[33] = Fund("Adoption", "ADPT", 500);
        funds[34] = Fund("Deprecation", "DPRC", 500);
        funds[35] = Fund("Install", "INST", 500);
        funds[36] = Fund("Import", "IMPT", 500);
        funds[37] = Fund("Unmaintained", "UNMT", 500);
        funds[38] = Fund("Pip", "PPIP", 500);
        funds[39] = Fund("Oxidize", "OXDZ", 500);
        funds[40] = Fund("Borrow", "BORW", 500);
        funds[41] = Fund("Cargo", "CRGO", 500);
        funds[42] = Fund("Overflow", "OFLW", 500);
        funds[43] = Fund("Answered", "ANSD", 500);
        funds[44] = Fund("Unanswered", "UNSR", 500);
        funds[45] = Fund("Resilience", "RSLN", 500);
        funds[46] = Fund("Blackout", "BLKO", 500);
        funds[47] = Fund("Uptime", "UPTM", 500);
        funds[48] = Fund("Publish", "PUBL", 500);
        funds[49] = Fund("Sabbatical", "SABT", 500);
        funds[50] = Fund("Tenure", "TNRE", 500);
        funds[51] = Fund("Premiere", "PREM", 500);
        funds[52] = Fund("Sequel", "SQEL", 500);
        funds[53] = Fund("Binge", "BNGE", 500);
        funds[54] = Fund("Anthem", "ANTM", 500);
        funds[55] = Fund("B-Side", "BSDE", 500);
        funds[56] = Fund("Encore", "ENCR", 500);
        funds[57] = Fund("Hivemind", "HIVE", 500);
        funds[58] = Fund("Downvote", "DNVT", 500);
        funds[59] = Fund("Upvote", "UPVT", 500);
        funds[60] = Fund("Hotness", "HOTS", 500);
        funds[61] = Fund("Shelf Life", "SHLF", 500);
        funds[62] = Fund("Tabletop", "TABL", 500);
        funds[63] = Fund("Arena", "ARNA", 500);
        funds[64] = Fund("Clutch", "CLCH", 500);
        funds[65] = Fund("Tilt", "TILT", 500);
        funds[66] = Fund("Magma", "MGMA", 500);
        funds[67] = Fund("Caldera", "CLDR", 500);
        funds[68] = Fund("Plume", "PLUM", 500);
        funds[69] = Fund("Reactor", "RCTO", 500);
        funds[70] = Fund("Cooldown", "COOL", 500);
        funds[71] = Fund("Fission", "FISN", 500);
        funds[72] = Fund("Contagion", "CTGN", 500);
        funds[73] = Fund("Remission", "RMSN", 500);
        funds[74] = Fund("Vaccine", "VCNE", 500);
        funds[75] = Fund("Brownout", "BRWN", 500);
        funds[76] = Fund("Restore", "RSTR", 500);
        funds[77] = Fund("Surge Protect", "SPRT", 500);
        funds[78] = Fund("Holding", "HOLD", 500);
        funds[79] = Fund("Tailwind", "TAIL", 500);
        funds[80] = Fund("Liftoff", "LIFT", 500);
        funds[81] = Fund("Rush Hour", "RSHH", 500);
        funds[82] = Fund("Clearway", "CLWY", 500);
        funds[83] = Fund("Bottleneck", "BTNK", 500);
        funds[84] = Fund("Charger", "CHRG", 500);
        funds[85] = Fund("Topoff", "TPOF", 500);
        funds[86] = Fund("Range", "RNGE", 500);
        funds[87] = Fund("Crossing", "XING", 500);
        funds[88] = Fund("Customs", "CSTM", 500);
        funds[89] = Fund("Checkpoint", "CHKP", 500);
        funds[90] = Fund("Grounded", "GRND", 500);
        funds[91] = Fund("Cleared", "CLRD", 500);
        funds[92] = Fund("Turbulence", "TRBL", 500);
        funds[93] = Fund("Verspatung", "VSPT", 500);
        funds[94] = Fund("Punktlich", "PNKT", 500);
        funds[95] = Fund("Gleis", "GLIS", 500);
        funds[96] = Fund("Bastille", "BSTL", 500);
        funds[97] = Fund("Detour", "DTUR", 500);
        funds[98] = Fund("Greve", "GREV", 500);
        funds[99] = Fund("Budget", "BDGT", 500);
        funds[100] = Fund("Standby", "STBY", 500);
        funds[101] = Fund("Overhead", "OVHD", 500);
        funds[102] = Fund("Mind Gap", "MGAP", 500);
        funds[103] = Fund("Oyster", "OYTR", 500);
        funds[104] = Fund("Piccadilly", "PICD", 500);
        funds[105] = Fund("Convoy", "CNVY", 500);
        funds[106] = Fund("Anchorage", "ANCH", 500);
        funds[107] = Fund("Passage", "PASS", 500);
        funds[108] = Fund("Berth", "BRTH", 500);
        funds[109] = Fund("Slack Tide", "SLTD", 500);
        funds[110] = Fund("Manifest", "MNFT", 500);
        funds[111] = Fund("Migration", "MIGR", 500);
        funds[112] = Fund("Dormancy", "DORM", 500);
        funds[113] = Fund("Rookery", "ROOK", 500);
        funds[114] = Fund("Flyway", "FLWY", 500);
        funds[115] = Fund("Roost", "RSTP", 500);
        funds[116] = Fund("Telemetry", "TLMT", 500);
        funds[117] = Fund("Intake", "INTK", 500);
        funds[118] = Fund("Adopted", "ADOP", 500);
        funds[119] = Fund("Foster", "FSTR", 500);
        funds[120] = Fund("Sterling", "STLG", 500);
        funds[121] = Fund("Threadneedle", "THRD", 500);
        funds[122] = Fund("Gilt", "GILT", 500);
        funds[123] = Fund("Opening", "OPNG", 500);
        funds[124] = Fund("Endgame", "ENDG", 500);
        funds[125] = Fund("Blitz", "BLTZ", 500);
        funds[126] = Fund("Brokenness", "BRKN", 500);
        funds[127] = Fund("Serve", "SRVE", 500);
        funds[128] = Fund("Sundae", "SNDE", 500);
        funds[129] = Fund("Composite", "CMPS", 500);
        funds[130] = Fund("Listing", "LSTG", 500);
        funds[131] = Fund("Delist", "DLST", 500);
        funds[132] = Fund("Grievance", "GRVN", 500);
        funds[133] = Fund("Borough", "BORO", 500);
        funds[134] = Fund("Dispatch", "DSPT", 500);
        funds[135] = Fund("Isobar", "ISBR", 500);
        funds[136] = Fund("Gradient", "GRAD", 500);
        funds[137] = Fund("Squall", "SQLL", 500);
        funds[138] = Fund("Scroll", "SCRL", 500);
        funds[139] = Fund("Rotation", "ROTN", 500);
        funds[140] = Fund("Archive", "ARCV", 500);
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        IVisionVaultFactory factory = IVisionVaultFactory(FACTORY);
        Fund[] memory funds = _buildCatalog();

        console.log("===========================================");
        console.log("VISION FUND CATALOG V2 DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Factory:", FACTORY);
        console.log("Existing vaults:", factory.getVaultCount());
        console.log("Deploying:", NUM_FUNDS, "new funds");
        console.log("");

        address[] memory vaults = new address[](NUM_FUNDS);

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

        vm.stopBroadcast();

        console.log("Total vaults after deploy:", factory.getVaultCount());
        console.log("");

        _exportJson(deployer, funds, vaults);

        console.log("===========================================");
        console.log("FUND CATALOG V2 DEPLOYMENT COMPLETE");
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
                '    "', funds[i].symbol, '": {\n',
                '      "name": "', funds[i].name, '",\n',
                '      "address": "', vm.toString(vaults[i]), '",\n',
                '      "fee": ', vm.toString(funds[i].fee), '\n',
                '    }'
            );
            if (i < funds.length - 1) json = string.concat(json, ',');
            json = string.concat(json, '\n');
        }

        json = string.concat(json, '  }\n}\n');

        string memory outPath = string.concat(vm.projectRoot(), "/../deployments/fund-catalog-v2.json");
        vm.writeFile(outPath, json);
        console.log("  Saved to deployments/fund-catalog-v2.json");
    }
}
