// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {
    INonfungiblePositionManager
} from "./vendor/INonfungiblePositionManager.sol";
import {IPokeMe} from "./IPokeMe.sol";
import {Order, OrderParams} from "./structs/SEject.sol";

interface IEjectLP {
    function cancel(uint256 tokenId_, Order memory order_) external;

    function schedule(OrderParams memory orderParams_) external payable;

    function ejectOrSettle(
        uint256 tokenId_,
        Order memory order_,
        bool isEjection_
    ) external;

    function factory() external view returns (address);

    function pokeMe() external view returns (IPokeMe);

    function nftPositionManager()
        external
        view
        returns (INonfungiblePositionManager);

    function isEjectable(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_,
        IUniswapV3Pool pool_
    ) external view returns (bool, string memory);

    function isExpired(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_
    ) external view returns (bool, string memory);
}
