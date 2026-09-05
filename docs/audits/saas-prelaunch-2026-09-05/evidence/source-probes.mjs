// Isolated audit reproductions. Executes the current source functions with
// explicit state/action doubles; this is not React rendering or browser QA.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

function sourceFunction(path, name, context, callback = false) {
  const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  let found
  function visit(node) {
    if (!callback && ts.isFunctionDeclaration(node) && node.name?.text === name) found = node
    if (callback && ts.isVariableDeclaration(node) && node.name.getText(source) === name && node.initializer && ts.isCallExpression(node.initializer)) found = node.initializer.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(source)
  assert.ok(found, `Missing source function: ${name}`)
  const code = ts.transpile(`(${found.getText(source).replace(/^export\s+/, '')})`, { target: ts.ScriptTarget.ES2022 })
  return vm.runInNewContext(code, context)
}

const update = (current, value) => typeof value === 'function' ? value(current) : value
const findings = []

// Newly created item is selected but mobile stage remains "items". Selecting
// the same item also exits early, so the normal tap cannot open its editor.
const shell = { items: [], selectedItem: null, workspaceStage: 'items', showAddItem: true }
const shellContext = {
  selectedItem: null,
  setItems: (value) => { shell.items = update(shell.items, value) },
  setSelectedItem: (value) => { shell.selectedItem = value; shellContext.selectedItem = value },
  setShowAddItem: (value) => { shell.showAddItem = value },
  setWorkspaceStage: (value) => { shell.workspaceStage = value },
  document: { activeElement: null },
  HTMLElement: class {},
  requestEditorExit: (action) => action(),
}
const shellPath = 'apps/dashboard/components/menu/use-menu-manager-shell-state.ts'
const newItem = { id: 'audit-product', name: 'Audit ürünü' }
sourceFunction(shellPath, 'createItem', shellContext)(newItem)
sourceFunction(shellPath, 'selectItem', shellContext)(newItem)
assert.equal(shell.selectedItem.id, newItem.id)
assert.equal(shell.workspaceStage, 'items')
findings.push({ id: 'F01', observed: 'createItem + selectItem(same item) leaves mobile workspaceStage=items', state: shell })

const notification = { loading: false, error: null }
const notificationContext = {
  restaurantId: 'audit-restaurant',
  setLoading: (value) => { notification.loading = value },
  setError: (value) => { notification.error = value },
  getNotifications: async () => { throw new Error('audit network rejection') },
  getInboxFeed: async () => ({ items: [], unread: 0 }),
  setItems: () => {}, setInboxItems: () => {}, setInboxUnread: () => {},
}
await assert.rejects(sourceFunction('apps/dashboard/components/overlays/NotificationsPanel.tsx', 'load', notificationContext, true)(), /audit network rejection/)
assert.equal(notification.loading, true)
assert.equal(notification.error, null)
findings.push({ id: 'F03', observed: 'rejected notification action leaves loading=true and no local error', state: notification })

const csvContext = {
  preview: { rows: [{ sourceRow: 2, name: 'Audit ürünü', category: 'Audit', price: 10 }], importing: false },
  restaurantId: 'audit-restaurant',
  setPreview: (value) => { csvContext.preview = update(csvContext.preview, value) },
  importMenuRows: async () => { throw new Error('audit network rejection') },
}
await assert.rejects(sourceFunction('apps/dashboard/components/menu/use-menu-csv-import.ts', 'importPreview', csvContext)(), /audit network rejection/)
assert.equal(csvContext.preview.importing, true)
findings.push({ id: 'F03', observed: 'rejected import action leaves importing=true', importing: csvContext.preview.importing })

// Two optimistic updates overlap while server responses are resolved IN ORDER.
// The second render captures the first optimistic value as its rollback base.
// If both requests fail, the UI restores a value that was never persisted.
const pending = []
const resolvers = []
const commands = {
  items: [{ id: 'audit-product', price: 10, is_available: true }],
  restaurantId: 'audit-restaurant', FormData,
  setItems: (value) => { commands.items = update(commands.items, value) },
  setSelectedItem: () => {},
  patchMenuItemCollection: null,
  startTransition: (action) => { pending.push(action()) },
  updateItem: () => new Promise((resolve) => resolvers.push(resolve)),
  onError: () => {}, onSuccess: () => {},
}
commands.patchMenuItemCollection = sourceFunction('apps/dashboard/components/menu/menu-manager-command-model.ts', 'patchMenuItemCollection', {})
const quickUpdate = sourceFunction('apps/dashboard/components/menu/use-menu-manager-commands.ts', 'quickUpdate', commands, true)
quickUpdate('audit-product', { price: 20 })
quickUpdate('audit-product', { price: 30 })
resolvers[0]({ error: 'older request failed' })
await pending[0]
resolvers[1]({ error: 'newer request also failed' })
await pending[1]
assert.equal(commands.items[0].price, 20)
findings.push({ id: 'F04', observed: 'in-order failures for optimistic 10->20->30 restore UI price=20 although neither mutation succeeded', authoritativeStartingPrice: 10, finalUiPrice: commands.items[0].price })

const parseNumeric = sourceFunction('packages/domain/src/menu.ts', 'parseMenuNumericInput', {})
assert.equal(parseNumeric('120,50', { required: true, min: 0.01 }).value, 120.5)
assert.equal(Number.isNaN(Number('120,50')), true)
findings.push({ id: 'F12', observed: 'domain input accepts 120,50; CSV Number conversion returns NaN' })

console.log(JSON.stringify({ method: 'Current source functions executed with state/action doubles; no browser or database', findings }, null, 2))
