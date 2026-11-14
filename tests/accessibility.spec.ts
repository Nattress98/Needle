import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Accessibility', () => {
  test('page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });

  test('text and placeholders have sufficient contrast', async ({ page }) => {
    await page.goto('/#/playlists');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
    });

    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();

    expect(results.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target }) => target),
    }))).toEqual([]);
  });
});
