// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IEjectResolver} from "./IEjectResolver.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {Order} from "./structs/SEject.sol";
import {_pool} from "./functions/FEjectLp.sol";

contract RangeOrderResolver is IEjectResolver {
    IEjectLP public immutable ejectLP;

    constructor(IEjectLP ejectLP_) {
        ejectLP = ejectLP_;
    }

    function checker(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_
    ) external view override returns (bool, bytes memory data) {
        (bool isExpired, ) = ejectLP.isExpired(tokenId_, order_, feeToken_);
        if (isExpired)
            return (
                true,
                abi.encodeWithSelector(
                    IEjectLP.ejectOrSettle.selector,
                    tokenId_,
                    order_,
                    false
                )
            );

        (
            ,
            ,
            address token0,
            address token1,
            uint24 feeTier,
            ,
            ,
            ,
            ,
            ,
            ,

        ) = ejectLP.nftPositions().positions(tokenId_);
        IUniswapV3Pool pool = _pool(ejectLP.factory(), token0, token1, feeTier);
        (bool isEjectable, ) = ejectLP.isEjectable(
            tokenId_,
            order_,
            feeToken_,
            pool
        );
        if (isEjectable)
            return (
                true,
                abi.encodeWithSelector(
                    IEjectLP.ejectOrSettle.selector,
                    tokenId_,
                    order_,
                    true
                )
            );

        return (false, "");
    }
}
