import { Page, expect } from '@playwright/test';

export class SearchPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/search');
  }

  async search(query: string) {
    await this.page.getByPlaceholder(/type a question/i).fill(query);
    await this.page.getByRole('button', { name: /search/i }).click();
  }

  async waitForResults(timeoutMs = 10_000) {
    await expect(this.page.locator('.result-card').first()).toBeVisible({ timeout: timeoutMs });
  }

  async getResultCount(): Promise<number> {
    return this.page.locator('.result-card').count();
  }

  async getFirstResultContent(): Promise<string> {
    return this.page.locator('.result-card').first().locator('.result-card-content').innerText();
  }
}
