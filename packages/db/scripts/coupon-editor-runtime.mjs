// No remote credentials or database URLs: this suite owns a disposable, networkless database.
import { spawnSync, spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
const name = `masabu-coupon-test-${process.pid}`
const docker = process.env.DOCKER_BIN || 'docker'
const root = new URL('../', import.meta.url)
const read = path => readFileSync(new URL(path,root),'utf8')
function run(args,input) {
 const result=spawnSync(docker,args,{input,encoding:'utf8',timeout:60000})
 if(result.status!==0) throw new Error(result.stderr||result.error?.message||'Docker command failed')
 return result.stdout+result.stderr
}
try {
 run(['run','--rm','-d','--name',name,'--network','none','-e','POSTGRES_PASSWORD=local-test-only','public.ecr.aws/supabase/postgres:17.6.1.127'])
 let ready=false
 for(let attempt=0;attempt<25;attempt++) {
  if(spawnSync(docker,['exec',name,'pg_isready','-U','postgres'],{stdio:'ignore'}).status===0){ready=true;break}
  await setTimeout(500)
 }
 if(!ready) throw new Error('Disposable PostgreSQL did not start')
 const bootstrap=`
 do $$ begin
 if not exists(select from pg_roles where rolname='anon') then create role anon; end if;
 if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if;
 if not exists(select from pg_roles where rolname='service_role') then create role service_role; end if;
 end $$;
 create table restaurants(id uuid primary key,deleted_at timestamptz);
 create table menu_categories(id uuid primary key,restaurant_id uuid references restaurants,deleted_at timestamptz);
 create table menu_items(id uuid primary key,category_id uuid references menu_categories,deleted_at timestamptz);
 create table customers(id uuid primary key);
 create table orders(id uuid primary key,restaurant_id uuid,customer_id uuid,deleted_at timestamptz,status text,total numeric,discount_breakdown jsonb,updated_at timestamptz);
 create table order_refunds(id uuid primary key,order_id uuid,status text,kind text);
 `
 const sql=bootstrap+read('supabase/migrations/20260818010000_coupon_foundation.sql')+read('supabase/migrations/20260906140000_coupon_editor_atomic.sql')+read('scripts/coupon-editor-runtime.sql')
 const output=run(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql)
 console.log(output.split('\n').filter(line=>line.includes('PASS:')).join('\n'))

 function asyncSql(sql) {
  return new Promise((resolve,reject)=>{
   const child=spawn(docker,['exec','-i',name,'psql','-U','postgres','-At','-v','ON_ERROR_STOP=1'],{stdio:['pipe','pipe','pipe']})
   let out='',err='';child.stdout.on('data',chunk=>{out+=chunk});child.stderr.on('data',chunk=>{err+=chunk});child.on('error',reject)
   child.on('close',code=>code===0?resolve(out.trim()):reject(new Error(err)))
   child.stdin.end(sql)
  })
 }
 const restaurant='10000000-0000-4000-8000-000000000001'
 const input=JSON.parse(run(['exec',name,'psql','-U','postgres','-At','-c',"select input from coupon_write_requests order by created_at limit 1"]).trim())
 input.code='PARALLEL';input.scope='order';input.categoryIds=[];input.itemIds=[]
 const request=randomUUID()
 const statement=(id,payload)=>`select save_restaurant_coupon_atomic('${restaurant}','${id}','${JSON.stringify(payload).replaceAll("'","''")}'::jsonb);`
 const replies=await Promise.all([asyncSql(statement(request,input)),asyncSql(statement(request,input))])
 assert.equal(replies[0],replies[1]);console.log('PASS: simultaneous same-request writes return the same coupon')
 const saved=JSON.parse(replies[0]).coupon
 const update={...input,id:saved.id,expectedUpdatedAt:saved.updated_at}
 const updates=await Promise.allSettled([asyncSql(statement(randomUUID(),{...update,name:'Editor A'})),asyncSql(statement(randomUUID(),{...update,name:'Editor B'}))])
 assert.equal(updates.filter(result=>result.status==='fulfilled').length,1)
 const rejected=updates.find(result=>result.status==='rejected');assert.match(rejected.reason.message,/COUPON_VERSION_CONFLICT/)
 console.log('PASS: simultaneous edits commit once and reject the stale editor')
} finally {spawnSync(docker,['rm','-f',name],{stdio:'ignore'})}
