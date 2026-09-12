import { expect, type Page, type BrowserContext, type APIRequestContext } from '@playwright/test';
export async function resetAuth(request: APIRequestContext) {
  const response = await request.delete('http://127.0.0.1:9299/emulator/v1/projects/demo-vintage/accounts', { timeout: 2_000 });
  expect(response.ok()).toBeTruthy();
}
export async function signIn(page: Page, context: BrowserContext, email = 'alex.seller@example.test', name = 'Alex Seller') {
  await context.route(/https:\/\/(unpkg.com|fonts.googleapis.com|fonts.gstatic.com)\//, route => route.abort());
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
  const popupEvent = page.waitForEvent('popup', { timeout: 2_000 });
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const popup = await popupEvent;
  await popup.getByRole('button', { name: 'Add new account' }).click();
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill(name);
  await popup.locator('#sign-in').click();
}
