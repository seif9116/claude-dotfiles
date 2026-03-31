# Transcript: Auth Flow E2E Tests

## Step 1: Understanding the Codebase

### What I found

**Playwright config** (`playwright.config.ts`):
- `testDir: ./tests/e2e`
- `baseURL: http://localhost:3000`
- Two browser projects: chromium and firefox
- HTML reporter (open: never)
- webServer runs `npm run dev`
- Retries only on CI, parallel execution enabled

**Existing patterns** (from `login.spec.ts`, `login.page.ts`, `base.page.ts`, `fixtures.ts`):
- **Page Object Model**: All POMs extend `BasePage`, which provides `page`, `heading` locator, `goto()`, `expectHeading()`, and `expectURL()`. Subclasses override a `path` getter.
- **Locator style**: Semantic locators preferred (`getByLabel`, `getByRole`, `getByText`), with `getByTestId` used as fallback for non-semantic elements like error containers.
- **Locators as readonly properties**: Defined in constructor, not created on-the-fly in methods.
- **Assertion methods**: `expect*` methods on POM classes for common assertions (e.g., `expectError(message)`, `expectNoError()`).
- **Fixtures**: Custom fixtures in `fixtures.ts` extend base Playwright `test`. They provide pre-constructed POM instances (`loginPage`) and an `authenticatedPage` with a pre-set auth cookie.
- **Test file conventions**: Tests import from `./fixtures`, use `test.describe` for grouping, `test.beforeEach` for setup, and `page.route()` to mock API responses.
- **Dependencies**: `@axe-core/playwright` is already a devDependency.

**Application pages** I inspected:
- `/signup` - Form with name, email, password, confirm password. Client-side validation for password length (8-64), uppercase+number requirement, and password match. On success, shows "Check your email" message with the user's email. POSTs to `/api/auth/signup`.
- `/verify-email?token=...` - Reads token from URL search params. Three states: loading, success, error. Missing token shows error immediately. POSTs to `/api/auth/verify-email`. Success shows "Continue to log in" link. Error shows "Back to sign up" link.
- `/login` - Email + password form. POSTs to `/api/auth/login`. On success, redirects to `/dashboard`. Error message uses `data-testid="form-error"`.
- `/dashboard` - Fetches `/api/auth/me` on load. Shows user name + email if authenticated. Redirects to `/login` if not. Has logout button and settings link.

## Step 2: Decomposing the User Story

User story: "As a user, I can sign up, verify my email, and log in."

### Acceptance criteria extracted:
1. User can fill out signup form and submit successfully
2. After signup, user sees confirmation to check their email
3. User can click a verification link (with token) and see success
4. After verification, user can navigate to login
5. User can log in with their credentials
6. After login, user lands on the dashboard with their info

### Test plan

**Happy path (1 test):**
- Complete end-to-end flow: signup -> verify email -> navigate to login -> log in -> see dashboard with user info

**Signup validation (12 tests):**
- Form displays all required fields correctly
- Password requirements text is visible
- Password too short (boundary: 7 chars) -- should error
- Password at minimum length (boundary: 8 chars) -- should succeed
- Password too long (boundary: 65 chars) -- should error
- Password at maximum length (boundary: 64 chars) -- should succeed
- Password missing uppercase letter -- should error
- Password missing number -- should error
- Passwords don't match -- should error
- Email already taken (API 409) -- should show server error
- Server error (API 500) -- should show error
- Network failure -- should show generic error
- Navigation to login page from signup

**Parameterized password validation (3 tests):**
- Data-driven tests for representative invalid passwords from each equivalence class

**Email verification (7 tests):**
- Valid token -- success
- Missing token -- error
- Expired token (API 400) -- error
- Invalid token (API 400) -- error
- Network failure -- error
- Error state shows "Back to sign up" link
- Success state "Continue to log in" link navigates to `/login`

**Login after verification (3 tests):**
- Unverified email (API 403) -- specific error message
- Network failure -- generic error
- Navigation to signup page from login

**Edge cases (2 tests):**
- Double-click submit doesn't break the flow
- Success state correctly reflects the submitted email

**Accessibility (5 tests):**
- Signup page passes axe-core WCAG 2.1 AA audit
- Verify email page passes axe-core WCAG 2.1 AA audit
- Signup form completable with keyboard only
- Error messages use `aria-live="assertive"` for screen reader announcement
- Verification page uses `role="status"` with `aria-live="polite"` for state transitions

**Total: 33 tests**

### Why I made these choices

**Happy path as a single end-to-end test**: The user story describes a continuous journey -- signup, verify, login. Testing it as one flow validates that the pages connect properly (e.g., the "Continue to log in" link after verification actually works). This is the highest-value test.

**Boundary value testing on password length**: The code explicitly checks `password.length < 8` and `password.length > 64`. Boundary testing at 7/8 and 64/65 catches off-by-one errors, which are the most common validation bugs.

**Parameterized tests for password rules**: Rather than duplicating test structure for each invalid password class, I used a `for` loop with descriptive labels. This follows the skill's recommendation and the project already uses a clean enough pattern that it fits naturally.

**API mocking for all backend calls**: The existing `login.spec.ts` mocks `**/api/auth/login` with `page.route()`. I followed this exact pattern for signup, verify-email, login, and me endpoints. This keeps tests fast, deterministic, and independent of backend state.

**No mocking of client-side validation**: Password length, uppercase, number, and match checks all happen in the browser before any API call. These tests don't need route mocking because the error appears without a network request.

**Accessibility tests with axe-core**: The project already has `@axe-core/playwright` installed, so I used it. I also added keyboard navigation and ARIA attribute checks because the application uses `role="alert"`, `aria-live`, and `role="status"` -- these are testable and meaningful for screen reader users.

**No visual regression tests**: The app has no complex visual states that would benefit from screenshot comparison. The existing test suite doesn't use them, and adding them would introduce maintenance overhead without clear value.

**Test isolation**: Each test sets up its own state via `beforeEach` or inline POM construction. No test depends on another test's side effects. API routes are mocked per-test.

## Step 3: Files Created

### Page Objects (following existing POM pattern):
- `tests/e2e/pages/signup.page.ts` - SignupPage POM
- `tests/e2e/pages/verify-email.page.ts` - VerifyEmailPage POM
- `tests/e2e/pages/dashboard.page.ts` - DashboardPage POM

### Updated files:
- `tests/e2e/fixtures.ts` - Added signupPage, verifyEmailPage, dashboardPage fixtures

### Test file:
- `tests/e2e/auth-flow.spec.ts` - 33 tests organized by: happy path, signup validation, parameterized validation, email verification, login after verification, edge cases, accessibility

## Checklist Verification

- [x] Every acceptance criterion from the user story has at least one test
- [x] Happy path is covered end-to-end (signup -> verify -> login -> dashboard)
- [x] Error states are tested (validation errors, server errors, network failures)
- [x] Boundary values are tested (password length 7/8/64/65)
- [x] Tests use semantic locators (getByRole, getByLabel, getByText, getByTestId as fallback)
- [x] Assertions use web-first auto-retrying methods (toBeVisible, toContainText, toHaveURL)
- [x] No hard-coded waits (no waitForTimeout)
- [x] Tests are independent -- can run in any order
- [x] External APIs are mocked (all /api/auth/* endpoints)
- [x] Accessibility checks included (axe-core WCAG audit, keyboard navigation, ARIA attributes)
- [x] Test names describe the user behavior being verified
- [x] Tests match the project's existing conventions (POM, fixtures, route mocking, locator style)
