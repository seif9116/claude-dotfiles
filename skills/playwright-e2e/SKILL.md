---
name: playwright-e2e
description: "Write comprehensive Playwright E2E tests that fully cover user stories. Use this skill whenever the user asks to write E2E tests, end-to-end tests, integration tests with Playwright, browser tests, or wants to test a user story, user flow, or feature with Playwright. Also trigger when the user says 'test this feature', 'write tests for this page', 'cover this user story with tests', 'add E2E tests', 'playwright tests', or mentions testing login flows, checkout flows, form submissions, or any user-facing workflow. Even if they just say 'test this' in a project that uses Playwright, use this skill."
---

# Playwright E2E Testing

Write comprehensive, reliable E2E tests with Playwright that fully cover user stories from the user's perspective.

## Philosophy

E2E tests verify that real users can complete real workflows. Every test should answer: "Can a user accomplish this goal?" not "Does this implementation detail work?" This means:

- Test what users see and do (clicks, typing, navigation), not internal state
- A user story is only covered when its happy path, edge cases, error states, and accessibility are all tested
- Flaky tests erode trust faster than missing tests. Reliability is non-negotiable.

## Step 1: Understand the Codebase

Before writing any tests, understand the project's Playwright setup:

1. **Find the config**: Look for `playwright.config.ts` (or `.js`). Note the `testDir`, `baseURL`, `projects` (browsers), `webServer`, and any custom fixtures.
2. **Find existing tests**: Glob for `**/*.spec.ts`, `**/*.test.ts`, `**/e2e/**`. Read 2-3 existing tests to understand the project's patterns — do they use Page Object Model? Custom fixtures? What assertion style?
3. **Find existing page objects/fixtures**: Check for `pages/`, `fixtures/`, `utils/` directories near the test directory.
4. **Match existing conventions**: If the project uses POM, use POM. If they use custom fixtures, extend them. If they have a helper for login, use it. Don't introduce patterns the project doesn't already use unless there's a good reason.

## Step 2: Decompose the User Story

This is the most important step. A user story like "As a user, I can reset my password" hides a dozen test scenarios. Systematically extract them:

### The Coverage Matrix

For each user story, think through these dimensions:

**Happy path**: The straightforward success case. "User enters email, gets reset link, clicks it, sets new password, can log in with it." This is the minimum — not the goal.

**Input variations** (equivalence partitioning): Group inputs into classes that should behave the same way, then test one from each class. For a password field: valid password, too-short password, password without special chars, empty field. Don't test every possible string — test one representative from each equivalence class.

**Boundary values**: Test at the edges of valid ranges. If password must be 8-64 chars, test with 7, 8, 64, and 65 characters. If a list paginates at 20 items, test with 19, 20, and 21.

**Error states**: What happens when things go wrong? Invalid email format, expired reset link, network failure, server returning 500. Users will hit these — tests should too.

**State transitions**: What states can the UI be in, and how does it move between them? A form might be: empty -> partially filled -> submitted -> loading -> success/error. Test that transitions work correctly and that the UI reflects each state.

**Concurrency and timing**: Can the user double-click submit? What if they navigate away during a loading state? What if they open the reset link in two tabs?

**Accessibility**: Can a keyboard-only user complete the flow? Are error messages announced to screen readers? Do form fields have proper labels?

### Prioritization

Not every combination needs a test. Prioritize by:
1. **User impact**: How many users will hit this? How bad is the failure?
2. **Likelihood of regression**: Does this code change often? Is it complex?
3. **Difficulty to catch otherwise**: Would a unit test catch this? If yes, skip the E2E test.

Present your test plan to the user before writing code. Something like:

```
Here's my plan for testing the password reset flow:

Happy path:
- Complete password reset via email link

Validation:
- Submit with empty email field
- Submit with invalid email format
- New password too short (boundary: 7 chars)
- New password at minimum length (boundary: 8 chars)

Error handling:
- Expired reset link
- Already-used reset link
- Non-existent email (should still show success for security)

Edge cases:
- Double-click submit button
- Navigate back during loading

Accessibility:
- Full keyboard navigation through the flow
- Error messages associated with form fields

Does this look right, or should I add/remove anything?
```

