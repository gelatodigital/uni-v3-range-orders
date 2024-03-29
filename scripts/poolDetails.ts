import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";

//const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress | string) => {
  const addresses = getAddresses(network.name);

  const pool = await ethers.getContractAt(
    "IUniswapV3Pool",
    addresses.TestPool,
    signer
  );

  const { tick } = await pool.slot0();
  const token0 = await pool.token0();
  const token1 = await pool.token1();
  const feeTier = await pool.fee();

  console.log("token0:", token0);
  console.log("token1:", token1);
  console.log("fee tier:", feeTier.toString());
  console.log("current tick:", tick.toString());
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
