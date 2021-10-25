// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

import { IEjectResolver } from "./IEjectResolver.sol";
import { 
    INonfungiblePositionManager
} from "./vendor/INonfungiblePositionManager.sol";

interface IEjectLP {
    struct OrderParams {
        uint256 tokenId;
        int24 tickThreshold;
        bool ejectAbove;
        uint256 amount0Min; // @note: will NOT transfer token0 if amount0Min = 0
        uint256 amount1Min; // @note: will NOT transfer token1 if amount1Min = 0
        address receiver;
        address feeToken;
    }
    function cancel(uint256 _tokenId) external;
    function schedule(OrderParams memory _orderParams) external;
    function nftPositions() external view returns (INonfungiblePositionManager);
}