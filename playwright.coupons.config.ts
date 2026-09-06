import {defineConfig} from '@playwright/test'
export default defineConfig({
 testDir:'./tests/visual',testMatch:'settings-coupons.spec.ts',timeout:60000,expect:{timeout:15000},workers:1,retries:0,
 reporter:[['list']],outputDir:'test-results/settings-coupons',use:{browserName:'chromium',screenshot:'only-on-failure'},
 projects:[{name:'coupon-mobile',use:{viewport:{width:390,height:844}}},{name:'coupon-tablet',use:{viewport:{width:768,height:1024}}},{name:'coupon-desktop',use:{viewport:{width:1440,height:900}}}]
})
