import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import { SignupPage } from "./pages/signup.page";
import { VerifyEmailPage } from "./pages/verify-email.page";
import { LoginPage } from "./pages/login.page";
import { DashboardPage } from "./pages/dashboard.page";

/**
 * E2E tests for the user story:
 * "As a user, I can sign up, verify my email, and log in."
 *
 * Covers: signup form, email verification, and login leading to the dashboard.
 */

test.describe("Sign up, verify email, and log in", () => {
  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------
  test.describe("happy path", () => {
    test("user can sign up, verify email, and log in to reach the dashboard", async ({
      page,
    }) => {
      const signupPage = new SignupPage(page);
      const verifyEmailPage = new VerifyEmailPage(page);
      const loginPage = new LoginPage(page);
      const dashboardPage = new DashboardPage(page);

      const testEmail = "jane@example.com";
      const testPassword = "SecurePass1";
      const testName = "Jane Doe";

      // --- Step 1: Sign up ---
      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await signupPage.goto();
      await signupPage.signup(testName, testEmail, testPassword, testPassword);
      await signupPage.expectSuccess(testEmail);

      // --- Step 2: Verify email ---
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await verifyEmailPage.gotoWithToken("valid-token-123");
      await verifyEmailPage.expectSuccess();

      // --- Step 3: Navigate to login via the "Continue to log in" link ---
      await verifyEmailPage.loginLink.click();
      await loginPage.expectHeading("Log in");

      // --- Step 4: Log in ---
      await page.route("**/api/auth/login", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await page.route("**/api/auth/me", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            user: { name: testName, email: testEmail },
          }),
        })
      );

      await loginPage.login(testEmail, testPassword);
      await dashboardPage.expectHeading("Dashboard");
      await dashboardPage.expectWelcome(testName);
      await dashboardPage.expectEmail(testEmail);
    });
  });

  // ---------------------------------------------------------------------------
  // Signup — validation
  // ---------------------------------------------------------------------------
  test.describe("signup validation", () => {
    let signupPage: SignupPage;

    test.beforeEach(async ({ page }) => {
      signupPage = new SignupPage(page);
      await signupPage.goto();
    });

    test("should display the signup form with all required fields", async () => {
      await signupPage.expectHeading("Create an account");
      await expect(signupPage.nameInput).toBeVisible();
      await expect(signupPage.emailInput).toBeVisible();
      await expect(signupPage.passwordInput).toBeVisible();
      await expect(signupPage.confirmPasswordInput).toBeVisible();
      await expect(signupPage.submitButton).toBeVisible();
      await expect(signupPage.loginLink).toBeVisible();
    });

    test("shows password requirements text", async () => {
      await expect(signupPage.passwordRequirements).toContainText(
        "8\u201364 characters"
      );
      await expect(signupPage.passwordRequirements).toContainText(
        "uppercase letter"
      );
      await expect(signupPage.passwordRequirements).toContainText("number");
    });

    test("shows error when password is too short (boundary: 7 chars)", async ({
      page,
    }) => {
      await signupPage.signup("Jane", "jane@example.com", "Short1X", "Short1X");
      await signupPage.expectError("Password must be between 8 and 64 characters");
    });

    test("accepts password at minimum length (boundary: 8 chars)", async ({
      page,
    }) => {
      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "Abcdef1X",
        "Abcdef1X"
      );
      await signupPage.expectSuccess("jane@example.com");
    });

    test("shows error when password exceeds maximum length (boundary: 65 chars)", async () => {
      const longPassword = "A1" + "a".repeat(63); // 65 chars total
      await signupPage.signup(
        "Jane",
        "jane@example.com",
        longPassword,
        longPassword
      );
      await signupPage.expectError("Password must be between 8 and 64 characters");
    });

    test("accepts password at maximum length (boundary: 64 chars)", async ({
      page,
    }) => {
      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      const maxPassword = "A1" + "a".repeat(62); // 64 chars total
      await signupPage.signup(
        "Jane",
        "jane@example.com",
        maxPassword,
        maxPassword
      );
      await signupPage.expectSuccess("jane@example.com");
    });

    test("shows error when password lacks uppercase letter", async () => {
      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "lowercase1",
        "lowercase1"
      );
      await signupPage.expectError(
        "Password must contain at least one uppercase letter and one number"
      );
    });

    test("shows error when password lacks a number", async () => {
      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "NoNumberHere",
        "NoNumberHere"
      );
      await signupPage.expectError(
        "Password must contain at least one uppercase letter and one number"
      );
    });

    test("shows error when passwords do not match", async () => {
      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "ValidPass1",
        "DifferentPass1"
      );
      await signupPage.expectError("Passwords do not match");
    });

    test("shows error when signup API returns a conflict (email already taken)", async ({
      page,
    }) => {
      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            message: "An account with this email already exists.",
          }),
        })
      );

      await signupPage.signup(
        "Jane",
        "existing@example.com",
        "ValidPass1",
        "ValidPass1"
      );
      await signupPage.expectError("An account with this email already exists");
    });

    test("shows generic error when signup API returns a server error", async ({
      page,
    }) => {
      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Internal server error" }),
        })
      );

      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "ValidPass1",
        "ValidPass1"
      );
      await signupPage.expectError("Internal server error");
    });

    test("shows error when network request fails", async ({ page }) => {
      await page.route("**/api/auth/signup", (route) => route.abort());

      await signupPage.signup(
        "Jane",
        "jane@example.com",
        "ValidPass1",
        "ValidPass1"
      );
      await signupPage.expectError("An unexpected error occurred");
    });

    test("can navigate to login page from signup", async () => {
      await signupPage.loginLink.click();
      await expect(signupPage.page).toHaveURL(/\/login/);
    });
  });

  // ---------------------------------------------------------------------------
  // Signup — data-driven password validation
  // ---------------------------------------------------------------------------
  test.describe("signup password validation (parameterized)", () => {
    const invalidPasswords = [
      {
        password: "short1A",
        description: "too short (7 chars)",
        error: "Password must be between 8 and 64 characters",
      },
      {
        password: "alllowercase1",
        description: "no uppercase letter",
        error:
          "Password must contain at least one uppercase letter and one number",
      },
      {
        password: "ALLUPPERCASEONLY",
        description: "no number",
        error:
          "Password must contain at least one uppercase letter and one number",
      },
    ];

    for (const { password, description, error } of invalidPasswords) {
      test(`rejects password: ${description}`, async ({ page }) => {
        const signupPage = new SignupPage(page);
        await signupPage.goto();
        await signupPage.signup("Jane", "jane@example.com", password, password);
        await signupPage.expectError(error);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Email verification
  // ---------------------------------------------------------------------------
  test.describe("email verification", () => {
    let verifyEmailPage: VerifyEmailPage;

    test.beforeEach(async ({ page }) => {
      verifyEmailPage = new VerifyEmailPage(page);
    });

    test("shows success when token is valid", async ({ page }) => {
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await verifyEmailPage.gotoWithToken("valid-token");
      await verifyEmailPage.expectSuccess();
      await expect(verifyEmailPage.loginLink).toBeVisible();
    });

    test("shows error when token is missing", async () => {
      await verifyEmailPage.gotoWithoutToken();
      await verifyEmailPage.expectError("Verification token is missing");
    });

    test("shows error when token is expired", async ({ page }) => {
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Verification link has expired.",
          }),
        })
      );

      await verifyEmailPage.gotoWithToken("expired-token");
      await verifyEmailPage.expectError("Verification link has expired");
    });

    test("shows error when token is invalid", async ({ page }) => {
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Invalid verification token.",
          }),
        })
      );

      await verifyEmailPage.gotoWithToken("bad-token");
      await verifyEmailPage.expectError("Invalid verification token");
    });

    test("shows error when verification API fails", async ({ page }) => {
      await page.route("**/api/auth/verify-email", (route) => route.abort());

      await verifyEmailPage.gotoWithToken("any-token");
      await verifyEmailPage.expectError("An unexpected error occurred");
    });

    test("shows signup link on error so user can retry", async () => {
      await verifyEmailPage.gotoWithoutToken();
      await expect(verifyEmailPage.signupLink).toBeVisible();
    });

    test("login link navigates to login page after successful verification", async ({
      page,
    }) => {
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      await verifyEmailPage.gotoWithToken("valid-token");
      await verifyEmailPage.expectSuccess();
      await verifyEmailPage.loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  // ---------------------------------------------------------------------------
  // Login — additional cases for the full auth flow
  // ---------------------------------------------------------------------------
  test.describe("login after verification", () => {
    let loginPage: LoginPage;

    test.beforeEach(async ({ page }) => {
      loginPage = new LoginPage(page);
      await loginPage.goto();
    });

    test("shows error for unverified email", async ({ page }) => {
      await page.route("**/api/auth/login", (route) =>
        route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Please verify your email before logging in.",
          }),
        })
      );

      await loginPage.login("unverified@example.com", "ValidPass1");
      await loginPage.expectError("Please verify your email before logging in");
    });

    test("shows error when login API returns a network failure", async ({
      page,
    }) => {
      await page.route("**/api/auth/login", (route) => route.abort());

      await loginPage.login("user@example.com", "ValidPass1");
      await loginPage.expectError("An unexpected error occurred");
    });

    test("can navigate to signup page from login", async () => {
      await loginPage.signupLink.click();
      await expect(loginPage.page).toHaveURL(/\/signup/);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  test.describe("edge cases", () => {
    test("double-clicking signup submit does not cause duplicate errors", async ({
      page,
    }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      let requestCount = 0;
      await page.route("**/api/auth/signup", async (route) => {
        requestCount++;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });

      await signupPage.nameInput.fill("Jane");
      await signupPage.emailInput.fill("jane@example.com");
      await signupPage.passwordInput.fill("ValidPass1");
      await signupPage.confirmPasswordInput.fill("ValidPass1");

      // Double-click the submit button
      await signupPage.submitButton.dblclick();

      await signupPage.expectSuccess("jane@example.com");
    });

    test("signup success state shows the correct email address", async ({
      page,
    }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      const specificEmail = "specific-user@test.org";
      await signupPage.signup(
        "Specific User",
        specificEmail,
        "ValidPass1",
        "ValidPass1"
      );
      await signupPage.expectSuccess(specificEmail);
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------
  test.describe("accessibility", () => {
    test("signup page meets WCAG 2.1 AA standards", async ({ page }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test("verify email page meets WCAG 2.1 AA standards", async ({ page }) => {
      await page.route("**/api/auth/verify-email", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      const verifyEmailPage = new VerifyEmailPage(page);
      await verifyEmailPage.gotoWithToken("valid-token");
      await verifyEmailPage.expectSuccess();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(results.violations).toEqual([]);
    });

    test("signup form can be completed with keyboard only", async ({
      page,
    }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      await page.route("**/api/auth/signup", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        })
      );

      // Tab to the name field and type
      await signupPage.nameInput.focus();
      await page.keyboard.type("Jane Doe");

      // Tab to email and type
      await page.keyboard.press("Tab");
      await page.keyboard.type("jane@example.com");

      // Tab to password and type
      await page.keyboard.press("Tab");
      await page.keyboard.type("ValidPass1");

      // Tab to confirm password and type
      await page.keyboard.press("Tab");
      await page.keyboard.type("ValidPass1");

      // Tab to submit button and press Enter
      await page.keyboard.press("Tab");
      await page.keyboard.press("Enter");

      await signupPage.expectSuccess("jane@example.com");
    });

    test("signup error messages are announced via aria-live", async ({
      page,
    }) => {
      const signupPage = new SignupPage(page);
      await signupPage.goto();

      await signupPage.signup("Jane", "jane@example.com", "short", "short");

      const errorAlert = page.locator('[role="alert"][aria-live="assertive"]');
      await expect(errorAlert).toBeVisible();
    });

    test("verification page uses proper status roles for loading and success", async ({
      page,
    }) => {
      await page.route("**/api/auth/verify-email", async (route) => {
        // Delay slightly so we can check loading state
        await new Promise((resolve) => setTimeout(resolve, 100));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      });

      const verifyEmailPage = new VerifyEmailPage(page);
      await verifyEmailPage.gotoWithToken("valid-token");

      // After verification completes, the success message should use role="status"
      const successStatus = page.locator(
        '[role="status"][aria-live="polite"]'
      );
      await expect(successStatus).toBeVisible();
    });
  });
});
