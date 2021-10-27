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
import {OrderParams} from "./structs/SEject.sol";

contract RangeOrder is IERC721Receiver {
    using SafeERC20 for IERC20;

    struct RangeOrderParams {
        address pool;
        bool zeroForOne;
        int24 tickThreshold;
        uint256 amountIn;
        uint256 minAmountOut;
        address receiver;
    }

    IEjectLP public immutable eject;

    constructor(IEjectLP _eject) {
        eject = _eject;
    }

    // solhint-disable-next-line function-max-lines
    function setRangeOrder(RangeOrderParams calldata _params) external {
        (, int24 tick, , , , , ) = IUniswapV3Pool(_params.pool).slot0();
        int24 tickSpacing = IUniswapV3Pool(_params.pool).tickSpacing();
        require(
            _params.tickThreshold % tickSpacing == 0,
            "threshold must be initializable tick"
        );
        int24 lowerTick = _params.zeroForOne
            ? _params.tickThreshold - tickSpacing
            : _params.tickThreshold;
        int24 upperTick = _params.zeroForOne
            ? _params.tickThreshold
            : _params.tickThreshold + tickSpacing;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");
        address token0 = IUniswapV3Pool(_params.pool).token0();
        address token1 = IUniswapV3Pool(_params.pool).token1();

        INonfungiblePositionManager positions = eject.nftPositions();
        (uint256 tokenId, , , ) = positions.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: IUniswapV3Pool(_params.pool).fee(),
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: _params.zeroForOne ? _params.amountIn : 0,
                amount1Desired: _params.zeroForOne ? 0 : _params.amountIn,
                amount0Min: _params.zeroForOne ? _params.amountIn : 0,
                amount1Min: _params.zeroForOne ? 0 : _params.amountIn,
                recipient: address(this),
                deadline: block.timestamp // solhint-disable-line not-rely-on-time
            })
        );
        positions.approve(address(eject), tokenId);
        eject.schedule(
            OrderParams({
                tokenId: tokenId,
                tickThreshold: _params.zeroForOne ? upperTick : lowerTick,
                ejectAbove: _params.zeroForOne,
                amount0Min: _params.zeroForOne ? 0 : _params.minAmountOut,
                amount1Min: _params.zeroForOne ? _params.minAmountOut : 0,
                receiver: _params.receiver,
                feeToken: _params.zeroForOne ? token1 : token0
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
