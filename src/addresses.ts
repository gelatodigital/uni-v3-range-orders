/* eslint-disable @typescript-eslint/naming-convention */
export interface Addresses {
  PokeMe: string;
  NonfungiblePositionManager: string;
  UniswapV3Factory: string;
  SwapRouter: string;
  Gelato: string;
  WETH: string;
  DAI: string;
  USDT: string;
  EjectLP: string;
  RangeOrders: string;
  RangeOrdersResolver: string;
  TestPool: string; // WETH DAI pool
}

export const getAddresses = (network: string): Addresses => {
  switch (network) {
    case "hardhat":
      return {
        PokeMe: "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F",
        NonfungiblePositionManager:
          "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
        WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        EjectLP: "",
        RangeOrders: "",
        RangeOrdersResolver: "",
        TestPool: "",
      };
    case "arbitrum":
      return {
        PokeMe: "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F",
        NonfungiblePositionManager:
          "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        Gelato: "0x4775aF8FEf4809fE10bf05867d2b038a4b5B2146",
        WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        DAI: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        EjectLP: "0x7c9AEE9a3a3A9107F05F341C1cC1cBe645FD816B",
        RangeOrders: "0x11F94423BB98108a756e1c1a9E909e388A6112C4",
        RangeOrdersResolver: "0x1fFA51854d7360aeEf84Ae850EBBfBD920F439BD",
        TestPool: "0x31Fa55e03bAD93C7f8AFfdd2eC616EbFde246001",
      };
    case "mainnet":
      return {
        PokeMe: "0xB3f5503f93d5Ef84b06993a1975B9D21B962892F",
        NonfungiblePositionManager:
          "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        Gelato: "0x3CACa7b48D0573D793d3b0279b5F0029180E83b6",
        WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        EjectLP: "",
        RangeOrders: "",
        RangeOrdersResolver: "",
        TestPool: "",
      };
    case "goerli":
      return {
        PokeMe: "0xc1C6805B857Bef1f412519C4A842522431aFed39",
        NonfungiblePositionManager:
          "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
        UniswapV3Factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        SwapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        Gelato: "0x683913B3A32ada4F8100458A3E1675425BdAa7DF",
        WETH: "0x60D4dB9b534EF9260a88b0BED6c486fe13E604Fc",
        DAI: "0x11fE4B6AE13d2a6055C8D9cF65c55bac32B5d844",
        USDT: "",
        EjectLP: "0xC3717A696e03e947103FBa3509c256A35F26Ca8E",
        RangeOrders: "0x640834289c9D6846BCB57D02d170AD7D78cfAAa5",
        RangeOrdersResolver: "0x8F946a74e8a54331D5018cDd1Bf64e4230F565ff",
        TestPool: "0x3965B48bb9815A0E87754fBE313BB39Bb13dC544",
      };
    default:
      throw new Error(`No addresses for Network: ${network}`);
  }
};
