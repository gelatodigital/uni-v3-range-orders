import { deployments, getNamedAccounts } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { sleep } from "../src/utils";
import { getAddresses } from "../src/addresses";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  if (
    hre.network.name === "mainnet" ||
    hre.network.name === "matic" ||
    hre.network.name === "goerli" ||
    hre.network.name === "arbitrum"
  ) {
    console.log(
      `Deploying EjectLP to ${hre.network.name}. Hit ctrl + c to abort`
    );
    await sleep(10000);
  }

  const { deploy } = deployments;
  const { deployer, gelatoMultiSig } = await getNamedAccounts();
  const addresses = getAddresses(hre.network.name);
  await deploy("EjectLP", {
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
      addresses.NonfungiblePositionManager,
      addresses.PokeMe,
      addresses.UniswapV3Factory,
      addresses.Gelato,
    ],
    log: hre.network.name != "hardhat" ? true : false,
  });
};

export default func;

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const shouldSkip =
    hre.network.name === "mainnet" ||
    hre.network.name === "matic" ||
    hre.network.name === "goerli" ||
    hre.network.name === "arbitrum";
  return shouldSkip ? true : false;
};
func.tags = ["EjectLP"];
