import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Signup page (`/signup`).
 *
 * Usage in tests:
 *   const signupPage = new SignupPage(page);
 *   await signupPage.goto();
 *   await signupPage.signup("Jane Doe", "jane@example.com", "Secret1!", "Secret1!");
 */
export class SignupPage extends BasePage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;
  readonly loginLink: Locator;
  readonly successHeading: Locator;
  readonly successMessage: Locator;
  readonly passwordRequirements: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByLabel("Full name");
    this.emailInput = page.getByLabel("Email address");
    this.passwordInput = page.getByLabel("Password", { exact: true });
    this.confirmPasswordInput = page.getByLabel("Confirm password");
    this.submitButton = page.getByRole("button", { name: "Sign up" });
    this.errorMessage = page.getByTestId("form-error");
    this.loginLink = page.getByRole("link", { name: "Log in" });
    this.successHeading = page.getByRole("heading", {
      name: "Check your email",
    });
    this.successMessage = page.locator(
      '[aria-labelledby="signup-success-heading"] p'
    );
    this.passwordRequirements = page.locator("#password-requirements");
  }

  protected get path() {
    return "/signup";
  }

  /** Fill in all fields and submit the signup form. */
  async signup(
    name: string,
    email: string,
    password: string,
    confirmPassword: string
  ) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }

  /** Assert that the success state is displayed with the given email. */
  async expectSuccess(email: string) {
    await expect(this.successHeading).toBeVisible();
    await expect(this.successMessage).toContainText(email);
  }

  /** Assert that a specific error message is displayed. */
  async expectError(message: string) {
    await expect(this.errorMessage).toBeVisible();
    await expect(this.errorMessage).toContainText(message);
  }

  /** Assert the form error is not present. */
  async expectNoError() {
    await expect(this.errorMessage).not.toBeVisible();
  }
}
