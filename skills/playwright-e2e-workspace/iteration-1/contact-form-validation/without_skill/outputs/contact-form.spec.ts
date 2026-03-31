import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill all three fields with valid data. */
async function fillValidForm(page: Page) {
  await page.getByLabel("Name").fill("Jane Doe");
  await page.getByLabel("Email").fill("jane@example.com");
  await page.getByLabel("Message").fill("Hello, this is a valid test message.");
}

// ---------------------------------------------------------------------------
// Page load & initial state
// ---------------------------------------------------------------------------

test.describe("Contact form – initial state", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display the page title and heading", async ({ page }) => {
    await expect(page).toHaveTitle("Contact Us");
    await expect(page.getByRole("heading", { name: "Contact Us" })).toBeVisible();
  });

  test("should render all three form fields", async ({ page }) => {
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
  });

  test("should render the submit button enabled with correct text", async ({ page }) => {
    const btn = page.getByRole("button", { name: "Send Message" });
    await expect(btn).toBeVisible();
    await expect(btn).toBeEnabled();
  });

  test("should not show any error messages initially", async ({ page }) => {
    const errors = page.locator(".error-message");
    // There are 3 error containers, but they should all be empty
    for (let i = 0; i < 3; i++) {
      await expect(errors.nth(i)).toHaveText("");
    }
  });

  test("should not show the success toast initially", async ({ page }) => {
    const toast = page.locator("#toast");
    await expect(toast).not.toHaveClass(/visible/);
  });

  test("fields should have correct aria-required attributes", async ({ page }) => {
    await expect(page.getByLabel("Name")).toHaveAttribute("aria-required", "true");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-required", "true");
    await expect(page.getByLabel("Message")).toHaveAttribute("aria-required", "true");
  });

  test("fields should not have aria-invalid initially", async ({ page }) => {
    for (const label of ["Name", "Email", "Message"]) {
      const field = page.getByLabel(label);
      await expect(field).not.toHaveAttribute("aria-invalid", "true");
    }
  });
});

// ---------------------------------------------------------------------------
// Validation – Required fields (blur)
// ---------------------------------------------------------------------------

test.describe("Contact form – required-field validation on blur", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show 'Name is required.' when name field is left empty", async ({ page }) => {
    await page.getByLabel("Name").focus();
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name is required.");
    await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  });

  test("should show 'Email is required.' when email field is left empty", async ({ page }) => {
    await page.getByLabel("Email").focus();
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Email is required.");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
  });

  test("should show 'Message is required.' when message field is left empty", async ({ page }) => {
    await page.getByLabel("Message").focus();
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText("Message is required.");
    await expect(page.getByLabel("Message")).toHaveAttribute("aria-invalid", "true");
  });
});

// ---------------------------------------------------------------------------
// Validation – Name constraints
// ---------------------------------------------------------------------------

test.describe("Contact form – name field validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show minlength error for a single-character name", async ({ page }) => {
    await page.getByLabel("Name").fill("A");
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name must be at least 2 characters.");
  });

  test("should accept a 2-character name", async ({ page }) => {
    await page.getByLabel("Name").fill("Jo");
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("");
    await expect(page.getByLabel("Name")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("should show maxlength error when name exceeds 100 characters", async ({ page }) => {
    const longName = "A".repeat(101);
    await page.getByLabel("Name").fill(longName);
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name must be 100 characters or fewer.");
  });

  test("should accept a name of exactly 100 characters", async ({ page }) => {
    const exactName = "A".repeat(100);
    await page.getByLabel("Name").fill(exactName);
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("");
  });

  test("should treat whitespace-only name as empty (required error)", async ({ page }) => {
    await page.getByLabel("Name").fill("   ");
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name is required.");
  });
});

// ---------------------------------------------------------------------------
// Validation – Email constraints
// ---------------------------------------------------------------------------

test.describe("Contact form – email field validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show invalid email error for 'notanemail'", async ({ page }) => {
    await page.getByLabel("Email").fill("notanemail");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Please enter a valid email address.");
  });

  test("should show invalid email error for 'user@'", async ({ page }) => {
    await page.getByLabel("Email").fill("user@");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Please enter a valid email address.");
  });

  test("should show invalid email error for '@domain.com'", async ({ page }) => {
    await page.getByLabel("Email").fill("@domain.com");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Please enter a valid email address.");
  });

  test("should show invalid email error for 'user@domain' (no TLD dot)", async ({ page }) => {
    await page.getByLabel("Email").fill("user@domain");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Please enter a valid email address.");
  });

  test("should accept a valid email like 'user@example.com'", async ({ page }) => {
    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("");
    await expect(page.getByLabel("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("should treat whitespace-only email as empty (required error)", async ({ page }) => {
    await page.getByLabel("Email").fill("   ");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Email is required.");
  });
});

// ---------------------------------------------------------------------------
// Validation – Message constraints
// ---------------------------------------------------------------------------

test.describe("Contact form – message field validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show minlength error for a message under 10 characters", async ({ page }) => {
    await page.getByLabel("Message").fill("Short");
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText(
      "Message must be at least 10 characters."
    );
  });

  test("should accept a message of exactly 10 characters", async ({ page }) => {
    await page.getByLabel("Message").fill("Exactly 10"); // 10 chars
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText("");
  });

  test("should show maxlength error when message exceeds 1000 characters", async ({ page }) => {
    const longMessage = "A".repeat(1001);
    await page.getByLabel("Message").fill(longMessage);
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText(
      "Message must be 1000 characters or fewer."
    );
  });

  test("should accept a message of exactly 1000 characters", async ({ page }) => {
    const exactMessage = "A".repeat(1000);
    await page.getByLabel("Message").fill(exactMessage);
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText("");
  });

  test("should treat whitespace-only message as empty (required error)", async ({ page }) => {
    await page.getByLabel("Message").fill("     ");
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText("Message is required.");
  });
});

