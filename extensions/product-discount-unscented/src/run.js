// @ts-check
import { DiscountApplicationStrategy } from "../generated/api";

/**
 * @typedef {import("../generated/api").RunInput} RunInput
 * @typedef {import("../generated/api").FunctionRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
 */
const EMPTY_DISCOUNT = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

/**
 * @param {RunInput} input
 * @returns {FunctionRunResult}
 */
export function run(input) {
  const UnscentedVariants = input.shop.unscented_variants?.jsonValue;
  const DiscountPercentage = input.shop.unscented_3_pack_discount_percentage?.value;

  if (!UnscentedVariants.length || !DiscountPercentage) {
    return EMPTY_DISCOUNT;
  }

  const targets = input.cart.lines
    .filter((line) => {
      const merchandise = line.merchandise;
      return (
        line.quantity >= 2 &&
        merchandise.__typename === "ProductVariant" &&
        UnscentedVariants.includes(merchandise.id)
      );
    })
    .map((line) => {
      return ({
        cartLine: {
          id: line.id
        },
      });
    });
 
  if (!targets.length) {
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        targets,
        value: {
          percentage: {
            value: DiscountPercentage,
          },
        },
      }
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First,
  };
}