## Step 3: Write the Tests

### Test Structure

Organize tests by user story or feature, not by page:

```typescript
// Good: organized by what the user is trying to do
test.describe('Password Reset', () => {
  test.describe('happy path', () => {
    test('user can reset password via email link', async ({ page }) => { ... });
  });

  test.describe('validation', () => {
    test('shows error when email is empty', async ({ page }) => { ... });
    test('shows error for invalid email format', async ({ page }) => { ... });
  });

  test.describe('error handling', () => {
    test('shows expiration message for old reset link', async ({ page }) => { ... });
  });
});
```

### Locators: User-Facing, Always

Use Playwright's semantic locators in this priority order. These reflect how users and assistive technologies find elements, and they survive DOM restructuring:

1. `page.getByRole('button', { name: 'Submit' })` — best: matches accessibility tree
2. `page.getByLabel('Email address')` — great for form fields
3. `page.getByPlaceholder('Enter your email')` — when label is missing
4. `page.getByText('Password reset successful')` — for content assertions
5. `page.getByTestId('reset-form')` — last resort when semantic options are ambiguous

Never use CSS selectors (`.btn-primary`) or XPath. These break when styling or structure changes and tell you nothing about what the user actually sees.

### Assertions: Web-First, Always

Use Playwright's auto-retrying assertions. They wait for the condition to be true, which eliminates flakiness from timing issues:

```typescript
// Good: auto-retries until the condition is met or timeout
await expect(page.getByText('Password updated')).toBeVisible();
await expect(page).toHaveURL('/login');
await expect(page.getByRole('alert')).toHaveText('Invalid email');

// Bad: checks once and moves on — race condition waiting to happen
const isVisible = await page.getByText('Password updated').isVisible();
expect(isVisible).toBe(true);
```

Key assertions to know:
- `toBeVisible()`, `toBeHidden()` — element visibility
- `toHaveText()`, `toContainText()` — text content
- `toHaveURL()` — navigation completed
- `toHaveValue()` — form field values
- `toBeEnabled()`, `toBeDisabled()` — interactive state
- `toHaveCount()` — number of matching elements
- `toHaveAttribute()` — HTML attributes
- `toHaveScreenshot()` — visual regression (use sparingly)

Use `expect.soft()` when you want to check multiple things without stopping at the first failure — useful for validation tests where you want to see all failures at once.

### Test Isolation

Each test must be independent. No test should depend on another test's side effects.

- Playwright gives each test a fresh `BrowserContext` — leverage this
- Set up state via API calls in `beforeEach`, not by running other tests
- If multiple tests need a logged-in user, use a setup project or `storageState` to reuse auth without repeating the login flow in every test

```typescript
// Use API to set up state directly — faster and more reliable than UI setup
test.beforeEach(async ({ request }) => {
  await request.post('/api/test/seed', { data: { user: 'testuser' } });
});
```

### Network Control

Mock external dependencies. Your tests should not fail because a third-party API is down:

```typescript
// Mock a payment gateway
await page.route('**/api/payment/charge', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, transactionId: 'test-123' }),
  });
});
```

But don't mock your own backend unless you have a specific reason. E2E tests are valuable precisely because they test the full stack.

### Accessibility Testing

