import { ethers, BigNumber } from "ethers";
import JSBI from "jsbi";
import { FullMath, maxLiquidityForAmounts, TickMath } from "@uniswap/v3-sdk";

export function getAmountsIn(
  currentTick: number,
  lowerTick: number,
  upperTick: number,
  amount0: BigNumber,
  amount1: BigNumber,
  sqrtPriceX96: BigNumber
): { amount0: BigNumber; amount1: BigNumber } {
  const liquidity = maxLiquidityForAmounts(
    JSBI.BigInt(sqrtPriceX96),
    TickMath.getSqrtRatioAtTick(lowerTick),
    TickMath.getSqrtRatioAtTick(upperTick),
    amount0.toString(),
    amount1.toString(),
    true
  );

  if (BigNumber.from(liquidity.toString()).isZero())
    return { amount0: ethers.constants.Zero, amount1: ethers.constants.Zero };

  amount0 = ethers.constants.Zero;
  amount1 = ethers.constants.Zero;

  if (currentTick < lowerTick) {
    amount0 = BigNumber.from(
      getAmount0Delta(
        TickMath.getSqrtRatioAtTick(lowerTick),
        TickMath.getSqrtRatioAtTick(upperTick),
        liquidity,
        false
      ).toString()
    );
  } else if (currentTick < upperTick) {
    amount0 = BigNumber.from(
      getAmount0Delta(
        JSBI.BigInt(sqrtPriceX96.toString()),
        TickMath.getSqrtRatioAtTick(upperTick),
        liquidity,
        false
      ).toString()
    );

    amount1 = BigNumber.from(
      getAmount1Delta(
        TickMath.getSqrtRatioAtTick(lowerTick),
        JSBI.BigInt(sqrtPriceX96.toString()),
        liquidity,
        false
      ).toString()
    );
  } else {
    amount1 = BigNumber.from(
      getAmount1Delta(
        TickMath.getSqrtRatioAtTick(lowerTick),
        TickMath.getSqrtRatioAtTick(upperTick),
        liquidity,
        false
      ).toString()
    );
  }

  return { amount0, amount1 };
}

export function getAmount0Delta(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  const numerator1 = JSBI.leftShift(liquidity, JSBI.BigInt(96));
  const numerator2 = JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96);

  return roundUp
    ? FullMath.mulDivRoundingUp(
        FullMath.mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96),
        JSBI.BigInt(1),
        sqrtRatioAX96
      )
    : JSBI.divide(
        JSBI.divide(JSBI.multiply(numerator1, numerator2), sqrtRatioBX96),
        sqrtRatioAX96
      );
}

export function getAmount1Delta(
  sqrtRatioAX96: JSBI,
  sqrtRatioBX96: JSBI,
  liquidity: JSBI,
  roundUp: boolean
): JSBI {
  if (JSBI.greaterThan(sqrtRatioAX96, sqrtRatioBX96)) {
    [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
  }

  const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

  return roundUp
    ? FullMath.mulDivRoundingUp(
        liquidity,
        JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96),
        Q96
      )
    : JSBI.divide(
        JSBI.multiply(liquidity, JSBI.subtract(sqrtRatioBX96, sqrtRatioAX96)),
        Q96
      );
}
