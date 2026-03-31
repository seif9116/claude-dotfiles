# Test Plan Transcript — E-commerce Checkout Flow E2E Tests

## Codebase Analysis

The application is a Next.js 14 e-commerce storefront with three pages:

1. **Home page (`/`)** — Displays 4 hardcoded products (Wireless Headphones $79.99, Mechanical Keyboard $129.99, USB-C Hub $49.99, Ergonomic Mouse $59.99). Each has an "Add to Cart" button that shows "Added!" feedback for 1.5 seconds.

2. **Cart page (`/cart`)** — Shows a table of cart items with columns: Product, Price, Quantity (editable numeric input), Subtotal, Actions (Remove button). Shows an empty-cart message when no items. Has a "Proceed to Checkout" link and displays the total price.

3. **Checkout page (`/checkout`)** — Has three states:
   - Empty cart guard: shows "Your cart is empty" with a link to browse products.
   - Checkout form: shipping fields (Full Name, Street Address, City, State, ZIP Code) + payment method (Credit Card with card number/expiry/CVV, or PayPal) + order summary sidebar + Place Order button.
   - Order confirmation: shows "Order Confirmed!" with thank-you message and clears the cart.

State management uses React Context (`CartProvider`) in the root layout. Cart state is purely client-side (no persistence). The layout includes a header with nav (ShopDemo brand, Products link, Cart link with badge) and a footer.

## User Story Decomposition

The user story: "As a customer, I can add items to my cart, enter shipping info, choose a payment method, and complete my purchase."

This breaks down into:

1. **Add items to cart** — Browse products, click "Add to Cart", see feedback, verify cart badge updates.
2. **View and manage cart** — See items in cart, change quantities, remove items, see totals, proceed to checkout.
3. **Enter shipping info** — Fill out the 5 shipping fields with validation (required + ZIP format).
4. **Choose a payment method** — Select Credit Card (with card number, expiry, CVV validation) or PayPal (no card fields needed).
5. **Complete purchase** — Submit form, see "Order Confirmed!" confirmation, cart cleared.

## Test Plan

### Test Categories

I organized tests into 12 test.describe blocks:

1. **Product listing page** (4 tests) — Verifies product display, Add to Cart feedback, cart badge updating, and duplicate-add behavior (quantity increment).

2. **Cart page** (5 tests) — Empty state, item display, quantity editing with subtotal recalculation, item removal, multi-item totals, and the Proceed to Checkout link.

3. **Checkout page — empty cart guard** (1 test) — Visiting /checkout directly with an empty cart shows the empty message and Browse Products link.

4. **Checkout — shipping validation** (3 tests) — Required fields, invalid ZIP code, and valid ZIP+4 format acceptance.

5. **Checkout — credit card validation** (4 tests) — Invalid card number, invalid expiry format, invalid CVV (too short), and valid 4-digit CVV acceptance.

6. **Checkout — PayPal** (3 tests) — Switching to PayPal hides card fields and shows message, PayPal submission succeeds without card fields, switching back shows card fields.

7. **Checkout — order summary sidebar** (1 test) — Verifies items, quantities, line totals, and order total in the sidebar.

8. **Complete checkout happy path** (2 tests) — Full credit card flow and full PayPal flow, both verifying confirmation and cart clearing.

9. **Full end-to-end journey** (1 test) — The most comprehensive test: adds 3 products, adjusts quantity, removes one, verifies totals at each step, fills all checkout fields, places order, confirms success.

10. **Navigation and layout** (4 tests) — Header elements, footer copyright, Products link navigation, brand link navigation.

11. **Accessibility smoke checks** (4 tests) — ARIA roles on product listing, form label associations, table scope attributes, alert role on confirmation.

12. **Edge cases** (2 tests) — Whitespace-only field submission, duplicate product addition creates one row with incremented quantity.

### Total: 34 tests

## Design Decisions

### Why these specific tests?

- **Happy paths first**: The two complete checkout flows (credit card and PayPal) directly verify the user story end-to-end.
- **Validation coverage**: The form has 8+ fields with distinct validation rules (required, ZIP regex, card number length, expiry format MM/YY, CVV 3-4 digits). Each rule gets at least one positive and one negative test.
- **State management**: Cart state is client-side React Context. Tests verify that state flows correctly across page navigations (add on home -> visible in cart -> carried to checkout -> cleared on confirmation).
- **Guard states**: Both the cart and checkout pages have empty-state guards. These are common user paths (bookmarking /checkout, etc.) that should be tested.
- **Payment method toggling**: The conditional rendering of credit card vs PayPal fields is a common source of bugs (fields not clearing, validation still applying to hidden fields, etc.).

### Why a single file?

The application is small (3 pages, ~420 lines of source code total). A single well-organized file with descriptive `test.describe` blocks is more maintainable than scattering 5+ files for this size of app. The helper functions at the top reduce duplication.

### Selector strategy

I used Playwright's recommended selector priority:
1. **`getByLabel()`** — for form inputs and ARIA-labeled elements (most of the app uses aria-label)
2. **`getByRole()`** — for buttons, links, headings, tables, navigation landmarks
3. **`getByText()`** — for content verification (confirmation messages, error messages)
4. **`locator('#id')`** — only for error message elements that have specific IDs (e.g., `#fullName-error`)

This avoids fragile CSS selectors and test-ids that don't exist in the codebase.

### What I intentionally did NOT test

- **Visual regression / screenshot comparisons** — Out of scope for functional E2E tests.
- **Performance / load times** — Would need specific tooling (Lighthouse, etc.).
- **Backend API calls** — The app has no backend; it's purely client-side state.
- **Browser compatibility** — The playwright.config.ts only configures Chromium; cross-browser is a config concern, not a test concern.
- **Mobile responsiveness** — The app uses basic inline styles with CSS grid; no responsive breakpoints to test.
- **Local storage / persistence** — The app doesn't persist cart state; refreshing loses everything. This is a known limitation, not a bug to test.

### Helper function rationale

- `addProductToCart()` — Encapsulates clicking + waiting for "Added!" feedback. Used in ~15 tests.
- `fillShippingInfo()` — Fills 5 fields with sensible defaults, accepts overrides for specific-field testing.
- `fillCreditCardInfo()` — Same pattern for 3 card fields.
- `navigateToCheckoutWithProduct()` — The most-used helper; gets a test to the checkout page with an item in the cart in 4 steps. Without this, every checkout test would have ~8 lines of boilerplate.
