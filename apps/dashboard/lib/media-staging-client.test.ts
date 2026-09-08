import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { uploadMenuImage, uploadThemeMedia, uploadThemeVideo } from './dashboard-media-upload-client'
import { isMediaSignedUploadUrl } from './media-staging-client'
const origin='https://storage.example'
const signedUrl=`${origin}/storage/v1/object/upload/sign/restaurant-media-staging/actor/id/source?token=test`
process.env.NEXT_PUBLIC_SUPABASE_URL=origin
const cases=[
  {kind:'menu-image',run:uploadMenuImage,size:5*1024*1024,type:'image/png',extra:{entityId:crypto.randomUUID(),kind:'categories'},result:{url:'https://assets.example/image.png'}},
  {kind:'theme-image',run:uploadThemeMedia,size:8*1024*1024,type:'image/png',extra:{purpose:'gallery-image'},result:{url:'https://assets.example/image.webp',width:24,height:24,mime:'image/webp'}},
  {kind:'theme-video',run:uploadThemeVideo,size:8*1024*1024,type:'video/mp4',extra:{},result:{url:'https://assets.example/video.mp4',durationSeconds:5,mime:'video/mp4'}},
]
for(const s of cases)test(`${s.kind}: full-size file bypasses Vercel and concurrent calls share upload`,async()=>{
  const form=new FormData();form.set('restaurantId',crypto.randomUUID())
  for(const [key,value] of Object.entries(s.extra))if(value)form.set(key,value)
  form.set('file',new File([new Uint8Array(s.size)],'large-file',{type:s.type}))
  let prepares=0,puts=0,completes=0
  const mocked=mock.method(globalThis,'fetch',async(url:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    if(url===signedUrl){puts++;assert.equal(init?.method,'PUT');assert.equal(init?.credentials,'omit');assert.equal((init?.body as File).size,s.size);return Response.json({Key:'private'})}
    assert.equal(typeof init?.body,'string');assert.ok((init?.body as string).length<4096)
    if(String(url).endsWith('/prepare')){prepares++;return Response.json({uploadId:crypto.randomUUID(),signedUrl})}
    assert.ok(String(url).endsWith('/complete'));completes++;return Response.json(s.result)
  })
  try{assert.deepEqual(await Promise.all([s.run(form),s.run(form)]),[s.result,s.result]);assert.equal(prepares,1);assert.equal(puts,1);assert.equal(completes,1)}finally{mocked.mock.restore()}
})
test('files cannot be sent to an unexpected signed upload host/bucket',()=>{
  assert.equal(isMediaSignedUploadUrl(signedUrl),true)
  assert.equal(isMediaSignedUploadUrl(signedUrl.replace(origin,'https://evil.example')),false)
  assert.equal(isMediaSignedUploadUrl(signedUrl.replace('restaurant-media-staging','restaurant-assets')),false)
})
