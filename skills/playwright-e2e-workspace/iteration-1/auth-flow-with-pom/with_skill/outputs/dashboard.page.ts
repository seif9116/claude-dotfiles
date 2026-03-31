import { type Page, type Locator, expect } from "@playwright/test";
import { BasePage } from "./base.page";

/**
 * Page Object Model for the Dashboard page (`/dashboard`).
 *
 * Usage in tests:
 *   const dashboardPage = new DashboardPage(page);
 *   await dashboardPage.expectWelcome("Jane Doe");
 */
export class DashboardPage extends BasePage {
  readonly userInfo: Locator;
  readonly userName: Locator;
  readonly userEmail: Locator;
  readonly logoutButton: Locator;
  readonly settingsLink: Locator;
  readonly loadingMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.userInfo = page.getByTestId("user-info");
    this.userName = page.getByTestId("user-name");
    this.userEmail = page.getByTestId("user-email");
    this.logoutButton = page.getByRole("button", { name: "Log out" });
    this.settingsLink = page.getByRole("link", { name: "Settings" });
    this.loadingMessage = page.getByText("Loading");
  }

  protected get path() {
    return "/dashboard";
  }

  /** Assert the dashboard shows the user's name. */
  async expectWelcome(name: string) {
    await expect(this.userName).toContainText(name);
  }

  /** Assert the dashboard shows the user's email. */
  async expectEmail(email: string) {
    await expect(this.userEmail).toContainText(email);
  }

  /** Assert the user info section is visible. */
  async expectUserInfo() {
    await expect(this.userInfo).toBeVisible();
  }
}
