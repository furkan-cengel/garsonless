import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = resolve(root, "apps/dashboard");
const qa = resolve(app, "app/inventory-qa");
await access("/private/tmp/masabu-inventory-fixture.json");
if (await access(qa).then(() => true, () => false)) throw new Error("A local inventory preview already exists.");
const backups = await Promise.all(["tsconfig.json", "next-env.d.ts"].map(async name => [name, await readFile(resolve(app,name))]));
let server;
try {
  await mkdir(qa);
  const workspace = await readFile(resolve(app, "components/inventory/InventoryWorkspace.tsx"), "utf8");
  await writeFile(resolve(qa, "Workspace.tsx"), workspace
    .replace('"@/lib/actions/inventory"', '"./actions"')
    .replaceAll('from "./', 'from "@/components/inventory/')
    .replace('"@/components/inventory/actions"', '"./actions"'));
  await writeFile(resolve(qa, "actions.ts"), (await readFile(resolve(root,"scripts/inventory/qa-actions.fixture"),"utf8"))
    .replace("'__INVENTORY_DB_PACKAGE__'",JSON.stringify(resolve(root,"packages/db/package.json"))));
  await writeFile(resolve(qa, "page.tsx"), `import { readFileSync } from 'node:fs'
import { notFound } from 'next/navigation'
import Workspace from './Workspace'
import { inventoryAction } from './actions'
import type { InventorySnapshot } from '@garsonless/domain/inventory'
export default async function Page() {
  if (process.env.NODE_ENV !== 'development') notFound()
  const f = JSON.parse(readFileSync('/private/tmp/masabu-inventory-fixture.json','utf8'))
  const result = await inventoryAction({restaurantId:f.restaurantId,mode:'snapshot'})
  return <><p className="mx-auto max-w-7xl px-6 pt-4 text-sm text-muted-foreground">Yerel stok önizlemesi · Örnek verilerle işlem yapabilirsiniz.</p><Workspace restaurantId={f.restaurantId} isOwner initial={result.ok ? result.data as InventorySnapshot : null}/></>
}
`);
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3024"], {
    cwd: app, env: {...process.env, NEXT_DIST_DIR: ".next-inventory-preview"}, stdio: "inherit",
  });
  const stop = () => server?.kill("SIGTERM");
  process.once("SIGTERM",stop);
  process.once("SIGINT",stop);
  await new Promise((resolve,reject) => {server.once("exit",resolve);server.once("error",reject)});
} finally {
  await rm(qa,{recursive:true,force:true});
  for (const [name,content] of backups) await writeFile(resolve(app,name),content);
  await rm(resolve(app,".next-inventory-preview"),{recursive:true,force:true});
}
