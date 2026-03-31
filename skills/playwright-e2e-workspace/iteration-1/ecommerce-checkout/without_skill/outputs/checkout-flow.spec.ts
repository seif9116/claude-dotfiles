import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/** Add a product to the cart from the home page and wait for the "Added!" feedback. */
async function addProductToCart(page: Page, productName: string) {
  const addButton = page.getByLabel(`Add ${productName} to cart`);
  await addButton.click();
  // Wait for the optimistic "Added!" feedback to confirm the action registered
  await expect(addButton).toHaveText("Added!");
}

/** Fill out the shipping information fieldset with valid data. */
async function fillShippingInfo(
  page: Page,
  overrides: Partial<{
    fullName: string;
    address: string;
    city: string;
    state: string;
    zip: string;
  }> = {}
) {
  const defaults = {
    fullName: "Jane Doe",
    address: "456 Oak Avenue",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    ...overrides,
  };
  await page.getByLabel("Full Name").fill(defaults.fullName);
  await page.getByLabel("Street Address").fill(defaults.address);
  await page.getByLabel("City").fill(defaults.city);
  await page.getByLabel("State").fill(defaults.state);
  await page.getByLabel("ZIP Code").fill(defaults.zip);
}

/** Fill out credit-card fields with valid data. */
async function fillCreditCardInfo(
  page: Page,
  overrides: Partial<{
    cardNumber: string;
    expiry: string;
    cvv: string;
  }> = {}
) {
  const defaults = {
    cardNumber: "4111111111111111",
    expiry: "12/28",
    cvv: "123",
    ...overrides,
  };
  await page.getByLabel("Card Number").fill(defaults.cardNumber);
  await page.getByLabel("Expiry Date").fill(defaults.expiry);
  await page.getByLabel("CVV").fill(defaults.cvv);
}

/**
 * End-to-end helper: navigate home, add a product, go to cart, proceed to
 * checkout. Returns the page already on the checkout page with items in the
 * cart.
 */
async function navigateToCheckoutWithProduct(
  page: Page,
  productName = "Wireless Headphones"
) {
  await page.goto("/");
  await addProductToCart(page, productName);
  await page.getByLabel("Shopping cart").click();
  await page.getByLabel("Proceed to checkout").click();
  await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
}

// ===========================================================================
// 1. PRODUCT LISTING PAGE
// ===========================================================================

test.describe("Product listing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays all four products with names, descriptions, prices, and Add to Cart buttons", async ({
    page,
  }) => {
    const products = [
      { name: "Wireless Headphones", price: "$79.99" },
      { name: "Mechanical Keyboard", price: "$129.99" },
      { name: "USB-C Hub", price: "$49.99" },
      { name: "Ergonomic Mouse", price: "$59.99" },
    ];

    for (const { name, price } of products) {
      const article = page.getByRole("listitem").filter({ hasText: name });
      await expect(article).toBeVisible();
      await expect(article).toContainText(price);
      await expect(
        page.getByRole("button", { name: `Add ${name} to cart` })
      ).toBeVisible();
    }
  });

  test("shows 'Added!' confirmation after clicking Add to Cart", async ({
    page,
  }) => {
    const button = page.getByLabel("Add Wireless Headphones to cart");
    await button.click();
    await expect(button).toHaveText("Added!");
    // Button text reverts after ~1500 ms
    await expect(button).toHaveText("Add to Cart", { timeout: 3000 });
  });

  test("cart badge in the header updates when items are added", async ({
    page,
  }) => {
    // Initially no badge number
    const cartLink = page.getByLabel("Shopping cart");
    await expect(cartLink).toContainText("Cart");
    await expect(cartLink).not.toContainText("1");

    await addProductToCart(page, "USB-C Hub");
    await expect(cartLink.getByLabel("1 items in cart")).toBeVisible();

    await addProductToCart(page, "Ergonomic Mouse");
    await expect(cartLink.getByLabel("2 items in cart")).toBeVisible();
  });

  test("adding the same product twice increments quantity in the badge", async ({
    page,
  }) => {
    await addProductToCart(page, "Wireless Headphones");
    // Wait for the "Added!" text to revert before clicking again
    await expect(
      page.getByLabel("Add Wireless Headphones to cart")
    ).toHaveText("Add to Cart", { timeout: 3000 });
    await addProductToCart(page, "Wireless Headphones");
    await expect(
      page.getByLabel("Shopping cart").getByLabel("2 items in cart")
    ).toBeVisible();
  });
});

