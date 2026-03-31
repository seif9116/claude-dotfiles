import { test, expect } from "@playwright/test";

test.describe("Contact Form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test.describe("happy path", () => {
    test("user can fill out and submit the contact form successfully", async ({
      page,
    }) => {
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Message").fill("Hello, I have a question about your services.");

      await page.getByRole("button", { name: "Send Message" }).click();

      // Button should show loading state
      await expect(page.getByRole("button", { name: "Sending..." })).toBeDisabled();

      // Success toast should appear
      await expect(page.getByText("Message sent successfully!")).toBeVisible();

      // Form should be reset after submission
      await expect(page.getByLabel("Name")).toHaveValue("");
      await expect(page.getByLabel("Email")).toHaveValue("");
      await expect(page.getByLabel("Message")).toHaveValue("");

      // Button should be re-enabled with original text
      await expect(page.getByRole("button", { name: "Send Message" })).toBeEnabled();
    });

    test("success toast disappears after a few seconds", async ({ page }) => {
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Message").fill("This is a valid message for testing.");

      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByText("Message sent successfully!")).toBeVisible();

      // Toast should disappear (it hides after 3 seconds, plus 0.3s transition)
      await expect(page.getByText("Message sent successfully!")).toBeHidden({
        timeout: 5000,
      });
    });
  });

  test.describe("validation - required fields", () => {
    test("shows error when submitting with all fields empty", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByText("Name is required.")).toBeVisible();
      await expect(page.getByText("Email is required.")).toBeVisible();
      await expect(page.getByText("Message is required.")).toBeVisible();
    });

    test("shows error when name is empty", async ({ page }) => {
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Message").fill("This is a valid message.");

      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByText("Name is required.")).toBeVisible();
    });

    test("shows error when email is empty", async ({ page }) => {
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Message").fill("This is a valid message.");

      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByText("Email is required.")).toBeVisible();
    });

    test("shows error when message is empty", async ({ page }) => {
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Email").fill("jane@example.com");

      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByText("Message is required.")).toBeVisible();
    });
  });

  test.describe("validation - name field", () => {
    test("shows error when name is 1 character (below minimum of 2)", async ({
      page,
    }) => {
      await page.getByLabel("Name").fill("A");
      await page.getByLabel("Name").blur();

      await expect(
        page.getByText("Name must be at least 2 characters.")
      ).toBeVisible();
    });

    test("accepts name with exactly 2 characters (boundary minimum)", async ({
      page,
    }) => {
      await page.getByLabel("Name").fill("Jo");
      await page.getByLabel("Name").blur();

      await expect(
        page.getByText("Name must be at least 2 characters.")
      ).toBeHidden();
    });

    test("accepts name with exactly 100 characters (boundary maximum)", async ({
      page,
    }) => {
      const name100 = "A".repeat(100);
      await page.getByLabel("Name").fill(name100);
      await page.getByLabel("Name").blur();

      await expect(
        page.getByText("Name must be 100 characters or fewer.")
      ).toBeHidden();
    });

    test("shows error when name exceeds 100 characters", async ({ page }) => {
      const name101 = "A".repeat(101);
      await page.getByLabel("Name").fill(name101);
      await page.getByLabel("Name").blur();

      await expect(
        page.getByText("Name must be 100 characters or fewer.")
      ).toBeVisible();
    });
  });

  test.describe("validation - email field", () => {
    const invalidEmails = [
      { input: "not-an-email", description: "missing @ and domain" },
      { input: "missing@domain", description: "missing TLD" },
      { input: "@nodomain.com", description: "missing local part" },
      { input: "spaces in@email.com", description: "contains spaces" },
    ];

    for (const { input, description } of invalidEmails) {
      test(`shows error for invalid email: ${description}`, async ({
        page,
      }) => {
        await page.getByLabel("Email").fill(input);
        await page.getByLabel("Email").blur();

        await expect(
          page.getByText("Please enter a valid email address.")
        ).toBeVisible();
      });
    }

    test("accepts a valid email address", async ({ page }) => {
      await page.getByLabel("Email").fill("user@example.com");
      await page.getByLabel("Email").blur();

      await expect(
        page.getByText("Please enter a valid email address.")
      ).toBeHidden();
      await expect(page.getByText("Email is required.")).toBeHidden();
    });
  });

  test.describe("validation - message field", () => {
    test("shows error when message is 9 characters (below minimum of 10)", async ({
      page,
    }) => {
      await page.getByLabel("Message").fill("123456789");
      await page.getByLabel("Message").blur();

      await expect(
        page.getByText("Message must be at least 10 characters.")
      ).toBeVisible();
    });

    test("accepts message with exactly 10 characters (boundary minimum)", async ({
      page,
    }) => {
      await page.getByLabel("Message").fill("1234567890");
      await page.getByLabel("Message").blur();

      await expect(
        page.getByText("Message must be at least 10 characters.")
      ).toBeHidden();
    });

    test("accepts message with exactly 1000 characters (boundary maximum)", async ({
      page,
    }) => {
      const msg1000 = "A".repeat(1000);
      await page.getByLabel("Message").fill(msg1000);
      await page.getByLabel("Message").blur();

      await expect(
        page.getByText("Message must be 1000 characters or fewer.")
      ).toBeHidden();
    });

    test("shows error when message exceeds 1000 characters", async ({
      page,
    }) => {
      const msg1001 = "A".repeat(1001);
      await page.getByLabel("Message").fill(msg1001);
      await page.getByLabel("Message").blur();

      await expect(
        page.getByText("Message must be 1000 characters or fewer.")
      ).toBeVisible();
    });
  });

  test.describe("inline validation behavior", () => {
    test("shows validation error on blur", async ({ page }) => {
      await page.getByLabel("Name").focus();
      await page.getByLabel("Name").blur();

      await expect(page.getByText("Name is required.")).toBeVisible();
    });

    test("clears validation error as user types valid input", async ({
      page,
    }) => {
      // Trigger error
      await page.getByLabel("Name").focus();
      await page.getByLabel("Name").blur();
      await expect(page.getByText("Name is required.")).toBeVisible();

      // Start typing - error should clear once valid
      await page.getByLabel("Name").fill("Jane");
      await expect(page.getByText("Name is required.")).toBeHidden();
    });

    test("does not show error while typing in a fresh field", async ({
      page,
    }) => {
      // Type a single character - should not show min-length error yet
      // because validation only triggers on blur or if field was already invalid
      await page.getByLabel("Name").fill("A");

      await expect(
        page.getByText("Name must be at least 2 characters.")
      ).toBeHidden();
    });
  });

  test.describe("error states and focus management", () => {
    test("focuses the first invalid field on submit", async ({ page }) => {
      // Fill only email, leaving name and message empty
      await page.getByLabel("Email").fill("jane@example.com");

      await page.getByRole("button", { name: "Send Message" }).click();

      // Name is the first invalid field - it should receive focus
      await expect(page.getByLabel("Name")).toBeFocused();
    });

    test("sets aria-invalid on fields with errors", async ({ page }) => {
      await page.getByRole("button", { name: "Send Message" }).click();

      await expect(page.getByLabel("Name")).toHaveAttribute(
        "aria-invalid",
        "true"
      );
      await expect(page.getByLabel("Email")).toHaveAttribute(
        "aria-invalid",
        "true"
      );
      await expect(page.getByLabel("Message")).toHaveAttribute(
        "aria-invalid",
        "true"
      );
    });

    test("removes aria-invalid when field becomes valid", async ({ page }) => {
      // Trigger error
      await page.getByLabel("Name").focus();
      await page.getByLabel("Name").blur();
      await expect(page.getByLabel("Name")).toHaveAttribute(
        "aria-invalid",
        "true"
      );

      // Fix the error
      await page.getByLabel("Name").fill("Jane Doe");
      await expect(page.getByLabel("Name")).not.toHaveAttribute(
        "aria-invalid",
        "true"
      );
    });
  });

  test.describe("submit button state", () => {
    test("button is disabled during submission", async ({ page }) => {
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Message").fill("This is a valid test message.");

      await page.getByRole("button", { name: "Send Message" }).click();

      // Button should be disabled with loading text during submission
      await expect(
        page.getByRole("button", { name: "Sending..." })
      ).toBeDisabled();

      // After submission completes, button should be re-enabled
      await expect(
        page.getByRole("button", { name: "Send Message" })
      ).toBeEnabled();
    });

    test("button is not disabled when form validation fails", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Send Message" }).click();

      // Button should remain enabled when validation fails
      await expect(
        page.getByRole("button", { name: "Send Message" })
      ).toBeEnabled();
    });
  });

  test.describe("accessibility", () => {
    test("all form fields have associated labels", async ({ page }) => {
      // Verify fields are accessible by their labels
      await expect(page.getByLabel("Name")).toBeVisible();
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Message")).toBeVisible();
    });

    test("error messages are associated with fields via aria-describedby", async ({
      page,
    }) => {
      await expect(page.getByLabel("Name")).toHaveAttribute(
        "aria-describedby",
        "name-error"
      );
      await expect(page.getByLabel("Email")).toHaveAttribute(
        "aria-describedby",
        "email-error"
      );
      await expect(page.getByLabel("Message")).toHaveAttribute(
        "aria-describedby",
        "message-error"
      );
    });

    test("error messages have role=alert for screen readers", async ({
      page,
    }) => {
      await page.getByRole("button", { name: "Send Message" }).click();

      // Error messages should be in elements with role="alert"
      const nameError = page.locator("#name-error");
      await expect(nameError).toHaveAttribute("role", "alert");
      await expect(nameError).toHaveText("Name is required.");
    });

    test("required fields are marked with aria-required", async ({ page }) => {
      await expect(page.getByLabel("Name")).toHaveAttribute(
        "aria-required",
        "true"
      );
      await expect(page.getByLabel("Email")).toHaveAttribute(
        "aria-required",
        "true"
      );
      await expect(page.getByLabel("Message")).toHaveAttribute(
        "aria-required",
        "true"
      );
    });

    test("success toast has role=status for screen reader announcement", async ({
      page,
    }) => {
      const toast = page.locator("#toast");
      await expect(toast).toHaveAttribute("role", "status");
    });

    test("can complete the form using only keyboard", async ({ page }) => {
      // Tab to the Name field and type
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Name")).toBeFocused();
      await page.keyboard.type("Jane Doe");

      // Tab to Email field and type
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Email")).toBeFocused();
      await page.keyboard.type("jane@example.com");

      // Tab to Message field and type
      await page.keyboard.press("Tab");
      await expect(page.getByLabel("Message")).toBeFocused();
      await page.keyboard.type("This is a test message via keyboard.");

      // Tab to submit button and press Enter
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole("button", { name: "Send Message" })
      ).toBeFocused();
      await page.keyboard.press("Enter");

      // Verify submission was successful
      await expect(page.getByText("Message sent successfully!")).toBeVisible();
    });
  });

  test.describe("edge cases", () => {
    test("can submit the form multiple times", async ({ page }) => {
      // First submission
      await page.getByLabel("Name").fill("Jane Doe");
      await page.getByLabel("Email").fill("jane@example.com");
      await page.getByLabel("Message").fill("First test message submission.");

      await page.getByRole("button", { name: "Send Message" }).click();
      await expect(page.getByText("Message sent successfully!")).toBeVisible();

      // Wait for form to reset and toast to stabilize
      await expect(
        page.getByRole("button", { name: "Send Message" })
      ).toBeEnabled();

      // Second submission
      await page.getByLabel("Name").fill("John Smith");
      await page.getByLabel("Email").fill("john@example.com");
      await page.getByLabel("Message").fill("Second test message submission.");

      await page.getByRole("button", { name: "Send Message" }).click();
      await expect(page.getByText("Message sent successfully!")).toBeVisible();
    });

    test("whitespace-only input is treated as empty", async ({ page }) => {
      await page.getByLabel("Name").fill("   ");
      await page.getByLabel("Name").blur();

      await expect(page.getByText("Name is required.")).toBeVisible();
    });

    test("whitespace-only message is treated as empty", async ({ page }) => {
      await page.getByLabel("Message").fill("     ");
      await page.getByLabel("Message").blur();

      await expect(page.getByText("Message is required.")).toBeVisible();
    });
  });
});
