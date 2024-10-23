import {
  reactExtension,
  useApplyCartLinesChange,
  useApplyDiscountCodeChange,
  useAttributes, 
  useCartLines, 
  useDiscountCodes, 
  useSettings, 
  useSubtotalAmount, 
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const settings = useSettings();
  const attributes = useAttributes();
  const subTotal = useSubtotalAmount();
  const applyCartLinesChange = useApplyCartLinesChange();
  const cartLines = useCartLines();
  const discountCodes = useDiscountCodes();
  const discountCodeChange = useApplyDiscountCodeChange();

  const {
    protection_first_variant: PROTECTION_FIRST_VARIANT,
    protection_second_variant: PROTECTION_SECOND_VARIANT,
    free_shipping_code: FREE_SHIPPING_CODE,
    enable_shipping_discount: ENABLE_SHIPPING_DISCOUNT,
    enable_shipping_protection: ENABLE_SHIPPING_PROTECTION,
    enable_mystery_gift: ENABLE_MYSTERY_GIFT,
    mystery_gift_variant: MYSTERY_GIFT_VARIANT
  } = settings;

  const [isAdded, setIsAdded] = useState(false);
  const [isGiftAdded, setIsGiftAdded] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  function hasShippingProtectionAttribute(attributes) {
    return attributes.some(attribute => 
      attribute.key === '_shipping_protection' && attribute.value === 'true'
    );
  }

  function hasProtectionVariant(cartLines) {
    return cartLines.some(line =>
      line.merchandise.id === PROTECTION_FIRST_VARIANT || 
      line.merchandise.id === PROTECTION_SECOND_VARIANT
    );
  }

  async function handleAddToCart(variantId) {
    await applyCartLinesChange({
      type: "addCartLine",
      merchandiseId: variantId,
      quantity: 1,
    }).then(data => {
      console.log({ data });
    })
  }

  async function handleRemoveFromCart(variantId) {
    await applyCartLinesChange({
      type: "removeCartLine",
      id: variantId,
      quantity: 1,
    }).then(data => {
      console.log({ data });
    })
  }

  function getProtectionVariantInCart(cartLines) {
    return cartLines.find(line =>
      line.merchandise.id === PROTECTION_FIRST_VARIANT || 
      line.merchandise.id === PROTECTION_SECOND_VARIANT
    );
  }

  const getBundleCount = (cartLines) => {
    return cartLines.reduce((count, item) =>
      count + (item.attributes?.some(attr => attr.key === "_bundle_id") ? item.quantity : 0), 0
    );
  };

  const isDiscountApplied = (discountCodes) => {
    return discountCodes.some(discount => discount.code === FREE_SHIPPING_CODE);
  };

  const getSubsItems = (cartLines) => {
    return cartLines.filter((item) => item.merchandise.sellingPlan?.id !== undefined);
  };

  const getSubsItemsWithoutBundle = (cartLines) => {
    const subsItems = getSubsItems(cartLines);
    
    return subsItems.reduce((count, item) => 
      !item.attributes?.some(attr => attr.key === "_bundle_id") ? count + 1 : count
    , 0);
  };

  const hasMysteryGift = (cartLines) => {
    return cartLines.some(item => 
      item.merchandise.id === MYSTERY_GIFT_VARIANT
    );
  };

  async function shipProtection() {
    if(!ENABLE_SHIPPING_PROTECTION) return;
    const shippingProtectionAttrExists = hasShippingProtectionAttribute(attributes);
    const shippingProtectionExists = hasProtectionVariant(cartLines);
    const shippingProtectionVariant = getProtectionVariantInCart(cartLines);
    const variantID = subTotal.amount < 100 ? PROTECTION_FIRST_VARIANT : PROTECTION_SECOND_VARIANT;

    // Edge case handling: check if the wrong protection variant is in the cart after cartLines change
    if (shippingProtectionExists && shippingProtectionVariant) {
      console.log("Inn");
      const isCartValueBelow100 = subTotal.amount < 100;
      const currentProtectionId = shippingProtectionVariant.merchandise.id;

      // If cart value has increased to 100+ but the first variant is present, switch to the second variant
      if (!isCartValueBelow100 && currentProtectionId === PROTECTION_FIRST_VARIANT) {
        console.log("100+");
        await handleRemoveFromCart(shippingProtectionVariant.id);
        await handleAddToCart(variantID);
      }

      // If cart value has decreased below 100 but the second variant is present, switch to the first variant
      if (isCartValueBelow100 && currentProtectionId === PROTECTION_SECOND_VARIANT) {
        console.log("100-");
        await handleRemoveFromCart(shippingProtectionVariant.id);
        await handleAddToCart(variantID);
      }
    }

    if (shippingProtectionAttrExists && !shippingProtectionExists) {
      console.log(`Add ${subTotal.amount < 100 ? 'first' : 'second'} variant`);
      await handleAddToCart(variantID);
    } 
  }

  async function shipDiscount() {
    if(!ENABLE_SHIPPING_DISCOUNT) return;
    const bundleCount = getBundleCount(cartLines);
    const shippingDiscountExists = isDiscountApplied(discountCodes);
    const subsItemsWithoutBundle = getSubsItemsWithoutBundle(cartLines);

    if ((subsItemsWithoutBundle >= 1 || bundleCount >= 2) && !shippingDiscountExists && !isAdded) {
      console.log("Adding shipping discount");
      discountCodeChange({
        type: "addDiscountCode",
        code: FREE_SHIPPING_CODE,
      }).then(data => {
        console.log({ data });
      })
      setIsAdded(true);
    }

    if (bundleCount < 2 && shippingDiscountExists && subsItemsWithoutBundle < 1) {
      console.log("Removing shipping discount");
      discountCodeChange({
        type: "removeDiscountCode",
        code: FREE_SHIPPING_CODE,
      }).then(data => {
        console.log({ data });
      });
    }
  }

  async function shipGift() {
    if(!ENABLE_MYSTERY_GIFT) return;
    const mysteryGiftExists = hasMysteryGift(cartLines);
    if(mysteryGiftExists) return;

    const bundleCount = getBundleCount(cartLines);
    const subsItemsWithoutBundle = getSubsItemsWithoutBundle(cartLines);
    const shippingProtectionVariant = getProtectionVariantInCart(cartLines);
    const shippingProtectionPrice = shippingProtectionVariant?.cost?.totalAmount?.amount || 0;
    const totalWithoutProtection = subTotal.amount - shippingProtectionPrice;

    const shouldAddGift = (!isGiftAdded && ((subsItemsWithoutBundle >= 1 || bundleCount >= 2) || totalWithoutProtection > 60));
    if (shouldAddGift) {
      console.log("Adding Mystery Gift");
      setTimeout(async() =>{
        await handleAddToCart(MYSTERY_GIFT_VARIANT);
      }, 2500);
      setIsGiftAdded(true);
    }
  }

  useEffect(() => {
    async function main() {
      if (isProcessing) return;
      setIsProcessing(true);

      await shipProtection();
      await shipGift();
      await shipDiscount();
      setIsProcessing(false);
    }

    main();
  }, [cartLines]); 
  
}
