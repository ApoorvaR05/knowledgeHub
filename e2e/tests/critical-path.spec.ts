import * as path from 'path';
import { test, expect } from '../fixtures';

/**
 * Critical Path E2E Test
 *
 * Covers the full user journey:
 *   1. Register as admin
 *   2. Upload a document
 *   3. Wait for document to be processed (status → ready)
 *   4. Ask a question in chat → receive a streamed AI answer
 *   5. Search the knowledge base → get ranked results
 *   6. Verify route guard — regular user cannot access admin pages
 *
 * This test runs against the full stack. When mocks are enabled
 * (VITE_ENABLE_MOCKS=true) it works without a real backend, making it
 * suitable for CI before the backend is deployed.
 */

const SAMPLE_DOC = path.join(__dirname, '../fixtures/sample-document.txt');

test.describe('Critical Path', () => {
  test('register → upload document → ask question → receive answer', async ({
    page,
    authPage,
    chatPage,
    documentsPage,
    adminEmail,
    adminPassword,
  }) => {
    // ── 1. Register as admin ─────────────────────────────────────────────────
    await authPage.register(adminEmail, adminPassword, 'admin');
    await expect(page).toHaveURL(/\/chat/);

    // Navbar should show the admin email and role badge
    await expect(page.locator('.navbar-user')).toContainText(adminEmail);
    await expect(page.locator('.badge-info')).toContainText('admin');

    // ── 2. Upload a document ─────────────────────────────────────────────────
    await documentsPage.goto();
    await expect(page).toHaveURL(/\/admin\/documents/);

    const beforeCount = await documentsPage.getDocumentCount();
    await documentsPage.uploadFile(SAMPLE_DOC);

    // Row should appear immediately with processing status
    await expect(page.locator('tbody tr')).toHaveCount(beforeCount + 1, { timeout: 5_000 });

    // ── 3. Wait for document to be ready ─────────────────────────────────────
    await documentsPage.waitForStatus('sample-document', 'ready', 15_000);

    // ── 4. Ask a question in chat ────────────────────────────────────────────
    await chatPage.goto();
    await chatPage.createNewSession();
    await chatPage.sendMessage('What is the vacation policy?');

    // User bubble should appear immediately
    await expect(page.locator('.message-bubble.user').last()).toContainText('vacation policy');

    // Wait for streaming to finish
    await chatPage.waitForResponse(30_000);
    await chatPage.assertAssistantReplied();

    const answer = await chatPage.getLastAssistantMessage();
    expect(answer.length).toBeGreaterThan(10);

    // ── 5. Search the knowledge base ─────────────────────────────────────────
    await page.goto('/search');
    await page.getByPlaceholder(/type a question/i).fill('vacation');
    await page.getByRole('button', { name: /search/i }).click();

    await expect(page.locator('.result-card').first()).toBeVisible({ timeout: 10_000 });
    const resultCount = await page.locator('.result-card').count();
    expect(resultCount).toBeGreaterThan(0);
  });

  test('regular user cannot access admin pages', async ({
    page,
    authPage,
    adminPassword,
  }) => {
    const userEmail = `user-${Date.now()}@e2e.test`;

    await authPage.register(userEmail, adminPassword, 'user');
    await expect(page).toHaveURL(/\/chat/);

    // Admin nav links should not be visible
    await expect(page.getByRole('link', { name: /documents/i })).not.toBeVisible();
    await expect(page.getByRole('link', { name: /q&a pairs/i })).not.toBeVisible();

    // Direct navigation to admin page should redirect
    await page.goto('/admin/documents');
    await expect(page).not.toHaveURL(/\/admin/);
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Clear any stored token
    await page.evaluate(() => localStorage.removeItem('token'));

    await page.goto('/chat');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin/documents');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login page shows error on wrong credentials', async ({ page, authPage }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page.locator('.alert-error')).toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/login/); // stays on login
  });
});
