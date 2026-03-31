# Transcript: Contact Form Playwright E2E Tests

## Step 1: Understanding the Codebase

### Playwright Configuration
- Found `playwright.config.ts` at project root
- `testDir`: `./tests`
- `baseURL`: `http://localhost:5173` (Vite dev server)
- No browser projects specified (defaults to Chromium)
- `webServer` configured to run `npm run dev` for the Vite server
- `retries: 0`, `fullyParallel: true`, `trace: 'on-first-retry'`

### Existing Tests
- The `tests/` directory was empty -- no existing tests, no existing patterns to follow.
- No Page Object Model, no custom fixtures, no utilities.

### Application Structure
- Simple Vite + TypeScript project (no framework like React/Vue)
- Single HTML page at `src/index.html` with inline CSS
- Form logic in `src/main.ts` -- vanilla TypeScript, no backend

### Form Implementation Details (from reading `main.ts` and `index.html`)
- **Name field**: required, minlength 2, maxlength 100
- **Email field**: required, validated with regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- **Message field**: required, minlength 10, maxlength 1000
- **Validation triggers**: on blur (always), on input (only if field was previously marked aria-invalid)
- **Submit behavior**: `e.preventDefault()`, runs `validateAll()`, focuses first invalid field if validation fails
- **Successful submission**: disables button, changes text to "Sending...", waits 500ms (simulated async), then resets form, re-enables button, shows toast
- **Toast**: gets `.visible` class added, auto-removes after 3000ms
- **Accessibility**: `aria-required="true"` on all fields, `aria-describedby` pointing to error `<p>` elements, error elements have `role="alert"` and `aria-live="polite"`, toast has `role="status"` and `aria-live="polite"`
- **No backend**: submission is simulated with `setTimeout`, no API calls to mock

## Step 2: Decomposing the User Story

The user story is: "User can submit a contact form with name, email, and message, and sees a success toast."

### Coverage Matrix

**Happy path:**
- Fill all three fields with valid data, submit, see toast, form resets, button returns to normal
- Toast disappears after a few seconds

**Input variations (equivalence partitioning):**
- Each required field left empty (3 tests)
- All fields empty at once
- Invalid email formats (4 representative cases from different equivalence classes: no @, no TLD, no local part, spaces)
- Valid email format

**Boundary values:**
- Name: 1 char (invalid, below min 2), 2 chars (valid, at min), 100 chars (valid, at max), 101 chars (invalid, above max)
- Message: 9 chars (invalid, below min 10), 10 chars (valid, at min), 1000 chars (valid, at max), 1001 chars (invalid, above max)
- Email: no explicit length boundaries in the regex, so boundary testing focused on structural validity

**Error states:**
- All errors show correct messages (matched against exact strings from main.ts)
- Errors clear when user corrects input (inline validation on input event)
- Errors appear on blur (not while typing in a fresh field)

**State transitions:**
- fresh -> error on blur
- error -> valid on input (auto-clear)
- fresh (no error shown while typing before first blur)
- button: enabled -> disabled+loading -> enabled after submission
- button: stays enabled when validation fails (no submission attempted)
- toast: hidden -> visible -> hidden (auto-dismiss)

**Focus management:**
- First invalid field receives focus on failed submit

**Accessibility:**
- Labels associated with fields (getByLabel works)
- aria-describedby links fields to error messages
- Error containers have role="alert"
- aria-required on all fields
- aria-invalid toggled on/off correctly
- Toast has role="status"
- Full keyboard navigation through the form

**Edge cases:**
- Whitespace-only input treated as empty (validation uses `.trim()`)
- Multiple sequential submissions work correctly
- (Did NOT test double-click because the simulated submission uses setTimeout and the button is immediately disabled, making a true race condition impossible in this implementation)

### Prioritization Decisions

**Included (high user impact or regression risk):**
- All happy path tests -- the core functionality
- All required-field validation -- most common user error
- Boundary values for name and message -- these are the exact edges where bugs live
- Email format validation -- common input error, regex-based validation is error-prone
- Inline validation behavior -- this is the main UX pattern and is somewhat complex (blur vs input triggers)
- Focus management -- critical for accessibility
- aria-invalid toggling -- critical for screen readers
- Keyboard navigation -- accessibility requirement
- All aria attributes -- the form is well-instrumented, tests should verify this
- Whitespace handling -- the code uses `.trim()`, worth verifying
- Multiple submissions -- form reset and re-submission is a realistic user flow

