import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Email Verification page (`/verify-email?token=...`).
 *
 * Usage in tests:
 *   const verifyPage = new VerifyEmailPage(page);
 *   await verifyPage.gotoWithToken("abc123");
 *   await verifyPage.expectSuccess();
 */
export class VerifyEmailPage extends BasePage {
  readonly loadingMessage: Locator;
  readonly successContainer: Locator;
  readonly successMessage: Locator;
  readonly loginLink: Locator;
  readonly errorContainer: Locator;
  readonly errorMessage: Locator;
  readonly signupLink: Locator;

  constructor(page: Page) {
    super(page);
    this.loadingMessage = page.getByText("Verifying your email address");
    this.successContainer = page.getByTestId("verify-success");
    this.successMessage = page.getByText(
      "Your email has been verified successfully"
    );
    this.loginLink = page.getByRole("link", { name: "Continue to log in" });
    this.errorContainer = page.getByTestId("verify-error");
    this.errorMessage = this.errorContainer.locator("p");
    this.signupLink = page.getByRole("link", { name: "Back to sign up" });
  }

  protected get path() {
    return "/verify-email";
  }

  /** Navigate to the verification page with a specific token. */
  async gotoWithToken(token: string) {
    await this.page.goto(`/verify-email?token=${token}`);
  }

  /** Navigate to the verification page without a token. */
  async gotoWithoutToken() {
    await this.page.goto("/verify-email");
  }

  /** Assert that the verification succeeded. */
  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
    await expect(this.loginLink).toBeVisible();
  }

  /** Assert that the verification failed with a specific error. */
  async expectError(message: string) {
    await expect(this.errorContainer).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  /** Assert the loading state is displayed. */
  async expectLoading() {
    await expect(this.loadingMessage).toBeVisible();
  }
}
