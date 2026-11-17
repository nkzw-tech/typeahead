import { expect, test } from '@playwright/test';

test('keyboard, IME, focus, pointer, and external input work in a browser', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('combobox', { name: 'Find a place' });
  await input.fill('東');
  await expect(page.getByRole('option', { exact: true, name: '東京' })).toBeVisible();
  for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
    for (const key of ['ArrowDown', 'ArrowUp', 'Escape', 'Enter']) {
      expect(
        await input.evaluate(
          (input, init) =>
            input.dispatchEvent(
              new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
            ),
          { ...init, key },
        ),
      ).toBe(true);
    }
  }
  await expect(input).toHaveValue('東');
  await input.press('Enter');
  await expect(page.getByTestId('selection')).toHaveText('東京');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.fill('lodz');
  await page.getByRole('option', { name: 'Łódź' }).click();
  await expect(input).toHaveValue('Łódź');
  await expect(input).toBeFocused();
  await input.fill('cafe');
  await input.press('Tab');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  const game = page.getByRole('combobox', { name: 'Game search' });
  await game.fill('a');
  await page.getByRole('button', { exact: true, name: 'next' }).click();
  await expect(game).toBeFocused();
  await page.getByRole('button', { exact: true, name: 'accept' }).click();
  await expect(game).toHaveValue('Ærø');
  await page.getByRole('combobox', { name: 'Add a tag' }).fill('custom tag');
  await page.getByRole('option', { name: 'custom tag' }).click();
  await expect(page.getByRole('button', { name: 'custom tag ×' })).toBeVisible();
});

test('mobile layout and touch selection', async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 },
  });
  const page = await context.newPage();
  await page.goto('/');
  const input = page.getByRole('combobox', { name: 'Find a place' });
  await input.fill('strasse');
  await page.getByRole('option', { name: 'Straße Berlin' }).tap();
  await expect(input).toHaveValue('Straße Berlin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await context.close();
});
