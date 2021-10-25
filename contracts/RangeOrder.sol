// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { 
    INonfungiblePositionManager,
    PoolAddress
} from "./vendor/INonfungiblePositionManager.sol";
import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {
    FullMath,
    LiquidityAmounts
} from "./vendor/LiquidityAmounts.sol";
import { IEjectResolver } from "./IEjectResolver.sol";
import { IAutoEject } from "./IAutoEject.sol";

contract RangeOrderManager is IERC721Receiver {
    using SafeERC20 for IERC20;

    struct OrderParams {
        bool zeroForOne;
        int24 tickThreshold;
        uint256 amountIn;
        uint256 minAmountOut;
        address receiver;
    }

    IAutoEject public immutable autoEject;

    constructor(IAutoEject _autoEject) {
        autoEject = _autoEject;
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // solhint-disable-next-line function-max-lines
    function setRangeOrder(
        IUniswapV3Pool _pool,
        OrderParams calldata _order
    ) external {
        (, int24 tick, , , , , ) = _pool.slot0();
        INonfungiblePositionManager.MintParams memory params;
        IEjectResolver.Order memory _o;
        int24 tickSpacing = _pool.tickSpacing();
        require(_order.tickThreshold % tickSpacing == 0, "threshold must be initializable tick");
        int24 lowerTick =
            _order.zeroForOne ? _order.tickThreshold - tickSpacing : _order.tickThreshold;
        int24 upperTick =
            _order.zeroForOne ? _order.tickThreshold : _order.tickThreshold + tickSpacing;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");
        if (_order.zeroForOne) {
            address token0 = _pool.token0();
            IERC20(token0).safeTransferFrom(msg.sender, address(this), _order.amountIn);
            params = INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: _pool.token1(),
                fee: _pool.fee(),
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: _order.amountIn,
                amount1Desired: 0,
                amount0Min: _order.amountIn,
                amount1Min: 0,
                recipient: address(this),
                deadline: block.timestamp // solhint-disable-line not-rely-on-time
            });
            _o = IEjectResolver.Order({
                tickThreshold: upperTick,
                ejectAbove: true,
                amount0Min: 0,
                amount1Min: _order.minAmountOut,
                receiver: _order.receiver,
                owner: address(this)
            });
        } else {
            address token1 = _pool.token1();
            IERC20(token1).safeTransferFrom(msg.sender, address(this), _order.amountIn);
            params = INonfungiblePositionManager.MintParams({
                token0: _pool.token0(),
                token1: token1,
                fee: _pool.fee(),
                tickLower: lowerTick,
                tickUpper: upperTick,
                amount0Desired: 0,
                amount1Desired: _order.amountIn,
                amount0Min: 0,
                amount1Min: _order.amountIn,
                recipient: address(this),
                deadline: block.timestamp // solhint-disable-line not-rely-on-time
            });
            _o = IEjectResolver.Order({
                tickThreshold: lowerTick,
                ejectAbove: false,
                amount0Min: _order.minAmountOut,
                amount1Min: 0,
                receiver: _order.receiver,
                owner: address(this)
            });
        }
        INonfungiblePositionManager positions = autoEject.nftPositions();
        (uint256 tokenId,,,) = positions.mint(params);
        positions.approve(address(autoEject), tokenId);
        autoEject.schedule(
            tokenId,
            _o,
            _order.zeroForOne ? _pool.token1() : _pool.token0()
        );
    }
}