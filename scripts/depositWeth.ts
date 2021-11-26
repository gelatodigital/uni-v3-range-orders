import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress | string) => {
  const weth = await ethers.getContractAt("IWETH9", addresses.WETH, signer);
  const tx = await weth.deposit({ value: ethers.utils.parseEther("5") });
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
