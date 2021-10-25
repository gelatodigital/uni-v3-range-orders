// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

import { IEjectResolver } from "./IEjectResolver.sol";
import { 
    INonfungiblePositionManager
} from "./vendor/INonfungiblePositionManager.sol";

interface IAutoEject {
    function cancel(uint256 _tokenId) external;
    function schedule(
        uint256 _tokenId,
        IEjectResolver.Order memory _order,
        address _feeToken
    ) external;
    function nftPositions() external view returns (INonfungiblePositionManager);
}