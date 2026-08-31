import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async register(email: string, password: string, role: 'user' | 'admin' = 'user') {
    await this.page.goto('/register');
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByLabel('Role').selectOption(role);
    await this.page.getByRole('button', { name: /create account/i }).click();
    // Wait for redirect to chat
    await expect(this.page).toHaveURL(/\/chat/);
  }

  async login(email: string, password: string) {
    await this.page.goto('/login');
    await this.page.getByLabel('Email').fill(email);
    await this.page.getByLabel('Password').fill(password);
    await this.page.getByRole('button', { name: /sign in/i }).click();
    await expect(this.page).toHaveURL(/\/chat/);
  }

  async logout() {
    await this.page.getByRole('button', { name: /logout/i }).click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
