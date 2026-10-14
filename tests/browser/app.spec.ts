import { expect, test } from '@playwright/test';

test('solve with the real worker, reload offline, undo, and complete the guide', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Siap dipakai offline', { exact: true })).toBeVisible({ timeout: 20000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Lihat panduan dengan Rubik contoh' }).click();
  await page.getByRole('button', { name: 'Cari solusi' }).click();
  await expect(page.getByRole('heading', { name: 'Pegang seperti ini, ya.' })).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Sudah cocok, mulai' }).click();
  await page.getByRole('button', { name: 'Sudah, lanjut', exact: true }).click();
  await page.getByRole('button', { name: 'Batalkan langkah sebelumnya' }).click();
  await page.getByRole('button', { name: 'Sudah dibatalkan' }).click();
  await page.getByRole('button', { name: 'Sudah, lanjut', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Lanjutkan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Cocokkan sebelum melanjutkan.' })).toBeVisible();
  await page.getByRole('button', { name: 'Sudah cocok, mulai' }).click();
  while (await page.getByRole('button', { name: 'Sudah, lanjut', exact: true }).count()) {
    await page.getByRole('button', { name: 'Sudah, lanjut', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Sudah, selesai!' }).click();
  await expect(page.getByRole('heading', { name: 'Beres. Kamu berhasil!' })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const width of [320, 375, 414, 768, 1280]) {
  test(`home and editor fit ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Scan Rubik', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Isi manual', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `test-results/editor-${width}.png`, fullPage: true });
  });
}

test('camera denial explains the manual fallback', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan Rubik', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Izin kamera');
  await page.getByRole('button', { name: 'Isi manual', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pilih hijau' })).toBeVisible();
});