// ===========================================================================
// 2. CART PAGE
// ===========================================================================

test.describe("Cart page", () => {
  test("shows empty cart message with link back to products", async ({
    page,
  }) => {
    await page.goto("/cart");
    await expect(page.getByLabel("Empty cart message")).toContainText(
      "Your cart is empty."
    );
    const continueLink = page.getByRole("link", { name: "Continue Shopping" });
    await expect(continueLink).toBeVisible();
    await continueLink.click();
    await expect(page).toHaveURL("/");
  });

  test("displays added items with correct name, price, quantity, subtotal", async ({
    page,
  }) => {
    await page.goto("/");
    await addProductToCart(page, "Mechanical Keyboard");
    await page.getByLabel("Shopping cart").click();

    const table = page.getByRole("table", { name: "Cart items" });
    await expect(table).toBeVisible();
    await expect(table).toContainText("Mechanical Keyboard");
    await expect(table).toContainText("$129.99");

    const qtyInput = page.getByLabel("Quantity for Mechanical Keyboard");
    await expect(qtyInput).toHaveValue("1");
  });

  test("updates subtotal when quantity is changed", async ({ page }) => {
    await page.goto("/");
    await addProductToCart(page, "USB-C Hub"); // $49.99
    await page.getByLabel("Shopping cart").click();

    const qtyInput = page.getByLabel("Quantity for USB-C Hub");
    await qtyInput.fill("3");

    // Subtotal should be 3 * 49.99 = 149.97
    await expect(page.getByRole("table")).toContainText("$149.97");
    // Cart total should also update
    await expect(
      page.getByLabel("Cart total: $149.97")
    ).toBeVisible();
  });

  test("removes an item from the cart", async ({ page }) => {
    await page.goto("/");
    await addProductToCart(page, "Wireless Headphones");
    await page.getByLabel("Shopping cart").click();

    await page.getByLabel("Remove Wireless Headphones from cart").click();
    await expect(page.getByLabel("Empty cart message")).toContainText(
      "Your cart is empty."
    );
  });

  test("shows correct total with multiple different items", async ({
    page,
  }) => {
    await page.goto("/");
    await addProductToCart(page, "Wireless Headphones"); // 79.99
    // Wait for "Added!" to revert so the next click on a different product
    // doesn't collide visually, though functionally it's fine.
    await addProductToCart(page, "Ergonomic Mouse"); // 59.99
    await page.getByLabel("Shopping cart").click();

    // Total = 79.99 + 59.99 = 139.98
    await expect(
      page.getByLabel("Cart total: $139.98")
    ).toBeVisible();
  });

  test("Proceed to Checkout link navigates to checkout page", async ({
    page,
  }) => {
    await page.goto("/");
    await addProductToCart(page, "USB-C Hub");
    await page.getByLabel("Shopping cart").click();

    await page.getByLabel("Proceed to checkout").click();
    await expect(page).toHaveURL("/checkout");
    await expect(
      page.getByRole("heading", { name: "Checkout" })
    ).toBeVisible();
  });
});

// ===========================================================================
// 3. CHECKOUT PAGE — GUARD / EMPTY STATE
// ===========================================================================

test.describe("Checkout page — empty cart guard", () => {
  test("redirects to browse products when cart is empty", async ({ page }) => {
    await page.goto("/checkout");
    await expect(page).toHaveURL("/checkout");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
    const browseLink = page.getByRole("link", { name: "Browse Products" });
    await expect(browseLink).toBeVisible();
    await browseLink.click();
    await expect(page).toHaveURL("/");
  });
});

// ===========================================================================
// 4. CHECKOUT — SHIPPING VALIDATION
// ===========================================================================

test.describe("Checkout — shipping field validation", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCheckoutWithProduct(page);
  });

  test("shows required-field errors when submitting empty form", async ({
    page,
  }) => {
    await page.getByLabel("Place order").click();

    // Shipping errors
    await expect(page.getByText("This field is required").first()).toBeVisible();
    // Specifically check that the individual error messages appear
    for (const fieldId of [
      "fullName-error",
      "address-error",
      "city-error",
      "state-error",
      "zip-error",
    ]) {
      await expect(page.locator(`#${fieldId}`)).toBeVisible();
    }

    // Credit card errors (credit-card is the default payment method)
    await expect(page.getByText("Card number is required")).toBeVisible();
    await expect(page.getByText("Expiry date is required")).toBeVisible();
    await expect(page.getByText("CVV is required")).toBeVisible();
  });

  test("shows ZIP code format error for invalid ZIP", async ({ page }) => {
    await fillShippingInfo(page, { zip: "ABCDE" });
    await fillCreditCardInfo(page);
    await page.getByLabel("Place order").click();
    await expect(
      page.getByText("Enter a valid ZIP code (e.g., 12345)")
    ).toBeVisible();
  });

  test("accepts ZIP+4 format (e.g. 12345-6789)", async ({ page }) => {
    await fillShippingInfo(page, { zip: "12345-6789" });
    await fillCreditCardInfo(page);
    await page.getByLabel("Place order").click();
    // Should NOT show ZIP error
    await expect(
      page.getByText("Enter a valid ZIP code")
    ).not.toBeVisible();
  });
});

