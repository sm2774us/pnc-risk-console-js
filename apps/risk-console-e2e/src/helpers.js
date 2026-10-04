import { expect } from '@playwright/test';
/** Signs in through the persona picker (the same path a user takes). */
export async function signIn(page, role) {
  await page.goto('/login');
  await page
    .getByRole('button', { name: new RegExp(role, 'i') })
    .first()
    .click();
  await expect(page).toHaveURL(/dashboard/);
}
/** The slide-over nav is collapsed on narrow viewports; open it when the menu button is shown. */
export async function openNav(page) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
}
/** Navigates via the primary nav (exact name, so in-page links such as "Review accumulation" never collide). */
export async function goTo(page, name) {
  await openNav(page);
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name, exact: true }).click();
}
