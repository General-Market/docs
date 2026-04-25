// SPDX-License-Identifier: MIT
// AUTO-GENERATED -- DO NOT EDIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/Investment.sol";
import "../src/core/ITP.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Deploy107ITPs_Vaults - Deploy 96 ITP vaults
contract Deploy107ITPs_Vaults is Script {

    function run() external {
        uint256 ak = vm.envOr("ADMIN_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));
        address idx = vm.envAddress("INDEX_ADDRESS");
        IERC20 wusdc = IERC20(vm.envAddress("L3_WUSDC"));

        // Read ITP count to find our starting ID
        // ITP IDs are assigned sequentially. We need IDs for ITPs 2..97
        // (ITP 1 is the existing 100-asset ITP)
        vm.startBroadcast(ak);
        _vaultBatch0(idx, wusdc);
        _vaultBatch1(idx, wusdc);
        _vaultBatch2(idx, wusdc);
        _vaultBatch3(idx, wusdc);
        _vaultBatch4(idx, wusdc);
        _vaultBatch5(idx, wusdc);
        _vaultBatch6(idx, wusdc);
        _vaultBatch7(idx, wusdc);
        vm.stopBroadcast();
        console.log("Deployed 96 vaults");
    }

    function _vaultBatch0(address idx, IERC20 wusdc) internal {
        { // BRDG
            bytes32 id = bytes32(uint256(1));
            ITP v = new ITP(id, idx, "Cross-Chain Interop Index", "BRDG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // PRIV
            bytes32 id = bytes32(uint256(2));
            ITP v = new ITP(id, idx, "Privacy Protocol Index", "PRIV", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // RWAI
            bytes32 id = bytes32(uint256(3));
            ITP v = new ITP(id, idx, "Real World Asset Protocol Index", "RWAI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // RWATVL
            bytes32 id = bytes32(uint256(4));
            ITP v = new ITP(id, idx, "RWA TVL Weighted", "RWATVL", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // LSTKTVL
            bytes32 id = bytes32(uint256(5));
            ITP v = new ITP(id, idx, "Liquid Staking TVL Weighted", "LSTKTVL", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CLVL60
            bytes32 id = bytes32(uint256(6));
            ITP v = new ITP(id, idx, "Crypto Low-Vol 60d", "CLVL60", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CDMOM60
            bytes32 id = bytes32(uint256(7));
            ITP v = new ITP(id, idx, "Crypto Dual Momentum 60d", "CDMOM60", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // FANS
            bytes32 id = bytes32(uint256(8));
            ITP v = new ITP(id, idx, "Fan Token Index", "FANS", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MEME5
            bytes32 id = bytes32(uint256(9));
            ITP v = new ITP(id, idx, "Concentrated Meme Top 5", "MEME5", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CDPMOM
            bytes32 id = bytes32(uint256(10));
            ITP v = new ITP(id, idx, "CDP Momentum", "CDPMOM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // RWADEF
            bytes32 id = bytes32(uint256(11));
            ITP v = new ITP(id, idx, "RWA Macro Defensive", "RWADEF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MSEC
            bytes32 id = bytes32(uint256(12));
            ITP v = new ITP(id, idx, "Modular Security", "MSEC", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch1(address idx, IERC20 wusdc) internal {
        { // TOPYLD
            bytes32 id = bytes32(uint256(13));
            ITP v = new ITP(id, idx, "Top Yield Protocols", "TOPYLD", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // YLDTVL
            bytes32 id = bytes32(uint256(14));
            ITP v = new ITP(id, idx, "Yield Protocol TVL", "YLDTVL", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // LENDREV
            bytes32 id = bytes32(uint256(15));
            ITP v = new ITP(id, idx, "Lending Revenue Weighted", "LENDREV", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // BRDGREV
            bytes32 id = bytes32(uint256(16));
            ITP v = new ITP(id, idx, "Bridge Revenue Index", "BRDGREV", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // YLDSQRT
            bytes32 id = bytes32(uint256(17));
            ITP v = new ITP(id, idx, "Yield Sqrt TVL", "YLDSQRT", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GAME5
            bytes32 id = bytes32(uint256(18));
            ITP v = new ITP(id, idx, "Concentrated Gaming Top 5", "GAME5", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // M2E
            bytes32 id = bytes32(uint256(19));
            ITP v = new ITP(id, idx, "Move-to-Earn Index", "M2E", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // LOVOL
            bytes32 id = bytes32(uint256(20));
            ITP v = new ITP(id, idx, "Low Volatility 30d", "LOVOL", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ORAMV
            bytes32 id = bytes32(uint256(21));
            ITP v = new ITP(id, idx, "Oracle Min Variance", "ORAMV", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DCOUP
            bytes32 id = bytes32(uint256(22));
            ITP v = new ITP(id, idx, "BTC Decoupler Index", "DCOUP", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // NFTPH
            bytes32 id = bytes32(uint256(23));
            ITP v = new ITP(id, idx, "NFT Infrastructure Phoenix", "NFTPH", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // METAB
            bytes32 id = bytes32(uint256(24));
            ITP v = new ITP(id, idx, "Metaverse Bottom Fish", "METAB", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch2(address idx, IERC20 wusdc) internal {
        { // PREDCON
            bytes32 id = bytes32(uint256(25));
            ITP v = new ITP(id, idx, "Prediction Market Contrarian", "PREDCON", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DMOM60
            bytes32 id = bytes32(uint256(26));
            ITP v = new ITP(id, idx, "Dual Momentum 60d", "DMOM60", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // AIDMOM
            bytes32 id = bytes32(uint256(27));
            ITP v = new ITP(id, idx, "AI Dual Momentum", "AIDMOM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GAMM60
            bytes32 id = bytes32(uint256(28));
            ITP v = new ITP(id, idx, "Gaming Momentum 60d", "GAMM60", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GAMDM
            bytes32 id = bytes32(uint256(29));
            ITP v = new ITP(id, idx, "Gaming Dual Momentum", "GAMDM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DFIMFNG
            bytes32 id = bytes32(uint256(30));
            ITP v = new ITP(id, idx, "DeFi Momentum + FNG", "DFIMFNG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // TVLMPP
            bytes32 id = bytes32(uint256(31));
            ITP v = new ITP(id, idx, "TVL Momentum Perps", "TVLMPP", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MOM5FNG
            bytes32 id = bytes32(uint256(32));
            ITP v = new ITP(id, idx, "Concentrated Momentum + FNG", "MOM5FNG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // TVLMOM
            bytes32 id = bytes32(uint256(33));
            ITP v = new ITP(id, idx, "TVL Leaders + Momentum", "TVLMOM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ROTATE
            bytes32 id = bytes32(uint256(34));
            ITP v = new ITP(id, idx, "All Sectors Rotation", "ROTATE", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // BRMFNG
            bytes32 id = bytes32(uint256(35));
            ITP v = new ITP(id, idx, "Bridge Mom + FNG", "BRMFNG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ZKMVC
            bytes32 id = bytes32(uint256(36));
            ITP v = new ITP(id, idx, "ZK Mom + VC", "ZKMVC", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch3(address idx, IERC20 wusdc) internal {
        { // MODMVC
            bytes32 id = bytes32(uint256(37));
            ITP v = new ITP(id, idx, "Modular Mom + VC", "MODMVC", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CDM5
            bytes32 id = bytes32(uint256(38));
            ITP v = new ITP(id, idx, "Concentrated Dual Momentum", "CDM5", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // L1MFFD
            bytes32 id = bytes32(uint256(39));
            ITP v = new ITP(id, idx, "L1 Multi-Factor + FNG + Dom", "L1MFFD", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GOV15EQ
            bytes32 id = bytes32(uint256(40));
            ITP v = new ITP(id, idx, "Governance 15 Equal Quarterly", "GOV15EQ", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // LND10FEB
            bytes32 id = bytes32(uint256(41));
            ITP v = new ITP(id, idx, "Lending 10 Fee Eff Biweekly", "LND10FEB", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CDP5TQ
            bytes32 id = bytes32(uint256(42));
            ITP v = new ITP(id, idx, "CDP 5 TVL Quarterly", "CDP5TQ", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // VLDM
            bytes32 id = bytes32(uint256(43));
            ITP v = new ITP(id, idx, "Volume Leaders Dual Momentum", "VLDM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DPULTRA
            bytes32 id = bytes32(uint256(44));
            ITP v = new ITP(id, idx, "DePIN 10 Revenue + All Overlays", "DPULTRA", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DX10VFD
            bytes32 id = bytes32(uint256(45));
            ITP v = new ITP(id, idx, "DEX 10 Volume + FNG + Dom", "DX10VFD", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // B100SM
            bytes32 id = bytes32(uint256(46));
            ITP v = new ITP(id, idx, "Broad 100 Sqrt Mcap Monthly", "B100SM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // B100CQ
            bytes32 id = bytes32(uint256(47));
            ITP v = new ITP(id, idx, "Broad 100 Capped Quarterly", "B100CQ", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MEGAMOM
            bytes32 id = bytes32(uint256(48));
            ITP v = new ITP(id, idx, "All 50 Dual Mom FNG+BTC Dom", "MEGAMOM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch4(address idx, IERC20 wusdc) internal {
        { // YF30M
            bytes32 id = bytes32(uint256(49));
            ITP v = new ITP(id, idx, "Young Founders Under 30 Momentum", "YF30M", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // PB34
            bytes32 id = bytes32(uint256(50));
            ITP v = new ITP(id, idx, "Peak Builders 30-34", "PB34", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // PB34M
            bytes32 id = bytes32(uint256(51));
            ITP v = new ITP(id, idx, "Peak Builders 30-34 Mcap", "PB34M", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // EF39
            bytes32 id = bytes32(uint256(52));
            ITP v = new ITP(id, idx, "Experienced Founders 35-39", "EF39", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // VF44
            bytes32 id = bytes32(uint256(53));
            ITP v = new ITP(id, idx, "Veteran Founders 40-44", "VF44", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ES45
            bytes32 id = bytes32(uint256(54));
            ITP v = new ITP(id, idx, "Elder Statesmen 45+", "ES45", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ES45M
            bytes32 id = bytes32(uint256(55));
            ITP v = new ITP(id, idx, "Elder Statesmen 45+ Mcap", "ES45M", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // USAM
            bytes32 id = bytes32(uint256(56));
            ITP v = new ITP(id, idx, "American Founders Mcap", "USAM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // ASIF
            bytes32 id = bytes32(uint256(57));
            ITP v = new ITP(id, idx, "Asian Founders Index", "ASIF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // EURF
            bytes32 id = bytes32(uint256(58));
            ITP v = new ITP(id, idx, "European Founders Index", "EURF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GBRF
            bytes32 id = bytes32(uint256(59));
            ITP v = new ITP(id, idx, "British Founders", "GBRF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // STAN
            bytes32 id = bytes32(uint256(60));
            ITP v = new ITP(id, idx, "Stanford Alumni Index", "STAN", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch5(address idx, IERC20 wusdc) internal {
        { // MITX
            bytes32 id = bytes32(uint256(61));
            ITP v = new ITP(id, idx, "MIT Alumni Index", "MITX", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // HVRD
            bytes32 id = bytes32(uint256(62));
            ITP v = new ITP(id, idx, "Harvard Alumni Index", "HVRD", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // IVYX
            bytes32 id = bytes32(uint256(63));
            ITP v = new ITP(id, idx, "Ivy League Founders", "IVYX", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // IVYM
            bytes32 id = bytes32(uint256(64));
            ITP v = new ITP(id, idx, "Ivy League Mcap", "IVYM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CSFI
            bytes32 id = bytes32(uint256(65));
            ITP v = new ITP(id, idx, "Top CS Schools Index", "CSFI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CSMM
            bytes32 id = bytes32(uint256(66));
            ITP v = new ITP(id, idx, "Top CS Momentum", "CSMM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // WATO
            bytes32 id = bytes32(uint256(67));
            ITP v = new ITP(id, idx, "Waterloo-Toronto Corridor", "WATO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CRNL
            bytes32 id = bytes32(uint256(68));
            ITP v = new ITP(id, idx, "Cornell Blockchain", "CRNL", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DROP
            bytes32 id = bytes32(uint256(69));
            ITP v = new ITP(id, idx, "No-Degree Founders", "DROP", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DRMO
            bytes32 id = bytes32(uint256(70));
            ITP v = new ITP(id, idx, "No-Degree Momentum", "DRMO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // NVIY
            bytes32 id = bytes32(uint256(71));
            ITP v = new ITP(id, idx, "No-Degree vs Ivy", "NVIY", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // DENG
            bytes32 id = bytes32(uint256(72));
            ITP v = new ITP(id, idx, "German Engineering", "DENG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch6(address idx, IERC20 wusdc) internal {
        { // CNFI
            bytes32 id = bytes32(uint256(73));
            ITP v = new ITP(id, idx, "Chinese Founders Index", "CNFI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // BERK
            bytes32 id = bytes32(uint256(74));
            ITP v = new ITP(id, idx, "Berkeley Alumni", "BERK", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // OZFI
            bytes32 id = bytes32(uint256(75));
            ITP v = new ITP(id, idx, "Australian Founders", "OZFI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // CANF
            bytes32 id = bytes32(uint256(76));
            ITP v = new ITP(id, idx, "Canadian Founders", "CANF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // AGSP
            bytes32 id = bytes32(uint256(77));
            ITP v = new ITP(id, idx, "Age Spread 10-19 Years", "AGSP", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // NDFQ
            bytes32 id = bytes32(uint256(78));
            ITP v = new ITP(id, idx, "No-Degree + FNG Quality", "NDFQ", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // SERI
            bytes32 id = bytes32(uint256(79));
            ITP v = new ITP(id, idx, "Serial Entrepreneurs Index", "SERI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // SEMO
            bytes32 id = bytes32(uint256(80));
            ITP v = new ITP(id, idx, "Serial Entrepreneurs Momentum", "SEMO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // STLM
            bytes32 id = bytes32(uint256(81));
            ITP v = new ITP(id, idx, "Stealth Mcap", "STLM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // STMO
            bytes32 id = bytes32(uint256(82));
            ITP v = new ITP(id, idx, "Stealth Momentum", "STMO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // HIVI
            bytes32 id = bytes32(uint256(83));
            ITP v = new ITP(id, idx, "High Visibility Founders", "HIVI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // GOOG
            bytes32 id = bytes32(uint256(84));
            ITP v = new ITP(id, idx, "Ex-Google Founders", "GOOG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

    function _vaultBatch7(address idx, IERC20 wusdc) internal {
        { // META
            bytes32 id = bytes32(uint256(85));
            ITP v = new ITP(id, idx, "Ex-Meta Founders", "META", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // PHDI
            bytes32 id = bytes32(uint256(86));
            ITP v = new ITP(id, idx, "PhD Founders Index", "PHDI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MBAM
            bytes32 id = bytes32(uint256(87));
            ITP v = new ITP(id, idx, "MBA Mcap", "MBAM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MILF
            bytes32 id = bytes32(uint256(88));
            ITP v = new ITP(id, idx, "Ex-Military Founders", "MILF", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MNAT
            bytes32 id = bytes32(uint256(89));
            ITP v = new ITP(id, idx, "Multinational Teams", "MNAT", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // USIN
            bytes32 id = bytes32(uint256(90));
            ITP v = new ITP(id, idx, "US + International Teams", "USIN", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // IMMG
            bytes32 id = bytes32(uint256(91));
            ITP v = new ITP(id, idx, "Immigrant Founders", "IMMG", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // IMMM
            bytes32 id = bytes32(uint256(92));
            ITP v = new ITP(id, idx, "Immigrant Mcap", "IMMM", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // TRFI
            bytes32 id = bytes32(uint256(93));
            ITP v = new ITP(id, idx, "Ex-TradFi Founders", "TRFI", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // SRFQ
            bytes32 id = bytes32(uint256(94));
            ITP v = new ITP(id, idx, "Serial + FNG Quality", "SRFQ", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // FDMO
            bytes32 id = bytes32(uint256(95));
            ITP v = new ITP(id, idx, "FAANG Defectors Momentum", "FDMO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
        { // MNMO
            bytes32 id = bytes32(uint256(96));
            ITP v = new ITP(id, idx, "Multinational + Momentum", "MNMO", wusdc);
            Investment(idx).setITPVault(id, address(v));
        }
    }

}