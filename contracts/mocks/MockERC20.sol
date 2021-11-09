// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("RangeOrderTest", "ROTEST") {
        _mint(msg.sender, 1000000 ether);
    }
}