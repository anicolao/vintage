import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Google session, workspace note and owned storage survive a real SDK flow', async ({ page, context, request }, testInfo) => {
  const reset = await request.delete('http://127.0.0.1:9299/emulator/v1/projects/demo-vintage/accounts', { timeout: 2_000 });
  expect(reset.ok()).toBeTruthy();
  // The emulator widget's optional CDN fonts/styles must not gate authentication.
  await context.route(/https:\/\/(unpkg.com|fonts.googleapis.com|fonts.gstatic.com)\//, route => route.abort());
  await page.goto('/connection-check');
  const popupEvent = page.waitForEvent('popup', { timeout: 2_000 });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const popup = await popupEvent;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.locator('#email-input').fill('alex.seller@example.test');
  await popup.locator('#display-name-input').fill('Alex Seller');
  await popup.locator('#sign-in').click();
  await expect(page.getByRole('heading', { name: 'Your workspace' })).toBeVisible();
  await expect(page.getByLabel('Workspace note')).toBeEnabled();
  await page.getByLabel('Workspace note').fill('A note saved for the next visit.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByText('Note saved and read back. It will be here after you reload.')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Signed in as')).toContainText('Alex Seller');
  await expect(page.getByLabel('Workspace note')).toHaveValue('A note saved for the next visit.');
  await page.getByText('Preview connection checks', { exact: true }).click();
  await page.getByRole('button', { name: 'Verify file storage' }).click();
  await expect(page.getByText('File uploaded, read back, and deleted successfully.')).toBeVisible();

  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata('Authenticated workspace', 'Google popup authentication, a persistent workspace note and an owned Storage round trip use the Firebase client SDK against local test emulators. Live preview verification is recorded separately.');
  await steps.step('workspace-verified', {
    description: 'The restored account verifies persistent notes and file storage',
    verifications: [
      { spec: 'Google session and note survive reload', check: async () => expect(page.getByLabel('Workspace note')).toHaveValue('A note saved for the next visit.') },
      { spec: 'An owned file is uploaded, read and cleaned up', check: async () => expect(page.getByText('File uploaded, read back, and deleted successfully.')).toBeVisible() }
    ]
  });
  steps.generateDocs();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  await expect(page.getByLabel('Workspace note')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
});
