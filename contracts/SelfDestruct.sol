// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./Streaming.sol";
import "hardhat/console.sol";

contract SelfDestruct {

    receive() external payable { }

    function destroyMe(address payable _contractAddr) public {
        selfdestruct(_contractAddr);
    } 

}