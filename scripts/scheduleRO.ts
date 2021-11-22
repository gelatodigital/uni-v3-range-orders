import { ethers, network, getNamedAccounts } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { IUniswapV3Pool } from "../typechain";
import { getAddresses } from "../src/addresses";
import { isString } from "util";

const op = async (signer: SignerWithAddress | string) => {
  const rangeOrder = await ethers.getContract("RangeOrder", signer);
  const addresss = getAddresses(network.name);
  const pool = (await ethers.getContractAt(
    "IUniswapV3Pool",
    addresss.TestPool,
    signer
  )) as IUniswapV3Pool;
  const token = await ethers.getContractAt(
    "ERC20",
    await pool.token1(),
    signer
  );
  const approveTx = await token.approve(
    rangeOrder.address,
    ethers.utils.parseUnits("400", 18)
  );
  console.log("approve tx:", approveTx.hash);
  await approveTx.wait();

  const currentTick = (await pool.slot0()).tick;
  const tickSpacing = await pool.tickSpacing();

  console.log(
    "Threshold Tick : ",
    currentTick - (currentTick % tickSpacing) - tickSpacing
  );

  console.log("Pool Address : ", pool.address);
  console.log("Signer Address : ", signer);

  const tx = await rangeOrder.setRangeOrder({
    pool: pool.address ?? addresss.TestPool, // uniswap v3 pool address
    zeroForOne: false,
    ejectDust: false,
    tickThreshold: currentTick - (currentTick % tickSpacing) - tickSpacing,
    amountIn: ethers.utils.parseUnits("400", 18),
    minAmountOut: ethers.utils.parseEther("0.09"),
    receiver: isString(signer) ? signer : signer.address,
    maxFeeAmount: ethers.utils.parseEther("0.005"),
  });
  console.log("range order tx:", tx.hash);
};

(async () => {
  if (network.name == "goerli") {
    const [signer] = await ethers.getSigners();
    await op(signer);
    // } else if (network.name == "arbitrum") {
    //   const { account } = await getNamedAccounts();
    //   const [signer] = await ethers.getSigners();
    //   await op(account ?? signer);
  } else {
    console.log("MUST be network goerli for this script, goodbye.");
  }
})();
