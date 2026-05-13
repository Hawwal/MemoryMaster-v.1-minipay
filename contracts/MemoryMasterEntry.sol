// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MemoryMasterEntry
 * @notice Handles payments and on-chain game session recording for Memory Master
 * @dev Deployed on Celo Mainnet (chain 42220)
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
    address public usdtToken;
    uint256 public entryFee;

    // Payment tracking
    mapping(address => bool) public hasPaidEntry;
    uint256 public totalCollected;

    // ─── Game Session Recording ───────────────────────────────────────────────

    // Total number of game sessions ever recorded
    uint256 public totalSessions;

    // Per-wallet session count
    mapping(address => uint256) public playerSessionCount;

    // Per-wallet last played timestamp
    mapping(address => uint256) public playerLastPlayed;

    // ─── Events ──────────────────────────────────────────────────────────────

    event EntryPaid(address indexed player, uint256 amount, uint256 timestamp);
    event EntryConsumed(address indexed player, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount, uint256 timestamp);
    event EntryFeeUpdated(uint256 oldFee, uint256 newFee);

    // Emitted every time a player starts a game session — free or paid
    event GameSessionRecorded(
        address indexed player,
        uint256 sessionNumber,        // This player's nth session
        uint256 totalSessionsAllTime, // Global session counter
        uint256 timestamp
    );

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotOwner();
    error AlreadyPaid();
    error InsufficientAllowance(uint256 required, uint256 actual);
    error TransferFailed();
    error NoFundsToWithdraw();
    error ZeroAddress();
    error TooSoonToRecord(); // Prevents spam — min 30s between recordings

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _usdtToken, uint256 _entryFee) {
        if (_usdtToken == address(0)) revert ZeroAddress();
        owner = msg.sender;
        usdtToken = _usdtToken;
        entryFee = _entryFee;
    }

    // ─── Game Session Recording ───────────────────────────────────────────────

    /**
     * @notice Records a game session on-chain. Free to call — only costs gas.
     * @dev    Called by the frontend when a player starts a game.
     *         Creates an auditable record of every session for any wallet.
     *         Enforces a 30-second cooldown to prevent spam.
     */
    function recordPlay() external {
        // Prevent spam — must be at least 30 seconds since last recording
        if (
            playerLastPlayed[msg.sender] > 0 &&
            block.timestamp < playerLastPlayed[msg.sender] + 30
        ) {
            revert TooSoonToRecord();
        }

        // Increment counters
        totalSessions += 1;
        playerSessionCount[msg.sender] += 1;
        playerLastPlayed[msg.sender] = block.timestamp;

        emit GameSessionRecorded(
            msg.sender,
            playerSessionCount[msg.sender],
            totalSessions,
            block.timestamp
        );
    }

    /**
     * @notice Returns session stats for a given player.
     */
    function getPlayerStats(address player) external view returns (
        uint256 sessionCount,
        uint256 lastPlayed
    ) {
        return (
            playerSessionCount[player],
            playerLastPlayed[player]
        );
    }

    // ─── Payment Functions ────────────────────────────────────────────────────

    /**
     * @notice Pay the entry fee to unlock an extra-life session.
     */
    function payEntry() external {
        if (hasPaidEntry[msg.sender]) revert AlreadyPaid();

        IERC20 usdt = IERC20(usdtToken);

        uint256 allowed = usdt.allowance(msg.sender, address(this));
        if (allowed < entryFee) revert InsufficientAllowance(entryFee, allowed);

        bool success = usdt.transferFrom(msg.sender, address(this), entryFee);
        if (!success) revert TransferFailed();

        hasPaidEntry[msg.sender] = true;
        totalCollected += entryFee;

        emit EntryPaid(msg.sender, entryFee, block.timestamp);
    }

    /**
     * @notice Marks a player's paid session as consumed.
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

    // ─── Owner Functions ──────────────────────────────────────────────────────

    function withdraw() external onlyOwner {
        IERC20 usdt = IERC20(usdtToken);
        uint256 balance = usdt.balanceOf(address(this));
        if (balance == 0) revert NoFundsToWithdraw();
        bool success = usdt.transfer(owner, balance);
        if (!success) revert TransferFailed();
        emit FundsWithdrawn(owner, balance, block.timestamp);
    }

    function setEntryFee(uint256 newFee) external onlyOwner {
        emit EntryFeeUpdated(entryFee, newFee);
        entryFee = newFee;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
