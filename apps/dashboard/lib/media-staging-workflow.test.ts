import assert from 'node:assert/strict'
import test from 'node:test'
import type { MediaUploadRow } from '@garsonless/db/server'
import { createMediaStagingWorkflow, cleanupMediaStaging } from './media-staging-workflow'
import { readMediaMetadataRequest } from './media-staging-request'
import { mediaPrepareSchema, validateStagingMetadata } from './media-staging-policy'
const actor = crypto.randomUUID(), restaurantId = crypto.randomUUID(), entityId = crypto.randomUUID()
function harness() {
  const rows = new Map<string, MediaUploadRow>(), calls: string[] = []
  let allowed = true, downloadFails = false, publishFails = false, size = 5 * 1024 * 1024, type = 'image/png', count = 0
  const port = {
    async create(v: { id: string; userId: string; restaurantId: string; kind: string; metadata: MediaUploadRow['metadata']; path: string }) {
      const row: MediaUploadRow = { id: v.id, user_id: v.userId, restaurant_id: v.restaurantId, kind: v.kind as MediaUploadRow['kind'], metadata: v.metadata, path: v.path, status: 'pending', result: null, created_at: new Date().toISOString(), expires_at: new Date(Date.now()+60000).toISOString() }
      rows.set(row.id,row); return row
    },
    async read(id: string, userId: string) { const r=rows.get(id); return r?.user_id === userId ? {...r} : null },
    async claim(id: string, userId: string) { const r=rows.get(id); if (!r || r.user_id!==userId || r.status!=='pending') return null; r.status='processing'; return {...r} },
    async release(id: string) { const r=rows.get(id)!; r.status='pending'; return r },
    async finish(id: string, _userId: string, result: MediaUploadRow['result']) { const r=rows.get(id)!; r.status='finished'; r.result=result; return r },
    async sign() { return 'https://storage.example/signed' },
    async download() { if(downloadFails) throw new Error('network'); return new Blob([new Uint8Array(size)], {type}) },
    async expired() { return [...rows.values()] },
    async removeObjects(paths: string[]) { calls.push(`remove:${paths.join(',')}`) },
    async removeRecords(ids: string[]) { for(const id of ids){calls.push(`record:${id}`);rows.delete(id)};return null },
    async removeObject(path: string) { calls.push(`remove:${path}`) },
    async removeRecord(id: string) { const r=rows.get(id)!; calls.push(`record:${id}`); rows.delete(id); return r },
  }
  const workflow=createMediaStagingWorkflow({ port, authorize:async()=>allowed, publish:async(_kind,data)=>{
    count++; assert.equal(data.get('restaurantId'),restaurantId)
    if(publishFails) throw new Error('unknown write outcome')
    return {url:'https://assets.example/final.webp'}
  } })
  return { workflow,port,rows,calls,input:{restaurantId,entityId,kind:'categories' as const,type:'image/png',size},
    allowed:(v:boolean)=>{allowed=v}, downloadFail:()=>{downloadFails=true}, publishFail:()=>{publishFails=true},
    actual:(s:number,t:string)=>{size=s;type=t}, count:()=>count }
}
test('size/type/purpose limits preserve 5 and 8 MiB and 2 MiB icons',()=>{
  const input={restaurantId,entityId,kind:'items' as const,size:5*1024*1024,type:'image/png'}
  assert.equal(validateStagingMetadata('menu-image',input),null)
  assert.ok(validateStagingMetadata('menu-image',{...input,size:input.size+1}))
  assert.equal(validateStagingMetadata('theme-image',{restaurantId,size:8*1024*1024,type:'image/png',purpose:'gallery-image'}),null)
  assert.ok(validateStagingMetadata('theme-image',{restaurantId,size:input.size,type:'image/png',purpose:'auth-header-logo'}))
  assert.equal(validateStagingMetadata('theme-video',{restaurantId,size:8*1024*1024,type:'video/mp4'}),null)
  assert.equal(mediaPrepareSchema.safeParse({...input,size:9*1024*1024}).success,false)
  assert.ok(validateStagingMetadata('theme-video',{restaurantId,size:4,type:'image/svg+xml'}))
})
test('unauthorized preparation grants no upload',async()=>{
  const h=harness();h.allowed(false)
  assert.equal((await h.workflow.prepare('menu-image',h.input,actor)).status,403);assert.equal(h.rows.size,0)
})
test('concurrent finalization and response replay publish exactly once',async()=>{
  const h=harness(),id=(await h.workflow.prepare('menu-image',h.input,actor)).body.uploadId as string
  const responses=await Promise.all([h.workflow.complete('menu-image',id,actor),h.workflow.complete('menu-image',id,actor)])
  assert.ok(responses.some(r=>r.status===200));assert.ok(responses.some(r=>r.status===202))
  assert.equal((await h.workflow.complete('menu-image',id,actor)).status,200);assert.equal(h.count(),1)
})
test('other actors, wrong kind, revoked access and expired tickets cannot publish',async()=>{
  const h=harness(),id=(await h.workflow.prepare('menu-image',h.input,actor)).body.uploadId as string
  assert.equal((await h.workflow.complete('menu-image',id,entityId)).status,404)
  assert.equal((await h.workflow.complete('theme-image',id,actor)).status,404)
  h.allowed(false);assert.equal((await h.workflow.complete('menu-image',id,actor)).status,403)
  h.allowed(true);h.rows.get(id)!.expires_at=new Date(0).toISOString()
  assert.equal((await h.workflow.complete('menu-image',id,actor)).status,410);assert.equal(h.count(),0)
})
test('size or MIME substitution is rejected before publish',async()=>{
  for(const [size,type] of [[10,'image/png'],[5*1024*1024,'image/jpeg']] as const){
    const h=harness(),id=(await h.workflow.prepare('menu-image',h.input,actor)).body.uploadId as string
    h.actual(size,type);assert.equal((await h.workflow.complete('menu-image',id,actor)).status,400);assert.equal(h.count(),0)
  }
})
test('download failure is retryable; an unknown write outcome never repeats publish',async()=>{
  const h=harness(),id=(await h.workflow.prepare('menu-image',h.input,actor)).body.uploadId as string
  h.downloadFail();assert.equal((await h.workflow.complete('menu-image',id,actor)).status,503);assert.equal(h.rows.get(id)!.status,'pending')
  const h2=harness(),id2=(await h2.workflow.prepare('menu-image',h2.input,actor)).body.uploadId as string
  h2.publishFail();await assert.rejects(h2.workflow.complete('menu-image',id2,actor))
  assert.equal((await h2.workflow.complete('menu-image',id2,actor)).status,202);assert.equal(h2.count(),1)
})
test('cleanup removes private object before deleting tracking',async()=>{
  const h=harness();await h.workflow.prepare('menu-image',h.input,actor)
  assert.equal(await cleanupMediaStaging(h.port),1);assert.match(h.calls[0]!,/^remove:/);assert.match(h.calls[1]!,/^record:/)
})
test('bounded JSON reader rejects cross-origin, oversized and malformed requests',async()=>{
  const request=(body:string,origin='https://app.example')=>new Request('https://app.example/api/uploads/menu-image/prepare',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body})
  assert.deepEqual(await readMediaMetadataRequest(request('{"size":5}')),{size:5})
  await assert.rejects(readMediaMetadataRequest(request('{}','https://evil.example')))
  await assert.rejects(readMediaMetadataRequest(request(' '.repeat(5000))))
  await assert.rejects(readMediaMetadataRequest(request('{')))
})
