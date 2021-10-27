// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.7;

interface IPokeMe {
    function createTaskNoPrepayment(
        address execAddress_,
        bytes4 execSelector_,
        address resolverAddress_,
        bytes calldata resolverData_,
        address feeToken_
    ) external returns (bytes32 task);

    function cancelTask(bytes32 taskId_) external;

    function getFeeDetails() external view returns (uint256, address);
}