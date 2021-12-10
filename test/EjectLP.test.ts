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

describe("Eject LP Integration Test", function () {
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

  const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

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

    const maxFee = ethers.utils.parseEther("0.2");

    const tx = await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      { from: receiver, value: ethers.utils.parseEther("0.2") }
    );

    await tx.wait();

    const blockTime = (await hre.ethers.provider.getBlock("latest")).timestamp;

    // End Range Order submission

    const tokenId = 145227; // change if the fork block number change.

    // Start Check can eject

    let [canExec] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(blockTime ?? 0),
      },
      ETH
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
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(blockTime ?? 0),
      },
      ETH
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
      ETH,
      ejectPL.address,
      false,
      await pokeMe.getResolverHash(
        rangeOrderResolver.address,
        rangeOrderResolver.interface.encodeFunctionData("checker", [
          tokenId,
          {
            tickThreshold,
            ejectAbove: true,
            receiver,
            owner: rangeOrder.address,
            maxFeeAmount: maxFee,
            startTime: ethers.BigNumber.from(blockTime ?? 0),
          },
          ETH,
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

  it("#1: Settle a Range Order", async () => {
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

    const maxFee = ethers.utils.parseEther("0.2");

    const tx = await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      { from: receiver, value: ethers.utils.parseEther("0.2") }
    );

    await tx.wait();

    const blockTime = (await hre.ethers.provider.getBlock("latest")).timestamp;

    // End Range Order submission

    const tokenId = 145227; // change if the fork block number change.

    // Start Check can eject

    let [canExec] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(blockTime ?? 0),
      },
      ETH
    );

    expect(canExec).to.be.false;

    // End Check can eject

    // Jump into the futur.

    await hre.network.provider.send("evm_increaseTime", [7776001]);
    await hre.network.provider.send("evm_mine");

    // Jump into the futur.

    // Start re Check can eject

    let data;

    [canExec, data] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(blockTime ?? 0),
      },
      ETH
    );

    expect(canExec).to.be.true;

    // End re Check can eject

    // Eject Position

    await hre.network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [addresses.Gelato],
    });

    const gelato = await ethers.getSigner(addresses.Gelato);

    const ethBalanceBefore = await user.getBalance();
    const daiBalanceBefore = await dai.balanceOf(receiver);

    await pokeMe.connect(gelato).exec(
      0,
      ETH,
      ejectPL.address,
      false,
      await pokeMe.getResolverHash(
        rangeOrderResolver.address,
        rangeOrderResolver.interface.encodeFunctionData("checker", [
          tokenId,
          {
            tickThreshold,
            ejectAbove: true,
            receiver,
            owner: rangeOrder.address,
            maxFeeAmount: maxFee,
            startTime: ethers.BigNumber.from(blockTime ?? 0),
          },
          ETH,
        ])
      ),
      ejectPL.address,
      data
    );

    const ethBalanceAfter = await user.getBalance();
    const daiBalanceAfter = await dai.balanceOf(receiver);

    await hre.network.provider.request({
      method: "hardhat_stopImpersonatingAccount",
      params: [addresses.Gelato],
    });

    // Eject Position

    expect(ethBalanceAfter.sub(ethBalanceBefore)).to.be.gt(
      ethers.constants.Zero
    );

    expect(daiBalanceAfter.sub(daiBalanceBefore).sub(amountIn)).to.be.lte(1);
  });

  it("#2: Submit a Range Order", async () => {
    // Swap DAI to WETH

    const maxFee = ethers.utils.parseEther("0.2");

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
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      { from: receiver, value: maxFee }
    );

    // End Range Order submission
  });

  it("#3: Cancel Range Order", async () => {
    // Swap DAI to WETH

    const maxFee = ethers.utils.parseEther("0.2");

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

    const tx = await rangeOrder.setRangeOrder(
      {
        pool: pool.address,
        zeroForOne: true,
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      { from: receiver, value: maxFee }
    );

    await tx.wait();

    const blockTime = (await hre.ethers.provider.getBlock("latest")).timestamp;

    // End Range Order submission

    expect(await dai.balanceOf(receiver)).to.be.eq(ethers.constants.Zero);

    // Start Cancel Range Order

    await rangeOrder.cancelRangeOrder(
      145227,
      {
        pool: pool.address,
        zeroForOne: true,
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      blockTime
    );

    // End Cancel Range Order

    expect((await dai.balanceOf(receiver)).sub(amountIn)).to.be.lte(1); // 1 wei diff
  });
});