// ---------------------------------------------------------------------------
// Inline error clearing on input
// ---------------------------------------------------------------------------

test.describe("Contact form – errors clear as user types", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should clear name error when user types a valid name", async ({ page }) => {
    // Trigger error
    await page.getByLabel("Name").focus();
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name is required.");

    // Start typing — error should clear once value is valid
    await page.getByLabel("Name").fill("Jo");
    await expect(page.locator("#name-error")).toHaveText("");
    await expect(page.getByLabel("Name")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("should clear email error when user types a valid email", async ({ page }) => {
    await page.getByLabel("Email").focus();
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Email is required.");

    await page.getByLabel("Email").fill("valid@email.com");
    await expect(page.locator("#email-error")).toHaveText("");
  });

  test("should clear message error when user types a valid message", async ({ page }) => {
    await page.getByLabel("Message").focus();
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText("Message is required.");

    await page.getByLabel("Message").fill("This is long enough to pass.");
    await expect(page.locator("#message-error")).toHaveText("");
  });

  test("should NOT clear error on input when value is still invalid", async ({ page }) => {
    // Trigger error first
    await page.getByLabel("Name").focus();
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name is required.");

    // Type a single character — still below minlength of 2
    await page.getByLabel("Name").fill("A");
    // Error should update to the minlength message, not disappear
    await expect(page.locator("#name-error")).toHaveText("Name must be at least 2 characters.");
    await expect(page.getByLabel("Name")).toHaveAttribute("aria-invalid", "true");
  });
});

// ---------------------------------------------------------------------------
// Submit – validation gate
// ---------------------------------------------------------------------------

test.describe("Contact form – submit with validation errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should show all validation errors when submitting a blank form", async ({ page }) => {
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.locator("#name-error")).toHaveText("Name is required.");
    await expect(page.locator("#email-error")).toHaveText("Email is required.");
    await expect(page.locator("#message-error")).toHaveText("Message is required.");
  });

  test("should focus the first invalid field on submit", async ({ page }) => {
    await page.getByRole("button", { name: "Send Message" }).click();

    // Name is the first field, so it should receive focus
    await expect(page.getByLabel("Name")).toBeFocused();
  });

  test("should focus email when name is valid but email is empty on submit", async ({ page }) => {
    await page.getByLabel("Name").fill("Jane Doe");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByLabel("Email")).toBeFocused();
  });

  test("should focus message when name and email are valid but message is empty on submit", async ({
    page,
  }) => {
    await page.getByLabel("Name").fill("Jane Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByRole("button", { name: "Send Message" }).click();

    await expect(page.getByLabel("Message")).toBeFocused();
  });

  test("should not show the success toast when form is invalid", async ({ page }) => {
    await page.getByRole("button", { name: "Send Message" }).click();
    const toast = page.locator("#toast");
    await expect(toast).not.toHaveClass(/visible/);
  });
});

// ---------------------------------------------------------------------------
// Successful submission
// ---------------------------------------------------------------------------

