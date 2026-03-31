# Test Planning Transcript

## Understanding the Codebase

I started by reading all existing project files to understand the conventions in use:

### Project structure
- **Next.js 14 app** with App Router (`src/app/`)
- **Playwright** for E2E testing with config in `playwright.config.ts`
- **Page Object Model (POM)** pattern with a `BasePage` base class
- **Custom fixtures** in `tests/e2e/fixtures.ts` that provide page object instances
- Tests live in `tests/e2e/` with `.spec.ts` extension

### Application pages discovered
1. `/signup` - Registration form with name, email, password, confirm password
2. `/verify-email?token=...` - Email verification via token in query string
3. `/login` - Login form with email and password
4. `/dashboard` - Authenticated dashboard showing user info

### Existing patterns I identified and followed
1. **BasePage class**: All page objects extend `BasePage`, which provides `goto()`, `expectHeading()`, `expectURL()`, and a `path` getter override
2. **Locator conventions**: Use `getByLabel()`, `getByRole()`, `getByTestId()` -- semantic/accessible selectors, never CSS selectors
3. **Assertion methods on POMs**: Pages have `expect*` methods (e.g., `expectError()`, `expectNoError()`) so test code reads declaratively
4. **Fixtures**: Each page object is provided as a fixture via `base.extend<T>()`, so tests destructure them from the test arguments
5. **API mocking**: Tests use `page.route()` to intercept API calls and simulate success/failure responses -- no real backend is hit
6. **Test organization**: `test.describe()` blocks group related tests; `test.beforeEach()` navigates to the page under test
7. **Import style**: Tests import `{ test, expect }` from the local `fixtures.ts` file, not from `@playwright/test`

## What I Decided to Test

The user story is: "As a user, I can sign up, verify my email, and log in."

I broke this into three logical groups:

### 1. Signup page tests (isolated)
- **Form renders correctly**: All fields, button, login link, and password requirements hint are visible
- **Client-side validation - password too short**: Passwords under 8 chars trigger an inline error
- **Client-side validation - password missing uppercase/number**: Weak passwords trigger a specific error
- **Client-side validation - password mismatch**: Mismatched password and confirm-password trigger an error
- **Server-side error handling**: When the API returns 409 (email already registered), the error is displayed
- **Happy path**: Successful signup shows the "Check your email" confirmation with the user's email
- **Navigation**: The "Log in" link navigates to `/login`

### 2. Email verification page tests (isolated)
- **Happy path**: Valid token leads to success message and "Continue to log in" link
- **Missing token**: Visiting `/verify-email` without a token shows an appropriate error
- **Invalid/expired token**: API rejection shows the error message from the server
- **Navigation from success**: Clicking "Continue to log in" navigates to `/login`
- **Navigation from error**: Clicking "Back to sign up" navigates to `/signup`

### 3. Full auth flow (end-to-end integration)
- **Complete happy path**: Sign up -> see email prompt -> verify email -> navigate to login -> log in -> land on dashboard with user info displayed
- **Unverified email blocks login**: Sign up succeeds, but attempting to log in without verification shows an error

## Design Decisions

### Why I created new page objects
The project already had `BasePage` and `LoginPage`. I needed `SignupPage` and `VerifyEmailPage` to follow the same pattern. Each page object:
- Extends `BasePage`
- Overrides `path` for `goto()`
- Exposes all interactive elements as `readonly Locator` properties
- Provides action methods (`signup()`, `gotoWithToken()`) and assertion methods (`expectError()`, `expectSuccess()`, `expectSuccessMessage()`)

### Why I extended the fixtures
The existing fixtures file provides `loginPage` as a fixture. I created a parallel fixtures file that adds `signupPage` and `verifyEmailPage` fixtures following the exact same pattern. I also kept `loginPage` and `authenticatedPage` for completeness since the full-flow test needs the login page.

### Why I use API route interception everywhere
The existing `login.spec.ts` uses `page.route()` to mock API responses. This is a deliberate pattern choice in the project -- the E2E tests validate the frontend behavior in isolation from the backend. I followed this consistently:
- `**/api/auth/signup` for signup calls
- `**/api/auth/verify-email` for verification calls
- `**/api/auth/login` for login calls
- `**/api/auth/me` for dashboard user-fetch calls

### Why I included a "blocked login" test
The user story implies a specific flow: signup THEN verify THEN login. I added a negative test showing that skipping the verify step results in a meaningful error. This validates the intended gated flow and is a natural extension of the user story.

### Why I test client-side validation separately
The signup page has three distinct client-side validation rules (password length, password pattern, password match). Each deserves its own test case for clear failure diagnostics. This follows the existing pattern where `login.spec.ts` has separate tests for form display, invalid credentials, and successful login.

### Locator strategy
I followed the project's preference order:
1. `getByLabel()` for form inputs (matches the `<label>` text)
2. `getByRole()` for buttons and links (semantic, accessible)
3. `getByTestId()` for non-interactive elements that need identification (matches `data-testid` attributes already in the markup)
4. `getByText()` only as a last resort for verifying specific text content

## Files Produced

1. **`signup.page.ts`** - Page Object Model for the signup page
2. **`verify-email.page.ts`** - Page Object Model for the email verification page
3. **`fixtures.ts`** - Extended test fixtures providing all page objects
4. **`auth-flow.spec.ts`** - The test specification with 14 test cases across 3 describe blocks
5. **`transcript.md`** - This file

## Test Count Summary

| Describe block | Tests |
|---|---|
| Signup page | 7 |
| Email verification page | 5 |
| Full auth flow: signup -> verify email -> login | 2 |
| **Total** | **14** |
