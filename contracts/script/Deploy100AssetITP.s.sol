// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/mocks/MockERC20.sol";
import "../src/core/Index.sol";
import "../src/core/ITP.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Deploy100AssetITP - Deploy 100 mock tokens, create ITP, fund vault + AP
/// @notice For vital-e2e-100asset.sh: 100-asset ITP with buy/rebalance/sell flow
/// @dev Each token gets equal weight: 1e16 (1%), total = 100 * 1e16 = 1e18 (100%)
contract Deploy100AssetITP is Script {
    uint256 public constant NUM_ASSETS = 100;
    uint256 public constant WEIGHT_PER_ASSET = 1e16; // 1% each
    uint256 public constant FUND_AMOUNT = 1_000_000 * 1e18; // 1M tokens each

    address[] public tokens;
    bytes32 public itpId;
    address public itpVaultAddr;

    // Token symbols for 100 assets (from assets.json first 100 entries)
    function _getSymbol(uint256 i) internal pure returns (string memory) {
        // First 38 are USDC pairs (verified on Bitget spot)
        if (i == 0) return "BTC";
        if (i == 1) return "ETH";
        if (i == 2) return "SOL";
        if (i == 3) return "BNB";
        if (i == 4) return "XRP";
        if (i == 5) return "ADA";
        if (i == 6) return "DOGE";
        if (i == 7) return "DOT";
        if (i == 8) return "LINK";
        if (i == 9) return "AVAX";
        if (i == 10) return "SHIB";
        if (i == 11) return "LTC";
        if (i == 12) return "UNI";
        if (i == 13) return "XLM";
        if (i == 14) return "TRX";
        if (i == 15) return "NEAR";
        if (i == 16) return "ICP";
        if (i == 17) return "FIL";
        if (i == 18) return "AAVE";
        if (i == 19) return "ARB";
        if (i == 20) return "OP";
        if (i == 21) return "SUI";
        if (i == 22) return "APT";
        if (i == 23) return "INJ";
        if (i == 24) return "FET";
        if (i == 25) return "RENDER";
        if (i == 26) return "TON";
        if (i == 27) return "AR";
        if (i == 28) return "BCH";
        if (i == 29) return "PEPE";
        if (i == 30) return "WLD";
        if (i == 31) return "ONDO";
        if (i == 32) return "STX";
        if (i == 33) return "TAO";
        if (i == 34) return "TRUMP";
        if (i == 35) return "BGB";
        if (i == 36) return "ALGO";
        if (i == 37) return "DAI";
        // Remaining 62 use USDT pairs
        // ATOM/ETC moved here: no USDC pair on Bitget
        if (i == 38) return "ATOM";
        if (i == 39) return "ETC";
        if (i == 40) return "1INCH";
        if (i == 41) return "AEVO";
        if (i == 42) return "AGLD";
        if (i == 43) return "AI";
        if (i == 44) return "AIXBT";
        if (i == 45) return "ALICE";
        if (i == 46) return "HYPE";      // was ALPHA (delisted)
        if (i == 47) return "ALT";
        if (i == 48) return "ANIME";
        if (i == 49) return "ANKR";
        if (i == 50) return "APE";
        if (i == 51) return "API3";
        if (i == 52) return "ARKM";
        if (i == 53) return "ARPA";
        if (i == 54) return "ATH";
        if (i == 55) return "AUCTION";
        if (i == 56) return "AXL";
        if (i == 57) return "AXS";
        if (i == 58) return "BAL";
        if (i == 59) return "BAND";
        if (i == 60) return "BAT";
        if (i == 61) return "BERA";
        if (i == 62) return "SONIC";     // was BETA (delisted), FTM rebranded to Sonic
        if (i == 63) return "BLUR";
        if (i == 64) return "MORPHO";    // was BNX (delisted)
        if (i == 65) return "BOME";
        if (i == 66) return "BONK";
        if (i == 67) return "BSV";
        if (i == 68) return "CAKE";
        if (i == 69) return "CELO";
        if (i == 70) return "CFX";
        if (i == 71) return "CHZ";
        if (i == 72) return "CKB";
        if (i == 73) return "COMP";
        if (i == 74) return "CRV";
        if (i == 75) return "CYBER";
        if (i == 76) return "RIVER";     // was DASH (delisted)
        if (i == 77) return "DENT";
        if (i == 78) return "DYDX";
        if (i == 79) return "B2";        // was EDU (delisted)
        if (i == 80) return "ENA";
        if (i == 81) return "ENS";
        if (i == 82) return "ALCH";      // was EOS (delisted)
        if (i == 83) return "ETHFI";
        if (i == 84) return "FLOKI";
        if (i == 85) return "FLOW";
        if (i == 86) return "JASMY";     // was FTM→ARTX (ARTX illiquid on Bitget, no live ticker)
        if (i == 87) return "GALA";
        if (i == 88) return "GMT";
        if (i == 89) return "GRT";
        if (i == 90) return "HBAR";
        if (i == 91) return "HOT";
        if (i == 92) return "ILV";
        if (i == 93) return "IMX";
        if (i == 94) return "IO";
        if (i == 95) return "SEI";       // was IOTA→WARD (WARD illiquid on Bitget, no live ticker)
        if (i == 96) return "JTO";
        if (i == 97) return "JUP";
        if (i == 98) return "KAVA";
        return "LA"; // 99, was KDA (delisted)
    }

    function _getBitgetPair(uint256 i) internal pure returns (string memory) {
        string memory sym = _getSymbol(i);
        // First 38 are USDC pairs (ATOM/ETC moved to USDT group), rest are USDT
        if (i < 38) {
            return string.concat(sym, "USDC");
        }
        return string.concat(sym, "USDT");
    }

    function run() external {
        // Use Anvil account 1 (not account 0) to avoid nonce-based address collisions
        // with contracts already deployed by DeployFullSystemE2E (which uses account 0).
        uint256 deployerPrivateKey = vm.envOr(
            "PRIVATE_KEY",
            uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d)
        );
        address indexProxy = vm.envAddress("INDEX_ADDRESS");
        address mockBitgetVault = vm.envAddress("MOCK_BITGET_VAULT");
        address apAddress = vm.envAddress("AP_ADDRESS");

        console.log("=== 100-ASSET ITP DEPLOYMENT ===");
        console.log("Index:", indexProxy);
        console.log("MockBitgetVault:", mockBitgetVault);
        console.log("AP:", apAddress);

        // Phase 1: Deploy 100 mock tokens (account 1)
        vm.startBroadcast(deployerPrivateKey);
        console.log("Phase 1: Deploying 100 mock tokens...");
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            string memory symbol = _getSymbol(i);
            string memory name = string.concat("Mock ", symbol);
            MockERC20 token = new MockERC20(name, symbol, 18);
            tokens.push(address(token));

            if (i % 25 == 0) {
                console.log("  Deployed token", i, ":", address(token));
            }
        }
        console.log("  Total tokens deployed:", tokens.length);
        vm.stopBroadcast();

        // Phase 2: Create ITP + fund vault (account 1)
        vm.startBroadcast(deployerPrivateKey);
        console.log("Phase 2: Creating 100-asset ITP...");
        uint256[] memory weights = new uint256[](NUM_ASSETS);
        address[] memory assets = new address[](NUM_ASSETS);
        uint256[] memory prices = new uint256[](NUM_ASSETS);
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            weights[i] = WEIGHT_PER_ASSET;
            assets[i] = tokens[i];
            prices[i] = 0; // must be loaded from creation-prices.json
        }
        _loadPrices(prices);

        uint256 totalWeight;
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            totalWeight += weights[i];
        }
        require(totalWeight == 1e18, "Weight sum must be 1e18");

        itpId = Index(indexProxy).createITP("ITP-100", "ITP100", weights, assets, prices, type(uint256).max);
        console.log("  ITP-100 created, ID:", vm.toString(itpId));

        // Phase 3: Fund MockBitgetVault with all tokens (AP acquires tokens through settlement only)
        console.log("Phase 3: Funding vault with 100 tokens...");
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            MockERC20(tokens[i]).mint(mockBitgetVault, FUND_AMOUNT);
        }
        console.log("  Funded vault with", NUM_ASSETS, "tokens");

        vm.stopBroadcast();

        // Phase 3b: Deploy ITP Vault (needs admin key for setITPVault)
        uint256 adminKey = vm.envOr("ADMIN_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address l3Wusdc = vm.envAddress("L3_WUSDC");
        vm.startBroadcast(adminKey);
        ITP itpVaultContract = new ITP(itpId, indexProxy, "ITP-100", "ITP100", IERC20(l3Wusdc));
        itpVaultAddr = address(itpVaultContract);
        Index(indexProxy).setITPVault(itpId, itpVaultAddr);
        console.log("  ITP Vault:", itpVaultAddr);
        vm.stopBroadcast();

        // Phase 4: Export deployment + symbol map + deployed-assets.json
        _exportDeployment(indexProxy);
        _exportSymbolMap();
        _exportDeployedAssets();

        console.log("");
        console.log("=== 100-ASSET ITP DEPLOYMENT COMPLETE ===");
        console.log("ITP ID:", vm.toString(itpId));
        console.log("First token:", tokens[0]);
        console.log("Last token:", tokens[NUM_ASSETS - 1]);
    }

    function _exportDeployment(address indexProxy) internal {
        string memory tokenList = "[";
        string memory symbolList = "[";
        string memory pairList = "[";
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            if (i > 0) {
                tokenList = string.concat(tokenList, ",");
                symbolList = string.concat(symbolList, ",");
                pairList = string.concat(pairList, ",");
            }
            tokenList = string.concat(tokenList, '"', vm.toString(tokens[i]), '"');
            symbolList = string.concat(symbolList, '"', _getSymbol(i), '"');
            pairList = string.concat(pairList, '"', _getBitgetPair(i), '"');
        }
        tokenList = string.concat(tokenList, "]");
        symbolList = string.concat(symbolList, "]");
        pairList = string.concat(pairList, "]");

        string memory json = string.concat(
            '{\n  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "indexProxy": "', vm.toString(indexProxy), '",\n',
            '  "itpId": "', vm.toString(itpId), '",\n',
            '  "itpVault": "', vm.toString(itpVaultAddr), '",\n',
            '  "numAssets": ', vm.toString(NUM_ASSETS), ',\n',
            '  "weightPerAsset": "', vm.toString(WEIGHT_PER_ASSET), '",\n',
            '  "tokens": ', tokenList, ',\n',
            '  "symbols": ', symbolList, ',\n',
            '  "bitgetPairs": ', pairList, '\n',
            '}'
        );
        vm.writeFile("../deployments/itp-100-asset.json", json);
        console.log("  Deployment saved to deployments/itp-100-asset.json");
    }

    function _exportDeployedAssets() internal {
        string memory json = "[\n";
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            if (i > 0) json = string.concat(json, ",\n");
            json = string.concat(
                json,
                '  {"address": "', vm.toLowercase(vm.toString(tokens[i])), '", "symbol": "', _getSymbol(i), '"}'
            );
        }
        json = string.concat(json, "\n]");
        vm.writeFile("../frontend/public/deployed-assets.json", json);
        console.log("  Deployed assets saved to frontend/public/deployed-assets.json");
    }

    /// @notice Load real Bitget prices from data/creation-prices.json
    /// @dev Reverts if file is missing or any price is zero — never silently default to $1
    function _loadPrices(uint256[] memory prices) internal {
        string memory json = vm.readFile("../data/creation-prices.json");

        uint256 loaded = 0;
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            string memory pair = _getBitgetPair(i);
            string memory key = string.concat(".", pair);
            string memory priceStr = vm.parseJsonString(json, key);
            uint256 price = _stringToUint(priceStr);
            require(price > 0, string.concat("Missing or zero price for ", pair));
            prices[i] = price;
            loaded++;
            if (i < 3 || i == 99) {
                console.log("  Price", pair, "=", vm.toString(price));
            }
        }
        console.log("  Loaded real prices:", loaded, "of", NUM_ASSETS);
    }

    /// @notice Parse a numeric string (no decimals) to uint256
    function _stringToUint(string memory s) internal pure returns (uint256 result) {
        bytes memory b = bytes(s);
        for (uint256 i = 0; i < b.length; i++) {
            uint8 c = uint8(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
            // Skip non-digit chars (quotes, whitespace)
        }
    }

    function _exportSymbolMap() internal {
        string memory map = "{\n";
        for (uint256 i = 0; i < NUM_ASSETS; i++) {
            if (i > 0) map = string.concat(map, ",\n");
            // Lowercase the address for symbol map compatibility
            map = string.concat(
                map,
                '  "', vm.toLowercase(vm.toString(tokens[i])), '": {"pair": "', _getBitgetPair(i), '", "source": "bitget"}'
            );
        }
        map = string.concat(map, "\n}");
        vm.writeFile("../data/symbol-map.json", map);
        console.log("  Symbol map saved to data/symbol-map.json (100 entries)");
    }
}
