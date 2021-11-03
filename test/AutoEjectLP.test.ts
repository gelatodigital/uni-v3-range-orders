import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";
import hre = require("hardhat");
import {
  EjectLP,
  IERC20,
  IPokeMe,
  IUniswapV3Factory,
  IUniswapV3Pool,
  RangeOrder,
  RangeOrderResolver,
} from "../typechain";
import { Addresses, getAddresses } from "../src/addresses";
import { ISwapRouter } from "../typechain/ISwapRouter";
import { IWETH9 } from "../typechain/IWETH9";

const { ethers, deployments } = hre;

describe("Auto eject Integration Test", function () {
  this.timeout(0);

  let user: Signer;

  let ejectPL: EjectLP;
  let rangeOrder: RangeOrder;
  let rangeOrderResolver: RangeOrderResolver;
  let factory: IUniswapV3Factory;
  let swapRouter: ISwapRouter;
  let pokeMe: IPokeMe;

  let weth: IWETH9;
  let dai: IERC20;

  let addresses: Addresses;

  beforeEach("Eject", async function () {
    if (hre.network.name !== "hardhat") {
      console.error("Test Suite is meant to be run on hardhat only");
      process.exit(1);
    }

    addresses = getAddresses(hre.network.name);
    await deployments.fixture();

    [user] = await ethers.getSigners();

    ejectPL = (await ethers.getContract("EjectLP")) as EjectLP;
    rangeOrder = (await ethers.getContract("RangeOrder")) as RangeOrder;
    rangeOrderResolver = (await ethers.getContract(
      "RangeOrderResolver"
    )) as RangeOrderResolver;
    factory = (await ethers.getContractAt(
      "IUniswapV3Factory",
      addresses.UniswapV3Factory,
      user
    )) as IUniswapV3Factory;

    weth = (await ethers.getContractAt(
      "IWETH9",
      addresses.WETH,
      user
    )) as IWETH9;

    dai = await ethers.getContractAt("IERC20", addresses.DAI, user);

    swapRouter = (await ethers.getContractAt(
      "ISwapRouter",
      addresses.SwapRouter,
      user
    )) as ISwapRouter;

    pokeMe = (await ethers.getContractAt(
      "IPokeMe",
      addresses.PokeMe,
      user
    )) as IPokeMe;
  });

  it("#0: Execute a Range Order", async () => {
    // Swap DAI to WETH

    await swapRouter.exactOutputSingle(
      {
        tokenIn: addresses.WETH,
        tokenOut: addresses.DAI,
        fee: 500,
        recipient: await user.getAddress(),
        deadline: ethers.constants.MaxUint256,
        amountOut: ethers.utils.parseEther("42000"),
        amountInMaximum: ethers.utils.parseEther("11"),
        sqrtPriceLimitX96: ethers.constants.Zero,
      },
      {
        value: ethers.utils.parseEther("11"),
      }
    );

    // we will do a range order to swap DAI to WETH

    const poolAddress = await factory.getPool(
      addresses.DAI,
      addresses.WETH,
      500
    );
    const pool = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      user
    )) as IUniswapV3Pool;

    const slot0 = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    const minAmountOut = ethers.utils.parseEther("10");

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) + tickSpacing;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // // Start Approve WETH token

    await weth.approve(rangeOrder.address, minAmountOut);
    await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        ejectDust: true,
        tickThreshold,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        receiver,
        maxFeeAmount: ethers.constants.MaxUint256,
      },
      { from: receiver }
    );

    // End Range Order submission

    const tokenId = 145227; // change if the fork block number change.

    // Start Check can eject

    let [canExec] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        ejectDust: true,
        amount0Min: 0,
        amount1Min: minAmountOut,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: ethers.constants.MaxUint256,
      },
      addresses.WETH
    );

    expect(canExec).to.be.false;

    // End Check can eject

    // Manipulate the market (As a whale).

    await swapRouter.exactOutputSingle(
      {
        tokenIn: addresses.WETH,
        tokenOut: addresses.DAI,
        fee: 500,
        recipient: await user.getAddress(),
        deadline: ethers.constants.MaxUint256,
        amountOut: ethers.utils.parseEther("4200000"),
        amountInMaximum: ethers.utils.parseEther("1100"),
        sqrtPriceLimitX96: ethers.constants.Zero,
      },
      {
        value: ethers.utils.parseEther("1100"),
      }
    );

    // Manipulate the market (As a whale).

    // Start re Check can eject

    let data;

    [canExec, data] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        ejectDust: true,
        amount0Min: 0,
        amount1Min: minAmountOut,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: ethers.constants.MaxUint256,
      },
      addresses.WETH
    );

    expect(canExec).to.be.true;

    // End re Check can eject

    // Eject Position

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.Gelato],
    });

    const gelato = await ethers.getSigner(addresses.Gelato);

    await pokeMe.connect(gelato).exec(
      0,
      addresses.WETH,
      ejectPL.address,
      false,
      await pokeMe.getResolverHash(
        rangeOrderResolver.address,
        rangeOrderResolver.interface.encodeFunctionData("checker", [
          tokenId,
          {
            tickThreshold,
            ejectAbove: true,
            ejectDust: true,
            amount0Min: 0,
            amount1Min: minAmountOut,
            receiver,
            owner: rangeOrder.address,
            maxFeeAmount: ethers.constants.MaxUint256,
          },
          addresses.WETH,
        ])
      ),
      ejectPL.address,
      data
    );

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [addresses.Gelato],
    });

    // Eject Position

    expect(await weth.balanceOf(receiver)).to.be.gt(minAmountOut);
  });

  it("#1: Submit a Range Order", async () => {
    // Swap DAI to WETH

    await swapRouter.exactOutputSingle(
      {
        tokenIn: addresses.WETH,
        tokenOut: addresses.DAI,
        fee: 500,
        recipient: await user.getAddress(),
        deadline: ethers.constants.MaxUint256,
        amountOut: ethers.utils.parseEther("42000"),
        amountInMaximum: ethers.utils.parseEther("11"),
        sqrtPriceLimitX96: ethers.constants.Zero,
      },
      {
        value: ethers.utils.parseEther("11"),
      }
    );

    // we will do a range order to swap DAI to WETH

    const poolAddress = await factory.getPool(
      addresses.DAI,
      addresses.WETH,
      500
    );
    const pool = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      user
    )) as IUniswapV3Pool;

    const slot0 = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    const minAmountOut = ethers.utils.parseEther("10");

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) + tickSpacing;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // // Start Approve WETH token

    await weth.approve(rangeOrder.address, minAmountOut);
    await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        ejectDust: true,
        tickThreshold,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        receiver,
        maxFeeAmount: ethers.constants.MaxUint256,
      },
      { from: receiver }
    );

    // End Range Order submission
  });

  it("#2: Cancel Range Order", async () => {
    // Swap DAI to WETH

    await swapRouter.exactOutputSingle(
      {
        tokenIn: addresses.WETH,
        tokenOut: addresses.DAI,
        fee: 500,
        recipient: await user.getAddress(),
        deadline: ethers.constants.MaxUint256,
        amountOut: ethers.utils.parseEther("42000"),
        amountInMaximum: ethers.utils.parseEther("11"),
        sqrtPriceLimitX96: ethers.constants.Zero,
      },
      {
        value: ethers.utils.parseEther("11"),
      }
    );

    // we will do a range order to swap DAI to WETH

    const poolAddress = await factory.getPool(
      addresses.DAI,
      addresses.WETH,
      500
    );

    const pool = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      user
    )) as IUniswapV3Pool;

    const slot0 = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    const minAmountOut = ethers.utils.parseEther("10");

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) + tickSpacing;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // // Start Approve WETH token

    await weth.approve(rangeOrder.address, minAmountOut);
    await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    expect(await dai.balanceOf(receiver)).to.be.eq(amountIn);

    await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        ejectDust: true,
        tickThreshold,
        amountIn: amountIn,
        minAmountOut: minAmountOut,
        receiver,
        maxFeeAmount: ethers.constants.MaxUint256,
      },
      { from: receiver }
    );

    // End Range Order submission

    expect(await dai.balanceOf(receiver)).to.be.eq(ethers.constants.Zero);

    // Start Cancel Range Order

    await rangeOrder.cancelRangeOrder(145227, {
      pool: pool.address,
      zeroForOne: true,
      ejectDust: true,
      tickThreshold,
      amountIn: amountIn,
      minAmountOut: minAmountOut,
      receiver,
      maxFeeAmount: ethers.constants.MaxUint256,
    });

    // End Cancel Range Order

    expect((await dai.balanceOf(receiver)).sub(amountIn)).to.be.lte(1); // 1 wei diff
  });
});
