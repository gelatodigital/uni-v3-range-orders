import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";
import hre = require("hardhat");
import {
  IERC20,
  IUniswapV3Factory,
  IUniswapV3Pool,
  RangeOrder,
} from "../typechain";
import { Addresses, getAddresses } from "../src/addresses";
import { ISwapRouter } from "../typechain/ISwapRouter";
import { IWETH9 } from "../typechain/IWETH9";

const { ethers, deployments } = hre;

describe("Submission Eject LP Tests", function () {
  this.timeout(0);

  let user: Signer;
  let rangeOrder: RangeOrder;
  let factory: IUniswapV3Factory;
  let swapRouter: ISwapRouter;

  let weth: IWETH9;
  let dai: IERC20;

  let addresses: Addresses;

  beforeEach("Setting of Submission Tests", async function () {
    if (hre.network.name !== "hardhat") {
      console.error("Test Suite is meant to be run on hardhat only");
      process.exit(1);
    }

    addresses = getAddresses(hre.network.name);
    await deployments.fixture();

    [user] = await ethers.getSigners();

    rangeOrder = (await ethers.getContract("RangeOrder")) as RangeOrder;
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
  });

  it("#0: Submission should fail. Because tickThreshold is not an initializable tick.", async () => {
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

    const tickThreshold =
      slot0.tick - (slot0.tick % tickSpacing) + tickSpacing + 1;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // // Start Approve WETH token

    await weth.approve(rangeOrder.address, minAmountOut);
    await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    const maxFee = ethers.utils.parseEther("0.2");

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("0.2") }
      )
    ).to.be.revertedWith(
      "RangeOrder:setRangeOrder:: threshold must be initializable tick"
    );
  });

  it("#1: Submission should fail. Because tick is in range.", async () => {
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

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) - tickSpacing;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // // Start Approve WETH token

    await weth.approve(rangeOrder.address, minAmountOut);
    await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    const maxFee = ethers.utils.parseEther("0.2");

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("0.2") }
      )
    ).to.be.revertedWith(
      "RangeOrder:_requireThresholdInRange:: eject tick in range"
    );
  });

  it("#2: Submission should fail. Because insufficient Dai balance", async () => {
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

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) + tickSpacing;

    const amountIn = ethers.utils.parseEther("42000");

    const receiver = await user.getAddress();

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    const maxFee = ethers.utils.parseEther("0.2");

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("0.2") }
      )
    ).to.be.revertedWith("Dai/insufficient-balance");
  });

  it("#3: Submission should fail. Because eth send is lower than/equal to amount In. So no fee amount", async () => {
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

    const amountIn = ethers.utils.parseEther("10");

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) - tickSpacing;

    const receiver = await user.getAddress();

    // Start Range Order submission

    const maxFee = ethers.utils.parseEther("0.2");

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: false,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: maxFee.add(1) }
      )
    ).to.be.revertedWith("RangeOrder:setRangeOrder:: Invalid amount in.");
  });

  it("#4: Submission should fail. Because eth fee sent != maxFeeAmount", async () => {
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

    const amountIn = ethers.utils.parseEther("10");

    const tickThreshold = slot0.tick - (slot0.tick % tickSpacing) - tickSpacing;

    const receiver = await user.getAddress();

    const maxFee = ethers.utils.parseEther("0.2");

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: false,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("10.3") }
      )
    ).to.be.revertedWith("RangeOrder:setRangeOrder:: Invalid maxFeeAmount.");
  });

  it("#5: Submission should fail. Because eth fee sent != maxFeeAmount", async () => {
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

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("0.3") }
      )
    ).to.be.revertedWith("RangeOrder:setRangeOrder:: Invalid maxFeeAmount.");
  });

  it("#6: Submission should work.", async () => {
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

    await expect(
      rangeOrder.setRangeOrder(
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        { from: receiver, value: ethers.utils.parseEther("0.2") }
      )
    ).to.not.be.reverted;
  });
});
