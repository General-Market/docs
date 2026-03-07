// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IBridgedITP} from "../interfaces/IBridgedITP.sol";

/// @title BridgedITP - ERC20 representation of an L3 ITP on Settlement
/// @notice Mint/burn controlled exclusively by BridgeProxy
/// @custom:security-contact security@indexprotocol.com
contract BridgedITP is ERC20, IBridgedITP {
    error ONLY_BRIDGE_PROXY();

    bytes32 public immutable override orbitItpId;
    address public immutable override bridgeProxy;

    modifier onlyBridgeProxy() {
        if (msg.sender != bridgeProxy) revert ONLY_BRIDGE_PROXY();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        bytes32 _orbitItpId,
        address _bridgeProxy
    ) ERC20(_name, _symbol) {
        orbitItpId = _orbitItpId;
        bridgeProxy = _bridgeProxy;
    }

    function mint(address to, uint256 amount) external override onlyBridgeProxy {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external override onlyBridgeProxy {
        _burn(from, amount);
    }

    function decimals() public pure override(ERC20) returns (uint8) {
        return 18;
    }
}