// ===========================================================================
// 5. CHECKOUT — PAYMENT METHOD (CREDIT CARD)
// ===========================================================================

test.describe("Checkout — credit card validation", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCheckoutWithProduct(page);
    await fillShippingInfo(page);
  });

  test("shows error for invalid card number", async ({ page }) => {
    await fillCreditCardInfo(page, { cardNumber: "1234" });
    await page.getByLabel("Place order").click();
    await expect(page.getByText("Enter a valid card number")).toBeVisible();
  });

  test("shows error for invalid expiry format", async ({ page }) => {
    await fillCreditCardInfo(page, { expiry: "1228" });
    await page.getByLabel("Place order").click();
    await expect(page.getByText("Use MM/YY format")).toBeVisible();
  });

  test("shows error for invalid CVV", async ({ page }) => {
    await fillCreditCardInfo(page, { cvv: "12" });
    await page.getByLabel("Place order").click();
    await expect(page.getByText("Enter a valid CVV")).toBeVisible();
  });

  test("accepts a 4-digit CVV", async ({ page }) => {
    await fillCreditCardInfo(page, { cvv: "1234" });
    await page.getByLabel("Place order").click();
    // CVV error should not appear
    await expect(page.getByText("Enter a valid CVV")).not.toBeVisible();
  });
});

// ===========================================================================
// 6. CHECKOUT — PAYMENT METHOD (PAYPAL)
// ===========================================================================

test.describe("Checkout — PayPal payment method", () => {
  test.beforeEach(async ({ page }) => {
    await navigateToCheckoutWithProduct(page);
  });

  test("switching to PayPal hides credit card fields and shows PayPal message", async ({
    page,
  }) => {
    await page.getByLabel("PayPal").check();
    await expect(
      page.getByText("You will be redirected to PayPal")
    ).toBeVisible();
    // Credit card fields should not be visible
    await expect(page.getByLabel("Card Number")).not.toBeVisible();
    await expect(page.getByLabel("Expiry Date")).not.toBeVisible();
    await expect(page.getByLabel("CVV")).not.toBeVisible();
  });

  test("PayPal does not require credit card fields for submission", async ({
    page,
  }) => {
    await fillShippingInfo(page);
    await page.getByLabel("PayPal").check();
    await page.getByLabel("Place order").click();

    // Should succeed — order confirmation shown
    await expect(page.getByText("Order Confirmed!")).toBeVisible();
  });

  test("switching back to Credit Card re-shows card fields", async ({
    page,
  }) => {
    await page.getByLabel("PayPal").check();
    await expect(page.getByLabel("Card Number")).not.toBeVisible();

    await page.getByLabel("Credit Card").check();
    await expect(page.getByLabel("Card Number")).toBeVisible();
    await expect(page.getByLabel("Expiry Date")).toBeVisible();
    await expect(page.getByLabel("CVV")).toBeVisible();
  });
});

// ===========================================================================
// 7. CHECKOUT — ORDER SUMMARY SIDEBAR
// ===========================================================================

test.describe("Checkout — order summary sidebar", () => {
  test("displays each item with quantity and line total", async ({ page }) => {
    await page.goto("/");
    await addProductToCart(page, "Wireless Headphones"); // 79.99
    await addProductToCart(page, "USB-C Hub"); // 49.99
    await page.getByLabel("Shopping cart").click();
    await page.getByLabel("Proceed to checkout").click();

    const summary = page.getByLabel("Order summary");
    await expect(summary).toContainText("Wireless Headphones x1");
    await expect(summary).toContainText("$79.99");
    await expect(summary).toContainText("USB-C Hub x1");
    await expect(summary).toContainText("$49.99");

    // Total = 129.98
    await expect(
      summary.getByLabel("Order total: $129.98")
    ).toBeVisible();
  });
});

