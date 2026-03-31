import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "../../../../tests/e2e/pages/base.page";

/**
 * Page Object Model for the Email Verification page (`/verify-email?token=...`).
 *
 * Usage in tests:
 *   const verifyPage = new VerifyEmailPage(page);
 *   await verifyPage.gotoWithToken("abc123");
 *   await verifyPage.expectSuccess();
 */
export class VerifyEmailPage extends BasePage {
  readonly successMessage: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly signupLink: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    super(page);
    this.successMessage = page.getByTestId("verify-success");
    this.errorMessage = page.getByTestId("verify-error");
    this.loginLink = page.getByRole("link", { name: "Continue to log in" });
    this.signupLink = page.getByRole("link", { name: "Back to sign up" });
    this.loadingIndicator = page.getByText("Verifying your email address");
  }

  protected get path() {
    return "/verify-email";
  }

  /** Navigate to the verification page with a specific token. */
  async gotoWithToken(token: string) {
    await this.page.goto(`${this.path}?token=${token}`);
  }

  /** Assert verification succeeded and the success message is shown. */
  async expectSuccess() {
    await expect(this.successMessage).toBeVisible();
    await expect(this.successMessage).toContainText(
      "Your email has been verified successfully"
    );
    await expect(this.loginLink).toBeVisible();
  }

  /** Assert verification failed and a specific error message is shown. */
  async expectError(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
    await expect(this.signupLink).toBeVisible();
  }
}
