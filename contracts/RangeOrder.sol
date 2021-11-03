// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {
    INonfungiblePositionManager
} from "./vendor/INonfungiblePositionManager.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    IERC721Receiver
} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IWETH9} from "./vendor/IWETH9.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {Order, OrderParams} from "./structs/SEject.sol";
import {RangeOrderParams} from "./structs/SRangeOrder.sol";

contract RangeOrder is IERC721Receiver {
    using SafeERC20 for IERC20;

    IEjectLP public immutable eject;
    IWETH9 public immutable WETH9; // solhint-disable-line var-name-mixedcase
    address public immutable ejectResolver;

    // solhint-disable-next-line var-name-mixedcase, func-param-name-mixedcase
    constructor(
        IEjectLP eject_,
        IWETH9 WETH9_, // solhint-disable-line var-name-mixedcase, func-param-name-mixedcase
        address ejectResolver_
    ) {
        eject = eject_;
        WETH9 = WETH9_;
        ejectResolver = ejectResolver_;
    }

    // solhint-disable-next-line function-max-lines
    function setRangeOrder(RangeOrderParams calldata params_) external payable {
        IUniswapV3Pool pool = IUniswapV3Pool(params_.pool);

        (, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();

        require(
            params_.tickThreshold % tickSpacing == 0,
            "threshold must be initializable tick"
        );

        int24 lowerTick = params_.zeroForOne
            ? params_.tickThreshold
            : params_.tickThreshold - tickSpacing;
        int24 upperTick = params_.zeroForOne
            ? params_.tickThreshold + tickSpacing
            : params_.tickThreshold;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");

        address token0 = pool.token0();
        address token1 = pool.token1();

        INonfungiblePositionManager positions = eject.nftPositions();

        IERC20 tokenIn = IERC20(params_.zeroForOne ? token0 : token1);

        if (msg.value > 0) {
            require(
                msg.value == params_.amountIn,
                "RangeOrder:setRangeOrder:: Invalid amount in."
            );
            require(
                address(tokenIn) == address(WETH9),
                "RangeOrder:setRangeOrder:: ETH range order should use WETH token."
            );

            WETH9.deposit{value: msg.value}();
        }
        else
            tokenIn.safeTransferFrom(msg.sender, address(this), params_.amountIn);

        tokenIn.safeApprove(address(positions), params_.amountIn);

        (uint256 tokenId, , , ) = positions.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: pool.fee(),
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
                tickThreshold: params_.zeroForOne ? lowerTick : upperTick,
                ejectAbove: params_.zeroForOne,
                ejectDust: params_.ejectDust,
                amount0Min: params_.zeroForOne ? 0 : params_.minAmountOut,
                amount1Min: params_.zeroForOne ? params_.minAmountOut : 0,
                receiver: params_.receiver,
                feeToken: params_.zeroForOne ? token1 : token0,
                resolver: ejectResolver,
                maxFeeAmount: params_.maxFeeAmount
            })
        );
    }

    function cancelRangeOrder(
        uint256 tokenId_,
        RangeOrderParams calldata params_
    ) external {
        IUniswapV3Pool pool = IUniswapV3Pool(params_.pool);
        (, int24 tick, , , , , ) = pool.slot0();
        int24 tickSpacing = pool.tickSpacing();

        int24 lowerTick = params_.zeroForOne
            ? params_.tickThreshold
            : params_.tickThreshold - tickSpacing;
        int24 upperTick = params_.zeroForOne
            ? params_.tickThreshold + tickSpacing
            : params_.tickThreshold;
        require(tick < lowerTick || tick > upperTick, "eject tick in range");

        eject.cancel(
            tokenId_,
            Order({
                tickThreshold: params_.zeroForOne ? lowerTick : upperTick,
                ejectAbove: params_.zeroForOne,
                ejectDust: params_.ejectDust,
                amount0Min: params_.zeroForOne ? 0 : params_.minAmountOut,
                amount1Min: params_.zeroForOne ? params_.minAmountOut : 0,
                receiver: params_.receiver,
                owner: address(this),
                maxFeeAmount: params_.maxFeeAmount
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