// ===========================================================================
// 8. SUCCESSFUL ORDER PLACEMENT (HAPPY PATH)
// ===========================================================================

test.describe("Complete checkout — happy path", () => {
  test("credit card payment: places order, shows confirmation, clears cart", async ({
    page,
  }) => {
    // 1. Add items to cart
    await page.goto("/");
    await addProductToCart(page, "Wireless Headphones");
    await addProductToCart(page, "Mechanical Keyboard");

    // 2. Go to cart & proceed to checkout
    await page.getByLabel("Shopping cart").click();
    await expect(page.getByRole("table")).toContainText("Wireless Headphones");
    await expect(page.getByRole("table")).toContainText("Mechanical Keyboard");
    await page.getByLabel("Proceed to checkout").click();

    // 3. Fill shipping
    await fillShippingInfo(page);

    // 4. Fill credit card (default payment method)
    await fillCreditCardInfo(page);

    // 5. Place order
    await page.getByLabel("Place order").click();

    // 6. Verify confirmation
    await expect(page.getByText("Order Confirmed!")).toBeVisible();
    await expect(
      page.getByText("Thank you for your purchase")
    ).toBeVisible();
    await expect(
      page.getByText("You will receive a confirmation email shortly")
    ).toBeVisible();

    // 7. Cart badge should be empty
    const cartLink = page.getByLabel("Shopping cart");
    await expect(cartLink).toContainText("Cart");
    // No badge with item count should be present
    await expect(page.locator('[aria-label$="items in cart"]')).not.toBeVisible();

    // 8. Continue shopping link works
    await page.getByRole("link", { name: "Continue Shopping" }).click();
    await expect(page).toHaveURL("/");
  });

  test("PayPal payment: places order, shows confirmation", async ({
    page,
  }) => {
    await navigateToCheckoutWithProduct(page, "Ergonomic Mouse");
    await fillShippingInfo(page);
    await page.getByLabel("PayPal").check();
    await page.getByLabel("Place order").click();

    await expect(page.getByText("Order Confirmed!")).toBeVisible();
    await expect(
      page.getByText("Thank you for your purchase")
    ).toBeVisible();
  });
});

// ===========================================================================
// 9. FULL END-TO-END JOURNEY (MULTI-ITEM, QUANTITY CHANGES, REMOVAL)
// ===========================================================================

test.describe("Full end-to-end journey", () => {
  test("add multiple items, adjust quantities, remove one, and checkout", async ({
    page,
  }) => {
    // 1. Browse products
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Our Products" })
    ).toBeVisible();

    // 2. Add three products
    await addProductToCart(page, "Wireless Headphones"); // 79.99
    await addProductToCart(page, "USB-C Hub"); // 49.99
    await addProductToCart(page, "Ergonomic Mouse"); // 59.99

    // Cart badge should show 3
    await expect(
      page.getByLabel("Shopping cart").getByLabel("3 items in cart")
    ).toBeVisible();

    // 3. Go to cart
    await page.getByLabel("Shopping cart").click();
    await expect(page).toHaveURL("/cart");

    // 4. Increase quantity of USB-C Hub to 2
    const hubQty = page.getByLabel("Quantity for USB-C Hub");
    await hubQty.fill("2");

    // 5. Remove Ergonomic Mouse
    await page.getByLabel("Remove Ergonomic Mouse from cart").click();
    // Verify it's gone
    await expect(page.getByText("Ergonomic Mouse")).not.toBeVisible();

    // Expected total: 79.99 + (49.99 * 2) = 179.97
    await expect(
      page.getByLabel("Cart total: $179.97")
    ).toBeVisible();

    // 6. Proceed to checkout
    await page.getByLabel("Proceed to checkout").click();

    // 7. Verify order summary
    const summary = page.getByLabel("Order summary");
    await expect(summary).toContainText("Wireless Headphones x1");
    await expect(summary).toContainText("USB-C Hub x2");
    await expect(summary).not.toContainText("Ergonomic Mouse");
    await expect(
      summary.getByLabel("Order total: $179.97")
    ).toBeVisible();

    // 8. Fill shipping & payment
    await fillShippingInfo(page, {
      fullName: "Alice Smith",
      address: "789 Elm Blvd",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    });
    await fillCreditCardInfo(page, {
      cardNumber: "5500000000000004",
      expiry: "06/29",
      cvv: "456",
    });

    // 9. Place order
    await page.getByLabel("Place order").click();

    // 10. Confirm success
    await expect(page.getByText("Order Confirmed!")).toBeVisible();
  });
});

