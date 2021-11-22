import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";
import { isString } from "util";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress | string) => {
  const swapRouter = await ethers.getContractAt(
    "ISwapRouter",
    addresses.SwapRouter,
    signer
  );
  const dai = await ethers.getContractAt("IERC20", addresses.DAI, signer);
  const txA = await dai.approve(
    swapRouter.address,
    ethers.utils.parseEther("500")
  );
  console.log(txA.hash);
  await txA.wait();
  const tx = await swapRouter.exactOutputSingle({
    tokenIn: addresses.DAI,
    tokenOut: addresses.WETH,
    fee: 3000,
    recipient: isString(signer) ? signer : signer.address,
    deadline: ethers.constants.MaxUint256,
    amountOut: ethers.utils.parseEther("1"),
    amountInMaximum: ethers.utils.parseEther("200"),
    sqrtPriceLimitX96: ethers.constants.Zero, //SQRT_PRICE_MAX,
  });
  console.log(tx.hash);
  await tx.wait();
};

(async () => {
  if (network.name == "goerli") {
    const [signer] = await ethers.getSigners();
    await op(signer);
    // } else if (network.name == "arbitrum") {
    //   const { signer } = await getNamedAccounts();
    //   await op(signer);
  } else {
    console.log("MUST be network goerli for this script, goodbye.");
  }
})();
