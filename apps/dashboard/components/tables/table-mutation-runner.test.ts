import assert from 'node:assert/strict'
import test from 'node:test'
import { createTableMutationRunner } from './table-mutation-runner'
import { createTransferRequestIds } from './table-transfer-request'

for (const action of ['tahsilat', 'nakit payı', 'kart serbest bırakma', 'kart uzlaştırma', 'gerekçeli kapatma']) {
  test(`${action}: rejected transport releases busy and permits recovery`, async () => {
    const run = createTableMutationRunner()
    let busy = false, failures = 0, successes = 0
    const callbacks = { onStart: () => { busy = true }, onFinish: () => { busy = false }, onFailure: () => { failures++ } }
    await run({ ...callbacks, action: async () => { throw new Error('response lost') } })
    assert.equal(busy, false)
    assert.equal(failures, 1)
    await run({ ...callbacks, action: async () => { successes++ } })
    assert.equal(successes, 1)
    assert.equal(busy, false)
  })
}

test('double activation cannot start a second operation before the first settles', async () => {
  const run = createTableMutationRunner()
  let release!: () => void
  let writes = 0
  const action = async () => { writes++; await new Promise<void>((resolve) => { release = resolve }) }
  const callbacks = { onStart() {}, onFinish() {}, onFailure() { assert.fail('unexpected failure') } }
  const first = run({ ...callbacks, action })
  await run({ ...callbacks, action })
  assert.equal(writes, 1)
  release()
  await first
})

test('lost transfer response: the same intent replays the committed operation only once', async () => {
  let sequence = 0, targetQuantity = 0
  const ids = createTransferRequestIds(() => `id-${++sequence}`)
  const operations = new Map<string, string>()
  const submit = async (intent: string, loseResponse = false) => {
    const requestId = ids.forIntent(intent)
    if (!operations.has(requestId)) { targetQuantity++; operations.set(requestId, `operation-${requestId}`) }
    if (loseResponse) throw new Error('response lost after commit')
    return operations.get(requestId)
  }
  await assert.rejects(submit('source:A,target:B,item:toast,quantity:1', true))
  const result = await submit('source:A,target:B,item:toast,quantity:1')
  assert.equal(result, 'operation-id-1')
  assert.equal(targetQuantity, 1)
  await submit('source:A,target:C,item:toast,quantity:1')
  assert.equal(targetQuantity, 2)
  ids.clear()
  await submit('source:A,target:B,item:toast,quantity:1')
  assert.equal(targetQuantity, 3)
})
