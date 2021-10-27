pragma solidity 0.8.7;

import {IEjectResolver} from "./IEjectResolver.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {Order} from "./structs/SEject.sol";

contract EjectResolver is IEjectResolver {
    IEjectLP public immutable ejectLP;

    constructor(IEjectLP ejectLP_) {
        ejectLP = ejectLP_;
    }

    function checker(uint256 tokenId_, Order memory order_)
        external
        view
        override
        returns (bool, bytes memory data)
    {
        (, address feeToken) = ejectLP.pokeMe().getFeeDetails();

        try ejectLP.canEject(tokenId_, order_, feeToken) {
            return (
                true,
                abi.encodeWithSelector(
                    IEjectLP.eject.selector,
                    tokenId_,
                    order_
                )
            );
        } catch {
            return (
                false,
                abi.encodeWithSelector(
                    IEjectLP.eject.selector,
                    tokenId_,
                    order_
                )
            );
        }
    }
}
