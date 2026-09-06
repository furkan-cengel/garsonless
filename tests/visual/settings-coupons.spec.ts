import { test, expect } from '@playwright/test'

const restaurant = process.env.SETTINGS_TEST_RESTAURANT_ID
const base = process.env.SETTINGS_TEST_URL ?? 'http://localhost:3000'
test.use({storageState:process.env.SETTINGS_TEST_STORAGE_STATE ?? 'test-results/visual-auth/dashboard-storage-state.json'})
test.beforeEach(async ({page})=>{
  expect(restaurant,'Pass an isolated development restaurant ID').toBeTruthy()
  expect(['localhost','127.0.0.1']).toContain(new URL(base).hostname)
  await page.goto(`${base}/dashboard/${restaurant}/settings?section=loyalty`)
  await expect(page.getByRole('button',{name:'Yeni kupon',exact:true})).toBeVisible({timeout:30000})
})

test('coupon validation does not submit loyalty, and Escape preserves then discards the draft',async({page})=>{
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click()
 const requests:string[]=[]
 await page.route('**/settings**',route=>{if(route.request().method()==='POST'){requests.push(route.request().postData()??'');return route.abort('failed')}return route.continue()})
 const dialog=page.getByRole('dialog',{name:'Yeni kupon',exact:true})
 await dialog.getByRole('textbox',{name:'İndirim (%)',exact:true}).fill('')
 await dialog.getByRole('button',{name:'Kuponu kaydet',exact:true}).click()
 await expect(dialog.getByRole('textbox',{name:'Kupon adı',exact:true})).toBeFocused()
 await expect(dialog.getByRole('textbox',{name:'İndirim (%)',exact:true})).toHaveValue('')
 await expect(page.getByText('Sadakat ayarları kaydediliyor…',{exact:true})).toHaveCount(0)
 expect(requests.filter(body=>body.includes('loyalty'))).toHaveLength(0)
 await dialog.getByRole('textbox',{name:'Kupon adı',exact:true}).fill('Korunan taslak')
 await page.keyboard.press('Escape')
 await expect(page.getByRole('alertdialog')).toBeVisible()
 await page.getByRole('button',{name:'Düzenlemeye devam et',exact:true}).click()
 await expect(dialog.getByRole('textbox',{name:'Kupon adı',exact:true})).toHaveValue('Korunan taslak')
 await dialog.getByRole('button',{name:'Vazgeç',exact:true}).click()
 await page.getByRole('button',{name:'Değişiklikleri sil',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 await expect(page.getByRole('button',{name:'Yeni kupon',exact:true})).toBeFocused()
})

test('shadcn selects expose labels, calendar Escape returns focus, and raw clock stays editable',async({page})=>{
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Yeni kupon',exact:true})
 await dialog.getByRole('combobox',{name:'İndirim türü',exact:true}).click()
 await page.getByRole('option',{name:'Sabit tutar',exact:true}).click()
 await expect(dialog.getByRole('combobox',{name:'İndirim türü',exact:true})).toContainText('Sabit tutar')
 await dialog.getByText('Tarih ve limitler',{exact:true}).click()
 await dialog.getByRole('button',{name:'Başlangıç',exact:true}).click()
 const calendar=page.getByRole('grid')
 await expect(calendar).toBeVisible()
 await page.getByRole('gridcell').filter({has:page.getByRole('button')}).nth(12).getByRole('button').click()
 await page.getByRole('textbox',{name:'Başlangıç saati',exact:true}).fill('14:')
 await expect(page.getByRole('textbox',{name:'Başlangıç saati',exact:true})).toHaveValue('14:')
 await page.keyboard.press('Escape')
 await expect(calendar).toHaveCount(0)
 await expect(dialog.getByRole('button',{name:'Başlangıç',exact:true})).toBeFocused()
 await expect(dialog.getByRole('button',{name:'Kuponu kaydet',exact:true})).toBeInViewport()
 const bounds=await dialog.boundingBox();const viewport=page.viewportSize()!
 expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(viewport.width+1)
})

test('transport retries preserve coupon draft and reuse the same request ID',async({page})=>{
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Yeni kupon',exact:true})
 await dialog.getByRole('textbox',{name:'Kupon adı',exact:true}).fill('Ağ hatası taslağı')
 const requests:string[]=[]
 await page.route('**/settings**',route=>{
  if(route.request().method()==='POST') {requests.push(route.request().postData()??'');return route.abort('failed')}
  return route.continue()
 })
 for(let i=0;i<2;i++) {
  await dialog.getByRole('button',{name:'Kuponu kaydet',exact:true}).click()
  await expect(dialog.getByRole('alert')).toContainText(/Taslağınız korundu/)
  await expect(dialog.getByRole('textbox',{name:'Kupon adı',exact:true})).toHaveValue('Ağ hatası taslağı')
  await expect(dialog.getByRole('button',{name:'Kuponu kaydet',exact:true})).toBeEnabled()
 }
 const writes=requests.filter(text=>text.includes('Ağ hatası taslağı'))
 expect(writes).toHaveLength(2)
 const ids=writes.map(text=>text.match(/requestId[^a-f0-9]+([a-f0-9-]{36})/)?.[1])
 expect(ids[0]).toBeTruthy();expect(ids[1]).toBe(ids[0])
})

test('history navigation retains a dirty coupon while the server section changes',async({page})=>{
 test.setTimeout(90000)
 await page.getByRole('button',{name:/^Çalışma Saatleri/}).click()
 await expect(page).toHaveURL(/section=hours$/)
 await expect(page.getByRole('heading',{name:'Çalışma Saatleri',exact:true})).toBeVisible()
 await page.getByRole('button',{name:/^Sadakat/}).click()
 await expect(page).toHaveURL(/section=loyalty$/)
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click()
 await page.getByRole('textbox',{name:'Kupon adı',exact:true}).fill('Geçmiş taslağı')
 await page.evaluate(() => window.history.back())
 await expect(page.getByRole('alertdialog')).toBeVisible()
 await page.getByRole('button',{name:/Düzenlemeye/}).click()
 await expect(page.getByRole('textbox',{name:'Kupon adı',exact:true})).toHaveValue('Geçmiş taslağı')
 await page.evaluate(() => window.history.back())
 await page.getByRole('alertdialog').getByRole('button',{name:'Değişiklikleri sil',exact:true}).click()
 await expect(page).toHaveURL(/section=hours$/)
 await expect(page.getByRole('heading',{name:'Çalışma Saatleri',exact:true})).toBeVisible()
 await page.goForward({waitUntil:'commit'})
 await expect(page).toHaveURL(/section=loyalty$/)
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click()
 await expect(page.getByRole('textbox',{name:'Kupon adı',exact:true})).toHaveValue('')
})


test('unchanged settings report no changes and notification values have readable labels',async({page})=>{
 for(const [button,section] of [['Çalışma Saatleri','hours'],['Vergi & Fatura','tax']] as const) {
  await page.getByRole('button',{name:new RegExp('^'+button)}).click();await expect(page).toHaveURL(new RegExp('section='+section+'$'));
  await expect(page.getByText('Değişiklik yok',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Kaydet',exact:true})).toBeDisabled();
 }
 await page.getByRole('button',{name:/^Bildirimler/}).last().click();await expect(page).toHaveURL(/section=notifications$/);
 await expect(page.getByRole('combobox',{name:'Yeni sipariş sesi',exact:true})).not.toHaveText('classic');
 await expect(page.getByRole('combobox',{name:'Yeni sipariş sesi tekrar aralığı',exact:true})).toContainText(/Tekrar etme|saniyede bir/);
 await expect(page.getByRole('combobox',{name:'Yeni sipariş sesi azami tekrar süresi',exact:true})).toContainText('dakika');
 await page.locator('[data-settings-nav]').getByRole('button',{name:/^Profil/}).click();await expect(page).toHaveURL(/section=profile$/);
 await page.getByRole('button',{name:'E-posta adresini değiştir',exact:true}).click();await expect(page).toHaveURL(/section=security$/);
 await page.getByRole('button',{name:/^Gizlilik/}).click();await expect(page).toHaveURL(/section=privacy$/);
 const reason=page.getByRole('textbox',{name:'Talep gerekçesi',exact:true});await expect(reason).toHaveAttribute('autocomplete','off');await expect(reason).toHaveValue('');
 expect(await reason.evaluate(element=>element.tagName)).toBe('TEXTAREA');
})

test('double click sends one request and pending save cannot close the editor',async({page})=>{
 await page.getByRole('button',{name:'Yeni kupon',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Yeni kupon',exact:true});await dialog.getByRole('textbox',{name:'Kupon adı',exact:true}).fill('Tek kayıt taslağı');
 let count=0;let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve});
 await page.route('**/settings**',async route=>{if(route.request().method()==='POST'&&route.request().postData()?.includes('Tek kayıt taslağı')){count++;await pending;await route.abort('failed')}else await route.continue()});
 await dialog.getByRole('button',{name:'Kuponu kaydet',exact:true}).dblclick();
 await expect(dialog.getByRole('button',{name:'Kaydediliyor…',exact:true})).toBeDisabled();
 await page.keyboard.press('Escape');await expect(dialog).toBeVisible();await expect(page.getByRole('alertdialog')).toHaveCount(0);
 release();await expect(dialog.getByRole('alert')).toContainText('Taslağınız korundu');expect(count).toBe(1);
})
