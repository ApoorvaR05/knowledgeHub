import { Page, expect } from '@playwright/test';

export class ChatPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/chat');
  }

  async createNewSession() {
    await this.page.getByRole('button', { name: /new chat/i }).click();
  }

  async sendMessage(text: string) {
    const input = this.page.locator('.chat-input');
    await input.fill(text);
    await this.page.getByRole('button', { name: /send/i }).click();
  }

  /** Wait until streaming is complete (no .streaming bubble present) */
  async waitForResponse(timeoutMs = 30_000) {
    await this.page.waitForFunction(
      () => document.querySelector('.message-bubble.streaming') === null,
      { timeout: timeoutMs },
    );
  }

  async getLastAssistantMessage(): Promise<string> {
    const bubbles = this.page.locator('.message-bubble.assistant');
    const count = await bubbles.count();
    return bubbles.nth(count - 1).innerText();
  }

  async assertAssistantReplied() {
    await expect(this.page.locator('.message-bubble.assistant').last()).toBeVisible();
  }
}
