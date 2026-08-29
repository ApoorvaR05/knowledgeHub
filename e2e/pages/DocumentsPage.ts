import { Page, expect } from '@playwright/test';
import * as path from 'path';

export class DocumentsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/admin/documents');
  }

  async uploadFile(filePath: string) {
    // Trigger the hidden file input via the dropzone click
    const [fileChooser] = await Promise.all([
      this.page.waitForEvent('filechooser'),
      this.page.locator('.dropzone').click(),
    ]);
    await fileChooser.setFiles(filePath);
  }

  async waitForStatus(title: string, status: 'ready' | 'processing' | 'failed', timeoutMs = 15_000) {
    await expect(
      this.page.getByRole('row', { name: new RegExp(title, 'i') }).getByText(status),
    ).toBeVisible({ timeout: timeoutMs });
  }

  async getDocumentCount(): Promise<number> {
    const rows = this.page.locator('tbody tr');
    return rows.count();
  }
}
