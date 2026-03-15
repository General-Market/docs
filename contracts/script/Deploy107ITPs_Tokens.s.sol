// SPDX-License-Identifier: MIT
// AUTO-GENERATED -- DO NOT EDIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/mocks/MockERC20.sol";

/// @title Deploy107ITPs_Tokens - Deploy 147 new tokens + fund vault
contract Deploy107ITPs_Tokens is Script {
    uint256 constant N = 231;
    uint256 constant FUND = 1_000_000 * 1e18;

    function run() external {
        uint256 pk = vm.envOr("PRIVATE_KEY", uint256(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d));
        address bv = vm.envAddress("MOCK_BITGET_VAULT");

        address[] memory t = new address[](N);
        _setExisting(t);

        vm.startBroadcast(pk);
        _deployBatch0(t);
        _deployBatch1(t);
        _deployBatch2(t);
        _deployBatch3(t);
        _deployBatch4(t);
        _deployBatch5(t);
        // Fund vault
        for (uint256 i = 0; i < N; i++) MockERC20(t[i]).mint(bv, FUND);
        vm.stopBroadcast();

        // Export deployed-assets.json and token list
        _export(t);
        console.log("Done: 147 tokens deployed, vault funded");
    }

    function _setExisting(address[] memory t) internal pure {
        t[0] = 0xeCab56116e27D00bA844Ec985F221582542FD747;
        t[1] = 0x96bc0d2c75125CF656Ea7EF1672FA3fA37dDbf15;
        t[2] = 0xa66e8A4853262C0c27A8197153A6d4AcDf4a211A;
        t[3] = 0xbf32129830F05e852D8eCD603CfF8128cBF6824D;
        t[4] = 0x3F54281Da3e84983bc61E74904e8711e1DcA1D2b;
        t[5] = 0xfD55E8Bc20388E7Eb0748935a036618f90Dd4aCc;
        t[6] = 0x5dEE7ef918caB1c217eD6B20aCB398A4F052E90b;
        t[7] = 0x0C77d48531fD4dC784Fe3F249a920D26f10082B0;
        t[8] = 0x19fc9A9e944A23e8227947a6B853095a589855c7;
        t[9] = 0x4dD6b2ac20eF86f537B8fCbF884a5Ccea6A8611a;
        t[10] = 0x078DAdb86178728f2B15b56339C71FCBAcbFdB88;
        t[11] = 0x20536c36f7Ea48213E6835b93aFc60889F7865cB;
        t[12] = 0xBF3Ccc92f5609A7e3aeBbb9E334B8C08Dc831d2D;
        t[13] = 0x66B16fEF2A591A2309E84B8fdd94d7b47105fA75;
        t[14] = 0x382F31DCFb1E73d304b0f5fcE753489118899D3f;
        t[15] = 0xf13C303C0CCf673114E452dc1D6FCf7EcAf91050;
        t[16] = 0xff6A5440E4c1BB41f7f4Ac0D25ABF565aB9053d1;
        t[17] = 0x0909A3E4516c3545582dCDc2F7B273137b82349F;
        t[18] = 0x70887ac232f19D8B81E329b85f54F79294c27502;
        t[19] = 0xf255fEb29976115f2cb0E88f1Ff4F4CEFCD22cab;
        t[20] = 0x52EF8E76d7079b643089E96384345674363b50F9;
        t[21] = 0x65a27E411735262bFEe201da5D4A1a3e1871aD29;
        t[22] = 0xDBB885F9047F0151107d707c5E7d4b06e1262E19;
        t[23] = 0xDa858625b14536fD22F15F3c17938fE999A3c1e3;
        t[24] = 0xf085De0Bd6Ec71bed5a7dFDcC21925B98bE11048;
        t[25] = 0x40d07752D994fcF057cD7292CC9fbee44FB4B018;
        t[26] = 0x402597f89670b29FBd07c3F025580D7DF4dF663C;
        t[27] = 0x0FA98C1a226059CbC5a23bd9b78797FF3eFf34Ee;
        t[28] = 0x670d06BBBEAD92138E2fAadE8C8F849ad7Fc75A9;
        t[29] = 0x4Cd677D96c64ec9F1309A90ec8794375eA445669;
        t[30] = 0xaF8bb775274c24cCB8328F39E77aA2068B7788ac;
        t[31] = 0x10E24c5AD9945520bB0052D00229fc25FF5b4b21;
        t[32] = 0x70dE06Cbe49894E3F00818B02C1fcb9C855b737B;
        t[33] = 0x8994A7612Ab16DF1860016A53cB8a106b8f41586;
        t[34] = 0x5B15E657Afb26Ca51a01d0582a20c05c7fcd6d15;
        t[35] = 0x6cd9D94Ab75673434b869ad4976F268F0DAC7110;
        t[36] = 0x1d3575e43976b411FFdCB349793EA3245D2C9FE0;
        t[37] = 0x065991eD6e529ecD6EDAfA784A786c1809899bF3;
        t[38] = 0x5A90dE66000B0B3a2924fa16EeeE7DBa107eFF0c;
        t[39] = 0xFeF1411b80F9BE2E74690EcEc79BbD93e8310334;
        t[40] = 0x908C0F37861cF1FeC492B13D49710a788C0357b6;
        t[41] = 0xbF13C8E6DA3e75BC5513BacE6f9Cd969C13d6c14;
        t[42] = 0xd638C5a66a460ffA22ab20CAFC300bEAbD5c712e;
        t[43] = 0x72c15467036cD2c9eC3DC13b4cA0D03385D6A688;
        t[44] = 0x6Be3AEc74f0DBa51E9b02D2f07A963Fd5223E8A6;
        t[45] = 0xbe1427312f7b8adE138c5D2AeCe151011E8DFeF5;
        t[46] = 0x68cF2Bf0F6Ec5d3c7753538674533d03553017c6;
        t[47] = 0x21bDc923c8D60C8c0A3E989C5Ce5f9473878c5A0;
        t[48] = 0xb63AF3d8f91606394c6D0ebe24503c3D41dAa3EA;
        t[49] = 0xBD6e085b831478F7b3Ccd4FdC8e6114e5D52630a;
        t[50] = 0x4CaD35AB25007D22F7aCE4dB6A78bA81446B1241;
        t[51] = 0xa102fA9511B1445d1315f949a39dF6F4099F0823;
        t[52] = 0x1B2d92bA99Af558974715DD7Cc623a536Fb271b0;
        t[53] = 0x479385fc350606285058fd66a1694d5e93e1BC36;
        t[54] = 0x0bF89b5530e3938F0415a4a972BB9f677E4440Cc;
        t[55] = 0xDAaa9aa208cDFF23321A41E6E93bA811570c45EB;
        t[56] = 0xD7a13ef5B3232D360876E1cFEe8B5f9E40D7A93d;
        t[57] = 0xd665b3e9D237B64B19a03405B2b47D71323D5ED2;
        t[58] = 0xACd0e7aED14C5D1B98a67C6615B6d368eC9B4a6a;
        t[59] = 0x4cF5b5685aE56252E464C7C19E6C7DA97548C6BA;
        t[60] = 0x223A3d52dd905Bb356616Af3E869249B4CD468D0;
        t[61] = 0x8a3623De48C533918478A79C460ba392D5170a02;
        t[62] = 0x1f14FA5B56593bf7784782402A3d5a34ECA78870;
        t[63] = 0xCeaF6194B4D9597Ec313263B5901D80E8Da298Ac;
        t[64] = 0x851A706BfFf9d6ADB4d0FCC9b52946c47C063AF5;
        t[65] = 0xBb6E98d8B43163D174178b14d8531b2A711dbC0d;
        t[66] = 0xbBCeB96Aef7cbbd0b90d4d0F9Acc3545691A7fAB;
        t[67] = 0xCEe88509E2d2dd68A0876f1717CB72D33Cb7c98d;
        t[68] = 0x8fD9cA291480a88AaDFF9110deD149E3C7c08155;
        t[69] = 0x8A014986235EfE25f910fD7Ce93AAea5BF3Ed087;
        t[70] = 0xe1844486947F5C1A8A1e85BE5120Fd99b3aD7dFD;
        t[71] = 0xCD252B40a94a0a166cfB4395dD8DcAE0658b68E7;
        t[72] = 0xCeef15dA29aEc9Dc9aAEF2fBA73671eD75513716;
        t[73] = 0xb9eB6F43f4aB9b1fd2E45d219a94785004af53DC;
        t[74] = 0x8C69D6Cb1d4418e3AF1A5337adCe5f32Bab22480;
        t[75] = 0xE48188DF109644b9591520CbeAB3c645af32ADC5;
        t[76] = 0x79E81fa1281827a1D0f580571084A7123fBaa465;
        t[77] = 0xf8154F6377ff5C7c4322921934f2f67C43a06cE7;
        t[78] = 0x15e3b5Fd2C7187b5C406fB4E3C51f81e52fcB830;
        t[79] = 0xFbB64138C48B0a0ca5308994B971C915203e6C03;
        t[80] = 0x5997FaB646eF91DC1780b73f06D5f1941Ae25e4D;
        t[81] = 0xA72059F4bB03A10f2cacf468132226f8F68f101B;
        t[82] = 0x1340226b3aB4ADafdE873e3D864bF22a53C4C0dB;
        t[83] = 0x334A0fFE92b5B6629A4be8d55C1100Bdb97BC422;
    }

    function _deployBatch0(address[] memory t) internal {
        t[84] = address(new MockERC20("Mock ACT", "ACT", 18));
        t[85] = address(new MockERC20("Mock AERO", "AERO", 18));
        t[86] = address(new MockERC20("Mock AFC", "AFC", 18));
        t[87] = address(new MockERC20("Mock AITECH", "AITECH", 18));
        t[88] = address(new MockERC20("Mock APR", "APR", 18));
        t[89] = address(new MockERC20("Mock ARG", "ARG", 18));
        t[90] = address(new MockERC20("Mock ARIAIP", "ARIAIP", 18));
        t[91] = address(new MockERC20("Mock ASR", "ASR", 18));
        t[92] = address(new MockERC20("Mock ASTER", "ASTER", 18));
        t[93] = address(new MockERC20("Mock ATM", "ATM", 18));
        t[94] = address(new MockERC20("Mock AVNT", "AVNT", 18));
        t[95] = address(new MockERC20("Mock BAR", "BAR", 18));
        t[96] = address(new MockERC20("Mock BB", "BB", 18));
        t[97] = address(new MockERC20("Mock BICO", "BICO", 18));
        t[98] = address(new MockERC20("Mock BIGTIME", "BIGTIME", 18));
        t[99] = address(new MockERC20("Mock BLUE", "BLUE", 18));
        t[100] = address(new MockERC20("Mock BR", "BR", 18));
        t[101] = address(new MockERC20("Mock BTT", "BTT", 18));
        t[102] = address(new MockERC20("Mock CELR", "CELR", 18));
        t[103] = address(new MockERC20("Mock CGN", "CGN", 18));
        t[104] = address(new MockERC20("Mock CGPT", "CGPT", 18));
        t[105] = address(new MockERC20("Mock CHR", "CHR", 18));
        t[106] = address(new MockERC20("Mock COLLECT", "COLLECT", 18));
        t[107] = address(new MockERC20("Mock COOKIE", "COOKIE", 18));
        t[108] = address(new MockERC20("Mock COTI", "COTI", 18));
    }

    function _deployBatch1(address[] memory t) internal {
        t[109] = address(new MockERC20("Mock CREO", "CREO", 18));
        t[110] = address(new MockERC20("Mock CRO", "CRO", 18));
        t[111] = address(new MockERC20("Mock CVX", "CVX", 18));
        t[112] = address(new MockERC20("Mock DBR", "DBR", 18));
        t[113] = address(new MockERC20("Mock DUSK", "DUSK", 18));
        t[114] = address(new MockERC20("Mock EIGEN", "EIGEN", 18));
        t[115] = address(new MockERC20("Mock ENJ", "ENJ", 18));
        t[116] = address(new MockERC20("Mock FARTCOIN", "FARTCOIN", 18));
        t[117] = address(new MockERC20("Mock FF", "FF", 18));
        t[118] = address(new MockERC20("Mock FLUX", "FLUX", 18));
        t[119] = address(new MockERC20("Mock FRAX", "FRAX", 18));
        t[120] = address(new MockERC20("Mock GHO", "GHO", 18));
        t[121] = address(new MockERC20("Mock GNO", "GNO", 18));
        t[122] = address(new MockERC20("Mock GNS", "GNS", 18));
        t[123] = address(new MockERC20("Mock GOAT", "GOAT", 18));
        t[124] = address(new MockERC20("Mock HAEDAL", "HAEDAL", 18));
        t[125] = address(new MockERC20("Mock HTX", "HTX", 18));
        t[126] = address(new MockERC20("Mock ICX", "ICX", 18));
        t[127] = address(new MockERC20("Mock IN", "IN", 18));
        t[128] = address(new MockERC20("Mock IP", "IP", 18));
        t[129] = address(new MockERC20("Mock JST", "JST", 18));
        t[130] = address(new MockERC20("Mock JUV", "JUV", 18));
        t[131] = address(new MockERC20("Mock KAIA", "KAIA", 18));
        t[132] = address(new MockERC20("Mock KAITO", "KAITO", 18));
        t[133] = address(new MockERC20("Mock KAS", "KAS", 18));
    }

    function _deployBatch2(address[] memory t) internal {
        t[134] = address(new MockERC20("Mock KERNEL", "KERNEL", 18));
        t[135] = address(new MockERC20("Mock KITE", "KITE", 18));
        t[136] = address(new MockERC20("Mock KUB", "KUB", 18));
        t[137] = address(new MockERC20("Mock LAB", "LAB", 18));
        t[138] = address(new MockERC20("Mock LDO", "LDO", 18));
        t[139] = address(new MockERC20("Mock LIT", "LIT", 18));
        t[140] = address(new MockERC20("Mock LPT", "LPT", 18));
        t[141] = address(new MockERC20("Mock LRC", "LRC", 18));
        t[142] = address(new MockERC20("Mock M", "M", 18));
        t[143] = address(new MockERC20("Mock MANA", "MANA", 18));
        t[144] = address(new MockERC20("Mock MASK", "MASK", 18));
        t[145] = address(new MockERC20("Mock MBOX", "MBOX", 18));
        t[146] = address(new MockERC20("Mock ME", "ME", 18));
        t[147] = address(new MockERC20("Mock MINA", "MINA", 18));
        t[148] = address(new MockERC20("Mock MMT", "MMT", 18));
        t[149] = address(new MockERC20("Mock MYX", "MYX", 18));
        t[150] = address(new MockERC20("Mock NEWT", "NEWT", 18));
        t[151] = address(new MockERC20("Mock NEXO", "NEXO", 18));
        t[152] = address(new MockERC20("Mock NFT", "NFT", 18));
        t[153] = address(new MockERC20("Mock NMR", "NMR", 18));
        t[154] = address(new MockERC20("Mock OG", "OG", 18));
        t[155] = address(new MockERC20("Mock OSMO", "OSMO", 18));
        t[156] = address(new MockERC20("Mock PAXG", "PAXG", 18));
        t[157] = address(new MockERC20("Mock PENDLE", "PENDLE", 18));
        t[158] = address(new MockERC20("Mock PENGU", "PENGU", 18));
    }

    function _deployBatch3(address[] memory t) internal {
        t[159] = address(new MockERC20("Mock PI", "PI", 18));
        t[160] = address(new MockERC20("Mock PLUME", "PLUME", 18));
        t[161] = address(new MockERC20("Mock POL", "POL", 18));
        t[162] = address(new MockERC20("Mock POLYX", "POLYX", 18));
        t[163] = address(new MockERC20("Mock PORTO", "PORTO", 18));
        t[164] = address(new MockERC20("Mock POWER", "POWER", 18));
        t[165] = address(new MockERC20("Mock PRCL", "PRCL", 18));
        t[166] = address(new MockERC20("Mock PRIME", "PRIME", 18));
        t[167] = address(new MockERC20("Mock PROPS", "PROPS", 18));
        t[168] = address(new MockERC20("Mock PSG", "PSG", 18));
        t[169] = address(new MockERC20("Mock PUFFER", "PUFFER", 18));
        t[170] = address(new MockERC20("Mock PUMP", "PUMP", 18));
        t[171] = address(new MockERC20("Mock PUMPBTC", "PUMPBTC", 18));
        t[172] = address(new MockERC20("Mock PYTH", "PYTH", 18));
        t[173] = address(new MockERC20("Mock PYUSD", "PYUSD", 18));
        t[174] = address(new MockERC20("Mock QNT", "QNT", 18));
        t[175] = address(new MockERC20("Mock RLS", "RLS", 18));
        t[176] = address(new MockERC20("Mock RLUSD", "RLUSD", 18));
        t[177] = address(new MockERC20("Mock ROSE", "ROSE", 18));
        t[178] = address(new MockERC20("Mock RPL", "RPL", 18));
        t[179] = address(new MockERC20("Mock RSR", "RSR", 18));
        t[180] = address(new MockERC20("Mock RUNE", "RUNE", 18));
        t[181] = address(new MockERC20("Mock RWA", "RWA", 18));
        t[182] = address(new MockERC20("Mock SAND", "SAND", 18));
        t[183] = address(new MockERC20("Mock SANTOS", "SANTOS", 18));
    }

    function _deployBatch4(address[] memory t) internal {
        t[184] = address(new MockERC20("Mock SD", "SD", 18));
        t[185] = address(new MockERC20("Mock SDEX", "SDEX", 18));
        t[186] = address(new MockERC20("Mock SIGN", "SIGN", 18));
        t[187] = address(new MockERC20("Mock SKY", "SKY", 18));
        t[188] = address(new MockERC20("Mock SOON", "SOON", 18));
        t[189] = address(new MockERC20("Mock STABLE", "STABLE", 18));
        t[190] = address(new MockERC20("Mock STETH", "STETH", 18));
        t[191] = address(new MockERC20("Mock STRK", "STRK", 18));
        t[192] = address(new MockERC20("Mock SUN", "SUN", 18));
        t[193] = address(new MockERC20("Mock SUSHI", "SUSHI", 18));
        t[194] = address(new MockERC20("Mock SWELL", "SWELL", 18));
        t[195] = address(new MockERC20("Mock SYS", "SYS", 18));
        t[196] = address(new MockERC20("Mock T", "T", 18));
        t[197] = address(new MockERC20("Mock THE", "THE", 18));
        t[198] = address(new MockERC20("Mock TIA", "TIA", 18));
        t[199] = address(new MockERC20("Mock TLM", "TLM", 18));
        t[200] = address(new MockERC20("Mock TLOS", "TLOS", 18));
        t[201] = address(new MockERC20("Mock TNSR", "TNSR", 18));
        t[202] = address(new MockERC20("Mock TRADOOR", "TRADOOR", 18));
        t[203] = address(new MockERC20("Mock TREE", "TREE", 18));
        t[204] = address(new MockERC20("Mock TRU", "TRU", 18));
        t[205] = address(new MockERC20("Mock TRUST", "TRUST", 18));
        t[206] = address(new MockERC20("Mock TURBO", "TURBO", 18));
        t[207] = address(new MockERC20("Mock TUSD", "TUSD", 18));
        t[208] = address(new MockERC20("Mock USD1", "USD1", 18));
    }

    function _deployBatch5(address[] memory t) internal {
        t[209] = address(new MockERC20("Mock USDC", "USDC", 18));
        t[210] = address(new MockERC20("Mock USDE", "USDE", 18));
        t[211] = address(new MockERC20("Mock USDS", "USDS", 18));
        t[212] = address(new MockERC20("Mock USUAL", "USUAL", 18));
        t[213] = address(new MockERC20("Mock VELO", "VELO", 18));
        t[214] = address(new MockERC20("Mock VET", "VET", 18));
        t[215] = address(new MockERC20("Mock VIRTUAL", "VIRTUAL", 18));
        t[216] = address(new MockERC20("Mock W", "W", 18));
        t[217] = address(new MockERC20("Mock WBTC", "WBTC", 18));
        t[218] = address(new MockERC20("Mock WEETH", "WEETH", 18));
        t[219] = address(new MockERC20("Mock WLFI", "WLFI", 18));
        t[220] = address(new MockERC20("Mock XAUT", "XAUT", 18));
        t[221] = address(new MockERC20("Mock XDC", "XDC", 18));
        t[222] = address(new MockERC20("Mock XTZ", "XTZ", 18));
        t[223] = address(new MockERC20("Mock YGG", "YGG", 18));
        t[224] = address(new MockERC20("Mock ZAMA", "ZAMA", 18));
        t[225] = address(new MockERC20("Mock ZBCN", "ZBCN", 18));
        t[226] = address(new MockERC20("Mock ZEC", "ZEC", 18));
        t[227] = address(new MockERC20("Mock ZEN", "ZEN", 18));
        t[228] = address(new MockERC20("Mock ZETA", "ZETA", 18));
        t[229] = address(new MockERC20("Mock ZK", "ZK", 18));
        t[230] = address(new MockERC20("Mock ZRO", "ZRO", 18));
    }

    function _export(address[] memory t) internal {
        string memory out = "";
        for (uint256 i = 0; i < N; i++) {
            out = string.concat(out, vm.toString(i), ",", vm.toString(t[i]), "\n");
        }
        vm.writeFile("../data/itp-107-token-addresses.csv", out);
        console.log("  Token addresses written to data/itp-107-token-addresses.csv");
    }
}