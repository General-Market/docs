// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IBridgedItpFactory} from "../interfaces/IBridgedItpFactory.sol";
import {BridgedITP} from "./BridgedITP.sol";

/// @title BridgedItpFactory - Deploys BridgedITP tokens via CREATE2
/// @notice Only callable by BridgeProxy
/// @custom:security-contact security@indexprotocol.com
contract BridgedItpFactory is IBridgedItpFactory {
    error ONLY_BRIDGE_PROXY();
    error ALREADY_DEPLOYED();

    address public immutable override bridgeProxy;

    /// @notice orbitItpId => deployed BridgedITP address
    mapping(bytes32 => address) public override deployedItps;

    constructor(address _bridgeProxy) {
        bridgeProxy = _bridgeProxy;
    }

    function deployBridgedItp(
        string calldata name,
        string calldata symbol,
        bytes32 orbitItpId
    ) external override returns (address bridgedItp) {
        if (msg.sender != bridgeProxy) revert ONLY_BRIDGE_PROXY();
        if (deployedItps[orbitItpId] != address(0)) revert ALREADY_DEPLOYED();

        // CREATE2 with orbitItpId as salt
        bridgedItp = address(
            new BridgedITP{salt: orbitItpId}(name, symbol, orbitItpId, bridgeProxy)
        );

        deployedItps[orbitItpId] = bridgedItp;

        emit BridgedItpDeployed(orbitItpId, bridgedItp, name, symbol);
    }

    function computeAddress(
        string calldata name,
        string calldata symbol,
        bytes32 orbitItpId
    ) external view override returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(BridgedITP).creationCode,
                abi.encode(name, symbol, orbitItpId, bridgeProxy)
            )
        );

        return address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(bytes1(0xff), address(this), orbitItpId, bytecodeHash)
                    )
                )
            )
        );
    }
}
