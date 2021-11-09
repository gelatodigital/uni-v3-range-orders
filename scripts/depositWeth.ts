import { ethers, network } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { getAddresses } from "../src/addresses";

const addresses = getAddresses(network.name);

const op = async (signer: SignerWithAddress) => {
  const weth = await ethers.getContractAt(
    "IWETH9",
    addresses.WETH,
    signer
  );
  const tx = await weth.deposit(
    {value: ethers.utils.parseEther("5")}
  );
  console.log(tx.hash);
  await tx.wait();
};

(async () => {
  const [signer] = await ethers.getSigners();
  await op(signer);
})();