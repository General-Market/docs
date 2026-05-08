// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title ITPVault — ERC20 wrapper representing an L3-direct ITP's shares.
/// @notice Minted/burned exclusively by the Index contract. Used as the
///         collateralToken for the ITP's Morpho lending market.
/// @dev Constructor signature is fixed: curator's MarketDeployer auto-deploys
///      this contract for any ITP whose `Index.itpVaults(itpId) == address(0)`.
///      The 5-arg shape (itpId, indexContract, name, symbol, asset) must not
///      change without also updating curator/src/market_deployer.rs.
contract ITPVault is ERC20 {
    error ONLY_INDEX();

    bytes32 public immutable itpId;
    address public immutable indexContract;
    address public immutable asset;

    modifier onlyIndex() {
        if (msg.sender != indexContract) revert ONLY_INDEX();
        _;
    }

    constructor(
        bytes32 _itpId,
        address _indexContract,
        string memory _name,
        string memory _symbol,
        address _asset
    ) ERC20(_name, _symbol) {
        itpId = _itpId;
        indexContract = _indexContract;
        asset = _asset;
    }

    function mint(address to, uint256 amount) external onlyIndex {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyIndex {
        _burn(from, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
