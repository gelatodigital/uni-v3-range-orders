import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress) => {
  const rangeOrder = await ethers.getContractAt(
    "RangeOrder",
    "", // RangeOrder contract
    signer
  );
  // swap WETH for DAI
  await rangeOrder.setRangeOrder(
    {
        pool: "", // uniswap v3 pool address
        zeroForOne: false,
        ejectDust: false,
        tickThreshold: -48000,
        amountIn: ethers.utils.parseEther(".5"),
        minAmountOut: ethers.utils.parseEther("50"),
        receiver: signer.address,
        maxFeeAmount: ethers.constants.MaxUint256,
    },
    {value: ethers.utils.parseEther(".5")}
  );
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();
