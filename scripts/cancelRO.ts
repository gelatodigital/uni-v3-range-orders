import hre, { ethers } from "hardhat";
import { IUniswapV3Pool, RangeOrder } from "../typechain";

async function main() {
  if (hre.network.name !== "goerli") {
    console.log("MUST be network goerli for this script, goodbye.");
    return;
  }
  const [signer] = await ethers.getSigners();
  const rangeOrder = (await ethers.getContract(
    "RangeOrder",
    signer
  )) as RangeOrder;
  const pool = (await ethers.getContractAt(
    "IUniswapV3Pool",
    "0x3965B48bb9815A0E87754fBE313BB39Bb13dC544",
    signer
  )) as IUniswapV3Pool;

  const currentTick = (await pool.slot0()).tick; // get from etherscan for goerli
  const tokenId = 1390; // get from etherscan for goerli

  const tx = await rangeOrder.cancelRangeOrder(tokenId, {
    pool: "0x3965B48bb9815A0E87754fBE313BB39Bb13dC544", // uniswap v3 pool address
    zeroForOne: false,
    ejectDust: false,
    tickThreshold: currentTick - (currentTick % 60) - 60,
    amountIn: ethers.utils.parseEther("100"),
    minAmountOut: ethers.utils.parseEther("0.1"),
    receiver: signer.address,
    maxFeeAmount: ethers.constants.MaxUint256,
  });
  console.log("range order tx:", tx.hash);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
