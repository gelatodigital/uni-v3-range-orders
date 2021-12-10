// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;
pragma abicoder v2;

import {
    IUniswapV3Pool
} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IPokeMe} from "./IPokeMe.sol";
import {IEjectResolver} from "./IEjectResolver.sol";
import {IEjectLP} from "./IEjectLP.sol";
import {
    IERC20,
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {
    INonfungiblePositionManager,
    PoolAddress
} from "./vendor/INonfungiblePositionManager.sol";
import {
    Initializable
} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {Proxied} from "./vendor/hardhat-deploy/Proxied.sol";
import {
    ReentrancyGuardUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {
    PausableUpgradeable
} from "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import {
    AddressUpgradeable
} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {Order, OrderParams} from "./structs/SEject.sol";
import {ETH, OK} from "./constants/CEjectLP.sol";
import {_collect, _pool} from "./functions/FEjectLp.sol";

// BE CAREFUL: DOT NOT CHANGE THE ORDER OF INHERITED CONTRACT
contract EjectLP is
    Initializable,
    Proxied,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable,
    IEjectLP
{
    using SafeERC20 for IERC20;

    // solhint-disable-next-line max-line-length
    ////////////////////////////////////////// CONSTANTS AND IMMUTABLES ///////////////////////////////////

    INonfungiblePositionManager public immutable override nftPositions;
    IPokeMe public immutable override pokeMe;
    address public immutable override factory;
    address internal immutable _gelato;

    // !!!!!!!!!!!!!!!!!!!!!!!! DO NOT CHANGE ORDER !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    mapping(uint256 => bytes32) public hashById;
    mapping(uint256 => bytes32) public taskById;

    uint256 public duration;
    uint256 public minimumFee;
    // HERE YOU CAN ADD PROPERTIES!!!

    // !!!!!!!!!!!!!!!!!!!!!!!! EVENTS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    event LogSetEject(
        uint256 indexed tokenId,
        OrderParams orderParams,
        uint256 startTime,
        address sender
    );
    event LogEject(
        uint256 indexed tokenId,
        uint256 amount0Out,
        uint256 amount1Out,
        uint256 feeAmount,
        address receiver
    );
    event LogSettle(
        uint256 indexed tokenId,
        uint256 amount0Out,
        uint256 amount1Out,
        uint256 feeAmount,
        address receiver
    );
    event LogCancelEject(uint256 indexed tokenId);

    // !!!!!!!!!!!!!!!!!!!!!!!! MODIFIERS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    modifier onlyPokeMe() {
        require(
            msg.sender == address(pokeMe),
            "EjectLP::onlyPokeMe: only pokeMe"
        );
        _;
    }

    modifier isApproved(uint256 tokenId_) {
        require(
            nftPositions.getApproved(tokenId_) == address(this),
            "EjectLP::isApproved: EjectLP should be a operator"
        );
        _;
    }

    modifier onlyPositionOwner(uint256 tokenId_, address owner_) {
        require(
            nftPositions.ownerOf(tokenId_) == owner_,
            "EjectLP:schedule:: only owner"
        );
        _;
    }

    constructor(
        INonfungiblePositionManager nftPositions_,
        IPokeMe pokeMe_,
        address factory_,
        address gelato_
    ) {
        nftPositions = nftPositions_;
        factory = factory_;
        pokeMe = pokeMe_;
        _gelato = gelato_;
    }

    function initialize() external initializer {
        __ReentrancyGuard_init();
        __Pausable_init();

        duration = 7776000; /// @custom:duration period when the range order will be actif.
        minimumFee = 1000000000; /// @custom:minimumFee minimum equal to 1 Gwei.
    }

    // !!!!!!!!!!!!!!!!!!!!!!!! ADMIN FUNCTIONS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    function pause() external onlyProxyAdmin {
        _pause();
    }

    function unpause() external onlyProxyAdmin {
        _unpause();
    }

    function setDuration(uint256 duration_) external onlyProxyAdmin {
        duration = duration_;
    }

    function setMinimumFee(uint256 minimumFee_) external onlyProxyAdmin {
        minimumFee = minimumFee_;
    }

    function mulipleRetrieveDust(address[] calldata tokens_, address recipient_)
        external
        onlyProxyAdmin
    {
        for (uint256 i = 0; i < tokens_.length; i++) {
            retrieveDust(tokens_[i], recipient_);
        }
    }

    function retrieveDust(address token_, address recipient_)
        public
        onlyProxyAdmin
    {
        IERC20 token = IERC20(token_);
        uint256 balance = token.balanceOf(address(this));

        if (balance > 0) token.safeTransfer(recipient_, balance);
    }

    // !!!!!!!!!!!!!!!!!!!!!!!! EXTERNAL FUNCTIONS !!!!!!!!!!!!!!!!!!!!!!!!!!!!!

    function schedule(OrderParams memory orderParams_)
        external
        payable
        override
        whenNotPaused
        nonReentrant
        isApproved(orderParams_.tokenId)
        onlyPositionOwner(orderParams_.tokenId, msg.sender)
    {
        require(
            orderParams_.maxFeeAmount > minimumFee,
            "EjectLP::schedule: maxFeeAmount < minimumFee"
        );

        require(
            orderParams_.maxFeeAmount == msg.value,
            "EjectLP::schedule: maxFeeAmount !== msg.value"
        );

        Order memory order = Order({
            tickThreshold: orderParams_.tickThreshold,
            ejectAbove: orderParams_.ejectAbove,
            receiver: orderParams_.receiver,
            owner: msg.sender,
            maxFeeAmount: orderParams_.maxFeeAmount,
            startTime: block.timestamp
        });

        hashById[orderParams_.tokenId] = keccak256(abi.encode(order));
        taskById[orderParams_.tokenId] = pokeMe.createTaskNoPrepayment(
            address(this),
            this.ejectOrSettle.selector,
            orderParams_.resolver,
            abi.encodeWithSelector(
                IEjectResolver.checker.selector,
                orderParams_.tokenId,
                order,
                orderParams_.feeToken
            ),
            orderParams_.feeToken
        );

        emit LogSetEject(
            orderParams_.tokenId,
            orderParams_,
            block.timestamp,
            msg.sender
        );
    }

    function ejectOrSettle(
        uint256 tokenId_,
        Order memory order_,
        bool isEjection_
    ) external override whenNotPaused nonReentrant onlyPokeMe {
        if (isEjection_) _eject(tokenId_, order_);
        else _settleAtExpiry(tokenId_, order_);
    }

    // solhint-disable-next-line function-max-lines
    function cancel(uint256 tokenId_, Order memory order_)
        external
        override
        whenNotPaused
        nonReentrant
        isApproved(tokenId_)
        onlyPositionOwner(tokenId_, msg.sender)
    {
        require(
            hashById[tokenId_] == keccak256(abi.encode(order_)),
            "EjectLP::cancel: invalid hash"
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

        ) = nftPositions.positions(tokenId_);

        (, int24 tick, , , , , ) = _pool(factory, token0, token1, feeTier)
            .slot0();

        if (order_.ejectAbove) {
            require(tick < order_.tickThreshold, "EjectLP::cancel: price met");
        } else {
            require(tick > order_.tickThreshold, "EjectLP::cancel: price met");
        }

        pokeMe.cancelTask(taskById[tokenId_]);

        delete hashById[tokenId_];
        delete taskById[tokenId_];

        AddressUpgradeable.sendValue(
            payable(order_.receiver),
            order_.maxFeeAmount
        );

        emit LogCancelEject(tokenId_);
    }

    // solhint-disable-next-line function-max-lines
    function canEject(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_
    )
        public
        view
        isApproved(tokenId_)
        onlyPositionOwner(tokenId_, order_.owner)
        returns (uint128)
    {
        uint128 liquidity;
        IUniswapV3Pool pool;
        {
            address token0;
            address token1;
            uint24 feeTier;
            (, , token0, token1, feeTier, , , liquidity, , , , ) = nftPositions
                .positions(tokenId_);
            pool = _pool(factory, token0, token1, feeTier);
        }
        (bool isOk, string memory reason) = isEjectable(
            tokenId_,
            order_,
            feeToken_,
            pool
        );

        require(isOk, reason);

        return liquidity;
    }

    function isEjectable(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_,
        IUniswapV3Pool pool_
    )
        public
        view
        override
        isApproved(tokenId_)
        onlyPositionOwner(tokenId_, order_.owner)
        returns (bool, string memory)
    {
        if (hashById[tokenId_] != keccak256(abi.encode(order_)))
            return (false, "EjectLP::isEjectable: incorrect task hash");
        if (order_.startTime + duration <= block.timestamp)
            return (false, "EjectLP::isEjectable: range order expired");

        if (feeToken_ != ETH)
            return (false, "EjectLP::isEjectable: only native token");

        (, int24 tick, , , , , ) = pool_.slot0();
        int24 tickSpacing = pool_.tickSpacing();

        if (order_.ejectAbove && tick <= order_.tickThreshold + tickSpacing)
            return (false, "EjectLP::isEjectable: price not met");

        if (!order_.ejectAbove && tick >= order_.tickThreshold - tickSpacing)
            return (false, "EjectLP::isEjectable: price not met");

        return (true, OK);
    }

    function isExpired(
        uint256 tokenId_,
        Order memory order_,
        address feeToken_
    )
        public
        view
        override
        isApproved(tokenId_)
        onlyPositionOwner(tokenId_, order_.owner)
        returns (bool, string memory)
    {
        if (hashById[tokenId_] != keccak256(abi.encode(order_)))
            return (false, "EjectLP::isExpired: incorrect task hash");
        if (order_.startTime + duration > block.timestamp)
            return (false, "EjectLP::isExpired: not expired");
        if (feeToken_ != ETH)
            return (false, "EjectLP::isExpired: only native token");
        return (true, OK);
    }

    // solhint-disable-next-line function-max-lines
    function _eject(uint256 tokenId_, Order memory order_) internal {
        (uint256 feeAmount, address feeToken) = pokeMe.getFeeDetails();

        require(
            feeAmount <= order_.maxFeeAmount,
            "EjectLP::eject: fee > maxFeeAmount"
        );

        uint128 liquidity = canEject(tokenId_, order_, feeToken);

        (uint256 amount0, uint256 amount1) = _collectAndSend(
            tokenId_,
            order_,
            liquidity,
            feeAmount
        );

        emit LogEject(tokenId_, amount0, amount1, feeAmount, order_.receiver);
    }

    function _settleAtExpiry(uint256 tokenId_, Order memory order_)
        internal
    {
        (uint256 feeAmount, address feeToken) = pokeMe.getFeeDetails();

        (bool expired, string memory reason) = isExpired(
            tokenId_,
            order_,
            feeToken
        );
        require(expired, reason);

        (, , , , , , , uint128 liquidity, , , , ) = nftPositions.positions(
            tokenId_
        );

        (uint256 amount0, uint256 amount1) = _collectAndSend(
            tokenId_,
            order_,
            liquidity,
            feeAmount
        );

        emit LogSettle(tokenId_, amount0, amount1, feeAmount, order_.receiver);
    }

    function _collectAndSend(
        uint256 tokenId_,
        Order memory order_,
        uint128 liquidity_,
        uint256 feeAmount_
    ) internal returns (uint256 amount0, uint256 amount1) {
        (amount0, amount1) = _collect(
            nftPositions,
            tokenId_,
            liquidity_,
            order_.receiver
        );

        pokeMe.cancelTask(taskById[tokenId_]); // Cancel to desactivate the task.

        delete hashById[tokenId_];
        delete taskById[tokenId_];

        // gelato fee in native token
        AddressUpgradeable.sendValue(payable(_gelato), feeAmount_);
        if (feeAmount_ < order_.maxFeeAmount)
            AddressUpgradeable.sendValue(
                payable(order_.receiver),
                order_.maxFeeAmount - feeAmount_
            );
    }
}
