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
      };
    case "arbitrum":
      return {
        PokeMe: "",
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
      };
    default:
      throw new Error(`No addresses for Network: ${network}`);
  }
};
