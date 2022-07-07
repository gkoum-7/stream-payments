// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Streaming.sol";
import "hardhat/console.sol";


contract WithdrawalReentrancyAttackReceiver {
    Streaming streaming;
    uint256 myStreamId;

    function prepareAttack(address payable _streamingAddress, uint256 _myStreamId) external {
        streaming = Streaming(_streamingAddress);
        myStreamId = _myStreamId;
    }
    
    receive() external payable {
        if (address(streaming).balance >= 1 ether) {
            streaming.withdrawFromStream(myStreamId);
        }
    }
}