import { deployments, ethers, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { sleep } from "../src/utils";
import { getAddresses } from "../src/addresses";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (
    hre.network.name === "mainnet" ||
    hre.network.name === "goerli" ||
    hre.network.name === "arbitrum"
  ) {
    console.log(
      `Deploying RangeOrder to ${hre.network.name}. Hit ctrl + c to abort`
    );
    await sleep(10000);
  }

  const { deploy } = deployments;
  const { deployer, gelatoMultiSig } = await getNamedAccounts();
  const addresses = getAddresses(hre.network.name);
  await deploy("RangeOrder", {
    from: deployer,
    proxy: {
      owner: gelatoMultiSig,
      execute: {
        init: {
          methodName: "initialize",
          args: [],
        },
      },
    },
    args: [
      (await ethers.getContract("EjectLP")).address,
      addresses.WETH,
      (await ethers.getContract("RangeOrderResolver")).address,
    ],
    log: hre.network.name != "hardhat" ? true : false,
  });
};

export default func;

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const shouldSkip =
    hre.network.name === "mainnet" ||
    hre.network.name === "goerli" ||
    hre.network.name === "arbitrum";
  return shouldSkip ? true : false;
};
func.tags = ["RangeOrder"];
func.dependencies = ["EjectLP", "RangeOrderResolver"];
