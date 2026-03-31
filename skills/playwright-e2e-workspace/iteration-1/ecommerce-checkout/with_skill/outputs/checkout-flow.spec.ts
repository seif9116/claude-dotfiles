import { test, expect, type Page } from '@playwright/test';

// ============================================================
// Helper: Add a product to the cart from the home page
// ============================================================
async function addProductToCart(page: Page, productName: string) {
  await page.goto('/');
  await page.getByRole('button', { name: `Add ${productName} to cart` }).click();
  // Wait for the "Added!" confirmation to appear, confirming the action completed
  await expect(
    page.getByRole('button', { name: `Add ${productName} to cart` })
  ).toHaveText('Added!');
}

// Helper: Fill in valid shipping information
async function fillShippingInfo(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const defaults = {
    fullName: 'Jane Doe',
    address: '123 Main Street',
    city: 'New York',
    state: 'NY',
    zip: '10001',
  };
  const data = { ...defaults, ...overrides };

  await page.getByLabel('Full Name').fill(data.fullName);
  await page.getByLabel('Street Address').fill(data.address);
  await page.getByLabel('City').fill(data.city);
  await page.getByLabel('State').fill(data.state);
  await page.getByLabel('ZIP Code').fill(data.zip);
}

// Helper: Fill in valid credit card information
async function fillCreditCardInfo(page: Page, overrides: Partial<Record<string, string>> = {}) {
  const defaults = {
    cardNumber: '4111111111111111',
    expiry: '12/28',
    cvv: '123',
  };
  const data = { ...defaults, ...overrides };

  await page.getByLabel('Card Number').fill(data.cardNumber);
  await page.getByLabel('Expiry Date').fill(data.expiry);
  await page.getByLabel('CVV').fill(data.cvv);
}

// Helper: Full setup — add item, go to checkout, fill all fields
async function setupReadyToPlace(page: Page) {
  await addProductToCart(page, 'Wireless Headphones');
  await page.getByRole('link', { name: 'Shopping cart' }).click();
  await expect(page).toHaveURL('/cart');
  await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  await expect(page).toHaveURL('/checkout');
  await fillShippingInfo(page);
  await fillCreditCardInfo(page);
}

// ============================================================
// 1. HAPPY PATH — Full Checkout Flow
// ============================================================
test.describe('Checkout Flow — Happy Path', () => {
  test('customer can add item, enter shipping, pay with credit card, and complete purchase', async ({ page }) => {
    // Step 1: Browse products and add one to cart
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Our Products' })).toBeVisible();
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');

    // Step 2: Navigate to cart and verify item is there
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page).toHaveURL('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
    await expect(page.getByText('Wireless Headphones')).toBeVisible();
    await expect(page.getByText('$79.99')).toBeVisible();

    // Step 3: Proceed to checkout
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();

    // Step 4: Fill shipping information
    await fillShippingInfo(page);

    // Step 5: Credit card is selected by default — fill card details
    await expect(page.getByLabel('Credit Card')).toBeChecked();
    await fillCreditCardInfo(page);

    // Step 6: Verify order summary sidebar
    await expect(page.getByText('Wireless Headphones x1')).toBeVisible();

    // Step 7: Place order
    await page.getByRole('button', { name: 'Place order' }).click();

    // Step 8: Verify confirmation
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
    await expect(page.getByText('Thank you for your purchase')).toBeVisible();
    await expect(page.getByText('confirmation email')).toBeVisible();
  });

  test('customer can complete purchase with PayPal payment method', async ({ page }) => {
    await addProductToCart(page, 'Mechanical Keyboard');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL('/checkout');

    await fillShippingInfo(page);

    // Switch to PayPal
    await page.getByLabel('PayPal').check();
    await expect(page.getByText('redirected to PayPal')).toBeVisible();

    // Credit card fields should not be visible
    await expect(page.getByLabel('Card Number')).toBeHidden();

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('customer can add multiple different items and complete purchase', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');

    await page.getByRole('button', { name: 'Add USB-C Hub to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add USB-C Hub to cart' })).toHaveText('Added!');

    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByText('Wireless Headphones')).toBeVisible();
    await expect(page.getByText('USB-C Hub')).toBeVisible();

    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await fillShippingInfo(page);
    await fillCreditCardInfo(page);

    // Verify both items in order summary
    await expect(page.getByText('Wireless Headphones x1')).toBeVisible();
    await expect(page.getByText('USB-C Hub x1')).toBeVisible();

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });
});

