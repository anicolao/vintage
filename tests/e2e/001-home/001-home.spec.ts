import { expect, test } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('home screen is ready to begin a listing', async ({ page }, testInfo) => {
  const steps = new TestStepHelper(page, testInfo);
  steps.setMetadata(
    'Vintage home screen',
    'The SPA reaches the Firebase emulator and presents the AI-first seller proposition.'
  );

  await page.goto('/');
  await steps.step('home-ready', {
    description: 'The home screen is connected and ready',
    verifications: [
      {
        spec: 'The page exposes the stable Vintage title',
        check: async () => expect(page).toHaveTitle('Vintage — List smarter. Earn more.')
      },
      {
        spec: 'The product promise is visible',
        check: async () => {
          await expect(page.getByRole('heading', { level: 1 })).toHaveText('List smarter.Earn more.');
          await expect(page.getByText('Turn a few photos into a listing written like you, with pricing built for value.')).toBeVisible();
        }
      },
      {
        spec: 'The Google sign-in action becomes available after the emulator responds',
        check: async () => expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled()
      },
      {
        spec: 'The seller-learning promise is complete',
        check: async () => {
          await expect(page.getByText('Your listing style')).toBeVisible();
          await expect(page.getByText('How you describe condition')).toBeVisible();
          await expect(page.getByText('Your pricing approach')).toBeVisible();
        }
      },
      {
        spec: 'The backend readiness status is visible',
        check: async () => expect(page.getByRole('status')).toHaveText('Prototype ready')
      }
    ]
  });

  steps.generateDocs();
});
