import { expect, type Locator, type Page } from '@playwright/test'

async function expectUncovered(control: Locator) {
  await expect(control).toBeInViewport()
  await expect.poll(() => control.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.bottom - 3)
    return hit !== null && (element.contains(hit) || (element.matches(':disabled') && hit === element.parentElement))
  })).toBe(true)
}

/** Uses the isolated fixture's empty table; never submits an order. */
export async function verifyMobileOrderOverlays(page: Page, emptyTableLabel: string) {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await page.getByRole('button', { name: 'Diğer bölümleri aç', exact: true }).click()
    const more = page.getByRole('dialog', { name: 'Diğer bölümler', exact: true })
    const profile = more.getByRole('button', { name: /Profil/ })
    await profile.scrollIntoViewIfNeeded()
    await expectUncovered(profile)
    await more.getByRole('button', { name: 'Diğer bölümleri kapat', exact: true }).click()
    await expect(more).toBeHidden()

    await page.locator('.tb-floor-card__main').filter({ hasText: emptyTableLabel }).click()
    const detail = page.getByRole('dialog', { name: emptyTableLabel, exact: true })
    await detail.getByRole('button', { name: 'Sipariş başlat', exact: true }).click()
    const composer = page.getByRole('dialog', { name: 'Yeni sipariş oluştur', exact: true })
    await expect(composer).toBeVisible()
    await expect(detail).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(1)
    await expect(composer).toContainText(`${emptyTableLabel} için sipariş hazırlanıyor`)
    await expectUncovered(composer.getByRole('button', { name: 'Devam', exact: true }))
    const back = composer.getByRole('button', { name: 'Geri', exact: true })
    await expectUncovered(back)
    await back.click()
    const tableSelection = composer.getByRole('group', { name: 'Hangi masaya sipariş alıyorsun?' })
    await expect(tableSelection).toBeVisible()
    const next = composer.getByRole('button', { name: 'Devam', exact: true })
    await expect(next).toBeEnabled()
    await expectUncovered(next)
    await next.click()
    await expect(tableSelection).toBeHidden()
    await composer.getByRole('button', { name: 'İptal', exact: true }).click()
    await expect(composer).toBeHidden()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expectUncovered(page.getByRole('button', { name: 'Diğer bölümleri aç', exact: true }))
  }
}
