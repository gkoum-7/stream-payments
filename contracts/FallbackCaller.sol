// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Streaming.sol";
import "hardhat/console.sol";

contract FallbackCaller {

    function RandomCall(address payable _streamingAddress) external payable {
        (bool success, ) = _streamingAddress.call{value: msg.value}(
            abi.encodeWithSignature("foo(string,uint256)", "call foo", 123)
        );
        require(success, "could not send tx");

    }
}


