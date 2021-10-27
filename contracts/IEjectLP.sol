// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

import {
    INonfungiblePositionManager
} from "./vendor/INonfungiblePositionManager.sol";
import {IPokeMe} from "./IPokeMe.sol";
import {Order, OrderParams} from "./structs/SEject.sol";

interface IEjectLP {
    function cancel(uint256 _tokenId) external;

    function schedule(OrderParams memory _orderParams) external;

    function eject(uint256 _tokenId, Order memory _order) external;

    function pokeMe() external view returns (IPokeMe);

    function nftPositions() external view returns (INonfungiblePositionManager);

    function canEject(
        uint256 _tokenId,
        Order memory _order,
        address _feeToken
    )
        external
        view
        returns (
            address,
            address,
            uint128
        );
}