test.describe("Contact form – successful submission", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should disable the submit button and show 'Sending...' during submission", async ({
    page,
  }) => {
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();

    const btn = page.getByRole("button", { name: "Sending..." });
    await expect(btn).toBeDisabled();
  });

  test("should show the success toast after submission", async ({ page }) => {
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();

    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/visible/);
    await expect(toast).toHaveText("Message sent successfully!");
  });

  test("should reset all form fields after successful submission", async ({ page }) => {
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();

    // Wait for the simulated async submission (500ms) to complete
    await expect(page.getByRole("button", { name: "Send Message" })).toBeEnabled();

    await expect(page.getByLabel("Name")).toHaveValue("");
    await expect(page.getByLabel("Email")).toHaveValue("");
    await expect(page.getByLabel("Message")).toHaveValue("");
  });

  test("should re-enable the submit button with original text after submission", async ({
    page,
  }) => {
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();

    // Wait for submission to complete
    const btn = page.getByRole("button", { name: "Send Message" });
    await expect(btn).toBeEnabled({ timeout: 2000 });
  });

  test("should hide the success toast after approximately 3 seconds", async ({ page }) => {
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();

    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/visible/);

    // Wait for the toast to auto-hide (3s + some buffer)
    await expect(toast).not.toHaveClass(/visible/, { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Multiple submissions
// ---------------------------------------------------------------------------

test.describe("Contact form – multiple submissions", () => {
  test("should allow re-submitting after a successful submission", async ({ page }) => {
    await page.goto("/");

    // First submission
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();
    await expect(page.locator("#toast")).toHaveClass(/visible/);
    await expect(page.getByRole("button", { name: "Send Message" })).toBeEnabled({ timeout: 2000 });

    // Second submission
    await fillValidForm(page);
    await page.getByRole("button", { name: "Send Message" }).click();
    // Button should go to "Sending..." again
    await expect(page.getByRole("button", { name: "Sending..." })).toBeDisabled();
    // And eventually show the toast again
    await expect(page.getByRole("button", { name: "Send Message" })).toBeEnabled({ timeout: 2000 });
  });
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test.describe("Contact form – accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("error messages should be associated with fields via aria-describedby", async ({
    page,
  }) => {
    await expect(page.getByLabel("Name")).toHaveAttribute("aria-describedby", "name-error");
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-describedby", "email-error");
    await expect(page.getByLabel("Message")).toHaveAttribute("aria-describedby", "message-error");
  });

  test("error containers should have role=alert for screen readers", async ({ page }) => {
    await expect(page.locator("#name-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#email-error")).toHaveAttribute("role", "alert");
    await expect(page.locator("#message-error")).toHaveAttribute("role", "alert");
  });

  test("toast should have role=status for screen reader announcements", async ({ page }) => {
    await expect(page.locator("#toast")).toHaveAttribute("role", "status");
  });

  test("fields should be navigable with tab key", async ({ page }) => {
    await page.getByLabel("Name").focus();
    await expect(page.getByLabel("Name")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Email")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Message")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Send Message" })).toBeFocused();
  });

  test("should be possible to submit the form via Enter key", async ({ page }) => {
    await fillValidForm(page);
    // Focus an input and press Enter to submit the form
    await page.getByLabel("Name").focus();
    await page.keyboard.press("Enter");

    const toast = page.locator("#toast");
    await expect(toast).toHaveClass(/visible/);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test.describe("Contact form – edge cases", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should validate name with leading/trailing whitespace correctly", async ({ page }) => {
    // " A " trims to "A" which is only 1 char — should fail minlength
    await page.getByLabel("Name").fill(" A ");
    await page.getByLabel("Name").blur();
    await expect(page.locator("#name-error")).toHaveText("Name must be at least 2 characters.");
  });

  test("should accept email with subdomains like user@mail.example.com", async ({ page }) => {
    await page.getByLabel("Email").fill("user@mail.example.com");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("");
  });

  test("should reject email with spaces like 'user @example.com'", async ({ page }) => {
    await page.getByLabel("Email").fill("user @example.com");
    await page.getByLabel("Email").blur();
    await expect(page.locator("#email-error")).toHaveText("Please enter a valid email address.");
  });

  test("should validate message that is exactly at the boundary (9 chars)", async ({ page }) => {
    await page.getByLabel("Message").fill("123456789"); // 9 characters
    await page.getByLabel("Message").blur();
    await expect(page.locator("#message-error")).toHaveText(
      "Message must be at least 10 characters."
    );
  });

  test("should handle rapid repeated submissions gracefully", async ({ page }) => {
    await fillValidForm(page);
    // Click submit
    await page.getByRole("button", { name: "Send Message" }).click();

    // Button should be disabled during sending, preventing double-submit
    const btn = page.getByRole("button", { name: "Sending..." });
    await expect(btn).toBeDisabled();
  });
});
