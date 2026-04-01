// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IVisionVault} from "../interfaces/IVisionVault.sol";
import {IERC7540Deposit, IERC7540Redeem} from "../interfaces/IERC7540.sol";
import {VisionVaultAccounting} from "../libraries/VisionVaultAccounting.sol";
import {IVision} from "../interfaces/IVision.sol";

/// @title VisionVault — ERC-7540 managed vault for Vision prediction market trading
/// @notice Async deposit/redeem with manager-only trading and performance fees.
///         Deployed as EIP-1167 minimal proxy — initialize() replaces constructor.
contract VisionVault is IVisionVault {
    using SafeERC20 for IERC20;

    uint256 private constant MAX_FEE = 5000; // 50%

    // ── ERC-20 storage (manual, since we're a clone) ─────────────────
    string private _vaultName;
    string private _vaultSymbol;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    uint256 private _totalSupply;

    // ── Vault core ───────────────────────────────────────────────────
    address public manager;
    address public vision;
    IERC20 public usdc;
    uint256 public performanceFeeRate;
    uint256 public highWaterMark;
    bool private _initialized;

    mapping(uint256 => uint256) public activeBatchDeposits;
    uint256 public totalActiveCapital;

    // ── Deposit requests ─────────────────────────────────────────────
    mapping(address => uint256) private _depositRequests;

    // ── Redeem queue (FIFO) ──────────────────────────────────────────
    struct QueuedRedeem {
        address owner;
        uint256 shares;
        bool fulfilled;
    }

    QueuedRedeem[] private _redeemQueue;
    uint256 private _queueHead;
    mapping(address => uint256) private _pendingRedeemShares;
    mapping(address => uint256) private _claimableAssets;
    uint256 private _totalClaimable;

    // ── Errors for sync 4626 blocks ─────────────────────────────────
    error SyncDisabled();

    // ── Modifiers ────────────────────────────────────────────────────

    modifier onlyManager() {
        if (msg.sender != manager) revert NotManager();
        _;
    }

    // ── Initialization ───────────────────────────────────────────────

    constructor() {
        // Implementation contract — mark initialized to prevent direct use
        _initialized = true;
    }

    function initialize(
        string calldata name_,
        string calldata symbol_,
        address manager_,
        address vision_,
        address usdc_,
        uint256 performanceFeeRate_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (performanceFeeRate_ > MAX_FEE) revert FeeTooHigh();
        _initialized = true;

        _vaultName = name_;
        _vaultSymbol = symbol_;
        manager = manager_;
        vision = vision_;
        usdc = IERC20(usdc_);
        performanceFeeRate = performanceFeeRate_;
        highWaterMark = 1e18;

        // Approve Vision to pull USDC from vault for joinBatchDirect
        IERC20(usdc_).approve(vision_, type(uint256).max);
    }

    // ── ERC-20 implementation ────────────────────────────────────────

    function name() external view returns (string memory) {
        return _vaultName;
    }

    function symbol() external view returns (string memory) {
        return _vaultSymbol;
    }

    function decimals() external pure returns (uint8) {
        return 18;
    }

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner_, address spender) external view returns (uint256) {
        return _allowances[owner_][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = _allowances[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ERC20: insufficient allowance");
            _allowances[from][msg.sender] = allowed - amount;
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0) && to != address(0), "ERC20: zero address");
        require(_balances[from] >= amount, "ERC20: insufficient balance");
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
    }

    function _mint(address to, uint256 amount) internal {
        _totalSupply += amount;
        _balances[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        require(_balances[from] >= amount, "ERC20: insufficient balance");
        _balances[from] -= amount;
        _totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    // ── ERC-4626 view functions ──────────────────────────────────────

    function asset() external view returns (address) {
        return address(usdc);
    }

    function totalAssets() public view returns (uint256) {
        return usdc.balanceOf(address(this)) + totalActiveCapital;
    }

    function idleUSDC() public view returns (uint256) {
        uint256 balance = usdc.balanceOf(address(this));
        return balance > _totalClaimable ? balance - _totalClaimable : 0;
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return VisionVaultAccounting.sharesForDeposit(assets, totalAssets(), _totalSupply);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return VisionVaultAccounting.assetsForRedeem(shares, totalAssets(), _totalSupply);
    }

    function maxDeposit(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) external pure returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address) external pure returns (uint256) {
        return 0;
    }

    function maxRedeem(address) external pure returns (uint256) {
        return 0;
    }

    function previewDeposit(uint256) external pure returns (uint256) {
        return 0;
    }

    function previewMint(uint256) external pure returns (uint256) {
        return 0;
    }

    function previewWithdraw(uint256) external pure returns (uint256) {
        return 0;
    }

    function previewRedeem(uint256) external pure returns (uint256) {
        return 0;
    }

    // ── Block synchronous 4626 operations ────────────────────────────

    function deposit(uint256, address) external pure returns (uint256) {
        revert SyncDisabled();
    }

    function mint(uint256, address) external pure returns (uint256) {
        revert SyncDisabled();
    }

    function withdraw(uint256, address, address) external pure returns (uint256) {
        revert SyncDisabled();
    }

    function redeem(uint256, address, address) external pure returns (uint256) {
        revert SyncDisabled();
    }

    // ── ERC-7540 Deposit ─────────────────────────────────────────────

    function requestDeposit(uint256 assets, address controller, address owner) external returns (uint256) {
        require(assets > 0, "VisionVault: zero deposit");
        require(msg.sender == owner || msg.sender == controller, "VisionVault: unauthorized");

        usdc.safeTransferFrom(msg.sender, address(this), assets);
        _depositRequests[controller] += assets;

        emit DepositRequest(controller, owner, 0, msg.sender, assets);
        return 0;
    }

    function pendingDepositRequest(uint256, address controller) external view returns (uint256) {
        return _depositRequests[controller];
    }

    function claimDeposit(address receiver, address controller) external returns (uint256 shares) {
        require(msg.sender == controller, "VisionVault: unauthorized");
        uint256 assets = _depositRequests[controller];
        require(assets > 0, "VisionVault: no pending deposit");

        _depositRequests[controller] = 0;

        // Use totalAssets minus the pending deposit to avoid counting it twice
        uint256 existingAssets = totalAssets() - assets;
        shares = VisionVaultAccounting.sharesForDeposit(assets, existingAssets, _totalSupply);

        _mint(receiver, shares);

        emit DepositClaimed(receiver, assets, shares);
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }

    // ── ERC-7540 Redeem ──────────────────────────────────────────────

    function requestRedeem(uint256 shares, address controller, address owner) external returns (uint256) {
        require(shares > 0, "VisionVault: zero redeem");
        require(msg.sender == owner || msg.sender == controller, "VisionVault: unauthorized");

        // Transfer shares from owner to vault (locks them)
        _transfer(owner, address(this), shares);

        uint256 assetsValue = VisionVaultAccounting.assetsForRedeem(shares, totalAssets(), _totalSupply);
        uint256 idle = idleUSDC();

        if (idle >= assetsValue) {
            // Immediate fulfillment: burn shares, mark claimable
            _burn(address(this), shares);
            _claimableAssets[controller] += assetsValue;
            _totalClaimable += assetsValue;
        } else {
            // Queue for later
            _pendingRedeemShares[controller] += shares;
            _redeemQueue.push(QueuedRedeem({
                owner: controller,
                shares: shares,
                fulfilled: false
            }));
        }

        emit RedeemRequest(controller, owner, 0, msg.sender, shares);
        return 0;
    }

    function pendingRedeemRequest(uint256, address controller) external view returns (uint256) {
        return _pendingRedeemShares[controller];
    }

    function claimRedeem(address receiver, address controller) external returns (uint256 assets) {
        require(msg.sender == controller, "VisionVault: unauthorized");
        assets = _claimableAssets[controller];
        if (assets == 0) revert NothingToClaim();

        _claimableAssets[controller] = 0;
        _totalClaimable -= assets;

        usdc.safeTransfer(receiver, assets);

        emit WithdrawClaimed(receiver, assets, 0);
        emit Withdraw(msg.sender, receiver, controller, assets, 0);
        return assets;
    }

    // ── Manager Trading ──────────────────────────────────────────────

    function joinBatch(
        uint256 batchId,
        bytes32 configHash,
        uint256 depositAmount,
        uint256 stakePerTick,
        bytes32 bitmapHash
    ) external onlyManager {
        if (depositAmount > idleUSDC()) revert InsufficientIdleCapital();

        IVision(vision).joinBatchDirect(batchId, configHash, depositAmount, stakePerTick, bitmapHash);

        activeBatchDeposits[batchId] = depositAmount;
        totalActiveCapital += depositAmount;

        emit BatchJoined(batchId, depositAmount);
    }

    function updateBitmap(uint256 batchId, bytes32 configHash, bytes32 newBitmapHash) external onlyManager {
        IVision(vision).updateBitmap(batchId, configHash, newBitmapHash);
        emit BitmapUpdated(batchId, newBitmapHash);
    }

    // ── Reconciliation ───────────────────────────────────────────────

    function reconcile(uint256 batchId) external {
        uint256 deposited = activeBatchDeposits[batchId];
        if (deposited == 0) revert BatchAlreadyReconciled();

        // Clear active tracking
        activeBatchDeposits[batchId] = 0;
        totalActiveCapital -= deposited;

        uint256 feeSharesMinted = 0;
        if (_totalSupply > 0) {
            uint256 currentNav = VisionVaultAccounting.navPerShare(totalAssets(), _totalSupply);

            if (currentNav > highWaterMark && performanceFeeRate > 0) {
                feeSharesMinted = VisionVaultAccounting.performanceFeeShares(
                    currentNav, highWaterMark, _totalSupply, performanceFeeRate
                );
                if (feeSharesMinted > 0) {
                    _mint(manager, feeSharesMinted);
                }
                highWaterMark = currentNav;
            } else if (currentNav > highWaterMark) {
                highWaterMark = currentNav;
            }
        }

        uint256 fulfilled = _sweepRedeemQueue();

        emit Reconciled(batchId, 0, feeSharesMinted, fulfilled);
    }

    // ── Internal ─────────────────────────────────────────────────────

    function _sweepRedeemQueue() internal returns (uint256 fulfilled) {
        uint256 head = _queueHead;
        uint256 len = _redeemQueue.length;

        while (head < len) {
            QueuedRedeem storage req = _redeemQueue[head];
            if (req.fulfilled) {
                head++;
                continue;
            }

            uint256 assetsValue = VisionVaultAccounting.assetsForRedeem(
                req.shares, totalAssets(), _totalSupply
            );
            uint256 idle = idleUSDC();

            if (idle < assetsValue) break;

            // Fulfill this request
            req.fulfilled = true;
            _pendingRedeemShares[req.owner] -= req.shares;
            _burn(address(this), req.shares);
            _claimableAssets[req.owner] += assetsValue;
            _totalClaimable += assetsValue;

            fulfilled++;
            head++;
        }

        _queueHead = head;
    }
}
