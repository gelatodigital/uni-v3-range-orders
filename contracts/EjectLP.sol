// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import { IUniswapV3Pool } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import { 
    INonfungiblePositionManager,
    PoolAddress
} from "./vendor/INonfungiblePositionManager.sol";
import { IPokeMe } from "./IPokeMe.sol";
import { IUniswapV3Factory } from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IEjectResolver } from "./IEjectResolver.sol";
import { IEjectLP } from "./IEjectLP.sol";

contract EjectLP is IEjectLP {
    address public immutable gelato;
    IEjectResolver public immutable resolver;
    IPokeMe public immutable pokeMe;
    INonfungiblePositionManager public immutable override nftPositions;
    IUniswapV3Factory public immutable factory;

    mapping(uint256 => bytes32) public hashById;
    event SetEject(IEjectResolver.Order order);
    event Eject(uint256 tokenId, uint256 amount0Out, uint256 amount1Out, uint256 feeAmount);

    modifier onlyPokeMe() {
        require(msg.sender == address(pokeMe), "only pokeMe");
        _;
    }

    constructor(
        INonfungiblePositionManager _nftPositions,
        IUniswapV3Factory _factory,
        IPokeMe _pokeMe,
        IEjectResolver _resolver,
        address _gelato
    ) {
        pokeMe = _pokeMe;
        factory = _factory;
        nftPositions = _nftPositions;
        gelato = _gelato;
        resolver = _resolver;
    }

    function schedule(OrderParams memory _orderParams) external override {
        require(nftPositions.ownerOf(_orderParams.tokenId) == msg.sender, "caller must be owner");
        IEjectResolver.Order memory order = IEjectResolver.Order({
            tickThreshold: _orderParams.tickThreshold,
            ejectAbove: _orderParams.ejectAbove,
            amount0Min: _orderParams.amount0Min,
            amount1Min: _orderParams.amount1Min,
            receiver: _orderParams.receiver,
            owner: msg.sender
        });
        hashById[_orderParams.tokenId] = keccak256(abi.encode(order));
        pokeMe.createTaskNoPrepayment(
            address(this),
            this.eject.selector,
            address(resolver),
            abi.encodeWithSelector(
                resolver.checker.selector,
                _orderParams.tokenId,
                order
            ),
            _orderParams.feeToken
        );
        emit SetEject(order);
    }

    // solhint-disable-next-line function-max-lines
    function eject(
        uint256 _tokenId,
        IEjectResolver.Order memory _order
    ) external onlyPokeMe {
        (uint256 feeAmount, address feeToken) = pokeMe.getFeeDetails();
        (address token0, address token1, uint128 liquidity) = _canEject(
            _tokenId,
            _order,
            feeToken
        );

        (uint256 amount0, uint256 amount1) = _collect(
            _tokenId,
            liquidity
        );

        if (feeToken == token0) {
            amount0 -= feeAmount;
        } else {
            amount1 -= feeAmount;
        }
        require(
            amount0 >= _order.amount0Min && amount1 >= _order.amount1Min,
            "received below minimum"
        );
        
        delete hashById[_tokenId];

        // handle payouts
        if (_order.amount0Min > 0 && amount0 > 0) {
            IERC20(token0).transfer(_order.receiver, amount0);
        } else {
            amount0 = 0;
        }
        if (_order.amount1Min > 0 && amount1 > 0) {
            IERC20(token1).transfer(_order.receiver, amount1);
        } else {
            amount1 = 0;
        }

        // gelato fee
        IERC20(feeToken).transfer(gelato, feeAmount);

        emit Eject(_tokenId, amount0, amount1, feeAmount);
    }

    function cancel(uint256 _tokenId) external override {
        require(msg.sender == nftPositions.ownerOf(_tokenId), "only owner");
        delete hashById[_tokenId];
        // TODO: pokeMe.cancelTask();
    }

    function _collect(
        uint256 _tokenId,
        uint128 _liquidity
    ) internal returns(uint256 amount0, uint256 amount1) {
        nftPositions.decreaseLiquidity(INonfungiblePositionManager.DecreaseLiquidityParams({
            tokenId: _tokenId,
            liquidity: _liquidity,
            amount0Min: 0,
            amount1Min: 0,
            deadline: block.timestamp // solhint-disable-line not-rely-on-time
        }));
        (amount0, amount1) = 
            nftPositions.collect(INonfungiblePositionManager.CollectParams({
                tokenId: _tokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            }));
    }

    function _canEject(
        uint256 _tokenId,
        IEjectResolver.Order memory _order,
        address _feeToken
    ) internal view returns (address, address, uint128) {
        require(_order.owner == nftPositions.ownerOf(_tokenId), "owner changed");
        require(hashById[_tokenId] == keccak256(abi.encode(_order)), "incorrect task hash"); 
        (   
            ,address operator,
            address token0,
            address token1,
            uint24 feeTier,,,
            uint128 liquidity,,,,
        ) = nftPositions.positions(_tokenId);
        require(operator == address(this), "contract must be approved");
        require(_feeToken == token0 || _feeToken == token1, "wrong fee token");

        IUniswapV3Pool pool = _pool(token0, token1, feeTier);
        (, int24 tick, , , , , ) = pool.slot0();
        if (_order.ejectAbove) {
            require(tick > _order.tickThreshold, "price not met");
        } else {
            require(tick < _order.tickThreshold, "price not met");
        }

        return (token0, token1, liquidity);
    }

    function _pool(
        address tokenIn,
        address tokenOut,
        uint24 fee
    ) internal view returns (IUniswapV3Pool pool) {
        pool = IUniswapV3Pool(PoolAddress.computeAddress(
            address(factory),
            PoolAddress.PoolKey({
                token0: tokenIn < tokenOut ? tokenIn : tokenOut,
                token1: tokenIn < tokenOut ? tokenOut : tokenIn,
                fee: fee
            })
        ));
    }
}