// ===========================================================================
// 10. NAVIGATION & LAYOUT
// ===========================================================================

test.describe("Navigation and layout", () => {
  test("header shows ShopDemo brand link, Products link, and Cart link", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByLabel("Home")).toContainText("ShopDemo");
    await expect(
      page.getByRole("link", { name: "Products" })
    ).toBeVisible();
    await expect(page.getByLabel("Shopping cart")).toBeVisible();
  });

  test("footer displays copyright text", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("contentinfo")
    ).toContainText("2026 ShopDemo. All rights reserved.");
  });

  test("Products link in header navigates to home page", async ({ page }) => {
    await page.goto("/cart");
    await page.getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL("/");
  });

  test("ShopDemo brand link navigates to home page", async ({ page }) => {
    await page.goto("/checkout");
    await page.getByLabel("Home").click();
    await expect(page).toHaveURL("/");
  });
});

// ===========================================================================
// 11. ACCESSIBILITY SMOKE CHECKS
// ===========================================================================

test.describe("Accessibility smoke checks", () => {
  test("product listing has proper ARIA roles and labels", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByRole("list", { name: "Product listing" })
    ).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" })
    ).toBeVisible();
  });

  test("checkout form fields have associated labels and aria attributes", async ({
    page,
  }) => {
    await navigateToCheckoutWithProduct(page);

    // All shipping fields should be labeled
    for (const label of [
      "Full Name",
      "Street Address",
      "City",
      "State",
      "ZIP Code",
    ]) {
      const input = page.getByLabel(label);
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute("aria-required", "true");
    }

    // Credit card fields
    for (const label of ["Card Number", "Expiry Date", "CVV"]) {
      const input = page.getByLabel(label);
      await expect(input).toBeVisible();
      await expect(input).toHaveAttribute("aria-required", "true");
    }
  });

  test("cart table has proper scope and role attributes", async ({ page }) => {
    await page.goto("/");
    await addProductToCart(page, "Wireless Headphones");
    await page.getByLabel("Shopping cart").click();

    const table = page.getByRole("table", { name: "Cart items" });
    await expect(table).toBeVisible();

    // Column headers with scope
    const headers = table.locator("th");
    const count = await headers.count();
    for (let i = 0; i < count; i++) {
      await expect(headers.nth(i)).toHaveAttribute("scope", "col");
    }
  });

  test("order confirmation has alert role for screen readers", async ({
    page,
  }) => {
    await navigateToCheckoutWithProduct(page);
    await fillShippingInfo(page);
    await fillCreditCardInfo(page);
    await page.getByLabel("Place order").click();

    await expect(
      page.getByRole("alert", { name: "Order confirmation" })
    ).toBeVisible();
  });
});

// ===========================================================================
// 12. EDGE CASES
// ===========================================================================

test.describe("Edge cases", () => {
  test("submitting checkout with only whitespace in fields shows errors", async ({
    page,
  }) => {
    await navigateToCheckoutWithProduct(page);
    await page.getByLabel("Full Name").fill("   ");
    await page.getByLabel("Street Address").fill("   ");
    await page.getByLabel("City").fill("   ");
    await page.getByLabel("State").fill("   ");
    await page.getByLabel("ZIP Code").fill("   ");
    await page.getByLabel("Card Number").fill("   ");
    await page.getByLabel("Expiry Date").fill("   ");
    await page.getByLabel("CVV").fill("   ");

    await page.getByLabel("Place order").click();

    // All required-field errors should appear because whitespace-only is treated as empty
    await expect(page.locator("#fullName-error")).toBeVisible();
    await expect(page.locator("#address-error")).toBeVisible();
  });

  test("adding the same product multiple times increments quantity rather than duplicating", async ({
    page,
  }) => {
    await page.goto("/");
    await addProductToCart(page, "Mechanical Keyboard");
    await expect(
      page.getByLabel("Add Mechanical Keyboard to cart")
    ).toHaveText("Add to Cart", { timeout: 3000 });
    await addProductToCart(page, "Mechanical Keyboard");

    await page.getByLabel("Shopping cart").click();

    // Should see quantity 2, not two separate rows
    const qtyInput = page.getByLabel("Quantity for Mechanical Keyboard");
    await expect(qtyInput).toHaveValue("2");

    // Only one row with "Mechanical Keyboard"
    const rows = page.getByRole("row").filter({ hasText: "Mechanical Keyboard" });
    await expect(rows).toHaveCount(1);
  });
});
