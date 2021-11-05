import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const SQRT_PRICE_MAX = ethers.BigNumber.from("1461446703485210103287273052203988822378723970341");

const op = async (signer: SignerWithAddress) => {
  const swapRouter = await ethers.getContractAt(
    "ISwapRouter",
    addresses.SwapRouter,
    signer
  );
  const dai = await ethers.getContractAt(
    "IERC20",
    addresses.DAI,
    signer
  );
  const txA = await dai.approve(swapRouter.address, ethers.utils.parseEther("500"));
  console.log(txA.hash);
  await txA.wait();
  const tx = await swapRouter.exactOutputSingle(
    {
      tokenIn: addresses.DAI,
      tokenOut: addresses.WETH,
      fee: 3000,
      recipient: signer.address,
      deadline: ethers.constants.MaxUint256,
      amountOut: ethers.utils.parseEther("1"),
      amountInMaximum: ethers.utils.parseEther("200"),
      sqrtPriceLimitX96: ethers.constants.Zero, //SQRT_PRICE_MAX,
    }
  );
  console.log(tx.hash);
  await tx.wait();
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();