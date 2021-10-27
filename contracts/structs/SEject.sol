pragma solidity 0.8.7;

struct Order {
    int24 tickThreshold;
    bool ejectAbove;
    uint256 amount0Min; // @note: will NOT transfer token0 if amount0Min = 0
    uint256 amount1Min; // @note: will NOT transfer token1 if amount1Min = 0
    address receiver;
    address owner;
}

struct OrderParams {
    uint256 tokenId;
    int24 tickThreshold;
    bool ejectAbove;
    uint256 amount0Min; // @note: will NOT transfer token0 if amount0Min = 0
    uint256 amount1Min; // @note: will NOT transfer token1 if amount1Min = 0
    address receiver;
    address feeToken;
}
