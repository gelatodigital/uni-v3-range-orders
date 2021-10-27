// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {
    INonfungiblePositionManager,
    PoolAddress
} from "./vendor/INonfungiblePositionManager.sol";
import {
    IUniswapV3Factory
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {
    IERC721Receiver
} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {FullMath, LiquidityAmounts} from "./vendor/LiquidityAmounts.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {Order, OrderParams} from "./structs/SEject.sol";
import {RangeOrderParams} from "./structs/SRangeOrder.sol";

contract RangeOrder is IERC721Receiver {
    using SafeERC20 for IERC20;

    IEjectLP public immutable eject;

    constructor(IEjectLP eject_) {
        eject = eject_;
    }

    // solhint-disable-next-line function-max-lines
    function setRangeOrder(RangeOrderParams calldata params_) external {
        (, int24 tick, , , , , ) = IUniswapV3Pool(params_.pool).slot0();
        int24 tickSpacing = IUniswapV3Pool(params_.pool).tickSpacing();
        require(
            params_.tickThreshold % tickSpacing == 0,
            "threshold must be initializable tick"
        );
        int24 lowerTick = params_.zeroForOne
            ? params_.tickThreshold - tickSpacing
            : params_.tickThreshold;
        int24 upperTick = params_.zeroForOne
            ? params_.tickThreshold
            : params_.tickThreshold + tickSpacing;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");
        address token0 = IUniswapV3Pool(params_.pool).token0();
        address token1 = IUniswapV3Pool(params_.pool).token1();

        INonfungiblePositionManager positions = eject.nftPositions();
        (uint256 tokenId, , , ) = positions.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: IUniswapV3Pool(params_.pool).fee(),
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: params_.zeroForOne ? params_.amountIn : 0,
                amount1Desired: params_.zeroForOne ? 0 : params_.amountIn,
                amount0Min: params_.zeroForOne ? params_.amountIn : 0,
                amount1Min: params_.zeroForOne ? 0 : params_.amountIn,
                recipient: address(this),
                deadline: block.timestamp // solhint-disable-line not-rely-on-time
            })
        );
        positions.approve(address(eject), tokenId);
        eject.schedule(
            OrderParams({
                tokenId: tokenId,
                tickThreshold: params_.zeroForOne ? upperTick : lowerTick,
                ejectAbove: params_.zeroForOne,
                amount0Min: params_.zeroForOne ? 0 : params_.minAmountOut,
                amount1Min: params_.zeroForOne ? params_.minAmountOut : 0,
                receiver: params_.receiver,
                feeToken: params_.zeroForOne ? token1 : token0
            })
        );
    }

    function cancelRangeOrder(
        uint256 tokenId_,
        RangeOrderParams calldata params_
    ) external {
        (, int24 tick, , , , , ) = IUniswapV3Pool(params_.pool).slot0();
        int24 tickSpacing = IUniswapV3Pool(params_.pool).tickSpacing();

        int24 lowerTick = params_.zeroForOne
            ? params_.tickThreshold - tickSpacing
            : params_.tickThreshold;
        int24 upperTick = params_.zeroForOne
            ? params_.tickThreshold
            : params_.tickThreshold + tickSpacing;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");

        eject.cancel(
            tokenId_,
            Order({
                tickThreshold: params_.zeroForOne ? upperTick : lowerTick,
                ejectAbove: params_.zeroForOne,
                amount0Min: params_.zeroForOne ? 0 : params_.minAmountOut,
                amount1Min: params_.zeroForOne ? params_.minAmountOut : 0,
                receiver: params_.receiver,
                owner: address(this)
            })
        );
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
