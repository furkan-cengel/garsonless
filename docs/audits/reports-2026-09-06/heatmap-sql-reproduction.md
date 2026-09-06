# SQL doğrulama senaryosu

Aşağıdaki kodu geçici bir `.mjs` dosyasına kaydedip depo kökünden, mevcut PGlite kurulumunun modül yolunu ilk argüman olarak vererek çalıştırın. Uygulama bağımlılığı eklenmez.

```javascript
// Supply an existing PGlite installation path as argv[2]; no application dependency is added.
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
import fs from 'node:fs/promises'
import assert from 'node:assert/strict'
const root = process.cwd()
const db = new PGlite()
await db.exec(`create table orders(id uuid, restaurant_id uuid, created_at timestamptz, paid_at timestamptz, session_id uuid, deleted_at timestamptz, status text, source text, payment_method text, total numeric, items jsonb);`)
const migration=await fs.readFile(root+'/packages/db/supabase/migrations/20260906130000_analytics_full_day_heatmap.sql','utf8')
await db.exec(migration)
const tenant='11111111-1111-4111-8111-111111111111'
for(const [index,time] of ['00:00:00','07:59:00','22:59:00','23:59:00'].entries()){
 await db.query(`insert into orders values ($1,$2,$3,$3,null,null,'served','staff','cash',100,'[{"name":"Kahve","quantity":1,"price":100}]')`,[`22222222-2222-4222-8222-${String(index).padStart(12,'0')}`,tenant,`2026-09-05T${time}+03:00`])
}
const result=await db.query(`select read_analytics_core_metrics($1,'2026-09-03T21:00:00Z','2026-09-04T21:00:00Z','2026-09-05T21:00:00Z','Europe/Istanbul',null,null,null) as report`,[tenant])
const report=result.rows[0].report
assert.equal(report.heatmap.length,168)
assert.equal(report.currentOrders,4)
assert.equal(report.currentRevenue,400)
assert.equal(report.heatmap.reduce((s,r)=>s+r.count,0),4)
assert.deepEqual(report.heatmap.filter(r=>r.count).map(r=>r.hour),[0,7,22,23])
console.log(JSON.stringify({cells:report.heatmap.length,orders:report.currentOrders,revenue:report.currentRevenue,coveredHours:report.heatmap.filter(r=>r.count).map(r=>r.hour)}))
await db.close()
```
