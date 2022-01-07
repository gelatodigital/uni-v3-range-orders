import { expect } from "chai";
import { Signer } from "@ethersproject/abstract-signer";
import hre = require("hardhat");
import {
  IERC20,
  // IPokeMe,
  IUniswapV3Pool,
  RangeOrder,
  RangeOrderResolver,
} from "../typechain";
import { Addresses, getAddresses } from "../src/addresses";
import { ISwapRouter } from "../typechain/ISwapRouter";
// import { IWETH9 } from "../typechain/IWETH9";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "ethers";

const { ethers, deployments } = hre;

describe("Cancel Eject LP Tests", function () {
  this.timeout(0);

  let user: Signer;
  let user2: Signer;
  let rangeOrder: RangeOrder;
  let rangeOrderResolver: RangeOrderResolver;
  let factory: Contract;
  let swapRouter: ISwapRouter;
  // let pokeMe: IPokeMe;

  let pool: IUniswapV3Pool;
  let maxFee: BigNumber;
  let submissionBlockTime: number;
  let tickThreshold: number;
  let amountIn: BigNumber;
  let receiver: string;

  let tokenId: number;

  // let weth: IWETH9;
  let dai: IERC20;

  let addresses: Addresses;

  const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

  beforeEach("Setting of Submission Tests", async function () {
    if (hre.network.name !== "hardhat") {
      console.error("Test Suite is meant to be run on hardhat only");
      process.exit(1);
    }

    addresses = getAddresses(hre.network.name);
    await deployments.fixture();

    [user, user2] = await ethers.getSigners();

    rangeOrder = (await ethers.getContract("RangeOrder")) as RangeOrder;
    rangeOrderResolver = (await ethers.getContract(
      "RangeOrderResolver"
    )) as RangeOrderResolver;
    factory = await ethers.getContractAt(
      [
        "function getPool(address tokenA,address tokenB,uint24 fee) view returns (address pool)",
      ],
      addresses.UniswapV3Factory,
      user
    );

    // weth = (await ethers.getContractAt(
    //   "IWETH9",
    //   addresses.WETH,
    //   user
    // )) as IWETH9;

    dai = await ethers.getContractAt("IERC20", addresses.DAI, user);

    swapRouter = (await ethers.getContractAt(
      "ISwapRouter",
      addresses.SwapRouter,
      user
    )) as ISwapRouter;
    // pokeMe = (await ethers.getContractAt(
    //   "IPokeMe",
    //   addresses.PokeMe,
    //   user
    // )) as IPokeMe;

    //#region Start Submission

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
    pool = (await ethers.getContractAt(
      "IUniswapV3Pool",
      poolAddress,
      user
    )) as IUniswapV3Pool;

    const slot0 = await pool.slot0();
    const tickSpacing = await pool.tickSpacing();

    tickThreshold = slot0.tick - (slot0.tick % tickSpacing) + tickSpacing;

    amountIn = ethers.utils.parseEther("42000");

    receiver = await user.getAddress();

    // // Start Approve WETH token

    // await weth.approve(rangeOrder.address, minAmountOut);
    // await weth.approve(pool.address, minAmountOut);

    // // End Approve WETH token

    // Start Range Order submission

    await dai.approve(rangeOrder.address, amountIn);

    maxFee = ethers.utils.parseEther("0.2");

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

    submissionBlockTime = (await hre.ethers.provider.getBlock("latest"))
      .timestamp;

    //#endregion End Submission

    tokenId = 145227;
  });

  it("#0: Submission should work.", async () => {
    const etherBalance = await user.getBalance();
    const tx = await rangeOrder.cancelRangeOrder(
      145227,
      {
        pool: pool.address,
        zeroForOne: true,
        tickThreshold,
        amountIn: amountIn,
        receiver,
        maxFeeAmount: maxFee,
      },
      submissionBlockTime
    );

    const receipt = await tx.wait();

    expect((await dai.balanceOf(receiver)).sub(amountIn)).to.be.lte(1); // 1 wei diff

    expect(
      etherBalance
        .sub(receipt.gasUsed.mul(receipt.effectiveGasPrice))
        .add(ethers.utils.parseEther("0.2"))
    ).to.be.eq(await user.getBalance());
  });

  it("#1: Submission should failed. Transaction sender = user submitted range order", async () => {
    await expect(
      rangeOrder.connect(user2).cancelRangeOrder(
        145227,
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        submissionBlockTime
      )
    ).to.be.revertedWith("RangeOrder::cancelRangeOrder: only receiver.");
  });

  it("#2: Submission should failed. Cannot cancel the wrong order.", async () => {
    await expect(
      rangeOrder.cancelRangeOrder(
        145227,
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee.add(1),
        },
        submissionBlockTime
      )
    ).to.be.revertedWith("EjectLP::cancel: invalid hash");
  });

  it("#3: Submission should failed. Range order already executed.", async () => {
    let [canExec] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(submissionBlockTime ?? 0),
        ejectAtExpiry: true,
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

    // let data;

    [canExec] = await rangeOrderResolver.checker(
      tokenId,
      {
        tickThreshold,
        ejectAbove: true,
        receiver,
        owner: rangeOrder.address,
        maxFeeAmount: maxFee,
        startTime: ethers.BigNumber.from(submissionBlockTime ?? 0),
        ejectAtExpiry: true,
      },
      ETH
    );

    expect(canExec).to.be.true;

    // End re Check can eject

    // Cancel Ejection

    await expect(
      rangeOrder.cancelRangeOrder(
        145227,
        {
          pool: pool.address,
          zeroForOne: true,
          tickThreshold,
          amountIn: amountIn,
          receiver,
          maxFeeAmount: maxFee,
        },
        submissionBlockTime
      )
    ).to.not.be.reverted;

    // Cancel Ejection
  });
});
