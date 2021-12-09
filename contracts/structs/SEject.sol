// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

struct Order {
    int24 tickThreshold;
    bool ejectAbove;
    address receiver;
    address owner;
    uint256 maxFeeAmount;
    uint256 startTime;
}

struct OrderParams {
    uint256 tokenId;
    int24 tickThreshold;
    bool ejectAbove;
    address receiver;
    address feeToken;
    address resolver;
    uint256 maxFeeAmount;
}
