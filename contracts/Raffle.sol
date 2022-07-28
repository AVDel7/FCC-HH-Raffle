// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 curentBalance, uint256 numPlayers, uint256 raffleState);

/** @title A sample Raffle contract.
    @author Arthur Vieira
    @notice This contract is for creating an untampered decentralized smart contract.
    @dev  This implments Chainlkinks' VRFv2 and Keepers. 
    @dev  TODO - One flaw of this contract is it allows receiving more than 0.01 Eth, but the odds of winning are still the same.
*/
contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
  /* Type declarations */
  enum RaffleState {
    OPEN,
    CALCULATING // No new submissions allowed during calculation of new winner
  }

  // State variables
  uint256 private immutable i_entranceFee;
  VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
  bytes32 private immutable i_gasLane;
  uint64 private immutable i_subscriptionId;
  uint32 private immutable i_callbackGasLimit;
  uint16 private constant REQUEST_CONFIRMATIONS = 3;
  uint32 private constant NUM_WORDS = 1;
  address payable[] private s_players;
  uint256 private s_lastTimestamp;

  // Lottary Vars
  address private s_recentWinner;
  RaffleState private s_raffleState;
  uint256 private immutable i_interval;

  // Events
  event RaffleEntered(address indexed player);
  event RequestedRaffleWinner(uint256 indexedRequestID);
  event WinnerPicked(address indexedWinner);

  constructor(
    address vrfCoordinatorV2,
    uint256 entranceFee,
    bytes32 gasLane,
    uint64 subscritionID,
    uint32 callbackGasLimit,
    uint256 interval
  ) VRFConsumerBaseV2(vrfCoordinatorV2) {
    i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
    i_entranceFee = entranceFee;
    i_gasLane = gasLane;
    i_subscriptionId = subscritionID;
    i_callbackGasLimit = callbackGasLimit;
    s_raffleState = RaffleState.OPEN;
    s_lastTimestamp = block.timestamp;
    i_interval = interval;
  }

  /**
   * @notice Allows entering the raffle. A mininum ammount of ether is required to enter, called entranceFee.
   *         Use getEntranceFee() to check its value.
   */
  function enterRaffle() public payable {
    if (msg.value < i_entranceFee) {
      revert Raffle__NotEnoughETHEntered();
    }
    if (s_raffleState != RaffleState.OPEN) {
      revert Raffle__NotOpen();
    }
    s_players.push(payable(msg.sender));
    // Events
    emit RaffleEntered(msg.sender);
  }

  /**
   * @dev This is the function that the chinlink keeper nodes call to check if upkeep is needed.
   *      Meaning, the contract specifies when and how the Upkeep should be done.
   */
  function checkUpkeep(
    bytes memory /* checkData */
  )
    public
    view
    override
    returns (
      bool upkeepNeeded,
      bytes memory /* performData */
    )
  {
    bool isOpen = RaffleState.OPEN == s_raffleState;
    bool timePassed = ((block.timestamp - s_lastTimestamp) > i_interval);
    bool hasPlayers = s_players.length > 0;
    bool hasBalance = address(this).balance > 0;
    upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
    return (upkeepNeeded, "0x0"); // can we comment this out?
  }

  /**
   * @dev Once the the Keeper gets returned true from calling checkUpkeep(), the Keeper will call this function.
   * @dev In turn, this function will call the VRF requestRandomWords(), requesting a verified random number.
   */
  function performUpkeep(
    bytes calldata /* performData */
  ) external override {
    (bool upkeepNeeded, ) = checkUpkeep("");
    if (!upkeepNeeded) {
      revert Raffle__UpkeepNotNeeded(address(this).balance, s_players.length, uint256(s_raffleState));
    }
    s_raffleState = RaffleState.CALCULATING;
    uint256 requestId = i_vrfCoordinator.requestRandomWords(
      i_gasLane, // gasLane
      i_subscriptionId,
      REQUEST_CONFIRMATIONS,
      i_callbackGasLimit, // How much computation our fulfillRandomWords() is allowed to consume
      NUM_WORDS // How many random numbers to retrieve from the VRF
    );

    // In reality this is redundant!! As the VRF coordinator will emit the requestID within an event of its own.
    emit RequestedRaffleWinner(requestId);
  }

  /**
   * @dev When performUpkeep() calls the VRF requestRandonWords(), the VRF API will automatically call this function, 
   * passing the random numbers as parameters. At this point the winner is calculated and awarded the prize, and the 
   * contract is reset.
   */
  function fulfillRandomWords(
    uint256, /*requestID*/
    uint256[] memory randomWords
  ) internal override {
    uint256 indexOfWinner = randomWords[0] % s_players.length;
    address payable recentWinner = s_players[indexOfWinner];
    s_recentWinner = recentWinner;
    s_players = new address payable[](0); // Reset list of players
    s_raffleState = RaffleState.OPEN;
    s_lastTimestamp = block.timestamp; // Reset timestamp

    (bool success, ) = recentWinner.call{value: address(this).balance}("");
    if (!success) {
      revert Raffle__TransferFailed();
    }
    emit WinnerPicked(s_recentWinner);
  }

  /* View / Pure functions */
  function getEntranceFee() public view returns (uint256) {
    return i_entranceFee;
  }

  function getPlayer(uint256 index) public view returns (address) {
    return s_players[index];
  }

  function getRecentWinner() public view returns (address) {
    return s_recentWinner;
  }

  function getRaffleState() public view returns (RaffleState) {
    return s_raffleState;
  }

  function getNumPlayer() public view returns (uint256) {
    return s_players.length;
  }

  function getLatestTimestamp() public view returns (uint256) {
    return s_lastTimestamp;
  }

  function getNumWords() public pure returns (uint256) {
    return NUM_WORDS;
  }

  function getRequestConfirmations() public pure returns (uint256) {
    return REQUEST_CONFIRMATIONS;
  }

  function getInterval() public view returns (uint256) {
    return i_interval;
  }
}
