import { test, expect } from "./fixtures";

test.describe("Signup page", () => {
  test.beforeEach(async ({ signupPage }) => {
    await signupPage.goto();
  });

  test("should display the signup form with all required fields", async ({
    signupPage,
  }) => {
    await signupPage.expectHeading("Create an account");
    await expect(signupPage.nameInput).toBeVisible();
    await expect(signupPage.emailInput).toBeVisible();
    await expect(signupPage.passwordInput).toBeVisible();
    await expect(signupPage.confirmPasswordInput).toBeVisible();
    await expect(signupPage.submitButton).toBeVisible();
    await expect(signupPage.loginLink).toBeVisible();
    await expect(signupPage.passwordRequirements).toBeVisible();
  });

  test("should show an error when password is too short", async ({
    signupPage,
  }) => {
    await signupPage.signup("Jane Doe", "jane@example.com", "Short1", "Short1");

    await signupPage.expectError(
      "Password must be between 8 and 64 characters"
    );
  });

  test("should show an error when password lacks uppercase letter and number", async ({
    signupPage,
  }) => {
    await signupPage.signup(
      "Jane Doe",
      "jane@example.com",
      "alllowercase",
      "alllowercase"
    );

    await signupPage.expectError(
      "Password must contain at least one uppercase letter and one number"
    );
  });

  test("should show an error when passwords do not match", async ({
    signupPage,
  }) => {
    await signupPage.signup(
      "Jane Doe",
      "jane@example.com",
      "ValidPass1",
      "DifferentPass1"
    );

    await signupPage.expectError("Passwords do not match");
  });

  test("should show an error when the API returns a failure", async ({
    signupPage,
    page,
  }) => {
    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email already registered." }),
      })
    );

    await signupPage.signup(
      "Jane Doe",
      "jane@example.com",
      "ValidPass1",
      "ValidPass1"
    );

    await signupPage.expectError("Email already registered");
  });

  test("should show success message and prompt to check email on valid signup", async ({
    signupPage,
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
      "Jane Doe",
      "jane@example.com",
      "ValidPass1",
      "ValidPass1"
    );

    await signupPage.expectSuccessMessage("jane@example.com");
  });

  test("should navigate to login page via link", async ({
    signupPage,
  }) => {
    await signupPage.loginLink.click();

    await signupPage.expectURL("/login");
  });
});

test.describe("Email verification page", () => {
  test("should show loading state then success when token is valid", async ({
    verifyEmailPage,
    page,
  }) => {
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    await verifyEmailPage.gotoWithToken("valid-token-123");

    await verifyEmailPage.expectHeading("Email verification");
    await verifyEmailPage.expectSuccess();
  });

  test("should show error when token is missing", async ({
    verifyEmailPage,
  }) => {
    await verifyEmailPage.goto();

    await verifyEmailPage.expectHeading("Email verification");
    await verifyEmailPage.expectError("Verification token is missing");
  });

  test("should show error when the API rejects the token", async ({
    verifyEmailPage,
    page,
  }) => {
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Token is invalid or has expired.",
        }),
      })
    );

    await verifyEmailPage.gotoWithToken("expired-token");

    await verifyEmailPage.expectError("Token is invalid or has expired");
  });

  test("should navigate to login page after successful verification", async ({
    verifyEmailPage,
    page,
  }) => {
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    await verifyEmailPage.gotoWithToken("valid-token-123");
    await verifyEmailPage.expectSuccess();
    await verifyEmailPage.loginLink.click();

    await verifyEmailPage.expectURL("/login");
  });

  test("should navigate back to signup from error state", async ({
    verifyEmailPage,
  }) => {
    await verifyEmailPage.goto();

    await verifyEmailPage.expectError("Verification token is missing");
    await verifyEmailPage.signupLink.click();

    await verifyEmailPage.expectURL("/signup");
  });
});

test.describe("Full auth flow: signup -> verify email -> login", () => {
  test("should complete the entire registration and login journey", async ({
    signupPage,
    verifyEmailPage,
    loginPage,
    page,
  }) => {
    const testUser = {
      name: "Jane Doe",
      email: "jane@example.com",
      password: "SecurePass1",
    };

    // ---------- Step 1: Sign up ----------

    // Intercept the signup API to simulate success.
    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    await signupPage.goto();
    await signupPage.signup(
      testUser.name,
      testUser.email,
      testUser.password,
      testUser.password
    );

    // The page should show the "check your email" confirmation.
    await signupPage.expectSuccessMessage(testUser.email);

    // ---------- Step 2: Verify email ----------

    // Intercept the verify-email API to simulate success.
    await page.route("**/api/auth/verify-email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    // Simulate clicking the verification link from email.
    await verifyEmailPage.gotoWithToken("valid-verification-token");
    await verifyEmailPage.expectSuccess();

    // Navigate to login from the verification success page.
    await verifyEmailPage.loginLink.click();
    await loginPage.expectHeading("Log in");

    // ---------- Step 3: Log in ----------

    // Intercept the login API to simulate success.
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    // Intercept the dashboard /api/auth/me call so the dashboard renders.
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { name: testUser.name, email: testUser.email },
        }),
      })
    );

    await loginPage.login(testUser.email, testUser.password);

    // Should arrive at the dashboard and see the user info.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId("user-name")).toContainText(testUser.name);
    await expect(page.getByTestId("user-email")).toContainText(testUser.email);
  });

  test("should block login if email is not yet verified", async ({
    signupPage,
    loginPage,
    page,
  }) => {
    // Signup succeeds.
    await page.route("**/api/auth/signup", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      })
    );

    await signupPage.goto();
    await signupPage.signup(
      "Jane Doe",
      "jane@example.com",
      "SecurePass1",
      "SecurePass1"
    );
    await signupPage.expectSuccessMessage("jane@example.com");

    // Try to log in without verifying email -- the API returns an error.
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Please verify your email before logging in.",
        }),
      })
    );

    await loginPage.goto();
    await loginPage.login("jane@example.com", "SecurePass1");

    await loginPage.expectError("Please verify your email before logging in");
  });
});