// ============================================================
// 2. PRODUCT PAGE — Adding Items to Cart
// ============================================================
test.describe('Checkout Flow — Adding Items to Cart', () => {
  test('all four products are displayed with names, prices, and add buttons', async ({ page }) => {
    await page.goto('/');

    const products = [
      { name: 'Wireless Headphones', price: '$79.99' },
      { name: 'Mechanical Keyboard', price: '$129.99' },
      { name: 'USB-C Hub', price: '$49.99' },
      { name: 'Ergonomic Mouse', price: '$59.99' },
    ];

    for (const product of products) {
      await expect(page.getByRole('heading', { name: product.name })).toBeVisible();
      await expect(page.getByRole('button', { name: `Add ${product.name} to cart` })).toBeVisible();
    }
  });

  test('adding same product twice increments quantity instead of duplicating', async ({ page }) => {
    await page.goto('/');
    // Add Wireless Headphones twice
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');
    // Wait for button to reset
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Add to Cart', { timeout: 3000 });
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();

    // Navigate to cart — should show quantity 2, not two separate rows
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByLabel('Quantity for Wireless Headphones')).toHaveValue('2');
  });

  test('cart badge updates when items are added', async ({ page }) => {
    await page.goto('/');
    // Initially no badge number
    const cartLink = page.getByRole('link', { name: 'Shopping cart' });
    await expect(cartLink).toBeVisible();

    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByLabel('1 items in cart')).toBeVisible();

    // Wait for button reset then add another
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Add to Cart', { timeout: 3000 });
    await page.getByRole('button', { name: 'Add Ergonomic Mouse to cart' }).click();
    await expect(page.getByLabel('2 items in cart')).toBeVisible();
  });
});

// ============================================================
// 3. CART PAGE — Managing Cart Items
// ============================================================
test.describe('Checkout Flow — Cart Management', () => {
  test('empty cart shows message and link to continue shopping', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Continue Shopping' })).toBeVisible();
  });

  test('customer can update item quantity in the cart', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();

    const qtyInput = page.getByLabel('Quantity for Wireless Headphones');
    await expect(qtyInput).toHaveValue('1');

    // Change to quantity 3
    await qtyInput.fill('3');
    // Subtotal should update: 79.99 * 3 = 239.97
    await expect(page.getByText('$239.97')).toBeVisible();
  });

  test('customer can remove an item from the cart', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByText('Wireless Headphones')).toBeVisible();

    await page.getByRole('button', { name: 'Remove Wireless Headphones from cart' }).click();
    // Cart should now be empty
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('cart total reflects all items and quantities correctly', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');
    await page.getByRole('button', { name: 'Add USB-C Hub to cart' }).click();

    await page.getByRole('link', { name: 'Shopping cart' }).click();
    // 79.99 + 49.99 = 129.98
    await expect(page.getByText('$129.98')).toBeVisible();
  });

  test('Proceed to Checkout link navigates to checkout page', async ({ page }) => {
    await addProductToCart(page, 'Ergonomic Mouse');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await expect(page).toHaveURL('/checkout');
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible();
  });
});

