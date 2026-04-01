// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IVisionVault, IVisionVaultFactory} from "../interfaces/IVisionVault.sol";

contract VisionVaultFactory is IVisionVaultFactory {
    using Clones for address;

    address public immutable implementation;
    address public immutable vision;
    address public immutable usdc;
    uint256 public constant MAX_PERFORMANCE_FEE = 5000; // 50%

    address[] private _allVaults;
    mapping(address => address[]) private _managerVaults;
    mapping(address => bool) private _isVault;

    constructor(address _implementation, address _vision, address _usdc) {
        implementation = _implementation;
        vision = _vision;
        usdc = _usdc;
    }

    function createVault(
        string calldata name,
        string calldata symbol,
        uint256 performanceFeeRate,
        address manager
    ) external returns (address vault) {
        if (performanceFeeRate > MAX_PERFORMANCE_FEE) revert FeeTooHigh();

        vault = implementation.clone();
        IVisionVault(vault).initialize(name, symbol, manager, vision, usdc, performanceFeeRate);

        _allVaults.push(vault);
        _managerVaults[manager].push(vault);
        _isVault[vault] = true;

        emit VaultCreated(vault, manager, name, symbol, performanceFeeRate);
    }

    function getAllVaults() external view returns (address[] memory) { return _allVaults; }
    function getVaultsByManager(address manager) external view returns (address[] memory) { return _managerVaults[manager]; }
    function getVaultCount() external view returns (uint256) { return _allVaults.length; }
    function isRegisteredVault(address vault) external view returns (bool) { return _isVault[vault]; }
}
