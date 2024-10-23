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
  const ScentedProducts = input.shop.scented_products?.jsonValue;
  const DiscountPercentage = input.shop.scented_2_pack_discount_percentage?.value;

  if (!ScentedProducts.length || !DiscountPercentage) {
    return EMPTY_DISCOUNT;
  }

  const scentedProductCounts = input.cart.lines.reduce((acc, line) => {
    const merchandise = line.merchandise;
    if (
      merchandise.__typename === "ProductVariant" &&
      ScentedProducts.includes(merchandise.product.id)
    ) {
      acc[merchandise.product.id] =
        (acc[merchandise.product.id] || 0) + line.quantity;
    }
    return acc;
  }, {});

  const targets = input.cart.lines
    .filter((line) => {
      const merchandise = line.merchandise;
      return (
        merchandise.__typename === "ProductVariant" &&
        scentedProductCounts[merchandise.product.id] === 2
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