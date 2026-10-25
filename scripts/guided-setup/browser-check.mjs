import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'
import { readFile, writeFile, mkdir, rm, access } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
const root = process.cwd(), app = resolve(root, 'apps/dashboard'), qa = resolve(app, 'app/guided-setup-qa')
const output = '/private/tmp/masabu-guided-setup-browser'
assert.equal(await access(qa).then(() => true, () => false), false, 'QA route already exists')
assert.equal(await fetch('http://127.0.0.1:3028').then(() => true, () => false), false, 'QA port must be free')
const backups = await Promise.all(['tsconfig.json','next-env.d.ts'].map(async name => [name, await readFile(resolve(app,name))]))
let server, browser, page, logs = ''
async function settle(page) { await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() }); await page.waitForTimeout(150) }
const rid = '00000000-0000-4000-8000-000000000099'
try {
  await mkdir(qa); await mkdir(output, {recursive:true})
  let source = await readFile(resolve(app,'components/onboarding/GuidedSetup.tsx'),'utf8')
  source = source.replaceAll("from './", "from '@/components/onboarding/").replace("from '../overlays/", "from '@/components/overlays/").replace("from 'next/navigation'", "from './navigation'")
  await writeFile(resolve(qa,'GuidedSetup.tsx'), source)
  await writeFile(resolve(qa,'navigation.ts'), `'use client'
import {useSyncExternalStore} from 'react'
let path='/dashboard/${rid}/menu'
const listen=(fn:()=>void)=>{window.addEventListener('qa-navigate',fn);return()=>window.removeEventListener('qa-navigate',fn)}
export function usePathname(){return useSyncExternalStore(listen,()=>path,()=>path)}
export function useRouter(){return {push:(value:string)=>{path=value.split('?')[0]!;window.dispatchEvent(new Event('qa-navigate'))},refresh:()=>{}}}
`)
  await writeFile(resolve(qa,'page.tsx'), `import {notFound} from 'next/navigation'
import Fixture from './Fixture'
export default function Page(){if(process.env.NODE_ENV!=='development')notFound();return <Fixture/>}
`)
  await writeFile(resolve(qa,'Fixture.tsx'), `'use client'
import {useRef,useState} from 'react'
import GuidedSetup from './GuidedSetup'
import {usePathname} from './navigation'
import {ShellContext,type ShellContextValue} from '@/lib/shell-context'
import {MenuManagerTopBar} from '@/components/menu/MenuManagerChrome'
import {Button} from '@/components/ui/button'
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog'
const entitlements=Object.fromEntries(['menu','theme','settings'].map(key=>[key,{allowed:true}]))
export default function Fixture(){const [manual,setManual]=useState(false);const path=usePathname();const search=useRef<HTMLInputElement>(null),file=useRef<HTMLInputElement>(null)
const shell={overlay:null,beginNavigation:()=>null,getNavigationGuard:()=>null,setNavigationGuard:()=>{},openNotifications:()=>{},openStoreSwitcher:()=>{}} as unknown as ShellContextValue
return <ShellContext.Provider value={shell}><main style={{height:'100dvh',padding:16}}><p>Yerel test · Örnek menü</p>{path.endsWith('/menu')?<MenuManagerTopBar restaurantName="Örnek Restoran" publicMenuPath="/ornek" search="" searchFocused={false} searchInputRef={search} importFileInputRef={file} categoryCount={1} itemCount={2} workspaceStage="categories" mobileContext="Kategoriler" onSearchChange={()=>{}} onSearchFocusChange={()=>{}} onImportFileChange={()=>{}} onOpenImport={()=>{}} onOpenTranslations={()=>{}} onOpenAddCategory={()=>{}} onOpenAddItem={()=>setManual(true)} onMobileBack={()=>{}} onClearSearch={()=>{}} onBulkAll={()=>{}}/>:path.endsWith('/theme')?<div className="flex gap-4 py-8"><div data-theme-editor-preview-toolbar>Önizleme</div><Button data-theme-editor-save-draft>Kaydet</Button><Button data-theme-editor-publish>Yayınla</Button></div>:<Button data-guide="workspace-logo">Logo yükle</Button>}<Dialog open={manual} onOpenChange={setManual}><DialogContent><DialogHeader><DialogTitle>QA product editor</DialogTitle></DialogHeader><Button onClick={()=>setManual(false)}>Close QA editor</Button></DialogContent></Dialog><GuidedSetup restaurantId="${rid}" userKey="qa" permissions={['menu','theme','settings']} isOwner entitlements={entitlements as never} onboarding={null}/></main></ShellContext.Provider>}
`)
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3028'],{cwd:app,env:{...process.env,NEXT_DIST_DIR:'.next-guided-qa'},stdio:['ignore','pipe','pipe']})
  server.stdout.on('data',d=>logs+=d);server.stderr.on('data',d=>logs+=d)
  for(let i=0;i<120;i++){if(await fetch('http://127.0.0.1:3028/guided-setup-qa').then(r=>r.ok,()=>false))break;if(i===119||server.exitCode!==null)throw Error(logs);await delay(500)}
  browser=await chromium.launch({headless:true})
  const errors=[], checks=[]
  for(const width of [1440,390]) {
    const context=await browser.newContext({viewport:{width,height:900},locale:'tr-TR'})
    page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))
    let jobs=[], count=0, writes=0
    await page.route('**/api/menu-import?**', async route=>{
      const method=route.request().method()
      if(method==='POST') jobs=[{id:'00000000-0000-4000-8000-000000000088',filename:'menu.png',status:'queued',rows:[],revision:0,error:null,created_at:new Date().toISOString(),imported_count:0}]
      if(method==='PATCH') {const body=route.request().postDataJSON();if(body.mode==='dismiss')jobs=[];else {jobs[0]={...jobs[0],rows:body.rows,revision:jobs[0].revision+1,status:body.mode==='apply'?'applied':'review',imported_count:body.mode==='apply'?body.rows.length:0};if(body.mode==='apply'){count=body.rows.length;writes++}}}
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(method==='GET'?{jobs,itemCount:count,hasLogo:false,enabled:true}:{job:jobs[0]})})
    })
    await page.goto('http://127.0.0.1:3028/guided-setup-qa')
    await page.getByRole('button',{name:'Kurulum rehberi',exact:true}).click()
    await expect(page.getByText('0/2 tamamlandı')).toBeVisible()
    await settle(page); await page.screenshot({animations:'disabled',path:resolve(output,`checklist-${width}.png`)})
    await page.getByRole('button',{name:'Bana göster',exact:true}).first().click()
    await expect(page.getByRole('heading',{name:'Dosyandan menü oluştur'})).toBeVisible()
    await settle(page); await page.screenshot({animations:'disabled',path:resolve(output,`tour-${width}.png`)})
    if(width===390)await page.getByRole('button',{name:'Menü işlemleri',exact:true}).click()
    await page.locator('[data-guide="menu-ai-import"]:visible').click()
    await expect(page.getByRole('heading',{name:'Menünü dosyadan hazırlayalım'})).toBeVisible()
    await page.locator('#ai-menu-file').setInputFiles({name:'menu.png',mimeType:'image/png',buffer:Buffer.from('test fixture')})
    await page.getByRole('button',{name:'Menüyü oku',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Sıraya alındı'})).toBeVisible()
    await page.getByRole('button',{name:'Paneli keşfet',exact:true}).click()
    await expect(page.getByRole('button',{name:'Aktarımı aç',exact:true})).toBeVisible()
    jobs=[{...jobs[0],status:'review',revision:2,rows:[{category:'Çorbalar',name:'Mercimek',description:'Günlük',price:null}]}]
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))
    await page.getByRole('button',{name:'Aktarımı aç',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Kontrolüne hazır'})).toBeVisible()
    await expect(page.getByRole('button',{name:'Kontrol ettim, 1 ürünü ekle',exact:true})).toBeDisabled()
    await page.getByLabel('Fiyat (TL)',{exact:true}).fill('120.50')
    await page.getByRole('button',{name:'Kapat',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Kaydedilmemiş düzenlemeler var'})).toBeVisible()
    await page.getByRole('button',{name:'Düzenlemeye dön',exact:true}).click()
    await page.getByRole('button',{name:'Taslağı kaydet',exact:true}).click()
    await expect(page.getByRole('button',{name:'Taslak kaydedildi',exact:true})).toBeVisible()
    await settle(page); await page.screenshot({animations:'disabled',path:resolve(output,`review-${width}.png`)})
    await page.getByRole('button',{name:'Kontrol ettim, 1 ürünü ekle',exact:true}).click()
    await page.getByRole('button',{name:'Menüye ekle',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Menüne eklendi'})).toBeVisible()
    assert.equal(writes,1)
    await page.getByRole('button',{name:'Kapat',exact:true}).click()
    if(width===1440) {
      await page.locator('[data-guide="menu-create"]:visible').click()
      await expect(page.getByRole('heading',{name:'QA product editor'})).toBeVisible()
      await expect(page.locator('[data-slot="popover-content"]')).toBeHidden()
      await page.getByRole('button',{name:'Close QA editor',exact:true}).click()
      await expect(page.locator('[data-slot="popover-content"]')).toBeVisible()
    }
    await page.getByRole('button',{name:'Kurulum rehberi',exact:true}).click()
    await expect(page.getByText('1/2 tamamlandı')).toBeVisible()
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)
    checks.push(`${width}px: checklist, anchored tour, upload, background tracking, price validation, unsaved guard, save and confirmed import`)
    await context.close()
  }
  assert.deepEqual(errors,[])
  console.log(JSON.stringify({checks,output},null,2))
} catch(error) {if(page&&!page.isClosed())await settle(page); await page.screenshot({animations:'disabled',path:resolve(output,'failure.png')}).catch(()=>{});await writeFile(resolve(output,'server.log'),logs);throw error}
finally {await browser?.close();server?.kill('SIGTERM');if(server)await Promise.race([new Promise(r=>server.once('exit',r)),delay(10000)]);await rm(qa,{recursive:true,force:true});for(const[name,contents]of backups)await writeFile(resolve(app,name),contents);await rm(resolve(app,'.next-guided-qa'),{recursive:true,force:true})}
