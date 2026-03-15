// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/// @title Deploy - Local development deployment script
/// @notice Deploys contracts for local Anvil testing (chain ID 111222333)
/// @dev Full implementations come in Epic 2; this verifies the deployment pipeline
contract Deploy is Script {
    // Deployed addresses (will be saved to deployments/local.json)
    address public governanceAddress;
    address public indexAddress;
    address public itpAddress;
    address public blsCustodyAddress;
    address public collateralRegistryAddress;
    address public oracleRegistryAddress;
    address public bridgeAddress;

    function run() external {
        // Chain ID protection: only allow default key on local Anvil chain
        uint256 LOCAL_CHAIN_ID = 111222333;
        uint256 DEFAULT_ANVIL_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        uint256 deployerPrivateKey;
        if (block.chainid == LOCAL_CHAIN_ID) {
            // Local development: use Anvil's default key as fallback
            deployerPrivateKey = vm.envOr("PRIVATE_KEY", DEFAULT_ANVIL_KEY);
        } else {
            // Non-local chain: MUST provide explicit private key
            deployerPrivateKey = vm.envUint("PRIVATE_KEY");
            require(deployerPrivateKey != DEFAULT_ANVIL_KEY, "Cannot use default Anvil key on non-local chain");
        }
        address deployer = vm.addr(deployerPrivateKey);

        console.log("===========================================");
        console.log("INDEX L3 LOCAL DEPLOYMENT");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============ PHASE 1: Libraries ============
        // Libraries are embedded at compile time, no deployment needed
        // TypesLib, ErrorsLib, EventsLib are all library contracts
        console.log("Libraries (embedded at compile time):");
        console.log("  - TypesLib: embedded");
        console.log("  - ErrorsLib: embedded");
        console.log("  - EventsLib: embedded");
        console.log("");

        // ============ PHASE 2: Placeholder Contracts ============
        // Deploy minimal placeholder contracts for local testing
        // Full implementations come in Epic 2

        console.log("Deploying placeholder contracts...");

        // Deploy Governance placeholder
        governanceAddress = address(new GovernancePlaceholder());
        console.log("  Governance:", governanceAddress);

        // Deploy Index placeholder
        indexAddress = address(new IndexPlaceholder());
        console.log("  Index:", indexAddress);

        // Deploy ITP placeholder
        itpAddress = address(new ITPPlaceholder());
        console.log("  ITP:", itpAddress);

        // Deploy BLSCustody placeholder
        blsCustodyAddress = address(new BLSCustodyPlaceholder());
        console.log("  BLSCustody:", blsCustodyAddress);

        // Deploy CollateralRegistry placeholder
        collateralRegistryAddress = address(new CollateralRegistryPlaceholder());
        console.log("  CollateralRegistry:", collateralRegistryAddress);

        // Deploy OracleRegistry placeholder
        oracleRegistryAddress = address(new OracleRegistryPlaceholder());
        console.log("  OracleRegistry:", oracleRegistryAddress);

        // Deploy Bridge placeholder
        bridgeAddress = address(new BridgePlaceholder());
        console.log("  Bridge:", bridgeAddress);

        vm.stopBroadcast();

        console.log("");
        console.log("===========================================");
        console.log("DEPLOYMENT COMPLETE");
        console.log("===========================================");
        console.log("");

        // Write deployment addresses to JSON
        string memory json = _buildDeploymentJson();
        vm.writeFile("../deployments/local.json", json);
        console.log("Addresses saved to: deployments/local.json");
    }

    function _buildDeploymentJson() internal view returns (string memory) {
        return string.concat(
            '{\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "deployer": "', vm.toString(vm.addr(vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)))), '",\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "contracts": {\n',
            '    "Governance": "', vm.toString(governanceAddress), '",\n',
            '    "Index": "', vm.toString(indexAddress), '",\n',
            '    "ITP": "', vm.toString(itpAddress), '",\n',
            '    "BLSCustody": "', vm.toString(blsCustodyAddress), '",\n',
            '    "CollateralRegistry": "', vm.toString(collateralRegistryAddress), '",\n',
            '    "OracleRegistry": "', vm.toString(oracleRegistryAddress), '",\n',
            '    "Bridge": "', vm.toString(bridgeAddress), '"\n',
            '  }\n',
            '}'
        );
    }
}

/// @notice Minimal placeholder for Governance contract
/// @dev Full implementation in Story 2.1
contract GovernancePlaceholder {
    address public admin;
    bool public paused;

    constructor() {
        admin = msg.sender;
        paused = false;
    }

    function pause() external {
        require(msg.sender == admin, "Not admin");
        paused = true;
    }

    function unpause() external {
        require(msg.sender == admin, "Not admin");
        paused = false;
    }
}

/// @notice Minimal placeholder for Index contract
/// @dev Full implementation in Stories 2.2-2.4
contract IndexPlaceholder {
    uint256 public orderCount;

    function submitOrder(bytes32, uint8, uint256, uint256, uint256, uint256) external returns (uint256) {
        return ++orderCount;
    }
}

/// @notice Minimal placeholder for ITP contract
/// @dev Full implementation in Story 2.5
contract ITPPlaceholder {
    mapping(bytes32 => bool) public itpExists;

    function createITP(string calldata, string calldata, uint256[] calldata, address[] calldata) external returns (bytes32) {
        bytes32 itpId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        itpExists[itpId] = true;
        return itpId;
    }
}

/// @notice Minimal placeholder for BLSCustody contract
/// @dev Full implementation in Stories 2.6-2.8
contract BLSCustodyPlaceholder {
    mapping(address => bool) public whitelist;

    function addToWhitelist(address addr) external {
        whitelist[addr] = true;
    }
}

/// @notice Minimal placeholder for CollateralRegistry contract
/// @dev Full implementation in Story 2.11
contract CollateralRegistryPlaceholder {
    mapping(address => bool) public supportedCollaterals;

    function addCollateral(address token) external {
        supportedCollaterals[token] = true;
    }
}

/// @notice Minimal placeholder for OracleRegistry contract
/// @dev Full implementation in Stories 2.12-2.13
contract OracleRegistryPlaceholder {
    uint256 public oracleCount;

    function registerOracle(address, bytes32, bytes calldata) external returns (uint256) {
        return ++oracleCount;
    }
}

/// @notice Minimal placeholder for Bridge contract
/// @dev Full implementation in Stories 2.9-2.10
contract BridgePlaceholder {
    mapping(bytes32 => bool) public pendingLocks;

    function lockForBridge(bytes32 lockId, uint256) external {
        pendingLocks[lockId] = true;
    }
}
