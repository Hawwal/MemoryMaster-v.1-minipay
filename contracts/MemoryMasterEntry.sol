// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMasterEntry
 * @notice Handles 0.1 USDT entry fee payments for Memory Master game on Celo Mainnet
 * @dev Accepts ERC20 USDT transfers and tracks which wallets have paid to play
 */

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract MemoryMasterEntry {

    // ─── State ───────────────────────────────────────────────────────────────

    address public owner;
    address public usdtToken;       // USDT contract on Celo Mainnet
    uint256 public entryFee;        // In USDT units (6 decimals → 100000 = 0.1 USDT)

    // Tracks whether a player has a valid paid session
    mapping(address => bool) public hasPaidEntry;

    // Total fees collected
    uint256 public totalCollected;

    // ─── Events ──────────────────────────────────────────────────────────────

    event EntryPaid(address indexed player, uint256 amount, uint256 timestamp);
    event EntryConsumed(address indexed player, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    event EntryFeeUpdated(uint256 oldFee, uint256 newFee);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotOwner();
    error AlreadyPaid();
    error InsufficientAllowance(uint256 required, uint256 actual);
    error TransferFailed();
    error NoFundsToWithdraw();
    error ZeroAddress();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @param _usdtToken  Address of USDT token on Celo Mainnet
     *                    (0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e)
     * @param _entryFee   Entry fee in USDT smallest units
     *                    (100000 = 0.1 USDT, since USDT has 6 decimals)
     */
    constructor(address _usdtToken, uint256 _entryFee) {
        if (_usdtToken == address(0)) revert ZeroAddress();
        owner = msg.sender;
        usdtToken = _usdtToken;
        entryFee = _entryFee;
    }

    // ─── Core Functions ──────────────────────────────────────────────────────

    /**
     * @notice Player calls this to pay the entry fee and unlock a game session.
     * @dev    Player must first approve this contract to spend `entryFee` USDT.
     *         Call USDT.approve(contractAddress, entryFee) from the frontend first.
     */
    function payEntry() external {
        if (hasPaidEntry[msg.sender]) revert AlreadyPaid();

        IERC20 usdt = IERC20(usdtToken);

        // Check allowance
        uint256 allowed = usdt.allowance(msg.sender, address(this));
        if (allowed < entryFee) revert InsufficientAllowance(entryFee, allowed);

        // Pull USDT from player into this contract
        bool success = usdt.transferFrom(msg.sender, address(this), entryFee);
        if (!success) revert TransferFailed();

        hasPaidEntry[msg.sender] = true;
        totalCollected += entryFee;

        emit EntryPaid(msg.sender, entryFee, block.timestamp);
    }

    /**
     * @notice Marks a player's session as consumed (called after game ends).
     * @dev    Can only be called by the owner (your backend/server wallet) to
     *         prevent players from reusing a single payment indefinitely.
     *         If you want players to call this themselves, remove onlyOwner.
     */
    function consumeEntry(address player) external onlyOwner {
        hasPaidEntry[player] = false;
        emit EntryConsumed(player, block.timestamp);
    }

    /**
     * @notice Check if a player has a valid paid session.
     */
    function canPlay(address player) external view returns (bool) {
        return hasPaidEntry[player];
    }

    // ─── Owner Functions ─────────────────────────────────────────────────────

    /**
     * @notice Withdraw all collected USDT to the owner wallet.
     */
    function withdraw() external onlyOwner {
        IERC20 usdt = IERC20(usdtToken);
        uint256 balance = usdt.balanceOf(address(this));
        if (balance == 0) revert NoFundsToWithdraw();

        bool success = usdt.transfer(owner, balance);
        if (!success) revert TransferFailed();

        emit FundsWithdrawn(owner, balance, block.timestamp);
    }

    /**
     * @notice Update the entry fee.
     */
    function setEntryFee(uint256 newFee) external onlyOwner {
        emit EntryFeeUpdated(entryFee, newFee);
        entryFee = newFee;
    }

    /**
     * @notice Transfer contract ownership.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
