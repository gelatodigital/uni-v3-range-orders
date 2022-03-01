import { network, ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { RangeOrder } from "../typechain";
import { isString } from "util";
import { getAddresses } from "../src/addresses";

async function main(signer: SignerWithAddress | string) {
  const rangeOrder = (await ethers.getContract(
    "RangeOrder",
    signer
  )) as RangeOrder;
  const addresss = getAddresses(network.name);
  // const pool = (await ethers.getContractAt(
  //   "IUniswapV3Pool",
  //   addresss.TestPool,
  //   signer
  // )) as IUniswapV3Pool;

  // const currentTick = (await pool.slot0()).tick; // get from etherscan for goerli
  const tokenId = 1586; // get from etherscan for goerli

  const tx = await rangeOrder.cancelRangeOrder(
    tokenId,
    {
      pool: addresss.TestPool, // uniswap v3 pool address
      zeroForOne: false,
      tickThreshold: 39300,
      amountIn: ethers.utils.parseUnits("400", 18),
      receiver: isString(signer) ? signer : signer.address,
      minLiquidity: ethers.constants.Zero,
      maxFeeAmount: ethers.utils.parseEther("0.005"),
    },
    1638798518
  );
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