Integrate `@axe-core/playwright` for automated accessibility checks. This catches ~57% of accessibility issues by volume — not everything, but a strong baseline:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('password reset page meets WCAG 2.1 AA', async ({ page }) => {
  await page.goto('/reset-password');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

Also test keyboard navigation manually:

```typescript
test('can complete reset flow with keyboard only', async ({ page }) => {
  await page.goto('/reset-password');
  await page.getByLabel('Email').focus();
  await page.keyboard.type('user@example.com');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter'); // Submit button
  await expect(page.getByText('Check your email')).toBeVisible();
});
```

### Visual Regression (When Appropriate)

Use `toHaveScreenshot()` for UI components where visual appearance is critical. Reduce flakiness by:

```typescript
test('error state looks correct', async ({ page }) => {
  await page.goto('/reset-password');
  await page.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByRole('form')).toHaveScreenshot('reset-error-state.png', {
    maxDiffPixelRatio: 0.01,
    animations: 'disabled',
    mask: [page.locator('.dynamic-timestamp')], // mask changing content
  });
});
```

Don't screenshot everything. Visual tests are slow, generate large artifacts, and break on legitimate design changes. Use them for specific visual behaviors that can't be asserted otherwise.

### Data-Driven Tests

When testing multiple input variations from the same equivalence class, use parameterized tests instead of copy-pasting:

```typescript
const invalidEmails = [
  { input: '', error: 'Email is required' },
  { input: 'not-an-email', error: 'Invalid email format' },
  { input: 'missing@domain', error: 'Invalid email format' },
];

for (const { input, error } of invalidEmails) {
  test(`shows error for email: "${input}"`, async ({ page }) => {
    await page.goto('/reset-password');
    if (input) await page.getByLabel('Email').fill(input);
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByRole('alert')).toContainText(error);
  });
}
```

## Step 4: Page Object Model (When the Project Uses It)

If the project already uses POM, follow the same pattern. If starting fresh with many tests for the same pages, introduce POM to reduce duplication:

```typescript
// pages/reset-password.page.ts
import { type Locator, type Page, expect } from '@playwright/test';

export class ResetPasswordPage {
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly successMessage: Locator;
  readonly errorAlert: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByLabel('Email address');
    this.submitButton = page.getByRole('button', { name: 'Send reset link' });
    this.successMessage = page.getByText('Check your email');
    this.errorAlert = page.getByRole('alert');
  }

  async goto() {
    await this.page.goto('/reset-password');
  }

  async requestReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
  }

  async expectError(message: string) {
    await expect(this.errorAlert).toContainText(message);
  }
}
```

Design page objects around user intents (what the user is trying to do), not page structure (what elements exist). Methods like `requestReset(email)` read better than `fillEmailAndClickSubmit()`.

## Step 5: Configuration

If the project doesn't have a Playwright config yet, create one with sensible defaults:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

Adjust to match the project's setup (port, dev command, etc.).

## Anti-Patterns to Avoid

**Hard-coded waits**: Never use `await page.waitForTimeout(2000)`. Use auto-waiting locators and assertions instead. If you're tempted to wait, you probably need a better assertion.

**Testing implementation details**: Don't assert on CSS classes, internal state, or DOM structure. If a test breaks because someone renamed a CSS class, it was testing the wrong thing.

**E2E for unit-testable logic**: Don't use Playwright to test that `calculateTotal(items)` returns the right number. That's a unit test. Use E2E for the flow: "user adds items to cart and sees correct total."

**Shared state between tests**: If test B only passes when test A runs first, both tests are broken. Fix the setup.

**Testing third-party services**: Don't test that Stripe actually charges a card. Mock the Stripe API and test that your integration sends the right request and handles the response.

**Massive god-tests**: A test that navigates through 15 pages and asserts 40 things is impossible to debug. Break it into focused tests per user story.

## Documentation

Before using unfamiliar Playwright APIs or when unsure about function signatures, look up the current docs:
- Use context7 to fetch docs for `playwright` (resolve the library ID first, then query specific topics)
- Official docs: https://playwright.dev/docs/intro

The patterns in this skill reflect current best practices, but for API details (parameters, return types, new features), always verify against current documentation. Playwright releases frequently and adds new capabilities.

## Checklist Before Finishing

Before declaring tests complete, verify:

- [ ] Every acceptance criterion from the user story has at least one test
- [ ] Happy path is covered end-to-end
- [ ] Error states are tested (validation errors, server errors, network failures)
- [ ] Boundary values are tested for numeric/string inputs
- [ ] Tests use semantic locators (getByRole, getByLabel, getByText)
- [ ] Assertions use web-first auto-retrying methods (toBeVisible, not isVisible)
- [ ] No hard-coded waits (waitForTimeout)
- [ ] Tests are independent — can run in any order
- [ ] External APIs are mocked
- [ ] Accessibility check is included (axe-core or keyboard navigation)
- [ ] Test names describe the user behavior being verified
- [ ] Tests match the project's existing conventions and patterns
