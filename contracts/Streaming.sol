// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "hardhat/console.sol";

contract Streaming {

    address public owner;
    
    mapping(uint256 => Stream) private streams;

    uint256 unlocked = 1;
    
    uint64 public streamIdCounter;

    modifier lock {
        require(unlocked == 1, "reentrancy is not allowed");
        unlocked = 0;
        _;
        unlocked = 1;
    }
    
    modifier onlySenderOrRecipient(uint256 _streamId) {
        require(
            msg.sender == streams[_streamId].sender || msg.sender == streams[_streamId].recipient,
            "caller is not the sender or the recipient of the stream"
        );
        _;
    }

    modifier onlyValidStreamId(uint256 _streamId) {
        require(_streamId > 0 && _streamId <= streamIdCounter, "streamId does not exist");
        _;
    }

    struct Stream {
        address recipient;
        address sender;
        uint256 deposit;
        uint256 startTime;
        uint256 stopTime;
        uint256 rate;
        uint256 balance;
    }
    
    event CreateStream(
        uint256 indexed streamId,
        address indexed sender,
        address indexed recipient,
        uint256 deposit,
        uint256 startTime,
        uint256 stopTime
    );

    event WithdrawFromStream(uint256 indexed streamId, address indexed recipient);
    event CancelStream(uint256 indexed streamId, address indexed recipient, address indexed sender, 
            uint256 deposit, uint256 balance);
    
    constructor() {
        owner  = msg.sender;
    }

    fallback() external payable {
        revert("Make sure you know what function you call");
    }

    receive() external payable {
        revert("Streaming does not accept donations");
    }
    
    function createStream(address recipient, uint256 deposit, uint256 startTime, uint256 stopTime) 
        external payable returns (uint256 streamId) {
        
        require(deposit == msg.value, "deposit does not match msg.value");//
        require(stopTime > startTime, "stopTime cannot be earlier than startTime");
        require(recipient != address(0x00), "Stream to the zero address");//
        require(recipient != address(this), "Stream to the contract itself");
        require(recipient != msg.sender, "Stream to the caller");//
        require(deposit > 0, "Deposit is equal to zero");//
        require(startTime >= block.timestamp, "Start time before block timestamp");//
        
        uint256 duration = stopTime - startTime;
        
        require(deposit % duration == 0, "Deposit is not a multiple of time delta");//
        
        streamIdCounter += 1;
        uint256 currentStreamId = streamIdCounter;
        
        // Rate Per second
        uint256 rate = deposit / duration;
        
        streams[currentStreamId] = Stream({
           balance: deposit,
           deposit: deposit,
           rate: rate,
           recipient: recipient,
           sender: msg.sender,
           startTime: startTime,
           stopTime: stopTime
        });
        
        emit CreateStream(currentStreamId, msg.sender, recipient, deposit, startTime, stopTime);
        return currentStreamId;
    }
    
    function balanceOf(uint256 _streamId, address who)  public view onlyValidStreamId(_streamId) returns (uint256 balance) {
        Stream memory stream = streams[_streamId];
        uint256 elapsedTime = elapsedTimeFor(_streamId);
        uint256 due = elapsedTime * stream.rate + stream.balance - stream.deposit;
        
        if (who == stream.recipient) {
            return due;
        } else if (who == stream.sender) {
            return stream.balance - due;
        } else {
            return 0;
        }
    }
        
        
    function elapsedTimeFor(uint256 streamId) private view returns (uint256) {
        Stream memory stream = streams[streamId];
        
        // Before the start of the stream
        if (block.timestamp <= stream.startTime) return 0;
        
        // During the stream
        if (block.timestamp < stream.stopTime) return block.timestamp - stream.startTime;
        
        // After the end of the stream
        return stream.stopTime - stream.startTime;
    }
    
    function withdrawFromStream(uint256 _streamId)  external onlyValidStreamId(_streamId)
        onlySenderOrRecipient(_streamId) {
        // console.log("enetering withdrawFromStream %s", msg.sender);
        Stream memory current_stream = streams[_streamId];
        require(current_stream.balance > 0, "streamId has zero balance");
        require(current_stream.startTime < block.timestamp, "startTime not reached yet");
        uint256 dueRecipient = balanceOf(_streamId, current_stream.recipient);
        // console.log("dueRecipient = %s", dueRecipient);
        require(dueRecipient > 0, "you need to wait a little to withdraw more");
        streams[_streamId].balance -= dueRecipient;
        (bool sent, ) = payable(current_stream.recipient).call{value: dueRecipient}("");
        require(sent, "in Streaming.withdrawFromStream(uint256) transaction did NOT go through");
        emit WithdrawFromStream(_streamId, current_stream.recipient);
    }

    function getStream(uint256 streamId)
        external
        view
        returns (
            address sender,
            address recipient,
            uint256 deposit,
            uint256 startTime,
            uint256 stopTime,
            uint256 rate,
            uint256 balance
        )
    {
        sender = streams[streamId].sender;
        recipient = streams[streamId].recipient;
        deposit = streams[streamId].deposit;
        startTime = streams[streamId].startTime;
        stopTime = streams[streamId].stopTime;
        rate = streams[streamId].rate;
        balance = streams[streamId].balance;
    }


    function cancelStream(uint256 _streamId) external onlyValidStreamId(_streamId)
    onlySenderOrRecipient(_streamId) lock {
        Stream memory current_stream = streams[_streamId];
        require(current_stream.balance > 0, "stream has already ended");
        uint256 dueRecipient = balanceOf(_streamId, current_stream.recipient);
        uint256 dueSender = balanceOf(_streamId, current_stream.sender);
        (bool sentRecipient, ) = payable(current_stream.recipient).call{value: dueRecipient}("");
        require(sentRecipient, "in Streaming.cancelStream(uint256) recipient transaction did NOT go through");
        (bool sentSender, ) = payable(current_stream.sender).call{value: dueSender}("");
        require(sentSender, "in Streaming.cancelStream(uint256) sender transaction did NOT go through");
        current_stream.balance = 0;
        streams[_streamId] = current_stream;
        emit CancelStream(_streamId, current_stream.recipient, current_stream.sender, 
            current_stream.deposit, streams[_streamId].balance);
    } 
}
