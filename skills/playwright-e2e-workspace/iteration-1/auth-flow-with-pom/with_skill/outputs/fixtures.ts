import { test as base, expect } from "@playwright/test";
import { LoginPage } from "./pages/login.page";
import { SignupPage } from "./pages/signup.page";
import { VerifyEmailPage } from "./pages/verify-email.page";
import { DashboardPage } from "./pages/dashboard.page";

/**
 * Custom test fixtures that extend the base Playwright test.
 *
 * `authenticatedPage` provides a Page that is already logged in,
 * so tests for authenticated routes can skip the login flow.
 */

type AuthFixtures = {
  loginPage: LoginPage;
  signupPage: SignupPage;
  verifyEmailPage: VerifyEmailPage;
  dashboardPage: DashboardPage;
  authenticatedPage: ReturnType<typeof base["page"]>;
};

export const test = base.extend<AuthFixtures>({
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page);
    await use(loginPage);
  },

  signupPage: async ({ page }, use) => {
    const signupPage = new SignupPage(page);
    await use(signupPage);
  },

  verifyEmailPage: async ({ page }, use) => {
    const verifyEmailPage = new VerifyEmailPage(page);
    await use(verifyEmailPage);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  authenticatedPage: async ({ page }, use) => {
    // Set a fake auth cookie so the app treats us as logged in.
    await page.context().addCookies([
      {
        name: "auth-token",
        value: "test-session-token",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await use(page);
  },
});

export { expect };
