import { test as base } from '@playwright/test';
import { AuthPage } from '../pages/AuthPage';
import { ChatPage } from '../pages/ChatPage';
import { DocumentsPage } from '../pages/DocumentsPage';
import { SearchPage } from '../pages/SearchPage';

// Unique email per test run to avoid conflicts in a shared DB
const runId = Date.now();

type KnowledgeHubFixtures = {
  authPage: AuthPage;
  chatPage: ChatPage;
  documentsPage: DocumentsPage;
  searchPage: SearchPage;
  adminEmail: string;
  adminPassword: string;
};

export const test = base.extend<KnowledgeHubFixtures>({
  authPage: async ({ page }, use) => {
    await use(new AuthPage(page));
  },
  chatPage: async ({ page }, use) => {
    await use(new ChatPage(page));
  },
  documentsPage: async ({ page }, use) => {
    await use(new DocumentsPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
  adminEmail: async ({}, use) => {
    await use(`admin-${runId}@e2e.test`);
  },
  adminPassword: async ({}, use) => {
    await use('Test1234!');
  },
});

export { expect } from '@playwright/test';
