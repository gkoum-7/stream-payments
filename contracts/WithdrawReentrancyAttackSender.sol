// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Streaming.sol";
import "hardhat/console.sol";

contract WithdrawReentrancyAttackSender {
    Streaming streaming;
    address sender;
    address recipient;
    uint256 myStreamId;

    function prepareAttack(address payable _streamingAddress, 
            address _recipientAddress) external payable returns (uint256){
        streaming = Streaming(_streamingAddress);
        sender = address(this);
        recipient = _recipientAddress;
        uint256 val = msg.value;
        uint256 startTime = block.timestamp;
        myStreamId = streaming.createStream{value: val}(recipient, val, startTime, startTime + 10);
        return myStreamId;
    }

    function commenceAttack() external {
        streaming.withdrawFromStream(myStreamId);
    }
}