**Excluded (low value or better tested elsewhere):**
- Visual regression screenshots -- overkill for this simple form; the CSS is straightforward
- axe-core automated accessibility scan -- the project doesn't have `@axe-core/playwright` as a dependency and I chose not to add dependencies. Instead, I tested the specific accessibility behaviors (aria attributes, keyboard navigation, focus management, screen reader announcements) directly
- Network failure tests -- there is no real network request; submission is simulated with setTimeout
- Double-click submit -- the button is disabled immediately, so this is not a real risk
- Concurrency (multiple tabs) -- no server state, no session, so this is irrelevant

## Step 3: Writing the Tests

### Conventions Chosen

**No POM:** The project has no existing tests or patterns. With a single page and a single form, introducing POM would be over-engineering. All tests are in one file organized by describe blocks matching the coverage matrix categories.

**Locator strategy:** Followed the skill's priority order:
1. `getByRole('button', { name: 'Send Message' })` for the submit button
2. `getByLabel('Name')`, `getByLabel('Email')`, `getByLabel('Message')` for form fields
3. `getByText(...)` for error messages and toast text
4. `page.locator('#name-error')` and `page.locator('#toast')` used sparingly only when testing specific HTML attributes (role, aria-describedby) where a semantic locator would be circular

**Assertion strategy:** All assertions use Playwright's auto-retrying web-first assertions:
- `toBeVisible()` / `toBeHidden()` for checking element visibility
- `toHaveValue('')` for verifying form reset
- `toBeEnabled()` / `toBeDisabled()` for button state
- `toHaveAttribute()` for aria attributes
- `toBeFocused()` for focus management
- `toHaveText()` for error message content
- No `isVisible()` or manual boolean checks anywhere

**No hard-coded waits:** Zero uses of `waitForTimeout`. The toast disappearance test uses `toBeHidden({ timeout: 5000 })` to give the auto-retrying assertion enough time (toast hides after 3s + 0.3s transition).

**Data-driven tests:** Used parameterized tests for invalid email formats to avoid code duplication while maintaining clear test names.

**Test isolation:** Each test uses `beforeEach` to navigate to `/`. No test depends on another test's state. Playwright provides fresh browser contexts automatically.

### Test Structure (34 tests total)

```
Contact Form
  happy path (2 tests)
    - complete submission flow
    - toast auto-dismisses
  validation - required fields (4 tests)
    - all empty
    - name empty
    - email empty
    - message empty
  validation - name field (4 tests)
    - 1 char (boundary below min)
    - 2 chars (boundary at min)
    - 100 chars (boundary at max)
    - 101 chars (boundary above max)
  validation - email field (5 tests)
    - 4 invalid formats (parameterized)
    - valid format
  validation - message field (4 tests)
    - 9 chars (boundary below min)
    - 10 chars (boundary at min)
    - 1000 chars (boundary at max)
    - 1001 chars (boundary above max)
  inline validation behavior (3 tests)
    - error on blur
    - error clears on valid input
    - no error while typing fresh field
  error states and focus management (3 tests)
    - focuses first invalid field
    - sets aria-invalid
    - removes aria-invalid
  submit button state (2 tests)
    - disabled during submission
    - not disabled on validation failure
  accessibility (6 tests)
    - labels associated
    - aria-describedby
    - role=alert on errors
    - aria-required
    - role=status on toast
    - keyboard-only completion
  edge cases (3 tests)
    - multiple submissions
    - whitespace-only name
    - whitespace-only message
```

## Checklist Verification

- [x] Every acceptance criterion from the user story has at least one test (submit form, see toast, validation)
- [x] Happy path is covered end-to-end (fill, submit, loading state, toast, form reset, button re-enabled)
- [x] Error states are tested (all required-field errors, format errors, boundary errors)
- [x] Boundary values are tested (name: 1/2/100/101 chars; message: 9/10/1000/1001 chars)
- [x] Tests use semantic locators (getByRole, getByLabel, getByText)
- [x] Assertions use web-first auto-retrying methods (toBeVisible, not isVisible)
- [x] No hard-coded waits (no waitForTimeout)
- [x] Tests are independent -- can run in any order
- [x] External APIs are mocked (N/A -- no external APIs in this app)
- [x] Accessibility check is included (keyboard navigation, aria attributes, focus management, screen reader roles)
- [x] Test names describe the user behavior being verified
- [x] Tests match the project's existing conventions (no existing conventions; chose simple flat structure appropriate for project size)
