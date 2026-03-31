# Thought Process: Contact Form E2E Tests

## Step 1: Understanding the Codebase

I read the project files to understand the application:

- **`/home/seif/test-contact-form/src/index.html`** — A single-page contact form with three fields (name, email, message), a submit button, and a toast notification element. The form uses `novalidate` so all validation is custom JS. Each field has an associated `.error-message` paragraph with `role="alert"` and `aria-live="polite"`. Fields use `aria-required`, `aria-describedby`, and `aria-invalid` for accessibility.

- **`/home/seif/test-contact-form/src/main.ts`** — Client-side validation logic with these rules:
  - **Name**: required, min 2 chars, max 100 chars (all checked after `.trim()`)
  - **Email**: required, must match `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` (after `.trim()`)
  - **Message**: required, min 10 chars, max 1000 chars (all checked after `.trim()`)
  - Validation triggers on `blur` for each field
  - When a field has `aria-invalid="true"`, re-validation happens on every `input` event (live clearing)
  - On submit: all fields validated; first invalid field gets focused; if valid, button is disabled with "Sending..." text, then after 500ms the form resets, button re-enables, and a toast appears for 3 seconds

- **`/home/seif/test-contact-form/playwright.config.ts`** — Tests directory is `./tests`, base URL is `http://localhost:5173`, dev server is `npm run dev`.

## Step 2: Test Plan

I decided to organize the tests into these categories:

### 1. Initial State (7 tests)
Verify the page loads correctly with all elements visible, button enabled, no errors shown, no toast visible, and correct ARIA attributes set. This is the foundation — if initial state is wrong, everything else is unreliable.

### 2. Required-Field Validation on Blur (3 tests)
Each of the three fields should show its "required" error message when focused and then blurred while empty. Testing blur-triggered validation is important because that is the primary validation trigger.

### 3. Name Field Validation (5 tests)
- Single character (below minlength of 2) — should show minlength error
- Exactly 2 characters (boundary) — should pass
- 101 characters (above maxlength of 100) — should show maxlength error
- Exactly 100 characters (boundary) — should pass
- Whitespace-only — should trigger "required" because `.trim()` makes it empty

### 4. Email Field Validation (6 tests)
- "notanemail" — no @ sign
- "user@" — nothing after @
- "@domain.com" — nothing before @
- "user@domain" — no dot in domain part
- "user@example.com" — valid email
- Whitespace-only — should trigger required

### 5. Message Field Validation (5 tests)
- 5 characters (below minlength 10) — should fail
- Exactly 10 characters (boundary) — should pass
- 1001 characters (above maxlength 1000) — should fail
- Exactly 1000 characters (boundary) — should pass
- Whitespace-only — should trigger required

### 6. Error Clearing on Input (4 tests)
The app has logic where if `aria-invalid` is true, every `input` event re-validates. This means:
- Typing a valid name clears the name error
- Typing a valid email clears the email error
- Typing a valid message clears the message error
- Typing an invalid value updates the error message but keeps it visible (e.g., single char name goes from "required" to "at least 2 characters")

### 7. Submit with Validation Errors (5 tests)
- Submitting a blank form shows all three error messages
- Focus goes to the first invalid field (name when all empty)
- Focus goes to email when only name is valid
- Focus goes to message when name and email are valid
- Toast does not appear on invalid submit

### 8. Successful Submission (5 tests)
- Button shows "Sending..." and is disabled during the async delay
- Success toast appears with correct text
- All fields are reset to empty after submission
- Button re-enables with original text
- Toast auto-hides after ~3 seconds

### 9. Multiple Submissions (1 test)
Verify the form can be filled and submitted again after a successful submission. This ensures the form properly resets and the button re-enables.

### 10. Accessibility (5 tests)
- `aria-describedby` links fields to their error containers
- Error containers have `role="alert"`
- Toast has `role="status"`
- Tab order works correctly (Name -> Email -> Message -> Button)
- Form can be submitted via Enter key

### 11. Edge Cases (5 tests)
- Name with leading/trailing whitespace (trims to too-short value)
- Email with subdomains (should be valid)
- Email with spaces (should be invalid)
- Message at exact boundary minus one (9 chars, should fail)
- Rapid repeated submissions (button should be disabled preventing double-submit)

## Step 3: Design Decisions

1. **Used `getByLabel()` and `getByRole()` selectors** — These are the recommended Playwright best practices. They test the application the way a user interacts with it and also implicitly verify that labels are correctly associated with inputs.

2. **Used `page.locator("#id")` for error messages** — Error containers don't have accessible roles that make them easy to find by role, and targeting by ID matches the `aria-describedby` association. This is appropriate.

3. **Created a `fillValidForm()` helper** — Several test scenarios need a completely valid form as a starting point (submission tests). DRY principle applies.

4. **Organized into `test.describe` blocks** — Each logical group of tests gets its own describe block with a shared `beforeEach` that navigates to the page. This keeps tests isolated and readable.

5. **Tested boundary values** — For min/max constraints, I test both the invalid side (one below minimum, one above maximum) and the valid boundary (exactly at minimum, exactly at maximum). This is standard boundary-value analysis.

6. **Tested whitespace trimming** — The validation uses `.trim()` before checking, so whitespace-only inputs should be treated as empty. This is an important edge case.

7. **Tested the toast auto-hide** — Used a longer timeout (5000ms) to account for the 3-second delay plus transition time plus test overhead.

8. **Tested keyboard navigation and Enter submission** — Accessibility is a key concern given the extensive ARIA markup in the HTML, so these tests validate the keyboard experience.

9. **Did not mock the 500ms timer** — The simulated async delay is short enough (500ms) that real waiting is fine and more realistic than mocking. Playwright's auto-waiting handles this naturally.

## Total: 51 tests across 11 describe blocks

This covers the complete feature surface: initial state, all validation rules for all three fields (required, format, min/max length), the blur-triggered and input-triggered validation behaviors, the submission flow (both invalid and valid), the success toast lifecycle, accessibility attributes and keyboard interaction, and various edge cases.
