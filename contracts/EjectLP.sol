// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {
    INonfungiblePositionManager,
    PoolAddress
} from "./vendor/INonfungiblePositionManager.sol";
import {IPokeMe} from "./IPokeMe.sol";
import {
    IUniswapV3Factory
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IEjectResolver} from "./IEjectResolver.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {Order, OrderParams} from "./structs/SEject.sol";

contract EjectLP is IEjectLP {
    address internal immutable _gelato;
    IEjectResolver internal immutable _resolver;
    IUniswapV3Factory internal immutable _factory;
    IPokeMe public immutable override pokeMe;
    INonfungiblePositionManager public immutable override nftPositions;

    mapping(uint256 => bytes32) public hashById;
    mapping(uint256 => bytes32) public taskById;
    event SetEject(OrderParams orderParams, address sender);
    event Eject(
        uint256 tokenId,
        uint256 amount0Out,
        uint256 amount1Out,
        uint256 feeAmount
    );
    event Cancel(uint256 tokenId);

    modifier onlyPokeMe() {
        require(msg.sender == address(pokeMe), "only pokeMe");
        _;
    }

    constructor(
        INonfungiblePositionManager nftPositions_,
        IUniswapV3Factory factory_,
        IPokeMe pokeMe_,
        IEjectResolver resolver_,
        address gelato_
    ) {
        pokeMe = pokeMe_;
        _factory = factory_;
        nftPositions = nftPositions_;
        _gelato = gelato_;
        _resolver = resolver_;
    }

    function schedule(OrderParams memory orderParams_) external override {
        require(
            nftPositions.ownerOf(orderParams_.tokenId) == msg.sender,
            "caller must be owner"
        );
        Order memory order = Order({
            tickThreshold: orderParams_.tickThreshold,
            ejectAbove: orderParams_.ejectAbove,
            amount0Min: orderParams_.amount0Min,
            amount1Min: orderParams_.amount1Min,
            receiver: orderParams_.receiver,
            owner: msg.sender
        });
        hashById[orderParams_.tokenId] = keccak256(abi.encode(order));
        taskById[orderParams_.tokenId] = pokeMe.createTaskNoPrepayment(
            address(this),
            this.eject.selector,
            address(_resolver),
            abi.encodeWithSelector(
                _resolver.checker.selector,
                orderParams_.tokenId,
                order
            ),
            orderParams_.feeToken
        );

        emit SetEject(orderParams_, msg.sender);
    }

    // solhint-disable-next-line function-max-lines
    function eject(uint256 tokenId_, Order memory order_)
        external
        override
        onlyPokeMe
    {
        (uint256 feeAmount, address feeToken) = pokeMe.getFeeDetails();
        (address token0, address token1, uint128 liquidity) = canEject(
            tokenId_,
            order_,
            feeToken
        );

        (uint256 amount0, uint256 amount1) = _collect(tokenId_, liquidity);

        if (feeToken == token0) {
            amount0 -= feeAmount;
        } else {
            amount1 -= feeAmount;
        }
        require(
            amount0 >= order_.amount0Min && amount1 >= order_.amount1Min,
            "received below minimum"
        );

        delete hashById[tokenId_];

        // handle payouts
        if (order_.amount0Min > 0 && amount0 > 0) {
            IERC20(token0).transfer(order_.receiver, amount0);
        } else {
            amount0 = 0;
        }
        if (order_.amount1Min > 0 && amount1 > 0) {
            IERC20(token1).transfer(order_.receiver, amount1);
        } else {
            amount1 = 0;
        }

        // gelato fee
        IERC20(feeToken).transfer(_gelato, feeAmount);

        emit Eject(tokenId_, amount0, amount1, feeAmount);
    }

    function cancel(uint256 tokenId_, Order memory order_) external override {
        require(msg.sender == nftPositions.ownerOf(tokenId_), "only owner");
        require(hashById[tokenId_] == keccak256(abi.encode(order_)));

        (
            ,
            ,
            address token0,
            address token1,
            uint24 feeTier,
            ,
            ,
            uint128 liquidity,
            ,
            ,
            ,
        ) = nftPositions.positions(tokenId_);

        (, int24 tick, , , , , ) = _pool(token0, token1, feeTier).slot0();

        if (order_.ejectAbove) {
            require(tick < order_.tickThreshold, "price met");
        } else {
            require(tick > order_.tickThreshold, "price met");
        }

        (uint256 amount0, uint256 amount1) = _collect(tokenId_, liquidity);

        if (amount0 > 0) {
            IERC20(token0).transfer(order_.receiver, amount0);
        }
        if (amount1 > 0) {
            IERC20(token1).transfer(order_.receiver, amount1);
        }

        pokeMe.cancelTask(taskById[tokenId_]);

        delete hashById[tokenId_];
        delete taskById[tokenId_];
    }

    // solhint-disable-next-line function-max-lines
    function canEject(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_
    )
        public
        view
        override
        returns (
            address,
            address,
            uint128
        )
    {
        require(
            order_.owner == nftPositions.ownerOf(tokenId_),
            "owner changed"
        );
        require(
            hashById[tokenId_] == keccak256(abi.encode(order_)),
            "incorrect task hash"
        );
        (
            ,
            address operator,
            address token0,
            address token1,
            uint24 feeTier,
            ,
            ,
            uint128 liquidity,
            ,
            ,
            ,

        ) = nftPositions.positions(tokenId_);
        require(operator == address(this), "contract must be approved");
        require(feeToken_ == token0 || feeToken_ == token1, "wrong fee token");

        (, int24 tick, , , , , ) = _pool(token0, token1, feeTier).slot0();
        if (order_.ejectAbove) {
            require(tick > order_.tickThreshold, "price not met");
        } else {
            require(tick < order_.tickThreshold, "price not met");
        }

        return (token0, token1, liquidity);
    }

    function _collect(uint256 tokenId_, uint128 liquidity_)
        internal
        returns (uint256 amount0, uint256 amount1)
    {
        nftPositions.decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: tokenId_,
                liquidity: liquidity_,
                amount0Min: 0,
                amount1Min: 0,
                deadline: block.timestamp // solhint-disable-line not-rely-on-time
            })
        );
        (amount0, amount1) = nftPositions.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: tokenId_,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
    }

    function _pool(
        address tokenIn_,
        address tokenOut_,
        uint24 fee_
    ) internal view returns (IUniswapV3Pool pool) {
        pool = IUniswapV3Pool(
            PoolAddress.computeAddress(
                address(_factory),
                PoolAddress.PoolKey({
                    token0: tokenIn_ < tokenOut_ ? tokenIn_ : tokenOut_,
                    token1: tokenIn_ < tokenOut_ ? tokenOut_ : tokenIn_,
                    fee: fee_
                })
            )
        );
    }
}