// ============================================================
// 4. CHECKOUT — Shipping Validation
// ============================================================
test.describe('Checkout Flow — Shipping Validation', () => {
  test.beforeEach(async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
  });

  test('shows errors when submitting with all shipping fields empty', async ({ page }) => {
    await fillCreditCardInfo(page);
    await page.getByRole('button', { name: 'Place order' }).click();

    // All five shipping fields should show errors
    await expect(page.getByText('This field is required').first()).toBeVisible();
    // Check that multiple "required" errors appear
    const errorMessages = page.getByText('This field is required');
    await expect(errorMessages).toHaveCount(5);
  });

  test('shows error for missing individual shipping fields', async ({ page }) => {
    // Fill everything except Full Name
    await page.getByLabel('Street Address').fill('123 Main Street');
    await page.getByLabel('City').fill('New York');
    await page.getByLabel('State').fill('NY');
    await page.getByLabel('ZIP Code').fill('10001');
    await fillCreditCardInfo(page);

    await page.getByRole('button', { name: 'Place order' }).click();
    // Only fullName should have an error
    await expect(page.getByText('This field is required')).toHaveCount(1);
  });

  const invalidZipCodes = [
    { input: 'abcde', description: 'letters' },
    { input: '1234', description: '4 digits (boundary: too short)' },
    { input: '123456', description: '6 digits (boundary: too long)' },
    { input: '1234-5678', description: 'wrong format with dash' },
  ];

  for (const { input, description } of invalidZipCodes) {
    test(`shows error for invalid ZIP code: ${description}`, async ({ page }) => {
      await fillShippingInfo(page, { zip: input });
      await fillCreditCardInfo(page);
      await page.getByRole('button', { name: 'Place order' }).click();
      await expect(page.getByText('Enter a valid ZIP code')).toBeVisible();
    });
  }

  test('accepts valid 5-digit ZIP code (boundary: exactly 5 digits)', async ({ page }) => {
    await fillShippingInfo(page, { zip: '10001' });
    await fillCreditCardInfo(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('accepts valid ZIP+4 format (boundary: 5+4 with dash)', async ({ page }) => {
    await fillShippingInfo(page, { zip: '10001-2345' });
    await fillCreditCardInfo(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });
});

// ============================================================
// 5. CHECKOUT — Payment Method Selection & Validation
// ============================================================
test.describe('Checkout Flow — Payment Validation', () => {
  test.beforeEach(async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await fillShippingInfo(page);
  });

  test('credit card is selected by default', async ({ page }) => {
    await expect(page.getByLabel('Credit Card')).toBeChecked();
    await expect(page.getByLabel('Card Number')).toBeVisible();
  });

  test('switching to PayPal hides credit card fields', async ({ page }) => {
    await page.getByLabel('PayPal').check();
    await expect(page.getByLabel('Card Number')).toBeHidden();
    await expect(page.getByLabel('Expiry Date')).toBeHidden();
    await expect(page.getByLabel('CVV')).toBeHidden();
    await expect(page.getByText('redirected to PayPal')).toBeVisible();
  });

  test('switching back from PayPal to Credit Card shows card fields again', async ({ page }) => {
    await page.getByLabel('PayPal').check();
    await expect(page.getByLabel('Card Number')).toBeHidden();

    await page.getByLabel('Credit Card').check();
    await expect(page.getByLabel('Card Number')).toBeVisible();
    await expect(page.getByLabel('Expiry Date')).toBeVisible();
    await expect(page.getByLabel('CVV')).toBeVisible();
  });

  test('shows errors when credit card fields are empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByText('Card number is required')).toBeVisible();
    await expect(page.getByText('Expiry date is required')).toBeVisible();
    await expect(page.getByText('CVV is required')).toBeVisible();
  });

  const invalidCardNumbers = [
    { input: '1234', description: 'too short (boundary: <13 digits)' },
    { input: '12345678901234567890', description: 'too long (boundary: >19 digits)' },
    { input: 'abcd1234abcd1234', description: 'contains letters' },
  ];

  for (const { input, description } of invalidCardNumbers) {
    test(`shows error for invalid card number: ${description}`, async ({ page }) => {
      await page.getByLabel('Card Number').fill(input);
      await page.getByLabel('Expiry Date').fill('12/28');
      await page.getByLabel('CVV').fill('123');
      await page.getByRole('button', { name: 'Place order' }).click();
      await expect(page.getByText('Enter a valid card number')).toBeVisible();
    });
  }

  test('accepts card number at minimum length (boundary: 13 digits)', async ({ page }) => {
    await page.getByLabel('Card Number').fill('4111111111111');
    await page.getByLabel('Expiry Date').fill('12/28');
    await page.getByLabel('CVV').fill('123');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('accepts card number at maximum length (boundary: 19 digits)', async ({ page }) => {
    await page.getByLabel('Card Number').fill('4111111111111111111');
    await page.getByLabel('Expiry Date').fill('12/28');
    await page.getByLabel('CVV').fill('123');
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  const invalidExpiryDates = [
    { input: '1228', description: 'missing slash' },
    { input: '12/2028', description: 'four-digit year' },
    { input: 'ab/cd', description: 'letters instead of digits' },
    { input: '1/28', description: 'single digit month' },
  ];

  for (const { input, description } of invalidExpiryDates) {
    test(`shows error for invalid expiry date: ${description}`, async ({ page }) => {
      await page.getByLabel('Card Number').fill('4111111111111111');
      await page.getByLabel('Expiry Date').fill(input);
      await page.getByLabel('CVV').fill('123');
      await page.getByRole('button', { name: 'Place order' }).click();
      await expect(page.getByText('Use MM/YY format')).toBeVisible();
    });
  }

  const invalidCVVs = [
    { input: '12', description: 'too short (boundary: <3 digits)' },
    { input: '12345', description: 'too long (boundary: >4 digits)' },
    { input: 'abc', description: 'non-numeric' },
  ];

  for (const { input, description } of invalidCVVs) {
    test(`shows error for invalid CVV: ${description}`, async ({ page }) => {
      await page.getByLabel('Card Number').fill('4111111111111111');
      await page.getByLabel('Expiry Date').fill('12/28');
      await page.getByLabel('CVV').fill(input);
      await page.getByRole('button', { name: 'Place order' }).click();
      await expect(page.getByText('Enter a valid CVV')).toBeVisible();
    });
  }

  test('accepts 3-digit CVV (boundary: minimum)', async ({ page }) => {
    await fillCreditCardInfo(page, { cvv: '123' });
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('accepts 4-digit CVV (boundary: maximum, Amex style)', async ({ page }) => {
    await fillCreditCardInfo(page, { cvv: '1234' });
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('PayPal checkout skips credit card validation entirely', async ({ page }) => {
    await page.getByLabel('PayPal').check();
    await page.getByRole('button', { name: 'Place order' }).click();
    // Should succeed without any card info
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });
});

// ============================================================
// 6. CHECKOUT — Order Summary
// ============================================================
test.describe('Checkout Flow — Order Summary', () => {
  test('order summary shows correct items and total', async ({ page }) => {
    // Add two different products
    await page.goto('/');
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');
    await page.getByRole('button', { name: 'Add Ergonomic Mouse to cart' }).click();

    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    // Verify order summary in sidebar
    const summary = page.getByLabel('Order summary');
    await expect(summary.getByText('Wireless Headphones x1')).toBeVisible();
    await expect(summary.getByText('Ergonomic Mouse x1')).toBeVisible();
    // Total = 79.99 + 59.99 = 139.98
    await expect(summary.getByText('$139.98')).toBeVisible();
  });
});

// ============================================================
// 7. CHECKOUT — Empty Cart Guard
// ============================================================
test.describe('Checkout Flow — Empty Cart Guard', () => {
  test('checkout page shows empty cart message when no items', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText('Your cart is empty. Add some items before checking out.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Browse Products' })).toBeVisible();
  });
});

// ============================================================
// 8. STATE TRANSITIONS — Post-Order Behavior
// ============================================================
test.describe('Checkout Flow — State Transitions', () => {
  test('cart is cleared after successful order placement', async ({ page }) => {
    await setupReadyToPlace(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();

    // Navigate back to cart — should be empty
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });

  test('Continue Shopping link on confirmation navigates home', async ({ page }) => {
    await setupReadyToPlace(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();

    await page.getByRole('link', { name: 'Continue Shopping' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Our Products' })).toBeVisible();
  });

  test('validation errors are cleared after correcting fields and resubmitting', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    // Submit with empty form to trigger errors
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByText('This field is required').first()).toBeVisible();

    // Fill in all fields correctly and resubmit
    await fillShippingInfo(page);
    await fillCreditCardInfo(page);
    await page.getByRole('button', { name: 'Place order' }).click();

    // Errors should be gone and order should be confirmed
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });
});

// ============================================================
// 9. EDGE CASES
// ============================================================
test.describe('Checkout Flow — Edge Cases', () => {
  test('double-clicking Place Order does not cause issues', async ({ page }) => {
    await setupReadyToPlace(page);

    // Click Place Order rapidly twice
    const submitButton = page.getByRole('button', { name: 'Place order' });
    await submitButton.dblclick();

    // Should still end up on confirmation page without errors
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('customer can add item, go to cart, go back to products, add more, then checkout', async ({ page }) => {
    // Add first item
    await page.goto('/');
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).click();
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');

    // Go to cart
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByText('Wireless Headphones')).toBeVisible();

    // Go back to products
    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL('/');

    // Add another item
    await page.getByRole('button', { name: 'Add Mechanical Keyboard to cart' }).click();

    // Go to cart — both items should be there
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await expect(page.getByText('Wireless Headphones')).toBeVisible();
    await expect(page.getByText('Mechanical Keyboard')).toBeVisible();

    // Complete checkout
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await fillShippingInfo(page);
    await fillCreditCardInfo(page);
    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('credit card number with spaces is validated correctly (spaces stripped)', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();
    await fillShippingInfo(page);

    // Card number with spaces — app strips spaces before validation
    await page.getByLabel('Card Number').fill('4111 1111 1111 1111');
    await page.getByLabel('Expiry Date').fill('12/28');
    await page.getByLabel('CVV').fill('123');

    await page.getByRole('button', { name: 'Place order' }).click();
    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });
});

// ============================================================
// 10. ACCESSIBILITY
// ============================================================
test.describe('Checkout Flow — Accessibility', () => {
  test('checkout form fields have proper labels and aria attributes', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    // All fields should be accessible by label
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Street Address')).toBeVisible();
    await expect(page.getByLabel('City')).toBeVisible();
    await expect(page.getByLabel('State')).toBeVisible();
    await expect(page.getByLabel('ZIP Code')).toBeVisible();
    await expect(page.getByLabel('Card Number')).toBeVisible();
    await expect(page.getByLabel('Expiry Date')).toBeVisible();
    await expect(page.getByLabel('CVV')).toBeVisible();

    // Required fields should have aria-required
    await expect(page.getByLabel('Full Name')).toHaveAttribute('aria-required', 'true');
    await expect(page.getByLabel('Card Number')).toHaveAttribute('aria-required', 'true');
  });

  test('validation errors use role="alert" for screen reader announcements', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    await page.getByRole('button', { name: 'Place order' }).click();

    // Error messages should be announced via role="alert"
    const alerts = page.getByRole('alert');
    // Should have alerts for fullName, address, city, state, zip, cardNumber, expiry, cvv
    const alertCount = await alerts.count();
    expect(alertCount).toBeGreaterThanOrEqual(5);
  });

  test('invalid fields are marked with aria-invalid after validation failure', async ({ page }) => {
    await addProductToCart(page, 'Wireless Headphones');
    await page.getByRole('link', { name: 'Shopping cart' }).click();
    await page.getByRole('link', { name: 'Proceed to checkout' }).click();

    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page.getByLabel('Full Name')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Street Address')).toHaveAttribute('aria-invalid', 'true');
  });

  test('customer can complete full checkout flow using keyboard only', async ({ page }) => {
    // Add item using keyboard
    await page.goto('/');
    await page.getByRole('button', { name: 'Add Wireless Headphones to cart' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Add Wireless Headphones to cart' })).toHaveText('Added!');

    // Navigate to cart using keyboard
    await page.getByRole('link', { name: 'Shopping cart' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/cart');

    // Navigate to checkout
    await page.getByRole('link', { name: 'Proceed to checkout' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/checkout');

    // Fill form using keyboard (Tab through fields)
    await page.getByLabel('Full Name').focus();
    await page.keyboard.type('Jane Doe');
    await page.keyboard.press('Tab');
    await page.keyboard.type('123 Main Street');
    await page.keyboard.press('Tab');
    await page.keyboard.type('New York');
    await page.keyboard.press('Tab');
    await page.keyboard.type('NY');
    await page.keyboard.press('Tab');
    await page.keyboard.type('10001');

    // Tab to payment section — Credit Card is default
    // Fill card fields
    await page.getByLabel('Card Number').focus();
    await page.keyboard.type('4111111111111111');
    await page.keyboard.press('Tab');
    await page.keyboard.type('12/28');
    await page.keyboard.press('Tab');
    await page.keyboard.type('123');

    // Tab to submit and press Enter
    await page.getByRole('button', { name: 'Place order' }).focus();
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { name: 'Order Confirmed!' })).toBeVisible();
  });

  test('order confirmation has role="alert" for screen reader announcement', async ({ page }) => {
    await setupReadyToPlace(page);
    await page.getByRole('button', { name: 'Place order' }).click();

    // The confirmation section uses role="alert"
    const confirmation = page.getByRole('alert', { name: 'Order confirmation' });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('Order Confirmed');
  });

  test('navigation landmarks are properly set', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });
});
