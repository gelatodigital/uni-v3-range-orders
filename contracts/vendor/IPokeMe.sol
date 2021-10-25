// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

interface IPokeMe {
    function createTaskNoPrepayment(
        address _execAddress,
        bytes4 _execSelector,
        address _resolverAddress,
        bytes calldata _resolverData,
        address _feeToken
    ) external returns (bytes32 task);

    function getFeeDetails() external view returns (uint256, address);
}