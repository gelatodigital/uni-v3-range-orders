// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

struct RangeOrderParams {
    address pool;
    bool zeroForOne;
    bool ejectDust;
    int24 tickThreshold;
    uint256 amountIn;
    uint256 minAmountOut;
    address receiver;
    uint256 maxFeeAmount;
}
