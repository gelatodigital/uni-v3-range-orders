import { network, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { IUniswapV3Pool, RangeOrder } from "../typechain";
import { isString } from "util";
import { getAddresses } from "../src/addresses";

async function main(signer: SignerWithAddress | string) {
  const rangeOrder = (await ethers.getContract(
    "RangeOrder",
    signer
  )) as RangeOrder;
  const addresss =  getAddresses(network.name);
  const pool = (await ethers.getContractAt(
    "IUniswapV3Pool",
    addresss.TestPool,
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
    receiver: isString(signer) ? signer : signer.address,
    maxFeeAmount: ethers.constants.MaxUint256,
  });
  console.log("range order tx:", tx.hash);
}

(async () => {
  if (network.name == "goerli") {
    const [signer] = await ethers.getSigners();
    await main(signer);
    // } else if (network.name == "arbitrum") {
    //   const { signer } = await getNamedAccounts();
    //   await main(signer);
  } else {
    console.log("MUST be network goerli for this script, goodbye.");
  }
})();
