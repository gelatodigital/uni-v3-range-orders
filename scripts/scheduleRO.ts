import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
//import { getAddresses } from "../src/addresses";

//const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress) => {
  const rangeOrder = await ethers.getContract("RangeOrder", signer);
  const pool = await ethers.getContractAt(
    "IUniswapV3Pool",
    "0x3965B48bb9815A0E87754fBE313BB39Bb13dC544",
    signer
  );
  const token = await ethers.getContractAt(
    "ERC20",
    await pool.token1(),
    signer
  );
  const approveTx = await token.approve(
    rangeOrder.address,
    ethers.utils.parseEther("1000000")
  );
  console.log("approve tx:", approveTx.hash);
  await approveTx.wait();
  console.log(
    "User balance of Token 1 : ",
    (await token.balanceOf(signer.address)).toString()
  );
  const tx = await rangeOrder.setRangeOrder({
    pool: pool.address, // uniswap v3 pool address
    zeroForOne: false,
    ejectDust: false,
    tickThreshold: 41257 - (41257 % 60) - 60,
    amountIn: ethers.utils.parseEther("100"),
    minAmountOut: ethers.utils.parseEther("0.1"),
    receiver: signer.address,
    maxFeeAmount: ethers.constants.MaxUint256,
  });
  console.log("range order tx:", tx.hash);
};

(async () => {
  if (network.name == "goerli") {
    const [signer] = await ethers.getSigners();
    await op(signer);
  } else {
    console.log("MUST be network goerli for this script, goodbye.");
  }
})();
